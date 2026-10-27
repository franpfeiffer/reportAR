import Link from "next/link";
import { connection } from "next/server";
import { ReportMap } from "@/components/report-map";
import { ReportLocationFilters } from "@/components/report-location-filters";
import { SiteHeader } from "@/components/site-header";
import { StatusPill } from "@/components/status-pill";
import { categoryLabels, statusLabels, type ReportStatus } from "@/lib/reports/validation";
import { groupNearbyReports } from "@/lib/reports/grouping";
import { getReportIndex } from "@/lib/reports/explorer";

export const instant = false;

export default async function PublicReportsPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; province?: string; city?: string }> }) {
  await connection();
  const query = await searchParams;
  const requestedPage = Math.max(1, Math.min(10000, Number.parseInt(query.page || "1", 10) || 1));
  const status = query.status && Object.hasOwn(statusLabels, query.status) ? query.status as ReportStatus : undefined;
  const province = typeof query.province === "string" && query.province.length <= 100 ? query.province.trim() : "";
  const city = typeof query.city === "string" && query.city.length <= 100 ? query.city.trim() : "";
  const index = await getReportIndex();
  const addressMatches = (address: string) => {
    const normalized = address.toLocaleLowerCase("es-AR");
    if (city && province) return normalized.endsWith(`${city.toLocaleLowerCase("es-AR")}, ${province.toLocaleLowerCase("es-AR")}`);
    if (province) return normalized.endsWith(province.toLocaleLowerCase("es-AR"));
    return true;
  };
  const rows = index.reports.filter(report => (!status || report.status === status) && addressMatches(report.address));
  const groups = groupNearbyReports(rows);
  const pages = Math.max(1, Math.ceil(groups.length / 50));
  const page = Math.min(requestedPage, pages);
  const reportGroups = groups.slice((page - 1) * 50, page * 50);
  const points = reportGroups.flatMap(group => group.latitude !== null && group.longitude !== null
    ? [{ latitude: group.latitude, longitude: group.longitude, count: group.count, label: group.count > 1 ? `${group.count} reportes a menos de 50 m` : `${categoryLabels[group.items[0].category]}: ${group.items[0].address}` }]
    : []);
  const queryUrl = (values: { page?: number; status?: string }) => {
    const params = new URLSearchParams();
    if (values.page) params.set("page", String(values.page));
    if (values.status) params.set("status", values.status);
    if (province) params.set("province", province);
    if (city) params.set("city", city);
    const search = params.toString();
    return `/reclamos${search ? `?${search}` : ""}`;
  };
  const pageUrl = (n: number) => queryUrl({ page: n, status });

  return (
    <div className="min-h-screen bg-[#F1F5F2]">
      <SiteHeader />
      <main className="site-shell py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="eyebrow">Información abierta</p><h1 className="page-title mt-3">Reclamos de la comunidad.</h1><p className="body-lead mt-4 max-w-2xl">Consultá los problemas reportados y seguí cómo avanza cada uno. No necesitás una cuenta.</p></div>
          <Link href="/reportar" className="civic-button civic-button-primary">Hacer un reporte</Link>
        </div>

        <ReportLocationFilters province={province} city={city} status={status ?? ""} />

        <section className="mt-8 flex flex-wrap items-center gap-2" aria-label="Filtrar reclamos por estado">
          <Link href={queryUrl({})} aria-current={!status ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${!status ? "border-[#116D63] bg-[#116D63] text-white" : "border-[#CBDCD4] bg-white text-[#42615B]"}`}>Todos</Link>
          {Object.entries(statusLabels).map(([value, label]) => <Link key={value} href={queryUrl({ status: value })} aria-current={status === value ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${status === value ? "border-[#116D63] bg-[#116D63] text-white" : "border-[#CBDCD4] bg-white text-[#42615B]"}`}>{label}</Link>)}
        </section>

        {points.length > 0 && <section className="mt-8" aria-label="Mapa de reclamos"><div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="section-title">En el mapa</h2><span className="text-sm text-[#5B746F]">{points.length} zonas · cada número cuenta reportes cercanos</span></div><ReportMap points={points} /></section>}

        <section className="surface mt-8 overflow-hidden" aria-label="Reclamos públicos">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#CBDCD4] px-6 py-5 sm:px-8"><h2 className="text-xl font-bold tracking-[-.035em]">Reportes recientes</h2><p className="text-sm text-[#5B746F]">Más recientes primero</p></div>
          {reportGroups.length === 0 ? <div className="px-6 py-14 sm:px-8"><h3 className="text-xl font-bold">Todavía no hay reclamos para mostrar.</h3><p className="mt-2 text-[#5B746F]">Cuando alguien reporte un problema, va a aparecer acá.</p></div>
          : reportGroups.map(group => <div key={group.id} className="border-b border-[#CBDCD4] last:border-b-0">
              {group.count > 1 && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#CBDCD4] bg-[#EAF2ED] px-6 py-3 sm:px-8"><strong className="text-sm">{group.count} reportes {group.match === "distance" ? "a menos de 50 m" : "en la misma dirección"}</strong><span className="text-xs text-[#5B746F]">Cada reclamo mantiene su seguimiento individual</span></div>}
              {group.items.map(report => <article key={report.id} className="px-6 py-6 sm:px-8">
                <div className="flex flex-wrap items-center gap-3"><StatusPill status={report.status} /><span className="text-sm text-[#5B746F]">{new Date(report.createdAt).toLocaleDateString("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" })}</span></div>
                <h3 className="mt-3 text-lg font-bold tracking-[-.03em]">{categoryLabels[report.category]}</h3>
                <p className="mt-1 font-medium text-[#42615B]">{report.address}</p>
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#4E6A63]">{report.description}</p>
                <Link href={`/reclamo/${report.id}`} className="civic-link mt-3 inline-flex text-sm">Ver seguimiento y detalles →</Link>
              </article>)}
            </div>)}
        </section>
        <nav aria-label="Páginas de reclamos" className="mt-6 flex items-center justify-between gap-4 text-sm"><div>{page > 1 && <Link href={pageUrl(page - 1)} className="civic-link">← Anteriores</Link>}</div><span className="text-[#5B746F]">Página {page} de {pages}</span><div>{page < pages && <Link href={pageUrl(page + 1)} className="civic-link">Siguientes →</Link>}</div></nav>
      </main>
    </div>
  );
}
