"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReportMap, type MapPoint } from "@/components/report-map";

type CreatedReport = { publicId: string };

export function ReportForm() {
  const [location, setLocation] = useState<MapPoint | null>(null);
  const points = useMemo(() => location ? [location] : [], [location]);
  const [locationError, setLocationError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdReport, setCreatedReport] = useState<CreatedReport | null>(null);
  const [copied, setCopied] = useState(false);

  function locate() {
    setLocationError("");
    if (!navigator.geolocation) { setLocationError("Tu navegador no permite obtener la ubicación."); return; }
    navigator.geolocation.getCurrentPosition(
      position => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => setLocationError("No pudimos obtener tu ubicación. Podés marcarla en el mapa."),
      { timeout: 10000 },
    );
  }

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
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
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
    return (
      <div role="status" className="py-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DCECE5] text-3xl text-[#116D63]" aria-hidden="true">✓</div>
        <h2 className="section-title mt-7">Reporte recibido.</h2>
        <p className="mt-3 max-w-lg leading-7 text-[#5B746F]">Guardá este código. Te sirve para consultar el estado del reclamo desde cualquier dispositivo.</p>
        <div className="mt-7 rounded-xl border border-[#CBDCD4] bg-[#F1F5F2] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <code className="block break-all font-mono text-sm text-[#173735]">{createdReport.publicId}</code>
          <button type="button" className="civic-link mt-3 shrink-0 text-sm sm:mt-0" onClick={async () => { try { await navigator.clipboard.writeText(createdReport.publicId); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copiado" : "Copiar código"}</button>
        </div>
        <Link href={`/reclamo/${createdReport.publicId}`} className="civic-button civic-button-primary mt-7">Ver seguimiento</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submitReport} className="grid gap-9">
      <section>
        <h2 className="text-xl font-bold tracking-[-.035em]">¿Qué pasa?</h2>
        <div className="mt-5"><label htmlFor="category" className="form-label">Tipo de problema</label><select id="category" name="category" className="field-control" defaultValue="" required><option value="" disabled>Elegí una categoría</option><option value="BACHE">Bache o vereda rota</option><option value="ALUMBRADO">Alumbrado público</option><option value="BASURA">Basura o limpieza</option><option value="ARBOLADO">Árboles y espacios verdes</option><option value="OTRO">Otro problema</option></select></div>
        <div className="mt-5"><label htmlFor="description" className="form-label">Describí la situación</label><Textarea id="description" name="description" placeholder="Por ejemplo: la luminaria de la esquina no funciona desde el martes" minLength={15} maxLength={2000} rows={5} required className="field-control min-h-36 resize-y" /><p className="form-help">Un detalle concreto ayuda a ubicar y entender el problema.</p></div>
      </section>

      <section className="border-t border-[#CBDCD4] pt-8">
        <h2 className="text-xl font-bold tracking-[-.035em]">¿Dónde ocurre?</h2>
        <div className="mt-5"><label htmlFor="address" className="form-label">Dirección o referencia</label><Input id="address" name="address" type="text" autoComplete="street-address" placeholder="Calle, altura y barrio" minLength={5} maxLength={200} required className="field-control" /></div>
        <div className="mt-6"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><p className="form-label !mb-0">Marcá el punto en el mapa</p><span className="text-xs text-[#5B746F]">Opcional</span></div><ReportMap points={points} onSelect={setLocation} /><div className="mt-3 flex flex-wrap items-center gap-3"><Button type="button" variant="secondary" onClick={locate} className="h-10 rounded-lg px-4">Usar mi ubicación</Button>{location && <button type="button" className="civic-link text-sm" onClick={() => setLocation(null)}>Quitar punto</button>}</div><p className="form-help">{location ? `Punto elegido: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : "Tocá el mapa para señalar el lugar exacto."}</p>{locationError && <p role="alert" className="mt-2 text-sm text-[#A43E30]">{locationError}</p>}</div>
      </section>

      <div className="border-t border-[#CBDCD4] pt-7">
        {error && <p role="alert" className="mb-5 rounded-lg bg-[#FFEAE4] px-4 py-3 text-sm text-[#9D382B]">{error}</p>}
        <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-lg px-6 font-bold sm:w-auto">{isSubmitting ? "Enviando reporte…" : "Enviar reporte"}</Button>
        <p className="form-help mt-3">El reporte es público. No hace falta una cuenta.</p>
      </div>
    </form>
  );
}
