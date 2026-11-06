"use server";

import { refresh } from "next/cache";
import { adminFetch } from "@/lib/api";
import type { ReportStatus, Urgency } from "@/lib/labels";

export type ReportChange =
  | { status: ReportStatus }
  | { urgency: Urgency }
  | { assignedArea: string | null }
  | { dueAt: string | null }
  | { publicMessage: string };

// Admin authorization and validation happen in the Go API with the caller's own token.
export async function updateReport(id: string, change: ReportChange): Promise<{ error?: string }> {
  try {
    const response = await adminFetch(`/api/admin/reports/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null;
      return { error: data?.error || "No pudimos guardar el cambio." };
    }
  } catch {
    return { error: "No pudimos conectar con el servidor. Intentá nuevamente." };
  }
  refresh();
  return {};
}
