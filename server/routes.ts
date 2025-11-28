import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertBookSchema, 
  insertUserSchema, 
  insertCirculationSchema,
  insertInventorySchema,
  insertSystemConfigSchema 
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

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
