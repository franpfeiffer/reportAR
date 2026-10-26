import { getCurrentProfile } from "@reportar/auth";
import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { and, desc, eq, inArray, ilike } from "drizzle-orm";
import { categoryLabels, statusLabels, urgencyLabels } from "@/lib/reports/validation";

function csvCell(value: unknown) {
  let text = value instanceof Date ? value.toISOString() : value === null || value === undefined ? "" : String(value);
  if (/^\s*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({ error: "Iniciá sesión para continuar." }, { status: 401 });
  if (profile.role !== "MUNICIPAL_ADMIN") return Response.json({ error: "Tu cuenta no tiene acceso municipal." }, { status: 403 });
  const query = new URL(request.url).searchParams;
  const status = query.get("status") || undefined;
  const urgency = query.get("urgency") || undefined;
  const category = query.get("category") || undefined;
  const area = query.get("area")?.trim() || undefined;
  const review = query.get("review") === "pending";
  if ((status && !Object.hasOwn(statusLabels, status)) || (urgency && !Object.hasOwn(urgencyLabels, urgency)) || (category && !Object.hasOwn(categoryLabels, category)) || (area && area.length > 100)) {
    return Response.json({ error: "Los filtros no son válidos." }, { status: 400 });
  }
  try {
    const reports = await db.select({ publicId: citizenReports.publicId, category: citizenReports.category, status: citizenReports.status, urgency: citizenReports.urgency, address: citizenReports.address, description: citizenReports.description, assignedArea: citizenReports.assignedArea, dueAt: citizenReports.dueAt, createdAt: citizenReports.createdAt, updatedAt: citizenReports.updatedAt })
      .from(citizenReports).where(and(
        status ? eq(citizenReports.status, status as keyof typeof statusLabels) : undefined,
        urgency ? eq(citizenReports.urgency, urgency as keyof typeof urgencyLabels) : undefined,
        category ? eq(citizenReports.category, category as keyof typeof categoryLabels) : undefined,
        area ? ilike(citizenReports.assignedArea, `%${area.replace(/[\\%_]/g, "\\$&")}%`) : undefined,
        review ? inArray(citizenReports.urgencyClassificationStatus, ["NEEDS_REVIEW", "UNAVAILABLE"]) : undefined,
      )).orderBy(desc(citizenReports.createdAt)).limit(10_000);
    const headers = ["Código", "Categoría", "Estado", "Urgencia", "Dirección", "Descripción", "Área", "Plazo", "Creado", "Actualizado"];
    const rows = reports.map(report => [report.publicId, categoryLabels[report.category], statusLabels[report.status], report.urgency ? urgencyLabels[report.urgency] : "", report.address, report.description, report.assignedArea, report.dueAt, report.createdAt, report.updatedAt]);
    const csv = `\uFEFF${[headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n")}`;
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="reportar-reclamos-${date}.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "No pudimos exportar los reclamos." }, { status: 503 });
  }
}
