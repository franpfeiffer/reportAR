import { getCurrentProfile } from "@reportar/auth";
import { db } from "@reportar/db";
import { citizenReports, reportEvents } from "@reportar/db/schema";
import { eq } from "drizzle-orm";
import { categoryLabels, isRecord, isUuid, statusLabels, urgencyLabels, type Category, type ReportStatus, type Urgency } from "@/lib/reports/validation";

const mutableFields = ["status", "category", "urgency", "assignedArea", "dueAt", "publicMessage"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({ error: "Iniciá sesión para continuar." }, { status: 401 });
  if (profile.role !== "MUNICIPAL_ADMIN") return Response.json({ error: "Tu cuenta no tiene acceso municipal." }, { status: 403 });
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Reclamo no encontrado." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Datos inválidos." }, { status: 400 }); }
  const keys = isRecord(body) ? mutableFields.filter(key => Object.hasOwn(body, key)) : [];
  if (!isRecord(body) || keys.length !== 1) return Response.json({ error: "Elegí un único cambio para guardar." }, { status: 400 });
  const [report] = await db.select({ publicId: citizenReports.publicId, status: citizenReports.status }).from(citizenReports).where(eq(citizenReports.publicId, id)).limit(1);
  if (!report) return Response.json({ error: "Reclamo no encontrado." }, { status: 404 });
  const now = new Date();
  const actorEmail = profile.email;

  try {
    if (Object.hasOwn(body, "status")) {
      if (typeof body.status !== "string" || !Object.hasOwn(statusLabels, body.status)) return Response.json({ error: "Estado inválido." }, { status: 400 });
      const nextStatus = body.status as ReportStatus;
      await db.update(citizenReports).set({ status: nextStatus, updatedAt: now }).where(eq(citizenReports.publicId, id));
      if (report.status !== nextStatus) await db.insert(reportEvents).values({ reportPublicId: id, type: "STATUS_CHANGED", fromStatus: report.status, toStatus: nextStatus, actorEmail });
      return Response.json({ publicId: id, status: nextStatus });
    }
    if (Object.hasOwn(body, "category")) {
      if (typeof body.category !== "string" || !Object.hasOwn(categoryLabels, body.category)) return Response.json({ error: "Categoría inválida." }, { status: 400 });
      const [updated] = await db.update(citizenReports).set({ category: body.category as Category, updatedAt: now }).where(eq(citizenReports.publicId, id)).returning({ publicId: citizenReports.publicId, category: citizenReports.category });
      return updated ? Response.json(updated) : Response.json({ error: "Reclamo no encontrado." }, { status: 404 });
    }
    if (Object.hasOwn(body, "urgency")) {
      if (typeof body.urgency !== "string" || !Object.hasOwn(urgencyLabels, body.urgency)) return Response.json({ error: "Urgencia inválida." }, { status: 400 });
      const [updated] = await db.update(citizenReports).set({ urgency: body.urgency as Urgency, urgencyClassificationStatus: "REVIEWED", updatedAt: now }).where(eq(citizenReports.publicId, id)).returning({ publicId: citizenReports.publicId, urgency: citizenReports.urgency, urgencyClassificationStatus: citizenReports.urgencyClassificationStatus });
      return updated ? Response.json(updated) : Response.json({ error: "Reclamo no encontrado." }, { status: 404 });
    }
    if (Object.hasOwn(body, "assignedArea")) {
      if (body.assignedArea !== null && (typeof body.assignedArea !== "string" || body.assignedArea.trim().length > 100)) return Response.json({ error: "El área debe tener hasta 100 caracteres." }, { status: 400 });
      const assignedArea = typeof body.assignedArea === "string" ? body.assignedArea.trim() || null : null;
      await db.update(citizenReports).set({ assignedArea, updatedAt: now }).where(eq(citizenReports.publicId, id));
      await db.insert(reportEvents).values({ reportPublicId: id, type: "ASSIGNED", actorEmail });
      return Response.json({ publicId: id, assignedArea });
    }
    if (Object.hasOwn(body, "dueAt")) {
      let dueAt: Date | null = null;
      if (body.dueAt !== null) {
        if (typeof body.dueAt !== "string" || body.dueAt.length > 40 || !Number.isFinite(Date.parse(body.dueAt))) return Response.json({ error: "La fecha objetivo no es válida." }, { status: 400 });
        dueAt = new Date(body.dueAt);
      }
      await db.update(citizenReports).set({ dueAt, updatedAt: now }).where(eq(citizenReports.publicId, id));
      await db.insert(reportEvents).values({ reportPublicId: id, type: "DUE_DATE_SET", actorEmail });
      return Response.json({ publicId: id, dueAt: dueAt?.toISOString() ?? null });
    }
    const publicMessage = typeof body.publicMessage === "string" ? body.publicMessage.trim() : "";
    if (!publicMessage || publicMessage.length > 600) return Response.json({ error: "La respuesta debe tener entre 1 y 600 caracteres." }, { status: 400 });
    await db.insert(reportEvents).values({ reportPublicId: id, type: "MUNICIPAL_RESPONSE", publicMessage, actorEmail });
    return Response.json({ publicId: id, createdAt: now.toISOString() });
  } catch {
    return Response.json({ error: "No pudimos actualizar el reclamo." }, { status: 503 });
  }
}
