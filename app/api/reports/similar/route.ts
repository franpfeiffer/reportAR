import { db } from "@reportar/db";
import { citizenReports } from "@reportar/db/schema";
import { and, desc, eq, gte, lte, isNotNull } from "drizzle-orm";
import { categoryLabels } from "@/lib/reports/validation";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const category = query.get("category") || "";
  const latitude = Number(query.get("latitude"));
  const longitude = Number(query.get("longitude"));
  if (!Object.hasOwn(categoryLabels, category) || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    return Response.json({ error: "Ubicación o categoría inválida." }, { status: 400 });
  }
  const radiusKm = 0.3;
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.max(0.2, Math.cos(latitude * Math.PI / 180)));
  try {
    const recent = await db.select({ id: citizenReports.publicId, category: citizenReports.category, status: citizenReports.status, address: citizenReports.address, description: citizenReports.description, latitude: citizenReports.latitude, longitude: citizenReports.longitude, createdAt: citizenReports.createdAt })
      .from(citizenReports).where(and(
        eq(citizenReports.category, category as keyof typeof categoryLabels),
        gte(citizenReports.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
        isNotNull(citizenReports.latitude), isNotNull(citizenReports.longitude),
        gte(citizenReports.latitude, latitude - latDelta), lte(citizenReports.latitude, latitude + latDelta),
        gte(citizenReports.longitude, longitude - lonDelta), lte(citizenReports.longitude, longitude + lonDelta),
      )).orderBy(desc(citizenReports.createdAt)).limit(40);
    const distance = (lat: number, lon: number) => {
      const rad = Math.PI / 180;
      const dLat = (lat - latitude) * rad, dLon = (lon - longitude) * rad;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(latitude * rad) * Math.cos(lat * rad) * Math.sin(dLon / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const matches = recent.filter(report => report.latitude !== null && report.longitude !== null && distance(report.latitude, report.longitude) <= radiusKm)
      .slice(0, 5).map(({ latitude: _lat, longitude: _lon, ...report }) => ({ ...report, createdAt: report.createdAt.toISOString() }));
    return Response.json({ reports: matches }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "No pudimos revisar reportes cercanos." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
