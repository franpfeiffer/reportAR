import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { createReportPhotoUpload } from "@/lib/reports/neon-storage";
import { canUploadPhoto, MAX_PHOTO_BYTES } from "@/lib/reports/photo-upload";
import { isRecord } from "@/lib/reports/validation";

const isContentType = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(value);

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 4096) {
    return Response.json({ error: "Solicitud inválida." }, { status: 413 });
  }
  try {
    // Keep the legacy Vercel Blob protocol for the separately maintained n8n
    // workflow while the citizen web form uses Neon Object Storage.
    const legacyBody: unknown = await request.clone().json();
    if (isRecord(legacyBody) && typeof legacyBody.type === "string" && legacyBody.type.startsWith("blob.")) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "El servicio de fotos no está configurado." }, { status: 503 });
      const response = await handleUpload({
        body: legacyBody as unknown as HandleUploadBody,
        request,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          let payload: unknown;
          try { payload = JSON.parse(clientPayload || "null"); } catch { payload = null; }
          if (!isRecord(payload) || !await canUploadPhoto(payload.reportId, payload.token)) throw new Error("No se puede adjuntar la foto a este reporte.");
          if (typeof payload.reportId !== "string" || !pathname.startsWith(`reports/${payload.reportId}/`) || pathname.length > 220) throw new Error("El nombre de la foto no es válido.");
          return {
            maximumSizeInBytes: MAX_PHOTO_BYTES,
            validUntil: Date.now() + 10 * 60_000,
            addRandomSuffix: false,
            ...(payload.client === "n8n" ? { allowOverwrite: true } : {}),
          };
        },
      });
      return Response.json(response);
    }
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.reportId !== "string" || typeof body.filename !== "string" ||
        body.filename.length > 255 || !isContentType(body.contentType) ||
        typeof body.size !== "number" || !Number.isInteger(body.size) || body.size < 1 || body.size > MAX_PHOTO_BYTES) {
      return Response.json({ error: "La foto no es válida o supera los 100 MB." }, { status: 400 });
    }
    if (!await canUploadPhoto(body.reportId, body.token)) {
      return Response.json({ error: "No se puede adjuntar la foto a este reporte." }, { status: 403 });
    }
    const upload = await createReportPhotoUpload(body.reportId, body.filename, body.contentType, MAX_PHOTO_BYTES);
    return Response.json(upload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "No pudimos preparar la subida de la foto." }, { status: 503 });
  }
}
