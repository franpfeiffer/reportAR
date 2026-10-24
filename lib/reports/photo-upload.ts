import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { eq } from "drizzle-orm";
import { isUuid } from "./validation";

export const MAX_PHOTO_BYTES = 100 * 1024 * 1024;

export async function canUploadPhoto(reportId: unknown, token: unknown) {
  if (typeof reportId !== "string" || !isUuid(reportId) || typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return false;
  const [report] = await db.select({ tokenHash: citizenReports.photoUploadTokenHash }).from(citizenReports)
    .where(eq(citizenReports.publicId, reportId)).limit(1);
  if (!report?.tokenHash) return false;
  const submittedHash = Buffer.from(createHash("sha256").update(token).digest("hex"), "hex");
  const storedHash = Buffer.from(report.tokenHash, "hex");
  return submittedHash.length === storedHash.length && timingSafeEqual(submittedHash, storedHash);
}
