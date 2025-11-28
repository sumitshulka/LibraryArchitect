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
  insertErpIntegrationSchema,
  insertErpWhitelistSchema
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import crypto from "crypto";

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

  app.post("/api/books", async (req, res) => {
    try {
      const validated = insertBookSchema.parse(req.body);
      
      // Check for duplicate ISBN
      const existing = await storage.getBookByIsbn(validated.isbn);
      if (existing) {
        return res.status(400).json({ error: "Book with this ISBN already exists" });
      }
      
      const book = await storage.createBook(validated);
      res.status(201).json(book);
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
