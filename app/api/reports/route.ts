import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { parseReport, ValidationError } from "@/lib/reports/validation";
import { createHash, randomBytes } from "node:crypto";
import { isRecord } from "@/lib/reports/validation";
import { classifyReport } from "@/lib/reports/classification";

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const body: unknown = JSON.parse(raw);
    const input = parseReport(body);
    const expectsPhoto = isRecord(body) && body.expectsPhoto === true;
    const photoUploadToken = expectsPhoto ? randomBytes(32).toString("hex") : null;
    const classification = await classifyReport(input.description, input.category);
    const [report] = await db.insert(citizenReports).values({
      ...input,
      ...classification,
      photoUploadTokenHash: photoUploadToken ? createHash("sha256").update(photoUploadToken).digest("hex") : null,
    }).returning({publicId: citizenReports.publicId});
    return Response.json({ ...report, ...(photoUploadToken ? { photoUploadToken } : {}) }, {status: 201});
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ValidationError) return Response.json({error: error instanceof ValidationError ? error.message : "El formulario no tiene un formato válido."}, {status: 400});
    console.error("Could not create citizen report");
    return Response.json({error: "No pudimos guardar el reporte. Intentá nuevamente."}, {status: 503});
  }
}
