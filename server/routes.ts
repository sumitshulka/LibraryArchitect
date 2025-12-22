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
  insertInventoryItemSchema
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import crypto from "crypto";
import * as XLSX from "xlsx";
import multer from "multer";

const MAX_WHITELIST_ENTRIES = 5;

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
      
      for (const copy of copies) {
        const libId = copy.libraryId || 0; // Use 0 for unallocated copies
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
        switch (copy.status) {
          case "AVAILABLE": libraryAllocations[libId].available++; break;
          case "CHECKED_OUT": libraryAllocations[libId].checkedOut++; break;
          case "RESERVED": libraryAllocations[libId].reserved++; break;
          case "DAMAGED": libraryAllocations[libId].damaged++; break;
          case "LOST": libraryAllocations[libId].lost++; break;
          case "IN_TRANSIT": libraryAllocations[libId].inTransit++; break;
        }
      }
      
      // Get recent circulation records for this book's copies
      const recentCirculation = await storage.getRecentCirculationByBook(bookId, 10);
      
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
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
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
      
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // ===== Circulation API =====
  app.get("/api/circulation", async (req, res) => {
    try {
      const { userId } = req.query;
      
      if (userId && typeof userId === 'string') {
        const circulations = await storage.getCirculationByUser(parseInt(userId));
        return res.json(circulations);
      }
      
      const circulations = await storage.getAllCirculation();
      res.json(circulations);
    } catch (error) {
      console.error("Error fetching circulation:", error);
      res.status(500).json({ error: "Failed to fetch circulation records" });
    }
  });

  app.post("/api/circulation/checkout", async (req, res) => {
    try {
      const validated = insertCirculationSchema.parse(req.body);
      
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
      
      // Check for active circulation
      const activeCirc = await storage.getActiveCirculationByBook(validated.bookId);
      if (activeCirc) {
        return res.status(400).json({ error: "Book is already checked out" });
      }
      
      // Create circulation record
      const circulation = await storage.createCirculation(validated);
      
      // Update book status
      await storage.updateBook(validated.bookId, { status: 'CHECKED_OUT' });
      
      res.status(201).json(circulation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error checking out book:", error);
      res.status(500).json({ error: "Failed to checkout book" });
    }
  });

  app.post("/api/circulation/:id/return", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const circ = await storage.getCirculation(id);
      
      if (!circ) {
        return res.status(404).json({ error: "Circulation record not found" });
      }
      
      if (circ.status !== 'ACTIVE') {
        return res.status(400).json({ error: "This book has already been returned" });
      }
      
      const returnDate = new Date();
      const isOverdue = returnDate > circ.dueDate;
      
      // Calculate fine if overdue (e.g., $1 per day)
      let fineAmount = 0;
      if (isOverdue) {
        const daysOverdue = Math.ceil((returnDate.getTime() - circ.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        fineAmount = daysOverdue * 100; // $1.00 in cents
      }
      
      // Update circulation record
      const updated = await storage.updateCirculation(id, {
        returnDate,
        status: 'RETURNED',
        fineAmount
      });
      
      // Update book status
      await storage.updateBook(circ.bookId, { status: 'AVAILABLE' });
      
      res.json(updated);
    } catch (error) {
      console.error("Error returning book:", error);
      res.status(500).json({ error: "Failed to return book" });
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
      
      res.json({ item, copy, book });
    } catch (error) {
      console.error("Error scanning item:", error);
      res.status(500).json({ error: "Failed to scan item" });
    }
  });

  // ===== System Config API =====
  app.get("/api/config", async (req, res) => {
    try {
      const configs = await storage.getAllSystemConfig();
      res.json(configs);
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      const validated = insertSystemConfigSchema.parse(req.body);
      const config = await storage.setSystemConfig(validated);
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

  // ===== ERP Integration API =====
  app.get("/api/erp-integrations", async (req, res) => {
    try {
      const integrations = await storage.getAllErpIntegrations();
      const sanitized = integrations.map(({ secretHash, secretSalt, ...rest }) => rest);
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
      
      const { secretHash, secretSalt, ...sanitized } = integration;
      res.json(sanitized);
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
        secretHash,
        secretSalt: salt,
      });
      
      const { secretHash: _, secretSalt: __, ...sanitized } = integration;
      
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
      
      const { secretHash, secretSalt, ...sanitized } = integration;
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
      
      const updated = await storage.rotateErpSecret(id, newSecretHash, newSalt);
      
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

  return httpServer;
}
