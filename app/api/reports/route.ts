import { db } from "@reportar/auth/db";
import { citizenReports } from "@reportar/auth/schema";

const categories = new Set(["BACHE", "ALUMBRADO", "BASURA", "ARBOLADO", "OTRO"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "El formulario no tiene un formato válido." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return Response.json({ error: "El formulario no tiene un formato válido." }, { status: 400 });
  }

  const category = typeof body.category === "string" ? body.category : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!categories.has(category)) {
    return Response.json({ error: "Elegí una categoría válida." }, { status: 400 });
  }
  if (address.length < 5 || address.length > 200) {
    return Response.json({ error: "Indicá una ubicación de entre 5 y 200 caracteres." }, { status: 400 });
  }
  if (description.length < 15 || description.length > 2000) {
    return Response.json({ error: "La descripción debe tener entre 15 y 2000 caracteres." }, { status: 400 });
  }

  try {
    const [report] = await db.insert(citizenReports).values({
      category: category as "BACHE" | "ALUMBRADO" | "BASURA" | "ARBOLADO" | "OTRO",
      address,
      description,
    }).returning({ publicId: citizenReports.publicId });

    return Response.json({ publicId: report.publicId }, { status: 201 });
  } catch (error) {
    console.error("Could not create citizen report", error);
    return Response.json({ error: "No pudimos guardar el reporte. Intentá nuevamente." }, { status: 503 });
  }
}
