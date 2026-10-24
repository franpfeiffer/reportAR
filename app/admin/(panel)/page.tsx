import { LogoutButton } from "./logout-button";

export default function AdminDashboard() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-6">
        <a href="/" className="text-xl font-bold tracking-tight text-zinc-950">ReportAR</a>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">Gestión municipal</span>
          <LogoutButton />
        </div>
      </header>
      <section className="py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">Panel municipal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">Bienvenido al panel de gestión</h1>
        <p className="mt-4 text-zinc-600">Sesión validada con Neon Auth y perfil municipal autorizado.</p>
      </section>
    </main>
  );
}
