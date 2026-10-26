"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const AREAS = ["Servicios públicos", "Higiene urbana", "Alumbrado", "Arbolado y espacios verdes", "Obras y mantenimiento", "Defensa civil"];

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ReportOperations({ id, assignedArea, dueAt }: { id: string; assignedArea: string | null; dueAt: string | null }) {
  const knownArea = assignedArea && AREAS.includes(assignedArea) ? assignedArea : assignedArea ? "Otro" : "";
  const [area, setArea] = useState(knownArea);
  const [customArea, setCustomArea] = useState(knownArea === "Otro" ? assignedArea || "" : "");
  const [deadline, setDeadline] = useState(localDateTime(dueAt));
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function save(field: "assignedArea" | "dueAt" | "publicMessage", value: string | null) {
    setBusy(field); setMessage("");
    try {
      const result = await fetch(`/api/admin/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
      const data = await result.json() as { error?: string };
      if (!result.ok) { setMessage(data.error || "No pudimos guardar el cambio."); return; }
      if (field === "publicMessage") setResponse("");
      setMessage(field === "publicMessage" ? "Respuesta publicada." : "Cambio guardado.");
      router.refresh();
    } catch { setMessage("Revisá tu conexión e intentá nuevamente."); }
    finally { setBusy(""); }
  }

  return <div className="grid gap-5 border-t border-[#CBDCD4] pt-5">
    <div><label htmlFor={`area-${id}`} className="form-label">Área responsable</label><select id={`area-${id}`} value={area} onChange={event => setArea(event.target.value)} className="field-control !min-h-10 !py-2"><option value="">Sin asignar</option>{AREAS.map(value => <option key={value} value={value}>{value}</option>)}<option value="Otro">Otra área</option></select>{area === "Otro" && <input aria-label="Nombre del área responsable" maxLength={100} value={customArea} onChange={event => setCustomArea(event.target.value)} placeholder="Nombre del área" className="field-control mt-2 !min-h-10 !py-2" />}<Button disabled={busy !== "" || (area === "Otro" && !customArea.trim())} onClick={() => void save("assignedArea", area === "Otro" ? customArea.trim() : area || null)} className="mt-2 h-10 w-full rounded-lg">{busy === "assignedArea" ? "Guardando…" : "Guardar área"}</Button></div>
    <div><label htmlFor={`due-${id}`} className="form-label">Plazo sugerido</label><input id={`due-${id}`} type="datetime-local" value={deadline} onChange={event => setDeadline(event.target.value)} className="field-control !min-h-10 !py-2" /><p className="form-help !mt-1">Es una fecha interna de seguimiento, no un compromiso público.</p><Button disabled={busy !== ""} onClick={() => void save("dueAt", deadline ? new Date(deadline).toISOString() : null)} className="mt-2 h-10 w-full rounded-lg">{busy === "dueAt" ? "Guardando…" : "Guardar plazo"}</Button></div>
    <div><label htmlFor={`response-${id}`} className="form-label">Respuesta pública</label><textarea id={`response-${id}`} value={response} maxLength={600} onChange={event => setResponse(event.target.value)} placeholder="Escribí una novedad para quien hizo el reporte" rows={3} className="field-control min-h-20 resize-y" /><p className="form-help !mt-1">La respuesta se verá en el seguimiento público. Hasta 600 caracteres.</p><Button disabled={busy !== "" || !response.trim()} onClick={() => void save("publicMessage", response)} className="mt-2 h-10 w-full rounded-lg">{busy === "publicMessage" ? "Publicando…" : "Publicar respuesta"}</Button></div>
    {message && <p role="status" className="text-sm text-[#5B746F]">{message}</p>}
  </div>;
}
