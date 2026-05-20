import type { Express } from "express";
import { storage } from "./storage";
import { logAudit } from "./audit";
import {
  findHoldableCopy,
  claimAvailableCopyAtomically,
  resolveLibraryReservationDays,
  expireStaleReservationsInternal,
} from "./reservations";
import { calculateAccruedFine, computeAccruedFine, loadGlobalCirculationDefaults } from "./fines";

// Shared ERP auth: appId (query) + X-Secret-Key header.
async function authenticateErp(req: any, res: any) {
  const appId = (req.query.appId as string) || (req.body && req.body.appId);
  const secretKey = req.headers["x-secret-key"] as string;
  if (!appId) {
    res.status(400).json({ error: "appId is required (query or body)" });
    return null;
  }
  if (!secretKey) {
    res.status(401).json({ error: "X-Secret-Key header required" });
    return null;
  }
  const integration = await storage.getErpIntegrationByAppId(appId);
  if (!integration) {
    res.status(404).json({ error: "ERP integration not found" });
    return null;
  }
  if (!integration.isActive) {
    res.status(403).json({ error: "ERP integration is disabled" });
    return null;
  }
  const { verifySecretKey } = await import("./sso");
  if (!verifySecretKey(secretKey, integration.secretHash, integration.secretSalt)) {
    res.status(401).json({ error: "Invalid secret key" });
    return null;
  }
  return integration;
}

async function resolveBookByIdOrIsbn(idOrIsbn: string) {
  const asNum = Number(idOrIsbn);
  if (!isNaN(asNum) && /^\d+$/.test(idOrIsbn)) {
    return storage.getBook(asNum);
  }
  return storage.getBookByIsbn(idOrIsbn);
}

