import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { OAuthLoginButtons } from "./oauth-login-buttons";

export const instant = false;
type Props = { searchParams: Promise<{ error?: string }> };

export default async function AdminLogin({ searchParams }: Props) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[.9fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-[#14433F] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Brand inverse />
        <div className="relative z-10 max-w-lg pb-10"><p className="text-5xl font-semibold leading-[1.08] tracking-[-.06em] xl:text-6xl">Una ciudad se cuida escuchando lo que pasa en cada calle.</p><p className="mt-6 max-w-sm text-lg leading-8 text-[#C9E2D8]">Cada reclamo tiene un lugar, un estado y una respuesta pendiente.</p></div>
        <div aria-hidden="true" className="absolute -bottom-32 -right-24 h-[32rem] w-[32rem] rotate-12 border-[42px] border-[#2B625B] opacity-70" />
        <div aria-hidden="true" className="absolute right-12 top-32 h-20 w-20 rounded-full border-[16px] border-[#E86F50]" />
        <p className="relative z-10 text-sm text-[#C9E2D8]">Panel de gestión municipal</p>
      </aside>
      <section className="flex min-h-screen flex-col px-5 py-7 sm:px-10 lg:px-16 lg:py-12">
        <div className="flex items-center justify-between gap-3"><span className="lg:hidden"><Brand /></span><div className="ml-auto flex items-center gap-4"><ThemeToggle /><Link href="/" className="civic-link text-sm">Volver al inicio</Link></div></div>
        <div className="mx-auto my-auto w-full max-w-[420px] py-16">
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-[#DCECE5] text-[#116D63]" aria-hidden="true"><svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8"><rect x="4" y="9" width="16" height="12" rx="2"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/></svg></div>
          <h1 className="page-title !text-[clamp(2.5rem,4vw,3.7rem)]">Acceso municipal</h1>
          <p className="mt-4 text-lg leading-8 text-[#5B746F]">Ingresá para acceder al panel de gestión.</p>
          {error === "not-admin" && <p role="alert" className="mt-6 rounded-lg bg-[#FFEAE4] p-4 text-sm leading-6 text-[#9D382B]">Tu cuenta no tiene acceso municipal. Contactá al administrador de ReportAR.</p>}
          <OAuthLoginButtons />
          <p className="mt-8 border-t border-[#CBDCD4] pt-5 text-sm leading-6 text-[#5B746F]">El acceso está reservado a cuentas municipales autorizadas.</p>
        </div>
      </section>
    </main>
  );
}
