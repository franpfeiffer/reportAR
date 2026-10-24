import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

export type UserProfile = typeof userProfiles.$inferSelect;
