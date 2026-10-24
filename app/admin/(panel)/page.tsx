import Link from "next/link";
import { Brand } from "@/components/brand";
import { ReportMap } from "@/components/report-map";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "./logout-button";
import { ReportStatusControl } from "./report-status";
import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { requireMunicipalAdmin } from "@reportar/auth";
import { desc, eq } from "drizzle-orm";
import { categoryLabels, statusLabels, type ReportStatus } from "@/lib/reports/validation";

export const instant = false;

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  await requireMunicipalAdmin();
  const query = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(query.page || "1", 10) || 1));
  const status = query.status && Object.hasOwn(statusLabels, query.status) ? query.status as ReportStatus : undefined;
  const rows = await db.select().from(citizenReports)
    .where(status ? eq(citizenReports.status, status) : undefined)
    .orderBy(desc(citizenReports.createdAt), desc(citizenReports.id))
    .limit(51).offset((page - 1) * 50);
  const reports = rows.slice(0, 50);
  const points = reports.flatMap(r => r.latitude !== null && r.longitude !== null
    ? [{ latitude: r.latitude, longitude: r.longitude, label: `${categoryLabels[r.category]}: ${r.address}` }]
    : []);
  const pageUrl = (n: number) => `/admin?page=${n}${status ? `&status=${status}` : ""}`;

  return (
    <div className="min-h-screen bg-[#F1F5F2]">
      <header className="bg-[#14433F] text-white"><div className="site-shell flex min-h-20 flex-wrap items-center justify-between gap-4 py-3"><Brand inverse /><div className="flex items-center gap-3 sm:gap-5"><span className="hidden text-sm text-[#C5E0D4] sm:inline">Panel municipal</span><LogoutButton /></div></div></header>
      <main className="site-shell py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-6"><div><h1 className="page-title">Reclamos de la comunidad.</h1><p className="body-lead mt-4 max-w-2xl">Revisá cada situación, ubicala en el mapa y mantené actualizado su estado.</p></div><span className="rounded-full bg-[#DCECE5] px-4 py-2 text-sm font-semibold text-[#116D63]">{reports.length} en esta página</span></div>

        <section className="mt-9" aria-label="Filtros de reclamos"><form className="flex flex-wrap items-end gap-3"><div><label htmlFor="status" className="form-label">Estado</label><select id="status" name="status" defaultValue={status || ""} className="field-control min-w-48"><option value="">Todos los estados</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><Button type="submit" className="h-[3.3rem] rounded-lg px-5">Aplicar filtro</Button>{status && <Link href="/admin" className="civic-link mb-3 text-sm">Limpiar filtro</Link>}</form></section>

        {points.length > 0 && <section className="mt-9" aria-label="Mapa de reclamos"><div className="mb-4 flex items-baseline justify-between gap-3"><h2 className="section-title">En el mapa</h2><span className="text-sm text-[#5B746F]">{points.length} con ubicación en esta página</span></div><ReportMap points={points} /></section>}

        <section className="surface mt-9 overflow-hidden" aria-label="Lista de reclamos">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#CBDCD4] px-6 py-5 sm:px-8"><h2 className="text-xl font-bold tracking-[-.035em]">Bandeja de reclamos</h2><p className="text-sm text-[#5B746F]">Más recientes primero</p></div>
          {reports.length === 0 ? <div className="px-6 py-14 sm:px-8"><h3 className="text-xl font-bold">No hay reclamos para mostrar.</h3><p className="mt-2 text-[#5B746F]">Probá otro estado para ver el resto de los reportes.</p><Link href="/admin" className="civic-link mt-5 inline-block">Ver todos los estados</Link></div>
          : reports.map(report => <article key={report.id} className="grid gap-5 border-b border-[#CBDCD4] px-6 py-7 last:border-b-0 sm:px-8 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-8">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><StatusPill status={report.status} /><span className="text-sm text-[#5B746F]">{report.source === "TELEGRAM" ? "Telegram" : "Formulario web"}</span></div><h3 className="mt-4 text-xl font-bold tracking-[-.03em]">{categoryLabels[report.category]}</h3><p className="mt-1 font-medium text-[#42615B]">{report.address}</p><p className="mt-4 line-clamp-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-[#4E6A63]">{report.description}</p><Link href={`/reclamo/${report.publicId}`} className="civic-link mt-4 inline-flex text-sm">Ver reclamo completo</Link></div>
              <div className="flex flex-col justify-between gap-5 border-t border-[#CBDCD4] pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0"><time className="text-sm text-[#5B746F]" dateTime={report.createdAt.toISOString()}>{report.createdAt.toLocaleDateString("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" })}</time><ReportStatusControl id={report.publicId} status={report.status} /></div>
            </article>)}
        </section>
        <nav aria-label="Páginas de reclamos" className="mt-7 flex items-center justify-between gap-4 text-sm"><div>{page > 1 && <Link href={pageUrl(page - 1)} className="civic-link">Página anterior</Link>}</div><span className="text-[#5B746F]">Página {page}</span><div>{rows.length > 50 && <Link href={pageUrl(page + 1)} className="civic-link">Página siguiente</Link>}</div></nav>
      </main>
    </div>
  );
}
