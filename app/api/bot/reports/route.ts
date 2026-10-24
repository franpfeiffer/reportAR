import { timingSafeEqual, createHash } from "node:crypto";
import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { parseBotReport } from "@/lib/reports/bot-validation";
import { ValidationError } from "@/lib/reports/validation";
import { classifyReport, unavailableClassification } from "@/lib/reports/classification";
import { storeTelegramPhoto } from "@/lib/reports/telegram-photo";

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
    let [report] = await db.select({
      id: citizenReports.publicId,
      telegramFileId: citizenReports.telegramFileId,
      photoStorageKey: citizenReports.photoStorageKey,
    }).from(citizenReports).where(eq(citizenReports.externalId, input.externalId)).limit(1);
    let status = 200;

    if (!report) {
      const [created] = await db.insert(citizenReports).values({
        ...input,
        ...unavailableClassification(input.category),
      }).onConflictDoNothing({target: citizenReports.externalId}).returning({id: citizenReports.publicId});
      if (created) {
        report = { id: created.id, telegramFileId: input.telegramFileId, photoStorageKey: null };
        status = 201;
        const classification = await classifyReport(input.description, input.category);
        await db.update(citizenReports).set(classification).where(eq(citizenReports.externalId, input.externalId));
      } else {
        [report] = await db.select({
          id: citizenReports.publicId,
          telegramFileId: citizenReports.telegramFileId,
          photoStorageKey: citizenReports.photoStorageKey,
        }).from(citizenReports).where(eq(citizenReports.externalId, input.externalId)).limit(1);
        if (!report) throw new Error("Report not found after conflict");
      }
    }

    const response: { id: string; status: "received"; photo_status?: "stored" | "failed" } = {
      id: report.id,
      status: "received",
    };
    if (report.telegramFileId) {
      response.photo_status = report.photoStorageKey ? "stored" : await attachTelegramPhoto(report.id, report.telegramFileId);
    }
    return Response.json(response, { status });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({error: "invalid_json"}, {status: 400});
    if (error instanceof ValidationError) return Response.json({error: error.message}, {status: 422});
    console.error("Could not persist bot report");
    return Response.json({error: "persistence_failed"}, {status: 503});
  }
}

async function attachTelegramPhoto(reportId: string, fileId: string) {
  try {
    const photo = await storeTelegramPhoto(reportId, fileId);
    const [updated] = await db.update(citizenReports).set({
      photoStorageKey: photo.key,
      photoContentType: photo.contentType,
      photoFilename: photo.filename,
      updatedAt: new Date(),
    }).where(and(eq(citizenReports.publicId, reportId), isNull(citizenReports.photoStorageKey))).returning({ id: citizenReports.publicId });
    if (updated) return "stored" as const;

    const [current] = await db.select({ photoStorageKey: citizenReports.photoStorageKey })
      .from(citizenReports).where(eq(citizenReports.publicId, reportId)).limit(1);
    return current?.photoStorageKey ? "stored" as const : "failed" as const;
  } catch {
    console.error("Could not attach Telegram photo");
    return "failed" as const;
  }
}
