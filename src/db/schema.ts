import {
  pgTable,
  text,
  jsonb,
  timestamp,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const employees = pgTable("dz_employees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  active: boolean("active").notNull().default(true),
  isOwner: boolean("is_owner").notNull().default(false),
  pages: jsonb("pages").$type<string[]>().notNull(),
  actions: jsonb("actions").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const sessions = pgTable("dz_sessions", {
  token: text("token").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const records = pgTable(
  "dz_records",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("dz_records_kind_idx").on(table.kind)],
);
export const settings = pgTable("dz_settings", {
  id: text("id").primaryKey().default("main"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
});
export const uploads = pgTable("dz_uploads", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const backups = pgTable("dz_backups", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
