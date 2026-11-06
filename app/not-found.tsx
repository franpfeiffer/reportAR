import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export default function NotFound() {
  return <div className="min-h-screen"><header className="site-header"><div className="site-shell flex min-h-20 items-center justify-between gap-4 py-3"><Brand /><ThemeToggle /></div></header><main className="site-shell flex min-h-[70vh] flex-col items-start justify-center py-16"><span className="font-mono text-sm text-[#116D63]">404</span><h1 className="page-title mt-4 max-w-xl">No encontramos esa página.</h1><p className="body-lead mt-5 max-w-lg">Revisá la dirección o volvé al panel municipal.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/admin" className="civic-button civic-button-primary">Ir al panel</Link></div></main></div>;
}
