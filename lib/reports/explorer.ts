import { cacheLife } from "next/cache";
import { desc, sql } from "drizzle-orm";
import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import catalog from "@/lib/geography/catalog.json";
import { resolveTerritory } from "@/lib/geography/resolve";
import { categoryLabels, statusLabels, urgencyLabels, type Category, type ReportStatus, type Urgency } from "./validation";
import type { ExplorerData, ExplorerReport, TerritoryCount } from "./explorer-types";

export async function getReportIndex(): Promise<{ reports: ExplorerReport[]; updatedAt: string }> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  // Explicit public projection: no user identifiers, storage keys, or upload tokens.
  const rows = await db.select({
    id: citizenReports.publicId, category: citizenReports.category, status: citizenReports.status, urgency: citizenReports.urgency,
    address: citizenReports.address, description: sql<string>`left(${citizenReports.description}, 220)`,
    latitude: citizenReports.latitude, longitude: citizenReports.longitude, createdAt: citizenReports.createdAt,
    hasPhoto: sql<boolean>`(${citizenReports.photoUrl} is not null or ${citizenReports.photoStorageKey} is not null)`,
    contentType: citizenReports.photoContentType,
  }).from(citizenReports).orderBy(desc(citizenReports.createdAt), desc(citizenReports.id));
  return {
    updatedAt: new Date().toISOString(),
    reports: rows.map(({ contentType, createdAt, ...row }) => ({
      ...row, createdAt: createdAt.toISOString(),
      displayablePhoto: row.hasPhoto && /^image\/(jpeg|png|gif|webp|avif|bmp)$/i.test(contentType || ""),
      ...resolveTerritory(row),
    })),
  };
}

export function summarizeReports(index: { reports: ExplorerReport[]; updatedAt: string }, filters: {
  province?: string; municipality?: string; category?: Category; status?: ReportStatus; urgency?: Urgency; page: number;
}): ExplorerData {
  const matching = index.reports.filter(r => (!filters.category || r.category === filters.category) && (!filters.status || r.status === filters.status) && (!filters.urgency || r.urgency === filters.urgency));
  const provinceCounts = new Map<string, { count: number; resolved: number }>();
  const municipalityCounts = new Map<string, { count: number; resolved: number }>();
  for (const r of matching) {
    for (const [id, counts] of [[r.provinceId, provinceCounts], [r.municipalityId, municipalityCounts]] as const) {
      if (!id) continue;
      const current = counts.get(id) || { count: 0, resolved: 0 };
      current.count++; current.resolved += Number(r.status === "RESUELTO"); counts.set(id, current);
    }
  }
  const inScope = index.reports.filter(r => (!filters.province || r.provinceId === filters.province) && (!filters.municipality || r.municipalityId === filters.municipality));
  const scoped = inScope.filter(r => (!filters.category || r.category === filters.category) && (!filters.status || r.status === filters.status) && (!filters.urgency || r.urgency === filters.urgency));
  // Facet counts omit their own filter, so switching category/state remains useful.
  const categories = Object.fromEntries(Object.keys(categoryLabels).map(k => [k, 0])) as Record<Category, number>;
  const statuses = Object.fromEntries(Object.keys(statusLabels).map(k => [k, 0])) as Record<ReportStatus, number>;
  const urgencies = Object.fromEntries(Object.keys(urgencyLabels).map(k => [k, 0])) as Record<Urgency, number>;
  for (const r of inScope) {
    if ((!filters.status || r.status === filters.status) && (!filters.urgency || r.urgency === filters.urgency)) categories[r.category]++;
    if ((!filters.category || r.category === filters.category) && (!filters.urgency || r.urgency === filters.urgency)) statuses[r.status]++;
    if ((!filters.category || r.category === filters.category) && (!filters.status || r.status === filters.status) && r.urgency) urgencies[r.urgency]++;
  }
  const located = scoped.filter(r => r.latitude !== null && r.longitude !== null);
  const pages = Math.max(1, Math.ceil(scoped.length / 9));
  const page = Math.min(filters.page, pages);
  const sort = (a: TerritoryCount, b: TerritoryCount) => b.count - a.count || a.name.localeCompare(b.name, "es");
  return {
    total: scoped.length, located: located.length,
    unassigned: scoped.filter(r => !r.provinceId).length,
    withoutMunicipality: scoped.filter(r => !r.municipalityId).length,
    categories, statuses, urgencies,
    provinces: catalog.provinces.map(p => ({ ...p, ...(provinceCounts.get(p.id) || { count: 0, resolved: 0 }) })).sort(sort),
    municipalities: catalog.municipalities.filter(m => m.provinceId === filters.province).map(m => ({ ...m, ...(municipalityCounts.get(m.id) || { count: 0, resolved: 0 }) })).sort(sort),
    reports: scoped.slice((page - 1) * 9, page * 9), markers: located.slice(0, 400), markerLimit: 400,
    page, pages, updatedAt: index.updatedAt,
  };
}