export function registerErpExtraRoutes(app: Express) {
  // -----------------------------------------------------------------
  // 1) Books Listing with Search Attributes
  //    GET /api/erp/books
  //    Returns one or more books filtered by free text and/or search
  //    attribute value IDs. Includes per-library availability.
  // -----------------------------------------------------------------
  app.get("/api/erp/books", async (req, res) => {
    try {
      const integration = await authenticateErp(req, res);
      if (!integration) return;

      const q = (req.query.q as string | undefined)?.trim();
      const isbn = (req.query.isbn as string | undefined)?.trim();
      const attributeValueIds = req.query.attributeValueIds
        ? String(req.query.attributeValueIds).split(",").map(Number).filter(n => !isNaN(n))
        : [];
      const limit = Math.min(parseInt(String(req.query.limit || "50")), 200);
      const offset = Math.max(parseInt(String(req.query.offset || "0")), 0);

      let books;
      if (attributeValueIds.length > 0 || q) {
        const result = await storage.searchCatalogByAttributes({
          attributeValueIds,
          searchQuery: q,
          limit: limit + offset,
        });
        if (result.limitExceeded) {
          return res.status(200).json({
            success: false,
            message: `Search returned ${result.totalCount} results which exceeds the maximum allowed. Refine the filter.`,
            totalCount: result.totalCount,
            books: [],
          });
        }
        books = result.books;
      } else if (isbn) {
        const b = await storage.getBookByIsbn(isbn);
        books = b ? [b] : [];
      } else {
        books = await storage.getAllBooks();
      }

      const totalCount = books.length;
      const page = books.slice(offset, offset + limit);

      const enriched = await Promise.all(page.map(async (b: any) => {
        const copies = await storage.getBookCopiesByBook(b.id);
        const byLibrary: Record<number, { available: number; reserved: number; checkedOut: number; total: number }> = {};
        for (const c of copies) {
          if (c.libraryId == null) continue;
          const k = c.libraryId;
          if (!byLibrary[k]) byLibrary[k] = { available: 0, reserved: 0, checkedOut: 0, total: 0 };
          byLibrary[k].total++;
          if (c.status === 'AVAILABLE') byLibrary[k].available++;
          else if (c.status === 'RESERVED') byLibrary[k].reserved++;
          else if (c.status === 'CHECKED_OUT') byLibrary[k].checkedOut++;
        }
        const libIds = Object.keys(byLibrary).map(Number);
        const libs = await Promise.all(libIds.map(id => storage.getLibrary(id)));
        return {
          bookId: b.id,
          isbn: b.isbn,
          title: b.title,
          author: b.author,
          publisher: b.publisher,
          publishedYear: b.publishedYear,
          category: b.category,
          format: b.format,
          coverUrl: b.coverUrl,
          totalCopies: copies.length,
          availableCopies: copies.filter((c: any) => c.status === 'AVAILABLE').length,
          libraries: libs.filter(Boolean).map((lib: any) => ({
            libraryId: lib.id,
            libraryCode: lib.code,
            libraryName: lib.name,
            ...byLibrary[lib.id],
          })),
        };
      }));

      res.json({
        success: true,
        totalCount,
        limit,
        offset,
        books: enriched,
      });
    } catch (err: any) {
      console.error("ERP /books error", err);
      res.status(500).json({ error: err.message || "Failed to list books" });
    }
  });

  // -----------------------------------------------------------------
  // 2) Book Reservation (third-party)
  //    POST /api/erp/reservations
  //    Body: { appId, externalId, bookId? | isbn?, libraryId?, reservedFor? }
  //    Creates a reservation on behalf of a patron known to the ERP via
  //    externalId. Library is optional — if omitted the system picks the
  //    first library that has an available copy.
  // -----------------------------------------------------------------
  app.post("/api/erp/reservations", async (req, res) => {
    try {
      const integration = await authenticateErp(req, res);
      if (!integration) return;

      const { externalId, bookId, isbn, libraryId, reservedFor, notes } = req.body || {};
      if (!externalId) return res.status(400).json({ error: "externalId is required" });
      if (!bookId && !isbn) return res.status(400).json({ error: "bookId or isbn is required" });

      const user = await storage.getUserByExternalId(String(externalId), integration.id);
      if (!user) return res.status(404).json({ error: "Patron not found for this ERP" });
      if (user.status !== 'ACTIVE') return res.status(403).json({ error: `Patron is ${user.status}` });

      const book = bookId ? await storage.getBook(Number(bookId)) : await storage.getBookByIsbn(String(isbn));
      if (!book) return res.status(404).json({ error: "Book not found" });

      await expireStaleReservationsInternal();

      // Resolve target library: explicit, or first library with an available copy.
      let targetLibraryId: number | undefined = libraryId ? Number(libraryId) : undefined;
      let claimedCopy: any | undefined;

      if (targetLibraryId) {
        const candidate = await findHoldableCopy(book.id, targetLibraryId);
        if (candidate) claimedCopy = await claimAvailableCopyAtomically(candidate.id);
      } else {
        const allCopies = await storage.getBookCopiesByBook(book.id);
        const tried = new Set<number>();
        for (const c of allCopies) {
          if (c.libraryId == null) continue;
          if (c.status !== 'AVAILABLE' || tried.has(c.libraryId)) continue;
          tried.add(c.libraryId);
          const claimed = await claimAvailableCopyAtomically(c.id);
          if (claimed) {
            claimedCopy = claimed;
            targetLibraryId = c.libraryId;
            break;
          }
        }
      }

      if (!claimedCopy || !targetLibraryId) {
        return res.status(409).json({ error: "No copies available for reservation" });
      }

      const reservedForDate = reservedFor ? new Date(reservedFor) : new Date();
      if (isNaN(reservedForDate.getTime())) {
        await storage.updateBookCopy(claimedCopy.id, { status: 'AVAILABLE' });
        return res.status(400).json({ error: "Invalid reservedFor date" });
      }
      const days = await resolveLibraryReservationDays(targetLibraryId);
      const expiresAt = new Date(reservedForDate.getTime() + days * 24 * 60 * 60 * 1000);

      let reservation;
      try {
        reservation = await storage.createReservationRow({
          userId: user.id,
          bookId: book.id,
          libraryId: targetLibraryId,
          bookCopyId: claimedCopy.id,
          reservedFor: reservedForDate,
          expiresAt,
          notes: notes || null,
          createdBy: user.id,
        } as any);
      } catch (e) {
        // Rollback the copy claim
        await storage.updateBookCopy(claimedCopy.id, { status: 'AVAILABLE' });
        throw e;
      }

      const library = await storage.getLibrary(targetLibraryId);
      logAudit(req, {
        category: 'CIRCULATION',
        action: 'RESERVATION_CREATED',
        userId: user.id, userName: user.name,
        targetType: 'reservation', targetId: String(reservation.id),
        details: { source: 'ERP', appId: integration.appId, bookId: book.id, libraryId: targetLibraryId, copyId: claimedCopy.id, expiresAt },
      });

      res.status(201).json({
        success: true,
        reservation: {
          reservationId: reservation.id,
          status: reservation.status,
          patron: { externalId: user.externalId, name: user.name, email: user.email },
          book: { bookId: book.id, isbn: book.isbn, title: book.title, author: book.author },
          library: library ? { libraryId: library.id, code: library.code, name: library.name } : null,
          copy: { bookCopyId: claimedCopy.id, barcode: claimedCopy.barcode },
          reservedFor: reservation.reservedFor,
          expiresAt: reservation.expiresAt,
        },
      });
    } catch (err: any) {
      console.error("ERP /reservations error", err);
      res.status(500).json({ error: err.message || "Failed to create reservation" });
    }
  });

  // -----------------------------------------------------------------
  // 3) Book Status Update API
  //    GET /api/erp/books/:idOrIsbn/status?externalId=...
  //    Returns the current status of a book — system-wide availability
  //    plus, if externalId is provided, the patron's relationship
  //    (reserved by them, checked out by them, returned, etc.).
  // -----------------------------------------------------------------
  app.get("/api/erp/books/:idOrIsbn/status", async (req, res) => {
    try {
      const integration = await authenticateErp(req, res);
      if (!integration) return;

      const book = await resolveBookByIdOrIsbn(req.params.idOrIsbn);
      if (!book) return res.status(404).json({ error: "Book not found" });

      const externalId = req.query.externalId as string | undefined;
      const copies = await storage.getBookCopiesByBook(book.id);

      const summary = {
        total: copies.length,
        available: copies.filter((c: any) => c.status === 'AVAILABLE').length,
        reserved: copies.filter((c: any) => c.status === 'RESERVED').length,
        checkedOut: copies.filter((c: any) => c.status === 'CHECKED_OUT').length,
        lost: copies.filter((c: any) => c.status === 'LOST').length,
        maintenance: copies.filter((c: any) => c.status === 'MAINTENANCE').length,
      };

      let patronStatus: any = null;
      if (externalId) {
        const user = await storage.getUserByExternalId(externalId, integration.id);
        if (!user) {
          patronStatus = { externalId, found: false };
        } else {
          await expireStaleReservationsInternal();
          const userCirc = await storage.getCirculationByUser(user.id);
          const userResv = await storage.listReservations({ userId: user.id, bookId: book.id });

          const activeResv = userResv.find((r: any) => r.status === 'ACTIVE');
          const activeCirc = userCirc.find((c: any) => c.bookId === book.id && c.status === 'ACTIVE');
          const lastReturned = userCirc
            .filter((c: any) => c.bookId === book.id && c.status === 'RETURNED')
            .sort((a: any, b: any) => new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime())[0];

          let status: string;
          if (activeCirc) status = 'CHECKED_OUT';
          else if (activeResv) status = 'RESERVED';
          else if (lastReturned) status = 'RETURNED';
          else status = 'NONE';

          patronStatus = {
            externalId,
            found: true,
            patron: { name: user.name, email: user.email, role: user.role },
            status,
            reservation: activeResv ? {
              reservationId: activeResv.id,
              libraryId: activeResv.libraryId,
              reservedFor: activeResv.reservedFor,
              expiresAt: activeResv.expiresAt,
            } : null,
            checkout: activeCirc ? {
              circulationId: activeCirc.id,
              libraryId: activeCirc.libraryId,
              checkoutDate: activeCirc.checkoutDate,
              dueDate: activeCirc.dueDate,
              renewalCount: activeCirc.renewalCount,
            } : null,
            lastReturned: lastReturned ? {
              circulationId: lastReturned.id,
              returnDate: lastReturned.returnDate,
              libraryId: lastReturned.libraryId,
            } : null,
          };
        }
      }

      res.json({
        success: true,
        book: {
          bookId: book.id,
          isbn: book.isbn,
          title: book.title,
          author: book.author,
        },
        copies: summary,
        patronStatus,
      });
    } catch (err: any) {
      console.error("ERP /books/:idOrIsbn/status error", err);
      res.status(500).json({ error: err.message || "Failed to fetch book status" });
    }
  });

  // -----------------------------------------------------------------
  // 4) Fine Information
  //    GET /api/erp/users/:externalId/fines  → per-user breakdown
  //    GET /api/erp/fines/summary            → org-wide aggregates
  // -----------------------------------------------------------------
  app.get("/api/erp/users/:externalId/fines", async (req, res) => {
    try {
      const integration = await authenticateErp(req, res);
      if (!integration) return;

      const user = await storage.getUserByExternalId(req.params.externalId, integration.id);
      if (!user) return res.status(404).json({ error: "Patron not found for this ERP" });

      const circ = await storage.getCirculationByUser(user.id);
      const globals = await loadGlobalCirculationDefaults();
      const libCache = new Map<number, any>();

      let totalAssessedCents = 0;
      let totalPaidCents = 0;
      let totalWaivedCents = 0;
      let totalAccruedCents = 0;
      let totalOutstandingCents = 0;

      const items = await Promise.all(circ.map(async c => {
        let lib: any = c.libraryId ? libCache.get(c.libraryId) : null;
        if (!lib && c.libraryId) {
          lib = await storage.getLibrary(c.libraryId);
          libCache.set(c.libraryId, lib);
        }
        const accrued = await computeAccruedFine(c);
        const fineCents = Math.round(Number(c.fineAmount || 0) * 100);
        const paidCents = Math.round(Number(c.finePaidAmount || 0) * 100);
        const waivedCents = Math.round(Number(c.fineWaivedAmount || 0) * 100);
        const damagePaid = Math.round(Number(c.damagePaidAmount || 0) * 100);
        const damageWaived = Math.round(Number(c.damageWaivedAmount || 0) * 100);
        const damageCost = Math.round(Number(c.damageCost || 0) * 100);

        const assessed = c.status === 'RETURNED' ? fineCents : accrued.fineCents;
        const outstandingFine = Math.max(0, assessed - paidCents - waivedCents);
        const outstandingDamage = Math.max(0, damageCost - damagePaid - damageWaived);

        totalAssessedCents += assessed;
        totalPaidCents += paidCents + damagePaid;
        totalWaivedCents += waivedCents + damageWaived;
        if (c.status !== 'RETURNED') totalAccruedCents += accrued.fineCents;
        totalOutstandingCents += outstandingFine + outstandingDamage;

        const book = await storage.getBook(c.bookId);
        return {
          circulationId: c.id,
          status: c.status,
          isOverdue: accrued.isOverdue,
          daysOverdue: accrued.daysOverdue,
          book: book ? { bookId: book.id, isbn: book.isbn, title: book.title } : null,
          checkoutDate: c.checkoutDate,
          dueDate: c.dueDate,
          returnDate: c.returnDate,
          fine: {
            assessed: assessed / 100,
            paid: paidCents / 100,
            waived: waivedCents / 100,
            outstanding: outstandingFine / 100,
            accruedIfOpen: accrued.fineCents / 100,
          },
          damage: {
            cost: damageCost / 100,
            paid: damagePaid / 100,
            waived: damageWaived / 100,
            outstanding: outstandingDamage / 100,
          },
        };
      }));

      res.json({
        success: true,
        patron: {
          externalId: user.externalId,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        totals: {
          assessed: totalAssessedCents / 100,
          paid: totalPaidCents / 100,
          waived: totalWaivedCents / 100,
          outstanding: totalOutstandingCents / 100,
          accruedOnOpenLoans: totalAccruedCents / 100,
        },
        items,
      });
    } catch (err: any) {
      console.error("ERP /users/:externalId/fines error", err);
      res.status(500).json({ error: err.message || "Failed to fetch user fines" });
    }
  });

  app.get("/api/erp/fines/summary", async (req, res) => {
    try {
      const integration = await authenticateErp(req, res);
      if (!integration) return;

      // Scope to circulations of patrons provisioned via THIS ERP integration
      // so one ERP cannot read aggregates that include another ERP's data.
      const erpUsers = await storage.getUsersByErpIntegration(integration.id);
      const erpUserIds = new Set(erpUsers.map(u => u.id));
      const allCircRaw = await storage.getAllCirculation();
      const allCirc = allCircRaw.filter((c: any) => erpUserIds.has(c.userId));
      const globals = await loadGlobalCirculationDefaults();
      const libCache = new Map<number, any>();

      let assessed = 0, paid = 0, waived = 0, accrued = 0, outstanding = 0;
      let openLoans = 0, overdueLoans = 0;
      const byLibrary: Record<number, any> = {};

      for (const c of allCirc) {
        let lib: any = c.libraryId ? libCache.get(c.libraryId) : null;
        if (!lib && c.libraryId) {
          lib = await storage.getLibrary(c.libraryId);
          libCache.set(c.libraryId, lib);
        }
        const calc = await computeAccruedFine(c);
        const fineCents = Math.round(Number(c.fineAmount || 0) * 100);
        const paidCents = Math.round(Number(c.finePaidAmount || 0) * 100);
        const waivedCents = Math.round(Number(c.fineWaivedAmount || 0) * 100);
        const damageCost = Math.round(Number(c.damageCost || 0) * 100);
        const damagePaid = Math.round(Number(c.damagePaidAmount || 0) * 100);
        const damageWaived = Math.round(Number(c.damageWaivedAmount || 0) * 100);

        const a = c.status === 'RETURNED' ? fineCents : calc.fineCents;
        const o = Math.max(0, a - paidCents - waivedCents) + Math.max(0, damageCost - damagePaid - damageWaived);

        assessed += a;
        paid += paidCents + damagePaid;
        waived += waivedCents + damageWaived;
        outstanding += o;
        if (c.status !== 'RETURNED') {
          accrued += calc.fineCents;
          openLoans++;
          if (calc.isOverdue) overdueLoans++;
        }

        const lid = c.libraryId || 0;
        if (!byLibrary[lid]) byLibrary[lid] = { libraryId: lid, libraryName: lib?.name || 'Unassigned', assessed: 0, paid: 0, waived: 0, outstanding: 0 };
        byLibrary[lid].assessed += a;
        byLibrary[lid].paid += paidCents + damagePaid;
        byLibrary[lid].waived += waivedCents + damageWaived;
        byLibrary[lid].outstanding += o;
      }

      const libraries = Object.values(byLibrary).map((l: any) => ({
        ...l,
        assessed: l.assessed / 100,
        paid: l.paid / 100,
        waived: l.waived / 100,
        outstanding: l.outstanding / 100,
      }));

      res.json({
        success: true,
        totals: {
          assessed: assessed / 100,
          paid: paid / 100,
          waived: waived / 100,
          outstanding: outstanding / 100,
          accruedOnOpenLoans: accrued / 100,
        },
        loans: { open: openLoans, overdue: overdueLoans, total: allCirc.length },
        byLibrary: libraries,
      });
    } catch (err: any) {
      console.error("ERP /fines/summary error", err);
      res.status(500).json({ error: err.message || "Failed to fetch fines summary" });
    }
  });

  // -----------------------------------------------------------------
  // 5) Fine Payment Push
  //    POST /api/erp/fine-payments
  //    Body: { appId, externalId, paymentMethodCode, referenceNumber?,
  //            notes?, payments: [{ circulationId, fineAmount?, damageAmount? }] }
  //    Amounts in major currency units (e.g. 25.50 for ₹25.50).
  // -----------------------------------------------------------------
  app.post("/api/erp/fine-payments", async (req, res) => {
    try {
      const integration = await authenticateErp(req, res);
      if (!integration) return;

      const { externalId, paymentMethodCode, referenceNumber, notes, payments } = req.body || {};
      if (!externalId) return res.status(400).json({ error: "externalId is required" });
      if (!paymentMethodCode) return res.status(400).json({ error: "paymentMethodCode is required" });
      if (!Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ error: "payments array is required and must not be empty" });
      }

      const user = await storage.getUserByExternalId(String(externalId), integration.id);
      if (!user) return res.status(404).json({ error: "Patron not found for this ERP" });

      const allPaymentMethods = await storage.getAllPaymentMethods();
      const pm = allPaymentMethods.find(
        (m: any) => m.code?.toLowerCase() === String(paymentMethodCode).toLowerCase() && m.isActive
      );
      if (!pm) return res.status(400).json({ error: `Payment method '${paymentMethodCode}' not found or inactive` });

      const results: any[] = [];
      let totalAppliedCents = 0;

      for (const item of payments) {
        const { circulationId, fineAmount, damageAmount } = item;
        if (!circulationId) return res.status(400).json({ error: "Each payment item must include circulationId" });

        const circ = await storage.getCirculation(Number(circulationId));
        if (!circ) return res.status(404).json({ error: `Circulation ${circulationId} not found` });
        if (circ.userId !== user.id) {
          return res.status(403).json({ error: `Circulation ${circulationId} does not belong to this patron` });
        }

        const fineOutstanding = Math.max(0, (circ.fineAmount ?? 0) - (circ.finePaidAmount ?? 0) - (circ.fineWaivedAmount ?? 0));
        const dmgOutstanding = Math.max(0, (circ.damageCost ?? 0) - (circ.damagePaidAmount ?? 0) - (circ.damageWaivedAmount ?? 0));

        const finePayCents = fineAmount != null ? Math.round(Number(fineAmount) * 100) : 0;
        const dmgPayCents = damageAmount != null ? Math.round(Number(damageAmount) * 100) : 0;

        if (finePayCents < 0 || dmgPayCents < 0) {
          return res.status(400).json({ error: `Payment amounts must be non-negative (circulation ${circulationId})` });
        }
        if (finePayCents > fineOutstanding) {
          return res.status(400).json({ error: `Fine payment (${finePayCents}) exceeds outstanding (${fineOutstanding}) for circulation ${circulationId}` });
        }
        if (dmgPayCents > dmgOutstanding) {
          return res.status(400).json({ error: `Damage payment (${dmgPayCents}) exceeds outstanding (${dmgOutstanding}) for circulation ${circulationId}` });
        }
        if (finePayCents === 0 && dmgPayCents === 0) {
          return res.status(400).json({ error: `No payment amount specified for circulation ${circulationId}` });
        }

        if (finePayCents > 0) {
          await storage.createFinePayment({
            circulationId: circ.id,
            paymentType: 'FINE',
            amount: finePayCents,
            paymentMethodId: pm.id,
            collectedBy: user.id,
            referenceNumber: referenceNumber || null,
            notes: notes || null,
          } as any);
        }
        if (dmgPayCents > 0) {
          await storage.createFinePayment({
            circulationId: circ.id,
            paymentType: 'DAMAGE',
            amount: dmgPayCents,
            paymentMethodId: pm.id,
            collectedBy: user.id,
            referenceNumber: referenceNumber || null,
            notes: notes || null,
          } as any);
        }

        const newFinePaid = (circ.finePaidAmount ?? 0) + finePayCents;
        const newFineWaived = circ.fineWaivedAmount ?? 0;
        const newDmgPaid = (circ.damagePaidAmount ?? 0) + dmgPayCents;
        const newDmgWaived = circ.damageWaivedAmount ?? 0;
        const totalFine = circ.fineAmount ?? 0;
        const totalDmg = circ.damageCost ?? 0;

        const newFineRemaining = totalFine - newFinePaid - newFineWaived;
        let fineStatus: string = circ.fineStatus ?? 'OUTSTANDING';
        if (totalFine === 0) fineStatus = 'PAID';
        else if (newFineRemaining <= 0) fineStatus = newFinePaid === 0 ? 'WAIVED' : 'PAID';
        else if (newFinePaid > 0 || newFineWaived > 0) fineStatus = 'PARTIALLY_PAID';

        const newDmgRemaining = totalDmg - newDmgPaid - newDmgWaived;
        let damageStatus: string = circ.damageStatus ?? 'NONE';
        if (totalDmg > 0) {
          if (newDmgRemaining <= 0) damageStatus = newDmgPaid === 0 ? 'WAIVED' : 'PAID';
          else if (newDmgPaid > 0 || newDmgWaived > 0) damageStatus = 'PARTIALLY_PAID';
          else damageStatus = 'OUTSTANDING';
        }

        await storage.updateCirculation(circ.id, {
          finePaidAmount: newFinePaid,
          fineStatus: fineStatus as any,
          damagePaidAmount: newDmgPaid,
          damageStatus: damageStatus as any,
        } as any);

        totalAppliedCents += finePayCents + dmgPayCents;
        results.push({
          circulationId: circ.id,
          fineApplied: finePayCents / 100,
          damageApplied: dmgPayCents / 100,
          newFineOutstanding: Math.max(0, newFineRemaining) / 100,
          newDamageOutstanding: Math.max(0, newDmgRemaining) / 100,
          newFineStatus: fineStatus,
          newDamageStatus: damageStatus,
        });
      }

      logAudit(req, {
        category: 'FINES',
        action: 'PAYMENT_COLLECTED',
        userId: user.id, userName: user.name,
        targetType: 'user', targetId: String(user.id),
        details: { source: 'ERP', appId: integration.appId, externalId, paymentMethodCode, referenceNumber, totalAppliedCents, items: results.length },
      });

      res.status(200).json({
        success: true,
        patron: { externalId: user.externalId, name: user.name, email: user.email },
        paymentMethod: { code: pm.code, name: pm.name },
        totalApplied: totalAppliedCents / 100,
        items: results,
      });
    } catch (err: any) {
      console.error("ERP /fine-payments error", err);
      res.status(500).json({ error: err.message || "Failed to process fine payments" });
    }
  });
}
