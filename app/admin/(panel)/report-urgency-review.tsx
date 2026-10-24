"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { urgencyLabels, type Urgency } from "@/lib/reports/validation";
import type { UrgencyClassificationStatus } from "@reportar/db/schema";

export function ReportUrgencyReview({
  id,
  urgency,
  suggestedUrgency,
  urgencyClassificationStatus,
}: {
  id: string;
  urgency: Urgency | null;
  suggestedUrgency: Urgency | null;
  urgencyClassificationStatus: UrgencyClassificationStatus | null;
}) {
  const needsReview = urgencyClassificationStatus === "NEEDS_REVIEW" || urgencyClassificationStatus === "UNAVAILABLE";
  const [value, setValue] = useState<Urgency | "">(suggestedUrgency ?? urgency ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  if (!needsReview) return null;

  async function save() {
    if (!value) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urgency: value }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "No pudimos guardar la urgencia.");
        return;
      }
      setMessage("Urgencia revisada.");
      router.refresh();
    } catch {
      setMessage("Revisá tu conexión e intentá nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="rounded-lg border border-[#CBDCD4] bg-white p-3"><label htmlFor={`urgency-${id}`} className="form-label">Confirmar urgencia</label><select id={`urgency-${id}`} className="field-control !min-h-10 !py-2" value={value} disabled={busy} onChange={event => setValue(event.target.value as Urgency | "")}><option value="" disabled>Elegí una opción</option>{Object.entries(urgencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><Button disabled={busy || !value} onClick={() => void save()} className="mt-2 h-10 w-full rounded-lg">{busy ? "Guardando…" : "Guardar urgencia"}</Button>{message && <p role="status" className="mt-2 text-sm text-[#5B746F]">{message}</p>}</div>;
}
