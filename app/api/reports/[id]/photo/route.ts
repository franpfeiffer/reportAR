import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { eq } from "drizzle-orm";
import { head } from "@vercel/blob";
import { isUuid } from "@/lib/reports/validation";
import { getSignedReportPhotoUrl } from "@/lib/reports/neon-storage";

export async function GET(request: Request, { params }: {params: Promise<{id: string}>}) {
  const { id } = await params;
  if (!isUuid(id)) return new Response(null, {status: 404});
  const [report] = await db.select({
    photoUrl: citizenReports.photoUrl,
    photoStorageKey: citizenReports.photoStorageKey,
    photoContentType: citizenReports.photoContentType,
    photoFilename: citizenReports.photoFilename,
  }).from(citizenReports).where(eq(citizenReports.publicId, id)).limit(1);
  if (!report?.photoUrl && !report?.photoStorageKey) return new Response(null, {status: 404});
  const download = new URL(request.url).searchParams.has("download");
  if (report.photoStorageKey) {
    try {
      const contentType = report.photoContentType || "application/octet-stream";
      const isDisplayableImage = /^image\/(jpeg|png|gif|webp|avif|bmp)$/.test(contentType);
      const url = await getSignedReportPhotoUrl(report.photoStorageKey, {
        download: download || !isDisplayableImage,
        filename: report.photoFilename || "foto",
      });
      return temporaryRedirect(url);
    } catch {
      return new Response(null, {status: 503});
    }
  }
  if (!report.photoUrl) return new Response(null, {status: 404});
  try {
    const url = new URL(report.photoUrl);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com")) return new Response(null, {status: 404});
    if (download) {
      const blob = await head(url.toString());
      return temporaryRedirect(blob.downloadUrl);
    }
    return temporaryRedirect(url.toString());
  } catch { return new Response(null, {status: 404}); }
}

function temporaryRedirect(url: string) {
  return new Response(null, { status: 307, headers: { Location: url, "Cache-Control": "private, no-store" } });
}
