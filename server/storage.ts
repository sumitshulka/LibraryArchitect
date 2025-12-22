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
  type Category,
  type InsertCategory,
  type ErpIntegration,
  type InsertErpIntegration,
  type ErpWhitelist,
  type InsertErpWhitelist,
  type ErpPullEndpoint,
  type InsertErpPullEndpoint,
  type ErpFieldMapping,
  type InsertErpFieldMapping,
  type ErpTestLog,
  type InsertErpTestLog,
  type OrgUnit,
  type InsertOrgUnit,
  type Library,
  type InsertLibrary,
  type BookCopy,
  type InsertBookCopy,
  type BookTransfer,
  type InsertBookTransfer,
  type LibraryMembership,
  type InsertLibraryMembership,
  type AuditSession,
  type InsertAuditSession,
  type InventoryItem,
  type InsertInventoryItem,
  users,
  books,
  circulation,
  inventory,
  systemConfig,
  resourceTypes,
  categories,
  erpIntegrations,
  erpIntegrationWhitelist,
  erpPullEndpoints,
  erpFieldMappings,
  erpTestLogs,
  orgUnits,
  libraries,
  bookCopies,
  bookTransfers,
  libraryMemberships,
  auditSessions,
  inventoryItems
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, desc, asc, sql, isNull, inArray } from "drizzle-orm";

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
  
  // Categories
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  getAllCategories(): Promise<Category[]>;
  getActiveCategories(): Promise<Category[]>;
  deleteCategory(id: number): Promise<boolean>;
  
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
  
  // Inventory (legacy)
  getInventory(id: number): Promise<Inventory | undefined>;
  createInventory(inv: InsertInventory): Promise<Inventory>;
  updateInventory(id: number, inv: Partial<InsertInventory>): Promise<Inventory | undefined>;
  getInventoryBySession(sessionId: string): Promise<Inventory[]>;
  
  // Audit Sessions
  getAuditSession(id: number): Promise<AuditSession | undefined>;
  getAuditSessionByCode(code: string): Promise<AuditSession | undefined>;
  createAuditSession(session: InsertAuditSession): Promise<AuditSession>;
  updateAuditSession(id: number, session: Partial<InsertAuditSession>): Promise<AuditSession | undefined>;
  getAllAuditSessions(): Promise<AuditSession[]>;
  getActiveAuditSessions(): Promise<AuditSession[]>;
  getAuditSessionsByLibrary(libraryId: number): Promise<AuditSession[]>;
  
  // Inventory Items
  getInventoryItem(id: number): Promise<InventoryItem | undefined>;
  getInventoryItemBySessionAndCopy(sessionId: number, copyId: number): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: number, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  getInventoryItemsBySession(sessionId: number): Promise<InventoryItem[]>;
  getInventorySessionStats(sessionId: number): Promise<{ total: number; verified: number; missing: number; pending: number; discrepancy: number }>;
  
  // System Config
  getSystemConfig(key: string): Promise<SystemConfig | undefined>;
  setSystemConfig(config: InsertSystemConfig): Promise<SystemConfig>;
  getAllSystemConfig(): Promise<SystemConfig[]>;
  
  // ERP Integrations
  getErpIntegration(id: number): Promise<ErpIntegration | undefined>;
  getErpIntegrationByAppId(appId: string): Promise<ErpIntegration | undefined>;
  createErpIntegration(integration: InsertErpIntegration): Promise<ErpIntegration>;
  updateErpIntegration(id: number, integration: Partial<InsertErpIntegration>): Promise<ErpIntegration | undefined>;
  deleteErpIntegration(id: number): Promise<boolean>;
  getAllErpIntegrations(): Promise<ErpIntegration[]>;
  rotateErpSecret(id: number, newSecretHash: string, newSecretSalt: string): Promise<ErpIntegration | undefined>;
  
  // ERP Whitelist
  getErpWhitelist(id: number): Promise<ErpWhitelist | undefined>;
  getWhitelistByIntegration(integrationId: number): Promise<ErpWhitelist[]>;
  createErpWhitelist(whitelist: InsertErpWhitelist): Promise<ErpWhitelist>;
  updateErpWhitelist(id: number, whitelist: Partial<InsertErpWhitelist>): Promise<ErpWhitelist | undefined>;
  deleteErpWhitelist(id: number): Promise<boolean>;
  countWhitelistByIntegration(integrationId: number): Promise<number>;
  
  // ERP Pull Endpoints
  getErpPullEndpoint(id: number): Promise<ErpPullEndpoint | undefined>;
  getErpPullEndpointsByIntegration(integrationId: number): Promise<ErpPullEndpoint[]>;
  createErpPullEndpoint(endpoint: InsertErpPullEndpoint): Promise<ErpPullEndpoint>;
  updateErpPullEndpoint(id: number, endpoint: Partial<InsertErpPullEndpoint>): Promise<ErpPullEndpoint | undefined>;
  deleteErpPullEndpoint(id: number): Promise<boolean>;
  updateErpPullEndpointTestStatus(id: number, status: string): Promise<ErpPullEndpoint | undefined>;
  
  // ERP Field Mappings
  getErpFieldMapping(id: number): Promise<ErpFieldMapping | undefined>;
  getErpFieldMappingsByEndpoint(endpointId: number): Promise<ErpFieldMapping[]>;
  createErpFieldMapping(mapping: InsertErpFieldMapping): Promise<ErpFieldMapping>;
  updateErpFieldMapping(id: number, mapping: Partial<InsertErpFieldMapping>): Promise<ErpFieldMapping | undefined>;
  deleteErpFieldMapping(id: number): Promise<boolean>;
  deleteErpFieldMappingsByEndpoint(endpointId: number): Promise<boolean>;
  
  // ERP Test Logs
  getErpTestLog(id: number): Promise<ErpTestLog | undefined>;
  getErpTestLogsByEndpoint(endpointId: number, limit?: number): Promise<ErpTestLog[]>;
  createErpTestLog(log: InsertErpTestLog): Promise<ErpTestLog>;
  deleteErpTestLog(id: number): Promise<boolean>;
  
  // Organizational Units
  getOrgUnit(id: number): Promise<OrgUnit | undefined>;
  getOrgUnitByCode(code: string): Promise<OrgUnit | undefined>;
  createOrgUnit(orgUnit: InsertOrgUnit): Promise<OrgUnit>;
  updateOrgUnit(id: number, orgUnit: Partial<InsertOrgUnit>): Promise<OrgUnit | undefined>;
  deleteOrgUnit(id: number): Promise<boolean>;
  getAllOrgUnits(): Promise<OrgUnit[]>;
  getOrgUnitsByParent(parentId: number | null): Promise<OrgUnit[]>;
  getOrgUnitsByType(type: string): Promise<OrgUnit[]>;
  
  // Libraries
  getLibrary(id: number): Promise<Library | undefined>;
  getLibraryByCode(code: string): Promise<Library | undefined>;
  createLibrary(library: InsertLibrary): Promise<Library>;
  updateLibrary(id: number, library: Partial<InsertLibrary>): Promise<Library | undefined>;
  deleteLibrary(id: number): Promise<boolean>;
  getAllLibraries(): Promise<Library[]>;
  getLibrariesByOrgUnit(orgUnitId: number): Promise<Library[]>;
  getActiveLibraries(): Promise<Library[]>;
  
  // Book Copies
  getBookCopy(id: number): Promise<BookCopy | undefined>;
  getBookCopyByBarcode(barcode: string): Promise<BookCopy | undefined>;
  createBookCopy(bookCopy: InsertBookCopy): Promise<BookCopy>;
  createBookCopies(bookId: number, quantity: number, shelfLocation?: string, acquisitionDate?: Date, acquisitionSource?: string, price?: number): Promise<BookCopy[]>;
  updateBookCopy(id: number, bookCopy: Partial<InsertBookCopy>): Promise<BookCopy | undefined>;
  deleteBookCopy(id: number): Promise<boolean>;
  getAllBookCopies(): Promise<BookCopy[]>;
  getBookCopiesByBook(bookId: number): Promise<BookCopy[]>;
  getBookCopiesByLibrary(libraryId: number): Promise<BookCopy[]>;
  getBookCopiesByBookAndLibrary(bookId: number, libraryId: number): Promise<BookCopy[]>;
  getCirculationHistoryByCopy(bookCopyId: number): Promise<Circulation[]>;
  getRecentCirculationByBook(bookId: number, limit?: number): Promise<Circulation[]>;
  getBookFinesSummary(bookId: number): Promise<{ paidFines: number; outstandingFines: number; waivedFines: number }>;
  getUnallocatedCopies(): Promise<BookCopy[]>;
  getUnallocatedCopiesWithBookInfo(): Promise<UnallocatedCopyInfo[]>;
  getAvailableCopiesByLibrary(libraryId: number): Promise<BookCopy[]>;
  allocateCopies(copyIds: number[], libraryId: number, generateSSN: boolean, ssnPrefix?: string): Promise<BookCopy[]>;
  
  // Book Transfers
  getBookTransfer(id: number): Promise<BookTransfer | undefined>;
  createBookTransfer(transfer: InsertBookTransfer): Promise<BookTransfer>;
  updateBookTransfer(id: number, transfer: Partial<InsertBookTransfer>): Promise<BookTransfer | undefined>;
  getTransfersBySourceLibrary(libraryId: number): Promise<BookTransfer[]>;
  getTransfersByDestinationLibrary(libraryId: number): Promise<BookTransfer[]>;
  getPendingTransfers(): Promise<BookTransfer[]>;
  
  // Library Memberships
  getLibraryMembership(id: number): Promise<LibraryMembership | undefined>;
  createLibraryMembership(membership: InsertLibraryMembership): Promise<LibraryMembership>;
  updateLibraryMembership(id: number, membership: Partial<InsertLibraryMembership>): Promise<LibraryMembership | undefined>;
  deleteLibraryMembership(id: number): Promise<boolean>;
  getMembershipsByUser(userId: number): Promise<LibraryMembership[]>;
  getMembershipsByLibrary(libraryId: number): Promise<LibraryMembership[]>;
  
  // Library Dashboard
  getLibraryDashboard(libraryId: number): Promise<LibraryDashboardStats>;
  
  // Library Resources
  getLibraryResources(params: LibraryResourcesSearchParams): Promise<{ resources: LibraryResourceStats[]; total: number; categories: string[] }>;
}

