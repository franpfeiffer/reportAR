import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { telegramBotUrl } from "@/lib/telegram";
import { ReportForm } from "./report-form";

export default function NewReportPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="site-shell py-9 sm:py-14">
        <Link href="/" className="civic-link inline-flex items-center gap-2 text-sm"><span aria-hidden="true">←</span> Volver al inicio</Link>
        <div className="mt-9 max-w-3xl">
          <h1 className="page-title">Hacé un reporte.</h1>
          <p className="body-lead mt-5 max-w-2xl">Contanos qué pasó y dónde. Al enviarlo vas a recibir un código para consultar el estado cuando quieras.</p>
        </div>
        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
          <div className="surface p-5 sm:p-8 lg:p-10"><ReportForm /></div>
          <aside className="border-t border-[#CBDCD4] pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-1">
            <h2 className="text-lg font-bold tracking-[-.03em]">También por Telegram</h2>
            <p className="mt-3 text-sm leading-6 text-[#5B746F]">Si te resulta más cómodo, abrí el bot y seguí las indicaciones desde el celular.</p>
            <a href={telegramBotUrl} target="_blank" rel="noreferrer" className="civic-link mt-4 inline-flex text-sm">Abrir el bot <span className="ml-1" aria-hidden="true">↗</span></a>
            <div className="mt-8 border-t border-[#CBDCD4] pt-6 text-sm leading-6 text-[#5B746F]">No necesitás iniciar sesión. Evitá incluir datos personales sensibles en la descripción.</div>
          </aside>
        </div>
      </main>
    </div>
  );
}
