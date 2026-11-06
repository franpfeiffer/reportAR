"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { statusLabels, type ReportStatus } from "@/lib/labels";
import { updateReport } from "./actions";

export function ReportStatusControl({ id, status }: { id: string; status: ReportStatus }) {
  const [value, setValue] = useState<ReportStatus>(status);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true); setMessage("");
    try {
      const { error } = await updateReport(id, { status: value });
      setMessage(error || "Estado actualizado.");
    } catch { setMessage("Revisá tu conexión e intentá nuevamente."); }
    finally { setBusy(false); }
  }
  return <div><label htmlFor={`status-${id}`} className="form-label">Cambiar estado</label><select id={`status-${id}`} className="field-control !min-h-10 !py-2" value={value} disabled={busy} onChange={event => setValue(event.target.value as ReportStatus)}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><Button disabled={busy || value === status} onClick={() => void save()} className="mt-2 h-10 w-full rounded-lg">{busy ? "Guardando…" : "Guardar estado"}</Button>{message && <p role="status" className="mt-2 text-sm text-[#5B746F]">{message}</p>}</div>;
}
