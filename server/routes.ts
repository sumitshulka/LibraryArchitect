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
  insertLibraryMembershipSchema
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
      const { quantity, ...bookData } = req.body;
      const validated = insertBookSchema.parse(bookData);
      
      // Check for duplicate ISBN
      const existing = await storage.getBookByIsbn(validated.isbn);
      if (existing) {
        return res.status(400).json({ error: "Book with this ISBN already exists" });
      }
      
      const book = await storage.createBook(validated);
      
      // Create unallocated copies if quantity is specified
      const copyCount = Math.min(Math.max(1, parseInt(quantity) || 1), 1000);
      if (copyCount > 0) {
        await storage.createBookCopies(book.id, copyCount, validated.shelfLocation || undefined);
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
      
      res.status(400).json({ error: "Either bookId or libraryId is required" });
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
