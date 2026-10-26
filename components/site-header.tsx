import Link from "next/link";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-shell flex min-h-20 flex-wrap items-center justify-between gap-4 py-3">
        <Brand />
        <nav aria-label="Navegación principal" className="flex items-center gap-2 sm:gap-6">
          <Link href="/reclamos" className="hidden text-sm font-semibold text-[#173735] hover:underline hover:underline-offset-4 sm:inline-flex">Ver reclamos</Link>
          <Link href="/reportar" className="hidden text-sm font-semibold text-[#173735] hover:underline hover:underline-offset-4 sm:inline-flex">Hacer un reporte</Link>
          <ThemeToggle />
          <Link href="/admin/login" className="civic-button civic-button-outline !min-h-10 !px-3 !text-sm sm:!px-4"><span className="hidden sm:inline">Acceso municipal</span><span className="sm:hidden">Ingresar</span></Link>
        </nav>
      </div>
    </header>
  );
}
