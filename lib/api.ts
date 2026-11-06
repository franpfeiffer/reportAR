import { redirect } from "next/navigation";
import { auth } from "@reportar/auth";
import type { Category, ReportStatus, Urgency, UrgencyClassificationStatus } from "./labels";

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
