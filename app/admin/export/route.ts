import { adminFetch } from "@/lib/api";

// The browser never holds the admin JWT, so the CSV download is proxied here.
export async function GET(request: Request) {
  const response = await adminFetch(`/api/admin/reports/export${new URL(request.url).search}`);
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  for (const name of ["Content-Type", "Content-Disposition"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}
