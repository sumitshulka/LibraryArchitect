import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, integer, boolean, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

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
  role: userRoleEnum("role").notNull().default('STUDENT'),
  status: userStatusEnum("status").notNull().default('ACTIVE'),
  joinedDate: timestamp("joined_date").notNull().defaultNow(),
  avatarUrl: text("avatar_url"),
});

export const resourceTypes = pgTable("resource_types", {
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const erpIntegrationWhitelist = pgTable("erp_integration_whitelist", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id").notNull().references(() => erpIntegrations.id, { onDelete: 'cascade' }),
  urlPattern: text("url_pattern").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
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

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  joinedDate: true,
});

export const insertResourceTypeSchema = createInsertSchema(resourceTypes).omit({
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

export const insertErpWhitelistSchema = createInsertSchema(erpIntegrationWhitelist).omit({
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertResourceType = z.infer<typeof insertResourceTypeSchema>;
export type ResourceType = typeof resourceTypes.$inferSelect;

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

export type InsertErpWhitelist = z.infer<typeof insertErpWhitelistSchema>;
export type ErpWhitelist = typeof erpIntegrationWhitelist.$inferSelect;

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
