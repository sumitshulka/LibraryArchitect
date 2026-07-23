import type { Express } from "express";
import { z } from "zod";
import fs from "fs";
import multer from "multer";
import { storage } from "./storage";
import { logAudit } from "./audit";
import { insertDigitalResourceSchema, insertDigitalResourceVersionSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

const UPLOAD_DIR = "uploads/digital-resources";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "text/html",
];

const resourceUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = file.originalname.split(".").pop();
      cb(null, `resource-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type for a digital resource."));
    }
  },
});

async function getAuthedUser(req: any, res: any): Promise<any | null> {
  const cookieId = req.cookies && req.cookies.session_id;
  const auth = req.headers?.authorization || req.headers?.Authorization;
  const headerId = req.headers?.["x-session-id"];
  const sessionId = cookieId
    || (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : undefined)
    || (typeof headerId === "string" ? headerId.trim() : undefined);
  if (!sessionId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  const session = await storage.getSession(sessionId);
  if (!session) {
    res.status(401).json({ error: "Invalid session" });
    return null;
  }
  const user = await storage.getUser(session.userId);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return null;
  }
  return user;
}

function requireManageAccess(user: any): boolean {
  return user.role === "ADMIN" || user.role === "LIBRARIAN" || user.role === "FACULTY";
}

export function registerDigitalResourceRoutes(app: Express) {
  // Resource type settings (color coding + max size limits, admin configurable)
  app.get("/api/resource-type-settings", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;
      const settings = await storage.getAllResourceTypeSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching resource type settings:", error);
      res.status(500).json({ error: "Failed to fetch resource type settings" });
    }
  });

  app.put("/api/resource-type-settings/:type", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;
      if (user.role !== "ADMIN") {
        return res.status(403).json({ error: "Only admins can configure resource type settings" });
      }

      const resourceType = req.params.type;
      const schema = z.object({
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #3b82f6").optional(),
        maxSizeMb: z.coerce.number().int().min(1).max(5000).optional(),
        isActive: z.boolean().optional(),
      });
      const validated = schema.parse(req.body);

      const setting = await storage.upsertResourceTypeSetting(resourceType, validated);

      logAudit(req, {
        category: "DIGITAL_RESOURCES",
        action: "RESOURCE_TYPE_SETTING_UPDATED",
        targetType: "resource_type_setting",
        targetId: resourceType,
        details: validated,
      });

      res.json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating resource type setting:", error);
      res.status(500).json({ error: "Failed to update resource type setting" });
    }
  });

  // List / search digital resources (visibility-aware for non-staff)
  app.get("/api/digital-resources", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;

      const {
        search, department, course, semester, resourceType, category,
        faculty, uploadedBy, status, libraryId, tags, fromDate, toDate,
        limit, offset, attributeValueIds,
      } = req.query;

      const attrIds = attributeValueIds
        ? String(attributeValueIds).split(",").map(Number).filter((n) => !isNaN(n))
        : [];

      const filters = {
        search: typeof search === "string" ? search : undefined,
        department: typeof department === "string" ? department : undefined,
        course: typeof course === "string" ? course : undefined,
        semester: typeof semester === "string" ? semester : undefined,
        resourceType: typeof resourceType === "string" ? resourceType : undefined,
        category: typeof category === "string" ? category : undefined,
        faculty: typeof faculty === "string" ? faculty : undefined,
        uploadedBy: uploadedBy ? parseInt(String(uploadedBy)) : undefined,
        status: typeof status === "string" ? status : undefined,
        libraryId: libraryId ? parseInt(String(libraryId)) : undefined,
        tags: typeof tags === "string" ? tags.split(",").filter(Boolean) : undefined,
        fromDate: fromDate ? new Date(String(fromDate)) : undefined,
        toDate: toDate ? new Date(String(toDate)) : undefined,
        limit: limit ? parseInt(String(limit)) : 50,
        offset: offset ? parseInt(String(offset)) : 0,
      };

      const isStaff = user.role === "ADMIN" || user.role === "LIBRARIAN";
      let result = isStaff
        ? await storage.listDigitalResources(filters)
        : await storage.listVisibleDigitalResources(
            { id: user.id, role: user.role, department: user.department ?? null },
            filters
          );

      if (attrIds.length > 0) {
        const allowedIds = new Set(await storage.getDigitalResourceIdsByAttributeValueIds(attrIds));
        const resources = result.resources.filter((r) => allowedIds.has(r.id));
        result = { resources, total: resources.length };
      }

      res.json(result);
    } catch (error) {
      console.error("Error listing digital resources:", error);
      res.status(500).json({ error: "Failed to list digital resources" });
    }
  });

  app.get("/api/digital-resources/:id", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;

      const id = parseInt(req.params.id);
      const resource = await storage.getDigitalResource(id);
      if (!resource) return res.status(404).json({ error: "Digital resource not found" });

      const isStaff = user.role === "ADMIN" || user.role === "LIBRARIAN";
      if (!isStaff && !(await isResourceVisibleToUser(resource, user))) {
        return res.status(403).json({ error: "You do not have access to this resource" });
      }

      const versions = await storage.getDigitalResourceVersions(id);
      res.json({ ...resource, versions });
    } catch (error) {
      console.error("Error fetching digital resource:", error);
      res.status(500).json({ error: "Failed to fetch digital resource" });
    }
  });

  app.get("/api/digital-resources/:id/search-attributes", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;

      const id = parseInt(req.params.id);
      const resource = await storage.getDigitalResource(id);
      if (!resource) return res.status(404).json({ error: "Digital resource not found" });

      const isStaff = user.role === "ADMIN" || user.role === "LIBRARIAN";
      if (!isStaff && !(await isResourceVisibleToUser(resource, user))) {
        return res.status(403).json({ error: "You do not have access to this resource" });
      }

      const attrs = await storage.getDigitalResourceSearchAttributes(id);
      res.json(attrs);
    } catch (error) {
      console.error("Error fetching digital resource search attributes:", error);
      res.status(500).json({ error: "Failed to fetch digital resource search attributes" });
    }
  });

  app.put("/api/digital-resources/:id/search-attributes", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;
      if (!requireManageAccess(user)) {
        return res.status(403).json({ error: "You do not have permission to update digital resources" });
      }

      const id = parseInt(req.params.id);
      const resource = await storage.getDigitalResource(id);
      if (!resource) return res.status(404).json({ error: "Digital resource not found" });

      if (user.role === "FACULTY" && resource.uploadedBy !== user.id) {
        return res.status(403).json({ error: "You can only update resources you uploaded" });
      }

      const { attributeValueIds } = req.body;
      if (!Array.isArray(attributeValueIds)) {
        return res.status(400).json({ error: "attributeValueIds must be an array" });
      }

      await storage.setDigitalResourceSearchAttributes(id, attributeValueIds);
      const updated = await storage.getDigitalResourceSearchAttributes(id);

      logAudit(req, {
        category: "DIGITAL_RESOURCES",
        action: "SEARCH_ATTRS_UPDATED",
        targetType: "digital_resource",
        targetId: String(id),
        details: { title: resource.title, attributeCount: attributeValueIds.length },
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating digital resource search attributes:", error);
      res.status(500).json({ error: "Failed to update digital resource search attributes" });
    }
  });

  app.post("/api/digital-resources", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;
      if (!requireManageAccess(user)) {
        return res.status(403).json({ error: "You do not have permission to upload digital resources" });
      }

      const validated = insertDigitalResourceSchema.parse({
        ...req.body,
        uploadedBy: user.id,
      });

      if (!validated.fileUrl && !validated.externalUrl) {
        return res.status(400).json({ error: "Either a file or an external URL is required" });
      }

      if (validated.fileSizeBytes) {
        const typeSetting = await storage.getResourceTypeSetting(validated.resourceType);
        const maxSizeMb = typeSetting?.maxSizeMb ?? 200;
        if (validated.fileSizeBytes > maxSizeMb * 1024 * 1024) {
          return res.status(400).json({ error: `File exceeds the ${maxSizeMb}MB size limit configured for ${validated.resourceType} resources` });
        }
      }

      const resource = await storage.createDigitalResource(validated);

      await storage.createDigitalResourceVersion({
        resourceId: resource.id,
        versionNumber: resource.versionNumber || "1.0",
        fileUrl: resource.fileUrl,
        fileName: resource.fileName,
        fileSizeBytes: resource.fileSizeBytes,
        externalUrl: resource.externalUrl,
        releaseNotes: (req.body as any).releaseNotes || "Initial upload",
        isCurrent: true,
        uploadedBy: user.id,
      });

      logAudit(req, {
        category: "DIGITAL_RESOURCES",
        action: "RESOURCE_CREATED",
        targetType: "digital_resource",
        targetId: String(resource.id),
        details: { title: resource.title, resourceType: resource.resourceType, status: resource.status },
      });

      res.status(201).json(resource);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating digital resource:", error);
      res.status(500).json({ error: "Failed to create digital resource" });
    }
  });

  app.patch("/api/digital-resources/:id", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;
      if (!requireManageAccess(user)) {
        return res.status(403).json({ error: "You do not have permission to update digital resources" });
      }

      const id = parseInt(req.params.id);
      const existing = await storage.getDigitalResource(id);
      if (!existing) return res.status(404).json({ error: "Digital resource not found" });

      if (user.role === "FACULTY" && existing.uploadedBy !== user.id) {
        return res.status(403).json({ error: "You can only update resources you uploaded" });
      }

      const validated = insertDigitalResourceSchema.partial().parse(req.body);
      const resource = await storage.updateDigitalResource(id, validated);

      logAudit(req, {
        category: "DIGITAL_RESOURCES",
        action: "RESOURCE_UPDATED",
        targetType: "digital_resource",
        targetId: String(id),
        details: { changedFields: Object.keys(validated) },
      });

      res.json(resource);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating digital resource:", error);
      res.status(500).json({ error: "Failed to update digital resource" });
    }
  });

  app.post("/api/digital-resources/:id/publish", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;
      if (!requireManageAccess(user)) {
        return res.status(403).json({ error: "You do not have permission to publish digital resources" });
      }

      const id = parseInt(req.params.id);
      const existing = await storage.getDigitalResource(id);
      if (!existing) return res.status(404).json({ error: "Digital resource not found" });

      if (user.role === "FACULTY" && existing.uploadedBy !== user.id) {
        return res.status(403).json({ error: "You can only publish resources you uploaded" });
      }

      const { publish } = req.body as { publish?: boolean };
      const nextStatus = publish === false ? "DRAFT" : "PUBLISHED";
      const resource = await storage.updateDigitalResource(id, {
        status: nextStatus,
        publishDate: nextStatus === "PUBLISHED" ? (existing.publishDate || new Date()) : existing.publishDate,
      });

      logAudit(req, {
        category: "DIGITAL_RESOURCES",
        action: nextStatus === "PUBLISHED" ? "RESOURCE_PUBLISHED" : "RESOURCE_UNPUBLISHED",
        targetType: "digital_resource",
        targetId: String(id),
      });

      res.json(resource);
    } catch (error) {
      console.error("Error publishing digital resource:", error);
      res.status(500).json({ error: "Failed to publish digital resource" });
    }
  });

  app.delete("/api/digital-resources/:id", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;
      if (!requireManageAccess(user)) {
        return res.status(403).json({ error: "You do not have permission to delete digital resources" });
      }

      const id = parseInt(req.params.id);
      const existing = await storage.getDigitalResource(id);
      if (!existing) return res.status(404).json({ error: "Digital resource not found" });

      if (user.role === "FACULTY" && existing.uploadedBy !== user.id) {
        return res.status(403).json({ error: "You can only delete resources you uploaded" });
      }

      await storage.deleteDigitalResource(id);

      logAudit(req, {
        category: "DIGITAL_RESOURCES",
        action: "RESOURCE_DELETED",
        targetType: "digital_resource",
        targetId: String(id),
        details: { title: existing.title },
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting digital resource:", error);
      res.status(500).json({ error: "Failed to delete digital resource" });
    }
  });

  // File upload for a digital resource (creates/replaces the primary file)
  app.post("/api/digital-resources/upload", resourceUpload.single("file"), async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;
      if (!requireManageAccess(user)) {
        return res.status(403).json({ error: "You do not have permission to upload digital resources" });
      }
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const fileUrl = `/uploads/digital-resources/${req.file.filename}`;
      res.json({
        fileUrl,
        fileName: req.file.originalname,
        fileSizeBytes: req.file.size,
      });
    } catch (error: any) {
      console.error("Error uploading digital resource file:", error);
      res.status(500).json({ error: error.message || "Failed to upload file" });
    }
  });

  // Versions
  app.get("/api/digital-resources/:id/versions", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;

      const id = parseInt(req.params.id);
      const resource = await storage.getDigitalResource(id);
      if (!resource) return res.status(404).json({ error: "Digital resource not found" });

      const isStaff = user.role === "ADMIN" || user.role === "LIBRARIAN";
      if (!isStaff && !(await isResourceVisibleToUser(resource, user))) {
        return res.status(403).json({ error: "You do not have access to this resource" });
      }

      const versions = await storage.getDigitalResourceVersions(id);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching digital resource versions:", error);
      res.status(500).json({ error: "Failed to fetch versions" });
    }
  });

  app.post("/api/digital-resources/:id/versions", resourceUpload.single("file"), async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;
      if (!requireManageAccess(user)) {
        return res.status(403).json({ error: "You do not have permission to add versions" });
      }

      const id = parseInt(req.params.id);
      const resource = await storage.getDigitalResource(id);
      if (!resource) return res.status(404).json({ error: "Digital resource not found" });

      if (user.role === "FACULTY" && resource.uploadedBy !== user.id) {
        return res.status(403).json({ error: "You can only update resources you uploaded" });
      }

      const fileUrl = req.file ? `/uploads/digital-resources/${req.file.filename}` : req.body.externalUrl ? undefined : resource.fileUrl;
      const fileName = req.file ? req.file.originalname : resource.fileName;
      const fileSizeBytes = req.file ? req.file.size : resource.fileSizeBytes;

      const versionPayload = insertDigitalResourceVersionSchema.parse({
        resourceId: id,
        versionNumber: req.body.versionNumber || String(Number(resource.versionNumber || "1.0") + 0.1).slice(0, 4),
        fileUrl: req.file ? fileUrl : (req.body.externalUrl ? null : resource.fileUrl),
        fileName: req.file ? fileName : (req.body.externalUrl ? null : resource.fileName),
        fileSizeBytes: req.file ? fileSizeBytes : (req.body.externalUrl ? null : resource.fileSizeBytes),
        externalUrl: req.body.externalUrl || (req.file ? null : resource.externalUrl),
        releaseNotes: req.body.releaseNotes,
        reasonForUpdate: req.body.reasonForUpdate,
        changeSummary: req.body.changeSummary,
        isCurrent: true,
        uploadedBy: user.id,
      });

      const version = await storage.createDigitalResourceVersion(versionPayload);

      await storage.updateDigitalResource(id, {
        versionNumber: version.versionNumber,
        fileUrl: version.fileUrl ?? undefined,
        fileName: version.fileName ?? undefined,
        fileSizeBytes: version.fileSizeBytes ?? undefined,
        externalUrl: version.externalUrl ?? undefined,
      });

      logAudit(req, {
        category: "DIGITAL_RESOURCES",
        action: "RESOURCE_VERSION_ADDED",
        targetType: "digital_resource",
        targetId: String(id),
        details: { versionNumber: version.versionNumber },
      });

      res.status(201).json(version);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error adding digital resource version:", error);
      res.status(500).json({ error: "Failed to add version" });
    }
  });

  // Restore/rollback to a specific version
  app.put("/api/digital-resources/:id/restore-version/:versionId", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;
      if (!requireManageAccess(user)) {
        return res.status(403).json({ error: "You do not have permission to restore versions" });
      }
      const id = parseInt(req.params.id);
      const versionId = parseInt(req.params.versionId);
      const resource = await storage.getDigitalResource(id);
      if (!resource) return res.status(404).json({ error: "Digital resource not found" });
      if (user.role === "FACULTY" && resource.uploadedBy !== user.id) {
        return res.status(403).json({ error: "You can only restore versions of your own resources" });
      }
      const version = await storage.getDigitalResourceVersion(versionId);
      if (!version || version.resourceId !== id) {
        return res.status(404).json({ error: "Version not found for this resource" });
      }
      await storage.updateDigitalResource(id, {
        versionNumber: version.versionNumber,
        fileUrl: version.fileUrl ?? undefined,
        fileName: version.fileName ?? undefined,
        fileSizeBytes: version.fileSizeBytes ?? undefined,
        externalUrl: version.externalUrl ?? undefined,
      });
      logAudit(req, {
        category: "DIGITAL_RESOURCES",
        action: "RESOURCE_VERSION_RESTORED",
        targetType: "digital_resource",
        targetId: String(id),
        details: { versionId, versionNumber: version.versionNumber },
      });
      const updated = await storage.getDigitalResource(id);
      res.json(updated);
    } catch (error) {
      console.error("Error restoring digital resource version:", error);
      res.status(500).json({ error: "Failed to restore version" });
    }
  });

  // Track a download
  app.post("/api/digital-resources/:id/download", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;

      const id = parseInt(req.params.id);
      const resource = await storage.getDigitalResource(id);
      if (!resource) return res.status(404).json({ error: "Digital resource not found" });

      const isStaff = user.role === "ADMIN" || user.role === "LIBRARIAN";
      if (!isStaff && !(await isResourceVisibleToUser(resource, user))) {
        return res.status(403).json({ error: "You do not have access to this resource" });
      }
      if (!resource.allowDownload) {
        return res.status(403).json({ error: "Downloads are disabled for this resource" });
      }

      await storage.incrementDigitalResourceDownloadCount(id);

      logAudit(req, {
        category: "DIGITAL_RESOURCES",
        action: "RESOURCE_DOWNLOADED",
        targetType: "digital_resource",
        targetId: String(id),
      });

      res.json({ fileUrl: resource.fileUrl, externalUrl: resource.externalUrl });
    } catch (error) {
      console.error("Error recording digital resource download:", error);
      res.status(500).json({ error: "Failed to record download" });
    }
  });

  // Track a view
  app.post("/api/digital-resources/:id/view", async (req, res) => {
    try {
      const user = await getAuthedUser(req, res);
      if (!user) return;

      const id = parseInt(req.params.id);
      const resource = await storage.getDigitalResource(id);
      if (!resource) return res.status(404).json({ error: "Digital resource not found" });

      const isStaff = user.role === "ADMIN" || user.role === "LIBRARIAN";
      if (!isStaff && !(await isResourceVisibleToUser(resource, user))) {
        return res.status(403).json({ error: "You do not have access to this resource" });
      }

      await storage.incrementDigitalResourceViewCount(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error recording digital resource view:", error);
      res.status(500).json({ error: "Failed to record view" });
    }
  });
}

async function isResourceVisibleToUser(resource: any, user: any): Promise<boolean> {
  if (user.role === "ADMIN" || user.role === "LIBRARIAN") return true;
  // Resource creators (faculty who uploaded) can always see their own resources
  if (user.role === "FACULTY" && resource.uploadedBy === user.id) return true;
  if (resource.status !== "PUBLISHED") return false;
  if (resource.publishDate && new Date(resource.publishDate) > new Date()) return false;

  switch (resource.visibility) {
    case "INSTITUTION":
      return true;
    case "LIBRARY":
      return true;
    case "FACULTY_ONLY":
      return user.role === "FACULTY";
    case "STUDENTS_ONLY":
      return user.role === "STUDENT";
    case "DEPARTMENT":
      return !!user.department && user.department === resource.department;
    case "COURSE":
      // User must be in the same department as the resource (if department is set),
      // and the resource must actually have a course value.
      // Users without a matching department are denied access.
      if (!resource.course) return false;
      if (resource.department) return !!user.department && user.department === resource.department;
      // No department restriction on the resource — fall back to authenticated user of valid role
      return user.role === "STUDENT" || user.role === "FACULTY";
    case "BATCH":
      // Same logic as COURSE: verify department membership before granting access.
      if (!resource.batch) return false;
      if (resource.department) return !!user.department && user.department === resource.department;
      return user.role === "STUDENT" || user.role === "FACULTY";
    case "ROLE_BASED":
      return Array.isArray(resource.visibleToRoles) && resource.visibleToRoles.includes(user.role);
    case "SELECTED_USERS":
      return Array.isArray(resource.visibleToUserIds) && resource.visibleToUserIds.includes(user.id);
    default:
      return false;
  }
}
