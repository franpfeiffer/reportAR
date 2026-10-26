import "server-only";
import { createHmac } from "node:crypto";
import { db } from "@reportar/db";
import { reportRateLimits } from "@reportar/db/schema";
import { lt, sql } from "drizzle-orm";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REPORTS_PER_WINDOW = 10;

export async function isReportRateLimited(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientAddress = forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown";
  const secret = process.env.REPORT_RATE_LIMIT_SECRET || process.env.DATABASE_URL;
  if (!secret) return false;
  const clientHash = createHmac("sha256", secret).update(clientAddress).digest("hex");
  const now = new Date();
  const resetBefore = new Date(now.getTime() - WINDOW_MS);
  const [counter] = await db.insert(reportRateLimits).values({ clientHash, windowStartedAt: now, requestCount: 1 })
    .onConflictDoUpdate({
      target: reportRateLimits.clientHash,
      set: {
        requestCount: sql`CASE WHEN ${reportRateLimits.windowStartedAt} <= ${resetBefore} THEN 1 ELSE ${reportRateLimits.requestCount} + 1 END`,
        windowStartedAt: sql`CASE WHEN ${reportRateLimits.windowStartedAt} <= ${resetBefore} THEN ${now} ELSE ${reportRateLimits.windowStartedAt} END`,
      },
    }).returning({ requestCount: reportRateLimits.requestCount });
  await db.delete(reportRateLimits).where(lt(reportRateLimits.windowStartedAt, new Date(now.getTime() - 24 * WINDOW_MS)));
  return (counter?.requestCount ?? 0) > MAX_REPORTS_PER_WINDOW;
}
