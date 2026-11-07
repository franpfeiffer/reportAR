"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { needsUrgencyReview } from "@/components/status-pill";
import { statusLabels, urgencyLabels, type ReportStatus, type Urgency } from "@/lib/labels";
import type { AdminReport } from "@/lib/api";
import { updateReport, type ReportChange } from "../../actions";

const AREAS = ["Servicios públicos", "Higiene urbana", "Alumbrado", "Arbolado y espacios verdes", "Obras y mantenimiento", "Defensa civil"];

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ReportEditor({ report }: { report: AdminReport }) {
  const id = report.publicId;
  const review = needsUrgencyReview(report);
  // While the urgency is unreviewed nothing counts as chosen, so saving other fields never confirms it by accident.
  const savedUrgency = review ? "" : report.urgency ?? "";
  const knownArea = report.assignedArea && AREAS.includes(report.assignedArea) ? report.assignedArea : report.assignedArea ? "Otro" : "";
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [urgency, setUrgency] = useState<Urgency | "">(savedUrgency);
  const [area, setArea] = useState(knownArea);
  const [customArea, setCustomArea] = useState(knownArea === "Otro" ? report.assignedArea ?? "" : "");
  const [deadline, setDeadline] = useState(localDateTime(report.dueAt));
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const areaValue = area === "Otro" ? customArea.trim() : area || null;
  const changes: ReportChange[] = [];
  if (status !== report.status) changes.push({ status });
  if (urgency && urgency !== savedUrgency) changes.push({ urgency });
  if (areaValue !== report.assignedArea && !(area === "Otro" && !areaValue)) changes.push({ assignedArea: areaValue });
  if (deadline !== localDateTime(report.dueAt)) changes.push({ dueAt: deadline ? new Date(deadline).toISOString() : null });
  if (reply.trim()) changes.push({ publicMessage: reply.trim() });

  // The API takes one field per PATCH, so changed fields are saved one after another and we stop at the first error.
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      for (const [index, change] of changes.entries()) {
        const { error } = await updateReport(id, change);
        if (error) {
          setMessage({ text: index ? `${error} Se guardaron ${index} de ${changes.length} cambios.` : error, error: true });
          return;
        }
        if ("publicMessage" in change) setReply("");
      }
      setMessage({ text: "Cambios guardados." });
    } catch {
      setMessage({ text: "Revisá tu conexión e intentá nuevamente.", error: true });
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={event => void save(event)} className="surface grid gap-4 p-4" aria-label="Gestión del reclamo">
      <h2 className="surface-title">Gestión</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="edit-status" className="form-label">Estado</label>
          <select id="edit-status" value={status} onChange={event => setStatus(event.target.value as ReportStatus)} className="field-control">
            {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="edit-urgency" className="form-label">Urgencia</label>
          <select id="edit-urgency" value={urgency} onChange={event => setUrgency(event.target.value as Urgency | "")} className="field-control">
            <option value="" disabled>{review ? "Sin revisar" : "Sin definir"}</option>
            {Object.entries(urgencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      </div>
      {review && <p className="-mt-2 rounded-md bg-warning-soft px-2.5 py-1.5 text-xs text-warning">
        {report.suggestedUrgency
          ? `JEV sugiere ${urgencyLabels[report.suggestedUrgency].toLowerCase()} (${Math.round((report.urgentProbability ?? 0) * 100)} % de probabilidad de urgencia). Elegí una opción para confirmarla.`
          : report.urgencyClassificationStatus === "UNAVAILABLE" ? "El clasificador no estuvo disponible. Elegí la urgencia manualmente." : "Todavía no tiene evaluación de urgencia. Elegí una opción."}
      </p>}
      <div>
        <label htmlFor="edit-area" className="form-label">Área responsable</label>
        <select id="edit-area" value={area} onChange={event => setArea(event.target.value)} className="field-control">
          <option value="">Sin asignar</option>
          {AREAS.map(value => <option key={value} value={value}>{value}</option>)}
          <option value="Otro">Otra área</option>
        </select>
        {area === "Otro" && <input aria-label="Nombre del área responsable" maxLength={100} value={customArea} onChange={event => setCustomArea(event.target.value)} placeholder="Nombre del área" className="field-control mt-2" />}
      </div>
      <div>
        <label htmlFor="edit-due" className="form-label">Plazo sugerido</label>
        <input id="edit-due" type="datetime-local" value={deadline} onChange={event => setDeadline(event.target.value)} className="field-control" />
        <p className="form-help">Fecha interna de seguimiento, no es un compromiso público.</p>
      </div>
      <div>
        <label htmlFor="edit-reply" className="form-label">Respuesta pública</label>
        <textarea id="edit-reply" value={reply} maxLength={600} rows={3} onChange={event => setReply(event.target.value)} placeholder="Escribí una novedad para quien hizo el reporte" className="field-control resize-y" />
        <p className="form-help">Se publica en el seguimiento del reclamo. {reply.length}/600</p>
      </div>
      <div className="flex items-center gap-3 border-t border-line pt-3">
        <Button type="submit" disabled={busy || changes.length === 0} className="h-9 rounded-md px-4">{busy ? "Guardando…" : "Guardar cambios"}</Button>
        {message && <p role="status" className={`text-sm ${message.error ? "text-danger" : "text-muted"}`}>{message.text}</p>}
      </div>
    </form>
  );
}
