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
  type StaffAllocationLog,
  type AuditLog,
  type InsertAuditLog,
  type AuditSession,
  type InsertAuditSession,
  type InventoryItem,
  type InsertInventoryItem,
  type Session,
  type InsertSession,
  type SearchAttributeType,
  type InsertSearchAttributeType,
  type SearchAttributeValue,
  type InsertSearchAttributeValue,
  type ResourceSearchAttribute,
  type InsertResourceSearchAttribute,
  type DigitalResourceSearchAttribute,
  type InsertDigitalResourceSearchAttribute,
  type PaymentMethod,
  type InsertPaymentMethod,
  type FinePayment,
  type InsertFinePayment,
  type FineWaiverRequest,
  type InsertFineWaiverRequest,
  type Reservation,
  type InsertReservation,
  type ReservationPickup,
  type InsertReservationPickup,
  type DigitalResource,
  type InsertDigitalResource,
  type DigitalResourceVersion,
  type InsertDigitalResourceVersion,
  type ResourceTypeSetting,
  type InsertResourceTypeSetting,
  type LostDamagedReport,
  type InsertLostDamagedReport,
  type LostDamagedReportHistory,
  lostDamagedReports,
  lostDamagedReportHistory,
  digitalResources,
  digitalResourceVersions,
  resourceTypeSettings,
  circulationPolicyVersions,
  type CirculationPolicyVersion,
  type InsertCirculationPolicyVersion,
  paymentMethods,
  finePayments,
  fineWaiverRequests,
  reservations,
  reservationPickups,
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
  staffAllocationLogs,
  auditLogs,
  auditSessions,
  inventoryItems,
  sessions,
  searchAttributeTypes,
  searchAttributeValues,
  resourceSearchAttributes,
  digitalResourceSearchAttributes,
} from "@shared/schema";

