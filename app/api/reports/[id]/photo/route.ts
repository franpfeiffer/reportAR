import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { eq } from "drizzle-orm";
import { isUuid } from "@/lib/reports/validation";

export async function GET(_request: Request, { params }: {params: Promise<{id: string}>}) {
  const { id } = await params;
  if (!isUuid(id)) return new Response(null, {status: 404});
  const [report] = await db.select({photoUrl: citizenReports.photoUrl}).from(citizenReports).where(eq(citizenReports.publicId, id)).limit(1);
  if (!report?.photoUrl) return new Response(null, {status: 404});
  try {
    const url = new URL(report.photoUrl);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com")) return new Response(null, {status: 404});
    return Response.redirect(url, 307);
  } catch { return new Response(null, {status: 404}); }
}
