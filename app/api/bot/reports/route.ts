import { timingSafeEqual, createHash } from "node:crypto";
import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { eq } from "drizzle-orm";
import { parseBotReport } from "@/lib/reports/bot-validation";
import { ValidationError } from "@/lib/reports/validation";

const MAX_BYTES = 20_000;
export async function POST(request: Request) {
  const token = process.env.REPORTS_API_TOKEN;
  if (!token) return Response.json({ error: "service_unavailable" }, { status: 503 });
  const hash = (s: string) => createHash("sha256").update(s).digest();
  if (!timingSafeEqual(hash(request.headers.get("authorization") || ""), hash(`Bearer ${token}`))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    if (Number(request.headers.get("content-length")) > MAX_BYTES) return Response.json({error: "payload_too_large"}, {status: 413});
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) {
            await reader.cancel();
            return Response.json({ error: "payload_too_large" }, { status: 413 });
          }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
    }
    const input = parseBotReport(JSON.parse(Buffer.concat(chunks).toString("utf8")), request.headers.get("idempotency-key"));
    const [created] = await db.insert(citizenReports).values(input).onConflictDoNothing({target: citizenReports.externalId}).returning({id: citizenReports.publicId});
    const report = created ?? (await db.select({id: citizenReports.publicId}).from(citizenReports).where(eq(citizenReports.externalId, input.externalId)).limit(1))[0];
    if (!report) throw new Error("Report not found after conflict");
    return Response.json({id: report.id, status: "received"}, {status: created ? 201 : 200});
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({error: "invalid_json"}, {status: 400});
    if (error instanceof ValidationError) return Response.json({error: error.message}, {status: 422});
    console.error("Could not persist bot report");
    return Response.json({error: "persistence_failed"}, {status: 503});
  }
}