export interface AuditLogFilters {
  category?: string;
  action?: string;
  userId?: number;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

// Type for staff allocation logs with user and library details
export interface StaffAllocationLogWithDetails extends StaffAllocationLog {
  staffUserName: string;
  staffUserRole: string;
  libraryName: string;
  performedByName: string;
}

export interface LibraryStaffMember {
  id: number;
  userId: number;
  name: string;
  email: string;
  role: string;
  allocatedAt: Date;
}
import { db, nullifyForInsert, returningViaCte } from "./db";
import { eq, and, or, like, desc, asc, sql, isNull, inArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersByCategory(category: 'STAFF' | 'PATRON'): Promise<User[]>;
  deleteUser(id: number): Promise<boolean>;
  getUserByExternalId(externalId: string, erpIntegrationId: number): Promise<User | undefined>;
  getUserByExternalIdOnly(externalId: string): Promise<User | undefined>;
  getUsersByErpIntegration(erpIntegrationId: number): Promise<User[]>;
  updateUserLastLogin(id: number): Promise<void>;
  
  // Sessions
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  getSessionWithUser(id: string): Promise<{ session: Session; user: User } | undefined>;
  deleteSession(id: string): Promise<boolean>;
  deleteExpiredSessions(): Promise<number>;
  deleteUserSessions(userId: number): Promise<number>;
  
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
  getActiveCirculationByBookAll(bookId: number): Promise<Circulation[]>;
  getCirculationByUser(userId: number): Promise<Circulation[]>;
  getActiveCirculations(): Promise<Circulation[]>;

  // Payment Methods
  getAllPaymentMethods(): Promise<PaymentMethod[]>;
  getActivePaymentMethods(): Promise<PaymentMethod[]>;
  getPaymentMethod(id: number): Promise<PaymentMethod | undefined>;
  createPaymentMethod(data: InsertPaymentMethod): Promise<PaymentMethod>;
  updatePaymentMethod(id: number, data: Partial<InsertPaymentMethod>): Promise<PaymentMethod | undefined>;
  deletePaymentMethod(id: number): Promise<boolean>;

  // Resource Type Settings
  getAllResourceTypeSettings(): Promise<ResourceTypeSetting[]>;
  getResourceTypeSetting(resourceType: string): Promise<ResourceTypeSetting | undefined>;
  upsertResourceTypeSetting(resourceType: string, data: Partial<InsertResourceTypeSetting>): Promise<ResourceTypeSetting>;

  // Fine Payments
  createFinePayment(data: InsertFinePayment): Promise<FinePayment>;
  getFinePaymentsByCirculation(circulationId: number): Promise<FinePayment[]>;
  getFinePayments(filters: { fromDate?: Date; toDate?: Date; libraryId?: number; paymentMethodId?: number; paymentType?: 'FINE' | 'DAMAGE' }): Promise<FinePayment[]>;

  // Fine Waiver Requests
  createFineWaiverRequest(data: InsertFineWaiverRequest): Promise<FineWaiverRequest>;
  getFineWaiverRequest(id: number): Promise<FineWaiverRequest | undefined>;
  getFineWaiverRequests(status?: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<FineWaiverRequest[]>;
  updateFineWaiverRequest(id: number, data: Partial<{ status: 'PENDING' | 'APPROVED' | 'REJECTED'; reviewedBy: number; reviewedAt: Date; reviewNotes: string }>): Promise<FineWaiverRequest | undefined>;
  
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
  updateErpIntegrationToken(id: number, token: string, expiresAt: Date): Promise<void>;
  deleteErpIntegration(id: number): Promise<boolean>;
  getAllErpIntegrations(): Promise<ErpIntegration[]>;
  rotateErpSecret(id: number, newSecretKey: string, newSecretHash: string, newSecretSalt: string): Promise<ErpIntegration | undefined>;
  
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
  
  // Staff Library Allocations
  getStaffLibraryAllocations(staffUserId: number): Promise<LibraryMembership[]>;
  allocateStaffToLibrary(staffUserId: number, libraryId: number, performedByUserId: number, reason?: string): Promise<LibraryMembership>;
  deallocateStaffFromLibrary(staffUserId: number, libraryId: number, performedByUserId: number, reason?: string): Promise<boolean>;
  getStaffAllocationLogs(staffUserId?: number): Promise<StaffAllocationLog[]>;
  getStaffAllocationLogsWithDetails(staffUserId?: number): Promise<StaffAllocationLogWithDetails[]>;
  getLibraryStaff(libraryId: number): Promise<LibraryStaffMember[]>;
  
  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  queryAuditLogs(filters: AuditLogFilters): Promise<{ logs: AuditLog[]; total: number }>;

  // Library Dashboard
  getLibraryDashboard(libraryId: number): Promise<LibraryDashboardStats>;
  
  // Library Resources
  getLibraryResources(params: LibraryResourcesSearchParams): Promise<{ resources: LibraryResourceStats[]; total: number; categories: string[] }>;

  // Circulation Policy Versions
  createCirculationPolicyVersion(data: InsertCirculationPolicyVersion): Promise<CirculationPolicyVersion>;
  getCirculationPolicyVersions(params: { scope?: 'GLOBAL' | 'LIBRARY'; libraryId?: number | null; limit?: number }): Promise<CirculationPolicyVersion[]>;

  // Search Attribute Types
  getAllSearchAttributeTypes(): Promise<SearchAttributeType[]>;
  getActiveSearchAttributeTypes(): Promise<SearchAttributeType[]>;
  getBookIdsByAttributeValueIds(attributeValueIds: number[]): Promise<number[]>;
  getSearchAttributeType(id: number): Promise<SearchAttributeType | undefined>;
  createSearchAttributeType(data: InsertSearchAttributeType): Promise<SearchAttributeType>;
  updateSearchAttributeType(id: number, data: Partial<InsertSearchAttributeType>): Promise<SearchAttributeType | undefined>;
  deleteSearchAttributeType(id: number): Promise<boolean>;

  // Search Attribute Values
  getSearchAttributeValuesByType(typeId: number): Promise<SearchAttributeValue[]>;
  getSearchAttributeValue(id: number): Promise<SearchAttributeValue | undefined>;
  createSearchAttributeValue(data: InsertSearchAttributeValue): Promise<SearchAttributeValue>;
  updateSearchAttributeValue(id: number, data: Partial<InsertSearchAttributeValue>): Promise<SearchAttributeValue | undefined>;
  deleteSearchAttributeValue(id: number): Promise<boolean>;

  // Resource Search Attributes (assignments)
  getResourceSearchAttributes(bookId: number): Promise<(ResourceSearchAttribute & { attributeValue: string; attributeTypeName: string; attributeTypeId: number })[]>;
  getResourceSearchAttributesForBooks(bookIds: number[]): Promise<Map<number, { attributeValueId: number; attributeValue: string; attributeTypeName: string; attributeTypeId: number }[]>>;
  assignSearchAttribute(bookId: number, attributeValueId: number): Promise<ResourceSearchAttribute>;
  removeSearchAttribute(bookId: number, attributeValueId: number): Promise<boolean>;
  setResourceSearchAttributes(bookId: number, attributeValueIds: number[]): Promise<void>;
  searchBooksByAttributes(attributeValueIds: number[]): Promise<number[]>;

  // Digital Resource Search Attributes (assignments)
  getDigitalResourceSearchAttributes(digitalResourceId: number): Promise<(DigitalResourceSearchAttribute & { attributeValue: string; attributeTypeName: string; attributeTypeId: number })[]>;
  setDigitalResourceSearchAttributes(digitalResourceId: number, attributeValueIds: number[]): Promise<void>;
  getDigitalResourceIdsByAttributeValueIds(attributeValueIds: number[]): Promise<number[]>;

  // Digital Resources
  getDigitalResource(id: number): Promise<DigitalResource | undefined>;
  createDigitalResource(data: InsertDigitalResource): Promise<DigitalResource>;
  updateDigitalResource(id: number, data: Partial<InsertDigitalResource>): Promise<DigitalResource | undefined>;
  deleteDigitalResource(id: number): Promise<boolean>;
  listDigitalResources(filters: DigitalResourceFilters): Promise<{ resources: DigitalResource[]; total: number }>;
  listVisibleDigitalResources(user: { id: number; role: string; department: string | null }, filters: DigitalResourceFilters): Promise<{ resources: DigitalResource[]; total: number }>;
  searchDigitalResourcesByAttributes(options: { attributeValueIds: number[]; searchQuery?: string; limit: number }): Promise<{ resources: DigitalResource[]; totalCount: number; limitExceeded: boolean }>;
  incrementDigitalResourceDownloadCount(id: number): Promise<void>;
  incrementDigitalResourceViewCount(id: number): Promise<void>;

  // Digital Resource Versions
  createDigitalResourceVersion(data: InsertDigitalResourceVersion): Promise<DigitalResourceVersion>;
  getDigitalResourceVersions(resourceId: number): Promise<DigitalResourceVersion[]>;
  getDigitalResourceVersion(id: number): Promise<DigitalResourceVersion | undefined>;

  // Lost & Damaged Reports
  getLostDamagedReports(filters: { type?: string; status?: string; libraryId?: number; patronId?: number; search?: string; limit?: number; offset?: number }): Promise<{ reports: (LostDamagedReport & { bookTitle: string; bookIsbn: string; bookCopyAccession: string | null; patronName: string | null; libraryName: string | null })[]; total: number }>;
  getLostDamagedReport(id: number): Promise<(LostDamagedReport & { bookTitle: string; bookIsbn: string; bookCopyAccession: string | null; patronName: string | null; libraryName: string | null }) | undefined>;
  createLostDamagedReport(data: InsertLostDamagedReport): Promise<LostDamagedReport>;
  updateLostDamagedReport(id: number, data: Partial<LostDamagedReport>): Promise<LostDamagedReport | undefined>;
  getLostDamagedReportHistory(reportId: number): Promise<LostDamagedReportHistory[]>;
  addLostDamagedReportHistory(entry: { reportId: number; action: string; fromStatus?: string; toStatus?: string; notes?: string; performedBy?: number; performedByName?: string }): Promise<LostDamagedReportHistory>;
}

export interface DigitalResourceFilters {
  search?: string;
  department?: string;
  course?: string;
  semester?: string;
  resourceType?: string;
  category?: string;
  faculty?: string;
  uploadedBy?: number;
  status?: string;
  libraryId?: number;
  tags?: string[];
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
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
  attributeValueIds?: number[];
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

  async getUsersByCategory(category: 'STAFF' | 'PATRON'): Promise<User[]> {
    return await db.select().from(users)
      .where(eq(users.category, category))
      .orderBy(asc(users.name));
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getUserByExternalId(externalId: string, erpIntegrationId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(
        eq(users.externalId, externalId),
        eq(users.erpIntegrationId, erpIntegrationId)
      )
    );
    return user;
  }

  async getUserByExternalIdOnly(externalId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      eq(users.externalId, externalId)
    );
    return user;
  }

  async getUsersByErpIntegration(erpIntegrationId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.erpIntegrationId, erpIntegrationId));
  }

  async updateUserLastLogin(id: number): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }

  // Sessions
  async createSession(session: InsertSession): Promise<Session> {
    const [created] = await db.insert(sessions).values(session).returning();
    return created;
  }

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async getSessionWithUser(id: string): Promise<{ session: Session; user: User } | undefined> {
    const result = await db.select({
      session: sessions,
      user: users
    })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, id));
    
    if (result.length === 0) return undefined;
    return result[0];
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await db.delete(sessions).where(
      sql`${sessions.expiresAt} < NOW()`
    );
    return result.rowCount ?? 0;
  }

  async deleteUserSessions(userId: number): Promise<number> {
    const result = await db.delete(sessions).where(eq(sessions.userId, userId));
    return result.rowCount ?? 0;
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

  async getActiveCirculationByBookAll(bookId: number): Promise<Circulation[]> {
    try {
      return await db.select().from(circulation).where(
        and(
          eq(circulation.bookId, bookId),
          inArray(circulation.status, ['ACTIVE', 'OVERDUE'])
        )
      );
    } catch (err) {
      console.error("getActiveCirculationByBookAll query failed, falling back:", err);
      const all = await db.select().from(circulation).where(eq(circulation.bookId, bookId));
      return all.filter(c => c.status === 'ACTIVE' || c.status === 'OVERDUE');
    }
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

  async updateErpIntegrationToken(id: number, token: string, expiresAt: Date): Promise<void> {
    await db.update(erpIntegrations)
      .set({ 
        cachedAuthToken: token, 
        cachedAuthTokenExpiresAt: expiresAt,
        updatedAt: new Date() 
      })
      .where(eq(erpIntegrations.id, id));
  }

  async deleteErpIntegration(id: number): Promise<boolean> {
    await db.delete(sessions).where(eq(sessions.erpIntegrationId, id));
    await db.update(users).set({ erpIntegrationId: null }).where(eq(users.erpIntegrationId, id));
    await db.delete(erpIntegrations).where(eq(erpIntegrations.id, id));
    return true;
  }

  async getAllErpIntegrations(): Promise<ErpIntegration[]> {
    return await db.select().from(erpIntegrations).orderBy(desc(erpIntegrations.createdAt));
  }

  async rotateErpSecret(id: number, newSecretKey: string, newSecretHash: string, newSecretSalt: string): Promise<ErpIntegration | undefined> {
    const [integration] = await db.update(erpIntegrations)
      .set({ 
        secretKey: newSecretKey,
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
    const copies = await db.select({ id: bookCopies.id })
      .from(bookCopies)
      .where(eq(bookCopies.bookId, bookId));
    
    const copyIds = copies.map(c => c.id);
    
    const conditions = [eq(circulation.bookId, bookId)];
    if (copyIds.length > 0) {
      conditions.push(inArray(circulation.bookCopyId, copyIds));
    }
    
    return await db.select().from(circulation)
      .where(or(...conditions))
      .orderBy(desc(circulation.checkoutDate))
      .limit(limit);
  }

  async getBookFinesSummary(bookId: number): Promise<{ paidFines: number; outstandingFines: number; waivedFines: number }> {
    const copies = await db.select({ id: bookCopies.id })
      .from(bookCopies)
      .where(eq(bookCopies.bookId, bookId));
    
    const copyIds = copies.map(c => c.id);
    
    const conditions = [eq(circulation.bookId, bookId)];
    if (copyIds.length > 0) {
      conditions.push(inArray(circulation.bookCopyId, copyIds));
    }
    
    const circulationRecords = await db.select({
      fineAmount: circulation.fineAmount,
      fineStatus: circulation.fineStatus,
    })
      .from(circulation)
      .where(or(...conditions));
    
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

  // Staff Library Allocations
  async getStaffLibraryAllocations(staffUserId: number): Promise<LibraryMembership[]> {
    return await db.select().from(libraryMemberships)
      .where(and(
        eq(libraryMemberships.userId, staffUserId),
        eq(libraryMemberships.isActive, true)
      ));
  }

  async allocateStaffToLibrary(staffUserId: number, libraryId: number, performedByUserId: number, reason?: string): Promise<LibraryMembership> {
    // Check if allocation already exists
    const existing = await db.select().from(libraryMemberships)
      .where(and(
        eq(libraryMemberships.userId, staffUserId),
        eq(libraryMemberships.libraryId, libraryId)
      ));
    
    let membership: LibraryMembership;
    
    if (existing.length > 0) {
      // Reactivate existing membership
      const [updated] = await db.update(libraryMemberships)
        .set({ isActive: true })
        .where(eq(libraryMemberships.id, existing[0].id))
        .returning();
      membership = updated;
    } else {
      // Create new membership with STAFF role
      const user = await this.getUser(staffUserId);
      const [created] = await db.insert(libraryMemberships)
        .values({
          userId: staffUserId,
          libraryId,
          role: user?.role || 'LIBRARIAN',
          isPrimaryLibrary: false,
          isActive: true,
        })
        .returning();
      membership = created;
    }
    
    // Log the allocation
    await db.insert(staffAllocationLogs).values({
      staffUserId,
      libraryId,
      action: 'ALLOCATED',
      performedByUserId,
      reason,
    });
    
    return membership;
  }

  async deallocateStaffFromLibrary(staffUserId: number, libraryId: number, performedByUserId: number, reason?: string): Promise<boolean> {
    const existing = await db.select().from(libraryMemberships)
      .where(and(
        eq(libraryMemberships.userId, staffUserId),
        eq(libraryMemberships.libraryId, libraryId),
        eq(libraryMemberships.isActive, true)
      ));
    
    if (existing.length === 0) {
      return false;
    }
    
    // Deactivate the membership
    await db.update(libraryMemberships)
      .set({ isActive: false })
      .where(eq(libraryMemberships.id, existing[0].id));
    
    // Log the deallocation
    await db.insert(staffAllocationLogs).values({
      staffUserId,
      libraryId,
      action: 'DEALLOCATED',
      performedByUserId,
      reason,
    });
    
    return true;
  }

  async getStaffAllocationLogs(staffUserId?: number): Promise<StaffAllocationLog[]> {
    if (staffUserId) {
      return await db.select().from(staffAllocationLogs)
        .where(eq(staffAllocationLogs.staffUserId, staffUserId))
        .orderBy(desc(staffAllocationLogs.createdAt));
    }
    return await db.select().from(staffAllocationLogs)
      .orderBy(desc(staffAllocationLogs.createdAt));
  }

  async getStaffAllocationLogsWithDetails(staffUserId?: number): Promise<StaffAllocationLogWithDetails[]> {
    const logs = await this.getStaffAllocationLogs(staffUserId);
    
    // Get all unique user and library IDs
    const staffUserIds = Array.from(new Set(logs.map(l => l.staffUserId)));
    const performedByIds = Array.from(new Set(logs.map(l => l.performedByUserId)));
    const libraryIds = Array.from(new Set(logs.map(l => l.libraryId)));
    const allUserIds = Array.from(new Set([...staffUserIds, ...performedByIds]));
    
    // Fetch users and libraries
    const usersData = allUserIds.length > 0 
      ? await db.select().from(users).where(sql`${users.id} IN (${sql.join(allUserIds.map(id => sql`${id}`), sql`, `)})`)
      : [];
    const librariesData = libraryIds.length > 0 
      ? await db.select().from(libraries).where(sql`${libraries.id} IN (${sql.join(libraryIds.map(id => sql`${id}`), sql`, `)})`)
      : [];
    
    const userMap = new Map(usersData.map(u => [u.id, u]));
    const libraryMap = new Map(librariesData.map(l => [l.id, l]));
    
    return logs.map(log => ({
      ...log,
      staffUserName: userMap.get(log.staffUserId)?.name || 'Unknown',
      staffUserRole: userMap.get(log.staffUserId)?.role || 'Unknown',
      libraryName: libraryMap.get(log.libraryId)?.name || 'Unknown',
      performedByName: userMap.get(log.performedByUserId)?.name || 'Unknown',
    }));
  }

  async getLibraryStaff(libraryId: number): Promise<LibraryStaffMember[]> {
    // Get active memberships for this library
    const memberships = await db.select().from(libraryMemberships)
      .where(and(
        eq(libraryMemberships.libraryId, libraryId),
        eq(libraryMemberships.isActive, true)
      ));
    
    if (memberships.length === 0) return [];
    
    // Get all users for these memberships
    const userIds = memberships.map(m => m.userId);
    const allUsers = await db.select().from(users)
      .where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
    
    // Filter to only STAFF category users
    const staffUsers = allUsers.filter(u => u.category === 'STAFF');
    const staffUserIds = new Set(staffUsers.map(u => u.id));
    const userMap = new Map(staffUsers.map(u => [u.id, u]));
    
    // Return only memberships for staff users
    return memberships
      .filter(m => staffUserIds.has(m.userId))
      .map(m => {
        const user = userMap.get(m.userId)!;
        return {
          id: m.id,
          userId: m.userId,
          name: user.name,
          email: user.email || '',
          role: user.role === 'ADMIN' ? 'Library Admin' : 'Librarian',
          allocatedAt: m.createdAt,
        };
      });
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
    const { libraryId, query, format, category, status, attributeValueIds, limit = 50, offset = 0 } = params;
    
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

    if (attributeValueIds && attributeValueIds.length > 0) {
      const attrRows = await db.selectDistinct({ bookId: resourceSearchAttributes.bookId })
        .from(resourceSearchAttributes)
        .where(inArray(resourceSearchAttributes.attributeValueId, attributeValueIds));
      const attrBookIds = new Set(attrRows.map(r => r.bookId));
      filteredBooks = filteredBooks.filter(b => attrBookIds.has(b.id));
    }
    
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

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [result] = await returningViaCte<AuditLog>(
      db.insert(auditLogs).values(nullifyForInsert(log as any)).returning()
    );
    return result;
  }

  async queryAuditLogs(filters: AuditLogFilters): Promise<{ logs: AuditLog[]; total: number }> {
    const conditions = [];
    
    if (filters.category) {
      conditions.push(eq(auditLogs.category, filters.category as any));
    }
    if (filters.action) {
      conditions.push(like(auditLogs.action, `%${filters.action}%`));
    }
    if (filters.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters.status) {
      conditions.push(eq(auditLogs.status, filters.status as any));
    }
    if (filters.startDate) {
      conditions.push(sql`${auditLogs.timestamp} >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      conditions.push(sql`${auditLogs.timestamp} <= ${filters.endDate}`);
    }
    if (filters.search) {
      conditions.push(
        or(
          like(auditLogs.action, `%${filters.search}%`),
          like(auditLogs.userName, `%${filters.search}%`),
          like(auditLogs.targetType, `%${filters.search}%`),
          like(auditLogs.errorMessage, `%${filters.search}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.timestamp))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    return { logs, total: countResult.count };
  }

  // Search Attribute Types
  async createCirculationPolicyVersion(data: InsertCirculationPolicyVersion): Promise<CirculationPolicyVersion> {
    const [row] = await db.insert(circulationPolicyVersions).values(data as any).returning();
    return row;
  }

  async getCirculationPolicyVersions(params: { scope?: 'GLOBAL' | 'LIBRARY'; libraryId?: number | null; limit?: number }): Promise<CirculationPolicyVersion[]> {
    const conds: any[] = [];
    if (params.scope) conds.push(eq(circulationPolicyVersions.scope, params.scope));
    if (params.libraryId !== undefined) {
      if (params.libraryId === null) conds.push(isNull(circulationPolicyVersions.libraryId));
      else conds.push(eq(circulationPolicyVersions.libraryId, params.libraryId));
    }
    let q = db.select().from(circulationPolicyVersions).$dynamic();
    if (conds.length > 0) q = q.where(and(...conds));
    q = q.orderBy(desc(circulationPolicyVersions.effectiveFrom), desc(circulationPolicyVersions.id));
    if (params.limit) q = q.limit(params.limit);
    return await q;
  }

  async getAllSearchAttributeTypes(): Promise<SearchAttributeType[]> {
    return await db.select().from(searchAttributeTypes).orderBy(asc(searchAttributeTypes.sortOrder), asc(searchAttributeTypes.name));
  }

  async getBookIdsByAttributeValueIds(attributeValueIds: number[]): Promise<number[]> {
    if (attributeValueIds.length === 0) return [];
    const rows = await db.selectDistinct({ bookId: resourceSearchAttributes.bookId })
      .from(resourceSearchAttributes)
      .where(inArray(resourceSearchAttributes.attributeValueId, attributeValueIds));
    return rows.map(r => r.bookId);
  }

  async getActiveSearchAttributeTypes(): Promise<SearchAttributeType[]> {
    return await db.select().from(searchAttributeTypes)
      .where(eq(searchAttributeTypes.isActive, true))
      .orderBy(asc(searchAttributeTypes.sortOrder), asc(searchAttributeTypes.name));
  }

  async getSearchAttributeType(id: number): Promise<SearchAttributeType | undefined> {
    const [result] = await db.select().from(searchAttributeTypes).where(eq(searchAttributeTypes.id, id));
    return result;
  }

  async createSearchAttributeType(data: InsertSearchAttributeType): Promise<SearchAttributeType> {
    const [result] = await db.insert(searchAttributeTypes).values(data).returning();
    return result;
  }

  async updateSearchAttributeType(id: number, data: Partial<InsertSearchAttributeType>): Promise<SearchAttributeType | undefined> {
    const [result] = await db.update(searchAttributeTypes).set(data).where(eq(searchAttributeTypes.id, id)).returning();
    return result;
  }

  async deleteSearchAttributeType(id: number): Promise<boolean> {
    const result = await db.delete(searchAttributeTypes).where(eq(searchAttributeTypes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Search Attribute Values
  async getSearchAttributeValuesByType(typeId: number): Promise<SearchAttributeValue[]> {
    return await db.select().from(searchAttributeValues)
      .where(eq(searchAttributeValues.attributeTypeId, typeId))
      .orderBy(asc(searchAttributeValues.sortOrder), asc(searchAttributeValues.value));
  }

  async getSearchAttributeValue(id: number): Promise<SearchAttributeValue | undefined> {
    const [result] = await db.select().from(searchAttributeValues).where(eq(searchAttributeValues.id, id));
    return result;
  }

  async createSearchAttributeValue(data: InsertSearchAttributeValue): Promise<SearchAttributeValue> {
    const [result] = await db.insert(searchAttributeValues).values(data).returning();
    return result;
  }

  async updateSearchAttributeValue(id: number, data: Partial<InsertSearchAttributeValue>): Promise<SearchAttributeValue | undefined> {
    const [result] = await db.update(searchAttributeValues).set(data).where(eq(searchAttributeValues.id, id)).returning();
    return result;
  }

  async deleteSearchAttributeValue(id: number): Promise<boolean> {
    const result = await db.delete(searchAttributeValues).where(eq(searchAttributeValues.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Resource Search Attributes
  async getResourceSearchAttributes(bookId: number): Promise<(ResourceSearchAttribute & { attributeValue: string; attributeTypeName: string; attributeTypeId: number })[]> {
    const results = await db.select({
      id: resourceSearchAttributes.id,
      bookId: resourceSearchAttributes.bookId,
      attributeValueId: resourceSearchAttributes.attributeValueId,
      assignedAt: resourceSearchAttributes.assignedAt,
      attributeValue: searchAttributeValues.value,
      attributeTypeName: searchAttributeTypes.name,
      attributeTypeId: searchAttributeTypes.id,
    })
      .from(resourceSearchAttributes)
      .innerJoin(searchAttributeValues, eq(resourceSearchAttributes.attributeValueId, searchAttributeValues.id))
      .innerJoin(searchAttributeTypes, eq(searchAttributeValues.attributeTypeId, searchAttributeTypes.id))
      .where(eq(resourceSearchAttributes.bookId, bookId))
      .orderBy(asc(searchAttributeTypes.sortOrder), asc(searchAttributeValues.value));
    
    return results;
  }

  async getResourceSearchAttributesForBooks(bookIds: number[]): Promise<Map<number, { attributeValueId: number; attributeValue: string; attributeTypeName: string; attributeTypeId: number }[]>> {
    const map = new Map<number, { attributeValueId: number; attributeValue: string; attributeTypeName: string; attributeTypeId: number }[]>();
    if (bookIds.length === 0) return map;

    const results = await db.select({
      bookId: resourceSearchAttributes.bookId,
      attributeValueId: resourceSearchAttributes.attributeValueId,
      attributeValue: searchAttributeValues.value,
      attributeTypeName: searchAttributeTypes.name,
      attributeTypeId: searchAttributeTypes.id,
    })
      .from(resourceSearchAttributes)
      .innerJoin(searchAttributeValues, eq(resourceSearchAttributes.attributeValueId, searchAttributeValues.id))
      .innerJoin(searchAttributeTypes, eq(searchAttributeValues.attributeTypeId, searchAttributeTypes.id))
      .where(inArray(resourceSearchAttributes.bookId, bookIds))
      .orderBy(asc(searchAttributeTypes.sortOrder), asc(searchAttributeValues.value));

    for (const row of results) {
      if (!map.has(row.bookId)) map.set(row.bookId, []);
      map.get(row.bookId)!.push({
        attributeValueId: row.attributeValueId,
        attributeValue: row.attributeValue,
        attributeTypeName: row.attributeTypeName,
        attributeTypeId: row.attributeTypeId,
      });
    }
    return map;
  }

  async assignSearchAttribute(bookId: number, attributeValueId: number): Promise<ResourceSearchAttribute> {
    const existing = await db.select().from(resourceSearchAttributes)
      .where(and(
        eq(resourceSearchAttributes.bookId, bookId),
        eq(resourceSearchAttributes.attributeValueId, attributeValueId)
      ));
    
    if (existing.length > 0) return existing[0];
    
    const [result] = await db.insert(resourceSearchAttributes)
      .values({ bookId, attributeValueId })
      .returning();
    return result;
  }

  async removeSearchAttribute(bookId: number, attributeValueId: number): Promise<boolean> {
    const result = await db.delete(resourceSearchAttributes)
      .where(and(
        eq(resourceSearchAttributes.bookId, bookId),
        eq(resourceSearchAttributes.attributeValueId, attributeValueId)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async setResourceSearchAttributes(bookId: number, attributeValueIds: number[]): Promise<void> {
    await db.delete(resourceSearchAttributes).where(eq(resourceSearchAttributes.bookId, bookId));
    
    if (attributeValueIds.length > 0) {
      await db.insert(resourceSearchAttributes)
        .values(attributeValueIds.map(attributeValueId => ({ bookId, attributeValueId })));
    }
  }

  async searchBooksByAttributes(attributeValueIds: number[]): Promise<number[]> {
    if (attributeValueIds.length === 0) return [];
    
    const results = await db.selectDistinct({ bookId: resourceSearchAttributes.bookId })
      .from(resourceSearchAttributes)
      .where(inArray(resourceSearchAttributes.attributeValueId, attributeValueIds));
    
    return results.map(r => r.bookId);
  }

  // Digital Resource Search Attributes
  async getDigitalResourceSearchAttributes(digitalResourceId: number): Promise<(DigitalResourceSearchAttribute & { attributeValue: string; attributeTypeName: string; attributeTypeId: number })[]> {
    const results = await db.select({
      id: digitalResourceSearchAttributes.id,
      digitalResourceId: digitalResourceSearchAttributes.digitalResourceId,
      attributeValueId: digitalResourceSearchAttributes.attributeValueId,
      assignedAt: digitalResourceSearchAttributes.assignedAt,
      attributeValue: searchAttributeValues.value,
      attributeTypeName: searchAttributeTypes.name,
      attributeTypeId: searchAttributeTypes.id,
    })
      .from(digitalResourceSearchAttributes)
      .innerJoin(searchAttributeValues, eq(digitalResourceSearchAttributes.attributeValueId, searchAttributeValues.id))
      .innerJoin(searchAttributeTypes, eq(searchAttributeValues.attributeTypeId, searchAttributeTypes.id))
      .where(eq(digitalResourceSearchAttributes.digitalResourceId, digitalResourceId))
      .orderBy(asc(searchAttributeTypes.sortOrder), asc(searchAttributeValues.value));

    return results;
  }

  async setDigitalResourceSearchAttributes(digitalResourceId: number, attributeValueIds: number[]): Promise<void> {
    await db.delete(digitalResourceSearchAttributes).where(eq(digitalResourceSearchAttributes.digitalResourceId, digitalResourceId));

    if (attributeValueIds.length > 0) {
      await db.insert(digitalResourceSearchAttributes)
        .values(attributeValueIds.map(attributeValueId => ({ digitalResourceId, attributeValueId })));
    }
  }

  async getDigitalResourceIdsByAttributeValueIds(attributeValueIds: number[]): Promise<number[]> {
    if (attributeValueIds.length === 0) return [];
    const rows = await db.selectDistinct({ digitalResourceId: digitalResourceSearchAttributes.digitalResourceId })
      .from(digitalResourceSearchAttributes)
      .where(inArray(digitalResourceSearchAttributes.attributeValueId, attributeValueIds));
    return rows.map(r => r.digitalResourceId);
  }

  async searchCatalogByAttributes(options: {
    attributeValueIds: number[];
    searchQuery?: string;
    limit: number;
  }): Promise<{ books: Book[]; totalCount: number; limitExceeded: boolean }> {
    const { attributeValueIds, searchQuery, limit } = options;

    let bookIds: number[] | null = null;

    if (attributeValueIds.length > 0) {
      const attrResults = await db.selectDistinct({ bookId: resourceSearchAttributes.bookId })
        .from(resourceSearchAttributes)
        .where(inArray(resourceSearchAttributes.attributeValueId, attributeValueIds));
      bookIds = attrResults.map(r => r.bookId);
      if (bookIds.length === 0) {
        return { books: [], totalCount: 0, limitExceeded: false };
      }
    }

    const conditions: any[] = [];
    if (bookIds !== null) {
      conditions.push(inArray(books.id, bookIds));
    }
    if (searchQuery) {
      const pattern = `%${searchQuery}%`;
      conditions.push(or(
        like(books.title, pattern),
        like(books.author, pattern),
        like(books.isbn, pattern)
      ));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(books)
      .where(whereClause);
    const totalCount = Number(countResult[0].count);

    if (totalCount > limit) {
      return { books: [], totalCount, limitExceeded: true };
    }

    const results = await db.select().from(books)
      .where(whereClause)
      .orderBy(asc(books.title))
      .limit(limit);

    return { books: results, totalCount, limitExceeded: false };
  }

  async searchDigitalResourcesByAttributes(options: {
    attributeValueIds: number[];
    searchQuery?: string;
    limit: number;
  }): Promise<{ resources: DigitalResource[]; totalCount: number; limitExceeded: boolean }> {
    const { attributeValueIds, searchQuery, limit } = options;

    let resourceIds: number[] | null = null;

    if (attributeValueIds.length > 0) {
      const attrResults = await db.selectDistinct({ digitalResourceId: digitalResourceSearchAttributes.digitalResourceId })
        .from(digitalResourceSearchAttributes)
        .where(inArray(digitalResourceSearchAttributes.attributeValueId, attributeValueIds));
      resourceIds = attrResults.map(r => r.digitalResourceId);
      if (resourceIds.length === 0) {
        return { resources: [], totalCount: 0, limitExceeded: false };
      }
    }

    const conditions: any[] = [
      eq(digitalResources.status, 'PUBLISHED'),
      eq(digitalResources.visibility, 'INSTITUTION'),
      or(
        sql`${digitalResources.publishDate} IS NULL`,
        sql`${digitalResources.publishDate} <= now()`
      ),
    ];
    if (resourceIds !== null) {
      conditions.push(inArray(digitalResources.id, resourceIds));
    }
    if (searchQuery) {
      const pattern = `%${searchQuery}%`;
      conditions.push(or(
        like(digitalResources.title, pattern),
        like(digitalResources.author, pattern),
        like(digitalResources.subject, pattern)
      ));
    }

    const whereClause = and(...conditions);

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(digitalResources)
      .where(whereClause);
    const totalCount = Number(countResult[0].count);

    if (totalCount > limit) {
      return { resources: [], totalCount, limitExceeded: true };
    }

    const results = await db.select().from(digitalResources)
      .where(whereClause)
      .orderBy(desc(digitalResources.createdAt))
      .limit(limit);

    return { resources: results, totalCount, limitExceeded: false };
  }

  // ===== Active Circulations =====
  async getActiveCirculations(): Promise<Circulation[]> {
    return await db.select().from(circulation).where(
      or(eq(circulation.status, 'ACTIVE'), eq(circulation.status, 'OVERDUE'))
    ).orderBy(asc(circulation.dueDate));
  }

  // ===== Payment Methods =====
  async getAllPaymentMethods(): Promise<PaymentMethod[]> {
    return await db.select().from(paymentMethods).orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name));
  }
  async getActivePaymentMethods(): Promise<PaymentMethod[]> {
    return await db.select().from(paymentMethods).where(eq(paymentMethods.isActive, true)).orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name));
  }
  async getPaymentMethod(id: number): Promise<PaymentMethod | undefined> {
    const [pm] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, id));
    return pm;
  }
  async createPaymentMethod(data: InsertPaymentMethod): Promise<PaymentMethod> {
    const [pm] = await db.insert(paymentMethods).values(data).returning();
    return pm;
  }
  async updatePaymentMethod(id: number, data: Partial<InsertPaymentMethod>): Promise<PaymentMethod | undefined> {
    const [pm] = await db.update(paymentMethods).set(data).where(eq(paymentMethods.id, id)).returning();
    return pm;
  }
  async deletePaymentMethod(id: number): Promise<boolean> {
    const result = await db.delete(paymentMethods).where(eq(paymentMethods.id, id)).returning();
    return result.length > 0;
  }

  // ===== Resource Type Settings =====
  async getAllResourceTypeSettings(): Promise<ResourceTypeSetting[]> {
    return await db.select().from(resourceTypeSettings).orderBy(asc(resourceTypeSettings.resourceType));
  }
  async getResourceTypeSetting(resourceType: string): Promise<ResourceTypeSetting | undefined> {
    const [row] = await db.select().from(resourceTypeSettings).where(eq(resourceTypeSettings.resourceType, resourceType as any));
    return row;
  }
  async upsertResourceTypeSetting(resourceType: string, data: Partial<InsertResourceTypeSetting>): Promise<ResourceTypeSetting> {
    const existing = await this.getResourceTypeSetting(resourceType);
    if (existing) {
      const [row] = await returningViaCte<ResourceTypeSetting>(
        db.update(resourceTypeSettings)
          .set(nullifyForInsert({ ...data, updatedAt: new Date() } as any))
          .where(eq(resourceTypeSettings.resourceType, resourceType as any))
          .returning()
      );
      return row;
    }
    const [row] = await returningViaCte<ResourceTypeSetting>(
      db.insert(resourceTypeSettings)
        .values(nullifyForInsert({ resourceType: resourceType as any, ...data }))
        .returning()
    );
    return row;
  }

  // ===== Fine Payments =====
  async createFinePayment(data: InsertFinePayment): Promise<FinePayment> {
    const [fp] = await db.insert(finePayments).values(data).returning();
    return fp;
  }
  async getFinePaymentsByCirculation(circulationId: number): Promise<FinePayment[]> {
    return await db.select().from(finePayments).where(eq(finePayments.circulationId, circulationId)).orderBy(desc(finePayments.paidAt));
  }
  async getFinePayments(filters: { fromDate?: Date; toDate?: Date; libraryId?: number; paymentMethodId?: number; paymentType?: 'FINE' | 'DAMAGE' }): Promise<FinePayment[]> {
    const conditions: any[] = [];
    if (filters.fromDate) conditions.push(sql`${finePayments.paidAt} >= ${filters.fromDate}`);
    if (filters.toDate) conditions.push(sql`${finePayments.paidAt} <= ${filters.toDate}`);
    if (filters.paymentMethodId) conditions.push(eq(finePayments.paymentMethodId, filters.paymentMethodId));
    if (filters.paymentType) conditions.push(eq(finePayments.paymentType, filters.paymentType));
    if (filters.libraryId) {
      // Join via circulation
      const circIds = await db.select({ id: circulation.id }).from(circulation).where(eq(circulation.libraryId, filters.libraryId));
      const ids = circIds.map(c => c.id);
      if (ids.length === 0) return [];
      conditions.push(inArray(finePayments.circulationId, ids));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return await db.select().from(finePayments).where(whereClause).orderBy(desc(finePayments.paidAt));
  }

  // ===== Fine Waiver Requests =====
  async createFineWaiverRequest(data: InsertFineWaiverRequest): Promise<FineWaiverRequest> {
    const [r] = await db.insert(fineWaiverRequests).values(data).returning();
    return r;
  }
  async getFineWaiverRequest(id: number): Promise<FineWaiverRequest | undefined> {
    const [r] = await db.select().from(fineWaiverRequests).where(eq(fineWaiverRequests.id, id));
    return r;
  }
  async getFineWaiverRequests(status?: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<FineWaiverRequest[]> {
    if (status) {
      return await db.select().from(fineWaiverRequests).where(eq(fineWaiverRequests.status, status)).orderBy(desc(fineWaiverRequests.createdAt));
    }
    return await db.select().from(fineWaiverRequests).orderBy(desc(fineWaiverRequests.createdAt));
  }
  async updateFineWaiverRequest(id: number, data: Partial<{ status: 'PENDING' | 'APPROVED' | 'REJECTED'; reviewedBy: number; reviewedAt: Date; reviewNotes: string }>): Promise<FineWaiverRequest | undefined> {
    const [r] = await db.update(fineWaiverRequests).set(data as any).where(eq(fineWaiverRequests.id, id)).returning();
    return r;
  }

  // ===== Reservations =====
  async createReservationRow(data: InsertReservation): Promise<Reservation> {
    const [r] = await db.insert(reservations).values(data).returning();
    return r;
  }
  async getReservation(id: number): Promise<Reservation | undefined> {
    const [r] = await db.select().from(reservations).where(eq(reservations.id, id));
    return r;
  }
  async listReservations(filters: {
    userId?: number;
    libraryId?: number;
    bookId?: number;
    status?: 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
    fromDate?: Date;
    toDate?: Date;
  } = {}): Promise<Reservation[]> {
    const conds: any[] = [];
    if (filters.userId) conds.push(eq(reservations.userId, filters.userId));
    if (filters.libraryId) conds.push(eq(reservations.libraryId, filters.libraryId));
    if (filters.bookId) conds.push(eq(reservations.bookId, filters.bookId));
    if (filters.status) conds.push(eq(reservations.status, filters.status));
    if (filters.fromDate) conds.push(sql`${reservations.reservedFor} >= ${filters.fromDate}`);
    if (filters.toDate) conds.push(sql`${reservations.reservedFor} <= ${filters.toDate}`);
    const where = conds.length ? and(...conds) : undefined;
    return await db.select().from(reservations).where(where).orderBy(desc(reservations.createdAt));
  }
  async updateReservation(id: number, data: Partial<Reservation>): Promise<Reservation | undefined> {
    const [r] = await db.update(reservations).set(data as any).where(eq(reservations.id, id)).returning();
    return r;
  }
  async getActiveReservationsForBookCopies(copyIds: number[]): Promise<Reservation[]> {
    if (copyIds.length === 0) return [];
    return await db.select().from(reservations).where(
      and(eq(reservations.status, 'ACTIVE'), inArray(reservations.bookCopyId, copyIds))
    );
  }
  async getActiveReservationsForBook(bookId: number, libraryId?: number): Promise<Reservation[]> {
    const conds: any[] = [eq(reservations.bookId, bookId), eq(reservations.status, 'ACTIVE')];
    if (libraryId) conds.push(eq(reservations.libraryId, libraryId));
    return await db.select().from(reservations).where(and(...conds)).orderBy(asc(reservations.createdAt));
  }
  async findExpiredActiveReservations(now: Date): Promise<Reservation[]> {
    return await db.select().from(reservations).where(
      and(eq(reservations.status, 'ACTIVE'), sql`${reservations.expiresAt} < ${now}`)
    );
  }

  // ===== Reservation Pickups =====
  async createReservationPickup(data: InsertReservationPickup): Promise<ReservationPickup> {
    const [p] = await db.insert(reservationPickups).values(data as any).returning();
    return p;
  }
  async getReservationPickup(id: number): Promise<ReservationPickup | undefined> {
    const [p] = await db.select().from(reservationPickups).where(eq(reservationPickups.id, id));
    return p;
  }
  async updateReservationPickup(id: number, data: Partial<ReservationPickup>): Promise<ReservationPickup | undefined> {
    const [p] = await db.update(reservationPickups).set(data as any).where(eq(reservationPickups.id, id)).returning();
    return p;
  }

  // ===== Digital Resources =====
  async getDigitalResource(id: number): Promise<DigitalResource | undefined> {
    const [r] = await db.select().from(digitalResources).where(eq(digitalResources.id, id));
    return r;
  }

  async createDigitalResource(data: InsertDigitalResource): Promise<DigitalResource> {
    const [r] = await returningViaCte<DigitalResource>(
      db.insert(digitalResources).values(nullifyForInsert(data as any)).returning()
    );
    return r;
  }

  async updateDigitalResource(id: number, data: Partial<InsertDigitalResource>): Promise<DigitalResource | undefined> {
    const [r] = await returningViaCte<DigitalResource>(
      db.update(digitalResources)
        .set(nullifyForInsert({ ...data, updatedAt: new Date() } as any))
        .where(eq(digitalResources.id, id))
        .returning()
    );
    return r;
  }

  async deleteDigitalResource(id: number): Promise<boolean> {
    const result = await db.delete(digitalResources).where(eq(digitalResources.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  private buildDigitalResourceConditions(filters: DigitalResourceFilters): any[] {
    const conditions: any[] = [];
    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(or(
        like(digitalResources.title, pattern),
        like(digitalResources.description, pattern),
        like(digitalResources.shortDescription, pattern),
        sql`${digitalResources.keywords}::text ILIKE ${pattern}`,
        sql`${digitalResources.tags}::text ILIKE ${pattern}`,
      ));
    }
    if (filters.department) conditions.push(eq(digitalResources.department, filters.department));
    if (filters.course) conditions.push(eq(digitalResources.course, filters.course));
    if (filters.semester) conditions.push(eq(digitalResources.semester, filters.semester));
    if (filters.resourceType) conditions.push(eq(digitalResources.resourceType, filters.resourceType as any));
    if (filters.category) conditions.push(eq(digitalResources.category, filters.category as any));
    if (filters.faculty) conditions.push(eq(digitalResources.faculty, filters.faculty));
    if (filters.uploadedBy) conditions.push(eq(digitalResources.uploadedBy, filters.uploadedBy));
    if (filters.status) conditions.push(eq(digitalResources.status, filters.status as any));
    if (filters.libraryId) conditions.push(eq(digitalResources.libraryId, filters.libraryId));
    if (filters.tags && filters.tags.length > 0) {
      conditions.push(sql`${digitalResources.tags} && ${filters.tags}`);
    }
    if (filters.fromDate) conditions.push(sql`${digitalResources.createdAt} >= ${filters.fromDate}`);
    if (filters.toDate) conditions.push(sql`${digitalResources.createdAt} <= ${filters.toDate}`);
    return conditions;
  }

  async listDigitalResources(filters: DigitalResourceFilters): Promise<{ resources: DigitalResource[]; total: number }> {
    const conditions = this.buildDigitalResourceConditions(filters);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(digitalResources).where(whereClause);
    const total = Number(countResult[0].count);

    let query = db.select().from(digitalResources).where(whereClause).orderBy(desc(digitalResources.createdAt)) as any;
    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset) query = query.offset(filters.offset);

    const resources = await query;
    return { resources, total };
  }

  async listVisibleDigitalResources(user: { id: number; role: string; department: string | null }, filters: DigitalResourceFilters): Promise<{ resources: DigitalResource[]; total: number }> {
    const isStaff = user.role === 'ADMIN' || user.role === 'LIBRARIAN';
    const conditions = this.buildDigitalResourceConditions(filters);

    if (!isStaff) {
      // Non-staff only see PUBLISHED resources they are allowed to see
      conditions.push(eq(digitalResources.status, 'PUBLISHED'));
      conditions.push(or(
        sql`${digitalResources.publishDate} IS NULL`,
        sql`${digitalResources.publishDate} <= now()`
      ));

      const visibilityConditions: any[] = [
        eq(digitalResources.visibility, 'INSTITUTION'),
      ];
      if (user.role === 'FACULTY') {
        visibilityConditions.push(eq(digitalResources.visibility, 'FACULTY_ONLY'));
      }
      if (user.role === 'STUDENT') {
        visibilityConditions.push(eq(digitalResources.visibility, 'STUDENTS_ONLY'));
      }
      if (user.department) {
        visibilityConditions.push(and(
          eq(digitalResources.visibility, 'DEPARTMENT'),
          eq(digitalResources.department, user.department)
        ));
      }
      visibilityConditions.push(and(
        eq(digitalResources.visibility, 'ROLE_BASED'),
        sql`${digitalResources.visibleToRoles} && ${[user.role]}`
      ));
      visibilityConditions.push(and(
        eq(digitalResources.visibility, 'SELECTED_USERS'),
        sql`${digitalResources.visibleToUserIds} && ${[user.id]}`
      ));

      conditions.push(or(...visibilityConditions));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(digitalResources).where(whereClause);
    const total = Number(countResult[0].count);

    let query = db.select().from(digitalResources).where(whereClause).orderBy(desc(digitalResources.createdAt)) as any;
    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset) query = query.offset(filters.offset);

    const resources = await query;
    return { resources, total };
  }

  async incrementDigitalResourceDownloadCount(id: number): Promise<void> {
    await db.update(digitalResources)
      .set({ downloadCount: sql`${digitalResources.downloadCount} + 1` })
      .where(eq(digitalResources.id, id));
  }

  async incrementDigitalResourceViewCount(id: number): Promise<void> {
    await db.update(digitalResources)
      .set({ viewCount: sql`${digitalResources.viewCount} + 1` })
      .where(eq(digitalResources.id, id));
  }

  // ===== Digital Resource Versions =====
  async createDigitalResourceVersion(data: InsertDigitalResourceVersion): Promise<DigitalResourceVersion> {
    if (data.isCurrent !== false) {
      await db.update(digitalResourceVersions)
        .set({ isCurrent: false })
        .where(eq(digitalResourceVersions.resourceId, data.resourceId));
    }
    const [v] = await returningViaCte<DigitalResourceVersion>(
      db.insert(digitalResourceVersions).values(nullifyForInsert(data as any)).returning()
    );
    return v;
  }

  async getDigitalResourceVersions(resourceId: number): Promise<DigitalResourceVersion[]> {
    return await db.select().from(digitalResourceVersions)
      .where(eq(digitalResourceVersions.resourceId, resourceId))
      .orderBy(desc(digitalResourceVersions.createdAt));
  }

  async getDigitalResourceVersion(id: number): Promise<DigitalResourceVersion | undefined> {
    const [v] = await db.select().from(digitalResourceVersions).where(eq(digitalResourceVersions.id, id));
    return v;
  }

  // ===== Lost & Damaged Reports =====

  async getLostDamagedReports(filters: { type?: string; status?: string; libraryId?: number; patronId?: number; search?: string; limit?: number; offset?: number }): Promise<{ reports: (LostDamagedReport & { bookTitle: string; bookIsbn: string; bookCopyAccession: string | null; patronName: string | null; libraryName: string | null })[]; total: number }> {
    const { type, status, libraryId, patronId, search, limit = 50, offset = 0 } = filters;

    let allReports = await db
      .select({
        report: lostDamagedReports,
        bookTitle: books.title,
        bookIsbn: books.isbn,
        bookCopyAccession: bookCopies.barcode,
        patronName: users.name,
        libraryName: libraries.name,
      })
      .from(lostDamagedReports)
      .leftJoin(books, eq(lostDamagedReports.bookId, books.id))
      .leftJoin(bookCopies, eq(lostDamagedReports.bookCopyId, bookCopies.id))
      .leftJoin(users, eq(lostDamagedReports.patronId, users.id))
      .leftJoin(libraries, eq(lostDamagedReports.libraryId, libraries.id))
      .orderBy(desc(lostDamagedReports.createdAt));

    let filtered = allReports;
    if (type) filtered = filtered.filter(r => r.report.type === type);
    if (status) filtered = filtered.filter(r => r.report.status === status);
    if (libraryId) filtered = filtered.filter(r => r.report.libraryId === libraryId);
    if (patronId) filtered = filtered.filter(r => r.report.patronId === patronId);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.bookTitle?.toLowerCase().includes(q) ||
        r.bookIsbn?.toLowerCase().includes(q) ||
        r.patronName?.toLowerCase().includes(q) ||
        r.bookCopyAccession?.toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      reports: paginated.map(r => ({
        ...r.report,
        bookTitle: r.bookTitle ?? '',
        bookIsbn: r.bookIsbn ?? '',
        bookCopyAccession: r.bookCopyAccession ?? null,
        patronName: r.patronName ?? null,
        libraryName: r.libraryName ?? null,
      })),
      total,
    };
  }

  async getLostDamagedReport(id: number): Promise<(LostDamagedReport & { bookTitle: string; bookIsbn: string; bookCopyAccession: string | null; patronName: string | null; libraryName: string | null }) | undefined> {
    const rows = await db
      .select({
        report: lostDamagedReports,
        bookTitle: books.title,
        bookIsbn: books.isbn,
        bookCopyAccession: bookCopies.barcode,
        patronName: users.name,
        libraryName: libraries.name,
      })
      .from(lostDamagedReports)
      .leftJoin(books, eq(lostDamagedReports.bookId, books.id))
      .leftJoin(bookCopies, eq(lostDamagedReports.bookCopyId, bookCopies.id))
      .leftJoin(users, eq(lostDamagedReports.patronId, users.id))
      .leftJoin(libraries, eq(lostDamagedReports.libraryId, libraries.id))
      .where(eq(lostDamagedReports.id, id));

    if (!rows[0]) return undefined;
    const r = rows[0];
    return {
      ...r.report,
      bookTitle: r.bookTitle ?? '',
      bookIsbn: r.bookIsbn ?? '',
      bookCopyAccession: r.bookCopyAccession ?? null,
      patronName: r.patronName ?? null,
      libraryName: r.libraryName ?? null,
    };
  }

  async createLostDamagedReport(data: InsertLostDamagedReport): Promise<LostDamagedReport> {
    const [report] = await db.insert(lostDamagedReports).values(data as any).returning();
    return report;
  }

  async updateLostDamagedReport(id: number, data: Partial<LostDamagedReport>): Promise<LostDamagedReport | undefined> {
    const [report] = await db.update(lostDamagedReports).set(data as any).where(eq(lostDamagedReports.id, id)).returning();
    return report;
  }

  async getLostDamagedReportHistory(reportId: number): Promise<LostDamagedReportHistory[]> {
    return await db.select().from(lostDamagedReportHistory)
      .where(eq(lostDamagedReportHistory.reportId, reportId))
      .orderBy(asc(lostDamagedReportHistory.performedAt));
  }

  async addLostDamagedReportHistory(entry: { reportId: number; action: string; fromStatus?: string; toStatus?: string; notes?: string; performedBy?: number; performedByName?: string }): Promise<LostDamagedReportHistory> {
    const [row] = await db.insert(lostDamagedReportHistory).values({
      reportId: entry.reportId,
      action: entry.action,
      fromStatus: (entry.fromStatus as any) ?? null,
      toStatus: (entry.toStatus as any) ?? null,
      notes: entry.notes ?? null,
      performedBy: entry.performedBy ?? null,
      performedByName: entry.performedByName ?? null,
    }).returning();
    return row;
  }
}

export const storage = new DBStorage();
