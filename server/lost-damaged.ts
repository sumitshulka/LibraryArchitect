import type { Express, Request } from "express";
import { storage } from "./storage";
import { logAudit } from "./audit";
import { z } from "zod";

function getUser(req: Request) {
  return (req as any).user as { id: number; name: string; role: string } | undefined;
}

const createReportSchema = z.object({
  type: z.enum(["LOST", "DAMAGED"]),
  bookId: z.number().int().positive(),
  bookCopyId: z.number().int().positive().optional().nullable(),
  circulationId: z.number().int().positive().optional().nullable(),
  patronId: z.number().int().positive().optional().nullable(),
  libraryId: z.number().int().positive().optional().nullable(),
  reportDate: z.string().optional(),
  description: z.string().optional().nullable(),
  fineAmount: z.number().int().min(0).optional(),
  replacementRequired: z.boolean().optional(),
  replacementCost: z.number().int().min(0).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["REPORTED", "UNDER_REVIEW", "FINE_PENDING", "REPLACEMENT_PENDING", "RESOLVED", "CLOSED"]),
  notes: z.string().optional(),
});

const resolveSchema = z.object({
  resolution: z.enum(["FOUND", "REPAIRED", "REPLACED", "WRITTEN_OFF", "FINE_RECOVERED", "FINE_WAIVED"]),
  notes: z.string().optional(),
  fineAmountCollected: z.number().int().min(0).optional(),
  fineAmountWaived: z.number().int().min(0).optional(),
  updateCopyStatus: z.string().optional(),
});

