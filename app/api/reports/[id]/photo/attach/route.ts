import { head } from "@vercel/blob";
import { createHash } from "node:crypto";
import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { and, eq } from "drizzle-orm";
import { canUploadPhoto, MAX_PHOTO_BYTES } from "@/lib/reports/photo-upload";
import { isRecord, isUuid } from "@/lib/reports/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Reporte inválido." }, { status: 404 });
  if (Number(request.headers.get("content-length")) > 4096) return Response.json({ error: "Solicitud inválida." }, { status: 413 });
  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.url !== "string" || body.url.length > 2048 || !await canUploadPhoto(id, body.token)) {
      return Response.json({ error: "No se puede adjuntar la foto a este reporte." }, { status: 403 });
    }
    const url = new URL(body.url);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com")) {
      return Response.json({ error: "La foto no pertenece al almacenamiento de ReportAR." }, { status: 400 });
    }
    const blob = await head(url.toString());
    if (!blob.pathname.startsWith(`reports/${id}/`) || blob.size > MAX_PHOTO_BYTES) {
      return Response.json({ error: "La foto no corresponde a este reporte." }, { status: 400 });
    }
    const filename = blob.pathname.split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "") || "foto";
    const [updated] = await db.update(citizenReports).set({
      photoUrl: blob.url,
      photoContentType: blob.contentType,
      photoFilename: filename,
      photoUploadTokenHash: null,
      updatedAt: new Date(),
    }).where(and(eq(citizenReports.publicId, id), eq(citizenReports.photoUploadTokenHash, hashToken(body.token)))).returning({ id: citizenReports.id });
    if (!updated) return Response.json({ error: "La foto ya fue adjuntada." }, { status: 409 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "No pudimos guardar la foto. Intentá nuevamente." }, { status: 503 });
  }
}

function hashToken(token: unknown) {
  return createHash("sha256").update(String(token)).digest("hex");
}
