import Link from "next/link";
import type { ExplorerReport } from "@/lib/reports/explorer-types";
import type { ReportGroup } from "@/lib/reports/grouping";
import { categoryLabels } from "@/lib/reports/validation";
import { StatusPill } from "@/components/status-pill";
import { CategoryIcon, MapIcon, categoryColors, shortCategory } from "./icons";
import { ReportPhoto } from "./report-photo";

export function ReportGroupCard({ group }: { group: ReportGroup<ExplorerReport> }) {
  const report = group.items[0];
  const multiple = group.count > 1;

  return <article className="explorer-report-card">
    <Link href={`/reclamo/${report.id}`} className="explorer-report-link">
      <div className="explorer-report-image"><ReportPhoto report={report}/><div className="explorer-photo-status"><StatusPill status={report.status}/></div></div>
      <div className="explorer-report-body">
        {multiple && <span className="report-group-badge">{group.count} reportes {group.match === "distance" ? "a menos de 50 m" : "en la misma dirección"}</span>}
        <div className="explorer-report-category" style={{ color: categoryColors[report.category] }}><CategoryIcon category={report.category} size={17}/>{shortCategory[report.category]}</div>
        <h4>{report.address}</h4><p>{report.description}</p>
        <div className="explorer-report-bottom"><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" })}</time><span>Ver reporte <MapIcon kind="arrow" size={17}/></span></div>
      </div>
    </Link>
    {multiple && <div className="report-group-members"><p>También se reportó cerca</p><ul>{group.items.slice(1).map(item => <li key={item.id}><Link href={`/reclamo/${item.id}`}><span>{categoryLabels[item.category]} · {item.address}</span><span><StatusPill status={item.status}/><MapIcon kind="arrow" size={15}/></span></Link></li>)}</ul></div>}
  </article>;
}