export interface LibraryDashboardStats {
  libraryId: number;
  libraryName: string;
  libraryCode: string;
  orgUnitName: string | null;
  
  totalCopies: number;
  physicalBooks: number;
  ebooks: number;
  audiobooks: number;
  
  availableCopies: number;
  checkedOutCopies: number;
  lostCopies: number;
  damagedCopies: number;
  inTransitCopies: number;
  reservedCopies: number;
  
  activeCirculations: number;
  overdueItems: number;
  
  totalFinesOutstanding: number;
  totalFinesPaid: number;
  totalFinesWaived: number;
  
  pendingTransfersIn: number;
  pendingTransfersOut: number;
  
  totalMembers: number;
}

export interface UnallocatedCopyInfo {
  bookId: number;
  bookTitle: string;
  bookAuthor: string;
  bookIsbn: string;
  bookFormat: string;
  totalUnallocatedCopies: number;
  copies: {
    id: number;
    barcode: string;
    shelfLocation: string | null;
    status: string;
    createdAt: Date;
  }[];
}

export interface LibraryResourceStats {
  bookId: number;
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publishedYear: number | null;
  category: string;
  format: string;
  coverUrl: string | null;
  totalCopies: number;
  available: number;
  checkedOut: number;
  reserved: number;
  damaged: number;
  lost: number;
  inTransit: number;
}

