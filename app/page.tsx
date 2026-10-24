import Link from "next/link";
import { telegramBotUrl } from "@/lib/telegram";
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-zinc-950">ReportAR</Link>
        <a href="/admin/login" className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">Acceso municipal</a>
      </header>
      <section className="grid flex-1 gap-10 py-16 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Tu ciudad, más cerca</p>
          <h1 className="mt-4 max-w-xl text-5xl font-semibold leading-[1.08] tracking-tight text-zinc-950 sm:text-6xl">Hagamos que cada reclamo encuentre respuesta.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-zinc-600">Reportá problemas de tu barrio y seguí su evolución desde un solo lugar.</p>
          <a href={telegramBotUrl} target="_blank" rel="noreferrer" className="mt-9 inline-flex rounded-xl bg-indigo-700 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-800">Reportar por Telegram ↗</a>
          <a href="/reportar" className="mt-4 block text-sm font-semibold text-indigo-700">O completar el formulario web →</a>
        </div>
        <div className="rounded-3xl bg-[#eef0ff] p-8 sm:p-12">
          <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">ReportAR</p>
            <p className="mt-4 text-2xl font-semibold text-zinc-950">Tu comunidad merece respuestas.</p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">Compartí una situación y ayudá al municipio a priorizar lo que pasa cerca tuyo.</p>
          </div>
        </div>
      </section>
      <footer className="border-t border-zinc-200 py-5 text-xs text-zinc-500">ReportAR · Participación ciudadana</footer>
    </main>
  );
}
