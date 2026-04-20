import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertBookSchema, 
  insertUserSchema, 
  insertCirculationSchema,
  insertInventorySchema,
  insertSystemConfigSchema,
  insertResourceTypeSchema,
  insertCategorySchema,
  insertErpIntegrationSchema,
  insertErpWhitelistSchema,
  insertOrgUnitSchema,
  insertLibrarySchema,
  insertBookCopySchema,
  insertBookTransferSchema,
  insertLibraryMembershipSchema,
  insertAuditSessionSchema,
  insertInventoryItemSchema,
  insertSearchAttributeTypeSchema,
  insertSearchAttributeValueSchema,
  insertPaymentMethodSchema,
} from "@shared/schema";
import { calculateAccruedFine, getCirculationFineSummary } from "./fines";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import crypto from "crypto";
import nodemailer from "nodemailer";
import * as XLSX from "xlsx";
import { passwordResetOtps } from "@shared/schema";
import { db } from "./db";
import { eq, and, gt } from "drizzle-orm";
import multer from "multer";
import { setupSwagger } from "./swagger";
import { logAudit, invalidateAuditConfigCache } from "./audit";

const MAX_WHITELIST_ENTRIES = 5;

async function requireStaff(req: any, res: any): Promise<any | null> {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) { res.status(401).json({ error: "Authentication required" }); return null; }
  const session = await storage.getSession(sessionId);
  if (!session) { res.status(401).json({ error: "Invalid session" }); return null; }
  const user = await storage.getUser(session.userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return null; }
  if (user.role !== 'ADMIN' && user.role !== 'LIBRARIAN') {
    res.status(403).json({ error: "Staff access required" });
    return null;
  }
  return user;
}

async function requireLocalAdmin(req: any, res: any): Promise<any | null> {
  const sessionId = req.cookies?.session_id;
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
  if (!user || user.role !== 'ADMIN') {
    res.status(403).json({ error: "Only administrators can access this resource" });
    return null;
  }
  if (user.erpIntegrationId) {
    res.status(403).json({ error: "Only local administrators can access this resource" });
    return null;
  }
  return user;
}