export function registerLostDamagedRoutes(app: Express) {
  // Summary — must be registered before /:id to avoid route conflict
  app.get("/api/lost-damaged/summary", async (req, res) => {
    try {
      const [lost, damaged] = await Promise.all([
        storage.getLostDamagedReports({ type: "LOST", limit: 1000 }),
        storage.getLostDamagedReports({ type: "DAMAGED", limit: 1000 }),
      ]);
      const allReports = [...lost.reports, ...damaged.reports];

      res.json({
        totalLost: lost.total,
        totalDamaged: damaged.total,
        pending: allReports.filter(r => ["REPORTED", "UNDER_REVIEW", "FINE_PENDING", "REPLACEMENT_PENDING"].includes(r.status)).length,
        resolved: allReports.filter(r => r.status === "RESOLVED").length,
        writtenOff: allReports.filter(r => r.resolution === "WRITTEN_OFF").length,
        replacements: allReports.filter(r => r.resolution === "REPLACED").length,
        totalFinesAssessed: allReports.reduce((s, r) => s + (r.fineAmount ?? 0), 0),
        totalFinesCollected: allReports.reduce((s, r) => s + (r.finePaidAmount ?? 0), 0),
      });
    } catch (err) {
      console.error("Error fetching summary:", err);
      res.status(500).json({ error: "Failed to fetch summary" });
    }
  });

  // List reports
  app.get("/api/lost-damaged", async (req, res) => {
    try {
      const { type, status, libraryId, patronId, search, limit, offset } = req.query;
      const result = await storage.getLostDamagedReports({
        type: type as string | undefined,
        status: status as string | undefined,
        libraryId: libraryId ? parseInt(libraryId as string) : undefined,
        patronId: patronId ? parseInt(patronId as string) : undefined,
        search: search as string | undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      res.json(result);
    } catch (err) {
      console.error("Error fetching lost/damaged reports:", err);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  // Get single report with history
  app.get("/api/lost-damaged/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [report, history] = await Promise.all([
        storage.getLostDamagedReport(id),
        storage.getLostDamagedReportHistory(id),
      ]);
      if (!report) return res.status(404).json({ error: "Report not found" });
      res.json({ ...report, history });
    } catch (err) {
      console.error("Error fetching report:", err);
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  // Create report
  app.post("/api/lost-damaged", async (req, res) => {
    try {
      const user = getUser(req);
      const body = createReportSchema.parse(req.body);
      const report = await storage.createLostDamagedReport({
        ...body,
        reportDate: body.reportDate ? new Date(body.reportDate) : new Date(),
        status: "REPORTED",
        createdBy: user?.id ?? null,
        createdByName: user?.name ?? null,
      } as any);

      // Update book copy status if copy specified and type is LOST/DAMAGED
      if (body.bookCopyId) {
        const newCopyStatus = body.type === "LOST" ? "LOST" : "DAMAGED";
        await storage.updateBookCopy(body.bookCopyId, { status: newCopyStatus });
      }

      await storage.addLostDamagedReportHistory({
        reportId: report.id,
        action: "REPORT_CREATED",
        toStatus: "REPORTED",
        notes: `${body.type} report created`,
        performedBy: user?.id,
        performedByName: user?.name,
      });

      await logAudit(req, {
        category: "CIRCULATION",
        action: `LOST_DAMAGED_REPORT_CREATED`,
        targetType: "lost_damaged_report",
        targetId: String(report.id),
        details: { type: body.type, bookId: body.bookId, bookCopyId: body.bookCopyId },
      });

      res.status(201).json(report);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0]?.message });
      console.error("Error creating report:", err);
      res.status(500).json({ error: "Failed to create report" });
    }
  });

  // Update status
  app.patch("/api/lost-damaged/:id/status", async (req, res) => {
    try {
      const user = getUser(req);
      const id = parseInt(req.params.id);
      const existing = await storage.getLostDamagedReport(id);
      if (!existing) return res.status(404).json({ error: "Report not found" });

      const { status, notes } = updateStatusSchema.parse(req.body);
      const updated = await storage.updateLostDamagedReport(id, { status });

      await storage.addLostDamagedReportHistory({
        reportId: id,
        action: "STATUS_CHANGED",
        fromStatus: existing.status,
        toStatus: status,
        notes: notes || `Status changed to ${status}`,
        performedBy: user?.id,
        performedByName: user?.name,
      });

      await logAudit(req, {
        category: "CIRCULATION",
        action: "LOST_DAMAGED_STATUS_CHANGED",
        targetType: "lost_damaged_report",
        targetId: String(id),
        details: { from: existing.status, to: status },
      });

      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0]?.message });
      console.error("Error updating status:", err);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // Resolve report
  app.patch("/api/lost-damaged/:id/resolve", async (req, res) => {
    try {
      const user = getUser(req);
      const id = parseInt(req.params.id);
      const existing = await storage.getLostDamagedReport(id);
      if (!existing) return res.status(404).json({ error: "Report not found" });

      const { resolution, notes, fineAmountCollected, fineAmountWaived, updateCopyStatus } = resolveSchema.parse(req.body);

      const newStatus = "RESOLVED";
      const updateData: any = {
        resolution,
        resolvedAt: new Date(),
        resolvedBy: user?.id ?? null,
        resolvedNotes: notes ?? null,
        status: newStatus,
      };
      if (fineAmountCollected != null) updateData.finePaidAmount = (existing.finePaidAmount ?? 0) + fineAmountCollected;
      if (fineAmountWaived != null) updateData.fineWaivedAmount = (existing.fineWaivedAmount ?? 0) + fineAmountWaived;

      const updated = await storage.updateLostDamagedReport(id, updateData);

      // Update book copy status if specified
      if (updateCopyStatus && existing.bookCopyId) {
        const statusMap: Record<string, string> = {
          FOUND: "AVAILABLE",
          REPAIRED: "AVAILABLE",
          REPLACED: "AVAILABLE",
          WRITTEN_OFF: "LOST",
        };
        const copyStatus = statusMap[resolution] || updateCopyStatus;
        await storage.updateBookCopy(existing.bookCopyId, { status: copyStatus as any });
      }

      await storage.addLostDamagedReportHistory({
        reportId: id,
        action: "REPORT_RESOLVED",
        fromStatus: existing.status,
        toStatus: newStatus,
        notes: `Resolved as ${resolution}. ${notes ?? ""}`.trim(),
        performedBy: user?.id,
        performedByName: user?.name,
      });

      await logAudit(req, {
        category: "CIRCULATION",
        action: "LOST_DAMAGED_RESOLVED",
        targetType: "lost_damaged_report",
        targetId: String(id),
        details: { resolution, notes },
      });

      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0]?.message });
      console.error("Error resolving report:", err);
      res.status(500).json({ error: "Failed to resolve report" });
    }
  });

  // Update fine
  app.patch("/api/lost-damaged/:id/fine", async (req, res) => {
    try {
      const user = getUser(req);
      const id = parseInt(req.params.id);
      const existing = await storage.getLostDamagedReport(id);
      if (!existing) return res.status(404).json({ error: "Report not found" });

      const schema = z.object({
        fineAmount: z.number().int().min(0).optional(),
        collect: z.number().int().min(0).optional(),
        waive: z.number().int().min(0).optional(),
        notes: z.string().optional(),
      });
      const { fineAmount, collect, waive, notes } = schema.parse(req.body);
      const update: any = {};
      if (fineAmount != null) update.fineAmount = fineAmount;
      if (collect != null) update.finePaidAmount = (existing.finePaidAmount ?? 0) + collect;
      if (waive != null) update.fineWaivedAmount = (existing.fineWaivedAmount ?? 0) + waive;

      const updated = await storage.updateLostDamagedReport(id, update);

      await storage.addLostDamagedReportHistory({
        reportId: id,
        action: collect ? "FINE_COLLECTED" : waive ? "FINE_WAIVED" : "FINE_UPDATED",
        notes: notes || `Fine action: ${JSON.stringify({ fineAmount, collect, waive })}`,
        performedBy: user?.id,
        performedByName: user?.name,
      });

      await logAudit(req, {
        category: "FINES",
        action: collect ? "LOST_DAMAGED_FINE_COLLECTED" : waive ? "LOST_DAMAGED_FINE_WAIVED" : "LOST_DAMAGED_FINE_UPDATED",
        targetType: "lost_damaged_report",
        targetId: String(id),
        details: { fineAmount, collect, waive },
      });

      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0]?.message });
      console.error("Error updating fine:", err);
      res.status(500).json({ error: "Failed to update fine" });
    }
  });

}
