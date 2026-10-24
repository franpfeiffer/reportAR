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
  "INUNDACION",
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

export const reportClassificationStatus = pgEnum("report_classification_status", [
  "AUTO_ASSIGNED",
  "NEEDS_REVIEW",
  "UNAVAILABLE",
  "REVIEWED",
]);

export const citizenReports = pgTable("citizen_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  publicId: uuid("public_id").notNull().defaultRandom().unique(),
  category: reportCategory("category").notNull(),
  declaredCategory: reportCategory("declared_category"),
  suggestedCategory: reportCategory("suggested_category"),
  classificationProbability: doublePrecision("classification_probability"),
  classificationStatus: reportClassificationStatus("classification_status"),
  classificationModel: text("classification_model"),
  address: text("address").notNull(),
  description: text("description").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  photoUrl: text("photo_url"),
  photoStorageKey: text("photo_storage_key"),
  photoContentType: text("photo_content_type"),
  photoFilename: text("photo_filename"),
  photoUploadTokenHash: text("photo_upload_token_hash"),
  externalId: text("external_id").unique(),
  telegramUserId: text("telegram_user_id"),
  telegramChatId: text("telegram_chat_id"),
  telegramFileId: text("telegram_file_id"),
  reportedAt: timestamp("reported_at", { withTimezone: true }),
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

export const forwardGeocodeCache = pgTable("forward_geocode_cache", {
  queryKey: text("query_key").primaryKey(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type CitizenReport = typeof citizenReports.$inferSelect;
export type ClassificationStatus = typeof reportClassificationStatus.enumValues[number];
