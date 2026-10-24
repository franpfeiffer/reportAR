import { getCurrentProfile } from "@reportar/auth";
import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { eq } from "drizzle-orm";
import { categoryLabels, isRecord, isUuid, statusLabels, type Category, type ReportStatus } from "@/lib/reports/validation";

export async function PATCH(request: Request, {params}: {params: Promise<{id: string}>}) {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({error: "Iniciá sesión para continuar."}, {status: 401});
  if (profile.role !== "MUNICIPAL_ADMIN") return Response.json({error: "Tu cuenta no tiene acceso municipal."}, {status: 403});
  const {id} = await params;
  if (!isUuid(id)) return Response.json({error: "Reclamo no encontrado."}, {status: 404});
  let body: unknown;
  try {body = await request.json();} catch {return Response.json({error: "Datos inválidos."}, {status: 400});}
  if (!isRecord(body) || Object.hasOwn(body, "status") === Object.hasOwn(body, "category")) return Response.json({error: "Datos inválidos."}, {status: 400});
  try {
    if (Object.hasOwn(body, "status")) {
      if (typeof body.status !== "string" || !Object.hasOwn(statusLabels, body.status)) return Response.json({error: "Estado inválido."}, {status: 400});
      const [report] = await db.update(citizenReports).set({status: body.status as ReportStatus, updatedAt: new Date()}).where(eq(citizenReports.publicId, id)).returning({publicId: citizenReports.publicId, status: citizenReports.status});
      return report ? Response.json(report) : Response.json({error: "Reclamo no encontrado."}, {status: 404});
    }
    if (typeof body.category !== "string" || !Object.hasOwn(categoryLabels, body.category)) return Response.json({error: "Categoría inválida."}, {status: 400});
    const [report] = await db.update(citizenReports).set({category: body.category as Category, classificationStatus: "REVIEWED", updatedAt: new Date()}).where(eq(citizenReports.publicId, id)).returning({publicId: citizenReports.publicId, category: citizenReports.category, classificationStatus: citizenReports.classificationStatus});
    return report ? Response.json(report) : Response.json({error: "Reclamo no encontrado."}, {status: 404});
  } catch {return Response.json({error: "No pudimos actualizar el reclamo."}, {status: 503});}
}
