import { db } from "@reportar/db";
import { citizenReports, reportEvents } from "@reportar/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { isUuid } from "@/lib/reports/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Reclamo no encontrado." }, { status: 404 });
  try {
    const [report] = await db.select({ status: citizenReports.status, updatedAt: citizenReports.updatedAt, createdAt: citizenReports.createdAt }).from(citizenReports).where(eq(citizenReports.publicId, id)).limit(1);
    if (!report) return Response.json({ error: "Reclamo no encontrado." }, { status: 404 });
    const events = await db.select({ type: reportEvents.type, fromStatus: reportEvents.fromStatus, toStatus: reportEvents.toStatus, publicMessage: reportEvents.publicMessage, createdAt: reportEvents.createdAt })
      .from(reportEvents).where(and(eq(reportEvents.reportPublicId, id), inArray(reportEvents.type, ["CREATED", "STATUS_CHANGED", "MUNICIPAL_RESPONSE"]))).orderBy(asc(reportEvents.createdAt)).limit(100);
    const publicEvents = events.map(({ type, fromStatus, toStatus, publicMessage, createdAt }) => ({ type, fromStatus, toStatus, publicMessage, createdAt: createdAt.toISOString() }));
    if (!publicEvents.some(event => event.type === "CREATED")) publicEvents.unshift({ type: "CREATED", fromStatus: null, toStatus: "RECIBIDO", publicMessage: null, createdAt: report.createdAt.toISOString() });
    return Response.json({ status: report.status, updatedAt: report.updatedAt.toISOString(), events: publicEvents }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "No pudimos cargar las novedades." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
