import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, integer, boolean, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const userCategoryEnum = pgEnum('user_category', ['STAFF', 'PATRON']);
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'LIBRARIAN', 'STUDENT', 'FACULTY']);
export const userStatusEnum = pgEnum('user_status', ['ACTIVE', 'INACTIVE', 'SUSPENDED']);
export const bookStatusEnum = pgEnum('book_status', ['AVAILABLE', 'CHECKED_OUT', 'LOST', 'MAINTENANCE', 'RESERVED']);
export const circulationStatusEnum = pgEnum('circulation_status', ['ACTIVE', 'RETURNED', 'OVERDUE', 'LOST']);
export const authModeEnum = pgEnum('auth_mode', ['LOCAL', 'ERP', 'HYBRID']);
export const erpConnectionModeEnum = pgEnum('erp_connection_mode', ['HOST', 'CLIENT', 'BIDIRECTIONAL']);
export const orgUnitTypeEnum = pgEnum('org_unit_type', ['UNIVERSITY', 'CAMPUS', 'COLLEGE', 'DEPARTMENT']);
export const copyStatusEnum = pgEnum('copy_status', ['AVAILABLE', 'CHECKED_OUT', 'LOST', 'DAMAGED', 'IN_TRANSIT', 'RESERVED']);
export const transferStatusEnum = pgEnum('transfer_status', ['PENDING', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED']);
export const bookFormatEnum = pgEnum('book_format', ['PHYSICAL', 'EBOOK', 'AUDIOBOOK']);
export const fineStatusEnum = pgEnum('fine_status', ['OUTSTANDING', 'PAID', 'WAIVED']);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password"),
  name: text("name").notNull(),
  category: userCategoryEnum("category").notNull().default('PATRON'),
  role: userRoleEnum("role").notNull().default('STUDENT'),
  status: userStatusEnum("status").notNull().default('ACTIVE'),
  joinedDate: timestamp("joined_date").notNull().defaultNow(),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  department: text("department"),
  employeeId: text("employee_id"),
  studentId: text("student_id"),
  externalId: text("external_id"),
  erpIntegrationId: integer("erp_integration_id"),
  lastLoginAt: timestamp("last_login_at"),
});

export const resourceTypes = pgTable("resource_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  isbn: text("isbn").notNull().unique(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  publisher: text("publisher"),
  publishedYear: integer("published_year"),
  category: text("category").notNull(),
  resourceTypeId: integer("resource_type_id").references(() => resourceTypes.id),
  format: bookFormatEnum("format").notNull().default('PHYSICAL'),
  status: bookStatusEnum("status").notNull().default('AVAILABLE'),
  coverUrl: text("cover_url"),
  shelfLocation: text("shelf_location"),
  marcRecord: text("marc_record"),
  acquisitionDate: timestamp("acquisition_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const circulation = pgTable("circulation", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id),
  bookCopyId: integer("book_copy_id").references(() => bookCopies.id),
  libraryId: integer("library_id").references(() => libraries.id),
  userId: integer("user_id").notNull().references(() => users.id),
  checkoutDate: timestamp("checkout_date").notNull().defaultNow(),
  dueDate: timestamp("due_date").notNull(),
  returnDate: timestamp("return_date"),
  status: circulationStatusEnum("status").notNull().default('ACTIVE'),
  fineAmount: integer("fine_amount").default(0),
  fineStatus: fineStatusEnum("fine_status").default('OUTSTANDING'),
  renewalCount: integer("renewal_count").default(0),
});

export const auditSessionStatusEnum = pgEnum('audit_session_status', ['ACTIVE', 'COMPLETED', 'CANCELLED']);
export const inventoryItemStatusEnum = pgEnum('inventory_item_status', ['PENDING', 'VERIFIED', 'MISSING', 'FOUND', 'DISCREPANCY']);

