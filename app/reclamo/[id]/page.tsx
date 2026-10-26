import Link from "next/link";
import Image from "next/image";
import { ReportMap } from "@/components/report-map";
import { SiteHeader } from "@/components/site-header";
import { StatusPill } from "@/components/status-pill";
import { categoryLabels, isUuid } from "@/lib/reports/validation";
import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

type Props = { params: Promise<{ id: string }> };
export const instant = false;
const steps = ["RECIBIDO", "EN_REVISION", "RESUELTO"] as const;
const stepLabels = ["Recibido", "En revisión", "Resuelto"] as const;

export default async function ComplaintPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await connection();
  const [report] = await db.select().from(citizenReports).where(eq(citizenReports.publicId, id)).limit(1);
  if (!report) notFound();
  const currentStep = steps.indexOf(report.status);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="site-shell py-9 sm:py-14">
        <Link href="/" className="civic-link inline-flex items-center gap-2 text-sm"><span aria-hidden="true">←</span> Volver al inicio</Link>
        <div className="mt-9 flex flex-wrap items-end justify-between gap-6"><div><h1 className="page-title">Así va tu reclamo.</h1><p className="body-lead mt-4">Podés volver a esta página con tu código cuando quieras.</p></div><StatusPill status={report.status} /></div>
        <section className="surface mt-9 overflow-hidden" aria-labelledby="progress-title">
          <div className="bg-[#14433F] px-6 py-7 text-white sm:px-9"><h2 id="progress-title" className="text-xl font-bold tracking-[-.04em]">Estado del reporte</h2><p className="mt-3 text-xs text-[#C5E0D4]">Código de seguimiento</p><code className="mt-1 block break-all font-mono text-xs text-white sm:text-sm">{report.publicId}</code></div>
          <ol className="grid gap-0 px-6 py-7 sm:grid-cols-3 sm:px-9" aria-label="Etapas del reclamo">{stepLabels.map((label, index) => <li key={label} className={`border-t-4 py-3 pr-5 ${index <= currentStep ? "border-[#116D63]" : "border-[#CBDCD4]"}`} aria-current={index === currentStep ? "step" : undefined}><span className="font-mono text-xs text-[#5B746F]">{String(index + 1).padStart(2, "0")}</span><p className={`mt-1 text-sm font-bold ${index <= currentStep ? "text-[#173735]" : "text-[#71857E]"}`}>{label}</p></li>)}</ol>
        </section>

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
