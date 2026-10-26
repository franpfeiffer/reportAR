import type { ReportUrgency } from "@reportar/db/schema";

export function suggestedDueAt(urgency: ReportUrgency | null, from = new Date()) {
  const days = urgency === "URGENTE" ? 3 : 14;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
