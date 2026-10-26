import catalog from "@/lib/geography/catalog.json";
import { getReportIndex, summarizeReports } from "@/lib/reports/explorer";
import { categoryLabels, statusLabels, type Category, type ReportStatus } from "@/lib/reports/validation";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const province = query.get("province") || undefined;
  const municipality = query.get("municipality") || undefined;
  const category = query.get("category") || undefined;
  const status = query.get("status") || undefined;
  const pageValue = query.get("page") || "1";
  if ((province && !catalog.provinces.some(p => p.id === province)) ||
      (municipality && !catalog.municipalities.some(m => m.id === municipality && m.provinceId === province)) ||
      (category && !Object.hasOwn(categoryLabels, category)) || (status && !Object.hasOwn(statusLabels, status)) ||
      !/^\d{1,6}$/.test(pageValue) || Number(pageValue) < 1) {
    return Response.json({ error: "Los filtros del mapa no son válidos." }, { status: 400 });
  }
  try {
    const index = await getReportIndex();
    return Response.json(summarizeReports(index, { province, municipality, category: category as Category | undefined, status: status as ReportStatus | undefined, page: Number(pageValue) }), {
      headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" },
    });
  } catch {
    return Response.json({ error: "No pudimos cargar los incidentes. Volvé a intentar." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
