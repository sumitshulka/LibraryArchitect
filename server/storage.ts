import { 
  type User, 
  type InsertUser,
  type Book,
  type InsertBook,
  type Circulation,
  type InsertCirculation,
  type Inventory,
  type InsertInventory,
  type SystemConfig,
  type InsertSystemConfig,
  type ResourceType,
  type InsertResourceType,
  users,
  books,
  circulation,
  inventory,
  systemConfig,
  resourceTypes
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, desc, asc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  
  // Resource Types
  getResourceType(id: number): Promise<ResourceType | undefined>;
  createResourceType(type: InsertResourceType): Promise<ResourceType>;
  updateResourceType(id: number, type: Partial<InsertResourceType>): Promise<ResourceType | undefined>;
  getAllResourceTypes(): Promise<ResourceType[]>;
  getActiveResourceTypes(): Promise<ResourceType[]>;
  deleteResourceType(id: number): Promise<boolean>;
  
  // Books
  getBook(id: number): Promise<Book | undefined>;
  getBookByIsbn(isbn: string): Promise<Book | undefined>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: number, book: Partial<InsertBook>): Promise<Book | undefined>;
  getAllBooks(): Promise<Book[]>;
  searchBooks(query: string): Promise<Book[]>;
  deleteBook(id: number): Promise<boolean>;
  
  // Circulation
  getCirculation(id: number): Promise<Circulation | undefined>;
  createCirculation(circ: InsertCirculation): Promise<Circulation>;
  updateCirculation(id: number, circ: Partial<InsertCirculation>): Promise<Circulation | undefined>;
  getAllCirculation(): Promise<Circulation[]>;
  getActiveCirculationByBook(bookId: number): Promise<Circulation | undefined>;
  getCirculationByUser(userId: number): Promise<Circulation[]>;
  
  // Inventory
  getInventory(id: number): Promise<Inventory | undefined>;
  createInventory(inv: InsertInventory): Promise<Inventory>;
  updateInventory(id: number, inv: Partial<InsertInventory>): Promise<Inventory | undefined>;
  getInventoryBySession(sessionId: string): Promise<Inventory[]>;
  
  // System Config
  getSystemConfig(key: string): Promise<SystemConfig | undefined>;
  setSystemConfig(config: InsertSystemConfig): Promise<SystemConfig>;
  getAllSystemConfig(): Promise<SystemConfig[]>;
}

export class DBStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.name));
  }

  // Resource Types
  async getResourceType(id: number): Promise<ResourceType | undefined> {
    const [type] = await db.select().from(resourceTypes).where(eq(resourceTypes.id, id));
    return type;
  }

  async createResourceType(insertType: InsertResourceType): Promise<ResourceType> {
    const [type] = await db.insert(resourceTypes).values(insertType).returning();
    return type;
  }

  async updateResourceType(id: number, updateData: Partial<InsertResourceType>): Promise<ResourceType | undefined> {
    const [type] = await db.update(resourceTypes).set(updateData).where(eq(resourceTypes.id, id)).returning();
    return type;
  }

  async getAllResourceTypes(): Promise<ResourceType[]> {
    return await db.select().from(resourceTypes).orderBy(asc(resourceTypes.name));
  }

  async getActiveResourceTypes(): Promise<ResourceType[]> {
    return await db.select().from(resourceTypes)
      .where(eq(resourceTypes.isActive, true))
      .orderBy(asc(resourceTypes.name));
  }

  async deleteResourceType(id: number): Promise<boolean> {
    await db.delete(resourceTypes).where(eq(resourceTypes.id, id));
    return true;
  }

  // Books
  async getBook(id: number): Promise<Book | undefined> {
    const [book] = await db.select().from(books).where(eq(books.id, id));
    return book;
  }

  async getBookByIsbn(isbn: string): Promise<Book | undefined> {
    const [book] = await db.select().from(books).where(eq(books.isbn, isbn));
    return book;
  }

  async createBook(insertBook: InsertBook): Promise<Book> {
    const [book] = await db.insert(books).values(insertBook).returning();
    return book;
  }

  async updateBook(id: number, updateData: Partial<InsertBook>): Promise<Book | undefined> {
    const [book] = await db.update(books).set(updateData).where(eq(books.id, id)).returning();
    return book;
  }

  async getAllBooks(): Promise<Book[]> {
    return await db.select().from(books).orderBy(asc(books.title));
  }

  async searchBooks(query: string): Promise<Book[]> {
    const searchPattern = `%${query}%`;
    return await db.select().from(books).where(
      or(
        like(books.title, searchPattern),
        like(books.author, searchPattern),
        like(books.isbn, searchPattern)
      )
    );
  }

  async deleteBook(id: number): Promise<boolean> {
    await db.delete(books).where(eq(books.id, id));
    return true;
  }

  // Circulation
  async getCirculation(id: number): Promise<Circulation | undefined> {
    const [circ] = await db.select().from(circulation).where(eq(circulation.id, id));
    return circ;
  }

  async createCirculation(insertCirculation: InsertCirculation): Promise<Circulation> {
    const [circ] = await db.insert(circulation).values(insertCirculation).returning();
    return circ;
  }

  async updateCirculation(id: number, updateData: Partial<InsertCirculation>): Promise<Circulation | undefined> {
    const [circ] = await db.update(circulation).set(updateData).where(eq(circulation.id, id)).returning();
    return circ;
  }

  async getAllCirculation(): Promise<Circulation[]> {
    return await db.select().from(circulation).orderBy(desc(circulation.checkoutDate));
  }

  async getActiveCirculationByBook(bookId: number): Promise<Circulation | undefined> {
    const [circ] = await db.select().from(circulation).where(
      and(
        eq(circulation.bookId, bookId),
        eq(circulation.status, 'ACTIVE')
      )
    );
    return circ;
  }

  async getCirculationByUser(userId: number): Promise<Circulation[]> {
    return await db.select().from(circulation).where(eq(circulation.userId, userId));
  }

  // Inventory
  async getInventory(id: number): Promise<Inventory | undefined> {
    const [inv] = await db.select().from(inventory).where(eq(inventory.id, id));
    return inv;
  }

  async createInventory(insertInventory: InsertInventory): Promise<Inventory> {
    const [inv] = await db.insert(inventory).values(insertInventory).returning();
    return inv;
  }

  async updateInventory(id: number, updateData: Partial<InsertInventory>): Promise<Inventory | undefined> {
    const [inv] = await db.update(inventory).set(updateData).where(eq(inventory.id, id)).returning();
    return inv;
  }

  async getInventoryBySession(sessionId: string): Promise<Inventory[]> {
    return await db.select().from(inventory).where(eq(inventory.auditSessionId, sessionId));
  }

  // System Config
  async getSystemConfig(key: string): Promise<SystemConfig | undefined> {
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, key));
    return config;
  }

  async setSystemConfig(insertConfig: InsertSystemConfig): Promise<SystemConfig> {
    const existing = await this.getSystemConfig(insertConfig.key);
    
    if (existing) {
      const [config] = await db.update(systemConfig)
        .set({ ...insertConfig, updatedAt: new Date() })
        .where(eq(systemConfig.key, insertConfig.key))
        .returning();
      return config;
    } else {
      const [config] = await db.insert(systemConfig).values(insertConfig).returning();
      return config;
    }
  }

  async getAllSystemConfig(): Promise<SystemConfig[]> {
    return await db.select().from(systemConfig).orderBy(asc(systemConfig.category));
  }
}

export const storage = new DBStorage();
