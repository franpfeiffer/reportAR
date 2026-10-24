import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { citizenReports, reverseGeocodeCache, reverseGeocodeGate, userProfiles } from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

export const sqlClient = neon(connectionString);

export const db = drizzle(sqlClient, { schema: { citizenReports, reverseGeocodeCache, reverseGeocodeGate, userProfiles } });

export function getSql() {
  return sqlClient;
}
