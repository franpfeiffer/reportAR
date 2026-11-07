import { statusLabels, urgencyLabels, type ReportStatus } from "@/lib/labels";
import type { AdminReport } from "@/lib/api";

export function StatusPill({ status }: {status: ReportStatus}) {
  const style = status === "RECIBIDO" ? "status-recibido" : status === "EN_REVISION" ? "status-en-revision" : "status-resuelto";
  return <span className={`status-pill ${style}`}>{statusLabels[status]}</span>;
}

export function needsUrgencyReview(report: Pick<AdminReport, "urgencyClassificationStatus">) {
  return report.urgencyClassificationStatus === "NEEDS_REVIEW" || report.urgencyClassificationStatus === "UNAVAILABLE";
}

export function ReportBadges({ report }: { report: AdminReport }) {
  return <>
    {report.urgency && <span className={`badge ${report.urgency === "URGENTE" ? "badge-danger" : ""}`}>{urgencyLabels[report.urgency]}</span>}
    {needsUrgencyReview(report) && <span className="badge badge-warning" title="Confirmá la urgencia en el detalle del reclamo">Urgencia sin revisar</span>}
    {report.flagCount > 0 && <span className="badge badge-warning">{report.flagCount === 1 ? "1 denuncia" : `${report.flagCount} denuncias`}</span>}
    {report.hidden && <span className="badge badge-danger" title={report.hiddenReason === "AUTO_FLAGS" ? "Oculto automáticamente por denuncias" : "Oculto por el municipio"}>Oculto</span>}
  </>;
}

const timeZone = "America/Argentina/Buenos_Aires";
export const formatDate = (value: string) => new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone });
export const formatDateTime = (value: string) => new Date(value).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone });
