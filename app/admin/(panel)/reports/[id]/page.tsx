import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportMap } from "@/components/report-map";
import { ReportBadges, StatusPill, formatDate, formatDateTime } from "@/components/status-pill";
import { categoryLabels, statusLabels } from "@/lib/labels";
import { adminFilters, findAdminReport, getPublicEvents, pageNumber, photoUrl, type PublicReportEvent } from "@/lib/api";
import { ReportEditor } from "./report-editor";
import { ReportModeration } from "./report-moderation";

export const instant = false;

export default async function ReportDetail({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const page = pageNumber(query);
  const filters = adminFilters(query);
  const listQuery = new URLSearchParams([...filters, ...(page > 1 ? [["page", String(page)]] : [])]).toString();
  const [report, events] = await Promise.all([
    findAdminReport(id, new URLSearchParams([...filters, ["page", String(page)]])),
    getPublicEvents(id),
  ]);
  if (!report) notFound();
  const now = new Date();
  const overdue = report.dueAt !== null && report.status !== "RESUELTO" && new Date(report.dueAt) < now;
  const hasLocation = report.latitude !== null && report.longitude !== null;

  return (
    <main className="admin-shell py-6">
      <Link href={`/admin${listQuery ? `?${listQuery}` : ""}`} className="civic-link text-sm">← Volver a reclamos</Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5"><StatusPill status={report.status} /><ReportBadges report={report} /></div>
          <h1 className="mt-2 text-2xl font-bold tracking-[-.025em]">{categoryLabels[report.category]}</h1>
          <p className="text-muted">{report.address}</p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm">
          <dt className="text-muted">Recibido</dt><dd>{formatDateTime(report.createdAt)}</dd>
          <dt className="text-muted">Canal</dt><dd>{report.source === "TELEGRAM" ? "Telegram" : "Formulario web"}</dd>
          <dt className="text-muted">Área</dt><dd>{report.assignedArea ?? "Sin asignar"}</dd>
          {report.dueAt && <><dt className="text-muted">Plazo</dt><dd className={overdue ? "font-semibold text-danger" : ""}>{formatDate(report.dueAt)}{overdue && " · vencido"}</dd></>}
        </dl>
      </header>

      <div className="mt-5 grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_19rem] lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="grid min-w-0 gap-4">
          <section className="surface p-4">
            <h2 className="surface-title">Descripción</h2>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{report.description}</p>
            {report.declaredCategory && report.declaredCategory !== report.category && (
              <p className="form-help">Quien reportó eligió «{categoryLabels[report.declaredCategory]}».</p>
            )}
          </section>

          {(report.hasPhoto || hasLocation) && (
            <div className={`grid gap-4 ${report.hasPhoto && hasLocation ? "xl:grid-cols-2" : ""}`}>
              {report.hasPhoto && (
                <section className="surface p-3">
                  <div className="mb-2 flex items-baseline justify-between px-1"><h2 className="surface-title">Foto</h2>{!report.hidden && <a href={photoUrl(report.publicId)} target="_blank" rel="noreferrer" className="civic-link text-xs">Abrir original</a>}</div>
                  {report.hidden
                    ? <p className="px-1 pb-1 text-sm text-muted">La foto no se puede ver mientras el reclamo está oculto.</p>
                    : <a href={photoUrl(report.publicId)} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- photos come from the API host, not next/image domains */}
                        <img src={photoUrl(report.publicId)} alt={`Foto del reclamo: ${categoryLabels[report.category]}`} className="h-72 w-full rounded-md bg-mist object-contain" />
                      </a>}
                </section>
              )}
              {hasLocation && (
                <section className="surface p-3">
                  <h2 className="surface-title mb-2 px-1">Ubicación</h2>
                  <ReportMap points={[{ latitude: report.latitude!, longitude: report.longitude!, label: report.address }]} className="!h-72" />
                </section>
              )}
            </div>
          )}

          <section className="surface p-4">
            <h2 className="surface-title">Historial público</h2>
            {events === null
              ? <p className="mt-2 text-sm text-muted">{report.hidden ? "El historial no está disponible mientras el reclamo está oculto." : "No pudimos cargar el historial."}</p>
              : <Timeline events={events} />}
          </section>
        </div>

        <aside className="grid gap-4 md:sticky md:top-4">
          <ReportEditor report={report} />
          <ReportModeration report={report} />
        </aside>
      </div>
    </main>
  );
}

function Timeline({ events }: { events: PublicReportEvent[] }) {
  if (!events.length) return <p className="mt-2 text-sm text-muted">Sin novedades todavía.</p>;
  const title = (event: PublicReportEvent) =>
    event.type === "CREATED" ? "Reclamo recibido"
    : event.type === "MUNICIPAL_RESPONSE" ? "Respuesta del municipio"
    : `Estado: ${event.fromStatus ? `${statusLabels[event.fromStatus]} → ` : ""}${event.toStatus ? statusLabels[event.toStatus] : ""}`;
  return (
    <ol className="mt-3 grid gap-3 border-l border-line pl-4">
      {events.map((event, i) => (
        <li key={`${event.createdAt}-${i}`} className="relative">
          <span aria-hidden="true" className={`absolute -left-[1.3rem] top-1.5 size-2 rounded-full ${event.type === "MUNICIPAL_RESPONSE" ? "bg-teal" : "bg-line"}`} />
          <p className="text-sm font-semibold">{title(event)} <time dateTime={event.createdAt} className="ml-1 font-normal text-muted">{formatDateTime(event.createdAt)}</time></p>
          {event.publicMessage && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{event.publicMessage}</p>}
        </li>
      ))}
    </ol>
  );
}
