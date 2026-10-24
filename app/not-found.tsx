import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return <div className="min-h-screen"><SiteHeader /><main className="site-shell flex min-h-[70vh] flex-col items-start justify-center py-16"><span className="font-mono text-sm text-[#116D63]">404</span><h1 className="page-title mt-4 max-w-xl">No encontramos ese reclamo.</h1><p className="body-lead mt-5 max-w-lg">Revisá el código de seguimiento. Si acabás de enviar el reporte, usá el enlace que recibiste al terminar.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/" className="civic-button civic-button-primary">Volver al inicio</Link><Link href="/reportar" className="civic-button civic-button-outline">Hacer un reporte</Link></div></main></div>;
}
