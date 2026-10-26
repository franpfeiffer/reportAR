import Link from "next/link";
import Image from "next/image";
import { ReportMap } from "@/components/report-map";
import { ReportUpdates } from "@/components/report-updates";
import { SiteHeader } from "@/components/site-header";
import { categoryLabels, isUuid } from "@/lib/reports/validation";
import { db } from "@reportar/db";
import { citizenReports, reportEvents } from "@reportar/db/schema";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";

type Props = { params: Promise<{ id: string }> };
export const instant = false;

export default async function ComplaintPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await connection();
  const [report] = await db.select().from(citizenReports).where(eq(citizenReports.publicId, id)).limit(1);
  if (!report) notFound();
  const events = await db.select({ type: reportEvents.type, fromStatus: reportEvents.fromStatus, toStatus: reportEvents.toStatus, publicMessage: reportEvents.publicMessage, createdAt: reportEvents.createdAt })
    .from(reportEvents).where(and(eq(reportEvents.reportPublicId, id), inArray(reportEvents.type, ["CREATED", "STATUS_CHANGED", "MUNICIPAL_RESPONSE"]))).orderBy(asc(reportEvents.createdAt)).limit(100);
  const initialEvents = events.map(event => ({ ...event, createdAt: event.createdAt.toISOString() }));
  if (!initialEvents.some(event => event.type === "CREATED")) initialEvents.unshift({ type: "CREATED", fromStatus: null, toStatus: "RECIBIDO", publicMessage: null, createdAt: report.createdAt.toISOString() });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="site-shell py-9 sm:py-14">
        <Link href="/" className="civic-link inline-flex items-center gap-2 text-sm"><span aria-hidden="true">←</span> Volver al inicio</Link>
        <div className="mt-9 flex flex-wrap items-end justify-between gap-6"><div><h1 className="page-title">Así va tu reclamo.</h1><p className="body-lead mt-4">Podés volver a esta página con tu código cuando quieras.</p></div></div>
        <ReportUpdates id={report.publicId} initialStatus={report.status} initialEvents={initialEvents} />

        <section className="mt-8 grid gap-7 md:grid-cols-[minmax(0,1fr)_18rem]" aria-label="Detalles del reclamo">
          <div className="surface p-6 sm:p-9"><h2 className="section-title">Lo que reportaste</h2><dl className="mt-7 grid gap-6"><div><dt className="text-sm font-semibold text-[#5B746F]">Problema</dt><dd className="mt-1 text-lg font-semibold">{categoryLabels[report.category]}</dd></div><div className="border-t border-[#CBDCD4] pt-5"><dt className="text-sm font-semibold text-[#5B746F]">Descripción</dt><dd className="mt-2 whitespace-pre-wrap leading-7">{report.description}</dd></div></dl></div>
          <div className="surface p-6 sm:p-7"><h2 className="text-lg font-bold tracking-[-.03em]">Dónde y cuándo</h2><dl className="mt-6 grid gap-5"><div><dt className="text-sm text-[#5B746F]">Ubicación</dt><dd className="mt-1 font-semibold">{report.address}</dd></div><div className="border-t border-[#CBDCD4] pt-5"><dt className="text-sm text-[#5B746F]">Enviado</dt><dd className="mt-1 font-semibold"><time dateTime={report.createdAt.toISOString()}>{report.createdAt.toLocaleDateString("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" })}</time></dd></div></dl></div>
        </section>
        {report.latitude !== null && report.longitude !== null && <section className="mt-8"><h2 className="mb-4 text-lg font-bold">Lugar del reporte</h2><ReportMap points={[{ latitude: report.latitude, longitude: report.longitude, label: report.address }]} /></section>}
        {(report.photoUrl || report.photoStorageKey) && <section className="mt-8"><h2 className="mb-4 text-lg font-bold">Foto adjunta</h2>{report.photoContentType && /^(image\/(jpeg|png|gif|webp|avif|bmp))$/.test(report.photoContentType) && <Image src={`/api/reports/${report.publicId}/photo`} alt="Foto adjunta al reclamo ciudadano" width={800} height={600} quality={75} sizes="(max-width: 768px) 100vw, 800px" className="max-h-96 w-full rounded-xl border border-[#CBDCD4] bg-white object-contain" />}<a href={`/api/reports/${report.publicId}/photo?download=1`} className="civic-link mt-3 inline-block text-sm">Descargar {report.photoFilename || "foto original"} ↓</a></section>}
        <Link href="/reportar" className="civic-button civic-button-outline mt-9">Hacer otro reporte</Link>
      </main>
    </div>
  );
}
