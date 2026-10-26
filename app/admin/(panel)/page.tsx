import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReportMap } from "@/components/report-map";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "./logout-button";
import { ReportStatusControl } from "./report-status";
import { ReportUrgencyReview } from "./report-urgency-review";
import { db } from "@reportar/db";
import { citizenReports, reportEvents } from "@reportar/db/schema";
import { requireMunicipalAdmin } from "@reportar/auth";
import { and, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { categoryLabels, statusLabels, urgencyLabels, type ReportStatus, type Urgency } from "@/lib/reports/validation";
import { categoryLabels as categories } from "@/lib/reports/validation";
import { ReportOperations } from "./report-operations";
import { getReportIndex } from "@/lib/reports/explorer";
import catalog from "@/lib/geography/catalog.json";

export const instant = false;

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; urgency?: string; review?: string; category?: string; area?: string }> }) {
  await requireMunicipalAdmin();
  const query = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(query.page || "1", 10) || 1));
  const status = query.status && Object.hasOwn(statusLabels, query.status) ? query.status as ReportStatus : undefined;
  const urgency = query.urgency && Object.hasOwn(urgencyLabels, query.urgency) ? query.urgency as Urgency : undefined;
  const category = query.category && Object.hasOwn(categories, query.category) ? query.category as keyof typeof categories : undefined;
  const area = typeof query.area === "string" ? query.area.trim().slice(0, 100) : "";
  const reviewPending = query.review === "pending";
  const [metrics] = await db.select({
    total: count(),
    pending: sql<number>`count(*) filter (where ${citizenReports.status} <> 'RESUELTO')::int`,
    urgent: sql<number>`count(*) filter (where ${citizenReports.urgency} = 'URGENTE' and ${citizenReports.status} <> 'RESUELTO')::int`,
    overdue: sql<number>`count(*) filter (where ${citizenReports.status} <> 'RESUELTO' and ${citizenReports.dueAt} < now())::int`,
  }).from(citizenReports);
  const firstResolution = db.select({ reportId: reportEvents.reportPublicId, resolvedAt: sql<Date>`min(${reportEvents.createdAt})`.as("resolved_at") })
    .from(reportEvents).where(and(eq(reportEvents.type, "STATUS_CHANGED"), eq(reportEvents.toStatus, "RESUELTO"))).groupBy(reportEvents.reportPublicId).as("first_resolution");
  const [resolution] = await db.select({ days: sql<number>`coalesce(avg(extract(epoch from (${firstResolution.resolvedAt} - ${citizenReports.createdAt})) / 86400), 0)::float` })
    .from(firstResolution).innerJoin(citizenReports, eq(firstResolution.reportId, citizenReports.publicId));
  const categoryTotals = await db.select({ category: citizenReports.category, total: count() }).from(citizenReports).groupBy(citizenReports.category).orderBy(desc(count())).limit(5);
  const index = await getReportIndex();
  const municipalityCounts = new Map<string, number>();
  for (const report of index.reports) if (report.municipalityId) municipalityCounts.set(report.municipalityId, (municipalityCounts.get(report.municipalityId) ?? 0) + 1);
  const hotMunicipalities = [...municipalityCounts].map(([id, total]) => ({ name: catalog.municipalities.find(item => item.id === id)?.name ?? "Municipio", total })).sort((a, b) => b.total - a.total).slice(0, 5);
  const rows = await db.select().from(citizenReports)
    .where(and(
      status ? eq(citizenReports.status, status) : undefined,
      urgency ? eq(citizenReports.urgency, urgency) : undefined,
      category ? eq(citizenReports.category, category) : undefined,
      area ? ilike(citizenReports.assignedArea, `%${area.replace(/[\\%_]/g, "\\$&")}%`) : undefined,
      reviewPending ? inArray(citizenReports.urgencyClassificationStatus, ["NEEDS_REVIEW", "UNAVAILABLE"]) : undefined,
    ))
    .orderBy(desc(citizenReports.createdAt), desc(citizenReports.id))
    .limit(51).offset((page - 1) * 50);
  const reports = rows.slice(0, 50);
  const points = reports.flatMap(r => r.latitude !== null && r.longitude !== null
    ? [{ latitude: r.latitude, longitude: r.longitude, label: `${categoryLabels[r.category]}: ${r.address}` }]
    : []);
  const filters = new URLSearchParams();
  if (status) filters.set("status", status);
  if (urgency) filters.set("urgency", urgency);
  if (category) filters.set("category", category);
  if (area) filters.set("area", area);
  if (reviewPending) filters.set("review", "pending");
  const filterString = filters.toString();
  const pageUrl = (n: number) => `/admin?page=${n}${filterString ? `&${filterString}` : ""}`;
  const exportUrl = `/api/admin/reports/export${filterString ? `?${filterString}` : ""}`;

  return (
    <div className="min-h-screen bg-[#F1F5F2]">
      <header className="bg-[#14433F] text-white"><div className="site-shell flex min-h-20 flex-wrap items-center justify-between gap-4 py-3"><Brand inverse /><div className="flex items-center gap-3 sm:gap-5"><ThemeToggle inverse /><span className="hidden text-sm text-[#C5E0D4] sm:inline">Panel municipal</span><LogoutButton /></div></div></header>
      <main className="site-shell py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-6"><div><h1 className="page-title">Reclamos de la comunidad.</h1><p className="body-lead mt-4 max-w-2xl">Revisá cada situación, ubicala en el mapa y mantené actualizado su estado.</p></div><span className="rounded-full bg-[#DCECE5] px-4 py-2 text-sm font-semibold text-[#116D63]">{reports.length} en esta página</span></div>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores municipales">{[
          ["Reportes totales", metrics.total.toLocaleString("es-AR"), "bg-white"],
          ["Pendientes", metrics.pending.toLocaleString("es-AR"), "bg-white"],
          ["Urgentes abiertos", metrics.urgent.toLocaleString("es-AR"), "bg-[#FFF4E9]"],
          ["Fuera de plazo", metrics.overdue.toLocaleString("es-AR"), metrics.overdue ? "bg-[#FFEAE4] text-[#9D382B]" : "bg-white"],
          ["Promedio hasta resolver", resolution?.days ? `${Number(resolution.days).toLocaleString("es-AR", { maximumFractionDigits: 1 })} días` : "—", "bg-white"],
        ].map(([label, value, style]) => <div key={label} className={`surface px-5 py-4 ${style}`}><p className="text-xs font-semibold text-[#5B746F]">{label}</p><p className="mt-2 text-2xl font-bold tracking-[-.04em]">{value}</p></div>)}</section>
        <section className="mt-4 grid gap-4 lg:grid-cols-2" aria-label="Resumen de incidentes"><div className="surface p-5"><h2 className="font-bold">Categorías más reportadas</h2><ol className="mt-3 grid gap-2">{categoryTotals.map(item => <li key={item.category} className="flex justify-between gap-4 text-sm"><span>{categoryLabels[item.category]}</span><strong>{item.total.toLocaleString("es-AR")}</strong></li>)}</ol></div><div className="surface p-5"><h2 className="font-bold">Municipios con más reportes</h2><ol className="mt-3 grid gap-2">{hotMunicipalities.length ? hotMunicipalities.map((item, i) => <li key={`${item.name}-${i}`} className="flex justify-between gap-4 text-sm"><span>{item.name}</span><strong>{item.total.toLocaleString("es-AR")}</strong></li>) : <li className="text-sm text-[#5B746F]">Todavía no hay ubicaciones identificadas.</li>}</ol></div></section>

        <section className="mt-8" aria-label="Filtros de reclamos"><form action="/admin" className="flex flex-wrap items-end gap-3"><div><label htmlFor="status" className="form-label">Estado del reporte</label><select id="status" name="status" defaultValue={status || ""} className="field-control min-w-48"><option value="">Todos los estados</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div><label htmlFor="urgency" className="form-label">Urgencia</label><select id="urgency" name="urgency" defaultValue={urgency || ""} className="field-control min-w-48"><option value="">Todas las urgencias</option>{Object.entries(urgencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div><label htmlFor="category" className="form-label">Categoría</label><select id="category" name="category" defaultValue={category || ""} className="field-control min-w-48"><option value="">Todas</option>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div><label htmlFor="area" className="form-label">Área responsable</label><input id="area" name="area" defaultValue={area} maxLength={100} placeholder="Todas las áreas" className="field-control min-w-48" /></div><div><label htmlFor="review" className="form-label">Revisión</label><select id="review" name="review" defaultValue={reviewPending ? "pending" : ""} className="field-control min-w-48"><option value="">Todos</option><option value="pending">Urgencia pendiente</option></select></div><Button type="submit" className="h-[3.3rem] rounded-lg px-5">Aplicar filtro</Button>{(status || urgency || category || area || reviewPending) && <Link href="/admin" className="civic-link mb-3 text-sm">Limpiar filtros</Link>}<a href={exportUrl} className="civic-button civic-button-outline mb-0.5">Exportar CSV</a></form></section>

        {points.length > 0 && <section className="mt-9" aria-label="Mapa de reclamos"><div className="mb-4 flex items-baseline justify-between gap-3"><h2 className="section-title">En el mapa</h2><span className="text-sm text-[#5B746F]">{points.length} con ubicación en esta página</span></div><ReportMap points={points} /></section>}

        <section className="surface mt-9 overflow-hidden" aria-label="Lista de reclamos">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#CBDCD4] px-6 py-5 sm:px-8"><h2 className="text-xl font-bold tracking-[-.035em]">Bandeja de reclamos</h2><p className="text-sm text-[#5B746F]">Más recientes primero</p></div>
          {reports.length === 0 ? <div className="px-6 py-14 sm:px-8"><h3 className="text-xl font-bold">No hay reclamos para mostrar.</h3><p className="mt-2 text-[#5B746F]">Probá otro estado para ver el resto de los reportes.</p><Link href="/admin" className="civic-link mt-5 inline-block">Ver todos los estados</Link></div>
          : reports.map(report => <article key={report.id} className="grid gap-5 border-b border-[#CBDCD4] px-6 py-7 last:border-b-0 sm:px-8 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-8">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><StatusPill status={report.status} /><span className="text-sm text-[#5B746F]">{report.source === "TELEGRAM" ? "Telegram" : "Formulario web"}</span>{report.urgency && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${report.urgency === "URGENTE" ? "bg-[#FFEAE4] text-[#9D382B]" : "bg-[#DCECE5] text-[#116D63]"}`}>{urgencyLabels[report.urgency]}</span>}{(report.urgencyClassificationStatus === "NEEDS_REVIEW" || report.urgencyClassificationStatus === "UNAVAILABLE") && <span className="rounded-full bg-[#FFF1CE] px-3 py-1 text-xs font-semibold text-[#7A4B00]">Revisar urgencia</span>}</div><h3 className="mt-4 text-xl font-bold tracking-[-.03em]">{categoryLabels[report.category]}</h3><p className="mt-1 font-medium text-[#42615B]">{report.address}</p>{report.assignedArea && <p className="mt-2 text-sm text-[#5B746F]">Área: <strong>{report.assignedArea}</strong></p>}{report.dueAt && <p className={`mt-2 text-sm font-semibold ${report.status !== "RESUELTO" && report.dueAt < new Date() ? "text-[#A43E30]" : "text-[#5B746F]"}`}>{report.status !== "RESUELTO" && report.dueAt < new Date() ? "Fuera de plazo · " : "Plazo sugerido · "}{report.dueAt.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" })}</p>}{(report.urgencyClassificationStatus === "NEEDS_REVIEW" || report.urgencyClassificationStatus === "UNAVAILABLE") && <div className="mt-3 rounded-lg border border-[#E8D6A6] bg-[#FFF9E9] p-3 text-sm text-[#684A14]"><p className="font-semibold">Revisión de urgencia pendiente</p>{report.suggestedUrgency ? <p className="mt-1">JEV sugiere {urgencyLabels[report.suggestedUrgency].toLowerCase()}. Probabilidad de que requiera reparación urgente: {Math.round((report.urgentProbability ?? 0) * 100)}%.</p> : report.urgencyClassificationStatus === "UNAVAILABLE" ? <p className="mt-1">JEV no estuvo disponible. La categoría del reporte se conserva; asigná la urgencia manualmente.</p> : <p className="mt-1">Este reporte todavía no tiene una evaluación de urgencia.</p>}</div>}{report.urgencyClassificationStatus === "AUTO_ASSIGNED" && report.urgentProbability !== null && <p className="mt-2 text-sm text-[#5B746F]">Probabilidad de urgencia: {Math.round(report.urgentProbability * 100)}%.</p>}<p className="mt-4 line-clamp-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-[#4E6A63]">{report.description}</p><Link href={`/reclamo/${report.publicId}`} className="civic-link mt-4 inline-flex text-sm">Ver reclamo completo</Link></div>
              <div className="flex flex-col gap-5 border-t border-[#CBDCD4] pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0"><time className="text-sm text-[#5B746F]" dateTime={report.createdAt.toISOString()}>{report.createdAt.toLocaleDateString("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" })}</time><ReportUrgencyReview id={report.publicId} urgency={report.urgency} suggestedUrgency={report.suggestedUrgency} urgencyClassificationStatus={report.urgencyClassificationStatus} /><ReportStatusControl id={report.publicId} status={report.status} /><ReportOperations id={report.publicId} assignedArea={report.assignedArea} dueAt={report.dueAt?.toISOString() ?? null} /></div>
            </article>)}
        </section>
        <nav aria-label="Páginas de reclamos" className="mt-7 flex items-center justify-between gap-4 text-sm"><div>{page > 1 && <Link href={pageUrl(page - 1)} className="civic-link">Página anterior</Link>}</div><span className="text-[#5B746F]">Página {page}</span><div>{rows.length > 50 && <Link href={pageUrl(page + 1)} className="civic-link">Página siguiente</Link>}</div></nav>
      </main>
    </div>
  );
}
