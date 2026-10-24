import { OAuthLoginButtons } from "./oauth-login-buttons";

export const instant = false;

type Props = { searchParams: Promise<{ error?: string }> };

export default async function AdminLogin({ searchParams }: Props) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-[0_24px_80px_-45px_rgba(24,24,27,0.35)] sm:p-10">
        <a href="/" className="text-lg font-bold tracking-tight text-zinc-950">ReportAR</a>
        <p className="mt-10 text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">Acceso municipal</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">Panel de gestión</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">Ingresá para acceder al panel de gestión.</p>
        {error === "not-admin" && <p role="alert" className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Tu cuenta no tiene acceso municipal. Contactá al administrador de ReportAR.</p>}
        <OAuthLoginButtons />
      </section>
    </main>
  );
}
