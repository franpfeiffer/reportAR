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
      return download || !isDisplayableImage ? temporaryRedirect(url) : await proxyPhoto(url, contentType);
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
    return await proxyPhoto(url.toString(), report.photoContentType || "application/octet-stream");
  } catch { return new Response(null, {status: 404}); }
}

async function proxyPhoto(url: string, fallbackContentType: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok || !response.body) return new Response(null, { status: response.status || 502 });
  const headers = new Headers({
    "Content-Type": response.headers.get("content-type") || fallbackContentType,
    "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    "X-Content-Type-Options": "nosniff",
  });
  const contentLength = response.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  return new Response(response.body, { headers });
}

function temporaryRedirect(url: string) {
  return new Response(null, { status: 307, headers: { Location: url, "Cache-Control": "private, no-store" } });
}
