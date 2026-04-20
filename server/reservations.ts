import type { Express } from "express";
import { z } from "zod";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { storage } from "./storage";
import { logAudit } from "./audit";
import { loadGlobalCirculationDefaults } from "./fines";
import { db } from "./db";
import { eq, and, inArray } from "drizzle-orm";
import { reservations, reservationPickups, bookCopies } from "@shared/schema";

const PICKUP_OTP_TTL_MINUTES = 15;

// ----- Helpers -----

async function resolveLibraryReservationDays(libraryId: number): Promise<number> {
  const lib = await storage.getLibrary(libraryId);
  const globals = await loadGlobalCirculationDefaults();
  const days = lib?.policies?.reservationDays ?? globals.reservationDays ?? 7;
  return Math.max(1, days);
}

async function expireStaleReservationsInternal(): Promise<number> {
  const now = new Date();
  const stale = await storage.findExpiredActiveReservations(now);
  if (stale.length === 0) return 0;
  for (const r of stale) {
    await storage.updateReservation(r.id, { status: 'EXPIRED' });
    if (r.bookCopyId) {
      // Only release the copy if it is still RESERVED for this reservation
      const copy = await storage.getBookCopy(r.bookCopyId);
      if (copy && copy.status === 'RESERVED') {
        await storage.updateBookCopy(r.bookCopyId, { status: 'AVAILABLE' });
      }
    }
  }
  return stale.length;
}

async function findHoldableCopy(bookId: number, libraryId: number) {
  // Pick first AVAILABLE copy in this library for the given book.
  const copies = await storage.getBookCopiesByBookAndLibrary(bookId, libraryId);
  return copies.find(c => c.status === 'AVAILABLE');
}

// Atomically claim an AVAILABLE copy by flipping it to RESERVED.
// Returns the claimed copy or undefined if another request beat us to it.
async function claimAvailableCopyAtomically(copyId: number) {
  const rows = await db
    .update(bookCopies)
    .set({ status: 'RESERVED' as any, updatedAt: new Date() })
    .where(and(eq(bookCopies.id, copyId), eq(bookCopies.status, 'AVAILABLE' as any)))
    .returning();
  return rows[0];
}

