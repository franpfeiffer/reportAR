"use client";
import Image from "next/image";
import { useState } from "react";
import type { ExplorerReport } from "@/lib/reports/explorer-types";
import { CategoryIcon, categoryColors } from "./icons";

export function ReportPhoto({ report }: { report: ExplorerReport }) {
  const [failed, setFailed] = useState(false);
  if (report.displayablePhoto && !failed) return <Image src={`/api/reports/${report.id}/photo`} alt={`Foto del incidente en ${report.address}`} fill unoptimized sizes="(max-width: 700px) 100vw, 400px" onError={() => setFailed(true)} className="explorer-photo" />;
  return <div className="explorer-photo-placeholder" style={{ color: categoryColors[report.category] }}><CategoryIcon category={report.category} size={40}/><span>{report.hasPhoto ? "Ver archivo adjunto en el reporte" : "Reporte sin foto"}</span></div>;
}
