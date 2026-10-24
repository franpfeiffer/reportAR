import Link from "next/link";
import { LogoutButton } from "./logout-button";
import { ReportStatusControl } from "./report-status";
import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { requireMunicipalAdmin } from "@reportar/auth";
import { desc, eq } from "drizzle-orm";
import { categoryLabels, statusLabels, type ReportStatus } from "@/lib/reports/validation";
import { ReportMap } from "@/components/report-map";
import { Button } from "@/components/ui/button";

export const instant = false;
export default async function AdminDashboard({searchParams}: {searchParams: Promise<{page?: string; status?: string}>}) {
  await requireMunicipalAdmin();
  const query = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(query.page || "1",10) || 1));
  const status = query.status && Object.hasOwn(statusLabels,query.status) ? query.status as ReportStatus : undefined;
  const rows = await db.select().from(citizenReports).where(status ? eq(citizenReports.status,status) : undefined).orderBy(desc(citizenReports.createdAt),desc(citizenReports.id)).limit(51).offset((page-1)*50);
  const reports = rows.slice(0,50);
  const points = reports.flatMap(r => r.latitude !== null && r.longitude !== null ? [{latitude:r.latitude, longitude:r.longitude,label:`${categoryLabels[r.category]} · ${r.address}`}] : []);
  const pageUrl = (n: number) => `/admin?page=${n}${status ? `&status=${status}` : ""}`;
  return <main className="min-h-screen bg-[#f7f8fc] px-5 py-8 text-zinc-950 sm:px-10"><div className="mx-auto max-w-6xl">
    <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-6"><Link href="/" className="text-xl font-bold">ReportAR</Link><LogoutButton /></header>
    <section className="py-8"><p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">Gestión municipal</p><h1 className="mt-3 text-4xl font-semibold">Reclamos de la comunidad</h1><p className="mt-3 text-zinc-600">Revisá los reportes de Telegram y de la web, y actualizá su estado.</p></section>
    <form className="mb-6 flex flex-wrap items-center gap-3"><label htmlFor="status" className="text-sm font-medium">Filtrar por estado</label><select id="status" name="status" defaultValue={status || ""} className="rounded-md border border-zinc-300 bg-white p-2 text-sm"><option value="">Todos</option>{Object.entries(statusLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select><Button type="submit">Aplicar</Button></form>
    {points.length > 0 && <div className="mb-8"><ReportMap points={points} /><p className="mt-2 text-xs text-zinc-500">Ubicaciones de los reclamos de esta página.</p></div>}
    {!reports.length && <p className="rounded-2xl border border-zinc-200 bg-white p-8 text-zinc-600">Todavía no hay reclamos para este filtro.</p>}
    <div className="grid gap-4">{reports.map(report => <article key={report.id} className="rounded-2xl border border-zinc-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-wide text-indigo-700">{report.source === "TELEGRAM" ? "Telegram" : "Web"} · {statusLabels[report.status]}</p><h2 className="mt-2 text-xl font-semibold">{categoryLabels[report.category]}</h2><p className="mt-1 text-sm text-zinc-600">{report.address}</p></div><time className="text-xs text-zinc-500" dateTime={report.createdAt.toISOString()}>{report.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</time></div><p className="my-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{report.description}</p><div className="flex flex-wrap items-center justify-between gap-4"><ReportStatusControl id={report.publicId} status={report.status}/><a href={`/reclamo/${report.publicId}`} className="text-sm font-semibold text-indigo-700">Ver detalle y seguimiento →</a></div></article>)}</div>
    <nav aria-label="Páginas de reclamos" className="mt-6 flex items-center justify-between">{page > 1 ? <a href={pageUrl(page-1)} className="text-sm font-semibold text-indigo-700">← Anterior</a> : <span/>}<span className="text-sm text-zinc-500">Página {page}</span>{rows.length > 50 ? <a href={pageUrl(page+1)} className="text-sm font-semibold text-indigo-700">Siguiente →</a> : <span/>}</nav>
  </div></main>;
}