export interface LibraryResourcesSearchParams {
  libraryId: number;
  query?: string;
  format?: string;
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
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

  // Categories
  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(insertCategory).returning();
    return category;
  }

  async updateCategory(id: number, updateData: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await db.update(categories).set(updateData).where(eq(categories.id, id)).returning();
    return category;
  }

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(asc(categories.name));
  }

  async getActiveCategories(): Promise<Category[]> {
    return await db.select().from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.name));
  }

  async deleteCategory(id: number): Promise<boolean> {
    await db.delete(categories).where(eq(categories.id, id));
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

  // Audit Sessions
  async getAuditSession(id: number): Promise<AuditSession | undefined> {
    const [session] = await db.select().from(auditSessions).where(eq(auditSessions.id, id));
    return session;
  }

  async getAuditSessionByCode(code: string): Promise<AuditSession | undefined> {
    const [session] = await db.select().from(auditSessions).where(eq(auditSessions.sessionCode, code));
    return session;
  }

  async createAuditSession(insertSession: InsertAuditSession): Promise<AuditSession> {
    const [session] = await db.insert(auditSessions).values(insertSession).returning();
    return session;
  }

  async updateAuditSession(id: number, updateData: Partial<InsertAuditSession>): Promise<AuditSession | undefined> {
    const [session] = await db.update(auditSessions).set(updateData).where(eq(auditSessions.id, id)).returning();
    return session;
  }

  async getAllAuditSessions(): Promise<AuditSession[]> {
    return await db.select().from(auditSessions).orderBy(desc(auditSessions.startedAt));
  }

  async getActiveAuditSessions(): Promise<AuditSession[]> {
    return await db.select().from(auditSessions).where(eq(auditSessions.status, 'ACTIVE')).orderBy(desc(auditSessions.startedAt));
  }

  async getAuditSessionsByLibrary(libraryId: number): Promise<AuditSession[]> {
    return await db.select().from(auditSessions).where(eq(auditSessions.libraryId, libraryId)).orderBy(desc(auditSessions.startedAt));
  }

  // Inventory Items
  async getInventoryItem(id: number): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return item;
  }

  async getInventoryItemBySessionAndCopy(sessionId: number, copyId: number): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventoryItems).where(
      and(
        eq(inventoryItems.auditSessionId, sessionId),
        eq(inventoryItems.bookCopyId, copyId)
      )
    );
    return item;
  }

  async createInventoryItem(insertItem: InsertInventoryItem): Promise<InventoryItem> {
    const [item] = await db.insert(inventoryItems).values(insertItem).returning();
    return item;
  }

  async updateInventoryItem(id: number, updateData: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const [item] = await db.update(inventoryItems).set(updateData).where(eq(inventoryItems.id, id)).returning();
    return item;
  }

  async getInventoryItemsBySession(sessionId: number): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems).where(eq(inventoryItems.auditSessionId, sessionId)).orderBy(desc(inventoryItems.createdAt));
  }

  async getInventorySessionStats(sessionId: number): Promise<{ total: number; verified: number; missing: number; pending: number; discrepancy: number }> {
    const items = await db.select().from(inventoryItems).where(eq(inventoryItems.auditSessionId, sessionId));
    return {
      total: items.length,
      verified: items.filter(i => i.status === 'VERIFIED' || i.status === 'FOUND').length,
      missing: items.filter(i => i.status === 'MISSING').length,
      pending: items.filter(i => i.status === 'PENDING').length,
      discrepancy: items.filter(i => i.status === 'DISCREPANCY').length,
    };
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

  // ERP Integrations
  async getErpIntegration(id: number): Promise<ErpIntegration | undefined> {
    const [integration] = await db.select().from(erpIntegrations).where(eq(erpIntegrations.id, id));
    return integration;
  }

  async getErpIntegrationByAppId(appId: string): Promise<ErpIntegration | undefined> {
    const [integration] = await db.select().from(erpIntegrations).where(eq(erpIntegrations.appId, appId));
    return integration;
  }

  async createErpIntegration(insertIntegration: InsertErpIntegration): Promise<ErpIntegration> {
    const [integration] = await db.insert(erpIntegrations).values(insertIntegration).returning();
    return integration;
  }

  async updateErpIntegration(id: number, updateData: Partial<InsertErpIntegration>): Promise<ErpIntegration | undefined> {
    const [integration] = await db.update(erpIntegrations)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(erpIntegrations.id, id))
      .returning();
    return integration;
  }

  async deleteErpIntegration(id: number): Promise<boolean> {
    await db.delete(erpIntegrations).where(eq(erpIntegrations.id, id));
    return true;
  }

  async getAllErpIntegrations(): Promise<ErpIntegration[]> {
    return await db.select().from(erpIntegrations).orderBy(desc(erpIntegrations.createdAt));
  }

  async rotateErpSecret(id: number, newSecretHash: string, newSecretSalt: string): Promise<ErpIntegration | undefined> {
    const [integration] = await db.update(erpIntegrations)
      .set({ 
        secretHash: newSecretHash, 
        secretSalt: newSecretSalt, 
        secretLastRotatedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(erpIntegrations.id, id))
      .returning();
    return integration;
  }

  // ERP Whitelist
  async getErpWhitelist(id: number): Promise<ErpWhitelist | undefined> {
    const [whitelist] = await db.select().from(erpIntegrationWhitelist).where(eq(erpIntegrationWhitelist.id, id));
    return whitelist;
  }

  async getWhitelistByIntegration(integrationId: number): Promise<ErpWhitelist[]> {
    return await db.select().from(erpIntegrationWhitelist)
      .where(eq(erpIntegrationWhitelist.integrationId, integrationId))
      .orderBy(asc(erpIntegrationWhitelist.createdAt));
  }

  async createErpWhitelist(insertWhitelist: InsertErpWhitelist): Promise<ErpWhitelist> {
    const [whitelist] = await db.insert(erpIntegrationWhitelist).values(insertWhitelist).returning();
    return whitelist;
  }

  async updateErpWhitelist(id: number, updateData: Partial<InsertErpWhitelist>): Promise<ErpWhitelist | undefined> {
    const [whitelist] = await db.update(erpIntegrationWhitelist)
      .set(updateData)
      .where(eq(erpIntegrationWhitelist.id, id))
      .returning();
    return whitelist;
  }

  async deleteErpWhitelist(id: number): Promise<boolean> {
    await db.delete(erpIntegrationWhitelist).where(eq(erpIntegrationWhitelist.id, id));
    return true;
  }

  async countWhitelistByIntegration(integrationId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(erpIntegrationWhitelist)
      .where(eq(erpIntegrationWhitelist.integrationId, integrationId));
    return Number(result[0]?.count || 0);
  }

  // ERP Pull Endpoints
  async getErpPullEndpoint(id: number): Promise<ErpPullEndpoint | undefined> {
    const [endpoint] = await db.select().from(erpPullEndpoints).where(eq(erpPullEndpoints.id, id));
    return endpoint;
  }

  async getErpPullEndpointsByIntegration(integrationId: number): Promise<ErpPullEndpoint[]> {
    return await db.select().from(erpPullEndpoints)
      .where(eq(erpPullEndpoints.integrationId, integrationId))
      .orderBy(asc(erpPullEndpoints.name));
  }

  async createErpPullEndpoint(insertEndpoint: InsertErpPullEndpoint): Promise<ErpPullEndpoint> {
    const [endpoint] = await db.insert(erpPullEndpoints).values(insertEndpoint).returning();
    return endpoint;
  }

  async updateErpPullEndpoint(id: number, updateData: Partial<InsertErpPullEndpoint>): Promise<ErpPullEndpoint | undefined> {
    const [endpoint] = await db.update(erpPullEndpoints)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(erpPullEndpoints.id, id))
      .returning();
    return endpoint;
  }

  async deleteErpPullEndpoint(id: number): Promise<boolean> {
    await db.delete(erpPullEndpoints).where(eq(erpPullEndpoints.id, id));
    return true;
  }

  async updateErpPullEndpointTestStatus(id: number, status: string): Promise<ErpPullEndpoint | undefined> {
    const [endpoint] = await db.update(erpPullEndpoints)
      .set({ lastTestedAt: new Date(), lastTestStatus: status, updatedAt: new Date() })
      .where(eq(erpPullEndpoints.id, id))
      .returning();
    return endpoint;
  }

  // ERP Field Mappings
  async getErpFieldMapping(id: number): Promise<ErpFieldMapping | undefined> {
    const [mapping] = await db.select().from(erpFieldMappings).where(eq(erpFieldMappings.id, id));
    return mapping;
  }

  async getErpFieldMappingsByEndpoint(endpointId: number): Promise<ErpFieldMapping[]> {
    return await db.select().from(erpFieldMappings)
      .where(eq(erpFieldMappings.endpointId, endpointId))
      .orderBy(asc(erpFieldMappings.sortOrder));
  }

  async createErpFieldMapping(insertMapping: InsertErpFieldMapping): Promise<ErpFieldMapping> {
    const [mapping] = await db.insert(erpFieldMappings).values(insertMapping).returning();
    return mapping;
  }

  async updateErpFieldMapping(id: number, updateData: Partial<InsertErpFieldMapping>): Promise<ErpFieldMapping | undefined> {
    const [mapping] = await db.update(erpFieldMappings)
      .set(updateData)
      .where(eq(erpFieldMappings.id, id))
      .returning();
    return mapping;
  }

  async deleteErpFieldMapping(id: number): Promise<boolean> {
    await db.delete(erpFieldMappings).where(eq(erpFieldMappings.id, id));
    return true;
  }

  async deleteErpFieldMappingsByEndpoint(endpointId: number): Promise<boolean> {
    await db.delete(erpFieldMappings).where(eq(erpFieldMappings.endpointId, endpointId));
    return true;
  }

  // ERP Test Logs
  async getErpTestLog(id: number): Promise<ErpTestLog | undefined> {
    const [log] = await db.select().from(erpTestLogs).where(eq(erpTestLogs.id, id));
    return log;
  }

  async getErpTestLogsByEndpoint(endpointId: number, limit: number = 20): Promise<ErpTestLog[]> {
    return await db.select().from(erpTestLogs)
      .where(eq(erpTestLogs.endpointId, endpointId))
      .orderBy(desc(erpTestLogs.createdAt))
      .limit(limit);
  }

  async createErpTestLog(insertLog: InsertErpTestLog): Promise<ErpTestLog> {
    const [log] = await db.insert(erpTestLogs).values(insertLog).returning();
    return log;
  }

  async deleteErpTestLog(id: number): Promise<boolean> {
    await db.delete(erpTestLogs).where(eq(erpTestLogs.id, id));
    return true;
  }

  // Organizational Units
  async getOrgUnit(id: number): Promise<OrgUnit | undefined> {
    const [orgUnit] = await db.select().from(orgUnits).where(eq(orgUnits.id, id));
    return orgUnit;
  }

  async getOrgUnitByCode(code: string): Promise<OrgUnit | undefined> {
    const [orgUnit] = await db.select().from(orgUnits).where(eq(orgUnits.code, code));
    return orgUnit;
  }

  async createOrgUnit(insertOrgUnit: InsertOrgUnit): Promise<OrgUnit> {
    const [orgUnit] = await db.insert(orgUnits).values(insertOrgUnit).returning();
    return orgUnit;
  }

  async updateOrgUnit(id: number, updateData: Partial<InsertOrgUnit>): Promise<OrgUnit | undefined> {
    const [orgUnit] = await db.update(orgUnits)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(orgUnits.id, id))
      .returning();
    return orgUnit;
  }

  async deleteOrgUnit(id: number): Promise<boolean> {
    await db.delete(orgUnits).where(eq(orgUnits.id, id));
    return true;
  }

  async getAllOrgUnits(): Promise<OrgUnit[]> {
    return await db.select().from(orgUnits).orderBy(asc(orgUnits.sortOrder), asc(orgUnits.name));
  }

  async getOrgUnitsByParent(parentId: number | null): Promise<OrgUnit[]> {
    if (parentId === null) {
      return await db.select().from(orgUnits)
        .where(sql`${orgUnits.parentId} IS NULL`)
        .orderBy(asc(orgUnits.sortOrder), asc(orgUnits.name));
    }
    return await db.select().from(orgUnits)
      .where(eq(orgUnits.parentId, parentId))
      .orderBy(asc(orgUnits.sortOrder), asc(orgUnits.name));
  }

  async getOrgUnitsByType(type: string): Promise<OrgUnit[]> {
    return await db.select().from(orgUnits)
      .where(sql`${orgUnits.type} = ${type}`)
      .orderBy(asc(orgUnits.name));
  }

  // Libraries
  async getLibrary(id: number): Promise<Library | undefined> {
    const [library] = await db.select().from(libraries).where(eq(libraries.id, id));
    return library;
  }

  async getLibraryByCode(code: string): Promise<Library | undefined> {
    const [library] = await db.select().from(libraries).where(eq(libraries.code, code));
    return library;
  }

  async createLibrary(insertLibrary: InsertLibrary): Promise<Library> {
    const [library] = await db.insert(libraries).values(insertLibrary).returning();
    return library;
  }

  async updateLibrary(id: number, updateData: Partial<InsertLibrary>): Promise<Library | undefined> {
    const [library] = await db.update(libraries)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(libraries.id, id))
      .returning();
    return library;
  }

  async deleteLibrary(id: number): Promise<boolean> {
    await db.delete(libraries).where(eq(libraries.id, id));
    return true;
  }

  async getAllLibraries(): Promise<Library[]> {
    return await db.select().from(libraries).orderBy(asc(libraries.name));
  }

  async getLibrariesByOrgUnit(orgUnitId: number): Promise<Library[]> {
    return await db.select().from(libraries)
      .where(eq(libraries.orgUnitId, orgUnitId))
      .orderBy(asc(libraries.name));
  }

  async getActiveLibraries(): Promise<Library[]> {
    return await db.select().from(libraries)
      .where(eq(libraries.isActive, true))
      .orderBy(asc(libraries.name));
  }

  // Book Copies
  async getBookCopy(id: number): Promise<BookCopy | undefined> {
    const [bookCopy] = await db.select().from(bookCopies).where(eq(bookCopies.id, id));
    return bookCopy;
  }

  async getBookCopyByBarcode(barcode: string): Promise<BookCopy | undefined> {
    const [bookCopy] = await db.select().from(bookCopies).where(eq(bookCopies.barcode, barcode));
    return bookCopy;
  }

  async createBookCopy(insertBookCopy: InsertBookCopy): Promise<BookCopy> {
    const [bookCopy] = await db.insert(bookCopies).values(insertBookCopy).returning();
    return bookCopy;
  }

  async createBookCopies(bookId: number, quantity: number, shelfLocation?: string, acquisitionDate?: Date, acquisitionSource?: string, price?: number): Promise<BookCopy[]> {
    const copies: BookCopy[] = [];
    const timestamp = Date.now();
    
    for (let i = 0; i < quantity; i++) {
      const barcode = `BC-${bookId}-${timestamp}-${String(i + 1).padStart(4, '0')}`;
      const [bookCopy] = await db.insert(bookCopies).values({
        bookId,
        libraryId: null,
        barcode,
        shelfLocation: shelfLocation || null,
        status: 'AVAILABLE',
        condition: 'GOOD',
        acquisitionDate: acquisitionDate || null,
        acquisitionSource: acquisitionSource || null,
        price: price || null,
      }).returning();
      copies.push(bookCopy);
    }
    
    return copies;
  }

  async updateBookCopy(id: number, updateData: Partial<InsertBookCopy>): Promise<BookCopy | undefined> {
    const [bookCopy] = await db.update(bookCopies)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(bookCopies.id, id))
      .returning();
    return bookCopy;
  }

  async deleteBookCopy(id: number): Promise<boolean> {
    await db.delete(bookCopies).where(eq(bookCopies.id, id));
    return true;
  }

  async getAllBookCopies(): Promise<BookCopy[]> {
    return await db.select().from(bookCopies).orderBy(asc(bookCopies.barcode));
  }

  async getBookCopiesByBook(bookId: number): Promise<BookCopy[]> {
    return await db.select().from(bookCopies)
      .where(eq(bookCopies.bookId, bookId))
      .orderBy(asc(bookCopies.barcode));
  }

  async getBookCopiesByLibrary(libraryId: number): Promise<BookCopy[]> {
    return await db.select().from(bookCopies)
      .where(eq(bookCopies.libraryId, libraryId))
      .orderBy(asc(bookCopies.barcode));
  }

  async getBookCopiesByBookAndLibrary(bookId: number, libraryId: number): Promise<BookCopy[]> {
    return await db.select().from(bookCopies)
      .where(and(eq(bookCopies.bookId, bookId), eq(bookCopies.libraryId, libraryId)))
      .orderBy(asc(bookCopies.internalSSN), asc(bookCopies.barcode));
  }

  async getCirculationHistoryByCopy(bookCopyId: number): Promise<Circulation[]> {
    return await db.select().from(circulation)
      .where(eq(circulation.bookCopyId, bookCopyId))
      .orderBy(desc(circulation.checkoutDate));
  }

  async getRecentCirculationByBook(bookId: number, limit: number = 10): Promise<Circulation[]> {
    // Get all copy IDs for this book
    const copies = await db.select({ id: bookCopies.id })
      .from(bookCopies)
      .where(eq(bookCopies.bookId, bookId));
    
    if (copies.length === 0) return [];
    
    const copyIds = copies.map(c => c.id);
    
    // Get recent circulation records for these copies
    return await db.select().from(circulation)
      .where(inArray(circulation.bookCopyId, copyIds))
      .orderBy(desc(circulation.checkoutDate))
      .limit(limit);
  }

  async getBookFinesSummary(bookId: number): Promise<{ paidFines: number; outstandingFines: number; waivedFines: number }> {
    // Get all copy IDs for this book
    const copies = await db.select({ id: bookCopies.id })
      .from(bookCopies)
      .where(eq(bookCopies.bookId, bookId));
    
    if (copies.length === 0) {
      return { paidFines: 0, outstandingFines: 0, waivedFines: 0 };
    }
    
    const copyIds = copies.map(c => c.id);
    
    // Get all circulation records for these copies with fines
    const circulationRecords = await db.select({
      fineAmount: circulation.fineAmount,
      fineStatus: circulation.fineStatus,
    })
      .from(circulation)
      .where(inArray(circulation.bookCopyId, copyIds));
    
    let paidFines = 0;
    let outstandingFines = 0;
    let waivedFines = 0;
    
    for (const record of circulationRecords) {
      const amount = record.fineAmount || 0;
      switch (record.fineStatus) {
        case 'PAID':
          paidFines += amount;
          break;
        case 'PENDING':
          outstandingFines += amount;
          break;
        case 'WAIVED':
          waivedFines += amount;
          break;
      }
    }
    
    return { paidFines, outstandingFines, waivedFines };
  }

  async getUnallocatedCopies(): Promise<BookCopy[]> {
    return await db.select().from(bookCopies)
      .where(isNull(bookCopies.libraryId))
      .orderBy(asc(bookCopies.barcode));
  }

  async getUnallocatedCopiesWithBookInfo(): Promise<UnallocatedCopyInfo[]> {
    const unallocatedCopies = await db.select({
      copyId: bookCopies.id,
      copyBarcode: bookCopies.barcode,
      copyShelfLocation: bookCopies.shelfLocation,
      copyStatus: bookCopies.status,
      copyCreatedAt: bookCopies.createdAt,
      bookId: books.id,
      bookTitle: books.title,
      bookAuthor: books.author,
      bookIsbn: books.isbn,
      bookFormat: books.format,
    })
      .from(bookCopies)
      .leftJoin(books, eq(bookCopies.bookId, books.id))
      .where(isNull(bookCopies.libraryId))
      .orderBy(asc(books.title), asc(bookCopies.barcode));

    const grouped = new Map<number, UnallocatedCopyInfo>();
    
    for (const row of unallocatedCopies) {
      if (!row.bookId) continue;
      
      if (!grouped.has(row.bookId)) {
        grouped.set(row.bookId, {
          bookId: row.bookId,
          bookTitle: row.bookTitle || '',
          bookAuthor: row.bookAuthor || '',
          bookIsbn: row.bookIsbn || '',
          bookFormat: row.bookFormat || 'PHYSICAL',
          totalUnallocatedCopies: 0,
          copies: [],
        });
      }
      
      const bookInfo = grouped.get(row.bookId)!;
      bookInfo.totalUnallocatedCopies++;
      bookInfo.copies.push({
        id: row.copyId,
        barcode: row.copyBarcode,
        shelfLocation: row.copyShelfLocation,
        status: row.copyStatus,
        createdAt: row.copyCreatedAt,
      });
    }
    
    return Array.from(grouped.values());
  }

  async allocateCopies(copyIds: number[], libraryId: number, generateSSN: boolean, ssnPrefix?: string): Promise<BookCopy[]> {
    const allocatedCopies: BookCopy[] = [];
    const prefix = ssnPrefix || 'SSN';
    const batchTimestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    for (let i = 0; i < copyIds.length; i++) {
      const copyId = copyIds[i];
      
      const existingCopy = await db.select().from(bookCopies).where(eq(bookCopies.id, copyId));
      if (!existingCopy[0] || existingCopy[0].libraryId !== null) {
        throw new Error(`Copy ${copyId} is already allocated or not found`);
      }
      
      const updates: any = {
        libraryId,
        allocatedAt: new Date(),
        updatedAt: new Date(),
      };
      
      if (generateSSN && !existingCopy[0].internalSSN) {
        updates.internalSSN = `${prefix}-${batchTimestamp}-${randomSuffix}-${String(i + 1).padStart(4, '0')}`;
      }
      
      const [updatedCopy] = await db.update(bookCopies)
        .set(updates)
        .where(and(eq(bookCopies.id, copyId), isNull(bookCopies.libraryId)))
        .returning();
      
      if (!updatedCopy) {
        throw new Error(`Failed to allocate copy ${copyId} - may have been allocated by another process`);
      }
      
      allocatedCopies.push(updatedCopy);
    }
    
    return allocatedCopies;
  }

  async getAvailableCopiesByLibrary(libraryId: number): Promise<BookCopy[]> {
    return await db.select().from(bookCopies)
      .where(and(
        eq(bookCopies.libraryId, libraryId),
        eq(bookCopies.status, 'AVAILABLE')
      ))
      .orderBy(asc(bookCopies.barcode));
  }

  // Book Transfers
  async getBookTransfer(id: number): Promise<BookTransfer | undefined> {
    const [transfer] = await db.select().from(bookTransfers).where(eq(bookTransfers.id, id));
    return transfer;
  }

  async createBookTransfer(insertTransfer: InsertBookTransfer): Promise<BookTransfer> {
    const [transfer] = await db.insert(bookTransfers).values(insertTransfer).returning();
    return transfer;
  }

  async updateBookTransfer(id: number, updateData: Partial<InsertBookTransfer>): Promise<BookTransfer | undefined> {
    const [transfer] = await db.update(bookTransfers)
      .set(updateData)
      .where(eq(bookTransfers.id, id))
      .returning();
    return transfer;
  }

  async getTransfersBySourceLibrary(libraryId: number): Promise<BookTransfer[]> {
    return await db.select().from(bookTransfers)
      .where(eq(bookTransfers.sourceLibraryId, libraryId))
      .orderBy(desc(bookTransfers.requestDate));
  }

  async getTransfersByDestinationLibrary(libraryId: number): Promise<BookTransfer[]> {
    return await db.select().from(bookTransfers)
      .where(eq(bookTransfers.destinationLibraryId, libraryId))
      .orderBy(desc(bookTransfers.requestDate));
  }

  async getPendingTransfers(): Promise<BookTransfer[]> {
    return await db.select().from(bookTransfers)
      .where(eq(bookTransfers.status, 'PENDING'))
      .orderBy(desc(bookTransfers.requestDate));
  }

  // Library Memberships
  async getLibraryMembership(id: number): Promise<LibraryMembership | undefined> {
    const [membership] = await db.select().from(libraryMemberships).where(eq(libraryMemberships.id, id));
    return membership;
  }

  async createLibraryMembership(insertMembership: InsertLibraryMembership): Promise<LibraryMembership> {
    const [membership] = await db.insert(libraryMemberships).values(insertMembership).returning();
    return membership;
  }

  async updateLibraryMembership(id: number, updateData: Partial<InsertLibraryMembership>): Promise<LibraryMembership | undefined> {
    const [membership] = await db.update(libraryMemberships)
      .set(updateData)
      .where(eq(libraryMemberships.id, id))
      .returning();
    return membership;
  }

  async deleteLibraryMembership(id: number): Promise<boolean> {
    await db.delete(libraryMemberships).where(eq(libraryMemberships.id, id));
    return true;
  }

  async getMembershipsByUser(userId: number): Promise<LibraryMembership[]> {
    return await db.select().from(libraryMemberships)
      .where(eq(libraryMemberships.userId, userId));
  }

  async getMembershipsByLibrary(libraryId: number): Promise<LibraryMembership[]> {
    return await db.select().from(libraryMemberships)
      .where(eq(libraryMemberships.libraryId, libraryId));
  }

  // Library Dashboard
  async getLibraryDashboard(libraryId: number): Promise<LibraryDashboardStats> {
    const library = await this.getLibrary(libraryId);
    if (!library) {
      throw new Error(`Library with id ${libraryId} not found`);
    }

    let orgUnitName: string | null = null;
    if (library.orgUnitId) {
      const orgUnit = await this.getOrgUnit(library.orgUnitId);
      orgUnitName = orgUnit?.name || null;
    }

    const copies = await db.select().from(bookCopies)
      .where(eq(bookCopies.libraryId, libraryId));
    
    const bookIdSet = new Set<number>();
    copies.forEach(c => bookIdSet.add(c.bookId));
    const bookIds = Array.from(bookIdSet);
    
    const booksList = bookIds.length > 0 
      ? await db.select().from(books).where(sql`${books.id} IN (${sql.join(bookIds.map(id => sql`${id}`), sql`, `)})`)
      : [];
    
    const bookFormatMap = new Map<number, string>();
    booksList.forEach(b => bookFormatMap.set(b.id, b.format));
    
    let physicalBooks = 0;
    let ebooks = 0;
    let audiobooks = 0;
    let availableCopies = 0;
    let checkedOutCopies = 0;
    let lostCopies = 0;
    let damagedCopies = 0;
    let inTransitCopies = 0;
    let reservedCopies = 0;

    for (const copy of copies) {
      const format = bookFormatMap.get(copy.bookId) || 'PHYSICAL';
      if (format === 'PHYSICAL') physicalBooks++;
      else if (format === 'EBOOK') ebooks++;
      else if (format === 'AUDIOBOOK') audiobooks++;

      switch (copy.status) {
        case 'AVAILABLE': availableCopies++; break;
        case 'CHECKED_OUT': checkedOutCopies++; break;
        case 'LOST': lostCopies++; break;
        case 'DAMAGED': damagedCopies++; break;
        case 'IN_TRANSIT': inTransitCopies++; break;
        case 'RESERVED': reservedCopies++; break;
      }
    }

    const circulationRecords = await db.select().from(circulation)
      .where(eq(circulation.libraryId, libraryId));
    
    const now = new Date();
    let activeCirculations = 0;
    let overdueItems = 0;
    let totalFinesOutstanding = 0;
    let totalFinesPaid = 0;
    let totalFinesWaived = 0;

    for (const circ of circulationRecords) {
      if (circ.status === 'ACTIVE' || circ.status === 'OVERDUE') {
        activeCirculations++;
        if (circ.dueDate < now && !circ.returnDate) {
          overdueItems++;
        }
      }
      
      const amount = circ.fineAmount || 0;
      if (circ.fineStatus === 'OUTSTANDING' || !circ.fineStatus) {
        totalFinesOutstanding += amount;
      } else if (circ.fineStatus === 'PAID') {
        totalFinesPaid += amount;
      } else if (circ.fineStatus === 'WAIVED') {
        totalFinesWaived += amount;
      }
    }

    const transfersIn = await db.select().from(bookTransfers)
      .where(and(
        eq(bookTransfers.destinationLibraryId, libraryId),
        eq(bookTransfers.status, 'PENDING')
      ));
    
    const transfersOut = await db.select().from(bookTransfers)
      .where(and(
        eq(bookTransfers.sourceLibraryId, libraryId),
        eq(bookTransfers.status, 'PENDING')
      ));

    const memberships = await db.select().from(libraryMemberships)
      .where(and(
        eq(libraryMemberships.libraryId, libraryId),
        eq(libraryMemberships.isActive, true)
      ));

    return {
      libraryId,
      libraryName: library.name,
      libraryCode: library.code,
      orgUnitName,
      
      totalCopies: copies.length,
      physicalBooks,
      ebooks,
      audiobooks,
      
      availableCopies,
      checkedOutCopies,
      lostCopies,
      damagedCopies,
      inTransitCopies,
      reservedCopies,
      
      activeCirculations,
      overdueItems,
      
      totalFinesOutstanding,
      totalFinesPaid,
      totalFinesWaived,
      
      pendingTransfersIn: transfersIn.length,
      pendingTransfersOut: transfersOut.length,
      
      totalMembers: memberships.length,
    };
  }

  async getLibraryResources(params: LibraryResourcesSearchParams): Promise<{ resources: LibraryResourceStats[]; total: number; categories: string[] }> {
    const { libraryId, query, format, category, status, limit = 50, offset = 0 } = params;
    
    const copies = await db.select().from(bookCopies)
      .where(eq(bookCopies.libraryId, libraryId));
    
    if (copies.length === 0) {
      return { resources: [], total: 0, categories: [] };
    }
    
    const copyStatsByBook = new Map<number, { available: number; checkedOut: number; reserved: number; damaged: number; lost: number; inTransit: number; total: number }>();
    
    for (const copy of copies) {
      if (!copyStatsByBook.has(copy.bookId)) {
        copyStatsByBook.set(copy.bookId, { available: 0, checkedOut: 0, reserved: 0, damaged: 0, lost: 0, inTransit: 0, total: 0 });
      }
      const stats = copyStatsByBook.get(copy.bookId)!;
      stats.total++;
      switch (copy.status) {
        case 'AVAILABLE': stats.available++; break;
        case 'CHECKED_OUT': stats.checkedOut++; break;
        case 'RESERVED': stats.reserved++; break;
        case 'DAMAGED': stats.damaged++; break;
        case 'LOST': stats.lost++; break;
        case 'IN_TRANSIT': stats.inTransit++; break;
      }
    }
    
    const bookIds = Array.from(copyStatsByBook.keys());
    
    const booksList = await db.select().from(books)
      .where(sql`${books.id} IN (${sql.join(bookIds.map(id => sql`${id}`), sql`, `)})`);
    
    const allCategories = [...new Set(booksList.map(b => b.category))].sort();
    
    let filteredBooks = booksList;
    
    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredBooks = filteredBooks.filter(b => 
        b.title.toLowerCase().includes(lowerQuery) ||
        b.author.toLowerCase().includes(lowerQuery) ||
        b.isbn.toLowerCase().includes(lowerQuery) ||
        (b.publisher && b.publisher.toLowerCase().includes(lowerQuery))
      );
    }
    
    if (format) {
      filteredBooks = filteredBooks.filter(b => b.format === format);
    }
    
    if (category) {
      filteredBooks = filteredBooks.filter(b => b.category === category);
    }
    
    if (status) {
      filteredBooks = filteredBooks.filter(b => {
        const stats = copyStatsByBook.get(b.id);
        if (!stats) return false;
        switch (status) {
          case 'AVAILABLE': return stats.available > 0;
          case 'CHECKED_OUT': return stats.checkedOut > 0;
          case 'RESERVED': return stats.reserved > 0;
          case 'DAMAGED': return stats.damaged > 0;
          case 'LOST': return stats.lost > 0;
          case 'IN_TRANSIT': return stats.inTransit > 0;
          case 'ALL_ISSUED': return stats.available === 0 && stats.total > 0;
          default: return true;
        }
      });
    }
    
    const total = filteredBooks.length;
    
    const paginatedBooks = filteredBooks.slice(offset, offset + limit);
    
    const resources: LibraryResourceStats[] = paginatedBooks.map(book => {
      const stats = copyStatsByBook.get(book.id)!;
      return {
        bookId: book.id,
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        publishedYear: book.publishedYear,
        category: book.category,
        format: book.format,
        coverUrl: book.coverUrl,
        totalCopies: stats.total,
        available: stats.available,
        checkedOut: stats.checkedOut,
        reserved: stats.reserved,
        damaged: stats.damaged,
        lost: stats.lost,
        inTransit: stats.inTransit,
      };
    });
    
    return { resources, total, categories: allCategories };
  }
}

export const storage = new DBStorage();
