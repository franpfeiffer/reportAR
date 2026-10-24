"use client";

import { useState } from "react";
import { signInWithProvider, type OAuthProvider } from "@reportar/auth/client";

export function OAuthLoginButtons() {
  const [loading, setLoading] = useState<"google" | "vercel" | null>(null);
  const [error, setError] = useState("");
  const vercelEnabled = process.env.NEXT_PUBLIC_ENABLE_VERCEL_OAUTH === "true";

  async function start(provider: OAuthProvider) {
    setLoading(provider);
    setError("");
    try {
      const { error: resultError } = await signInWithProvider(provider, `${window.location.origin}/admin`);
      if (resultError) setError("No pudimos iniciar sesión. Intentá nuevamente.");
    } catch {
      setError("No pudimos iniciar sesión. Intentá nuevamente.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-8 grid gap-3">
      <button
        type="button"
        onClick={() => void start("google")}
        disabled={loading !== null}
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
      >
        <GoogleIcon />
        {loading === "google" ? "Conectando…" : "Continuar con Google"}
      </button>
      <button
        type="button"
        onClick={() => void start("vercel")}
        disabled={loading !== null || !vercelEnabled}
        title={vercelEnabled ? undefined : "Vercel OAuth se activará al configurar sus credenciales."}
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <VercelIcon />
        {loading === "vercel" ? "Conectando…" : "Continuar con Vercel"}
      </button>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
    </div>
  );
}

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.9 6-15Z"/><path fill="#FF3D00" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.3A20 20 0 0 0 24 44Z"/><path fill="#4CAF50" d="M12.8 27.7a12 12 0 0 1 0-7.4V15H5.9a20 20 0 0 0 0 18l6.9-5.3Z"/><path fill="#1976D2" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.9 15l6.9 5.3c1.6-4.7 6-8.2 11.2-8.2Z"/></svg>;
}

function VercelIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 2 23 21H1L12 2Z" /></svg>;
}
