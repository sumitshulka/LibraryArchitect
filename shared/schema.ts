import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'LIBRARIAN', 'STUDENT', 'FACULTY']);
export const userStatusEnum = pgEnum('user_status', ['ACTIVE', 'INACTIVE', 'SUSPENDED']);
export const bookStatusEnum = pgEnum('book_status', ['AVAILABLE', 'CHECKED_OUT', 'LOST', 'MAINTENANCE', 'RESERVED']);
export const circulationStatusEnum = pgEnum('circulation_status', ['ACTIVE', 'RETURNED', 'OVERDUE', 'LOST']);
export const authModeEnum = pgEnum('auth_mode', ['LOCAL', 'ERP', 'HYBRID']);

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
  status: bookStatusEnum("status").notNull().default('AVAILABLE'),
  coverUrl: text("cover_url"),
  shelfLocation: text("shelf_location"),
  marcRecord: text("marc_record"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const circulation = pgTable("circulation", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id),
  userId: integer("user_id").notNull().references(() => users.id),
  checkoutDate: timestamp("checkout_date").notNull().defaultNow(),
  dueDate: timestamp("due_date").notNull(),
  returnDate: timestamp("return_date"),
  status: circulationStatusEnum("status").notNull().default('ACTIVE'),
  fineAmount: integer("fine_amount").default(0),
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
