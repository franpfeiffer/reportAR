"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AdminReport } from "@/lib/api";
import { deleteReport, updateReport } from "../../actions";

export function ReportModeration({ report }: { report: AdminReport }) {
  const id = report.publicId;
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
  const state = report.hidden
    ? report.hiddenReason === "AUTO_FLAGS" ? "Oculto automáticamente por denuncias." : "Oculto por el municipio."
    : "Visible en el seguimiento público.";
  const flags = report.flagCount ? ` ${report.flagCount === 1 ? "1 denuncia" : `${report.flagCount} denuncias`}.` : "";

  return (
    <section aria-label="Moderación" className="surface grid gap-3 p-4">
      <div>
        <h2 className="surface-title">Moderación</h2>
        <p className="mt-1 text-sm text-muted">{state}{flags}</p>
      </div>
      {confirming ? (
        <div className="rounded-md bg-danger-soft p-3 text-sm text-danger">
          <p className="font-semibold">¿Eliminar definitivamente? Se borran el reporte, su historial y la foto.</p>
          <div className="mt-2 flex gap-2">
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => void run(() => deleteReport(id))}>{busy ? "Eliminando…" : "Sí, eliminar"}</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirming(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => updateReport(id, { hidden: !report.hidden }))}>
            {busy ? "Guardando…" : report.hidden ? "Mostrar" : "Ocultar"}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(true)} className="text-danger hover:bg-danger-soft hover:text-danger">Eliminar</Button>
        </div>
      )}
      {report.hidden && <p className="form-help !mt-0">Mostrar el reclamo también borra sus denuncias.</p>}
      {message && <p role="status" className="text-sm text-danger">{message}</p>}
    </section>
  );
}
