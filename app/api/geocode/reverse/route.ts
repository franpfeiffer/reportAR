import { db, getSql } from "@reportar/db";
import { reverseGeocodeCache } from "@reportar/db/schema";
import { eq } from "drizzle-orm";
import { isRecord } from "@/lib/reports/validation";

function readableAddress(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const details = isRecord(value.address) ? value.address : {};
  const first = (...keys: string[]) => keys.map(key => details[key]).find(item => typeof item === "string" && item.trim().length > 0) as string | undefined;
  const street = first("road", "pedestrian", "residential", "footway", "path");
  const number = first("house_number");
  const area = first("neighbourhood", "suburb", "city_district", "town", "city", "village", "municipality");
  const streetLine = street ? `${street}${number ? ` ${number}` : ""}` : undefined;
  const short = [streetLine, area].filter(Boolean).join(", ");
  const fallback = typeof value.display_name === "string" ? value.display_name.split(",").slice(0, 3).join(",").trim() : "";
  const address = short || fallback;
  return address.length >= 5 ? address.slice(0, 200) : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = params.get("lat");
  const longitude = params.get("lon");
  const lat = latitude === null || latitude.trim() === "" ? NaN : Number(latitude);
  const lon = longitude === null || longitude.trim() === "" ? NaN : Number(longitude);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
    return Response.json({ error: "Las coordenadas no son válidas." }, { status: 400 });
  }

  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  try {
    const [cached] = await db.select({ address: reverseGeocodeCache.address }).from(reverseGeocodeCache)
      .where(eq(reverseGeocodeCache.coordinateKey, key)).limit(1);
    if (cached) return Response.json({ address: cached.address, approximate: true }, { headers: { "Cache-Control": "private, no-store" } });

    // The public Nominatim server permits at most one request per second per app.
    // This atomic row update enforces that limit across all Vercel instances.
    const sql = getSql();
    const permit = await sql`
      INSERT INTO reverse_geocode_gate (id, last_request_at) VALUES (1, now())
      ON CONFLICT (id) DO UPDATE SET last_request_at = excluded.last_request_at
      WHERE reverse_geocode_gate.last_request_at <= now() - interval '1 second'
      RETURNING id
    `;
    if (permit.length === 0) {
      return Response.json({ error: "La búsqueda de direcciones está ocupada. Intentá de nuevo en un momento." },
        { status: 429, headers: { "Retry-After": "1" } });
    }

    const upstream = new URL("https://nominatim.openstreetmap.org/reverse");
    upstream.search = new URLSearchParams({ format: "jsonv2", lat: lat.toFixed(5), lon: lon.toFixed(5), zoom: "18", addressdetails: "1", layer: "address", "accept-language": "es-AR,es" }).toString();
    const result = await fetch(upstream, {
      headers: { "User-Agent": "ReportAR/1.0 (+https://github.com/franpfeiffer/reportAR)", "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!result.ok) return Response.json({ error: "No pudimos obtener la dirección. Escribila manualmente." }, { status: 503 });
    const address = readableAddress(await result.json());
    if (!address) return Response.json({ error: "No encontramos una dirección para ese punto. Escribila manualmente." }, { status: 422 });

    await db.insert(reverseGeocodeCache).values({ coordinateKey: key, address }).onConflictDoNothing();
    return Response.json({ address, approximate: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "No pudimos obtener la dirección. Escribila manualmente." }, { status: 503 });
  }
}
