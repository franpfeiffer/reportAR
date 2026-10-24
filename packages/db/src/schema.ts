import { doublePrecision, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["CITIZEN", "MUNICIPAL_ADMIN"]);

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  authUserId: text("auth_user_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  role: userRole("role").notNull().default("CITIZEN"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reportCategory = pgEnum("report_category", [
  "BACHE",
  "ALUMBRADO",
  "BASURA",
  "ARBOLADO",
  "OTRO",
]);

export const reportStatus = pgEnum("report_status", [
  "RECIBIDO",
  "EN_REVISION",
  "RESUELTO",
]);

export const citizenReports = pgTable("citizen_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  publicId: uuid("public_id").notNull().defaultRandom().unique(),
  category: reportCategory("category").notNull(),
  address: text("address").notNull(),
  description: text("description").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  photoUrl: text("photo_url"),
  photoContentType: text("photo_content_type"),
  photoFilename: text("photo_filename"),
  photoUploadTokenHash: text("photo_upload_token_hash"),
  source: text("source").notNull().default("WEB"),
  status: reportStatus("status").notNull().default("RECIBIDO"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reverseGeocodeCache = pgTable("reverse_geocode_cache", {
  coordinateKey: text("coordinate_key").primaryKey(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reverseGeocodeGate = pgTable("reverse_geocode_gate", {
  id: integer("id").primaryKey(),
  lastRequestAt: timestamp("last_request_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type CitizenReport = typeof citizenReports.$inferSelect;
