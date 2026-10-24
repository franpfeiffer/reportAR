import { statusLabels, type ReportStatus } from "@/lib/reports/validation";
export function StatusPill({ status }: {status: ReportStatus}) {
  const style = status === "RECIBIDO" ? "status-recibido" : status === "EN_REVISION" ? "status-en-revision" : "status-resuelto";
  return <span className={`status-pill ${style}`}>{statusLabels[status]}</span>;
}
