"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { categoryLabels, type Category } from "@/lib/reports/validation";
import type { ClassificationStatus } from "@reportar/db/schema";

export function ReportCategoryReview({
  id,
  category,
  suggestedCategory,
  classificationStatus,
}: {
  id: string;
  category: Category;
  suggestedCategory: Category | null;
  classificationStatus: ClassificationStatus | null;
}) {
  const needsReview = classificationStatus === "NEEDS_REVIEW" || classificationStatus === "UNAVAILABLE";
  const [value, setValue] = useState<Category>(suggestedCategory ?? category);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  if (!needsReview) return null;

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: value }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "No pudimos guardar la categoría.");
        return;
      }
      setMessage("Categoría revisada.");
      router.refresh();
    } catch {
      setMessage("Revisá tu conexión e intentá nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="rounded-lg border border-[#CBDCD4] bg-white p-3"><label htmlFor={`category-${id}`} className="form-label">Confirmar categoría</label><select id={`category-${id}`} className="field-control !min-h-10 !py-2" value={value} disabled={busy} onChange={event => setValue(event.target.value as Category)}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><Button disabled={busy} onClick={() => void save()} className="mt-2 h-10 w-full rounded-lg">{busy ? "Guardando…" : "Guardar categoría"}</Button>{message && <p role="status" className="mt-2 text-sm text-[#5B746F]">{message}</p>}</div>;
}
