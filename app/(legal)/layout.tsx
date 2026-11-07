import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="site-header">
        <div className="site-shell flex min-h-20 items-center justify-between gap-4 py-3">
          <Brand />
          <ThemeToggle />
        </div>
      </header>
      <main className="site-shell max-w-3xl py-12 sm:py-16 [&_h2]:section-title [&_h2]:mt-12 [&_h2]:mb-4 [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2 [&_li]:leading-relaxed [&_a]:text-[var(--teal)] [&_a]:underline">
        {children}
      </main>
      <footer className="site-footer">
        <div className="site-shell flex flex-wrap gap-6 py-6 text-sm">
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/soporte">Soporte</Link>
        </div>
      </footer>
    </div>
  );
}
