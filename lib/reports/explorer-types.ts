import type { Category, ReportStatus, Urgency } from "./validation";
import type { Territory } from "../geography/types";
export type ExplorerReport = {
  id: string; category: Category; status: ReportStatus; urgency: Urgency | null; address: string; description: string;
  latitude: number | null; longitude: number | null; createdAt: string;
  hasPhoto: boolean; displayablePhoto: boolean; provinceId: string | null; municipalityId: string | null;
};
export type TerritoryCount = Territory & { count: number; resolved: number };
export type ExplorerData = {
  total: number; located: number; unassigned: number; withoutMunicipality: number;
  categories: Record<Category, number>; statuses: Record<ReportStatus, number>; urgencies: Record<Urgency, number>;
  provinces: TerritoryCount[]; municipalities: TerritoryCount[];
  reports: ExplorerReport[]; markers: ExplorerReport[]; markerLimit: number;
  page: number; pages: number; updatedAt: string;
};
