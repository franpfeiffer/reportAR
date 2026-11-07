import { redirect } from "next/navigation";
import { auth } from "@reportar/auth";
import { categoryLabels, statusLabels, urgencyLabels, type Category, type ReportStatus, type Urgency, type UrgencyClassificationStatus } from "./labels";

export type AdminReport = {
  publicId: string;
  category: Category;
  declaredCategory: Category | null;
  status: ReportStatus;
  urgency: Urgency | null;
  suggestedUrgency: Urgency | null;
  urgentProbability: number | null;
  urgencyClassificationStatus: UrgencyClassificationStatus | null;
  urgencyClassificationModel: string | null;
  source: string;
  address: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  assignedArea: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasPhoto: boolean;
  flagCount: number;
  hidden: boolean;
  hiddenReason: "AUTO_FLAGS" | "ADMIN" | null;
};

export type AdminDashboard = {
  metrics: { total: number; pending: number; urgent: number; overdue: number; averageResolutionDays: number };
  categoryTotals: { category: Category; total: number }[];
  hotMunicipalities: { name: string; total: number }[];
  reports: AdminReport[];
  page: number;
  hasNextPage: boolean;
};

// Calls the Go API as the signed-in user. The Neon Auth JWT is minted server-side
// from the session cookie, so it never reaches the browser. A missing token is sent
// as an empty bearer and Go answers 401.
export async function adminFetch(path: string, init?: RequestInit) {
  const { data } = await auth.token();
  return fetch(new URL(path, process.env.REPORTAR_API_URL), {
    ...init,
    cache: "no-store",
    headers: { ...init?.headers, Authorization: `Bearer ${data?.token ?? ""}` },
  });
}

export async function getAdminDashboard(filters: URLSearchParams): Promise<AdminDashboard> {
  const response = await adminFetch(`/api/admin/reports?${filters}`);
  if (response.status === 401) redirect("/admin/login");
  if (response.status === 403) redirect("/admin/login?error=not-admin");
  if (!response.ok) throw new Error(`GET /api/admin/reports failed with ${response.status}`);
  return response.json();
}

export type PublicReportEvent = {
  type: "CREATED" | "STATUS_CHANGED" | "MUNICIPAL_RESPONSE";
  fromStatus: ReportStatus | null;
  toStatus: ReportStatus | null;
  publicMessage: string | null;
  createdAt: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

// Keeps only the list filters the Go API accepts, so bad URLs never turn into a 400.
export function adminFilters(query: SearchParams) {
  const value = (key: string) => typeof query[key] === "string" ? query[key].trim() : "";
  const filters = new URLSearchParams();
  if (Object.hasOwn(statusLabels, value("status"))) filters.set("status", value("status"));
  if (Object.hasOwn(urgencyLabels, value("urgency"))) filters.set("urgency", value("urgency"));
  if (Object.hasOwn(categoryLabels, value("category"))) filters.set("category", value("category"));
  if (value("area")) filters.set("area", value("area").slice(0, 100));
  if (value("review") === "pending") filters.set("review", "pending");
  if (value("moderation") === "flagged" || value("moderation") === "hidden") filters.set("moderation", value("moderation"));
  return filters;
}

export function pageNumber(query: SearchParams) {
  return Math.max(1, Math.min(10000, Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1));
}

// ponytail: the API has no admin detail endpoint. Look on the list page the row came from,
// then scan unfiltered pages (50 reports each, capped at 1000 reports). Add GET /api/admin/reports/{id} when that ceiling hurts.
export async function findAdminReport(id: string, listPage: URLSearchParams): Promise<AdminReport | null> {
  const hit = (await getAdminDashboard(listPage)).reports.find(report => report.publicId === id);
  if (hit) return hit;
  for (let page = 1; page <= 20; page++) {
    const { reports, hasNextPage } = await getAdminDashboard(new URLSearchParams({ page: String(page) }));
    const found = reports.find(report => report.publicId === id);
    if (found || !hasNextPage) return found ?? null;
  }
  return null;
}

// Public timeline. Hidden reports answer 404 here, so null just means "no timeline to show".
export async function getPublicEvents(id: string): Promise<PublicReportEvent[] | null> {
  try {
    const response = await fetch(new URL(`/api/reports/${encodeURIComponent(id)}`, process.env.REPORTAR_API_URL), { cache: "no-store" });
    if (!response.ok) return null;
    return ((await response.json()) as { events?: PublicReportEvent[] }).events ?? [];
  } catch {
    return null;
  }
}

export function photoUrl(id: string) {
  return new URL(`/api/reports/${encodeURIComponent(id)}/photo`, process.env.REPORTAR_API_URL).href;
}
