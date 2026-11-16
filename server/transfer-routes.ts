import type { Express } from "express";
import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import {
  books, bookCopies, libraries, libraryMemberships, users,
  transferRequests, transferRequestItems, transferLegs, transferCopyReservations,
  transferAcquisitionItems, transferEvents, transferNotifications,
  type User,
} from "@shared/schema";
import { db, returningViaCte } from "./db";

type Guard = (req: any, res: any) => Promise<User | null>;
type LibraryGuard = (req: any, res: any, libraryId: number) => Promise<User | null>;

export function registerTransferRoutes(
  app: Express,
  guards: { requireStaff: Guard; requireLocalAdmin: Guard; requireLibraryAccess: LibraryGuard },
) {
  const event = async (requestId: number, legId: number | null, actorId: number, action: string, details: unknown = {}) => {
    await db.insert(transferEvents).values({ requestId, legId, actorId, action, details });
  };
  const notify = async (requestId: number, recipientIds: number[], message: string) => {
    const unique = Array.from(new Set(recipientIds));
    if (unique.length) await db.insert(transferNotifications).values(unique.map(recipientId => ({ requestId, recipientId, message })));
  };
  const localAdmins = async () => db.select({ id: users.id }).from(users)
    .where(and(eq(users.role, "ADMIN"), isNull(users.erpIntegrationId)));
  const checkLibrary = async (req: any, res: any, user: User, libraryId: number) => {
    if (user.role === "ADMIN" && !user.erpIntegrationId) return true;
    if (user.role !== "LIBRARIAN") {
      res.status(403).json({ error: "Library administrator access required" });
      return false;
    }
    const [membership] = await db.select({ id: libraryMemberships.id }).from(libraryMemberships).where(and(
      eq(libraryMemberships.userId, user.id), eq(libraryMemberships.libraryId, libraryId),
      eq(libraryMemberships.isActive, true),
      or(isNull(libraryMemberships.expiresAt), sql`${libraryMemberships.expiresAt} > NOW()`),
    )).limit(1);
    if (!membership) res.status(403).json({ error: "You are not assigned to this library" });
    return !!membership;
  };
  const members = async (libraryId: number) => db.select({ userId: libraryMemberships.userId })
    .from(libraryMemberships).where(and(
      eq(libraryMemberships.libraryId, libraryId), eq(libraryMemberships.isActive, true),
      or(isNull(libraryMemberships.expiresAt), sql`${libraryMemberships.expiresAt} > NOW()`),
    ));
  const syncCompletion = async (requestId: number, actorId: number) => {
    const items = await db.select({ id: transferRequestItems.id }).from(transferRequestItems).where(eq(transferRequestItems.requestId, requestId));
    const ids = items.map(row => row.id);
    const legs = ids.length ? await db.select().from(transferLegs).where(inArray(transferLegs.itemId, ids)) : [];
    const acquisitions = await db.select().from(transferAcquisitionItems).where(eq(transferAcquisitionItems.requestId, requestId));
    const allTransfersDone = legs.every(leg => leg.status === "COMPLETED");
    const allAcquisitionsHandedOff = acquisitions.every(item => item.status !== "CANCELLED");
    if (allTransfersDone && allAcquisitionsHandedOff && (legs.length > 0 || acquisitions.length > 0)) {
      await db.update(transferRequests).set({ status: "COMPLETED", updatedAt: new Date() }).where(eq(transferRequests.id, requestId));
      await event(requestId, null, actorId, "REQUEST_COMPLETED", {});
    }
  };

  app.get("/api/transfers/catalog", async (req, res) => {
    const user = await guards.requireStaff(req, res);
    if (!user) return;
    const libraryId = Number(req.query.libraryId);
    if (!Number.isInteger(libraryId) || libraryId < 1) return res.status(400).json({ error: "Choose a library" });
    if (!await checkLibrary(req, res, user, libraryId)) return;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const bookRows = await db.select().from(books).where(search
      ? or(ilike(books.title, `%${search}%`), ilike(books.author, `%${search}%`), ilike(books.isbn, `%${search}%`))
      : sql`true`).limit(100);
    const copies = await db.select({
      bookId: bookCopies.bookId, libraryId: bookCopies.libraryId, libraryName: libraries.name,
      quantity: sql<number>`count(*)::int`,
    }).from(bookCopies).innerJoin(libraries, eq(libraries.id, bookCopies.libraryId))
      .where(and(eq(bookCopies.status, "AVAILABLE"), sql`${bookCopies.libraryId} <> ${libraryId}`,
        inArray(bookCopies.bookId, bookRows.map(book => book.id)),
        sql`NOT EXISTS (SELECT 1 FROM transfer_copy_reservations r WHERE r.copy_id = ${bookCopies.id} AND r.released_at IS NULL)`))
      .groupBy(bookCopies.bookId, bookCopies.libraryId, libraries.name);
    res.json(bookRows.map(book => ({ ...book, sources: copies.filter(row => row.bookId === book.id) })));
  });

  app.get("/api/transfers", async (req, res) => {
    const user = await guards.requireStaff(req, res);
    if (!user) return;
    if (user.role === "ADMIN" && user.erpIntegrationId) return res.status(403).json({ error: "Local administrator access required" });
    const [requests, items, legs, queues] = await Promise.all([
      db.select().from(transferRequests), db.select().from(transferRequestItems),
      db.select().from(transferLegs), db.select().from(transferAcquisitionItems),
    ]);
    let allowedLibraryIds: Set<number> | null = null;
    if (user.role !== "ADMIN") {
      const active = await db.select({ libraryId: libraryMemberships.libraryId }).from(libraryMemberships).where(and(
        eq(libraryMemberships.userId, user.id), eq(libraryMemberships.isActive, true),
        or(isNull(libraryMemberships.expiresAt), sql`${libraryMemberships.expiresAt} > NOW()`),
      ));
      allowedLibraryIds = new Set(active.map(row => row.libraryId));
    }
    const booksById = new Map((await db.select().from(books)).map(row => [row.id, row]));
    const librariesById = new Map((await db.select({ id: libraries.id, name: libraries.name, code: libraries.code }).from(libraries)).map(row => [row.id, row]));
    const result = requests.filter(request => !allowedLibraryIds || allowedLibraryIds.has(request.destinationLibraryId)
      || legs.some(leg => items.some(item => item.id === leg.itemId && item.requestId === request.id) && allowedLibraryIds!.has(leg.sourceLibraryId)))
      .map(request => ({
        ...request,
        destination: librariesById.get(request.destinationLibraryId),
        items: items.filter(item => item.requestId === request.id).map(item => ({
          ...item, book: booksById.get(item.bookId),
          legs: legs.filter(leg => leg.itemId === item.id).map(leg => ({ ...leg, source: librariesById.get(leg.sourceLibraryId) })),
          acquisitions: queues.filter(queue => queue.itemId === item.id),
        })),
        events: [],
      }));
    const requestIds = result.map(row => row.id);
    const events = requestIds.length ? await db.select({
      id: transferEvents.id,
      requestId: transferEvents.requestId,
      legId: transferEvents.legId,
      actorId: transferEvents.actorId,
      actorName: users.name,
      action: transferEvents.action,
      details: transferEvents.details,
      createdAt: transferEvents.createdAt,
    }).from(transferEvents).innerJoin(users, eq(users.id, transferEvents.actorId))
      .where(inArray(transferEvents.requestId, requestIds)).orderBy(asc(transferEvents.createdAt)) : [];
    const scoped = result.map(row => ({ ...row, events: events.filter(entry => entry.requestId === row.id) }));
    res.json(scoped);
  });

  app.post("/api/transfers", async (req, res) => {
    const user = await guards.requireStaff(req, res);
    if (!user) return;
    const { destinationLibraryId, reason, items } = req.body || {};
    if (!Number.isInteger(destinationLibraryId) || !Array.isArray(items) || !items.length || items.length > 50 || !String(reason || "").trim()) {
      return res.status(400).json({ error: "Provide a destination, reason, and at least one book" });
    }
    if (items.some((item: any) => !Number.isInteger(item.bookId) || !Number.isInteger(item.quantity) || item.quantity < 1)) {
      return res.status(400).json({ error: "Every book needs a valid quantity" });
    }
    if (!await checkLibrary(req, res, user, destinationLibraryId)) return;
    const [request] = await returningViaCte<any>(db.insert(transferRequests).values({
      destinationLibraryId, requestedBy: user.id, reason: String(reason).trim(),
    }).returning());
    const sourcePairs = items.flatMap((item: any) => Array.isArray(item.preferredSources) ? item.preferredSources : []);
    if (sourcePairs.some((source: any) => !Number.isInteger(source.libraryId) || !Number.isInteger(source.quantity) || source.quantity < 1 || source.libraryId === destinationLibraryId)) {
      await db.delete(transferRequests).where(eq(transferRequests.id, request.id));
      return res.status(400).json({ error: "Preferred sources must be other libraries with positive quantities" });
    }
    if (sourcePairs.length) {
      const sourceLibraries = await db.select({ id: libraries.id, isActive: libraries.isActive }).from(libraries)
        .where(inArray(libraries.id, sourcePairs.map((source: any) => source.libraryId)));
      if (sourceLibraries.length !== new Set(sourcePairs.map((source: any) => source.libraryId)).size
        || sourceLibraries.some(library => !library.isActive)) {
        await db.delete(transferRequests).where(eq(transferRequests.id, request.id));
        return res.status(400).json({ error: "A preferred source library is unavailable" });
      }
    }
    for (const item of items) {
      const preferredTotal = (Array.isArray(item.preferredSources) ? item.preferredSources : []).reduce((sum: number, source: any) => sum + source.quantity, 0);
      if (preferredTotal > item.quantity) {
        await db.delete(transferRequests).where(eq(transferRequests.id, request.id));
        return res.status(400).json({ error: "Preferred source quantities cannot exceed the requested quantity" });
      }
    }
    const recipients = await localAdmins();
    for (const item of items) {
      if (!Number.isInteger(item.bookId) || !Number.isInteger(item.quantity) || item.quantity < 1) continue;
      const [created] = await returningViaCte<any>(db.insert(transferRequestItems).values({
        requestId: request.id, bookId: item.bookId, requestedQuantity: item.quantity,
      }).returning());
      for (const preferred of (Array.isArray(item.preferredSources) ? item.preferredSources : [])) {
        if (!Number.isInteger(preferred.libraryId) || !Number.isInteger(preferred.quantity) || preferred.quantity < 1) continue;
        await db.insert(transferLegs).values({
          itemId: created.id, sourceLibraryId: preferred.libraryId, requestedQuantity: preferred.quantity,
          approvedQuantity: 0, status: "PREFERRED",
        });
      }
    }
    await event(request.id, null, user.id, "REQUESTED", {
      reason,
      items: items.map((item: any) => ({
        bookId: item.bookId,
        quantity: item.quantity,
        preferredSources: item.preferredSources || [],
      })),
    });
    await notify(request.id, recipients.map(row => row.id), `Transfer request #${request.id} needs review`);
    res.status(201).json(request);
  });

  app.post("/api/transfers/:id/review", async (req, res) => {
    const user = await guards.requireLocalAdmin(req, res);
    if (!user) return;
    const id = Number(req.params.id);
    const request = (await db.select().from(transferRequests).where(eq(transferRequests.id, id)))[0];
    if (!request || request.status !== "PENDING_REVIEW") return res.status(404).json({ error: "Pending transfer request not found" });
    const action = req.body?.action;
    if (action === "reject") {
      const reason = String(req.body.reason || "").trim();
      if (!reason) return res.status(400).json({ error: "A rejection reason is required" });
      await db.update(transferRequests).set({ status: "REJECTED", rejectionReason: reason, reviewedBy: user.id, updatedAt: new Date() }).where(eq(transferRequests.id, id));
      await event(id, null, user.id, "REJECTED", { reason });
      await notify(id, [request.requestedBy], `Transfer request #${id} was rejected`);
    } else if (action === "approve") {
      const allocations = Array.isArray(req.body.allocations) ? req.body.allocations : [];
      const acquisitions = Array.isArray(req.body.acquisitions) ? req.body.acquisitions : [];
      const items = await db.select().from(transferRequestItems).where(eq(transferRequestItems.requestId, id));
      if (allocations.some((row: any) => !Number.isInteger(row.itemId) || !Number.isInteger(row.libraryId) || !Number.isInteger(row.quantity) || row.quantity < 1)
        || acquisitions.some((row: any) => !Number.isInteger(row.itemId) || !Number.isInteger(row.quantity) || row.quantity < 1)) {
        return res.status(400).json({ error: "Allocation quantities must be positive whole numbers" });
      }
      if (allocations.some((row: any) => !items.some(item => item.id === row.itemId))
        || acquisitions.some((row: any) => !items.some(item => item.id === row.itemId))) {
        return res.status(400).json({ error: "Allocation references an unknown request item" });
      }
      for (const item of items) {
        const requested = allocations.filter((row: any) => row.itemId === item.id).reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0)
          + acquisitions.filter((row: any) => row.itemId === item.id).reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0);
        if (requested !== item.requestedQuantity) return res.status(400).json({ error: `Allocations and acquisition quantity must total ${item.requestedQuantity} for ${item.id}` });
      }
      for (const allocation of allocations) {
        const item = items.find(row => row.id === allocation.itemId);
        if (!item || allocation.libraryId === request.destinationLibraryId) return res.status(400).json({ error: "Choose a different source library for each transfer leg" });
        const [lib] = await db.select().from(libraries).where(eq(libraries.id, allocation.libraryId));
        if (!lib?.isActive) return res.status(400).json({ error: "The selected source library is unavailable" });
        const available = await db.execute(sql`SELECT count(*)::int AS count FROM book_copies bc
          WHERE bc.book_id = ${item.bookId} AND bc.library_id = ${allocation.libraryId} AND bc.status = 'AVAILABLE'
          AND NOT EXISTS (SELECT 1 FROM transfer_copy_reservations r WHERE r.copy_id = bc.id AND r.released_at IS NULL)`);
        if (Number((available as any)?.rows?.[0]?.count ?? 0) < allocation.quantity) return res.status(409).json({ error: `${lib.name} does not have that many available copies` });
        await db.insert(transferLegs).values({ itemId: item.id, sourceLibraryId: allocation.libraryId, requestedQuantity: allocation.quantity, approvedQuantity: allocation.quantity });
      }
      for (const acquisition of acquisitions) {
        const item = items.find(row => row.id === acquisition.itemId);
        if (!item) return res.status(400).json({ error: "Acquisition references an unknown request item" });
        await db.insert(transferAcquisitionItems).values({ requestId: id, itemId: item.id, quantity: acquisition.quantity, createdBy: user.id });
      }
      await db.update(transferRequests).set({ status: "APPROVED", reviewedBy: user.id, updatedAt: new Date() }).where(eq(transferRequests.id, id));
      await event(id, null, user.id, "APPROVED", { allocations, acquisitions });
      const recipients = [...(await members(request.destinationLibraryId)).map(row => row.userId)];
      for (const allocation of allocations) if (Number.isInteger(allocation.libraryId)) recipients.push(...(await members(allocation.libraryId)).map(row => row.userId));
      await notify(id, recipients, `Transfer request #${id} has approved actions`);
      await syncCompletion(id, user.id);
    } else return res.status(400).json({ error: "Choose approve or reject" });
    res.json({ success: true });
  });

  app.post("/api/transfers/legs/:id/accept", async (req, res) => {
    const user = await guards.requireStaff(req, res);
    if (!user) return;
    const legId = Number(req.params.id);
    const leg = (await db.select().from(transferLegs).where(eq(transferLegs.id, legId)))[0];
    if (!leg) return res.status(404).json({ error: "Transfer leg not found" });
    if (!await checkLibrary(req, res, user, leg.sourceLibraryId)) return;
    const quantity = Number(req.body?.quantity);
    if (leg.status !== "AWAITING_SOURCE" || !Number.isInteger(quantity) || quantity < 1 || quantity > leg.approvedQuantity) {
      return res.status(400).json({ error: "Enter an accepted quantity within the approved amount" });
    }
    if (quantity < leg.approvedQuantity && !String(req.body?.reason || "").trim()) {
      return res.status(400).json({ error: "Explain why the source quantity is being reduced" });
    }
    const item = (await db.select().from(transferRequestItems).where(eq(transferRequestItems.id, leg.itemId)))[0];
    const lock = sql`SELECT pg_advisory_xact_lock(hashtextextended(${`transfer:${leg.sourceLibraryId}:${item.bookId}`}, 0))`;
    const reserve = sql`
      WITH eligible AS (
        SELECT bc.id FROM book_copies bc
        WHERE bc.book_id = ${item.bookId} AND bc.library_id = ${leg.sourceLibraryId} AND bc.status = 'AVAILABLE'
          AND NOT EXISTS (SELECT 1 FROM transfer_copy_reservations r WHERE r.copy_id = bc.id AND r.released_at IS NULL)
        ORDER BY bc.id LIMIT ${quantity} FOR UPDATE SKIP LOCKED
      ), inserted AS (
        INSERT INTO transfer_copy_reservations (leg_id, copy_id)
        SELECT ${legId}, id FROM eligible ON CONFLICT DO NOTHING RETURNING copy_id
      ), reserved AS (
        UPDATE book_copies bc SET status = 'RESERVED', updated_at = NOW()
        FROM inserted WHERE bc.id = inserted.copy_id RETURNING bc.id
      ) SELECT count(*)::int AS count FROM reserved`;
    const results = await db.batch([db.execute(lock), db.execute(reserve)]);
    const count = Number((results[1] as any)?.rows?.[0]?.count ?? 0);
    if (count !== quantity) return res.status(409).json({ error: "That quantity is no longer available; ask the administrator to reallocate it" });
    await db.update(transferLegs).set({ acceptedQuantity: quantity, sourceNote: String(req.body.reason || "").trim() || null, status: "ACCEPTED", updatedAt: new Date() }).where(eq(transferLegs.id, legId));
    const requestId = (await db.select({ requestId: transferRequestItems.requestId }).from(transferRequestItems).where(eq(transferRequestItems.id, leg.itemId)))[0].requestId;
    await event(requestId, legId, user.id, "SOURCE_ACCEPTED", { quantity, reason: req.body.reason || "" });
    const request = (await db.select().from(transferRequests).where(eq(transferRequests.id, requestId)))[0];
    if (quantity < leg.approvedQuantity) {
      await db.update(transferRequests).set({ status: "NEEDS_REALLOCATION", updatedAt: new Date() }).where(eq(transferRequests.id, requestId));
      await event(requestId, legId, user.id, "SHORTFALL_NEEDS_REVIEW", { approved: leg.approvedQuantity, accepted: quantity });
    }
    await notify(requestId, [request.requestedBy, ...(await localAdmins()).map(row => row.id)], `A source library accepted transfer leg #${legId}`);
    res.json({ success: true });
  });

  app.post("/api/transfers/:id/resolve-shortfall", async (req, res) => {
    const user = await guards.requireLocalAdmin(req, res);
    if (!user) return;
    const requestId = Number(req.params.id);
    const request = (await db.select().from(transferRequests).where(eq(transferRequests.id, requestId)))[0];
    if (!request || request.status !== "NEEDS_REALLOCATION") return res.status(404).json({ error: "Transfer shortfall not found" });
    const allocations = Array.isArray(req.body?.allocations) ? req.body.allocations : [];
    const acquisitions = Array.isArray(req.body?.acquisitions) ? req.body.acquisitions : [];
    if (allocations.some((row: any) => !Number.isInteger(row.itemId) || !Number.isInteger(row.libraryId) || !Number.isInteger(row.quantity) || row.quantity < 1)
      || acquisitions.some((row: any) => !Number.isInteger(row.itemId) || !Number.isInteger(row.quantity) || row.quantity < 1)) {
      return res.status(400).json({ error: "Allocation quantities must be positive whole numbers" });
    }
    const items = await db.select().from(transferRequestItems).where(eq(transferRequestItems.requestId, requestId));
    const legs = await db.select().from(transferLegs).where(inArray(transferLegs.itemId, items.map(item => item.id)));
    const queued = await db.select().from(transferAcquisitionItems).where(eq(transferAcquisitionItems.requestId, requestId));
    for (const item of items) {
      const existingLegs = legs.filter(leg => leg.itemId === item.id);
      const committed = existingLegs.reduce((sum, leg) => sum + (leg.status === "DISCREPANCY"
        ? (leg.receivedQuantity || 0)
        : (leg.acceptedQuantity ?? leg.approvedQuantity)), 0);
      const existingAcq = queued.filter(row => row.itemId === item.id && !["CANCELLED"].includes(row.status)).reduce((sum, row) => sum + row.quantity, 0);
      const remaining = Math.max(0, item.requestedQuantity - committed - existingAcq);
      const newAllocation = allocations.filter((row: any) => row.itemId === item.id).reduce((sum: number, row: any) => sum + (Number.isInteger(row.quantity) && row.quantity > 0 ? row.quantity : 0), 0);
      const newAcquisition = acquisitions.filter((row: any) => row.itemId === item.id).reduce((sum: number, row: any) => sum + (Number.isInteger(row.quantity) && row.quantity > 0 ? row.quantity : 0), 0);
      if (newAllocation + newAcquisition !== remaining) return res.status(400).json({ error: `Reallocation for item ${item.id} must total ${remaining}` });
    }
    for (const row of allocations) {
      const item = items.find(value => value.id === row.itemId);
      if (!item || row.libraryId === request.destinationLibraryId) return res.status(400).json({ error: "Choose a different source library for each transfer leg" });
      const [lib] = await db.select().from(libraries).where(eq(libraries.id, row.libraryId));
      if (!lib?.isActive) return res.status(400).json({ error: "The selected source library is unavailable" });
      const available = await db.execute(sql`SELECT count(*)::int AS count FROM book_copies bc
        WHERE bc.book_id = ${item.bookId} AND bc.library_id = ${row.libraryId} AND bc.status = 'AVAILABLE'
        AND NOT EXISTS (SELECT 1 FROM transfer_copy_reservations r WHERE r.copy_id = bc.id AND r.released_at IS NULL)`);
      if (Number((available as any)?.rows?.[0]?.count ?? 0) < row.quantity) return res.status(409).json({ error: "A source library no longer has enough available copies" });
      await db.insert(transferLegs).values({ itemId: item.id, sourceLibraryId: row.libraryId, requestedQuantity: row.quantity, approvedQuantity: row.quantity });
    }
    for (const row of acquisitions) {
      const item = items.find(value => value.id === row.itemId);
      if (!item) return res.status(400).json({ error: "Acquisition references an unknown request item" });
      await db.insert(transferAcquisitionItems).values({ requestId, itemId: item.id, quantity: row.quantity, createdBy: user.id });
    }
    await db.update(transferRequests).set({ status: "APPROVED", updatedAt: new Date() }).where(eq(transferRequests.id, requestId));
    for (const leg of legs.filter(value => value.status === "DISCREPANCY")) {
      await db.update(transferLegs).set({ status: "COMPLETED", updatedAt: new Date() }).where(eq(transferLegs.id, leg.id));
    }
    await event(requestId, null, user.id, "SHORTFALL_RESOLVED", { allocations, acquisitions });
    await syncCompletion(requestId, user.id);
    res.json({ success: true });
  });

  app.post("/api/transfers/legs/:id/dispatch", async (req, res) => {
    const user = await guards.requireLocalAdmin(req, res);
    if (!user) return;
    const legId = Number(req.params.id);
    const leg = (await db.select().from(transferLegs).where(eq(transferLegs.id, legId)))[0];
    if (!leg || leg.status !== "ACCEPTED") return res.status(404).json({ error: "Accepted transfer leg not found" });
    const { type, details } = req.body || {};
    if (!["EMPLOYEE", "COURIER"].includes(type) || !details || !Object.values(details).some(value => String(value || "").trim())) return res.status(400).json({ error: "Provide handover details" });
    const requiredFields = type === "EMPLOYEE" ? ["employeeId", "name", "phone"] : ["agency", "docketNumber", "date"];
    if (requiredFields.some(field => !String(details[field] || "").trim())) return res.status(400).json({ error: `Provide ${requiredFields.join(", ")}` });
    const reservedCopies = await db.select({ copyId: transferCopyReservations.copyId }).from(transferCopyReservations)
      .where(and(eq(transferCopyReservations.legId, legId), isNull(transferCopyReservations.releasedAt)));
    if (reservedCopies.length) await db.update(bookCopies).set({ status: "IN_TRANSIT", updatedAt: new Date() })
      .where(inArray(bookCopies.id, reservedCopies.map(row => row.copyId)));
    await db.update(transferLegs).set({ status: "IN_TRANSIT", handoverType: type, handoverDetails: details, updatedAt: new Date() }).where(eq(transferLegs.id, legId));
    const requestId = (await db.select({ requestId: transferRequestItems.requestId }).from(transferRequestItems).where(eq(transferRequestItems.id, leg.itemId)))[0].requestId;
    await event(requestId, legId, user.id, "DISPATCHED", { type, details });
    const item = (await db.select().from(transferRequestItems).where(eq(transferRequestItems.id, leg.itemId)))[0];
    const request = (await db.select().from(transferRequests).where(eq(transferRequests.id, item.requestId)))[0];
    await notify(item.requestId, [request.requestedBy, ...(await members(request.destinationLibraryId)).map(row => row.userId)], `Transfer leg #${legId} has been dispatched`);
    res.json({ success: true });
  });

  app.post("/api/transfers/legs/:id/receive", async (req, res) => {
    const user = await guards.requireStaff(req, res);
    if (!user) return;
    const legId = Number(req.params.id);
    const leg = (await db.select().from(transferLegs).where(eq(transferLegs.id, legId)))[0];
    if (!leg) return res.status(404).json({ error: "Transfer leg not found" });
    const item = (await db.select().from(transferRequestItems).where(eq(transferRequestItems.id, leg.itemId)))[0];
    const request = (await db.select().from(transferRequests).where(eq(transferRequests.id, item.requestId)))[0];
    if (!await checkLibrary(req, res, user, request.destinationLibraryId)) return;
    const quantity = Number(req.body?.quantity);
    if (leg.status !== "IN_TRANSIT" || !Number.isInteger(quantity) || quantity < 0 || quantity > (leg.acceptedQuantity || 0)) return res.status(400).json({ error: "Enter a received quantity within the dispatched amount" });
    if (quantity < (leg.acceptedQuantity || 0) && !String(req.body?.discrepancy || "").trim()) return res.status(400).json({ error: "Describe the receipt discrepancy" });
    const condition = String(req.body?.condition || "GOOD").toUpperCase();
    if (!["GOOD", "DAMAGED"].includes(condition)) return res.status(400).json({ error: "Choose GOOD or DAMAGED condition" });
    const reservations = await db.select({ copyId: transferCopyReservations.copyId }).from(transferCopyReservations).where(and(eq(transferCopyReservations.legId, legId), isNull(transferCopyReservations.releasedAt)));
    const receivedIds = reservations.slice(0, quantity).map(row => row.copyId);
    if (receivedIds.length) await db.update(bookCopies).set({ libraryId: request.destinationLibraryId, status: condition === "DAMAGED" ? "DAMAGED" : "AVAILABLE", updatedAt: new Date() }).where(inArray(bookCopies.id, receivedIds));
    const receivedSet = new Set(receivedIds);
    const notReceivedIds = reservations.map(row => row.copyId).filter(id => !receivedSet.has(id));
    if (notReceivedIds.length) await db.update(bookCopies).set({ status: "AVAILABLE", updatedAt: new Date() }).where(inArray(bookCopies.id, notReceivedIds));
    if (reservations.length) await db.update(transferCopyReservations).set({ releasedAt: new Date() }).where(and(eq(transferCopyReservations.legId, legId), isNull(transferCopyReservations.releasedAt)));
    await db.update(transferLegs).set({
      receivedQuantity: quantity, receivedCondition: condition,
      discrepancyNote: String(req.body.discrepancy || "").trim() || null,
      status: quantity === (leg.acceptedQuantity || 0) ? "COMPLETED" : "DISCREPANCY", updatedAt: new Date(),
    }).where(eq(transferLegs.id, legId));
    await event(item.requestId, legId, user.id, quantity === (leg.acceptedQuantity || 0) ? "RECEIVED" : "RECEIPT_DISCREPANCY", {
      quantity, expected: leg.acceptedQuantity, condition, discrepancy: req.body.discrepancy || "",
    });
    if (quantity < (leg.acceptedQuantity || 0)) {
      await db.update(transferRequests).set({ status: "NEEDS_REALLOCATION", updatedAt: new Date() }).where(eq(transferRequests.id, item.requestId));
    } else await syncCompletion(item.requestId, user.id);
    await notify(item.requestId, (await members(leg.sourceLibraryId)).map(row => row.userId), `Transfer leg #${legId} receipt was recorded`);
    res.json({ success: true });
  });

  app.get("/api/transfers/acquisitions", async (req, res) => {
    const user = await guards.requireLocalAdmin(req, res);
    if (!user) return;
    const rows = await db.select({
      item: transferAcquisitionItems, request: transferRequests, book: books,
    }).from(transferAcquisitionItems)
      .innerJoin(transferRequests, eq(transferRequests.id, transferAcquisitionItems.requestId))
      .innerJoin(transferRequestItems, eq(transferRequestItems.id, transferAcquisitionItems.itemId))
      .innerJoin(books, eq(books.id, transferRequestItems.bookId));
    res.json(rows);
  });

  app.patch("/api/transfers/acquisitions/:id", async (req, res) => {
    const user = await guards.requireLocalAdmin(req, res);
    if (!user) return;
    const id = Number(req.params.id);
    const status = String(req.body?.status || "");
    if (!["QUEUED", "ORDERED", "RECEIVED", "CANCELLED"].includes(status)) return res.status(400).json({ error: "Invalid acquisition status" });
    const [item] = await db.select().from(transferAcquisitionItems).where(eq(transferAcquisitionItems.id, id));
    if (!item) return res.status(404).json({ error: "Acquisition queue item not found" });
    await db.update(transferAcquisitionItems).set({ status, notes: String(req.body.notes || "").trim() || item.notes }).where(eq(transferAcquisitionItems.id, id));
    await event(item.requestId, null, user.id, "ACQUISITION_STATUS_CHANGED", { acquisitionId: id, status, notes: req.body.notes || "" });
    await syncCompletion(item.requestId, user.id);
    res.json({ success: true });
  });

  app.get("/api/transfers/notifications", async (req, res) => {
    const user = await guards.requireStaff(req, res);
    if (!user) return;
    res.json(await db.select().from(transferNotifications).where(eq(transferNotifications.recipientId, user.id)).orderBy(sql`${transferNotifications.createdAt} DESC`).limit(50));
  });
  app.post("/api/transfers/notifications/:id/read", async (req, res) => {
    const user = await guards.requireStaff(req, res);
    if (!user) return;
    await db.update(transferNotifications).set({ readAt: new Date() }).where(and(eq(transferNotifications.id, Number(req.params.id)), eq(transferNotifications.recipientId, user.id)));
    res.json({ success: true });
  });
}
