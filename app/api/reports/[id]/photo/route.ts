import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { eq } from "drizzle-orm";
import { head } from "@vercel/blob";
import { isUuid } from "@/lib/reports/validation";
import { getTelegramPhoto } from "@/lib/reports/telegram-photo";

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
      const object = await getTelegramPhoto(report.photoStorageKey);
      if (!object.Body) return new Response(null, {status: 404});
      const contentType = report.photoContentType || object.ContentType || "application/octet-stream";
      if (!/^image\/(jpeg|png|gif|webp|avif|bmp)$/.test(contentType)) return new Response(null, {status: 404});
      const filename = (report.photoFilename || "foto").replace(/[\r\n"\\]/g, "_").slice(0, 100);
      const headers = new Headers({
        "Content-Type": contentType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      if (typeof object.ContentLength === "number") headers.set("Content-Length", String(object.ContentLength));
      return new Response(object.Body.transformToWebStream(), {headers});
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
      return Response.redirect(blob.downloadUrl, 307);
    }
    return Response.redirect(url, 307);
  } catch { return new Response(null, {status: 404}); }
}
