import { SiteHeader } from "@/components/site-header";
export default function Loading() {
  return <div className="min-h-screen"><SiteHeader /><main className="site-shell py-14" role="status"><div className="h-5 w-32 animate-pulse rounded bg-[#DCECE5]" /><div className="mt-10 h-14 w-full max-w-lg animate-pulse rounded-xl bg-[#DCECE5]" /><p className="mt-6 text-[#5B746F]">Cargando el estado del reclamo…</p></main></div>;
}