export const auditSessions = pgTable("audit_sessions", {
  id: serial("id").primaryKey(),
  sessionCode: text("session_code").notNull().unique(),
  libraryId: integer("library_id").references(() => libraries.id),
  status: auditSessionStatusEnum("status").notNull().default('ACTIVE'),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  conductedBy: integer("conducted_by").references(() => users.id),
  totalScanned: integer("total_scanned"),
  totalMissing: integer("total_missing"),
  discrepancies: integer("discrepancies"),
  notes: text("notes"),
});

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  auditSessionId: integer("audit_session_id").notNull().references(() => auditSessions.id, { onDelete: 'cascade' }),
  bookCopyId: integer("book_copy_id").notNull().references(() => bookCopies.id),
  expectedLocation: text("expected_location"),
  scannedLocation: text("scanned_location"),
  status: inventoryItemStatusEnum("status").notNull().default('PENDING'),
  condition: text("condition"),
  scannedAt: timestamp("scanned_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id),
  auditSessionId: text("audit_session_id").notNull(),
  lastScanned: timestamp("last_scanned"),
  expectedLocation: text("expected_location"),
  actualLocation: text("actual_location"),
  status: text("status").notNull().default('PENDING'),
  notes: text("notes"),
  scannedBy: integer("scanned_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const erpIntegrations = pgTable("erp_integrations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  erpType: text("erp_type").notNull(),
  connectionMode: erpConnectionModeEnum("connection_mode").notNull().default('BIDIRECTIONAL'),
  isActive: boolean("is_active").notNull().default(true),
  appId: text("app_id").notNull().unique(),
  secretHash: text("secret_hash").notNull(),
  secretSalt: text("secret_salt").notNull(),
  secretLastRotatedAt: timestamp("secret_last_rotated_at").notNull().defaultNow(),
  outboundBaseUrl: text("outbound_base_url"),
  description: text("description"),
  authLoginUrl: text("auth_login_url"),
  authClientId: text("auth_client_id"),
  authClientSecret: text("auth_client_secret"),
  authTokenTtlSeconds: integer("auth_token_ttl_seconds").default(3600),
  cachedAuthToken: text("cached_auth_token"),
  cachedAuthTokenExpiresAt: timestamp("cached_auth_token_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  erpIntegrationId: integer("erp_integration_id").references(() => erpIntegrations.id),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export const erpIntegrationWhitelist = pgTable("erp_integration_whitelist", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id").notNull().references(() => erpIntegrations.id, { onDelete: 'cascade' }),
  urlPattern: text("url_pattern").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ERP Pull Endpoint Types
export const erpEndpointTypeEnum = pgEnum('erp_endpoint_type', [
  'ALL_STUDENTS',
  'SINGLE_STUDENT', 
  'LIBRARY_EMPLOYEES',
  'PROGRAMS',
  'PROGRAM_DEPARTMENTS',
  'COURSES',
  'PROGRAM_COURSES'
]);

export const httpMethodEnum = pgEnum('http_method', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export const erpPullEndpoints = pgTable("erp_pull_endpoints", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id").notNull().references(() => erpIntegrations.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  endpointType: erpEndpointTypeEnum("endpoint_type").notNull(),
  httpMethod: httpMethodEnum("http_method").notNull().default('GET'),
  urlPath: text("url_path").notNull(),
  description: text("description"),
  requestHeaders: jsonb("request_headers"),
  requestBodyTemplate: jsonb("request_body_template"),
  pathParameters: jsonb("path_parameters"),
  queryParameters: jsonb("query_parameters"),
  responseRootPath: text("response_root_path"),
  paginationConfig: jsonb("pagination_config"),
  isActive: boolean("is_active").notNull().default(true),
  lastTestedAt: timestamp("last_tested_at"),
  lastTestStatus: text("last_test_status"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const erpFieldMappings = pgTable("erp_field_mappings", {
  id: serial("id").primaryKey(),
  endpointId: integer("endpoint_id").notNull().references(() => erpPullEndpoints.id, { onDelete: 'cascade' }),
  sourceField: text("source_field").notNull(),
  targetField: text("target_field").notNull(),
  targetTable: text("target_table").notNull(),
  transformationType: text("transformation_type"),
  transformationConfig: jsonb("transformation_config"),
  isRequired: boolean("is_required").notNull().default(false),
  defaultValue: text("default_value"),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const erpTestLogStatusEnum = pgEnum('erp_test_log_status', ['SUCCESS', 'FAILED', 'ERROR', 'TIMEOUT']);

export const erpTestLogs = pgTable("erp_test_logs", {
  id: serial("id").primaryKey(),
  endpointId: integer("endpoint_id").notNull().references(() => erpPullEndpoints.id, { onDelete: 'cascade' }),
  testedBy: integer("tested_by").references(() => users.id),
  requestUrl: text("request_url").notNull(),
  requestMethod: text("request_method").notNull(),
  requestHeaders: jsonb("request_headers"),
  requestBody: jsonb("request_body"),
  responseStatus: integer("response_status"),
  responseHeaders: jsonb("response_headers"),
  responseBody: jsonb("response_body"),
  status: erpTestLogStatusEnum("status").notNull(),
  errorMessage: text("error_message"),
  responseTimeMs: integer("response_time_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== Multi-Library Hierarchical Structure =====

export const orgUnits = pgTable("org_units", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  type: orgUnitTypeEnum("type").notNull(),
  parentId: integer("parent_id"),
  description: text("description"),
  address: text("address"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const libraries = pgTable("libraries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  orgUnitId: integer("org_unit_id").references(() => orgUnits.id),
  address: text("address"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  openingHours: text("opening_hours"),
  isActive: boolean("is_active").notNull().default(true),
  isMainLibrary: boolean("is_main_library").notNull().default(false),
  policies: jsonb("policies").$type<{
    loanPeriodDays?: number;
    maxBooksPerUser?: number;
    renewalLimit?: number;
    finePerDay?: number;
    reservationDays?: number;
    allowInterLibraryLoan?: boolean;
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bookCopies = pgTable("book_copies", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id),
  libraryId: integer("library_id").references(() => libraries.id),
  barcode: text("barcode").notNull().unique(),
  internalSSN: text("internal_ssn").unique(),
  userDefinedSSN: text("user_defined_ssn"),
  callNumber: text("call_number"),
  shelfLocation: text("shelf_location"),
  status: copyStatusEnum("status").notNull().default('AVAILABLE'),
  condition: text("condition").default('GOOD'),
  acquisitionDate: timestamp("acquisition_date"),
  acquisitionSource: text("acquisition_source"),
  price: integer("price"),
  notes: text("notes"),
  allocatedAt: timestamp("allocated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bookTransfers = pgTable("book_transfers", {
  id: serial("id").primaryKey(),
  bookCopyId: integer("book_copy_id").notNull().references(() => bookCopies.id),
  sourceLibraryId: integer("source_library_id").notNull().references(() => libraries.id),
  destinationLibraryId: integer("destination_library_id").notNull().references(() => libraries.id),
  status: transferStatusEnum("status").notNull().default('PENDING'),
  requestedBy: integer("requested_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  requestDate: timestamp("request_date").notNull().defaultNow(),
  approvalDate: timestamp("approval_date"),
  completionDate: timestamp("completion_date"),
  reason: text("reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const libraryMemberships = pgTable("library_memberships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  libraryId: integer("library_id").notNull().references(() => libraries.id),
  role: text("role").notNull().default('MEMBER'),
  isPrimaryLibrary: boolean("is_primary_library").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
});

// Staff allocation action type enum
export const auditLogCategoryEnum = pgEnum('audit_log_category', [
  'AUTHENTICATION', 'USER_MANAGEMENT', 'CATALOG', 'CIRCULATION', 
  'FINES', 'INVENTORY', 'REPORTS', 'ERP_INTEGRATION', 
  'SYSTEM_CONFIG', 'STAFF_ALLOCATION'
]);

export const auditLogStatusEnum = pgEnum('audit_log_status', ['SUCCESS', 'FAILURE']);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  category: auditLogCategoryEnum("category").notNull(),
  action: text("action").notNull(),
  status: auditLogStatusEnum("status").notNull().default('SUCCESS'),
  userId: integer("user_id"),
  userName: text("user_name"),
  targetType: text("target_type"),
  targetId: text("target_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  errorMessage: text("error_message"),
});

export const staffAllocationActionEnum = pgEnum('staff_allocation_action', ['ALLOCATED', 'DEALLOCATED']);

// Audit log for staff library allocations
export const staffAllocationLogs = pgTable("staff_allocation_logs", {
  id: serial("id").primaryKey(),
  staffUserId: integer("staff_user_id").notNull().references(() => users.id),
  libraryId: integer("library_id").notNull().references(() => libraries.id),
  action: staffAllocationActionEnum("action").notNull(),
  performedByUserId: integer("performed_by_user_id").notNull().references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  joinedDate: true,
});

export const insertResourceTypeSchema = createInsertSchema(resourceTypes).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  createdAt: true,
});

export const insertCirculationSchema = createInsertSchema(circulation).omit({
  id: true,
  checkoutDate: true,
});

export const insertInventorySchema = createInsertSchema(inventory).omit({
  id: true,
  createdAt: true,
});

export const insertSystemConfigSchema = createInsertSchema(systemConfig).omit({
  id: true,
  updatedAt: true,
});

export const insertErpIntegrationSchema = createInsertSchema(erpIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  secretLastRotatedAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  createdAt: true,
});

export const insertErpWhitelistSchema = createInsertSchema(erpIntegrationWhitelist).omit({
  id: true,
  createdAt: true,
});

export const insertErpPullEndpointSchema = createInsertSchema(erpPullEndpoints).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastTestedAt: true,
  lastTestStatus: true,
});

export const insertErpFieldMappingSchema = createInsertSchema(erpFieldMappings).omit({
  id: true,
  createdAt: true,
});

export const insertErpTestLogSchema = createInsertSchema(erpTestLogs).omit({
  id: true,
  createdAt: true,
});

export const insertOrgUnitSchema = createInsertSchema(orgUnits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLibrarySchema = createInsertSchema(libraries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBookCopySchema = createInsertSchema(bookCopies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBookTransferSchema = createInsertSchema(bookTransfers).omit({
  id: true,
  requestDate: true,
  createdAt: true,
});

export const insertLibraryMembershipSchema = createInsertSchema(libraryMemberships).omit({
  id: true,
  joinedAt: true,
});

export const insertStaffAllocationLogSchema = createInsertSchema(staffAllocationLogs).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertAuditSessionSchema = createInsertSchema(auditSessions).omit({
  id: true,
  startedAt: true,
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertResourceType = z.infer<typeof insertResourceTypeSchema>;
export type ResourceType = typeof resourceTypes.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof books.$inferSelect;

export type InsertCirculation = z.infer<typeof insertCirculationSchema>;
export type Circulation = typeof circulation.$inferSelect;

export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventory.$inferSelect;

export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type SystemConfig = typeof systemConfig.$inferSelect;

export type InsertErpIntegration = z.infer<typeof insertErpIntegrationSchema>;
export type ErpIntegration = typeof erpIntegrations.$inferSelect;

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

export type InsertErpWhitelist = z.infer<typeof insertErpWhitelistSchema>;
export type ErpWhitelist = typeof erpIntegrationWhitelist.$inferSelect;

export type InsertErpPullEndpoint = z.infer<typeof insertErpPullEndpointSchema>;
export type ErpPullEndpoint = typeof erpPullEndpoints.$inferSelect;

export type InsertErpFieldMapping = z.infer<typeof insertErpFieldMappingSchema>;
export type ErpFieldMapping = typeof erpFieldMappings.$inferSelect;

export type InsertErpTestLog = z.infer<typeof insertErpTestLogSchema>;
export type ErpTestLog = typeof erpTestLogs.$inferSelect;

export type InsertOrgUnit = z.infer<typeof insertOrgUnitSchema>;
export type OrgUnit = typeof orgUnits.$inferSelect;

export type InsertLibrary = z.infer<typeof insertLibrarySchema>;
export type Library = typeof libraries.$inferSelect;

export type InsertBookCopy = z.infer<typeof insertBookCopySchema>;
export type BookCopy = typeof bookCopies.$inferSelect;

export type InsertBookTransfer = z.infer<typeof insertBookTransferSchema>;
export type BookTransfer = typeof bookTransfers.$inferSelect;

export type InsertLibraryMembership = z.infer<typeof insertLibraryMembershipSchema>;
export type LibraryMembership = typeof libraryMemberships.$inferSelect;

export type InsertStaffAllocationLog = z.infer<typeof insertStaffAllocationLogSchema>;
export type StaffAllocationLog = typeof staffAllocationLogs.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertAuditSession = z.infer<typeof insertAuditSessionSchema>;
export type AuditSession = typeof auditSessions.$inferSelect;

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;
