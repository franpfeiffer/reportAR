"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { statusLabels, type ReportStatus } from "@/lib/reports/validation";

export function ReportStatusControl({id, status}: {id: string; status: ReportStatus}) {
  const [value,setValue] = useState<ReportStatus>(status);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const router = useRouter();
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/reports/${id}`, {method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({status: value})});
      const data = await response.json();
      if (!response.ok) {setMessage(data.error || "No pudimos guardar el cambio."); return;}
      setMessage("Estado actualizado."); router.refresh();
    } catch {setMessage("Revisá tu conexión e intentá nuevamente.");} finally {setBusy(false);}
  }
  return <div><div className="flex flex-wrap gap-2"><select aria-label="Estado del reclamo" className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" value={value} disabled={busy} onChange={event => setValue(event.target.value as ReportStatus)}>{Object.entries(statusLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select><Button disabled={busy || value === status} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar"}</Button></div>{message && <p role="status" className="mt-2 text-sm text-zinc-600">{message}</p>}</div>;
}
