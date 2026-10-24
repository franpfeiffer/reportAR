import { getSql } from "@reportar/auth/db";
import { connection } from "next/server";

export async function GET() {
  await connection();
  try {
    const sql = getSql();
    const [result] = await sql`select current_database() as database, now() as connected_at, to_regclass('public.user_profiles') is not null as profiles_ready`;

    return Response.json({ status: "ok", ...result });
  } catch (error) {
    console.error("Database health check failed", error);
    return Response.json({ status: "error", error: "Database connection failed" }, { status: 503 });
  }
}
