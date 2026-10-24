import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { canUploadPhoto, MAX_PHOTO_BYTES } from "@/lib/reports/photo-upload";
import { isRecord } from "@/lib/reports/validation";

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "El servicio de fotos no está configurado." }, { status: 503 });
  try {
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({
      body,
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
          // n8n retries the same pathname if the upload response is lost.
          ...(payload.client === "n8n" ? { allowOverwrite: true } : {}),
        };
      },
    });
    return Response.json(response);
  } catch {
    return Response.json({ error: "No se pudo autorizar la foto." }, { status: 400 });
  }
}
