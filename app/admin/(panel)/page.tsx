import Link from "next/link";
import { ReportMap } from "@/components/report-map";
import { ReportBadges, StatusPill, formatDate } from "@/components/status-pill";
import { categoryLabels } from "@/lib/labels";
import { adminFilters, getAdminDashboard, pageNumber, photoUrl, type AdminReport } from "@/lib/api";
import { ReportFilters } from "./report-filters";

export const instant = false;

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const page = pageNumber(query);
  const filters = adminFilters(query);
  const { metrics, categoryTotals, hotMunicipalities, reports, hasNextPage } = await getAdminDashboard(new URLSearchParams([...filters, ["page", String(page)]]));
  const now = new Date();
  const points = reports.flatMap(r => r.latitude !== null && r.longitude !== null
    ? [{ latitude: r.latitude, longitude: r.longitude, label: `${categoryLabels[r.category]}: ${r.address}` }]
    : []);
  const filterString = filters.toString();
  const pageUrl = (n: number) => `/admin?page=${n}${filterString ? `&${filterString}` : ""}`;
  const exportUrl = `/admin/export${filterString ? `?${filterString}` : ""}`;
  // The detail page reuses the list query to find the report and to link back to the same view.
  const listQuery = new URLSearchParams([...filters, ...(page > 1 ? [["page", String(page)]] : [])]).toString();
  const detailUrl = (id: string) => `/admin/reports/${encodeURIComponent(id)}${listQuery ? `?${listQuery}` : ""}`;
  const count = (n: number) => n.toLocaleString("es-AR");

  const stats: { label: string; value: string; alert?: boolean }[] = [
    { label: "Reportes totales", value: count(metrics.total) },
    { label: "Pendientes", value: count(metrics.pending) },
    { label: "Urgentes abiertos", value: count(metrics.urgent), alert: metrics.urgent > 0 },
    { label: "Fuera de plazo", value: count(metrics.overdue), alert: metrics.overdue > 0 },
    { label: "Promedio hasta resolver", value: metrics.averageResolutionDays ? `${metrics.averageResolutionDays.toLocaleString("es-AR", { maximumFractionDigits: 1 })} días` : "—" },
  ];

  return (
    <main className="admin-shell py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-[-.02em]">Reclamos</h1>
          <p className="text-sm text-muted">Más recientes primero</p>
        </div>
        <a href={exportUrl} className="inline-flex h-9 items-center rounded-md border border-line bg-paper px-3 text-sm font-semibold hover:bg-mist">Exportar CSV</a>
      </div>

      <section aria-label="Indicadores municipales" className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5">
        {stats.map(stat => (
          <div key={stat.label} className="bg-paper px-4 py-3 last:col-span-2 md:last:col-span-1">
            <p className="text-xs font-medium text-muted">{stat.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-[-.02em] ${stat.alert ? "text-danger" : ""}`}>{stat.value}</p>
          </div>
        ))}
      </section>

      <div className="mt-4"><ReportFilters key={filterString} values={Object.fromEntries(filters)} /></div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-label="Lista de reclamos" className="surface overflow-hidden">
          {reports.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="font-semibold">No hay reclamos para mostrar.</p>
              <p className="mt-1 text-sm text-muted">Probá con otros filtros.</p>
              {filterString && <Link href="/admin" className="civic-link mt-3 inline-block text-sm">Ver todos los reclamos</Link>}
            </div>
          ) : <>
            <div aria-hidden="true" className="hidden border-b border-line bg-paper-soft px-4 py-2 text-xs font-semibold text-muted md:grid md:grid-cols-[7.5rem_minmax(0,1fr)_11rem_6.5rem] md:gap-4 lg:grid-cols-[7.5rem_minmax(0,1fr)_11rem_10rem_6.5rem]">
              <span>Estado</span><span>Reclamo</span><span>Urgencia</span><span className="hidden lg:block">Área y plazo</span><span className="text-right">Fecha</span>
            </div>
            <ul>{reports.map(report => <ReportRow key={report.publicId} report={report} href={detailUrl(report.publicId)} now={now} />)}</ul>
          </>}
          <nav aria-label="Páginas de reclamos" className="flex items-center justify-between gap-4 border-t border-line px-4 py-2.5 text-sm">
            <div className="min-w-24">{page > 1 && <Link href={pageUrl(page - 1)} className="civic-link">← Anterior</Link>}</div>
            <span className="text-muted">Página {page} · {reports.length} reclamos</span>
            <div className="min-w-24 text-right">{hasNextPage && <Link href={pageUrl(page + 1)} className="civic-link">Siguiente →</Link>}</div>
          </nav>
        </section>

        <aside className="grid gap-4 md:grid-cols-2 xl:sticky xl:top-4 xl:grid-cols-1">
          {points.length > 0 && (
            <section aria-label="Mapa de reclamos" className="surface p-3 md:col-span-2 xl:col-span-1">
              <div className="mb-2 flex items-baseline justify-between gap-2 px-1"><h2 className="surface-title">Mapa</h2><span className="text-xs text-muted">{points.length} con ubicación en esta página</span></div>
              <ReportMap points={points} className="!h-64" />
            </section>
          )}
          <TopList title="Categorías más reportadas" items={categoryTotals.map(item => ({ name: categoryLabels[item.category], total: item.total }))} empty="Todavía no hay reportes." />
          <TopList title="Municipios con más reportes" items={hotMunicipalities} empty="Todavía no hay ubicaciones identificadas." />
        </aside>
      </div>
    </main>
  );
}

function ReportRow({ report, href, now }: { report: AdminReport; href: string; now: Date }) {
  const overdue = report.dueAt !== null && report.status !== "RESUELTO" && new Date(report.dueAt) < now;
  return (
    <li className="border-b border-line last:border-b-0">
      <Link href={href} className="grid gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-paper-soft md:grid-cols-[7.5rem_minmax(0,1fr)_11rem_6.5rem] md:items-center lg:grid-cols-[7.5rem_minmax(0,1fr)_11rem_10rem_6.5rem]">
        <div><StatusPill status={report.status} /></div>
        <div className="flex min-w-0 items-center gap-3">
          {report.hasPhoto && !report.hidden
            // eslint-disable-next-line @next/next/no-img-element -- photos come from the API host, not next/image domains
            ? <img src={photoUrl(report.publicId)} alt="" loading="lazy" className="size-10 shrink-0 rounded-md border border-line object-cover" />
            : <span aria-hidden="true" className="size-10 shrink-0 rounded-md border border-dashed border-line" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{categoryLabels[report.category]}</p>
            <p className="truncate text-sm text-muted">{report.address}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1"><ReportBadges report={report} /></div>
        <div className="hidden min-w-0 text-xs lg:block">
          <p className="truncate">{report.assignedArea ?? <span className="text-muted">Sin asignar</span>}</p>
          {report.dueAt && <p className={overdue ? "font-semibold text-danger" : "text-muted"}>{overdue ? "Venció" : "Vence"} {formatDate(report.dueAt)}</p>}
        </div>
        <time dateTime={report.createdAt} className="text-xs text-muted tabular-nums md:text-right">{formatDate(report.createdAt)}</time>
      </Link>
    </li>
  );
}

function TopList({ title, items, empty }: { title: string; items: { name: string; total: number }[]; empty: string }) {
  const max = Math.max(1, ...items.map(item => item.total));
  return (
    <section className="surface p-4">
      <h2 className="surface-title">{title}</h2>
      {items.length ? (
        <ol className="mt-3 grid gap-2">
          {items.map((item, i) => (
            <li key={`${item.name}-${i}`} className="text-sm">
              <div className="flex justify-between gap-3"><span className="truncate">{item.name}</span><strong className="tabular-nums">{item.total.toLocaleString("es-AR")}</strong></div>
              <div className="mt-1 h-1 rounded-full bg-mist"><div className="h-1 rounded-full bg-teal" style={{ width: `${(item.total / max) * 100}%` }} /></div>
            </li>
          ))}
        </ol>
      ) : <p className="mt-3 text-sm text-muted">{empty}</p>}
    </section>
  );
}
