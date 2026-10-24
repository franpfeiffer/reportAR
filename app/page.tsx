import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RouteArt } from "@/components/route-art";
import { TrackingLookup } from "@/components/tracking-lookup";
import { telegramBotUrl } from "@/lib/telegram";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F1F5F2]">
      <SiteHeader />
      <main>
        <section className="site-shell grid gap-10 py-12 lg:grid-cols-[1fr_1.02fr] lg:items-center lg:gap-14 lg:py-20">
          <div className="py-3">
            <h1 className="display-title max-w-[10ch]">Lo que pasa en tu calle merece una respuesta.</h1>
            <p className="body-lead mt-8 max-w-[34rem]">Un bache, una luminaria apagada, basura acumulada: contá qué pasa y seguí el reclamo desde el primer día.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href={telegramBotUrl} target="_blank" rel="noreferrer" className="civic-button civic-button-coral">Reportar por Telegram <span aria-hidden="true">↗</span></a>
              <Link href="/reportar" className="civic-button civic-button-outline">Usar el formulario web</Link>
            </div>
            <p className="mt-5 text-sm text-[#5B746F]">No necesitás una cuenta para reportar.</p>
          </div>
          <RouteArt />
        </section>

        <section className="border-y border-[#CBDCD4] bg-white" aria-labelledby="how-it-works">
          <div className="site-shell grid gap-8 py-12 md:grid-cols-[.8fr_1.2fr] md:gap-16 md:py-16">
            <div><h2 id="how-it-works" className="section-title max-w-[13ch]">De tu barrio a quien puede resolverlo.</h2><p className="mt-4 max-w-sm leading-7 text-[#5B746F]">Cada reporte guarda una ubicación y un código para volver a consultarlo.</p></div>
            <ol className="grid gap-0 sm:grid-cols-3">
              <li className="border-t border-[#CBDCD4] py-4 sm:border-l sm:border-t-0 sm:py-1 sm:pl-6"><span className="font-mono text-sm text-[#116D63]">01</span><h3 className="mt-3 text-lg font-bold">Contá qué pasa</h3><p className="mt-2 text-sm leading-6 text-[#5B746F]">Elegí el problema y describilo con tus palabras.</p></li>
              <li className="border-t border-[#CBDCD4] py-4 sm:border-l sm:border-t-0 sm:py-1 sm:pl-6"><span className="font-mono text-sm text-[#116D63]">02</span><h3 className="mt-3 text-lg font-bold">Marcá el lugar</h3><p className="mt-2 text-sm leading-6 text-[#5B746F]">Escribí la dirección o señalá un punto en el mapa.</p></li>
              <li className="border-t border-[#CBDCD4] py-4 sm:border-l sm:border-t-0 sm:py-1 sm:pl-6"><span className="font-mono text-sm text-[#116D63]">03</span><h3 className="mt-3 text-lg font-bold">Seguí el estado</h3><p className="mt-2 text-sm leading-6 text-[#5B746F]">Guardá el código y volvé cuando quieras.</p></li>
            </ol>
          </div>
        </section>

        <section className="site-shell py-14 md:py-20" aria-labelledby="tracking-heading">
          <div className="grid gap-8 rounded-[1.4rem] bg-[#DCECE5] p-6 sm:p-10 md:grid-cols-[.8fr_1.2fr] md:items-center md:gap-12">
            <div><h2 id="tracking-heading" className="section-title">¿Ya hiciste un reporte?</h2><p className="mt-3 leading-7 text-[#4C6A62]">Ingresá el código que recibiste para ver cómo sigue.</p></div>
            <TrackingLookup />
          </div>
        </section>
      </main>
      <footer className="site-footer bg-white"><div className="site-shell flex flex-wrap items-center justify-between gap-3 py-7 text-sm"><span>ReportAR · Reclamos ciudadanos</span><Link href="/admin/login" className="civic-link">Acceso municipal</Link></div></footer>
    </div>
  );
}
