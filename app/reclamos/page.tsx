import Link from "next/link";
import { connection } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { ReportMap } from "@/components/report-map";
import { SiteHeader } from "@/components/site-header";
import { StatusPill } from "@/components/status-pill";
import { categoryLabels, statusLabels, type ReportStatus } from "@/lib/reports/validation";

export const instant = false;

export default async function PublicReportsPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  await connection();
  const query = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(query.page || "1", 10) || 1));
  const status = query.status && Object.hasOwn(statusLabels, query.status) ? query.status as ReportStatus : undefined;
  const rows = await db.select({
    id: citizenReports.id,
    publicId: citizenReports.publicId,
    category: citizenReports.category,
    address: citizenReports.address,
    description: citizenReports.description,
    latitude: citizenReports.latitude,
    longitude: citizenReports.longitude,
    status: citizenReports.status,
    createdAt: citizenReports.createdAt,
  }).from(citizenReports)
    .where(status ? eq(citizenReports.status, status) : undefined)
    .orderBy(desc(citizenReports.createdAt), desc(citizenReports.id))
    .limit(51).offset((page - 1) * 50);
  const reports = rows.slice(0, 50);
  const points = reports.flatMap(report => report.latitude !== null && report.longitude !== null
    ? [{ latitude: report.latitude, longitude: report.longitude, label: `${categoryLabels[report.category]}: ${report.address}` }]
    : []);
  const pageUrl = (n: number) => `/reclamos?page=${n}${status ? `&status=${status}` : ""}`;

  return (
    <div className="min-h-screen bg-[#F1F5F2]">
      <SiteHeader />
      <main className="site-shell py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="eyebrow">Información abierta</p><h1 className="page-title mt-3">Reclamos de la comunidad.</h1><p className="body-lead mt-4 max-w-2xl">Consultá los problemas reportados y seguí cómo avanza cada uno. No necesitás una cuenta.</p></div>
          <Link href="/reportar" className="civic-button civic-button-primary">Hacer un reporte</Link>
        </div>

        <section className="mt-8 flex flex-wrap items-center gap-2" aria-label="Filtrar reclamos por estado">
          <Link href="/reclamos" aria-current={!status ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${!status ? "border-[#116D63] bg-[#116D63] text-white" : "border-[#CBDCD4] bg-white text-[#42615B]"}`}>Todos</Link>
          {Object.entries(statusLabels).map(([value, label]) => <Link key={value} href={`/reclamos?status=${value}`} aria-current={status === value ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${status === value ? "border-[#116D63] bg-[#116D63] text-white" : "border-[#CBDCD4] bg-white text-[#42615B]"}`}>{label}</Link>)}
        </section>

        {points.length > 0 && <section className="mt-8" aria-label="Mapa de reclamos"><div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="section-title">En el mapa</h2><span className="text-sm text-[#5B746F]">{points.length} ubicaciones en esta página</span></div><ReportMap points={points} /></section>}

        <section className="surface mt-8 overflow-hidden" aria-label="Reclamos públicos">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#CBDCD4] px-6 py-5 sm:px-8"><h2 className="text-xl font-bold tracking-[-.035em]">Reportes recientes</h2><p className="text-sm text-[#5B746F]">Más recientes primero</p></div>
          {reports.length === 0 ? <div className="px-6 py-14 sm:px-8"><h3 className="text-xl font-bold">Todavía no hay reclamos para mostrar.</h3><p className="mt-2 text-[#5B746F]">Cuando alguien reporte un problema, va a aparecer acá.</p></div>
          : reports.map(report => <article key={report.id} className="border-b border-[#CBDCD4] px-6 py-6 last:border-b-0 sm:px-8">
              <div className="flex flex-wrap items-center gap-3"><StatusPill status={report.status} /><span className="text-sm text-[#5B746F]">{report.createdAt.toLocaleDateString("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" })}</span></div>
              <h3 className="mt-3 text-lg font-bold tracking-[-.03em]">{categoryLabels[report.category]}</h3>
              <p className="mt-1 font-medium text-[#42615B]">{report.address}</p>
              <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#4E6A63]">{report.description}</p>
              <Link href={`/reclamo/${report.publicId}`} className="civic-link mt-3 inline-flex text-sm">Ver seguimiento y detalles →</Link>
            </article>)}
        </section>
        <nav aria-label="Páginas de reclamos" className="mt-6 flex items-center justify-between gap-4 text-sm"><div>{page > 1 && <Link href={pageUrl(page - 1)} className="civic-link">← Anteriores</Link>}</div><span className="text-[#5B746F]">Página {page}</span><div>{rows.length > 50 && <Link href={pageUrl(page + 1)} className="civic-link">Siguientes →</Link>}</div></nav>
      </main>
    </div>
  );
}