function generateAppId(): string {
  return `LIB-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
}

function generateSecretKey(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function hashSecret(secret: string, salt: string): string {
  return crypto.pbkdf2Sync(secret, salt, 100000, 64, 'sha512').toString('hex');
}

function verifySecret(secret: string, hash: string, salt: string): boolean {
  const testHash = hashSecret(secret, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(testHash));
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup Swagger API documentation
  setupSwagger(app);
  
  // ===== Books API =====
  app.get("/api/books", async (req, res) => {
    try {
      const { search } = req.query;
      
      if (search && typeof search === 'string') {
        const books = await storage.searchBooks(search);
        return res.json(books);
      }
      
      const books = await storage.getAllBooks();
      res.json(books);
    } catch (error) {
      console.error("Error fetching books:", error);
      res.status(500).json({ error: "Failed to fetch books" });
    }
  });

  app.get("/api/books/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const book = await storage.getBook(id);
      
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      res.json(book);
    } catch (error) {
      console.error("Error fetching book:", error);
      res.status(500).json({ error: "Failed to fetch book" });
    }
  });

  // Book Dashboard - Get book details with library allocations and recent circulation
  app.get("/api/books/:id/dashboard", async (req, res) => {
    try {
      const bookId = parseInt(req.params.id);
      const book = await storage.getBook(bookId);
      
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Get all copies for this book
      const copies = await storage.getBookCopiesByBook(bookId);
      
      // Get all libraries to map names
      const libraries = await storage.getAllLibraries();
      const libraryMap = new Map(libraries.map(lib => [lib.id, lib]));
      
      // Group copies by library with stats
      const libraryAllocations: Record<number, {
        libraryId: number;
        libraryName: string;
        libraryCode: string;
        total: number;
        available: number;
        checkedOut: number;
        reserved: number;
        damaged: number;
        lost: number;
        inTransit: number;
      }> = {};
      
      // Get active circulations for this book to cross-reference copy statuses
      const activeCirculations = await storage.getActiveCirculationByBookAll(bookId);
      // Build a set of copy IDs that are actively checked out via circulation records
      const activeCopyIds = new Set(activeCirculations.filter(c => c.bookCopyId).map(c => c.bookCopyId!));
      // Count circulations without a specific copy (legacy records)
      const circulationsWithoutCopy = activeCirculations.filter(c => !c.bookCopyId).length;

      for (const copy of copies) {
        const libId = copy.libraryId || 0;
        if (!libraryAllocations[libId]) {
          const lib = libId ? libraryMap.get(libId) : null;
          libraryAllocations[libId] = {
            libraryId: libId,
            libraryName: lib?.name || (libId === 0 ? "Unallocated" : "Unknown"),
            libraryCode: lib?.code || (libId === 0 ? "N/A" : "???"),
            total: 0,
            available: 0,
            checkedOut: 0,
            reserved: 0,
            damaged: 0,
            lost: 0,
            inTransit: 0,
          };
        }
        
        libraryAllocations[libId].total++;

        // If copy is marked AVAILABLE but has an active circulation, count as checked out
        const effectiveStatus = (copy.status === "AVAILABLE" && activeCopyIds.has(copy.id))
          ? "CHECKED_OUT"
          : copy.status;

        switch (effectiveStatus) {
          case "AVAILABLE": libraryAllocations[libId].available++; break;
          case "CHECKED_OUT": libraryAllocations[libId].checkedOut++; break;
          case "RESERVED": libraryAllocations[libId].reserved++; break;
          case "DAMAGED": libraryAllocations[libId].damaged++; break;
          case "LOST": libraryAllocations[libId].lost++; break;
          case "IN_TRANSIT": libraryAllocations[libId].inTransit++; break;
        }
      }

      // For circulations without a specific copy, adjust the unallocated bucket
      // These are legacy records where no copy was selected — reduce available, increase checkedOut
      if (circulationsWithoutCopy > 0) {
        const unallocId = 0;
        if (!libraryAllocations[unallocId]) {
          libraryAllocations[unallocId] = {
            libraryId: 0,
            libraryName: "Unallocated",
            libraryCode: "N/A",
            total: 0,
            available: 0,
            checkedOut: 0,
            reserved: 0,
            damaged: 0,
            lost: 0,
            inTransit: 0,
          };
        }
        // Move copies from available to checkedOut for legacy circulations
        const adjust = Math.min(circulationsWithoutCopy, libraryAllocations[unallocId].available);
        libraryAllocations[unallocId].available -= adjust;
        libraryAllocations[unallocId].checkedOut += adjust;
        // If not enough unallocated copies, check the circulation's library
        const remaining = circulationsWithoutCopy - adjust;
        if (remaining > 0) {
          for (const circ of activeCirculations.filter(c => !c.bookCopyId)) {
            const circLibId = circ.libraryId || 0;
            if (libraryAllocations[circLibId] && libraryAllocations[circLibId].available > 0) {
              libraryAllocations[circLibId].available--;
              libraryAllocations[circLibId].checkedOut++;
            }
          }
        }
      }
      
      // Get recent circulation records for this book
      const recentCirculationRaw = await storage.getRecentCirculationByBook(bookId, 10);
      
      // Enrich with user info
      const recentCirculation = await Promise.all(recentCirculationRaw.map(async (record) => {
        const user = await storage.getUser(record.userId);
        const library = record.libraryId ? libraryMap.get(record.libraryId) : null;
        return {
          ...record,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || '',
          libraryName: library?.name || null,
        };
      }));
      
      // Calculate financial information
      const finesData = await storage.getBookFinesSummary(bookId);
      
      // Calculate acquisition data from copies
      let totalAcquisitionCost = 0;
      const acquisitionHistory: {
        date: Date | null;
        source: string | null;
        cost: number;
        quantity: number;
      }[] = [];
      
      // Group copies by acquisition date and source
      const acquisitionGroups = new Map<string, { date: Date | null; source: string | null; cost: number; quantity: number }>();
      
      for (const copy of copies) {
        const price = copy.price || 0;
        totalAcquisitionCost += price;
        
        const key = `${copy.acquisitionDate?.toISOString() || 'unknown'}_${copy.acquisitionSource || 'unknown'}`;
        const existing = acquisitionGroups.get(key);
        if (existing) {
          existing.cost += price;
          existing.quantity += 1;
        } else {
          acquisitionGroups.set(key, {
            date: copy.acquisitionDate,
            source: copy.acquisitionSource,
            cost: price,
            quantity: 1,
          });
        }
      }
      
      // Sort acquisition history by date (newest first)
      const sortedAcquisitions = Array.from(acquisitionGroups.values())
        .sort((a, b) => {
          if (!a.date) return 1;
          if (!b.date) return -1;
          return b.date.getTime() - a.date.getTime();
        });
      
      res.json({
        book,
        totalCopies: copies.length,
        libraryAllocations: Object.values(libraryAllocations),
        recentCirculation,
        financials: {
          totalFinesCollected: finesData.paidFines,
          totalFinesOutstanding: finesData.outstandingFines,
          totalFinesWaived: finesData.waivedFines,
          totalAcquisitionCost,
        },
        acquisitionHistory: sortedAcquisitions,
      });
    } catch (error) {
      console.error("Error fetching book dashboard:", error);
      res.status(500).json({ error: "Failed to fetch book dashboard" });
    }
  });

  app.post("/api/books", async (req, res) => {
    try {
      const { quantity, acquisitionDate, acquisitionSource, unitPrice, ...bookData } = req.body;
      
      // Convert acquisitionDate string to Date object if provided
      const parsedAcquisitionDate = acquisitionDate ? new Date(acquisitionDate) : null;
      
      // Convert unit price to cents (integer) if provided
      const priceInCents = unitPrice ? Math.round(parseFloat(unitPrice) * 100) : null;
      
      const validated = insertBookSchema.parse({
        ...bookData,
        acquisitionDate: parsedAcquisitionDate,
      });
      
      // Check for duplicate ISBN
      const existing = await storage.getBookByIsbn(validated.isbn);
      if (existing) {
        return res.status(400).json({ error: "Book with this ISBN already exists" });
      }
      
      const book = await storage.createBook(validated);
      
      // Create unallocated copies if quantity is specified
      const copyCount = Math.min(Math.max(1, parseInt(quantity) || 1), 1000);
      if (copyCount > 0) {
        await storage.createBookCopies(
          book.id, 
          copyCount, 
          validated.shelfLocation || undefined, 
          parsedAcquisitionDate || undefined,
          acquisitionSource || undefined,
          priceInCents || undefined
        );
      }
      
      logAudit(req, { category: 'CATALOG', action: 'BOOK_CREATED', targetType: 'book', targetId: String(book.id), details: { title: book.title, isbn: book.isbn, copiesCreated: copyCount } });
      res.status(201).json({ ...book, copiesCreated: copyCount });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating book:", error);
      res.status(500).json({ error: "Failed to create book" });
    }
  });

  app.patch("/api/books/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertBookSchema.partial().parse(req.body);
      
      const book = await storage.updateBook(id, validated);
      
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      logAudit(req, { category: 'CATALOG', action: 'BOOK_UPDATED', targetType: 'book', targetId: String(id), details: { changedFields: Object.keys(validated) } });
      res.json(book);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating book:", error);
      res.status(500).json({ error: "Failed to update book" });
    }
  });

  app.delete("/api/books/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if book has active circulation
      const activeCirc = await storage.getActiveCirculationByBook(id);
      if (activeCirc) {
        return res.status(400).json({ error: "Cannot delete book with active circulation" });
      }
      
      await storage.deleteBook(id);
      logAudit(req, { category: 'CATALOG', action: 'BOOK_DELETED', targetType: 'book', targetId: String(id) });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting book:", error);
      res.status(500).json({ error: "Failed to delete book" });
    }
  });

  // Book cover upload
  const coverUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, 'uploads/covers');
      },
      filename: (req, file, cb) => {
        const ext = file.originalname.split('.').pop();
        cb(null, `book-${req.params.id}-${Date.now()}.${ext}`);
      }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
      }
    }
  });

  app.post("/api/books/:id/cover", coverUpload.single("cover"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const book = await storage.getBook(id);
      
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const coverUrl = `/uploads/covers/${req.file.filename}`;
      const updatedBook = await storage.updateBook(id, { coverUrl });
      
      res.json({ coverUrl, book: updatedBook });
    } catch (error: any) {
      console.error("Error uploading cover:", error);
      res.status(500).json({ error: error.message || "Failed to upload cover" });
    }
  });

  // Fetch cover from Open Library by ISBN
  app.post("/api/books/:id/cover/fetch", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const book = await storage.getBook(id);
      
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      if (!book.isbn) {
        return res.status(400).json({ error: "Book has no ISBN to search with" });
      }
      
      // Clean ISBN (remove dashes/spaces)
      const cleanIsbn = book.isbn.replace(/[-\s]/g, '');
      
      // Try Open Library first
      const openLibraryUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`;
      
      let imageBuffer: Buffer | null = null;
      let contentType = 'image/jpeg';
      
      // Fetch from Open Library
      const olResponse = await fetch(openLibraryUrl);
      if (olResponse.ok && olResponse.headers.get('content-type')?.startsWith('image/')) {
        imageBuffer = Buffer.from(await olResponse.arrayBuffer());
        contentType = olResponse.headers.get('content-type') || 'image/jpeg';
      }
      
      // If not found, try Google Books API
      if (!imageBuffer) {
        const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`;
        const gbResponse = await fetch(googleBooksUrl);
        if (gbResponse.ok) {
          const gbData = await gbResponse.json();
          if (gbData.items?.[0]?.volumeInfo?.imageLinks?.thumbnail) {
            let thumbnailUrl = gbData.items[0].volumeInfo.imageLinks.thumbnail;
            // Get larger image by modifying zoom parameter
            thumbnailUrl = thumbnailUrl.replace('zoom=1', 'zoom=2');
            const imgResponse = await fetch(thumbnailUrl);
            if (imgResponse.ok) {
              imageBuffer = Buffer.from(await imgResponse.arrayBuffer());
              contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
            }
          }
        }
      }
      
      if (!imageBuffer) {
        return res.status(404).json({ error: "No cover image found for this ISBN" });
      }
      
      // Save the image to disk
      const fs = await import('fs');
      const path = await import('path');
      
      const ext = contentType.includes('png') ? 'png' : 'jpg';
      const filename = `book-${id}-${Date.now()}.${ext}`;
      const filepath = path.join('uploads', 'covers', filename);
      
      // Ensure directory exists
      await fs.promises.mkdir(path.join('uploads', 'covers'), { recursive: true });
      await fs.promises.writeFile(filepath, imageBuffer);
      
      const coverUrl = `/uploads/covers/${filename}`;
      const updatedBook = await storage.updateBook(id, { coverUrl });
      
      res.json({ coverUrl, book: updatedBook, source: 'online' });
    } catch (error: any) {
      console.error("Error fetching cover:", error);
      res.status(500).json({ error: error.message || "Failed to fetch cover" });
    }
  });

  // ===== Users API =====
  app.get("/api/users", async (req, res) => {
    try {
      const { category } = req.query;
      
      if (category && (category === 'STAFF' || category === 'PATRON')) {
        const users = await storage.getUsersByCategory(category);
        res.json(users);
      } else {
        const users = await storage.getAllUsers();
        res.json(users);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/search", async (req, res) => {
    try {
      const q = (req.query.q as string || "").trim();
      const role = req.query.role as string;
      const department = req.query.department as string;
      const status = req.query.status as string || "ACTIVE";
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      const allUsers = await storage.getAllUsers();
      
      let filtered = allUsers.filter(u => {
        if (status && u.status !== status) return false;
        if (role && u.role !== role) return false;
        if (department && u.department !== department) return false;
        if (q) {
          const search = q.toLowerCase();
          return (
            u.name.toLowerCase().includes(search) ||
            u.username.toLowerCase().includes(search) ||
            u.email.toLowerCase().includes(search) ||
            (u.studentId && u.studentId.toLowerCase().includes(search)) ||
            (u.employeeId && u.employeeId.toLowerCase().includes(search)) ||
            (u.externalId && u.externalId.toLowerCase().includes(search)) ||
            (u.phone && u.phone.includes(search))
          );
        }
        return true;
      });

      const totalCount = filtered.length;
      filtered = filtered.slice(0, limit);

      const safeUsers = filtered.map(({ password, ...rest }) => rest);

      res.json({ users: safeUsers, totalCount });
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const validated = insertUserSchema.parse(req.body);
      
      // Check for duplicate username/email
      const existingUsername = await storage.getUserByUsername(validated.username);
      if (existingUsername) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const existingEmail = await storage.getUserByEmail(validated.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      const user = await storage.createUser(validated);
      logAudit(req, { category: 'USER_MANAGEMENT', action: 'USER_CREATED', targetType: 'user', targetId: String(user.id), details: { username: user.username, email: user.email, role: user.role, category: user.category } });
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertUserSchema.partial().parse(req.body);
      
      const user = await storage.updateUser(id, validated);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      logAudit(req, { category: 'USER_MANAGEMENT', action: 'USER_UPDATED', targetType: 'user', targetId: String(id), details: { changedFields: Object.keys(validated) } });
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteUser(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      
      logAudit(req, { category: 'USER_MANAGEMENT', action: 'USER_DELETED', targetType: 'user', targetId: String(id) });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ===== Circulation API =====
  app.get("/api/circulation", async (req, res) => {
    try {
      const { userId, enrich } = req.query;

      const circulations = (userId && typeof userId === 'string')
        ? await storage.getCirculationByUser(parseInt(userId))
        : await storage.getAllCirculation();

      if (enrich !== 'true') {
        return res.json(circulations);
      }

      // Enrich active rows with accrued fine info
      const libraries = await storage.getAllLibraries();
      const libMap = new Map(libraries.map(l => [l.id, l]));

      const enriched = await Promise.all(circulations.map(async (c) => {
        const lib = c.libraryId ? libMap.get(c.libraryId) : null;
        if (c.status === 'RETURNED') {
          const finePaid = c.finePaidAmount ?? 0;
          const fineWaived = c.fineWaivedAmount ?? 0;
          const fineOutstanding = Math.max(0, (c.fineAmount ?? 0) - finePaid - fineWaived);
          const damageOutstanding = Math.max(0, (c.damageCost ?? 0) - (c.damagePaidAmount ?? 0) - (c.damageWaivedAmount ?? 0));
          return { ...c, accruedFine: c.fineAmount ?? 0, daysOverdue: 0, isOverdue: false, fineOutstanding, damageOutstanding };
        }
        const calc = calculateAccruedFine(c, lib || null);
        const fineOutstanding = Math.max(0, calc.fineCents - (c.finePaidAmount ?? 0) - (c.fineWaivedAmount ?? 0));
        return { ...c, accruedFine: calc.fineCents, daysOverdue: calc.daysOverdue, isOverdue: calc.isOverdue, fineOutstanding, damageOutstanding: 0 };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching circulation:", error);
      res.status(500).json({ error: "Failed to fetch circulation records" });
    }
  });

  app.post("/api/circulation/checkout", async (req, res) => {
    try {
      const sessionId = req.cookies?.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const sessionData = await storage.getSession(sessionId);
      if (!sessionData) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const issuingUser = await storage.getUser(sessionData.userId);
      if (!issuingUser) {
        return res.status(401).json({ error: "User not found" });
      }

      const body = {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        returnDate: req.body.returnDate ? new Date(req.body.returnDate) : undefined,
      };
      const validated = insertCirculationSchema.parse(body);

      // Library validation
      if (!validated.libraryId) {
        return res.status(400).json({ error: "Library selection is required for checkout" });
      }

      const library = await storage.getLibrary(validated.libraryId);
      if (!library) {
        return res.status(404).json({ error: "Selected library not found" });
      }

      // Enforce library assignment rules
      if (issuingUser.role === 'ADMIN') {
        // Admin must explicitly select a library (already validated above)
      } else {
        // Non-admin staff must be assigned to the library they're issuing from
        const memberships = await storage.getMembershipsByUser(issuingUser.id);
        const assignedLibraryIds = memberships.filter(m => m.isActive).map(m => m.libraryId);
        if (!assignedLibraryIds.includes(validated.libraryId)) {
          return res.status(403).json({ error: "You can only issue books from your assigned library" });
        }
      }
      
      // Check if book is available
      const book = await storage.getBook(validated.bookId);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      if (book.status !== 'AVAILABLE') {
        return res.status(400).json({ error: "Book is not available for checkout" });
      }
      
      // Check book copy status if a specific copy is being checked out
      if (validated.bookCopyId) {
        const copy = await storage.getBookCopy(validated.bookCopyId);
        if (!copy) {
          return res.status(404).json({ error: "Book copy not found" });
        }

        // Ensure the copy belongs to the selected library
        if (copy.libraryId !== validated.libraryId) {
          return res.status(400).json({ error: "This copy does not belong to the selected library" });
        }
        
        // Prevent checkout for non-available copies
        const nonIssuableStatuses = ['RESERVED', 'DAMAGED', 'LOST', 'IN_TRANSIT', 'CHECKED_OUT'];
        if (nonIssuableStatuses.includes(copy.status)) {
          const statusMessages: Record<string, string> = {
            'RESERVED': 'This copy is reserved for in-library use only and cannot be issued',
            'DAMAGED': 'This copy is marked as damaged and cannot be issued',
            'LOST': 'This copy is marked as lost and cannot be issued',
            'IN_TRANSIT': 'This copy is in transit and cannot be issued',
            'CHECKED_OUT': 'This copy is already checked out'
          };
          return res.status(400).json({ error: statusMessages[copy.status] || 'This copy cannot be issued' });
        }
      }
      
      const checkoutUser = await storage.getUser(validated.userId);
      if (!checkoutUser) {
        return res.status(404).json({ error: "User not found" });
      }
      if (checkoutUser.status === 'INACTIVE') {
        return res.status(403).json({ error: "This member is inactive and cannot checkout books" });
      }

      // Check for active circulation
      const activeCirc = await storage.getActiveCirculationByBook(validated.bookId);
      if (activeCirc) {
        return res.status(400).json({ error: "Book is already checked out" });
      }
      
      // Create circulation record with libraryId
      const circulation = await storage.createCirculation(validated);
      
      // Update book status
      await storage.updateBook(validated.bookId, { status: 'CHECKED_OUT' });

      // Update copy status if specific copy selected
      if (validated.bookCopyId) {
        await storage.updateBookCopy(validated.bookCopyId, { status: 'CHECKED_OUT' });
      }
      
      logAudit(req, { category: 'CIRCULATION', action: 'CHECKOUT', targetType: 'circulation', targetId: String(circulation.id), details: { bookId: validated.bookId, bookTitle: book.title, userId: validated.userId, bookCopyId: validated.bookCopyId, libraryId: validated.libraryId, libraryName: library.name } });
      res.status(201).json(circulation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error checking out book:", error);
      res.status(500).json({ error: "Failed to checkout book" });
    }
  });

  // Fine preview for a circulation (used by return modal & circulation list)
  app.get("/api/circulation/:id/fine-preview", async (req, res) => {
    try {
      const staff = await requireStaff(req, res); if (!staff) return;
      const id = parseInt(req.params.id);
      const circ = await storage.getCirculation(id);
      if (!circ) return res.status(404).json({ error: "Circulation record not found" });
      const summary = await getCirculationFineSummary(circ);
      const payments = await storage.getFinePaymentsByCirculation(id);
      res.json({ ...summary, payments });
    } catch (error) {
      console.error("Error computing fine preview:", error);
      res.status(500).json({ error: "Failed to compute fine preview" });
    }
  });

  const returnBodySchema = z.object({
    damageCost: z.number().int().nonnegative().optional().default(0),
    damageNotes: z.string().optional(),
    payments: z.array(z.object({
      paymentMethodId: z.number().int().positive(),
      amount: z.number().int().positive(),
      paymentType: z.enum(['FINE', 'DAMAGE']).default('FINE'),
      referenceNumber: z.string().optional(),
      notes: z.string().optional(),
    })).optional().default([]),
    waiveFineAmount: z.number().int().nonnegative().optional().default(0),
    waiveDamageAmount: z.number().int().nonnegative().optional().default(0),
    waiveReason: z.string().optional(),
  });

  app.post("/api/circulation/:id/return", async (req, res) => {
    try {
      const currentUser = await requireStaff(req, res);
      if (!currentUser) return;
      const isAdmin = currentUser.role === 'ADMIN';

      const id = parseInt(req.params.id);
      const circ = await storage.getCirculation(id);
      if (!circ) return res.status(404).json({ error: "Circulation record not found" });
      if (circ.status === 'RETURNED') return res.status(400).json({ error: "This book has already been returned" });

      const body = returnBodySchema.parse(req.body || {});
      const returnDate = new Date();

      // Compute fine using policy
      const library = circ.libraryId ? await storage.getLibrary(circ.libraryId) : null;
      const calc = calculateAccruedFine({ ...circ, returnDate }, library);
      const fineAmount = calc.fineCents;
      const isOverdue = calc.isOverdue;
      const daysOverdue = calc.daysOverdue;
      const damageCost = body.damageCost || 0;

      // Validate that payments don't exceed assessed amounts
      const finePayTotal = body.payments.filter(p => p.paymentType === 'FINE').reduce((s, p) => s + p.amount, 0);
      const damagePayTotal = body.payments.filter(p => p.paymentType === 'DAMAGE').reduce((s, p) => s + p.amount, 0);

      const waiveFine = isAdmin ? (body.waiveFineAmount || 0) : 0;
      const waiveDamage = isAdmin ? (body.waiveDamageAmount || 0) : 0;

      if (finePayTotal + waiveFine > fineAmount) {
        return res.status(400).json({ error: `Fine payment + waiver (${finePayTotal + waiveFine}) cannot exceed fine amount (${fineAmount})` });
      }
      if (damagePayTotal + waiveDamage > damageCost) {
        return res.status(400).json({ error: `Damage payment + waiver (${damagePayTotal + waiveDamage}) cannot exceed damage cost (${damageCost})` });
      }

      // Validate payment methods exist
      for (const p of body.payments) {
        const pm = await storage.getPaymentMethod(p.paymentMethodId);
        if (!pm || !pm.isActive) {
          return res.status(400).json({ error: `Invalid or inactive payment method id ${p.paymentMethodId}` });
        }
      }

      // Determine fine status
      const fineRemaining = fineAmount - finePayTotal - waiveFine;
      let fineStatus: 'OUTSTANDING' | 'PAID' | 'WAIVED' | 'PARTIALLY_PAID' = 'OUTSTANDING';
      if (fineAmount === 0) {
        fineStatus = 'PAID';
      } else if (fineRemaining === 0) {
        fineStatus = waiveFine > 0 && finePayTotal === 0 ? 'WAIVED' : 'PAID';
      } else if (finePayTotal > 0 || waiveFine > 0) {
        fineStatus = 'PARTIALLY_PAID';
      }

      const damageRemaining = damageCost - damagePayTotal - waiveDamage;
      let damageStatus: 'NONE' | 'OUTSTANDING' | 'PAID' | 'WAIVED' | 'PARTIALLY_PAID' = 'NONE';
      if (damageCost === 0) {
        damageStatus = 'NONE';
      } else if (damageRemaining === 0) {
        damageStatus = waiveDamage > 0 && damagePayTotal === 0 ? 'WAIVED' : 'PAID';
      } else if (damagePayTotal > 0 || waiveDamage > 0) {
        damageStatus = 'PARTIALLY_PAID';
      } else {
        damageStatus = 'OUTSTANDING';
      }

      // Update circulation
      const updated = await storage.updateCirculation(id, {
        returnDate,
        status: 'RETURNED',
        fineAmount,
        fineStatus,
        finePaidAmount: finePayTotal,
        fineWaivedAmount: waiveFine,
        damageCost,
        damageStatus,
        damagePaidAmount: damagePayTotal,
        damageWaivedAmount: waiveDamage,
        damageNotes: body.damageNotes || null,
      } as any);

      // Persist fine payments
      for (const p of body.payments) {
        await storage.createFinePayment({
          circulationId: id,
          paymentType: p.paymentType,
          amount: p.amount,
          paymentMethodId: p.paymentMethodId,
          collectedBy: currentUser.id,
          referenceNumber: p.referenceNumber || null,
          notes: p.notes || null,
        } as any);
      }

      // If non-admin and a waiver was requested but not applied, create waiver requests
      const requestedFineWaive = !isAdmin ? (body.waiveFineAmount || 0) : 0;
      const requestedDamageWaive = !isAdmin ? (body.waiveDamageAmount || 0) : 0;
      if (requestedFineWaive > 0) {
        const wr = await storage.createFineWaiverRequest({
          circulationId: id,
          requestType: 'FINE',
          requestedAmount: requestedFineWaive,
          reason: body.waiveReason || 'Waiver requested at return',
          requestedBy: currentUser.id,
        } as any);
        logAudit(req, { category: 'FINES', action: 'WAIVER_REQUESTED', targetType: 'fine_waiver_request', targetId: String(wr.id), details: { circulationId: id, type: 'FINE', amount: requestedFineWaive } });
      }
      if (requestedDamageWaive > 0) {
        const wr = await storage.createFineWaiverRequest({
          circulationId: id,
          requestType: 'DAMAGE',
          requestedAmount: requestedDamageWaive,
          reason: body.waiveReason || 'Damage waiver requested at return',
          requestedBy: currentUser.id,
        } as any);
        logAudit(req, { category: 'FINES', action: 'WAIVER_REQUESTED', targetType: 'fine_waiver_request', targetId: String(wr.id), details: { circulationId: id, type: 'DAMAGE', amount: requestedDamageWaive } });
      }

      // Update book/copy status
      await storage.updateBook(circ.bookId, { status: 'AVAILABLE' });
      if (circ.bookCopyId) {
        await storage.updateBookCopy(circ.bookCopyId, { status: damageCost > 0 ? 'DAMAGED' : 'AVAILABLE' });
      }

      logAudit(req, {
        category: 'CIRCULATION',
        action: 'RETURN',
        targetType: 'circulation',
        targetId: String(id),
        details: { bookId: circ.bookId, userId: circ.userId, isOverdue, daysOverdue, fineAmount, finePayTotal, fineWaived: waiveFine, damageCost, damagePayTotal, damageWaived: waiveDamage, libraryId: circ.libraryId }
      });
      if (finePayTotal > 0 || damagePayTotal > 0) {
        logAudit(req, { category: 'FINES', action: 'PAYMENT_COLLECTED', targetType: 'circulation', targetId: String(id), details: { finePayTotal, damagePayTotal, payments: body.payments } });
      }
      if (waiveFine > 0 || waiveDamage > 0) {
        logAudit(req, { category: 'FINES', action: 'WAIVED_BY_ADMIN', targetType: 'circulation', targetId: String(id), details: { waiveFine, waiveDamage, reason: body.waiveReason } });
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error returning book:", error);
      res.status(500).json({ error: "Failed to return book" });
    }
  });

  // Collect fine after the fact (for already returned circulations with outstanding fine/damage)
  app.post("/api/circulation/:id/collect-fine", async (req, res) => {
    try {
      const currentUser = await requireStaff(req, res);
      if (!currentUser) return;
      const isAdmin = currentUser.role === 'ADMIN';

      const id = parseInt(req.params.id);
      const circ = await storage.getCirculation(id);
      if (!circ) return res.status(404).json({ error: "Circulation not found" });

      const body = z.object({
        payments: z.array(z.object({
          paymentMethodId: z.number().int().positive(),
          amount: z.number().int().positive(),
          paymentType: z.enum(['FINE', 'DAMAGE']).default('FINE'),
          referenceNumber: z.string().optional(),
          notes: z.string().optional(),
        })).default([]),
        waiveFineAmount: z.number().int().nonnegative().optional().default(0),
        waiveDamageAmount: z.number().int().nonnegative().optional().default(0),
        waiveReason: z.string().optional(),
      }).parse(req.body || {});

      const summary = await getCirculationFineSummary(circ);
      const finePay = body.payments.filter(p => p.paymentType === 'FINE').reduce((s, p) => s + p.amount, 0);
      const damagePay = body.payments.filter(p => p.paymentType === 'DAMAGE').reduce((s, p) => s + p.amount, 0);
      const waiveFine = isAdmin ? body.waiveFineAmount : 0;
      const waiveDamage = isAdmin ? body.waiveDamageAmount : 0;

      if (finePay + waiveFine > summary.fineOutstanding) {
        return res.status(400).json({ error: "Fine collection exceeds outstanding amount" });
      }
      if (damagePay + waiveDamage > summary.damageOutstanding) {
        return res.status(400).json({ error: "Damage collection exceeds outstanding amount" });
      }

      for (const p of body.payments) {
        const pm = await storage.getPaymentMethod(p.paymentMethodId);
        if (!pm || !pm.isActive) return res.status(400).json({ error: `Invalid payment method ${p.paymentMethodId}` });
        await storage.createFinePayment({
          circulationId: id,
          paymentType: p.paymentType,
          amount: p.amount,
          paymentMethodId: p.paymentMethodId,
          collectedBy: currentUser.id,
          referenceNumber: p.referenceNumber || null,
          notes: p.notes || null,
        } as any);
      }

      const newFinePaid = (circ.finePaidAmount ?? 0) + finePay;
      const newFineWaived = (circ.fineWaivedAmount ?? 0) + waiveFine;
      const newDamagePaid = (circ.damagePaidAmount ?? 0) + damagePay;
      const newDamageWaived = (circ.damageWaivedAmount ?? 0) + waiveDamage;

      const fineRemaining = (summary.assessedFineCents) - newFinePaid - newFineWaived;
      let fineStatus: 'OUTSTANDING' | 'PAID' | 'WAIVED' | 'PARTIALLY_PAID' = 'OUTSTANDING';
      if (summary.assessedFineCents === 0) fineStatus = 'PAID';
      else if (fineRemaining === 0) fineStatus = newFinePaid === 0 ? 'WAIVED' : 'PAID';
      else if (newFinePaid > 0 || newFineWaived > 0) fineStatus = 'PARTIALLY_PAID';

      const damageRemaining = (circ.damageCost ?? 0) - newDamagePaid - newDamageWaived;
      let damageStatus: 'NONE' | 'OUTSTANDING' | 'PAID' | 'WAIVED' | 'PARTIALLY_PAID' = circ.damageStatus ?? 'NONE';
      if ((circ.damageCost ?? 0) > 0) {
        if (damageRemaining === 0) damageStatus = newDamagePaid === 0 ? 'WAIVED' : 'PAID';
        else if (newDamagePaid > 0 || newDamageWaived > 0) damageStatus = 'PARTIALLY_PAID';
        else damageStatus = 'OUTSTANDING';
      }

      const updated = await storage.updateCirculation(id, {
        finePaidAmount: newFinePaid,
        fineWaivedAmount: newFineWaived,
        fineStatus,
        damagePaidAmount: newDamagePaid,
        damageWaivedAmount: newDamageWaived,
        damageStatus,
      } as any);

      logAudit(req, { category: 'FINES', action: 'PAYMENT_COLLECTED', targetType: 'circulation', targetId: String(id), details: { finePay, damagePay, waiveFine, waiveDamage, payments: body.payments } });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: fromZodError(error).toString() });
      console.error("Collect fine error:", error);
      res.status(500).json({ error: "Failed to collect fine" });
    }
  });

  // ===== Payment Methods API =====
  app.get("/api/payment-methods", async (req, res) => {
    try {
      const onlyActive = req.query.active === 'true';
      const list = onlyActive ? await storage.getActivePaymentMethods() : await storage.getAllPaymentMethods();
      res.json(list);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  app.post("/api/payment-methods", async (req, res) => {
    try {
      const currentUser = await requireLocalAdmin(req, res);
      if (!currentUser) return;
      const validated = insertPaymentMethodSchema.parse(req.body);
      const pm = await storage.createPaymentMethod(validated);
      logAudit(req, { category: 'SYSTEM_CONFIG', action: 'PAYMENT_METHOD_CREATED', userId: currentUser.id, userName: currentUser.name, targetType: 'payment_method', targetId: String(pm.id), details: { name: pm.name, code: pm.code } });
      res.status(201).json(pm);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: fromZodError(error).toString() });
      console.error("Error creating payment method:", error);
      res.status(500).json({ error: "Failed to create payment method" });
    }
  });

  app.patch("/api/payment-methods/:id", async (req, res) => {
    try {
      const currentUser = await requireLocalAdmin(req, res);
      if (!currentUser) return;
      const id = parseInt(req.params.id);
      const validated = insertPaymentMethodSchema.partial().parse(req.body);
      const pm = await storage.updatePaymentMethod(id, validated);
      if (!pm) return res.status(404).json({ error: "Payment method not found" });
      logAudit(req, { category: 'SYSTEM_CONFIG', action: 'PAYMENT_METHOD_UPDATED', userId: currentUser.id, userName: currentUser.name, targetType: 'payment_method', targetId: String(id), details: { changedFields: Object.keys(validated) } });
      res.json(pm);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: fromZodError(error).toString() });
      console.error("Error updating payment method:", error);
      res.status(500).json({ error: "Failed to update payment method" });
    }
  });

  app.delete("/api/payment-methods/:id", async (req, res) => {
    try {
      const currentUser = await requireLocalAdmin(req, res);
      if (!currentUser) return;
      const id = parseInt(req.params.id);
      const ok = await storage.deletePaymentMethod(id);
      if (!ok) return res.status(404).json({ error: "Payment method not found" });
      logAudit(req, { category: 'SYSTEM_CONFIG', action: 'PAYMENT_METHOD_DELETED', userId: currentUser.id, userName: currentUser.name, targetType: 'payment_method', targetId: String(id) });
      res.json({ success: true });
    } catch (error: any) {
      // Likely FK violation
      console.error("Error deleting payment method:", error);
      res.status(400).json({ error: "Cannot delete payment method (it may be referenced by existing payments). Deactivate it instead." });
    }
  });

  // ===== Fine Waiver Requests API =====
  app.get("/api/fine-waiver-requests", async (req, res) => {
    try {
      const currentUser = await requireStaff(req, res);
      if (!currentUser) return;
      const status = (req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined);
      const list = await storage.getFineWaiverRequests(status);
      // Enrich
      const enriched = await Promise.all(list.map(async (r) => {
        const circ = await storage.getCirculation(r.circulationId);
        const book = circ ? await storage.getBook(circ.bookId) : null;
        const borrower = circ ? await storage.getUser(circ.userId) : null;
        const requester = await storage.getUser(r.requestedBy);
        const reviewer = r.reviewedBy ? await storage.getUser(r.reviewedBy) : null;
        return {
          ...r,
          bookTitle: book?.title || null,
          borrowerName: borrower?.name || null,
          requesterName: requester?.name || null,
          reviewerName: reviewer?.name || null,
        };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error listing waiver requests:", error);
      res.status(500).json({ error: "Failed to list waiver requests" });
    }
  });

  app.post("/api/fine-waiver-requests/:id/approve", async (req, res) => {
    try {
      const currentUser = await requireLocalAdmin(req, res);
      if (!currentUser) return;
      const id = parseInt(req.params.id);
      const wr = await storage.getFineWaiverRequest(id);
      if (!wr) return res.status(404).json({ error: "Waiver request not found" });
      if (wr.status !== 'PENDING') return res.status(400).json({ error: "Request already reviewed" });
      const reviewNotes = (req.body?.reviewNotes as string) || '';

      const circ = await storage.getCirculation(wr.circulationId);
      if (!circ) return res.status(404).json({ error: "Circulation not found" });

      // Re-validate against live outstanding amount; clip overage to prevent over-waiver
      let appliedAmount = wr.requestedAmount;
      if (wr.requestType === 'FINE') {
        const outstanding = Math.max(0, (circ.fineAmount ?? 0) - (circ.finePaidAmount ?? 0) - (circ.fineWaivedAmount ?? 0));
        appliedAmount = Math.min(appliedAmount, outstanding);
        const newWaived = (circ.fineWaivedAmount ?? 0) + appliedAmount;
        const remaining = (circ.fineAmount ?? 0) - (circ.finePaidAmount ?? 0) - newWaived;
        const fineStatus = remaining <= 0 ? ((circ.finePaidAmount ?? 0) === 0 ? 'WAIVED' : 'PAID') : 'PARTIALLY_PAID';
        await storage.updateCirculation(circ.id, { fineWaivedAmount: newWaived, fineStatus } as any);
      } else {
        const outstanding = Math.max(0, (circ.damageCost ?? 0) - (circ.damagePaidAmount ?? 0) - (circ.damageWaivedAmount ?? 0));
        appliedAmount = Math.min(appliedAmount, outstanding);
        const newWaived = (circ.damageWaivedAmount ?? 0) + appliedAmount;
        const remaining = (circ.damageCost ?? 0) - (circ.damagePaidAmount ?? 0) - newWaived;
        const damageStatus = remaining <= 0 ? ((circ.damagePaidAmount ?? 0) === 0 ? 'WAIVED' : 'PAID') : 'PARTIALLY_PAID';
        await storage.updateCirculation(circ.id, { damageWaivedAmount: newWaived, damageStatus } as any);
      }

      const updated = await storage.updateFineWaiverRequest(id, { status: 'APPROVED', reviewedBy: currentUser.id, reviewedAt: new Date(), reviewNotes });
      logAudit(req, { category: 'FINES', action: 'WAIVER_APPROVED', userId: currentUser.id, userName: currentUser.name, targetType: 'fine_waiver_request', targetId: String(id), details: { circulationId: wr.circulationId, requestedAmount: wr.requestedAmount, appliedAmount, type: wr.requestType, reviewNotes } });
      res.json(updated);
    } catch (error) {
      console.error("Error approving waiver:", error);
      res.status(500).json({ error: "Failed to approve waiver" });
    }
  });

  app.post("/api/fine-waiver-requests/:id/reject", async (req, res) => {
    try {
      const currentUser = await requireLocalAdmin(req, res);
      if (!currentUser) return;
      const id = parseInt(req.params.id);
      const wr = await storage.getFineWaiverRequest(id);
      if (!wr) return res.status(404).json({ error: "Waiver request not found" });
      if (wr.status !== 'PENDING') return res.status(400).json({ error: "Request already reviewed" });
      const reviewNotes = (req.body?.reviewNotes as string) || '';

      const updated = await storage.updateFineWaiverRequest(id, { status: 'REJECTED', reviewedBy: currentUser.id, reviewedAt: new Date(), reviewNotes });
      logAudit(req, { category: 'FINES', action: 'WAIVER_REJECTED', userId: currentUser.id, userName: currentUser.name, targetType: 'fine_waiver_request', targetId: String(id), details: { circulationId: wr.circulationId, amount: wr.requestedAmount, type: wr.requestType, reviewNotes } });
      res.json(updated);
    } catch (error) {
      console.error("Error rejecting waiver:", error);
      res.status(500).json({ error: "Failed to reject waiver" });
    }
  });

  // ===== Fines & Revenue Report =====
  app.get("/api/reports/fines-revenue", async (req, res) => {
    try {
      const staff = await requireStaff(req, res); if (!staff) return;
      const fromDate = req.query.from ? new Date(req.query.from as string) : undefined;
      let toDate: Date | undefined;
      if (req.query.to) {
        const raw = String(req.query.to);
        toDate = new Date(raw);
        // If a bare YYYY-MM-DD was passed, extend to end-of-day so same-day payments are included
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          toDate.setHours(23, 59, 59, 999);
        }
      }
      const libraryId = req.query.libraryId ? parseInt(req.query.libraryId as string) : undefined;
      const paymentMethodId = req.query.methodId ? parseInt(req.query.methodId as string) : undefined;
      const paymentType = (req.query.type as 'FINE' | 'DAMAGE' | undefined);

      const payments = await storage.getFinePayments({ fromDate, toDate, libraryId, paymentMethodId, paymentType });
      const methods = await storage.getAllPaymentMethods();
      const libraries = await storage.getAllLibraries();
      const methodMap = new Map(methods.map(m => [m.id, m]));
      const libMap = new Map(libraries.map(l => [l.id, l]));

      // Enrich payments with circulation/book/user/library info
      const enriched = await Promise.all(payments.map(async (p) => {
        const circ = await storage.getCirculation(p.circulationId);
        const book = circ ? await storage.getBook(circ.bookId) : null;
        const borrower = circ ? await storage.getUser(circ.userId) : null;
        const collector = await storage.getUser(p.collectedBy);
        const lib = circ?.libraryId ? libMap.get(circ.libraryId) : null;
        return {
          ...p,
          methodName: methodMap.get(p.paymentMethodId)?.name || 'Unknown',
          methodCode: methodMap.get(p.paymentMethodId)?.code || '',
          bookTitle: book?.title || null,
          bookIsbn: book?.isbn || null,
          borrowerName: borrower?.name || null,
          collectorName: collector?.name || null,
          libraryName: lib?.name || null,
          libraryId: circ?.libraryId || null,
        };
      }));

      // Aggregations
      const totalCollected = enriched.reduce((s, p) => s + p.amount, 0);
      const totalFineCollected = enriched.filter(p => p.paymentType === 'FINE').reduce((s, p) => s + p.amount, 0);
      const totalDamageCollected = enriched.filter(p => p.paymentType === 'DAMAGE').reduce((s, p) => s + p.amount, 0);

      const byMethod: Record<string, { methodId: number; methodName: string; total: number; count: number }> = {};
      enriched.forEach(p => {
        const k = String(p.paymentMethodId);
        if (!byMethod[k]) byMethod[k] = { methodId: p.paymentMethodId, methodName: p.methodName, total: 0, count: 0 };
        byMethod[k].total += p.amount;
        byMethod[k].count++;
      });

      const byLibrary: Record<string, { libraryId: number; libraryName: string; total: number; count: number }> = {};
      enriched.forEach(p => {
        const lid = p.libraryId || 0;
        const k = String(lid);
        if (!byLibrary[k]) byLibrary[k] = { libraryId: lid, libraryName: p.libraryName || 'Unallocated', total: 0, count: 0 };
        byLibrary[k].total += p.amount;
        byLibrary[k].count++;
      });

      // Outstanding totals from circulation table (across all returned items in scope)
      const allCirc = await storage.getAllCirculation();
      const filteredCirc = allCirc.filter(c => {
        if (libraryId && c.libraryId !== libraryId) return false;
        if (fromDate && c.checkoutDate < fromDate) return false;
        if (toDate && c.checkoutDate > toDate) return false;
        return true;
      });

      // For active circulations, compute live accrued fine
      let totalOutstanding = 0;
      let totalWaived = 0;
      for (const c of filteredCirc) {
        const lib = c.libraryId ? libMap.get(c.libraryId) : null;
        if (c.status === 'RETURNED') {
          totalOutstanding += Math.max(0, (c.fineAmount ?? 0) - (c.finePaidAmount ?? 0) - (c.fineWaivedAmount ?? 0));
          totalOutstanding += Math.max(0, (c.damageCost ?? 0) - (c.damagePaidAmount ?? 0) - (c.damageWaivedAmount ?? 0));
        } else {
          const calc = calculateAccruedFine(c, lib || null);
          totalOutstanding += Math.max(0, calc.fineCents - (c.finePaidAmount ?? 0) - (c.fineWaivedAmount ?? 0));
        }
        totalWaived += (c.fineWaivedAmount ?? 0) + (c.damageWaivedAmount ?? 0);
      }

      // Time series (daily totals)
      const series: Record<string, number> = {};
      enriched.forEach(p => {
        const d = new Date(p.paidAt).toISOString().slice(0, 10);
        series[d] = (series[d] || 0) + p.amount;
      });
      const timeSeries = Object.entries(series).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }));

      res.json({
        totals: {
          collected: totalCollected,
          fineCollected: totalFineCollected,
          damageCollected: totalDamageCollected,
          outstanding: totalOutstanding,
          waived: totalWaived,
          paymentCount: enriched.length,
        },
        byMethod: Object.values(byMethod),
        byLibrary: Object.values(byLibrary),
        timeSeries,
        payments: enriched,
      });
    } catch (error) {
      console.error("Error generating fines-revenue report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // ===== Inventory API =====
  app.get("/api/inventory", async (req, res) => {
    try {
      const { sessionId } = req.query;
      
      if (sessionId && typeof sessionId === 'string') {
        const inventory = await storage.getInventoryBySession(sessionId);
        return res.json(inventory);
      }
      
      res.status(400).json({ error: "sessionId query parameter is required" });
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ error: "Failed to fetch inventory records" });
    }
  });

  app.post("/api/inventory", async (req, res) => {
    try {
      const validated = insertInventorySchema.parse(req.body);
      const inventory = await storage.createInventory(validated);
      res.status(201).json(inventory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating inventory record:", error);
      res.status(500).json({ error: "Failed to create inventory record" });
    }
  });

  app.patch("/api/inventory/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertInventorySchema.partial().parse(req.body);
      
      const inventory = await storage.updateInventory(id, validated);
      
      if (!inventory) {
        return res.status(404).json({ error: "Inventory record not found" });
      }
      
      res.json(inventory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating inventory:", error);
      res.status(500).json({ error: "Failed to update inventory record" });
    }
  });

  // ===== Audit Sessions API =====
  app.get("/api/audit-sessions", async (req, res) => {
    try {
      const { libraryId, active } = req.query;
      
      if (active === 'true') {
        const sessions = await storage.getActiveAuditSessions();
        return res.json(sessions);
      }
      
      if (libraryId && typeof libraryId === 'string') {
        const sessions = await storage.getAuditSessionsByLibrary(parseInt(libraryId));
        return res.json(sessions);
      }
      
      const sessions = await storage.getAllAuditSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching audit sessions:", error);
      res.status(500).json({ error: "Failed to fetch audit sessions" });
    }
  });

  app.get("/api/audit-sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getAuditSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Audit session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error fetching audit session:", error);
      res.status(500).json({ error: "Failed to fetch audit session" });
    }
  });

  app.get("/api/audit-sessions/:id/stats", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getAuditSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Audit session not found" });
      }
      
      const stats = await storage.getInventorySessionStats(id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching audit session stats:", error);
      res.status(500).json({ error: "Failed to fetch audit session stats" });
    }
  });

  app.post("/api/audit-sessions", async (req, res) => {
    try {
      const validated = insertAuditSessionSchema.parse(req.body);
      const session = await storage.createAuditSession({
        ...validated,
        totalScanned: 0,
        totalMissing: 0,
        discrepancies: 0,
      });
      
      // Pre-populate inventory items as PENDING for all available book copies
      let copies;
      if (session.libraryId) {
        copies = await storage.getBookCopiesByLibrary(session.libraryId);
      } else {
        // If no library specified, include all copies from all libraries
        copies = await storage.getAllBookCopies();
      }
      
      // Only include copies that are AVAILABLE (not checked out, lost, etc.)
      const availableCopies = copies.filter(c => c.status === 'AVAILABLE');
      
      for (const copy of availableCopies) {
        await storage.createInventoryItem({
          auditSessionId: session.id,
          bookCopyId: copy.id,
          status: 'PENDING',
          expectedLocation: copy.shelfLocation || null,
          scannedLocation: null,
          condition: null,
          scannedAt: null,
          notes: null,
        });
      }
      
      logAudit(req, { category: 'INVENTORY', action: 'AUDIT_SESSION_CREATED', targetType: 'audit_session', targetId: String(session.id), details: { sessionCode: session.sessionCode, libraryId: session.libraryId } });
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating audit session:", error);
      res.status(500).json({ error: "Failed to create audit session" });
    }
  });

  app.patch("/api/audit-sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertAuditSessionSchema.partial().parse(req.body);
      
      const session = await storage.updateAuditSession(id, validated);
      
      if (!session) {
        return res.status(404).json({ error: "Audit session not found" });
      }
      
      res.json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating audit session:", error);
      res.status(500).json({ error: "Failed to update audit session" });
    }
  });

  app.post("/api/audit-sessions/:id/complete", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getAuditSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Audit session not found" });
      }
      
      if (session.status !== 'ACTIVE') {
        return res.status(400).json({ error: "Session is not active" });
      }
      
      const stats = await storage.getInventorySessionStats(id);
      
      const updated = await storage.updateAuditSession(id, {
        status: 'COMPLETED',
        completedAt: new Date(),
        totalScanned: stats.verified,
        totalMissing: stats.missing,
        discrepancies: stats.discrepancy
      });
      
      logAudit(req, { category: 'INVENTORY', action: 'AUDIT_SESSION_COMPLETED', targetType: 'audit_session', targetId: String(id), details: { verified: stats.verified, missing: stats.missing, discrepancies: stats.discrepancy } });
      res.json(updated);
    } catch (error) {
      console.error("Error completing audit session:", error);
      res.status(500).json({ error: "Failed to complete audit session" });
    }
  });

  // Get enriched inventory items for a session
  app.get("/api/audit-sessions/:id/items-enriched", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getAuditSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Audit session not found" });
      }
      
      const items = await storage.getInventoryItemsBySession(id);
      
      // Enrich items with book, copy, and library details
      const enrichedItems = await Promise.all(items.map(async (item) => {
        const copy = await storage.getBookCopy(item.bookCopyId);
        const book = copy ? await storage.getBook(copy.bookId) : null;
        const library = copy?.libraryId ? await storage.getLibrary(copy.libraryId) : null;
        return {
          ...item,
          book: book ? { title: book.title, author: book.author, isbn: book.isbn } : null,
          copy: copy ? { 
            internalSSN: copy.internalSSN, 
            userDefinedSSN: copy.userDefinedSSN,
            shelfLocation: copy.shelfLocation,
            condition: copy.condition
          } : null,
          library: library ? { id: library.id, name: library.name, code: library.code } : null,
        };
      }));
      
      res.json(enrichedItems);
    } catch (error) {
      console.error("Error fetching enriched inventory items:", error);
      res.status(500).json({ error: "Failed to fetch inventory items" });
    }
  });

  // Download audit report as Excel
  app.get("/api/audit-sessions/:id/report", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getAuditSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Audit session not found" });
      }
      
      const items = await storage.getInventoryItemsBySession(id);
      
      // Enrich items with book and copy details
      const enrichedItems = await Promise.all(items.map(async (item) => {
        const copy = await storage.getBookCopy(item.bookCopyId);
        const book = copy ? await storage.getBook(copy.bookId) : null;
        const library = copy?.libraryId ? await storage.getLibrary(copy.libraryId) : null;
        return { item, copy, book, library };
      }));
      
      // Separate into verified, pending, and missing
      const verifiedItems = enrichedItems.filter(e => 
        e.item.status === 'VERIFIED' || e.item.status === 'FOUND' || e.item.status === 'DISCREPANCY'
      );
      const pendingItems = enrichedItems.filter(e => e.item.status === 'PENDING');
      const missingItems = enrichedItems.filter(e => e.item.status === 'MISSING');
      
      // Create workbook with multiple sheets
      const workbook = XLSX.utils.book_new();
      
      // Summary sheet
      const stats = await storage.getInventorySessionStats(id);
      const summaryData = [
        ['Audit Session Report'],
        ['Session Code', session.sessionCode],
        ['Status', session.status],
        ['Started', session.startedAt ? new Date(session.startedAt).toLocaleString() : '-'],
        ['Completed', session.completedAt ? new Date(session.completedAt).toLocaleString() : '-'],
        [],
        ['Summary'],
        ['Total Items', stats.total],
        ['Verified', stats.verified],
        ['Pending', stats.pending],
        ['Missing', stats.missing],
        ['Discrepancies', stats.discrepancy],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // Verified items sheet
      const verifiedData = [
        ['Book Title', 'Author', 'ISBN', 'SSN', 'User Defined SSN', 'Library', 'Expected Location', 'Scanned Location', 'Condition', 'Status', 'Scanned At', 'Notes']
      ];
      verifiedItems.forEach(({ item, copy, book, library }) => {
        verifiedData.push([
          book?.title || '-',
          book?.author || '-',
          book?.isbn || '-',
          copy?.internalSSN || '-',
          copy?.userDefinedSSN || '-',
          library?.name || '-',
          item.expectedLocation || copy?.shelfLocation || '-',
          item.scannedLocation || '-',
          item.condition || copy?.condition || '-',
          item.status,
          item.scannedAt ? new Date(item.scannedAt).toLocaleString() : '-',
          item.notes || '-',
        ]);
      });
      const verifiedSheet = XLSX.utils.aoa_to_sheet(verifiedData);
      XLSX.utils.book_append_sheet(workbook, verifiedSheet, 'Verified');
      
      // Pending items sheet (not verified yet - potentially missing)
      const pendingData = [
        ['Book Title', 'Author', 'ISBN', 'SSN', 'User Defined SSN', 'Library', 'Expected Location', 'Condition', 'Status']
      ];
      pendingItems.forEach(({ item, copy, book, library }) => {
        pendingData.push([
          book?.title || '-',
          book?.author || '-',
          book?.isbn || '-',
          copy?.internalSSN || '-',
          copy?.userDefinedSSN || '-',
          library?.name || '-',
          item.expectedLocation || copy?.shelfLocation || '-',
          copy?.condition || '-',
          item.status,
        ]);
      });
      const pendingSheet = XLSX.utils.aoa_to_sheet(pendingData);
      XLSX.utils.book_append_sheet(workbook, pendingSheet, 'Pending (Not Verified)');
      
      // Missing items sheet (always included)
      const missingData = [
        ['Book Title', 'Author', 'ISBN', 'SSN', 'User Defined SSN', 'Library', 'Expected Location', 'Condition', 'Status', 'Notes']
      ];
      missingItems.forEach(({ item, copy, book, library }) => {
        missingData.push([
          book?.title || '-',
          book?.author || '-',
          book?.isbn || '-',
          copy?.internalSSN || '-',
          copy?.userDefinedSSN || '-',
          library?.name || '-',
          item.expectedLocation || copy?.shelfLocation || '-',
          copy?.condition || '-',
          item.status,
          item.notes || '-',
        ]);
      });
      const missingSheet = XLSX.utils.aoa_to_sheet(missingData);
      XLSX.utils.book_append_sheet(workbook, missingSheet, 'Missing');
      
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=audit_report_${session.sessionCode}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Error generating audit report:", error);
      res.status(500).json({ error: "Failed to generate audit report" });
    }
  });

  // ===== Inventory Items API =====
  app.get("/api/inventory-items", async (req, res) => {
    try {
      const { sessionId } = req.query;
      
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: "sessionId query parameter is required" });
      }
      
      const items = await storage.getInventoryItemsBySession(parseInt(sessionId));
      
      // Enrich items with book and copy details
      const enrichedItems = await Promise.all(items.map(async (item) => {
        const copy = await storage.getBookCopy(item.bookCopyId);
        const book = copy ? await storage.getBook(copy.bookId) : null;
        return {
          ...item,
          copy,
          book,
        };
      }));
      
      res.json(enrichedItems);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
      res.status(500).json({ error: "Failed to fetch inventory items" });
    }
  });

  app.post("/api/inventory-items", async (req, res) => {
    try {
      const validated = insertInventoryItemSchema.parse(req.body);
      
      // Check if item already exists for this session and copy
      const existing = await storage.getInventoryItemBySessionAndCopy(
        validated.auditSessionId,
        validated.bookCopyId
      );
      
      if (existing) {
        // Update existing item
        const updated = await storage.updateInventoryItem(existing.id, validated);
        return res.json(updated);
      }
      
      const item = await storage.createInventoryItem(validated);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating inventory item:", error);
      res.status(500).json({ error: "Failed to create inventory item" });
    }
  });

  app.patch("/api/inventory-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertInventoryItemSchema.partial().parse(req.body);
      
      const item = await storage.updateInventoryItem(id, validated);
      
      if (!item) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating inventory item:", error);
      res.status(500).json({ error: "Failed to update inventory item" });
    }
  });

  // Scan SSN endpoint - verifies a copy during inventory audit
  app.post("/api/audit-sessions/:sessionId/scan", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const { ssn, shelfLocation, condition, notes } = req.body;
      
      if (!ssn) {
        return res.status(400).json({ error: "SSN is required" });
      }
      
      // Verify session exists and is active
      const session = await storage.getAuditSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Audit session not found" });
      }
      if (session.status !== 'ACTIVE') {
        return res.status(400).json({ error: "Audit session is not active" });
      }
      
      // Find copy by SSN
      const copies = await storage.getAllBookCopies();
      const copy = copies.find(c => c.internalSSN === ssn || c.userDefinedSSN === ssn);
      
      if (!copy) {
        // SSN not found in system
        return res.status(404).json({ 
          error: "Copy not found",
          ssn,
          message: "No book copy found with this SSN"
        });
      }
      
      // Get book details for the response
      const book = await storage.getBook(copy.bookId);
      
      // Check if copy belongs to this library
      if (session.libraryId && copy.libraryId !== session.libraryId) {
        // Check if there's already an item for this copy (shouldn't be, but check)
        const existingItem = await storage.getInventoryItemBySessionAndCopy(sessionId, copy.id);
        let item;
        if (existingItem) {
          item = await storage.updateInventoryItem(existingItem.id, {
            status: 'DISCREPANCY',
            scannedLocation: shelfLocation || null,
            condition: condition || copy.condition || null,
            scannedAt: new Date(),
            notes: notes || `Copy belongs to different library (Library ID: ${copy.libraryId})`
          });
        } else {
          item = await storage.createInventoryItem({
            auditSessionId: sessionId,
            bookCopyId: copy.id,
            status: 'DISCREPANCY',
            scannedLocation: shelfLocation || null,
            expectedLocation: copy.shelfLocation || null,
            condition: condition || copy.condition || null,
            scannedAt: new Date(),
            notes: notes || `Copy belongs to different library (Library ID: ${copy.libraryId})`
          });
        }
        
        return res.json({
          item,
          copy,
          book,
          warning: "Copy belongs to a different library"
        });
      }
      
      // Check if there's a pending item for this copy (should exist from session creation)
      const existing = await storage.getInventoryItemBySessionAndCopy(sessionId, copy.id);
      
      if (existing && existing.status !== 'PENDING') {
        // Already scanned
        return res.json({
          item: existing,
          copy,
          book,
          duplicate: true,
          message: "This copy was already scanned in this session"
        });
      }
      
      // Determine status based on location match
      const scannedLoc = shelfLocation || null;
      const locationMatch = !scannedLoc || scannedLoc === copy.shelfLocation;
      const status = locationMatch ? 'VERIFIED' : 'DISCREPANCY';
      
      let item;
      if (existing) {
        // Update existing pending item to verified
        item = await storage.updateInventoryItem(existing.id, {
          status,
          scannedLocation: scannedLoc,
          condition: condition || copy.condition || null,
          scannedAt: new Date(),
          notes: notes || (locationMatch ? null : `Location mismatch: expected ${copy.shelfLocation}, found at ${scannedLoc}`)
        });
      } else {
        // Create new item (for copies not in the original scope)
        item = await storage.createInventoryItem({
          auditSessionId: sessionId,
          bookCopyId: copy.id,
          status,
          scannedLocation: scannedLoc,
          expectedLocation: copy.shelfLocation || null,
          condition: condition || copy.condition || null,
          scannedAt: new Date(),
          notes: notes || (locationMatch ? null : `Location mismatch: expected ${copy.shelfLocation}, found at ${scannedLoc}`)
        });
      }
      
      logAudit(req, { category: 'INVENTORY', action: 'ITEM_SCANNED', targetType: 'inventory_item', targetId: String(item.id), details: { sessionId, ssn, bookTitle: book?.title, status: item.status } });
      res.json({ item, copy, book });
    } catch (error) {
      console.error("Error scanning item:", error);
      res.status(500).json({ error: "Failed to scan item" });
    }
  });

  // ===== System Config API =====
  app.get("/api/config", async (req, res) => {
    try {
      const currentUser = await requireLocalAdmin(req, res);
      if (!currentUser) return;
      const configs = await storage.getAllSystemConfig();
      res.json(configs);
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      const currentUser = await requireLocalAdmin(req, res);
      if (!currentUser) return;
      const validated = insertSystemConfigSchema.parse(req.body);
      const config = await storage.setSystemConfig(validated);
      logAudit(req, { category: 'SYSTEM_CONFIG', action: 'CONFIG_UPDATED', userId: currentUser.id, userName: currentUser.name, targetType: 'config', targetId: validated.key, details: { key: validated.key, value: validated.value } });
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error setting config:", error);
      res.status(500).json({ error: "Failed to set configuration" });
    }
  });

  // ===== Resource Types API =====
  app.get("/api/resource-types", async (req, res) => {
    try {
      const { active } = req.query;
      
      if (active === 'true') {
        const types = await storage.getActiveResourceTypes();
        return res.json(types);
      }
      
      const types = await storage.getAllResourceTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching resource types:", error);
      res.status(500).json({ error: "Failed to fetch resource types" });
    }
  });

  app.get("/api/resource-types/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const type = await storage.getResourceType(id);
      
      if (!type) {
        return res.status(404).json({ error: "Resource type not found" });
      }
      
      res.json(type);
    } catch (error) {
      console.error("Error fetching resource type:", error);
      res.status(500).json({ error: "Failed to fetch resource type" });
    }
  });

  app.post("/api/resource-types", async (req, res) => {
    try {
      const validated = insertResourceTypeSchema.parse(req.body);
      const type = await storage.createResourceType(validated);
      logAudit(req, { category: 'CATALOG', action: 'RESOURCE_TYPE_CREATED', targetType: 'resource_type', targetId: String(type.id), details: { name: validated.name } });
      res.status(201).json(type);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating resource type:", error);
      res.status(500).json({ error: "Failed to create resource type" });
    }
  });

  app.patch("/api/resource-types/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertResourceTypeSchema.partial().parse(req.body);
      
      const type = await storage.updateResourceType(id, validated);
      
      if (!type) {
        return res.status(404).json({ error: "Resource type not found" });
      }
      
      logAudit(req, { category: 'CATALOG', action: 'RESOURCE_TYPE_UPDATED', targetType: 'resource_type', targetId: String(id), details: { changedFields: Object.keys(validated) } });
      res.json(type);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating resource type:", error);
      res.status(500).json({ error: "Failed to update resource type" });
    }
  });

  app.delete("/api/resource-types/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteResourceType(id);
      logAudit(req, { category: 'CATALOG', action: 'RESOURCE_TYPE_DELETED', targetType: 'resource_type', targetId: String(id) });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting resource type:", error);
      res.status(500).json({ error: "Failed to delete resource type" });
    }
  });

  // ===== Categories API =====
  app.get("/api/categories", async (req, res) => {
    try {
      const { active } = req.query;
      
      if (active === 'true') {
        const cats = await storage.getActiveCategories();
        return res.json(cats);
      }
      
      const cats = await storage.getAllCategories();
      res.json(cats);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getCategory(id);
      
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      res.json(category);
    } catch (error) {
      console.error("Error fetching category:", error);
      res.status(500).json({ error: "Failed to fetch category" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const validated = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validated);
      logAudit(req, { category: 'CATALOG', action: 'CATEGORY_CREATED', targetType: 'category', targetId: String(category.id), details: { name: validated.name } });
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating category:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertCategorySchema.partial().parse(req.body);
      
      const category = await storage.updateCategory(id, validated);
      
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      logAudit(req, { category: 'CATALOG', action: 'CATEGORY_UPDATED', targetType: 'category', targetId: String(id), details: { changedFields: Object.keys(validated) } });
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating category:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id);
      logAudit(req, { category: 'CATALOG', action: 'CATEGORY_DELETED', targetType: 'category', targetId: String(id) });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // ===== Z39.50 / ISBN Search API =====
  app.post("/api/z3950/search", async (req, res) => {
    try {
      const { isbn } = req.body;
      
      if (!isbn) {
        return res.status(400).json({ error: "ISBN is required" });
      }
      
      // Clean ISBN - remove hyphens and spaces
      const cleanIsbn = isbn.replace(/[-\s]/g, '');
      
      const results: any[] = [];
      
      // Try Open Library API first (free, no API key required)
      try {
        const openLibUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
        const openLibResponse = await fetch(openLibUrl);
        
        if (openLibResponse.ok) {
          const openLibData = await openLibResponse.json();
          const bookKey = `ISBN:${cleanIsbn}`;
          
          if (openLibData[bookKey]) {
            const book = openLibData[bookKey];
            results.push({
              id: `ol-${cleanIsbn}`,
              title: book.title || 'Unknown Title',
              author: book.authors?.map((a: any) => a.name).join(', ') || 'Unknown Author',
              isbn: isbn,
              publisher: book.publishers?.map((p: any) => p.name).join(', ') || 'Unknown Publisher',
              year: book.publish_date ? book.publish_date.match(/\d{4}/)?.[0] || '' : '',
              source: 'Open Library',
              category: book.subjects?.slice(0, 3).map((s: any) => s.name).join(', ') || 'General',
              cover: book.cover?.medium || book.cover?.small || null,
              numberOfPages: book.number_of_pages || null,
            });
          }
        }
      } catch (openLibError) {
        console.error("Open Library API error:", openLibError);
      }
      
      // Try Google Books API as fallback (also free for basic usage)
      if (results.length === 0) {
        try {
          const googleResponse = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`
          );
          
          if (googleResponse.ok) {
            const googleData = await googleResponse.json();
            
            if (googleData.items && googleData.items.length > 0) {
              const book = googleData.items[0].volumeInfo;
              results.push({
                id: `gb-${googleData.items[0].id}`,
                title: book.title || 'Unknown Title',
                author: book.authors?.join(', ') || 'Unknown Author',
                isbn: isbn,
                publisher: book.publisher || 'Unknown Publisher',
                year: book.publishedDate ? book.publishedDate.substring(0, 4) : '',
                source: 'Google Books',
                category: book.categories?.join(', ') || 'General',
                cover: book.imageLinks?.thumbnail || null,
                numberOfPages: book.pageCount || null,
                description: book.description || null,
              });
            }
          }
        } catch (googleError) {
          console.error("Google Books API error:", googleError);
        }
      }
      
      // If no results found from either API
      if (results.length === 0) {
        return res.json([]);
      }
      
      res.json(results);
    } catch (error) {
      console.error("Error performing ISBN search:", error);
      res.status(500).json({ error: "Failed to perform ISBN search" });
    }
  });

  // ===== Bulk Upload API =====
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }
  });

  app.get("/api/catalog/bulk-upload/template", async (req, res) => {
    try {
      const mode = req.query.mode as string || "search";
      const workbook = XLSX.utils.book_new();
      
      let headers: string[];
      let sampleData: any[];
      
      if (mode === "search") {
        headers = ["Resource Type", "ISBN", "Book Name (Optional)", "Copies", "Acquisition Date", "Acquisition Source"];
        sampleData = [
          ["Book", "978-0-13-468599-1", "The Pragmatic Programmer", 2, "2024-01-15", "Purchase"],
          ["Book", "978-0-596-51774-8", "JavaScript: The Good Parts", 1, "2024-01-15", "Donation"],
        ];
      } else {
        headers = ["Resource Type", "ISBN", "Title", "Author", "Publisher", "Published Year", "Category", "Format", "Copies", "Acquisition Date", "Acquisition Source", "Shelf Location", "Price"];
        sampleData = [
          ["Book", "978-0-13-468599-1", "The Pragmatic Programmer", "David Thomas, Andrew Hunt", "Addison-Wesley", 2019, "Computer Science", "PHYSICAL", 2, "2024-01-15", "Purchase", "CS-001-A", 4500],
          ["Book", "978-0-596-51774-8", "JavaScript: The Good Parts", "Douglas Crockford", "O'Reilly Media", 2008, "Programming", "PHYSICAL", 1, "2024-01-15", "Donation", "PR-002-B", 3200],
        ];
      }
      
      const worksheetData = [headers, ...sampleData];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      const colWidths = headers.map((h, i) => ({ wch: Math.max(h.length, 15) }));
      worksheet['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
      
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=bulk_upload_${mode}_template.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  app.post("/api/catalog/bulk-upload/preview", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const mode = req.body.mode as string || "search";
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (data.length < 2) {
        return res.status(400).json({ error: "File must contain at least one data row" });
      }
      
      const headers = data[0] as string[];
      const rows = data.slice(1);
      
      const result: any[] = [];
      let enriched = 0;
      let errors = 0;
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || !row[1]) continue;
        
        const isbn = String(row[1] || "").trim();
        if (!isbn) continue;
        
        let bookData: any = {
          rowId: i + 1,
          isbn,
          title: "",
          author: "",
          publisher: "",
          publishedYear: "",
          category: "General",
          resourceTypeId: null,
          format: "PHYSICAL",
          copies: parseInt(row[mode === "search" ? 3 : 8]) || 1,
          acquisitionDate: formatExcelDate(row[mode === "search" ? 4 : 9]),
          acquisitionSource: String(row[mode === "search" ? 5 : 10] || ""),
          shelfLocation: mode === "manual" ? String(row[11] || "") : "",
          price: mode === "manual" ? (parseInt(row[12]) || null) : null,
          status: "pending" as const,
        };
        
        if (mode === "manual") {
          bookData.title = String(row[2] || "");
          bookData.author = String(row[3] || "");
          bookData.publisher = String(row[4] || "");
          bookData.publishedYear = String(row[5] || "");
          bookData.category = String(row[6] || "General");
          bookData.format = String(row[7] || "PHYSICAL");
          bookData.status = bookData.title ? "enriched" : "pending";
          if (bookData.title) enriched++;
        } else {
          bookData.title = String(row[2] || "");
          
          try {
            const cleanIsbn = isbn.replace(/[-\s]/g, '');
            const openLibUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
            const openLibResponse = await fetch(openLibUrl);
            
            if (openLibResponse.ok) {
              const openLibData = await openLibResponse.json();
              const bookKey = `ISBN:${cleanIsbn}`;
              
              if (openLibData[bookKey]) {
                const book = openLibData[bookKey];
                bookData.title = book.title || bookData.title;
                bookData.author = book.authors?.map((a: any) => a.name).join(', ') || "";
                bookData.publisher = book.publishers?.map((p: any) => p.name).join(', ') || "";
                bookData.publishedYear = book.publish_date ? book.publish_date.match(/\d{4}/)?.[0] || "" : "";
                bookData.category = book.subjects?.slice(0, 3).map((s: any) => s.name).join(', ') || "General";
                bookData.coverUrl = book.cover?.medium || null;
                bookData.source = "Open Library";
                bookData.status = "enriched";
                enriched++;
              }
            }
            
            if (bookData.status !== "enriched") {
              const googleResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
              if (googleResponse.ok) {
                const googleData = await googleResponse.json();
                if (googleData.items && googleData.items.length > 0) {
                  const book = googleData.items[0].volumeInfo;
                  bookData.title = book.title || bookData.title;
                  bookData.author = book.authors?.join(', ') || "";
                  bookData.publisher = book.publisher || "";
                  bookData.publishedYear = book.publishedDate ? book.publishedDate.substring(0, 4) : "";
                  bookData.category = book.categories?.join(', ') || "General";
                  bookData.coverUrl = book.imageLinks?.thumbnail || null;
                  bookData.source = "Google Books";
                  bookData.status = "enriched";
                  enriched++;
                }
              }
            }
            
            if (bookData.status !== "enriched") {
              bookData.status = "error";
              bookData.errorMessage = "Could not find book details";
              errors++;
            }
          } catch (err) {
            bookData.status = "error";
            bookData.errorMessage = "API lookup failed";
            errors++;
          }
        }
        
        result.push(bookData);
      }
      
      res.json({
        rows: result,
        stats: {
          total: result.length,
          enriched,
          errors,
        },
        templateMode: mode,
      });
    } catch (error) {
      console.error("Error processing upload:", error);
      res.status(500).json({ error: "Failed to process uploaded file" });
    }
  });

  function formatExcelDate(value: any): string {
    if (!value) return new Date().toISOString().split('T')[0];
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    const dateStr = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    return new Date().toISOString().split('T')[0];
  }

  function generateSSN(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `SSN-${timestamp}-${random}`;
  }

  app.post("/api/catalog/bulk-upload/commit", async (req, res) => {
    try {
      const { rows, idempotencyKey } = req.body;
      
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "No rows to import" });
      }
      
      let createdBooks = 0;
      let createdCopies = 0;
      let skippedRows = 0;
      const errors: { rowId: number; message: string }[] = [];
      
      for (const row of rows) {
        try {
          if (!row.title || !row.isbn) {
            skippedRows++;
            errors.push({ rowId: row.rowId, message: "Missing title or ISBN" });
            continue;
          }
          
          const existingBooks = await storage.searchBooks(row.isbn);
          let bookId: number;
          
          if (existingBooks.length > 0) {
            bookId = existingBooks[0].id;
          } else {
            const newBook = await storage.createBook({
              isbn: row.isbn,
              title: row.title,
              author: row.author || "Unknown",
              publisher: row.publisher || null,
              publishedYear: row.publishedYear ? parseInt(row.publishedYear) : null,
              category: row.category || "General",
              resourceTypeId: row.resourceTypeId || null,
              format: row.format || "PHYSICAL",
              status: "AVAILABLE",
              coverUrl: row.coverUrl || null,
              shelfLocation: row.shelfLocation || null,
              marcRecord: null,
            });
            bookId = newBook.id;
            createdBooks++;
          }
          
          const copyCount = row.copies || 1;
          for (let c = 0; c < copyCount; c++) {
            const ssn = generateSSN();
            const barcode = `BC-${bookId}-${Date.now()}-${c}`;
            
            await storage.createBookCopy({
              bookId,
              libraryId: null,
              barcode,
              internalSSN: ssn,
              callNumber: null,
              shelfLocation: row.shelfLocation || null,
              status: "AVAILABLE",
              condition: "GOOD",
              acquisitionDate: row.acquisitionDate ? new Date(row.acquisitionDate) : new Date(),
              acquisitionSource: row.acquisitionSource || null,
              price: row.price || null,
              notes: `Bulk imported on ${new Date().toISOString().split('T')[0]}`,
            });
            createdCopies++;
          }
        } catch (err: any) {
          errors.push({ rowId: row.rowId, message: err.message || "Import failed" });
        }
      }
      
      logAudit(req, { category: 'CATALOG', action: 'BULK_UPLOAD', details: { createdBooks, createdCopies, skippedRows, errorCount: errors.length } });
      res.json({
        createdBooks,
        createdCopies,
        skippedRows,
        errors,
      });
    } catch (error) {
      console.error("Error committing bulk upload:", error);
      res.status(500).json({ error: "Failed to commit bulk upload" });
    }
  });

  // ===== SSO Authentication API =====
  app.get("/api/sso/callback", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        logAudit(req, { category: 'AUTHENTICATION', action: 'SSO_LOGIN_FAILED', status: 'FAILURE', details: { reason: 'Missing or invalid token' } });
        return res.redirect('/login?error=invalid_token');
      }

      const { 
        decodeToken, 
        verifyTokenSignature, 
        isTokenExpired, 
        mapERPUserToLibraryUser,
        generateSessionId,
        verifySecretKey,
        isOriginWhitelisted
      } = await import('./sso');
      
      const payload = decodeToken(token);
      if (!payload) {
        logAudit(req, { category: 'AUTHENTICATION', action: 'SSO_LOGIN_FAILED', status: 'FAILURE', details: { reason: 'Invalid token format' } });
        return res.redirect('/login?error=invalid_token');
      }

      if (isTokenExpired(payload.timestamp)) {
        logAudit(req, { category: 'AUTHENTICATION', action: 'SSO_LOGIN_FAILED', status: 'FAILURE', details: { reason: 'Token expired', appId: payload.appId } });
        return res.redirect('/login?error=token_expired');
      }

      const integration = await storage.getErpIntegrationByAppId(payload.appId);
      if (!integration) {
        logAudit(req, { category: 'AUTHENTICATION', action: 'SSO_LOGIN_FAILED', status: 'FAILURE', details: { reason: 'Unknown application ID', appId: payload.appId } });
        return res.redirect('/login?error=invalid_integration');
      }

      if (!integration.isActive) {
        logAudit(req, { category: 'AUTHENTICATION', action: 'SSO_LOGIN_FAILED', status: 'FAILURE', details: { reason: 'ERP integration disabled', appId: payload.appId } });
        return res.redirect('/login?error=integration_disabled');
      }

      const whitelist = await storage.getWhitelistByIntegration(integration.id);
      const origin = req.headers.origin;
      const referer = req.headers.referer;
      
      if (!isOriginWhitelisted(origin, referer, whitelist)) {
        logAudit(req, { category: 'AUTHENTICATION', action: 'SSO_LOGIN_FAILED', status: 'FAILURE', details: { reason: 'Origin not whitelisted', appId: payload.appId, origin, referer } });
        return res.redirect('/login?error=origin_blocked');
      }

      if (!verifyTokenSignature(payload, integration.secretKey)) {
        logAudit(req, { category: 'AUTHENTICATION', action: 'SSO_LOGIN_FAILED', status: 'FAILURE', details: { reason: 'Invalid token signature', appId: payload.appId } });
        return res.redirect('/login?error=auth_failed');
      }

      const mappingResult = mapERPUserToLibraryUser(payload);
      
      if (!mappingResult.success || !mappingResult.user) {
        logAudit(req, { category: 'AUTHENTICATION', action: 'SSO_LOGIN_FAILED', status: 'FAILURE', details: { reason: 'Role mapping failed', appId: payload.appId, error: mappingResult.error } });
        return res.redirect('/login?error=access_denied');
      }
      
      const mappedUser = mappingResult.user;
      
      let user = await storage.getUserByExternalId(mappedUser.externalId, integration.id);
      
      if (!user) {
        const orphanedUser = await storage.getUserByExternalIdOnly(mappedUser.externalId);
        if (orphanedUser) {
          await storage.updateUser(orphanedUser.id, { erpIntegrationId: integration.id });
          user = { ...orphanedUser, erpIntegrationId: integration.id };
        }
      }

      if (!user) {
        if (mappedUser.category === 'STAFF') {
          logAudit(req, { category: 'AUTHENTICATION', action: 'SSO_LOGIN_FAILED', status: 'FAILURE', details: { reason: 'Staff not provisioned', appId: payload.appId, externalId: mappedUser.externalId } });
          return res.redirect('/login?error=not_provisioned');
        }
        
        const username = `${mappedUser.externalId}_${integration.id}`;
        user = await storage.createUser({
          username,
          email: mappedUser.email,
          name: mappedUser.name,
          category: mappedUser.category,
          role: mappedUser.role,
          status: 'ACTIVE',
          department: mappedUser.department || null,
          employeeId: mappedUser.employeeId || null,
          studentId: mappedUser.studentId || null,
          externalId: mappedUser.externalId,
          erpIntegrationId: integration.id,
        });
      } else {
        if (user.status === 'INACTIVE') {
          logAudit(req, { category: 'AUTHENTICATION', action: 'SSO_LOGIN_FAILED', status: 'FAILURE', userId: user.id, userName: user.username, details: { reason: 'Inactive account', appId: payload.appId, category: user.category } });
          return res.redirect('/login?error=account_inactive');
        }
        
        // Update user info on login
        await storage.updateUser(user.id, {
          name: mappedUser.name,
          email: mappedUser.email,
          department: mappedUser.department || null,
        });
      }

      await storage.updateUserLastLogin(user.id);

      const sessionId = generateSessionId();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      await storage.createSession({
        id: sessionId,
        userId: user.id,
        erpIntegrationId: integration.id,
        expiresAt,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });

      res.cookie('session_id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      });

      logAudit(req, { category: 'AUTHENTICATION', action: 'SSO_LOGIN_SUCCESS', userId: user.id, userName: user.username, details: { appId: payload.appId, role: user.role, category: user.category } });

      res.redirect('/dashboard');
    } catch (error) {
      console.error("SSO callback error:", error);
      res.redirect('/login?error=sso_failed');
    }
  });

  app.get("/api/sso/session", async (req, res) => {
    try {
      const sessionId = req.cookies?.session_id;
      
      if (!sessionId) {
        return res.json({ authenticated: false });
      }

      const result = await storage.getSessionWithUser(sessionId);
      
      if (!result) {
        return res.json({ authenticated: false });
      }

      if (new Date(result.session.expiresAt) < new Date()) {
        await storage.deleteSession(sessionId);
        res.clearCookie('session_id');
        return res.json({ authenticated: false });
      }

      const { password, ...safeUser } = result.user;
      res.json({ 
        authenticated: true, 
        user: safeUser,
        sessionExpiresAt: result.session.expiresAt
      });
    } catch (error) {
      console.error("Session check error:", error);
      res.status(500).json({ error: "Failed to check session" });
    }
  });

  app.post("/api/sso/logout", async (req, res) => {
    try {
      const sessionId = req.cookies?.session_id;
      
      let logUserId: number | undefined;
      let logUserName: string | undefined;
      if (sessionId) {
        const sessionData = await storage.getSessionWithUser(sessionId);
        if (sessionData) {
          logUserId = sessionData.user.id;
          logUserName = sessionData.user.username;
        }
        await storage.deleteSession(sessionId);
        res.clearCookie('session_id');
      }

      logAudit(req, { category: 'AUTHENTICATION', action: 'LOGOUT', userId: logUserId, userName: logUserName, details: { method: 'SSO' } });
      res.json({ success: true });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // Get current authenticated user
  app.get("/api/auth/me", async (req, res) => {
    try {
      const sessionId = req.cookies?.session_id;
      
      if (!sessionId) {
        return res.status(401).json({ authenticated: false });
      }

      const result = await storage.getSessionWithUser(sessionId);
      
      if (!result || result.session.expiresAt < new Date()) {
        res.clearCookie('session_id');
        return res.status(401).json({ authenticated: false });
      }

      res.json({
        authenticated: true,
        user: {
          id: result.user.id,
          username: result.user.username,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          category: result.user.category,
          isLocalUser: !result.user.erpIntegrationId && !!result.user.password,
        },
      });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ error: "Failed to check authentication" });
    }
  });

  // Change password endpoint (only for local users)
  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const sessionId = req.cookies?.session_id;
      
      if (!sessionId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const result = await storage.getSessionWithUser(sessionId);
      
      if (!result || result.session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Session expired" });
      }

      const user = result.user;

      // Check if user is a local user (has password and no ERP integration)
      if (user.erpIntegrationId) {
        logAudit(req, { category: 'AUTHENTICATION', action: 'PASSWORD_CHANGE_FAILED', status: 'FAILURE', userId: user.id, userName: user.username, details: { reason: 'ERP user cannot change password locally' } });
        return res.status(403).json({ 
          error: "ERP users cannot change password here. Please use your organization's portal." 
        });
      }

      if (!user.password) {
        logAudit(req, { category: 'AUTHENTICATION', action: 'PASSWORD_CHANGE_FAILED', status: 'FAILURE', userId: user.id, userName: user.username, details: { reason: 'SSO-only account' } });
        return res.status(403).json({ 
          error: "This account uses SSO authentication." 
        });
      }

      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }

      // Verify current password
      const { verifyPassword, hashPassword } = await import('./sso');
      if (!verifyPassword(currentPassword, user.password)) {
        logAudit(req, { category: 'AUTHENTICATION', action: 'PASSWORD_CHANGE_FAILED', status: 'FAILURE', userId: user.id, userName: user.username, details: { reason: 'Incorrect current password' } });
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Update password
      const hashedNewPassword = hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedNewPassword });

      logAudit(req, { category: 'AUTHENTICATION', action: 'PASSWORD_CHANGED', userId: user.id, userName: user.username });
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        return res.status(400).json({ error: "Username or email is required" });
      }

      let user = await storage.getUserByUsername(identifier);
      if (!user) {
        user = await storage.getUserByEmail(identifier);
      }

      if (!user || !user.password) {
        return res.status(404).json({ error: "No account found with that username or email" });
      }

      if (user.status === "INACTIVE") {
        return res.status(403).json({ error: "This account has been deactivated" });
      }

      const hostConfig = await storage.getSystemConfig("smtp_host");
      const portConfig = await storage.getSystemConfig("smtp_port");
      const secureConfig = await storage.getSystemConfig("smtp_secure");
      const userConfig = await storage.getSystemConfig("smtp_user");
      const passConfig = await storage.getSystemConfig("smtp_pass");
      const fromConfig = await storage.getSystemConfig("smtp_from");

      if (!hostConfig || !userConfig || !passConfig) {
        return res.status(500).json({ error: "Email is not configured. Please contact the administrator." });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.update(passwordResetOtps)
        .set({ used: true })
        .where(and(eq(passwordResetOtps.userId, user.id), eq(passwordResetOtps.used, false)));

      await db.insert(passwordResetOtps).values({
        userId: user.id,
        otp,
        expiresAt,
      });

      const transporter = nodemailer.createTransport({
        host: hostConfig.value,
        port: parseInt(portConfig?.value || "587"),
        secure: secureConfig?.value === "true",
        auth: {
          user: userConfig.value,
          pass: passConfig.value,
        },
      });

      await transporter.sendMail({
        from: fromConfig?.value || userConfig.value,
        to: user.email,
        subject: "LibraTech - Password Reset OTP",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">LibraTech</h1>
              <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Library Management System</p>
            </div>
            <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
              <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
              <p style="color: #475569;">Hello <strong>${user.name}</strong>,</p>
              <p style="color: #475569;">We received a request to reset your password. Use the OTP below to proceed:</p>
              <div style="background: #f1f5f9; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af; font-family: 'Courier New', monospace;">${otp}</span>
              </div>
              <p style="color: #ef4444; font-size: 14px; font-weight: 500;">This OTP expires in 10 minutes.</p>
              <p style="color: #94a3b8; font-size: 13px;">If you did not request this reset, please ignore this email. Your password will remain unchanged.</p>
            </div>
            <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="margin: 0;">This is an automated email from LibraTech. Do not reply.</p>
            </div>
          </div>
        `,
      });

      const maskedEmail = user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3");

      await logAudit({
        userId: user.id,
        username: user.username,
        action: "Password reset OTP requested",
        category: "AUTHENTICATION",
        status: "SUCCESS",
        ipAddress: req.ip || "unknown",
        metadata: { email: maskedEmail },
      });

      res.json({ success: true, email: maskedEmail, message: `OTP sent to ${maskedEmail}` });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      if (error.code === "EAUTH" || error.code === "ESOCKET" || error.code === "ECONNECTION") {
        return res.status(500).json({ error: "Failed to send email. Please contact the administrator." });
      }
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { identifier, otp } = req.body;
      if (!identifier || !otp) {
        return res.status(400).json({ error: "Username/email and OTP are required" });
      }

      let user = await storage.getUserByUsername(identifier);
      if (!user) {
        user = await storage.getUserByEmail(identifier);
      }
      if (!user) {
        return res.status(404).json({ error: "No account found" });
      }

      const [resetRecord] = await db.select().from(passwordResetOtps)
        .where(and(
          eq(passwordResetOtps.userId, user.id),
          eq(passwordResetOtps.otp, otp),
          eq(passwordResetOtps.used, false),
          gt(passwordResetOtps.expiresAt, new Date())
        ));

      if (!resetRecord) {
        return res.status(400).json({ error: "Invalid or expired OTP. Please request a new one." });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');

      await db.update(passwordResetOtps)
        .set({ used: true })
        .where(eq(passwordResetOtps.id, resetRecord.id));

      res.json({ success: true, resetToken, userId: user.id });
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { identifier, resetToken, newPassword, confirmPassword } = req.body;

      if (!identifier || !resetToken || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: "All fields are required" });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: "Passwords do not match" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const hasLetters = /[a-zA-Z]/.test(newPassword);
      const hasNumbers = /[0-9]/.test(newPassword);
      if (!hasLetters || !hasNumbers) {
        return res.status(400).json({ error: "Password must contain both letters and numbers" });
      }

      let user = await storage.getUserByUsername(identifier);
      if (!user) {
        user = await storage.getUserByEmail(identifier);
      }
      if (!user) {
        return res.status(404).json({ error: "No account found" });
      }

      const { hashPassword } = await import('./sso');
      const hashedPassword = hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });

      await logAudit({
        userId: user.id,
        username: user.username,
        action: "Password reset completed via OTP",
        category: "AUTHENTICATION",
        status: "SUCCESS",
        ipAddress: req.ip || "unknown",
        metadata: {},
      });

      res.json({ success: true, message: "Password reset successfully. You can now log in with your new password." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const sessionId = req.cookies?.session_id;
      
      let logUserId: number | undefined;
      let logUserName: string | undefined;
      if (sessionId) {
        const sessionData = await storage.getSessionWithUser(sessionId);
        if (sessionData) {
          logUserId = sessionData.user.id;
          logUserName = sessionData.user.username;
        }
        await storage.deleteSession(sessionId);
        res.clearCookie('session_id');
      }

      logAudit(req, { category: 'AUTHENTICATION', action: 'LOGOUT', userId: logUserId, userName: logUserName, details: { method: 'LOCAL' } });
      res.json({ success: true });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // Local Authentication Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      // Check auth mode
      const authModeConfig = await storage.getSystemConfig("auth_mode");
      const authMode = authModeConfig?.value || "LOCAL";
      
      if (authMode === "ERP") {
        logAudit(req, { category: 'AUTHENTICATION', action: 'LOCAL_LOGIN_FAILED', status: 'FAILURE', details: { reason: 'Local login disabled (SSO-only mode)', username } });
        return res.status(403).json({ 
          error: "Local login is disabled. Please use SSO to sign in." 
        });
      }

      // Find user by username or email
      const user = await storage.getUserByUsername(username) || 
                   await storage.getUserByEmail(username);
      
      if (!user) {
        logAudit(req, { category: 'AUTHENTICATION', action: 'LOCAL_LOGIN_FAILED', status: 'FAILURE', details: { reason: 'User not found', username } });
        return res.status(401).json({ error: "Invalid username or password" });
      }

      if (!user.password) {
        logAudit(req, { category: 'AUTHENTICATION', action: 'LOCAL_LOGIN_FAILED', status: 'FAILURE', userId: user.id, userName: user.username, details: { reason: 'SSO-only account', username } });
        return res.status(401).json({ 
          error: "This account uses SSO authentication. Please sign in via your organization." 
        });
      }

      // Verify password
      const { verifyPassword } = await import('./sso');
      if (!verifyPassword(password, user.password)) {
        logAudit(req, { category: 'AUTHENTICATION', action: 'LOCAL_LOGIN_FAILED', status: 'FAILURE', userId: user.id, userName: user.username, details: { reason: 'Invalid password', username } });
        return res.status(401).json({ error: "Invalid username or password" });
      }

      if (user.status !== 'ACTIVE') {
        logAudit(req, { category: 'AUTHENTICATION', action: 'LOCAL_LOGIN_FAILED', status: 'FAILURE', userId: user.id, userName: user.username, details: { reason: 'Account inactive', username } });
        return res.status(403).json({ error: "Account is not active" });
      }

      // Create session
      const { generateSessionId } = await import('./sso');
      const sessionId = generateSessionId();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await storage.createSession({
        id: sessionId,
        userId: user.id,
        expiresAt,
      });
      
      await storage.updateUserLastLogin(user.id);

      res.cookie('session_id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      logAudit(req, { category: 'AUTHENTICATION', action: 'LOCAL_LOGIN_SUCCESS', userId: user.id, userName: user.username, details: { role: user.role, category: user.category } });

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          category: user.category,
          isLocalUser: !user.erpIntegrationId && !!user.password,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // ERP Library User Provisioning APIs
  // These endpoints allow ERP systems to pre-provision library staff users

  // Create a library staff user (Admin or Librarian)
  app.post("/api/erp/library-users", async (req, res) => {
    try {
      const { appId, externalId, name, email, role, department } = req.body;
      const secretKey = req.headers['x-secret-key'] as string;
      
      if (!appId || !externalId || !name || !email || !role) {
        return res.status(400).json({ 
          error: "Required fields: appId, externalId, name, email, role (LIBRARY_ADMIN or LIBRARIAN)" 
        });
      }

      if (!secretKey) {
        return res.status(401).json({ error: "X-Secret-Key header required" });
      }

      const normalizedRole = role.toUpperCase();
      if (normalizedRole !== 'LIBRARY_ADMIN' && normalizedRole !== 'LIBRARIAN') {
        return res.status(400).json({ 
          error: "Role must be LIBRARY_ADMIN or LIBRARIAN" 
        });
      }

      const integration = await storage.getErpIntegrationByAppId(appId);
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found with this App ID" });
      }

      const { verifySecretKey } = await import('./sso');
      
      if (!verifySecretKey(secretKey, integration.secretHash, integration.secretSalt)) {
        return res.status(401).json({ error: "Invalid secret key" });
      }

      // Check if user already exists
      let user = await storage.getUserByExternalId(externalId, integration.id);
      
      if (user) {
        // Update existing user
        await storage.updateUser(user.id, {
          name,
          email,
          role: normalizedRole === 'LIBRARY_ADMIN' ? 'ADMIN' : 'LIBRARIAN',
          department: department || null,
        });
        user = await storage.getUser(user.id);
        return res.json({ 
          message: "Library user updated successfully",
          user: {
            id: user!.id,
            externalId: user!.externalId,
            name: user!.name,
            email: user!.email,
            role: user!.role,
            category: user!.category,
            status: user!.status,
          }
        });
      }

      // Create new library staff user
      const username = `${externalId}_${integration.id}`;
      const libraryRole = normalizedRole === 'LIBRARY_ADMIN' ? 'ADMIN' : 'LIBRARIAN';
      
      const newUser = await storage.createUser({
        username,
        email,
        name,
        category: 'STAFF',
        role: libraryRole,
        status: 'ACTIVE',
        department: department || null,
        employeeId: externalId,
        studentId: null,
        externalId,
        erpIntegrationId: integration.id,
      });

      logAudit(req, { category: 'ERP_INTEGRATION', action: 'ERP_USER_PROVISIONED', targetType: 'user', targetId: String(newUser.id), details: { externalId, name, email, role: libraryRole, appId } });
      res.status(201).json({ 
        message: "Library user created successfully",
        user: {
          id: newUser.id,
          externalId: newUser.externalId,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          category: newUser.category,
          status: newUser.status,
        }
      });
    } catch (error) {
      logAudit(req, { category: 'ERP_INTEGRATION', action: 'ERP_USER_PROVISION_FAILED', status: 'FAILURE', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
      console.error("Library user creation error:", error);
      res.status(500).json({ error: "Failed to create library user" });
    }
  });

  // List library staff users for an ERP integration
  app.get("/api/erp/library-users", async (req, res) => {
    try {
      const appId = req.query.appId as string;
      const secretKey = req.headers['x-secret-key'] as string;
      
      if (!appId) {
        return res.status(400).json({ error: "appId query parameter required" });
      }

      if (!secretKey) {
        return res.status(401).json({ error: "X-Secret-Key header required" });
      }

      const integration = await storage.getErpIntegrationByAppId(appId);
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found with this App ID" });
      }

      const { verifySecretKey } = await import('./sso');
      
      if (!verifySecretKey(secretKey, integration.secretHash, integration.secretSalt)) {
        return res.status(401).json({ error: "Invalid secret key" });
      }

      const users = await storage.getUsersByErpIntegration(integration.id);
      const staffUsers = users.filter(u => u.category === 'STAFF');

      res.json({ 
        integrationId: integration.id,
        integrationName: integration.name,
        users: staffUsers.map(u => ({
          id: u.id,
          externalId: u.externalId,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          department: u.department,
          joinedDate: u.joinedDate,
        }))
      });
    } catch (error) {
      console.error("Library users list error:", error);
      res.status(500).json({ error: "Failed to list library users" });
    }
  });

  // Remove a library staff user
  app.delete("/api/erp/library-users/:externalId", async (req, res) => {
    try {
      const { externalId } = req.params;
      const appId = req.query.appId as string;
      const secretKey = req.headers['x-secret-key'] as string;
      
      if (!appId) {
        return res.status(400).json({ error: "appId query parameter required" });
      }

      if (!secretKey) {
        return res.status(401).json({ error: "X-Secret-Key header required" });
      }

      const integration = await storage.getErpIntegrationByAppId(appId);
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found with this App ID" });
      }

      const { verifySecretKey } = await import('./sso');
      
      if (!verifySecretKey(secretKey, integration.secretHash, integration.secretSalt)) {
        return res.status(401).json({ error: "Invalid secret key" });
      }

      const user = await storage.getUserByExternalId(externalId, integration.id);
      if (!user) {
        return res.status(404).json({ error: "Library user not found" });
      }

      if (user.category !== 'STAFF') {
        return res.status(400).json({ error: "Can only remove library staff users via this endpoint" });
      }

      // Soft delete - set status to INACTIVE
      await storage.updateUser(user.id, { status: 'INACTIVE' });

      logAudit(req, { category: 'ERP_INTEGRATION', action: 'ERP_USER_DEACTIVATED', targetType: 'user', targetId: String(user.id), details: { externalId, name: user.name, appId } });
      res.json({ 
        message: "Library user deactivated successfully",
        user: {
          id: user.id,
          externalId: user.externalId,
          name: user.name,
          status: 'INACTIVE',
        }
      });
    } catch (error) {
      console.error("Library user removal error:", error);
      res.status(500).json({ error: "Failed to remove library user" });
    }
  });

  app.patch("/api/erp/library-users/:externalId/status", async (req, res) => {
    try {
      const { externalId } = req.params;
      const appId = req.query.appId as string;
      const secretKey = req.headers['x-secret-key'] as string;
      const { status } = req.body;

      if (!appId) {
        return res.status(400).json({ error: "appId query parameter required" });
      }
      if (!secretKey) {
        return res.status(401).json({ error: "X-Secret-Key header required" });
      }
      if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
        return res.status(400).json({ error: "status must be 'ACTIVE' or 'INACTIVE'" });
      }

      const integration = await storage.getErpIntegrationByAppId(appId);
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found with this App ID" });
      }

      const { verifySecretKey } = await import('./sso');
      if (!verifySecretKey(secretKey, integration.secretHash, integration.secretSalt)) {
        return res.status(401).json({ error: "Invalid secret key" });
      }

      const user = await storage.getUserByExternalId(externalId, integration.id);
      if (!user) {
        return res.status(404).json({ error: "User not found with this external ID" });
      }

      if (user.status === status) {
        return res.json({
          message: `User is already ${status}`,
          user: { id: user.id, externalId: user.externalId, name: user.name, role: user.role, category: user.category, status: user.status },
        });
      }

      await storage.updateUser(user.id, { status });

      const action = status === 'INACTIVE' ? 'ERP_USER_DEACTIVATED' : 'ERP_USER_REACTIVATED';
      logAudit(req, { category: 'ERP_INTEGRATION', action, targetType: 'user', targetId: String(user.id), details: { externalId, name: user.name, role: user.role, category: user.category, previousStatus: user.status, newStatus: status, appId } });

      res.json({
        message: `User status updated to ${status}`,
        user: { id: user.id, externalId: user.externalId, name: user.name, role: user.role, category: user.category, status },
      });
    } catch (error) {
      console.error("User status update error:", error);
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  // ===== ERP Lookup API =====
  // Fetch student/faculty details from ERP on demand

  // Configure ERP authentication settings (requires admin session)
  app.put("/api/erp-integrations/:id/auth-config", async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const user = await storage.getUser(session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'LIBRARIAN')) {
        return res.status(403).json({ error: "Admin or Librarian access required" });
      }

      const id = parseInt(req.params.id);
      const { authLoginUrl, authClientSecret, authTokenTtlSeconds } = req.body;

      const integration = await storage.getErpIntegration(id);
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }

      const updateData: Record<string, any> = {};
      if (authLoginUrl !== undefined && authLoginUrl !== null) {
        updateData.authLoginUrl = authLoginUrl;
      }
      if (authClientSecret !== undefined && authClientSecret !== null && authClientSecret !== '') {
        updateData.authClientSecret = authClientSecret;
      }
      if (authTokenTtlSeconds !== undefined && authTokenTtlSeconds !== null) {
        updateData.authTokenTtlSeconds = authTokenTtlSeconds > 0 ? authTokenTtlSeconds : 3600;
      }

      const updated = await storage.updateErpIntegration(id, updateData);

      res.json({ 
        success: true, 
        message: "Authentication configuration updated",
        authLoginUrl: updated?.authLoginUrl,
        authTokenTtlSeconds: updated?.authTokenTtlSeconds,
        hasApiSecret: !!updated?.authClientSecret,
      });
    } catch (error) {
      console.error("Auth config update error:", error);
      res.status(500).json({ error: "Failed to update authentication configuration" });
    }
  });

  // Test ERP connection and authentication (requires admin session)
  app.post("/api/erp-integrations/:id/test-connection", async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const user = await storage.getUser(session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'LIBRARIAN')) {
        return res.status(403).json({ error: "Admin or Librarian access required" });
      }

      const id = parseInt(req.params.id);
      
      const { getERPClient } = await import('./erp-client');
      const client = await getERPClient(id);
      const result = await client.testConnection();

      res.json(result);
    } catch (error) {
      console.error("ERP connection test error:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Connection test failed" 
      });
    }
  });

  // Fetch user details from ERP (requires admin session)
  app.get("/api/erp-integrations/:id/lookup/:userType/:identifier", async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const user = await storage.getUser(session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'LIBRARIAN')) {
        return res.status(403).json({ error: "Admin or Librarian access required" });
      }

      const id = parseInt(req.params.id);
      const userType = req.params.userType.toUpperCase() as 'STUDENT' | 'FACULTY';
      const identifier = req.params.identifier;

      if (!['STUDENT', 'FACULTY'].includes(userType)) {
        return res.status(400).json({ error: "userType must be STUDENT or FACULTY" });
      }

      const { getERPClient } = await import('./erp-client');
      const client = await getERPClient(id);

      // Find configured endpoint for this user type
      const endpointType = userType === 'STUDENT' ? 'SINGLE_STUDENT' : 'LIBRARY_EMPLOYEES';
      const endpoints = await storage.getErpPullEndpointsByIntegration(id);
      const endpoint = endpoints.find(e => e.endpointType === endpointType && e.isActive);

      const userDetails = await client.fetchUserDetails(userType, identifier, endpoint);

      if (!userDetails) {
        return res.status(404).json({ error: `${userType} not found in ERP system` });
      }

      res.json({
        success: true,
        userType,
        identifier,
        details: userDetails,
      });
    } catch (error) {
      console.error("ERP user lookup error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to fetch user details from ERP" 
      });
    }
  });

  // Verify user exists in ERP (for circulation/fine verification - requires secret key)
  app.post("/api/erp/verify-user", async (req, res) => {
    try {
      const { appId, userType, identifier } = req.body;
      const secretKey = req.headers['x-secret-key'] as string;

      if (!appId || !userType || !identifier) {
        return res.status(400).json({ error: "Required fields: appId, userType, identifier" });
      }

      if (!secretKey) {
        return res.status(401).json({ error: "X-Secret-Key header required" });
      }

      const integration = await storage.getErpIntegrationByAppId(appId);
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }

      // Verify secret key
      const { verifySecretKey } = await import('./sso');
      if (!verifySecretKey(secretKey, integration.secretHash, integration.secretSalt)) {
        return res.status(401).json({ error: "Invalid secret key" });
      }

      const { ERPClient } = await import('./erp-client');
      const client = new ERPClient(integration);

      const type = userType.toUpperCase() as 'STUDENT' | 'FACULTY';
      const userDetails = await client.fetchUserDetails(type, identifier);

      if (!userDetails) {
        return res.json({ 
          verified: false, 
          message: `${userType} not found in ERP system`,
        });
      }

      res.json({
        verified: true,
        user: {
          registrationNumber: userDetails.registrationNumber,
          name: userDetails.name,
          email: userDetails.email,
          program: userDetails.programName,
          batch: userDetails.batchName,
          session: userDetails.session,
          department: userDetails.department,
          userType: userDetails.userType,
        },
      });
    } catch (error) {
      console.error("ERP user verification error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Verification failed" 
      });
    }
  });

  // ERP Catalog API: Get search attribute types and values
  app.get("/api/erp/catalog/search-attributes", async (req, res) => {
    try {
      const appId = req.query.appId as string;
      const secretKey = req.headers['x-secret-key'] as string;

      if (!appId) {
        return res.status(400).json({ error: "Query parameter 'appId' is required" });
      }
      if (!secretKey) {
        return res.status(401).json({ error: "X-Secret-Key header required" });
      }

      const integration = await storage.getErpIntegrationByAppId(appId);
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }

      const { verifySecretKey } = await import('./sso');
      if (!verifySecretKey(secretKey, integration.secretHash, integration.secretSalt)) {
        return res.status(401).json({ error: "Invalid secret key" });
      }

      const types = await storage.getActiveSearchAttributeTypes();
      const typesWithValues = await Promise.all(
        types.map(async (type) => {
          const values = await storage.getSearchAttributeValues(type.id);
          const activeValues = values.filter(v => v.isActive);
          return {
            id: type.id,
            name: type.name,
            description: type.description,
            values: activeValues.map(v => ({
              id: v.id,
              value: v.value,
            })),
          };
        })
      );

      res.json({
        searchAttributes: typesWithValues,
      });
    } catch (error) {
      console.error("ERP catalog search attributes error:", error);
      res.status(500).json({ error: "Failed to fetch search attributes" });
    }
  });

  // ERP Catalog API: Search books by attributes
  app.get("/api/erp/catalog/search", async (req, res) => {
    try {
      const appId = req.query.appId as string;
      const secretKey = req.headers['x-secret-key'] as string;

      if (!appId) {
        return res.status(400).json({ error: "Query parameter 'appId' is required" });
      }
      if (!secretKey) {
        return res.status(401).json({ error: "X-Secret-Key header required" });
      }

      const integration = await storage.getErpIntegrationByAppId(appId);
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }

      const { verifySecretKey } = await import('./sso');
      if (!verifySecretKey(secretKey, integration.secretHash, integration.secretSalt)) {
        return res.status(401).json({ error: "Invalid secret key" });
      }

      const attributeValueIds = req.query.attributeValueIds
        ? String(req.query.attributeValueIds).split(',').map(Number).filter(n => !isNaN(n))
        : [];
      const searchQuery = req.query.q as string | undefined;

      if (attributeValueIds.length === 0 && !searchQuery) {
        return res.status(400).json({
          error: "At least one search filter is required. Provide 'attributeValueIds' and/or 'q' (text search) query parameters.",
        });
      }

      const limitConfig = await storage.getSystemConfig("erp_catalog_limit");
      const maxResults = limitConfig ? parseInt(limitConfig.value, 10) : 50;

      const result = await storage.searchCatalogByAttributes({
        attributeValueIds,
        searchQuery,
        limit: maxResults,
      });

      if (result.limitExceeded) {
        return res.status(200).json({
          success: false,
          message: `Your search returned ${result.totalCount} results which exceeds the maximum of ${maxResults}. Please refine your search by selecting more specific filters.`,
          totalCount: result.totalCount,
          maxAllowed: maxResults,
          books: [],
        });
      }

      res.json({
        success: true,
        totalCount: result.totalCount,
        maxAllowed: maxResults,
        books: result.books.map(book => ({
          id: book.id,
          isbn: book.isbn,
          title: book.title,
          author: book.author,
          publisher: book.publisher,
          publishedYear: book.publishedYear,
          category: book.category,
          format: book.format,
          status: book.status,
          coverUrl: book.coverUrl,
          shelfLocation: book.shelfLocation,
        })),
      });
    } catch (error) {
      console.error("ERP catalog search error:", error);
      res.status(500).json({ error: "Failed to search catalog" });
    }
  });

  app.get("/api/erp/transactions", async (req, res) => {
    try {
      const appId = req.query.appId as string;
      const secretKey = req.headers['x-secret-key'] as string;
      const externalId = req.query.externalId as string;
      const status = req.query.status as string;

      if (!appId) {
        return res.status(400).json({ error: "appId query parameter is required" });
      }
      if (!secretKey) {
        return res.status(401).json({ error: "X-Secret-Key header is required" });
      }

      const integration = await storage.getErpIntegrationByAppId(appId);
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }
      if (!integration.isActive) {
        return res.status(403).json({ error: "ERP integration is disabled" });
      }

      const { verifySecretKey } = await import('./sso');
      if (!verifySecretKey(secretKey, integration.secretHash, integration.secretSalt)) {
        return res.status(401).json({ error: "Invalid secret key" });
      }

      let userFilter: number | undefined;
      if (externalId) {
        const user = await storage.getUserByExternalId(externalId, integration.id);
        if (!user) {
          return res.json({ success: true, transactions: [] });
        }
        userFilter = user.id;
      }

      const allCirculation = userFilter
        ? await storage.getCirculationByUser(userFilter)
        : await storage.getAllCirculation();

      let filtered = allCirculation;
      if (status) {
        const statuses = status.toUpperCase().split(",");
        filtered = filtered.filter(c => statuses.includes(c.status));
      }

      const allBooks = await storage.getAllBooks();
      const allUsers = await storage.getAllUsers();

      const transactions = filtered.map(c => {
        const book = allBooks.find(b => b.id === c.bookId);
        const user = allUsers.find(u => u.id === c.userId);
        return {
          transactionId: c.id,
          status: c.status,
          member: user ? {
            memberId: user.studentId || user.employeeId || user.externalId || String(user.id),
            name: user.name,
            email: user.email,
            role: user.role,
          } : null,
          book: book ? {
            bookId: book.id,
            isbn: book.isbn,
            title: book.title,
            author: book.author,
            publisher: book.publisher,
            category: book.category,
          } : null,
          issueDate: c.checkoutDate,
          dueDate: c.dueDate,
          returnDate: c.returnDate,
          fineAmount: c.fineAmount,
          fineStatus: c.fineStatus,
          renewalCount: c.renewalCount,
        };
      });

      res.json({
        success: true,
        totalCount: transactions.length,
        transactions,
      });
    } catch (error) {
      console.error("ERP transactions error:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // SSO Test Endpoints (for development/testing only)
  app.post("/api/sso/test/generate-token", async (req, res) => {
    try {
      const { appId, secretKey, userId, userType, role, name, email, department } = req.body;
      
      if (!appId || !secretKey || !userId || !userType || !name || !email) {
        return res.status(400).json({ 
          error: "Required fields: appId, secretKey, userId, userType, name, email" 
        });
      }

      const integration = await storage.getErpIntegrationByAppId(appId);
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found with this App ID" });
      }

      const { verifySecretKey, generateSSOToken } = await import('./sso');
      
      if (!verifySecretKey(secretKey, integration.secretHash, integration.secretSalt)) {
        return res.status(401).json({ error: "Invalid secret key" });
      }

      const token = generateSSOToken({
        appId,
        userId,
        userType,
        role,
        name,
        email,
        department
      }, secretKey);

      const callbackUrl = `${req.protocol}://${req.get('host')}/api/sso/callback?token=${token}`;

      res.json({ 
        token,
        callbackUrl,
        expiresIn: 300,
        instructions: {
          method: "GET (browser redirect)",
          url: callbackUrl,
          note: "The ERP redirects the user's browser to this URL. No headers needed — the server verifies the token signature using the stored shared secret."
        }
      });
    } catch (error) {
      console.error("Token generation error:", error);
      res.status(500).json({ error: "Failed to generate token" });
    }
  });

  app.post("/api/sso/test/simulate-login", async (req, res) => {
    try {
      const { appId, secretKey, userId, userType, role, name, email, department } = req.body;
      
      if (!appId || !secretKey || !userId || !userType || !name || !email) {
        return res.status(400).json({ 
          error: "Required fields: appId, secretKey, userId, userType, name, email" 
        });
      }

      const integration = await storage.getErpIntegrationByAppId(appId);
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found with this App ID" });
      }

      const { 
        verifySecretKey, 
        generateSSOToken, 
        decodeToken, 
        verifyTokenSignature,
        mapERPUserToLibraryUser,
        generateSessionId
      } = await import('./sso');
      
      if (!verifySecretKey(secretKey, integration.secretHash, integration.secretSalt)) {
        return res.status(401).json({ error: "Invalid secret key" });
      }

      const token = generateSSOToken({
        appId,
        userId,
        userType,
        role,
        name,
        email,
        department
      }, secretKey);

      const payload = decodeToken(token)!;
      const signatureValid = verifyTokenSignature(payload, secretKey);
      
      if (!signatureValid) {
        return res.status(500).json({ error: "Token signature verification failed" });
      }

      const mappingResult = mapERPUserToLibraryUser(payload);
      
      if (!mappingResult.success || !mappingResult.user) {
        return res.status(403).json({ 
          error: "Access denied", 
          details: mappingResult.error 
        });
      }
      
      const mappedUser = mappingResult.user;
      
      let user = await storage.getUserByExternalId(mappedUser.externalId, integration.id);
      let userCreated = false;
      let preProvisioningRequired = false;
      
      if (!user) {
        // Staff users (Library Admin, Librarian) must be pre-provisioned via API
        if (mappedUser.category === 'STAFF') {
          preProvisioningRequired = true;
        } else {
          // Patrons (Students, Faculty) can be auto-provisioned on first login
          const username = `${mappedUser.externalId}_${integration.id}`;
          user = await storage.createUser({
            username,
            email: mappedUser.email,
            name: mappedUser.name,
            category: mappedUser.category,
            role: mappedUser.role,
            status: 'ACTIVE',
            department: mappedUser.department || null,
            employeeId: mappedUser.employeeId || null,
            studentId: mappedUser.studentId || null,
            externalId: mappedUser.externalId,
            erpIntegrationId: integration.id,
          });
          userCreated = true;
        }
      } else if (mappedUser.category === 'STAFF' && user.status !== 'ACTIVE') {
        return res.status(403).json({ 
          error: "Access denied", 
          details: "Your library staff account has been deactivated."
        });
      }

      if (preProvisioningRequired) {
        return res.status(403).json({ 
          success: false,
          error: "Access denied - Pre-provisioning required",
          details: "Library staff users must be pre-provisioned via POST /api/erp/library-users before they can log in.",
          preProvisioningRequired: true,
          tokenDetails: {
            token,
            payload,
            signatureValid,
          },
          roleMapping: {
            erpUserType: payload.userType,
            erpRole: payload.role,
            libraryCategory: mappedUser.category,
            libraryRole: mappedUser.role,
          }
        });
      }

      await storage.updateUserLastLogin(user!.id);

      const sessionId = generateSessionId();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const session = await storage.createSession({
        id: sessionId,
        userId: user!.id,
        erpIntegrationId: integration.id,
        expiresAt,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });

      res.cookie('session_id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      });

      const { password, ...safeUser } = user!;
      
      res.json({
        success: true,
        userCreated,
        user: safeUser,
        session: {
          id: session.id,
          expiresAt: session.expiresAt
        },
        tokenDetails: {
          token,
          payload: {
            appId: payload.appId,
            userId: payload.userId,
            userType: payload.userType,
            role: payload.role,
            name: payload.name,
            email: payload.email,
            timestamp: payload.timestamp
          },
          signatureValid,
          mappedRole: mappedUser.role,
          mappedCategory: mappedUser.category
        }
      });
    } catch (error) {
      console.error("Simulate login error:", error);
      res.status(500).json({ error: "Simulation failed" });
    }
  });

  // ===== ERP Integration API =====
  app.get("/api/erp-integrations", async (req, res) => {
    try {
      const integrations = await storage.getAllErpIntegrations();
      const sanitized = integrations.map(({ secretKey, secretHash, secretSalt, authClientSecret, cachedAuthToken, ...rest }) => ({
        ...rest,
        hasApiSecret: !!authClientSecret,
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching ERP integrations:", error);
      res.status(500).json({ error: "Failed to fetch ERP integrations" });
    }
  });

  app.get("/api/erp-integrations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const integration = await storage.getErpIntegration(id);
      
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }
      
      const { secretKey: _sk2, secretHash, secretSalt, authClientSecret, cachedAuthToken, ...sanitized } = integration;
      res.json({
        ...sanitized,
        hasApiSecret: !!authClientSecret,
      });
    } catch (error) {
      console.error("Error fetching ERP integration:", error);
      res.status(500).json({ error: "Failed to fetch ERP integration" });
    }
  });

  app.post("/api/erp-integrations", async (req, res) => {
    try {
      const createSchema = z.object({
        name: z.string().min(1, "Name is required"),
        erpType: z.string().min(1, "ERP type is required"),
        connectionMode: z.enum(['HOST', 'CLIENT', 'BIDIRECTIONAL']).default('BIDIRECTIONAL'),
        outboundBaseUrl: z.string().url().optional().nullable(),
        description: z.string().optional().nullable(),
        isActive: z.boolean().default(true),
      });
      
      const validated = createSchema.parse(req.body);
      
      const appId = generateAppId();
      const secretKey = generateSecretKey();
      const salt = generateSalt();
      const secretHash = hashSecret(secretKey, salt);
      
      const integration = await storage.createErpIntegration({
        ...validated,
        appId,
        secretKey,
        secretHash,
        secretSalt: salt,
      });
      
      const { secretKey: _sk, secretHash: _, secretSalt: __, ...sanitized } = integration;
      
      res.status(201).json({
        ...sanitized,
        credentials: {
          appId,
          secretKey,
          note: "IMPORTANT: This is the only time the secret key will be displayed. Please save it securely."
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating ERP integration:", error);
      res.status(500).json({ error: "Failed to create ERP integration" });
    }
  });

  app.patch("/api/erp-integrations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        erpType: z.string().min(1).optional(),
        connectionMode: z.enum(['HOST', 'CLIENT', 'BIDIRECTIONAL']).optional(),
        outboundBaseUrl: z.string().url().optional().nullable(),
        description: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      });
      
      const validated = updateSchema.parse(req.body);
      const integration = await storage.updateErpIntegration(id, validated);
      
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }
      
      const { secretKey: _sk3, secretHash: _sh, secretSalt: _ss, ...sanitized } = integration;
      res.json(sanitized);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating ERP integration:", error);
      res.status(500).json({ error: "Failed to update ERP integration" });
    }
  });

  app.delete("/api/erp-integrations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const integration = await storage.getErpIntegration(id);
      
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }
      
      await storage.deleteErpIntegration(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting ERP integration:", error);
      res.status(500).json({ error: "Failed to delete ERP integration" });
    }
  });

  app.post("/api/erp-integrations/:id/rotate-secret", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const integration = await storage.getErpIntegration(id);
      
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }
      
      const newSecretKey = generateSecretKey();
      const newSalt = generateSalt();
      const newSecretHash = hashSecret(newSecretKey, newSalt);
      
      const updated = await storage.rotateErpSecret(id, newSecretKey, newSecretHash, newSalt);
      
      if (!updated) {
        return res.status(500).json({ error: "Failed to rotate secret" });
      }
      
      res.json({
        message: "Secret rotated successfully",
        credentials: {
          appId: updated.appId,
          secretKey: newSecretKey,
          rotatedAt: updated.secretLastRotatedAt,
          note: "IMPORTANT: This is the only time the new secret key will be displayed. Please save it securely."
        }
      });
    } catch (error) {
      console.error("Error rotating ERP secret:", error);
      res.status(500).json({ error: "Failed to rotate ERP secret" });
    }
  });

  // ===== ERP Whitelist API =====
  app.get("/api/erp-integrations/:id/whitelist", async (req, res) => {
    try {
      const integrationId = parseInt(req.params.id);
      const integration = await storage.getErpIntegration(integrationId);
      
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }
      
      const whitelist = await storage.getWhitelistByIntegration(integrationId);
      res.json(whitelist);
    } catch (error) {
      console.error("Error fetching ERP whitelist:", error);
      res.status(500).json({ error: "Failed to fetch whitelist" });
    }
  });

  app.post("/api/erp-integrations/:id/whitelist", async (req, res) => {
    try {
      const integrationId = parseInt(req.params.id);
      const integration = await storage.getErpIntegration(integrationId);
      
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }
      
      const count = await storage.countWhitelistByIntegration(integrationId);
      if (count >= MAX_WHITELIST_ENTRIES) {
        return res.status(400).json({ 
          error: `Maximum of ${MAX_WHITELIST_ENTRIES} URL patterns allowed per ERP integration` 
        });
      }
      
      const createSchema = z.object({
        urlPattern: z.string().min(1, "URL pattern is required"),
        description: z.string().optional().nullable(),
        isActive: z.boolean().default(true),
      });
      
      const validated = createSchema.parse(req.body);
      
      const whitelist = await storage.createErpWhitelist({
        ...validated,
        integrationId,
      });
      
      res.status(201).json(whitelist);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating whitelist entry:", error);
      res.status(500).json({ error: "Failed to create whitelist entry" });
    }
  });

  app.patch("/api/erp-integrations/:integrationId/whitelist/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const integrationId = parseInt(req.params.integrationId);
      
      const whitelist = await storage.getErpWhitelist(id);
      if (!whitelist || whitelist.integrationId !== integrationId) {
        return res.status(404).json({ error: "Whitelist entry not found" });
      }
      
      const updateSchema = z.object({
        urlPattern: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      });
      
      const validated = updateSchema.parse(req.body);
      const updated = await storage.updateErpWhitelist(id, validated);
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating whitelist entry:", error);
      res.status(500).json({ error: "Failed to update whitelist entry" });
    }
  });

  app.delete("/api/erp-integrations/:integrationId/whitelist/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const integrationId = parseInt(req.params.integrationId);
      
      const whitelist = await storage.getErpWhitelist(id);
      if (!whitelist || whitelist.integrationId !== integrationId) {
        return res.status(404).json({ error: "Whitelist entry not found" });
      }
      
      await storage.deleteErpWhitelist(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting whitelist entry:", error);
      res.status(500).json({ error: "Failed to delete whitelist entry" });
    }
  });

  // ===== ERP Pull Endpoints API =====
  app.get("/api/erp-integrations/:id/pull-endpoints", async (req, res) => {
    try {
      const integrationId = parseInt(req.params.id);
      const integration = await storage.getErpIntegration(integrationId);
      
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }
      
      const endpoints = await storage.getErpPullEndpointsByIntegration(integrationId);
      res.json(endpoints);
    } catch (error) {
      console.error("Error fetching ERP pull endpoints:", error);
      res.status(500).json({ error: "Failed to fetch pull endpoints" });
    }
  });

  app.get("/api/erp-integrations/:integrationId/pull-endpoints/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const integrationId = parseInt(req.params.integrationId);
      
      const endpoint = await storage.getErpPullEndpoint(id);
      if (!endpoint || endpoint.integrationId !== integrationId) {
        return res.status(404).json({ error: "Pull endpoint not found" });
      }
      
      res.json(endpoint);
    } catch (error) {
      console.error("Error fetching pull endpoint:", error);
      res.status(500).json({ error: "Failed to fetch pull endpoint" });
    }
  });

  app.post("/api/erp-integrations/:id/pull-endpoints", async (req, res) => {
    try {
      const integrationId = parseInt(req.params.id);
      const integration = await storage.getErpIntegration(integrationId);
      
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }
      
      const createSchema = z.object({
        name: z.string().min(1, "Name is required"),
        endpointType: z.enum(["ALL_STUDENTS", "SINGLE_STUDENT", "LIBRARY_EMPLOYEES", "PROGRAMS", "PROGRAM_DEPARTMENTS", "COURSES", "PROGRAM_COURSES"]),
        urlPath: z.string().min(1, "URL path is required"),
        httpMethod: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
        requestHeaders: z.record(z.any()).optional().nullable(),
        requestBodyTemplate: z.record(z.any()).optional().nullable(),
        pathParameters: z.record(z.any()).optional().nullable(),
        queryParameters: z.record(z.any()).optional().nullable(),
        responseRootPath: z.string().optional().nullable(),
        paginationConfig: z.record(z.any()).optional().nullable(),
        isActive: z.boolean().default(true),
        description: z.string().optional().nullable(),
      });
      
      const validated = createSchema.parse(req.body);
      
      const endpoint = await storage.createErpPullEndpoint({
        ...validated,
        integrationId,
      });
      
      res.status(201).json(endpoint);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating pull endpoint:", error);
      res.status(500).json({ error: "Failed to create pull endpoint" });
    }
  });

  app.patch("/api/erp-integrations/:integrationId/pull-endpoints/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const integrationId = parseInt(req.params.integrationId);
      
      const endpoint = await storage.getErpPullEndpoint(id);
      if (!endpoint || endpoint.integrationId !== integrationId) {
        return res.status(404).json({ error: "Pull endpoint not found" });
      }
      
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        endpointType: z.enum(["ALL_STUDENTS", "SINGLE_STUDENT", "LIBRARY_EMPLOYEES", "PROGRAMS", "PROGRAM_DEPARTMENTS", "COURSES", "PROGRAM_COURSES"]).optional(),
        urlPath: z.string().min(1).optional(),
        httpMethod: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
        requestHeaders: z.record(z.any()).optional().nullable(),
        requestBodyTemplate: z.record(z.any()).optional().nullable(),
        pathParameters: z.record(z.any()).optional().nullable(),
        queryParameters: z.record(z.any()).optional().nullable(),
        responseRootPath: z.string().optional().nullable(),
        paginationConfig: z.record(z.any()).optional().nullable(),
        isActive: z.boolean().optional(),
        description: z.string().optional().nullable(),
      });
      
      const validated = updateSchema.parse(req.body);
      const updated = await storage.updateErpPullEndpoint(id, validated);
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating pull endpoint:", error);
      res.status(500).json({ error: "Failed to update pull endpoint" });
    }
  });

  app.delete("/api/erp-integrations/:integrationId/pull-endpoints/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const integrationId = parseInt(req.params.integrationId);
      
      const endpoint = await storage.getErpPullEndpoint(id);
      if (!endpoint || endpoint.integrationId !== integrationId) {
        return res.status(404).json({ error: "Pull endpoint not found" });
      }
      
      // Delete associated field mappings first
      await storage.deleteErpFieldMappingsByEndpoint(id);
      await storage.deleteErpPullEndpoint(id);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting pull endpoint:", error);
      res.status(500).json({ error: "Failed to delete pull endpoint" });
    }
  });

  // ===== ERP Field Mappings API =====
  app.get("/api/erp-pull-endpoints/:id/field-mappings", async (req, res) => {
    try {
      const endpointId = parseInt(req.params.id);
      const endpoint = await storage.getErpPullEndpoint(endpointId);
      
      if (!endpoint) {
        return res.status(404).json({ error: "Pull endpoint not found" });
      }
      
      const mappings = await storage.getErpFieldMappingsByEndpoint(endpointId);
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching field mappings:", error);
      res.status(500).json({ error: "Failed to fetch field mappings" });
    }
  });

  app.post("/api/erp-pull-endpoints/:id/field-mappings", async (req, res) => {
    try {
      const endpointId = parseInt(req.params.id);
      const endpoint = await storage.getErpPullEndpoint(endpointId);
      
      if (!endpoint) {
        return res.status(404).json({ error: "Pull endpoint not found" });
      }
      
      const createSchema = z.object({
        sourceField: z.string().min(1, "Source field is required"),
        targetField: z.string().min(1, "Target field is required"),
        targetTable: z.string().min(1, "Target table is required"),
        transformationType: z.string().optional().nullable(),
        transformationConfig: z.record(z.any()).optional().nullable(),
        isRequired: z.boolean().default(false),
        defaultValue: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        sortOrder: z.number().int().default(0),
      });
      
      const validated = createSchema.parse(req.body);
      
      const mapping = await storage.createErpFieldMapping({
        ...validated,
        endpointId,
      });
      
      res.status(201).json(mapping);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating field mapping:", error);
      res.status(500).json({ error: "Failed to create field mapping" });
    }
  });

  app.post("/api/erp-pull-endpoints/:id/field-mappings/bulk", async (req, res) => {
    try {
      const endpointId = parseInt(req.params.id);
      const endpoint = await storage.getErpPullEndpoint(endpointId);
      
      if (!endpoint) {
        return res.status(404).json({ error: "Pull endpoint not found" });
      }
      
      const bulkSchema = z.object({
        mappings: z.array(z.object({
          sourceField: z.string().min(1),
          targetField: z.string().min(1),
          targetTable: z.string().min(1),
          transformationType: z.string().optional().nullable(),
          transformationConfig: z.record(z.any()).optional().nullable(),
          isRequired: z.boolean().default(false),
          defaultValue: z.string().optional().nullable(),
          description: z.string().optional().nullable(),
          sortOrder: z.number().int().default(0),
        })),
        replaceExisting: z.boolean().default(true),
      });
      
      const validated = bulkSchema.parse(req.body);
      
      // Delete existing mappings if replacing
      if (validated.replaceExisting) {
        await storage.deleteErpFieldMappingsByEndpoint(endpointId);
      }
      
      // Create new mappings
      const createdMappings = [];
      for (let i = 0; i < validated.mappings.length; i++) {
        const mapping = await storage.createErpFieldMapping({
          ...validated.mappings[i],
          endpointId,
          sortOrder: validated.mappings[i].sortOrder ?? i,
        });
        createdMappings.push(mapping);
      }
      
      res.status(201).json(createdMappings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error bulk creating field mappings:", error);
      res.status(500).json({ error: "Failed to bulk create field mappings" });
    }
  });

  app.patch("/api/erp-pull-endpoints/:endpointId/field-mappings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const endpointId = parseInt(req.params.endpointId);
      
      const mapping = await storage.getErpFieldMapping(id);
      if (!mapping || mapping.endpointId !== endpointId) {
        return res.status(404).json({ error: "Field mapping not found" });
      }
      
      const updateSchema = z.object({
        sourceField: z.string().min(1).optional(),
        targetField: z.string().min(1).optional(),
        targetTable: z.string().min(1).optional(),
        transformationType: z.string().optional().nullable(),
        transformationConfig: z.record(z.any()).optional().nullable(),
        isRequired: z.boolean().optional(),
        defaultValue: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        sortOrder: z.number().int().optional(),
      });
      
      const validated = updateSchema.parse(req.body);
      const updated = await storage.updateErpFieldMapping(id, validated);
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating field mapping:", error);
      res.status(500).json({ error: "Failed to update field mapping" });
    }
  });

  app.delete("/api/erp-pull-endpoints/:endpointId/field-mappings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const endpointId = parseInt(req.params.endpointId);
      
      const mapping = await storage.getErpFieldMapping(id);
      if (!mapping || mapping.endpointId !== endpointId) {
        return res.status(404).json({ error: "Field mapping not found" });
      }
      
      await storage.deleteErpFieldMapping(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting field mapping:", error);
      res.status(500).json({ error: "Failed to delete field mapping" });
    }
  });

  // ===== ERP Endpoint Testing API (Sandbox) =====
  app.post("/api/erp-pull-endpoints/:id/test", async (req, res) => {
    try {
      const endpointId = parseInt(req.params.id);
      const endpoint = await storage.getErpPullEndpoint(endpointId);
      
      if (!endpoint) {
        return res.status(404).json({ error: "Pull endpoint not found" });
      }
      
      const integration = await storage.getErpIntegration(endpoint.integrationId);
      if (!integration) {
        return res.status(404).json({ error: "ERP integration not found" });
      }
      
      // Build the full URL from base URL + path
      const baseUrl = integration.outboundBaseUrl || '';
      const fullUrl = baseUrl + endpoint.urlPath;
      
      // Check if endpoint URL is in whitelist
      const whitelist = await storage.getWhitelistByIntegration(integration.id);
      const isWhitelisted = whitelist.some(entry => {
        if (!entry.isActive) return false;
        const pattern = entry.urlPattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(fullUrl);
      });
      
      if (!isWhitelisted) {
        const logEntry = await storage.createErpTestLog({
          endpointId,
          requestUrl: fullUrl,
          requestMethod: endpoint.httpMethod,
          requestHeaders: endpoint.requestHeaders as Record<string, unknown> | null,
          requestBody: endpoint.requestBodyTemplate as Record<string, unknown> | null,
          responseStatus: 403,
          responseBody: { error: "URL not in whitelist" },
          status: "FAILED",
          errorMessage: "Endpoint URL is not whitelisted for this integration",
          responseTimeMs: 0,
        });
        
        await storage.updateErpPullEndpointTestStatus(endpointId, "FAILED");
        
        return res.status(200).json({
          success: false,
          error: "Endpoint URL is not whitelisted for this integration",
          log: logEntry,
        });
      }
      
      const startTime = Date.now();
      
      try {
        // Build request headers
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'X-App-Id': integration.appId,
          ...(endpoint.requestHeaders as Record<string, string> || {}),
        };
        
        // Build request body if needed
        const bodyTemplate = endpoint.requestBodyTemplate as Record<string, unknown> | null;
        const requestBody = bodyTemplate ? JSON.stringify(bodyTemplate) : undefined;
        
        // Make the actual HTTP request
        const fetchOptions: RequestInit = {
          method: endpoint.httpMethod,
          headers,
          ...(endpoint.httpMethod !== 'GET' && requestBody ? { body: requestBody } : {}),
        };
        
        const response = await fetch(fullUrl, fetchOptions);
        const responseTimeMs = Date.now() - startTime;
        
        let responseBody: string;
        try {
          responseBody = await response.text();
        } catch {
          responseBody = '';
        }
        
        const isSuccess = response.ok;
        const testStatus = isSuccess ? "SUCCESS" : "FAILED";
        
        // Parse response for storage
        let parsedResponseBody: Record<string, unknown> | null = null;
        try {
          parsedResponseBody = JSON.parse(responseBody);
        } catch {
          parsedResponseBody = { raw: responseBody.substring(0, 10000) };
        }
        
        // Log the test
        const logEntry = await storage.createErpTestLog({
          endpointId,
          requestUrl: fullUrl,
          requestMethod: endpoint.httpMethod,
          requestHeaders: headers as Record<string, unknown>,
          requestBody: bodyTemplate,
          responseStatus: response.status,
          responseHeaders: Object.fromEntries(response.headers.entries()) as Record<string, unknown>,
          responseBody: parsedResponseBody,
          status: testStatus,
          errorMessage: isSuccess ? null : `HTTP ${response.status}: ${response.statusText}`,
          responseTimeMs,
        });
        
        // Update endpoint test status
        await storage.updateErpPullEndpointTestStatus(endpointId, testStatus);
        
        res.json({
          success: isSuccess,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: parsedResponseBody || responseBody.substring(0, 5000),
          responseTimeMs,
          log: logEntry,
        });
      } catch (fetchError) {
        const responseTimeMs = Date.now() - startTime;
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        
        const logEntry = await storage.createErpTestLog({
          endpointId,
          requestUrl: fullUrl,
          requestMethod: endpoint.httpMethod,
          requestHeaders: endpoint.requestHeaders as Record<string, unknown> | null,
          requestBody: endpoint.requestBodyTemplate as Record<string, unknown> | null,
          responseStatus: 0,
          status: "ERROR",
          errorMessage,
          responseTimeMs,
        });
        
        await storage.updateErpPullEndpointTestStatus(endpointId, "ERROR");
        
        res.json({
          success: false,
          error: errorMessage,
          responseTimeMs,
          log: logEntry,
        });
      }
    } catch (error) {
      console.error("Error testing pull endpoint:", error);
      res.status(500).json({ error: "Failed to test pull endpoint" });
    }
  });

  app.get("/api/erp-pull-endpoints/:id/test-logs", async (req, res) => {
    try {
      const endpointId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 20;
      
      const endpoint = await storage.getErpPullEndpoint(endpointId);
      if (!endpoint) {
        return res.status(404).json({ error: "Pull endpoint not found" });
      }
      
      const logs = await storage.getErpTestLogsByEndpoint(endpointId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching test logs:", error);
      res.status(500).json({ error: "Failed to fetch test logs" });
    }
  });

  // ===== Organizational Units API =====
  app.get("/api/org-units", async (req, res) => {
    try {
      const { parentId, type } = req.query;
      
      if (type && typeof type === 'string') {
        const units = await storage.getOrgUnitsByType(type);
        return res.json(units);
      }
      
      if (parentId !== undefined) {
        const pid = parentId === 'null' ? null : parseInt(parentId as string);
        const units = await storage.getOrgUnitsByParent(pid);
        return res.json(units);
      }
      
      const units = await storage.getAllOrgUnits();
      res.json(units);
    } catch (error) {
      console.error("Error fetching org units:", error);
      res.status(500).json({ error: "Failed to fetch organizational units" });
    }
  });

  app.get("/api/org-units/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const unit = await storage.getOrgUnit(id);
      
      if (!unit) {
        return res.status(404).json({ error: "Organizational unit not found" });
      }
      
      res.json(unit);
    } catch (error) {
      console.error("Error fetching org unit:", error);
      res.status(500).json({ error: "Failed to fetch organizational unit" });
    }
  });

  app.post("/api/org-units", async (req, res) => {
    try {
      const validated = insertOrgUnitSchema.parse(req.body);
      
      const existing = await storage.getOrgUnitByCode(validated.code);
      if (existing) {
        return res.status(400).json({ error: "An organizational unit with this code already exists" });
      }
      
      const unit = await storage.createOrgUnit(validated);
      logAudit(req, { category: 'SYSTEM_CONFIG', action: 'ORG_UNIT_CREATED', targetType: 'org_unit', targetId: String(unit.id), details: { name: validated.name, code: validated.code } });
      res.status(201).json(unit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating org unit:", error);
      res.status(500).json({ error: "Failed to create organizational unit" });
    }
  });

  app.patch("/api/org-units/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertOrgUnitSchema.partial().parse(req.body);
      
      const unit = await storage.updateOrgUnit(id, validated);
      
      if (!unit) {
        return res.status(404).json({ error: "Organizational unit not found" });
      }
      
      logAudit(req, { category: 'SYSTEM_CONFIG', action: 'ORG_UNIT_UPDATED', targetType: 'org_unit', targetId: String(id), details: { changedFields: Object.keys(validated) } });
      res.json(unit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating org unit:", error);
      res.status(500).json({ error: "Failed to update organizational unit" });
    }
  });

  app.delete("/api/org-units/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const unit = await storage.getOrgUnit(id);
      
      if (!unit) {
        return res.status(404).json({ error: "Organizational unit not found" });
      }
      
      const children = await storage.getOrgUnitsByParent(id);
      if (children.length > 0) {
        return res.status(400).json({ error: "Cannot delete organizational unit with child units" });
      }
      
      const libs = await storage.getLibrariesByOrgUnit(id);
      if (libs.length > 0) {
        return res.status(400).json({ error: "Cannot delete organizational unit with associated libraries" });
      }
      
      await storage.deleteOrgUnit(id);
      logAudit(req, { category: 'SYSTEM_CONFIG', action: 'ORG_UNIT_DELETED', targetType: 'org_unit', targetId: String(id) });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting org unit:", error);
      res.status(500).json({ error: "Failed to delete organizational unit" });
    }
  });

  // ===== Libraries API =====
  app.get("/api/libraries", async (req, res) => {
    try {
      const { orgUnitId, active } = req.query;
      
      if (active === 'true') {
        const libs = await storage.getActiveLibraries();
        return res.json(libs);
      }
      
      if (orgUnitId) {
        const libs = await storage.getLibrariesByOrgUnit(parseInt(orgUnitId as string));
        return res.json(libs);
      }
      
      const libs = await storage.getAllLibraries();
      res.json(libs);
    } catch (error) {
      console.error("Error fetching libraries:", error);
      res.status(500).json({ error: "Failed to fetch libraries" });
    }
  });

  app.get("/api/libraries/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const library = await storage.getLibrary(id);
      
      if (!library) {
        return res.status(404).json({ error: "Library not found" });
      }
      
      res.json(library);
    } catch (error) {
      console.error("Error fetching library:", error);
      res.status(500).json({ error: "Failed to fetch library" });
    }
  });

  app.get("/api/libraries/:id/dashboard", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid library ID" });
      }
      const dashboard = await storage.getLibraryDashboard(id);
      res.json(dashboard);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching library dashboard:", error);
      res.status(500).json({ error: "Failed to fetch library dashboard" });
    }
  });

  app.get("/api/libraries/:id/staff", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid library ID" });
      }
      const staff = await storage.getLibraryStaff(id);
      res.json(staff);
    } catch (error) {
      console.error("Error fetching library staff:", error);
      res.status(500).json({ error: "Failed to fetch library staff" });
    }
  });

  app.get("/api/libraries/:id/resources", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid library ID" });
      }
      
      const { query, format, category, status, limit, offset } = req.query;
      
      const result = await storage.getLibraryResources({
        libraryId: id,
        query: query as string | undefined,
        format: format as string | undefined,
        category: category as string | undefined,
        status: status as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching library resources:", error);
      res.status(500).json({ error: "Failed to fetch library resources" });
    }
  });

  app.post("/api/libraries", async (req, res) => {
    try {
      const validated = insertLibrarySchema.parse(req.body);
      
      const existing = await storage.getLibraryByCode(validated.code);
      if (existing) {
        return res.status(400).json({ error: "A library with this code already exists" });
      }
      
      const library = await storage.createLibrary(validated);
      logAudit(req, { category: 'SYSTEM_CONFIG', action: 'LIBRARY_CREATED', targetType: 'library', targetId: String(library.id), details: { name: validated.name, code: validated.code } });
      res.status(201).json(library);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating library:", error);
      res.status(500).json({ error: "Failed to create library" });
    }
  });

  app.patch("/api/libraries/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertLibrarySchema.partial().parse(req.body);
      
      const library = await storage.updateLibrary(id, validated);
      
      if (!library) {
        return res.status(404).json({ error: "Library not found" });
      }
      
      logAudit(req, { category: 'SYSTEM_CONFIG', action: 'LIBRARY_UPDATED', targetType: 'library', targetId: String(id), details: { changedFields: Object.keys(validated) } });
      res.json(library);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating library:", error);
      res.status(500).json({ error: "Failed to update library" });
    }
  });

  app.delete("/api/libraries/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const library = await storage.getLibrary(id);
      
      if (!library) {
        return res.status(404).json({ error: "Library not found" });
      }
      
      const copies = await storage.getBookCopiesByLibrary(id);
      if (copies.length > 0) {
        return res.status(400).json({ error: "Cannot delete library with book copies. Transfer or remove copies first." });
      }
      
      await storage.deleteLibrary(id);
      logAudit(req, { category: 'SYSTEM_CONFIG', action: 'LIBRARY_DELETED', targetType: 'library', targetId: String(id) });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting library:", error);
      res.status(500).json({ error: "Failed to delete library" });
    }
  });

  // ===== Book Copies API =====
  app.get("/api/book-copies", async (req, res) => {
    try {
      const { bookId, libraryId } = req.query;
      
      // Support filtering by both bookId AND libraryId together
      if (bookId && libraryId) {
        const copies = await storage.getBookCopiesByBookAndLibrary(
          parseInt(bookId as string),
          parseInt(libraryId as string)
        );
        return res.json(copies);
      }
      
      if (bookId) {
        const copies = await storage.getBookCopiesByBook(parseInt(bookId as string));
        return res.json(copies);
      }
      
      if (libraryId) {
        const copies = await storage.getBookCopiesByLibrary(parseInt(libraryId as string));
        return res.json(copies);
      }
      
      // Return all copies for inventory audit purposes
      const copies = await storage.getAllBookCopies();
      res.json(copies);
    } catch (error) {
      console.error("Error fetching book copies:", error);
      res.status(500).json({ error: "Failed to fetch book copies" });
    }
  });

  app.get("/api/book-copies/:id/circulation-history", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const copy = await storage.getBookCopy(id);
      
      if (!copy) {
        return res.status(404).json({ error: "Book copy not found" });
      }
      
      const history = await storage.getCirculationHistoryByCopy(id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching circulation history:", error);
      res.status(500).json({ error: "Failed to fetch circulation history" });
    }
  });

  app.get("/api/book-copies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const copy = await storage.getBookCopy(id);
      
      if (!copy) {
        return res.status(404).json({ error: "Book copy not found" });
      }
      
      res.json(copy);
    } catch (error) {
      console.error("Error fetching book copy:", error);
      res.status(500).json({ error: "Failed to fetch book copy" });
    }
  });

  app.get("/api/book-copies/barcode/:barcode", async (req, res) => {
    try {
      const copy = await storage.getBookCopyByBarcode(req.params.barcode);
      
      if (!copy) {
        return res.status(404).json({ error: "Book copy not found" });
      }
      
      res.json(copy);
    } catch (error) {
      console.error("Error fetching book copy by barcode:", error);
      res.status(500).json({ error: "Failed to fetch book copy" });
    }
  });

  app.post("/api/book-copies", async (req, res) => {
    try {
      const validated = insertBookCopySchema.parse(req.body);
      
      const existingBarcode = await storage.getBookCopyByBarcode(validated.barcode);
      if (existingBarcode) {
        return res.status(400).json({ error: "A book copy with this barcode already exists" });
      }
      
      const book = await storage.getBook(validated.bookId);
      if (!book) {
        return res.status(400).json({ error: "Book not found" });
      }
      
      if (validated.libraryId) {
        const library = await storage.getLibrary(validated.libraryId);
        if (!library) {
          return res.status(400).json({ error: "Library not found" });
        }
      }
      
      const copy = await storage.createBookCopy(validated);
      res.status(201).json(copy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating book copy:", error);
      res.status(500).json({ error: "Failed to create book copy" });
    }
  });

  app.patch("/api/book-copies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertBookCopySchema.partial().parse(req.body);
      
      // Check status transition rules if status is being updated
      if (validated.status) {
        const existingCopy = await storage.getBookCopy(id);
        if (!existingCopy) {
          return res.status(404).json({ error: "Book copy not found" });
        }
        
        // DAMAGED and LOST are final statuses - cannot transition out of them
        const finalStatuses = ['DAMAGED', 'LOST'];
        if (finalStatuses.includes(existingCopy.status) && existingCopy.status !== validated.status) {
          return res.status(400).json({ 
            error: `Cannot change status from ${existingCopy.status}. This is a final status in the book lifecycle.` 
          });
        }
      }
      
      const copy = await storage.updateBookCopy(id, validated);
      
      if (!copy) {
        return res.status(404).json({ error: "Book copy not found" });
      }
      
      res.json(copy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating book copy:", error);
      res.status(500).json({ error: "Failed to update book copy" });
    }
  });

  app.delete("/api/book-copies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const copy = await storage.getBookCopy(id);
      
      if (!copy) {
        return res.status(404).json({ error: "Book copy not found" });
      }
      
      if (copy.status === 'CHECKED_OUT') {
        return res.status(400).json({ error: "Cannot delete a checked out book copy" });
      }
      
      await storage.deleteBookCopy(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting book copy:", error);
      res.status(500).json({ error: "Failed to delete book copy" });
    }
  });

  // ===== Resource Allocations API =====
  app.get("/api/allocations/unallocated", async (req, res) => {
    try {
      const unallocatedCopies = await storage.getUnallocatedCopiesWithBookInfo();
      res.json(unallocatedCopies);
    } catch (error) {
      console.error("Error fetching unallocated copies:", error);
      res.status(500).json({ error: "Failed to fetch unallocated copies" });
    }
  });

  app.post("/api/allocations/allocate", async (req, res) => {
    try {
      const { copyIds, libraryId, generateSSN, ssnPrefix } = req.body;
      
      if (!Array.isArray(copyIds) || copyIds.length === 0) {
        return res.status(400).json({ error: "copyIds must be a non-empty array of copy IDs" });
      }
      
      if (!libraryId || typeof libraryId !== 'number') {
        return res.status(400).json({ error: "libraryId is required and must be a number" });
      }
      
      const library = await storage.getLibrary(libraryId);
      if (!library) {
        return res.status(404).json({ error: "Library not found" });
      }
      
      for (const copyId of copyIds) {
        const copy = await storage.getBookCopy(copyId);
        if (!copy) {
          return res.status(400).json({ error: `Book copy with ID ${copyId} not found` });
        }
        if (copy.libraryId !== null) {
          return res.status(400).json({ error: `Book copy ${copy.barcode} is already allocated to a library` });
        }
      }
      
      const allocatedCopies = await storage.allocateCopies(
        copyIds,
        libraryId,
        generateSSN === true,
        ssnPrefix
      );
      
      logAudit(req, { category: 'STAFF_ALLOCATION', action: 'STAFF_ALLOCATED', targetType: 'library', targetId: String(libraryId), details: { allocatedCount: allocatedCopies.length, copyIds, libraryName: library.name } });
      res.json({
        success: true,
        allocatedCount: allocatedCopies.length,
        copies: allocatedCopies,
      });
    } catch (error) {
      console.error("Error allocating copies:", error);
      res.status(500).json({ error: "Failed to allocate copies" });
    }
  });

  // ===== Book Transfers API =====
  app.get("/api/book-transfers", async (req, res) => {
    try {
      const { sourceLibraryId, destinationLibraryId, status } = req.query;
      
      if (status === 'PENDING') {
        const transfers = await storage.getPendingTransfers();
        return res.json(transfers);
      }
      
      if (sourceLibraryId) {
        const transfers = await storage.getTransfersBySourceLibrary(parseInt(sourceLibraryId as string));
        return res.json(transfers);
      }
      
      if (destinationLibraryId) {
        const transfers = await storage.getTransfersByDestinationLibrary(parseInt(destinationLibraryId as string));
        return res.json(transfers);
      }
      
      const pending = await storage.getPendingTransfers();
      res.json(pending);
    } catch (error) {
      console.error("Error fetching book transfers:", error);
      res.status(500).json({ error: "Failed to fetch book transfers" });
    }
  });

  app.get("/api/book-transfers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transfer = await storage.getBookTransfer(id);
      
      if (!transfer) {
        return res.status(404).json({ error: "Book transfer not found" });
      }
      
      res.json(transfer);
    } catch (error) {
      console.error("Error fetching book transfer:", error);
      res.status(500).json({ error: "Failed to fetch book transfer" });
    }
  });

  app.post("/api/book-transfers", async (req, res) => {
    try {
      const validated = insertBookTransferSchema.parse(req.body);
      
      const copy = await storage.getBookCopy(validated.bookCopyId);
      if (!copy) {
        return res.status(400).json({ error: "Book copy not found" });
      }
      
      if (copy.status === 'CHECKED_OUT') {
        return res.status(400).json({ error: "Cannot transfer a checked out book" });
      }
      
      if (copy.libraryId !== validated.sourceLibraryId) {
        return res.status(400).json({ error: "Book copy is not at the source library" });
      }
      
      if (validated.sourceLibraryId === validated.destinationLibraryId) {
        return res.status(400).json({ error: "Source and destination libraries must be different" });
      }
      
      await storage.updateBookCopy(copy.id, { status: 'IN_TRANSIT' });
      
      const transfer = await storage.createBookTransfer(validated);
      res.status(201).json(transfer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating book transfer:", error);
      res.status(500).json({ error: "Failed to create book transfer" });
    }
  });

  app.patch("/api/book-transfers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, approvedBy, notes } = req.body;
      
      const transfer = await storage.getBookTransfer(id);
      if (!transfer) {
        return res.status(404).json({ error: "Book transfer not found" });
      }
      
      const updateData: any = {};
      
      if (status === 'APPROVED' && transfer.status === 'PENDING') {
        updateData.status = 'APPROVED';
        updateData.approvalDate = new Date();
        if (approvedBy) updateData.approvedBy = approvedBy;
      } else if (status === 'IN_TRANSIT' && transfer.status === 'APPROVED') {
        updateData.status = 'IN_TRANSIT';
      } else if (status === 'COMPLETED' && (transfer.status === 'IN_TRANSIT' || transfer.status === 'APPROVED')) {
        updateData.status = 'COMPLETED';
        updateData.completionDate = new Date();
        
        await storage.updateBookCopy(transfer.bookCopyId, { 
          libraryId: transfer.destinationLibraryId,
          status: 'AVAILABLE'
        });
      } else if (status === 'CANCELLED' && transfer.status === 'PENDING') {
        updateData.status = 'CANCELLED';
        
        await storage.updateBookCopy(transfer.bookCopyId, { status: 'AVAILABLE' });
      }
      
      if (notes) updateData.notes = notes;
      
      const updated = await storage.updateBookTransfer(id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating book transfer:", error);
      res.status(500).json({ error: "Failed to update book transfer" });
    }
  });

  // ===== Library Memberships API =====
  app.get("/api/library-memberships", async (req, res) => {
    try {
      const { userId, libraryId } = req.query;
      
      if (userId) {
        const memberships = await storage.getMembershipsByUser(parseInt(userId as string));
        return res.json(memberships);
      }
      
      if (libraryId) {
        const memberships = await storage.getMembershipsByLibrary(parseInt(libraryId as string));
        return res.json(memberships);
      }
      
      res.status(400).json({ error: "Either userId or libraryId is required" });
    } catch (error) {
      console.error("Error fetching library memberships:", error);
      res.status(500).json({ error: "Failed to fetch library memberships" });
    }
  });

  app.post("/api/library-memberships", async (req, res) => {
    try {
      const validated = insertLibraryMembershipSchema.parse(req.body);
      
      const user = await storage.getUser(validated.userId);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      
      const library = await storage.getLibrary(validated.libraryId);
      if (!library) {
        return res.status(400).json({ error: "Library not found" });
      }
      
      const membership = await storage.createLibraryMembership(validated);
      res.status(201).json(membership);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating library membership:", error);
      res.status(500).json({ error: "Failed to create library membership" });
    }
  });

  app.patch("/api/library-memberships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertLibraryMembershipSchema.partial().parse(req.body);
      
      const membership = await storage.updateLibraryMembership(id, validated);
      
      if (!membership) {
        return res.status(404).json({ error: "Library membership not found" });
      }
      
      res.json(membership);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating library membership:", error);
      res.status(500).json({ error: "Failed to update library membership" });
    }
  });

  app.delete("/api/library-memberships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const membership = await storage.getLibraryMembership(id);
      
      if (!membership) {
        return res.status(404).json({ error: "Library membership not found" });
      }
      
      await storage.deleteLibraryMembership(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting library membership:", error);
      res.status(500).json({ error: "Failed to delete library membership" });
    }
  });

  // ===== Staff Library Allocation API (Super Admin Only) =====
  app.get("/api/staff-allocations/:staffUserId", async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      
      const currentUser = await storage.getUser(session.userId);
      if (!currentUser || currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: "Only super admin can manage staff allocations" });
      }
      
      const staffUserId = parseInt(req.params.staffUserId);
      const allocations = await storage.getStaffLibraryAllocations(staffUserId);
      
      // Get library details for each allocation
      const libraryIds = allocations.map(a => a.libraryId);
      const libraries = await storage.getAllLibraries();
      const libraryMap = new Map(libraries.map(l => [l.id, l]));
      
      const enriched = allocations.map(a => ({
        ...a,
        library: libraryMap.get(a.libraryId),
      }));
      
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching staff allocations:", error);
      res.status(500).json({ error: "Failed to fetch staff allocations" });
    }
  });

  app.post("/api/staff-allocations/:staffUserId/allocate", async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      
      const currentUser = await storage.getUser(session.userId);
      if (!currentUser || currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: "Only super admin can allocate staff to libraries" });
      }
      
      const staffUserId = parseInt(req.params.staffUserId);
      const { libraryId, reason } = req.body;
      
      if (!libraryId) {
        return res.status(400).json({ error: "libraryId is required" });
      }
      
      // Verify staff user exists and is a staff member
      const staffUser = await storage.getUser(staffUserId);
      if (!staffUser) {
        return res.status(404).json({ error: "Staff user not found" });
      }
      if (staffUser.category !== 'STAFF') {
        return res.status(400).json({ error: "User is not a staff member" });
      }
      
      // Verify library exists
      const library = await storage.getLibrary(libraryId);
      if (!library) {
        return res.status(404).json({ error: "Library not found" });
      }
      
      const membership = await storage.allocateStaffToLibrary(
        staffUserId, 
        libraryId, 
        session.userId, 
        reason
      );
      
      res.status(201).json({ 
        success: true, 
        message: `${staffUser.name} allocated to ${library.name}`,
        membership 
      });
    } catch (error) {
      console.error("Error allocating staff to library:", error);
      res.status(500).json({ error: "Failed to allocate staff to library" });
    }
  });

  app.post("/api/staff-allocations/:staffUserId/deallocate", async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      
      const currentUser = await storage.getUser(session.userId);
      if (!currentUser || currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: "Only super admin can deallocate staff from libraries" });
      }
      
      const staffUserId = parseInt(req.params.staffUserId);
      const { libraryId, reason } = req.body;
      
      if (!libraryId) {
        return res.status(400).json({ error: "libraryId is required" });
      }
      
      const staffUser = await storage.getUser(staffUserId);
      const library = await storage.getLibrary(libraryId);
      
      const success = await storage.deallocateStaffFromLibrary(
        staffUserId, 
        libraryId, 
        session.userId, 
        reason
      );
      
      if (!success) {
        return res.status(404).json({ error: "Staff member is not allocated to this library" });
      }
      
      res.json({ 
        success: true, 
        message: `${staffUser?.name || 'Staff'} deallocated from ${library?.name || 'library'}` 
      });
    } catch (error) {
      console.error("Error deallocating staff from library:", error);
      res.status(500).json({ error: "Failed to deallocate staff from library" });
    }
  });

  app.get("/api/staff-allocation-logs", async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      
      const currentUser = await storage.getUser(session.userId);
      if (!currentUser || currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: "Only super admin can view allocation logs" });
      }
      
      const { staffUserId } = req.query;
      const logs = await storage.getStaffAllocationLogsWithDetails(
        staffUserId ? parseInt(staffUserId as string) : undefined
      );
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching staff allocation logs:", error);
      res.status(500).json({ error: "Failed to fetch staff allocation logs" });
    }
  });

  // Audit Logs API (Local Admin Only)
  app.get("/api/audit-logs", async (req, res) => {
    try {
      const currentUser = await requireLocalAdmin(req, res);
      if (!currentUser) return;

      const { category, action, userId, status, startDate, endDate, search, limit, offset } = req.query;

      const filters: any = {};
      if (category) filters.category = category as string;
      if (action) filters.action = action as string;
      if (userId) filters.userId = parseInt(userId as string);
      if (status) filters.status = status as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (search) filters.search = search as string;
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);

      const result = await storage.queryAuditLogs(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Audit Config API (Local Admin Only)
  app.get("/api/audit-config", async (req, res) => {
    try {
      const currentUser = await requireLocalAdmin(req, res);
      if (!currentUser) return;

      const allConfig = await storage.getAllSystemConfig();
      const auditConfig = allConfig
        .filter(c => c.key.startsWith('audit.'))
        .map(c => ({
          key: c.key,
          category: c.key.replace('audit.', ''),
          enabled: c.value === 'true',
          description: c.description,
        }));

      res.json(auditConfig);
    } catch (error) {
      console.error("Error fetching audit config:", error);
      res.status(500).json({ error: "Failed to fetch audit configuration" });
    }
  });

  app.patch("/api/audit-config/:category", async (req, res) => {
    try {
      const currentUser = await requireLocalAdmin(req, res);
      if (!currentUser) return;

      const { category } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }

      const key = `audit.${category}`;
      const existing = await storage.getSystemConfig(key);
      if (!existing) {
        return res.status(404).json({ error: "Audit category not found" });
      }

      await storage.setSystemConfig({
        key,
        value: enabled ? 'true' : 'false',
        category: 'audit',
        description: existing.description || category,
      });

      invalidateAuditConfigCache();

      logAudit(req, {
        category: 'SYSTEM_CONFIG',
        action: 'AUDIT_CONFIG_CHANGED',
        userId: currentUser.id,
        userName: currentUser.name,
        targetType: 'audit_config',
        targetId: category,
        details: { category, enabled },
      });

      res.json({ success: true, category, enabled });
    } catch (error) {
      console.error("Error updating audit config:", error);
      res.status(500).json({ error: "Failed to update audit configuration" });
    }
  });

  // ===== Search Attributes API =====

  // Search Attribute Types
  app.get("/api/search-attributes/types", async (req, res) => {
    try {
      const types = await storage.getAllSearchAttributeTypes();
      const typesWithValues = await Promise.all(
        types.map(async (type) => {
          const values = await storage.getSearchAttributeValuesByType(type.id);
          return { ...type, values };
        })
      );
      res.json(typesWithValues);
    } catch (error) {
      console.error("Error fetching search attribute types:", error);
      res.status(500).json({ error: "Failed to fetch search attribute types" });
    }
  });

  app.post("/api/search-attributes/types", async (req, res) => {
    try {
      const validated = insertSearchAttributeTypeSchema.parse(req.body);
      const type = await storage.createSearchAttributeType(validated);
      logAudit(req, { category: 'CATALOG', action: 'SEARCH_ATTR_TYPE_CREATED', targetType: 'search_attribute_type', targetId: String(type.id), details: { name: type.name } });
      res.status(201).json(type);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating search attribute type:", error);
      res.status(500).json({ error: "Failed to create search attribute type" });
    }
  });

  app.patch("/api/search-attributes/types/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertSearchAttributeTypeSchema.partial().parse(req.body);
      const type = await storage.updateSearchAttributeType(id, validated);
      if (!type) return res.status(404).json({ error: "Search attribute type not found" });
      logAudit(req, { category: 'CATALOG', action: 'SEARCH_ATTR_TYPE_UPDATED', targetType: 'search_attribute_type', targetId: String(id), details: { changedFields: Object.keys(validated) } });
      res.json(type);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating search attribute type:", error);
      res.status(500).json({ error: "Failed to update search attribute type" });
    }
  });

  app.delete("/api/search-attributes/types/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSearchAttributeType(id);
      if (!deleted) return res.status(404).json({ error: "Search attribute type not found" });
      logAudit(req, { category: 'CATALOG', action: 'SEARCH_ATTR_TYPE_DELETED', targetType: 'search_attribute_type', targetId: String(id) });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting search attribute type:", error);
      res.status(500).json({ error: "Failed to delete search attribute type" });
    }
  });

  // Search Attribute Values
  app.get("/api/search-attributes/types/:typeId/values", async (req, res) => {
    try {
      const typeId = parseInt(req.params.typeId);
      const values = await storage.getSearchAttributeValuesByType(typeId);
      res.json(values);
    } catch (error) {
      console.error("Error fetching search attribute values:", error);
      res.status(500).json({ error: "Failed to fetch search attribute values" });
    }
  });

  app.post("/api/search-attributes/types/:typeId/values", async (req, res) => {
    try {
      const typeId = parseInt(req.params.typeId);
      const type = await storage.getSearchAttributeType(typeId);
      if (!type) return res.status(404).json({ error: "Search attribute type not found" });

      const validated = insertSearchAttributeValueSchema.parse({
        ...req.body,
        attributeTypeId: typeId,
      });
      const value = await storage.createSearchAttributeValue(validated);
      logAudit(req, { category: 'CATALOG', action: 'SEARCH_ATTR_VALUE_CREATED', targetType: 'search_attribute_value', targetId: String(value.id), details: { typeName: type.name, value: value.value } });
      res.status(201).json(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error creating search attribute value:", error);
      res.status(500).json({ error: "Failed to create search attribute value" });
    }
  });

  app.patch("/api/search-attributes/values/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertSearchAttributeValueSchema.partial().parse(req.body);
      const value = await storage.updateSearchAttributeValue(id, validated);
      if (!value) return res.status(404).json({ error: "Search attribute value not found" });
      res.json(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating search attribute value:", error);
      res.status(500).json({ error: "Failed to update search attribute value" });
    }
  });

  app.delete("/api/search-attributes/values/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSearchAttributeValue(id);
      if (!deleted) return res.status(404).json({ error: "Search attribute value not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting search attribute value:", error);
      res.status(500).json({ error: "Failed to delete search attribute value" });
    }
  });

  // Resource Search Attribute Assignments
  app.get("/api/books/:bookId/search-attributes", async (req, res) => {
    try {
      const bookId = parseInt(req.params.bookId);
      const attrs = await storage.getResourceSearchAttributes(bookId);
      res.json(attrs);
    } catch (error) {
      console.error("Error fetching resource search attributes:", error);
      res.status(500).json({ error: "Failed to fetch resource search attributes" });
    }
  });

  app.put("/api/books/:bookId/search-attributes", async (req, res) => {
    try {
      const bookId = parseInt(req.params.bookId);
      const book = await storage.getBook(bookId);
      if (!book) return res.status(404).json({ error: "Book not found" });

      const { attributeValueIds } = req.body;
      if (!Array.isArray(attributeValueIds)) {
        return res.status(400).json({ error: "attributeValueIds must be an array" });
      }

      await storage.setResourceSearchAttributes(bookId, attributeValueIds);
      const updated = await storage.getResourceSearchAttributes(bookId);
      logAudit(req, { category: 'CATALOG', action: 'SEARCH_ATTRS_UPDATED', targetType: 'book', targetId: String(bookId), details: { bookTitle: book.title, attributeCount: attributeValueIds.length } });
      res.json(updated);
    } catch (error) {
      console.error("Error updating resource search attributes:", error);
      res.status(500).json({ error: "Failed to update resource search attributes" });
    }
  });

  // Dashboard Stats API
  app.get("/api/stats/dashboard", async (req, res) => {
    try {
      const books = await storage.getAllBooks();
      const users = await storage.getAllUsers();
      const circulation = await storage.getAllCirculation();
      
      const totalBooks = books.length;
      const availableBooks = books.filter(b => b.status === 'AVAILABLE').length;
      const checkedOutBooks = books.filter(b => b.status === 'CHECKED_OUT').length;
      
      const activeMembers = users.filter(u => u.status === 'ACTIVE').length;
      const activeCirculation = circulation.filter(c => c.status === 'ACTIVE').length;
      
      const now = new Date();
      const overdueItems = circulation.filter(c => 
        c.status === 'ACTIVE' && c.dueDate < now
      ).length;
      
      const totalFines = circulation.reduce((sum, c) => sum + (c.fineAmount || 0), 0);
      
      res.json({
        totalBooks,
        availableBooks,
        checkedOutBooks,
        activeMembers,
        activeCirculation,
        overdueItems,
        totalFines
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });

  const emailConfigSchema = z.object({
    provider: z.string().min(1),
    smtpHost: z.string().min(1),
    smtpPort: z.string().min(1),
    smtpSecure: z.enum(["true", "false"]),
    smtpUser: z.string().min(1),
    smtpPass: z.string().min(1),
    smtpFrom: z.string().optional(),
  });

  app.get("/api/email-config", async (req, res) => {
    try {
      const currentUser = await requireLocalAdmin(req, res);
      if (!currentUser) return;

      const keys = ["smtp_provider", "smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_pass", "smtp_from"];
      const configs: Record<string, string> = {};
      for (const key of keys) {
        const config = await storage.getSystemConfig(key);
        if (config) {
          configs[key.replace("smtp_", "").replace("provider", "smtpProvider")] = 
            key === "smtp_pass" ? "••••••••" : config.value;
        }
      }

      const providerConfig = await storage.getSystemConfig("smtp_provider");
      const hostConfig = await storage.getSystemConfig("smtp_host");
      const portConfig = await storage.getSystemConfig("smtp_port");
      const secureConfig = await storage.getSystemConfig("smtp_secure");
      const userConfig = await storage.getSystemConfig("smtp_user");
      const passConfig = await storage.getSystemConfig("smtp_pass");
      const fromConfig = await storage.getSystemConfig("smtp_from");

      res.json({
        configured: !!hostConfig,
        provider: providerConfig?.value || "",
        smtpHost: hostConfig?.value || "",
        smtpPort: portConfig?.value || "",
        smtpSecure: secureConfig?.value || "true",
        smtpUser: userConfig?.value || "",
        smtpPass: passConfig ? "••••••••" : "",
        smtpFrom: fromConfig?.value || "",
      });
    } catch (error) {
      console.error("Error fetching email config:", error);
      res.status(500).json({ error: "Failed to fetch email configuration" });
    }
  });

  app.post("/api/email-config", async (req, res) => {
    try {
      const currentUser = await requireLocalAdmin(req, res);
      if (!currentUser) return;

      const validated = emailConfigSchema.parse(req.body);

      await storage.setSystemConfig({ key: "smtp_provider", value: validated.provider, category: "email", description: "Email provider name" });
      await storage.setSystemConfig({ key: "smtp_host", value: validated.smtpHost, category: "email", description: "SMTP server host" });
      await storage.setSystemConfig({ key: "smtp_port", value: validated.smtpPort, category: "email", description: "SMTP server port" });
      await storage.setSystemConfig({ key: "smtp_secure", value: validated.smtpSecure, category: "email", description: "Use TLS/SSL" });
      await storage.setSystemConfig({ key: "smtp_user", value: validated.smtpUser, category: "email", description: "SMTP username/email" });
      if (validated.smtpPass && validated.smtpPass !== "••••••••") {
        await storage.setSystemConfig({ key: "smtp_pass", value: validated.smtpPass, category: "email", description: "SMTP app password" });
      }
      await storage.setSystemConfig({ key: "smtp_from", value: validated.smtpFrom || validated.smtpUser, category: "email", description: "From email address" });

      await logAudit({
        userId: currentUser.id,
        username: currentUser.username,
        action: "Email configuration updated",
        category: "SYSTEM_CONFIG",
        status: "SUCCESS",
        ipAddress: req.ip || "unknown",
        metadata: { provider: validated.provider, smtpHost: validated.smtpHost },
      });

      res.json({ success: true, message: "Email configuration saved successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Error saving email config:", error);
      res.status(500).json({ error: "Failed to save email configuration" });
    }
  });

  app.post("/api/email-config/test", async (req, res) => {
    try {
      const currentUser = await requireLocalAdmin(req, res);
      if (!currentUser) return;

      const { testEmail } = req.body;
      if (!testEmail) {
        return res.status(400).json({ error: "Test email address is required" });
      }

      const hostConfig = await storage.getSystemConfig("smtp_host");
      const portConfig = await storage.getSystemConfig("smtp_port");
      const secureConfig = await storage.getSystemConfig("smtp_secure");
      const userConfig = await storage.getSystemConfig("smtp_user");
      const passConfig = await storage.getSystemConfig("smtp_pass");
      const fromConfig = await storage.getSystemConfig("smtp_from");

      if (!hostConfig || !portConfig || !userConfig || !passConfig) {
        return res.status(400).json({ error: "Email is not configured. Please save the configuration first." });
      }

      const transporter = nodemailer.createTransport({
        host: hostConfig.value,
        port: parseInt(portConfig.value),
        secure: secureConfig?.value === "true",
        auth: {
          user: userConfig.value,
          pass: passConfig.value,
        },
      });

      await transporter.verify();

      await transporter.sendMail({
        from: fromConfig?.value || userConfig.value,
        to: testEmail,
        subject: "LibraTech - Test Email",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">LibraTech</h1>
              <p style="margin: 5px 0 0; opacity: 0.9;">Library Management System</p>
            </div>
            <div style="padding: 30px; background: #f9fafb;">
              <h2 style="color: #1e40af;">Email Configuration Test</h2>
              <p>This is a test email from LibraTech to confirm that your email settings are working correctly.</p>
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Status:</strong> <span style="color: #16a34a;">✓ Email delivery successful</span></p>
                <p style="margin: 8px 0 0;"><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <p style="color: #6b7280; font-size: 14px;">If you received this email, your SMTP settings are configured correctly.</p>
            </div>
            <div style="background: #e5e7eb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p style="margin: 0;">This is an automated test email from LibraTech.</p>
            </div>
          </div>
        `,
      });

      await logAudit({
        userId: currentUser.id,
        username: currentUser.username,
        action: "Test email sent successfully",
        category: "SYSTEM_CONFIG",
        status: "SUCCESS",
        ipAddress: req.ip || "unknown",
        metadata: { testEmail },
      });

      res.json({ success: true, message: `Test email sent successfully to ${testEmail}` });
    } catch (error: any) {
      console.error("Email test failed:", error);

      let errorMessage = "Failed to send test email";
      if (error.code === "EAUTH") {
        errorMessage = "Authentication failed. Check your email and app password.";
      } else if (error.code === "ESOCKET" || error.code === "ECONNECTION") {
        errorMessage = "Could not connect to SMTP server. Check host and port settings.";
      } else if (error.code === "ETIMEDOUT") {
        errorMessage = "Connection timed out. Check your SMTP server settings.";
      } else if (error.responseCode === 535) {
        errorMessage = "Authentication failed. For Gmail/GWS, use an App Password instead of your account password.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      res.status(400).json({ error: errorMessage });
    }
  });

  return httpServer;
}
