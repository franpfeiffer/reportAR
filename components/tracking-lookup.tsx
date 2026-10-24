"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { isUuid } from "@/lib/reports/validation";

export function TrackingLookup() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();
    if (!isUuid(value)) { setError("Revisá el código. Debe tener el formato que recibiste al enviar el reporte."); return; }
    setError("");
    router.push(`/reclamo/${value}`);
  }
  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1"><label htmlFor="tracking-code" className="sr-only">Código del reclamo</label><input id="tracking-code" value={code} onChange={e => {setCode(e.target.value); setError("");}} placeholder="Código de seguimiento" autoComplete="off" className="field-control font-mono text-sm" aria-describedby={error ? "tracking-error" : undefined} />{error && <p id="tracking-error" role="alert" className="mt-2 text-sm text-[#A43E30]">{error}</p>}</div>
      <button type="submit" className="civic-button civic-button-primary shrink-0">Consultar estado</button>
    </form>
  );
}
