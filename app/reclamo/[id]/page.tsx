import { db } from "@reportar/auth/db";
import { citizenReports } from "@reportar/auth/schema";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

type Props = { params: Promise<{ id: string }> };

export const instant = false;

const statusLabels = {
  RECIBIDO: "Recibido",
  EN_REVISION: "En revisión",
  RESUELTO: "Resuelto",
} as const;

const categoryLabels = {
  BACHE: "Bache o vereda rota",
  ALUMBRADO: "Alumbrado público",
  BASURA: "Basura o limpieza",
  ARBOLADO: "Árboles y espacios verdes",
  OTRO: "Otro problema",
} as const;

export default async function ComplaintPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();

  await connection();
  const [report] = await db.select().from(citizenReports)
    .where(eq(citizenReports.publicId, id)).limit(1);
  if (!report) notFound();

  return (
    <main className="min-h-screen bg-[#09090b] px-5 py-8 text-zinc-100 sm:px-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <a href="/" className="text-sm font-semibold text-indigo-400 transition hover:text-indigo-300">← Volver a ReportAR</a>
        <header className="mt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-400">Seguimiento ciudadano</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Estado de tu reclamo</h1>
          <p className="mt-4 text-zinc-400">Código <span className="font-mono text-zinc-300">{report.publicId}</span></p>
        </header>

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
            <div>
              <p className="text-sm text-zinc-500">Estado actual</p>
              <p className="mt-1 text-xl font-semibold text-white">{statusLabels[report.status]}</p>
            </div>
            <span className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-sm font-medium text-indigo-300">
              {categoryLabels[report.category]}
            </span>
          </div>
          <dl className="grid gap-6 pt-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-zinc-500">Ubicación</dt>
              <dd className="mt-1 text-zinc-200">{report.address}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Enviado</dt>
              <dd className="mt-1 text-zinc-200">
                {report.createdAt.toLocaleDateString("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" })}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-zinc-500">Descripción</dt>
              <dd className="mt-1 whitespace-pre-wrap leading-7 text-zinc-200">{report.description}</dd>
            </div>
          </dl>
        </section>
        <a href="/reportar" className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900">
          Hacer otro reporte
        </a>
      </div>
    </main>
  );
}
