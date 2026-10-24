import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { parseReport, ValidationError } from "@/lib/reports/validation";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 16_384) return Response.json({error: "El formulario es demasiado grande."}, {status: 413});
  try {
    const raw = await request.text();
    if (raw.length > 16_384) return Response.json({error: "El formulario es demasiado grande."}, {status: 413});
    const input = parseReport(JSON.parse(raw));
    const [report] = await db.insert(citizenReports).values(input).returning({publicId: citizenReports.publicId});
    return Response.json(report, {status: 201});
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ValidationError) return Response.json({error: error instanceof ValidationError ? error.message : "El formulario no tiene un formato válido."}, {status: 400});
    console.error("Could not create citizen report");
    return Response.json({error: "No pudimos guardar el reporte. Intentá nuevamente."}, {status: 503});
  }
}
