"use client";

import { useState, type FormEvent } from "react";

type CreatedReport = { publicId: string };

const inputClassName = "mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20";
const labelClassName = "block text-sm font-medium text-zinc-200";

export function ReportForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdReport, setCreatedReport] = useState<CreatedReport | null>(null);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formData.get("category"),
          address: formData.get("address"),
          description: formData.get("description"),
        }),
      });
      const result = await response.json() as CreatedReport & { error?: string };

      if (!response.ok || !result.publicId) {
        setError(result.error ?? "No pudimos enviar el reporte. Intentá nuevamente.");
        return;
      }
      setCreatedReport({ publicId: result.publicId });
    } catch {
      setError("No pudimos enviar el reporte. Revisá tu conexión e intentá nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdReport) {
    const trackingUrl = `/reclamo/${createdReport.publicId}`;
    return (
      <div role="status" className="rounded-2xl border border-emerald-900 bg-emerald-950/50 p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-900 text-xl text-emerald-300" aria-hidden="true">✓</div>
        <h2 className="mt-5 text-2xl font-semibold text-white">Reporte recibido</h2>
        <p className="mt-2 leading-7 text-emerald-100/80">Guardamos tu reclamo. Usá este código para consultar su estado más adelante:</p>
        <p className="mt-4 break-all rounded-xl border border-emerald-900 bg-black/20 px-4 py-3 font-mono text-sm text-emerald-200">{createdReport.publicId}</p>
        <a href={trackingUrl} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300">
          Ver seguimiento
        </a>
      </div>
    );
  }

  return (
    <form className="grid gap-6" onSubmit={submitReport}>
      <div>
        <label htmlFor="category" className={labelClassName}>¿Qué problema querés reportar?</label>
        <select id="category" name="category" className={inputClassName} defaultValue="" required>
          <option value="" disabled>Elegí una categoría</option>
          <option value="BACHE">Bache o vereda rota</option>
          <option value="ALUMBRADO">Alumbrado público</option>
          <option value="BASURA">Basura o limpieza</option>
          <option value="ARBOLADO">Árboles y espacios verdes</option>
          <option value="OTRO">Otro problema</option>
        </select>
      </div>

      <div>
        <label htmlFor="address" className={labelClassName}>¿Dónde ocurre?</label>
        <input
          id="address"
          name="address"
          type="text"
          autoComplete="street-address"
          placeholder="Calle, altura y barrio o una referencia"
          minLength={5}
          maxLength={200}
          required
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="description" className={labelClassName}>Contanos un poco más</label>
        <textarea
          id="description"
          name="description"
          placeholder="Describí el problema y cualquier detalle que ayude a ubicarlo."
          minLength={15}
          maxLength={2000}
          rows={5}
          required
          className={`${inputClassName} resize-y`}
        />
        <p className="mt-2 text-xs text-zinc-500">No incluyas información personal sensible.</p>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-200">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-12 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? "Enviando reporte…" : "Enviar reporte"}
      </button>
      <p className="text-center text-xs text-zinc-500">Los reportes ciudadanos son públicos y no requieren autenticación.</p>
    </form>
  );
}
