import { ReportForm } from "./report-form";

export default function NewReportPage() {
  return (
    <main className="min-h-screen bg-[#09090b] px-5 py-8 text-zinc-100 sm:px-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <a href="/" className="text-sm font-semibold text-indigo-400 transition hover:text-indigo-300">
          ← Volver a ReportAR
        </a>
        <header className="mt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-400">Participación ciudadana</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Nuevo reporte</h1>
          <p className="mt-4 max-w-2xl leading-7 text-zinc-400">
            Contanos qué pasa y dónde. No necesitás iniciar sesión; al enviarlo vas a recibir un código para seguir el reclamo.
          </p>
        </header>
        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/20 sm:p-8">
          <ReportForm />
        </section>
      </div>
    </main>
  );
}
