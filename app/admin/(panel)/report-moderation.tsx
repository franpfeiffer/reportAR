"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteReport, updateReport } from "./actions";

export function ReportModeration({ id, hidden }: { id: string; hidden: boolean }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  async function run(action: () => Promise<{ error?: string }>) {
    setBusy(true); setMessage("");
    try {
      const { error } = await action();
      if (error) setMessage(error);
    } catch { setMessage("Revisá tu conexión e intentá nuevamente."); }
    finally { setBusy(false); setConfirming(false); }
  }
  return <div className="grid gap-2 border-t border-[#CBDCD4] pt-5"><p className="form-label">Moderación</p><Button variant="outline" disabled={busy} onClick={() => void run(() => updateReport(id, { hidden: !hidden }))} className="h-10 w-full rounded-lg">{busy && !confirming ? "Guardando…" : hidden ? "Mostrar" : "Ocultar"}</Button>{confirming ? <div className="rounded-lg border border-[#F0C3B8] bg-[#FFEAE4] p-3 text-sm text-[#9D382B]"><p className="font-semibold">¿Eliminar definitivamente? Se borran el reporte, su historial y la foto.</p><div className="mt-2 flex gap-2"><Button variant="destructive" disabled={busy} onClick={() => void run(() => deleteReport(id))} className="h-10 flex-1 rounded-lg">{busy ? "Eliminando…" : "Confirmar"}</Button><Button variant="outline" disabled={busy} onClick={() => setConfirming(false)} className="h-10 flex-1 rounded-lg">Cancelar</Button></div></div> : <Button variant="outline" disabled={busy} onClick={() => setConfirming(true)} className="h-10 w-full rounded-lg text-[#9D382B]">Eliminar</Button>}{message && <p role="status" className="text-sm text-[#5B746F]">{message}</p>}</div>;
}
