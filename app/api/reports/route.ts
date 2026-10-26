import { db } from "@reportar/db";
import { citizenReports, reportEvents } from "@reportar/db/schema";
import { parseReport, ValidationError } from "@/lib/reports/validation";
import { createHash, randomBytes } from "node:crypto";
import { isRecord } from "@/lib/reports/validation";
import { classifyReport } from "@/lib/reports/classification";
import { isReportRateLimited } from "@/lib/reports/rate-limit";
import { suggestedDueAt } from "@/lib/reports/sla";

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const body: unknown = JSON.parse(raw);
    if (isRecord(body) && typeof body.website === "string" && body.website.trim()) {
      return Response.json({ error: "No pudimos validar el formulario." }, { status: 400 });
    }
    const input = parseReport(body);
    if (await isReportRateLimited(request)) return Response.json({ error: "Alcanzaste el límite de reportes por ahora. Intentá más tarde." }, { status: 429 });
    const expectsPhoto = isRecord(body) && body.expectsPhoto === true;
    const photoUploadToken = expectsPhoto ? randomBytes(32).toString("hex") : null;
    const classification = await classifyReport(input.description, input.category);
    const [report] = await db.insert(citizenReports).values({
      ...input,
      ...classification,
      dueAt: suggestedDueAt(classification.urgency),
      photoUploadTokenHash: photoUploadToken ? createHash("sha256").update(photoUploadToken).digest("hex") : null,
    }).returning({publicId: citizenReports.publicId});
    await db.insert(reportEvents).values({ reportPublicId: report.publicId, type: "CREATED", toStatus: "RECIBIDO" });
    return Response.json({ ...report, ...(photoUploadToken ? { photoUploadToken } : {}) }, {status: 201});
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ValidationError) return Response.json({error: error instanceof ValidationError ? error.message : "El formulario no tiene un formato válido."}, {status: 400});
    console.error("Could not create citizen report");
    return Response.json({error: "No pudimos guardar el reporte. Intentá nuevamente."}, {status: 503});
  }
}