async function sendPickupOtpEmail(to: string, name: string, otp: string, books: { title: string; ssn: string | null }[]) {
  const hostConfig = await storage.getSystemConfig("smtp_host");
  const portConfig = await storage.getSystemConfig("smtp_port");
  const secureConfig = await storage.getSystemConfig("smtp_secure");
  const userConfig = await storage.getSystemConfig("smtp_user");
  const passConfig = await storage.getSystemConfig("smtp_pass");
  const fromConfig = await storage.getSystemConfig("smtp_from");
  if (!hostConfig || !userConfig || !passConfig) {
    throw new Error("Email is not configured. Please contact the administrator.");
  }
  const transporter = nodemailer.createTransport({
    host: hostConfig.value,
    port: parseInt(portConfig?.value || "587"),
    secure: secureConfig?.value === "true",
    auth: { user: userConfig.value, pass: passConfig.value },
  });
  const list = books.map(b => `<li><strong>${b.title}</strong>${b.ssn ? ` <span style="color:#94a3b8">(SSN: ${b.ssn})</span>` : ''}</li>`).join('');
  await transporter.sendMail({
    from: fromConfig?.value || userConfig.value,
    to,
    subject: "LibraTech - Reservation Pickup OTP",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">LibraTech</h1>
          <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Reservation Pickup Confirmation</p>
        </div>
        <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
          <h2 style="color: #1e293b; margin-top: 0;">Hello ${name},</h2>
          <p style="color: #475569;">Library staff is processing the pickup of your reserved book(s):</p>
          <ul style="color:#475569;">${list}</ul>
          <p style="color: #475569;">Please share this OTP with the librarian to confirm collection:</p>
          <div style="background: #f1f5f9; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af; font-family: 'Courier New', monospace;">${otp}</span>
          </div>
          <p style="color: #ef4444; font-size: 14px; font-weight: 500;">This OTP expires in ${PICKUP_OTP_TTL_MINUTES} minutes.</p>
          <p style="color: #94a3b8; font-size: 13px;">If you did not request this pickup, please contact the library immediately.</p>
        </div>
      </div>`,
  });
}

function getSessionId(req: any): string | undefined {
  const cookieId = req.cookies && req.cookies.session_id;
  if (cookieId) return cookieId;
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const x = req.headers?.['x-session-id'];
  if (typeof x === 'string' && x.trim()) return x.trim();
  return undefined;
}

async function requireUser(req: any, res: any) {
  const sessionId = getSessionId(req);
  if (!sessionId) { res.status(401).json({ error: "Authentication required" }); return null; }
  const session = await storage.getSession(sessionId);
  if (!session) { res.status(401).json({ error: "Invalid session" }); return null; }
  const user = await storage.getUser(session.userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return null; }
  return user;
}

async function requireStaff(req: any, res: any) {
  const u = await requireUser(req, res);
  if (!u) return null;
  if (u.role !== 'ADMIN' && u.role !== 'LIBRARIAN') {
    res.status(403).json({ error: "Staff access required" });
    return null;
  }
  return u;
}

// Returns true if the staff user is allowed to act on the given libraryId.
// Admins always pass; librarians must have an active membership in that library.
async function staffCanAccessLibrary(staff: { id: number; role: string }, libraryId: number | null | undefined) {
  if (!libraryId) return true;
  if (staff.role === 'ADMIN') return true;
  const memberships = await storage.getMembershipsByUser(staff.id);
  return memberships.some(m => m.libraryId === libraryId && m.isActive);
}

// ----- Schemas -----

const createReservationItemSchema = z.object({
  bookId: z.number().int().positive(),
  libraryId: z.number().int().positive(),
  reservedFor: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const createReservationSchema = z.object({
  userId: z.number().int().positive().optional(), // staff/integration may reserve on behalf
  items: z.array(createReservationItemSchema).min(1),
});

const initiatePickupSchema = z.object({
  reservationIds: z.array(z.number().int().positive()).min(1),
  userIdentifier: z.string().min(1), // enrollment / employee id / username
});

const confirmPickupSchema = z.object({
  pickupId: z.number().int().positive(),
  otp: z.string().min(4).max(8),
});

// ----- Routes -----

export function registerReservationRoutes(app: Express) {
  // Create one or more reservations.
  // - Patrons (STUDENT/FACULTY) reserve for themselves.
  // - Staff (ADMIN/LIBRARIAN) may reserve on behalf of a patron via userId.
  app.post("/api/reservations", async (req, res) => {
    try {
      const me = await requireUser(req, res); if (!me) return;
      const body = createReservationSchema.parse(req.body);

      let targetUserId = me.id;
      if (body.userId && body.userId !== me.id) {
        if (me.role !== 'ADMIN' && me.role !== 'LIBRARIAN') {
          return res.status(403).json({ error: "Only staff can reserve on behalf of another user" });
        }
        const target = await storage.getUser(body.userId);
        if (!target) return res.status(404).json({ error: "Target user not found" });
        targetUserId = target.id;
      }

      await expireStaleReservationsInternal();

      const created: any[] = [];
      const failed: any[] = [];

      for (const item of body.items) {
        const book = await storage.getBook(item.bookId);
        if (!book) { failed.push({ bookId: item.bookId, error: "Book not found" }); continue; }
        const lib = await storage.getLibrary(item.libraryId);
        if (!lib) { failed.push({ bookId: item.bookId, error: "Library not found" }); continue; }

        // Try to atomically claim an available copy. Retry a few times to handle
        // concurrent claims on different candidate copies in the same library.
        let copy: Awaited<ReturnType<typeof claimAvailableCopyAtomically>> | undefined;
        for (let attempt = 0; attempt < 5 && !copy; attempt++) {
          const candidate = await findHoldableCopy(item.bookId, item.libraryId);
          if (!candidate) break;
          copy = await claimAvailableCopyAtomically(candidate.id);
        }
        if (!copy) {
          failed.push({ bookId: item.bookId, libraryId: item.libraryId, error: "No copies available for reservation in this library" });
          continue;
        }

        const reservedFor = item.reservedFor ? new Date(item.reservedFor) : new Date();
        const days = await resolveLibraryReservationDays(item.libraryId);
        const expiresAt = new Date(reservedFor.getTime() + days * 24 * 60 * 60 * 1000);

        let r;
        try {
          r = await storage.createReservationRow({
            userId: targetUserId,
            bookId: item.bookId,
            libraryId: item.libraryId,
            bookCopyId: copy.id,
            reservedFor,
            expiresAt,
            notes: item.notes,
            createdBy: me.id,
          } as any);
        } catch (e) {
          // Roll back the copy claim if reservation insert fails.
          await db.update(bookCopies).set({ status: 'AVAILABLE' as any, updatedAt: new Date() })
            .where(and(eq(bookCopies.id, copy.id), eq(bookCopies.status, 'RESERVED' as any)));
          throw e;
        }

        await logAudit(req, {
          category: 'CIRCULATION',
          action: 'RESERVATION_CREATED',
          userId: me.id,
          userName: me.name,
          targetType: 'reservation',
          targetId: String(r.id),
          details: { bookId: item.bookId, libraryId: item.libraryId, copyId: copy.id, forUserId: targetUserId, expiresAt },
        });

        created.push({ ...r, copyBarcode: copy.barcode, copySSN: copy.internalSSN });
      }

      if (created.length === 0) {
        return res.status(409).json({ error: "No reservations could be created", failed });
      }
      res.status(201).json({ created, failed });
    } catch (err: any) {
      if (err?.issues) return res.status(400).json({ error: "Invalid input", details: err.issues });
      console.error("createReservation error", err);
      res.status(500).json({ error: err.message || "Failed to create reservation" });
    }
  });

  // List reservations with filters. Staff sees all (optionally filtered);
  // patrons only see their own.
  app.get("/api/reservations", async (req, res) => {
    try {
      const me = await requireUser(req, res); if (!me) return;
      await expireStaleReservationsInternal();

      const isStaff = me.role === 'ADMIN' || me.role === 'LIBRARIAN';
      const filters: any = {};
      if (!isStaff) {
        filters.userId = me.id;
      } else if (req.query.userId) {
        filters.userId = parseInt(String(req.query.userId));
      }
      if (req.query.libraryId) filters.libraryId = parseInt(String(req.query.libraryId));
      if (req.query.bookId) filters.bookId = parseInt(String(req.query.bookId));
      if (req.query.status) filters.status = String(req.query.status);
      if (req.query.fromDate) filters.fromDate = new Date(String(req.query.fromDate));
      if (req.query.toDate) filters.toDate = new Date(String(req.query.toDate));

      const rows = await storage.listReservations(filters);
      // Enrich with book / user / library / copy basics
      const enriched = await Promise.all(rows.map(async r => {
        const [book, user, library, copy] = await Promise.all([
          storage.getBook(r.bookId),
          storage.getUser(r.userId),
          storage.getLibrary(r.libraryId),
          r.bookCopyId ? storage.getBookCopy(r.bookCopyId) : Promise.resolve(undefined),
        ]);
        return {
          ...r,
          bookTitle: book?.title,
          bookAuthor: book?.author,
          userName: user?.name,
          userIdentifier: user?.studentId || user?.employeeId || user?.username,
          libraryName: library?.name,
          copyBarcode: copy?.barcode,
          copySSN: copy?.internalSSN,
        };
      }));
      res.json(enriched);
    } catch (err: any) {
      console.error("listReservations error", err);
      res.status(500).json({ error: "Failed to list reservations" });
    }
  });

  // Cancel a reservation. Staff or owner.
  app.delete("/api/reservations/:id", async (req, res) => {
    try {
      const me = await requireUser(req, res); if (!me) return;
      const id = parseInt(req.params.id);
      const r = await storage.getReservation(id);
      if (!r) return res.status(404).json({ error: "Reservation not found" });
      const isStaff = me.role === 'ADMIN' || me.role === 'LIBRARIAN';
      if (!isStaff && r.userId !== me.id) return res.status(403).json({ error: "Not allowed" });
      if (isStaff && !(await staffCanAccessLibrary(me as any, r.libraryId))) {
        return res.status(403).json({ error: "Not allowed for this library" });
      }
      if (r.status !== 'ACTIVE') return res.status(400).json({ error: `Cannot cancel a ${r.status} reservation` });

      const reason = req.body?.reason ? String(req.body.reason) : undefined;
      await storage.updateReservation(id, {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: me.id,
        cancelReason: reason,
      });
      if (r.bookCopyId) {
        const copy = await storage.getBookCopy(r.bookCopyId);
        if (copy && copy.status === 'RESERVED') {
          await storage.updateBookCopy(r.bookCopyId, { status: 'AVAILABLE' });
        }
      }
      await logAudit(req, {
        category: 'CIRCULATION', action: 'RESERVATION_CANCELLED',
        userId: me.id, userName: me.name,
        targetType: 'reservation', targetId: String(id),
        details: { reason, byStaff: isStaff },
      });
      res.json({ success: true });
    } catch (err: any) {
      console.error("cancelReservation error", err);
      res.status(500).json({ error: "Failed to cancel reservation" });
    }
  });

  // Reservations for a specific book — used in checkout flow when no copies are free.
  app.get("/api/books/:bookId/reservations", async (req, res) => {
    try {
      const staff = await requireStaff(req, res); if (!staff) return;
      const bookId = parseInt(req.params.bookId);
      const libraryId = req.query.libraryId ? parseInt(String(req.query.libraryId)) : undefined;
      await expireStaleReservationsInternal();
      const rows = await storage.getActiveReservationsForBook(bookId, libraryId);
      const enriched = await Promise.all(rows.map(async r => {
        const u = await storage.getUser(r.userId);
        const c = r.bookCopyId ? await storage.getBookCopy(r.bookCopyId) : undefined;
        return {
          ...r,
          userName: u?.name,
          userEmail: u?.email,
          userIdentifier: u?.studentId || u?.employeeId || u?.username,
          copyBarcode: c?.barcode,
          copySSN: c?.internalSSN,
        };
      }));
      res.json(enriched);
    } catch (err: any) {
      console.error("getBookReservations error", err);
      res.status(500).json({ error: "Failed to load reservations" });
    }
  });

  // ===== Pickup flow =====

  // Step 1: librarian enters book SSNs and re-confirms user identity.
  // System validates, generates an OTP, emails it to the patron.
  app.post("/api/reservations/pickup/initiate", async (req, res) => {
    try {
      const staff = await requireStaff(req, res); if (!staff) return;
      const body = initiatePickupSchema.parse(req.body);

      const rs: any[] = [];
      for (const id of body.reservationIds) {
        const r = await storage.getReservation(id);
        if (!r) return res.status(404).json({ error: `Reservation ${id} not found` });
        if (r.status !== 'ACTIVE') return res.status(400).json({ error: `Reservation ${id} is not ACTIVE (status: ${r.status})` });
        if (!(await staffCanAccessLibrary(staff as any, r.libraryId))) {
          return res.status(403).json({ error: `Not allowed: reservation ${id} is for a library you do not manage` });
        }
        rs.push(r);
      }
      const userIds = Array.from(new Set(rs.map(r => r.userId)));
      if (userIds.length > 1) return res.status(400).json({ error: "All reservations must belong to the same user" });
      const target = await storage.getUser(userIds[0]);
      if (!target) return res.status(404).json({ error: "Reservation owner not found" });

      // Identity re-confirmation
      const id = body.userIdentifier.trim();
      const matches = [target.studentId, target.employeeId, target.externalId, target.username]
        .filter(Boolean).map(v => String(v).trim().toLowerCase());
      if (!matches.includes(id.toLowerCase())) {
        await logAudit(req, {
          category: 'CIRCULATION', action: 'RESERVATION_PICKUP_IDENTITY_MISMATCH',
          userId: staff.id, userName: staff.name, status: 'FAILURE',
          targetType: 'user', targetId: String(target.id),
          details: { providedIdentifier: id, reservationIds: body.reservationIds },
        });
        return res.status(400).json({ error: "User identifier does not match the reservation owner" });
      }

      const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
      const expiresAt = new Date(Date.now() + PICKUP_OTP_TTL_MINUTES * 60 * 1000);
      const pickup = await storage.createReservationPickup({
        userId: target.id,
        otp,
        expiresAt,
        reservationIds: body.reservationIds,
        createdBy: staff.id,
      } as any);

      // Send email
      const bookSummaries = await Promise.all(rs.map(async r => {
        const b = await storage.getBook(r.bookId);
        const c = r.bookCopyId ? await storage.getBookCopy(r.bookCopyId) : undefined;
        return { title: b?.title || `Book #${r.bookId}`, ssn: c?.internalSSN ?? c?.barcode ?? null };
      }));
      try {
        await sendPickupOtpEmail(target.email, target.name, otp, bookSummaries);
      } catch (mailErr: any) {
        // Roll back pickup so caller can retry once SMTP is fixed.
        await storage.updateReservationPickup(pickup.id, { status: 'CANCELLED' });
        return res.status(500).json({ error: mailErr.message || "Failed to send OTP email" });
      }

      await logAudit(req, {
        category: 'CIRCULATION', action: 'RESERVATION_PICKUP_OTP_SENT',
        userId: staff.id, userName: staff.name,
        targetType: 'reservation_pickup', targetId: String(pickup.id),
        details: { reservationIds: body.reservationIds, patronUserId: target.id, maskedEmail: target.email.replace(/(.{2})(.*)(@.*)/, "$1***$3") },
      });

      const maskedEmail = target.email.replace(/(.{2})(.*)(@.*)/, "$1***$3");
      res.json({
        pickupId: pickup.id,
        expiresAt,
        maskedEmail,
        reservationCount: rs.length,
      });
    } catch (err: any) {
      if (err?.issues) return res.status(400).json({ error: "Invalid input", details: err.issues });
      console.error("initiatePickup error", err);
      res.status(500).json({ error: err.message || "Failed to initiate pickup" });
    }
  });

  // Step 2: librarian enters OTP from patron. System validates, creates
  // circulation rows, and marks reservations as fulfilled.
  app.post("/api/reservations/pickup/confirm", async (req, res) => {
    try {
      const staff = await requireStaff(req, res); if (!staff) return;
      const body = confirmPickupSchema.parse(req.body);
      const pickup = await storage.getReservationPickup(body.pickupId);
      if (!pickup) return res.status(404).json({ error: "Pickup session not found" });
      if (pickup.status !== 'PENDING') return res.status(400).json({ error: `Pickup is ${pickup.status}` });
      if (pickup.expiresAt.getTime() < Date.now()) {
        await storage.updateReservationPickup(pickup.id, { status: 'EXPIRED' });
        return res.status(400).json({ error: "OTP has expired. Please initiate again." });
      }
      if (pickup.otp !== body.otp.trim()) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      const ids = pickup.reservationIds as number[];

      // Authorization: confirm this staff is allowed to act on every reservation's library.
      // Admins and the original initiator pass; librarians must have active membership.
      for (const rid of ids) {
        const r = await storage.getReservation(rid);
        if (!r) continue;
        const isInitiator = pickup.createdBy === staff.id;
        if (!isInitiator && !(await staffCanAccessLibrary(staff as any, r.libraryId))) {
          return res.status(403).json({ error: `Not allowed: reservation ${rid} is for a library you do not manage` });
        }
      }

      const created: any[] = [];
      const errors: any[] = [];

      // Process each reservation independently. The conditional UPDATE on the
      // reservation row (ACTIVE -> still ACTIVE check via filter) provides
      // per-reservation idempotency; we only commit the pickup as CONFIRMED at
      // the end so partial failures leave it PENDING for retry.
      for (const rid of ids) {
        try {
          const r = await storage.getReservation(rid);
          if (!r) { errors.push({ rid, error: 'not found' }); continue; }
          if (r.status !== 'ACTIVE') { continue; /* already fulfilled or cancelled */ }

          const lib = await storage.getLibrary(r.libraryId);
          const globals = await loadGlobalCirculationDefaults();
          const loanDays = lib?.policies?.loanPeriodDays ?? globals.loanPeriodDays ?? 14;
          const dueDate = new Date(Date.now() + loanDays * 24 * 60 * 60 * 1000);

          // Create circulation first so a failure leaves reservation ACTIVE for retry.
          const circ = await storage.createCirculation({
            userId: r.userId,
            bookId: r.bookId,
            bookCopyId: r.bookCopyId ?? undefined,
            libraryId: r.libraryId,
            checkoutDate: new Date(),
            dueDate,
            status: 'ACTIVE',
          } as any);

          // Atomically claim the reservation (ACTIVE -> FULFILLED). If we lose
          // the race we roll back the circulation we just created.
          const claimedRes = await db
            .update(reservations)
            .set({ status: 'FULFILLED' as any, fulfilledAt: new Date(), fulfilledCirculationId: circ.id })
            .where(and(eq(reservations.id, rid), eq(reservations.status, 'ACTIVE' as any)))
            .returning();
          if (claimedRes.length === 0) {
            // Best-effort cleanup: mark the orphan circulation as RETURNED.
            try { await storage.updateCirculation(circ.id, { status: 'RETURNED', returnDate: new Date() } as any); } catch {}
            continue;
          }

          if (r.bookCopyId) {
            await storage.updateBookCopy(r.bookCopyId, { status: 'CHECKED_OUT' });
          }

          await logAudit(req, {
            category: 'CIRCULATION', action: 'RESERVATION_FULFILLED',
            userId: staff.id, userName: staff.name,
            targetType: 'reservation', targetId: String(rid),
            details: { circulationId: circ.id, pickupId: pickup.id, patronUserId: r.userId, libraryId: r.libraryId },
          });
          created.push(circ);
        } catch (e: any) {
          errors.push({ rid, error: e?.message || 'failed' });
        }
      }

      if (created.length === 0) {
        return res.status(500).json({ error: "No reservations could be fulfilled", errors });
      }

      // Only mark pickup CONFIRMED after at least one fulfillment succeeded.
      await db
        .update(reservationPickups)
        .set({ status: 'CONFIRMED' as any, confirmedAt: new Date() })
        .where(and(eq(reservationPickups.id, pickup.id), eq(reservationPickups.status, 'PENDING' as any)));

      await logAudit(req, {
        category: 'CIRCULATION', action: 'RESERVATION_PICKUP_CONFIRMED',
        userId: staff.id, userName: staff.name,
        targetType: 'reservation_pickup', targetId: String(pickup.id),
        details: { reservationIds: ids, circulationIds: created.map(c => c.id), patronUserId: pickup.userId },
      });

      res.json({ success: true, circulations: created });
    } catch (err: any) {
      if (err?.issues) return res.status(400).json({ error: "Invalid input", details: err.issues });
      console.error("confirmPickup error", err);
      res.status(500).json({ error: err.message || "Failed to confirm pickup" });
    }
  });
}
