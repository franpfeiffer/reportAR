import { createHash } from "node:crypto";
import { db, getSql } from "@reportar/db";
import { forwardGeocodeCache } from "@reportar/db/schema";
import { eq } from "drizzle-orm";
import { isRecord } from "@/lib/reports/validation";

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es-AR");
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const address = params.get("street")?.trim().replace(/\s+/g, " ") ?? "";
  const city = params.get("city")?.trim() ?? "";
  const province = params.get("province")?.trim() ?? "";
  if (address.length < 3 || address.length > 160) {
    return Response.json({ error: "Escribí una calle y altura válidas." }, { status: 400 });
  }
  if (!city || !province || city.length > 100 || province.length > 100) {
    return Response.json({ error: "Elegí primero una provincia y una ciudad o localidad." }, { status: 400 });
  }
  const normalized = normalize(`${address}|${city}|${province}`);
  const queryKey = createHash("sha256").update(normalized).digest("hex");
  try {
    const [cached] = await db.select({ latitude: forwardGeocodeCache.latitude, longitude: forwardGeocodeCache.longitude })
      .from(forwardGeocodeCache).where(eq(forwardGeocodeCache.queryKey, queryKey)).limit(1);
    if (cached) return Response.json({ ...cached, approximate: true }, { headers: { "Cache-Control": "private, no-store" } });

    const permit = await getSql()`
      INSERT INTO reverse_geocode_gate (id, last_request_at) VALUES (1, now())
      ON CONFLICT (id) DO UPDATE SET last_request_at = excluded.last_request_at
      WHERE reverse_geocode_gate.last_request_at <= now() - interval '1 second'
      RETURNING id
    `;
    if (permit.length === 0) {
      return Response.json({ error: "La búsqueda está ocupada. Esperá un segundo e intentá de nuevo." },
        { status: 429, headers: { "Retry-After": "1" } });
    }

    const upstream = new URL("https://nominatim.openstreetmap.org/search");
    upstream.search = new URLSearchParams({
      q: `${address}, ${city}, ${province}, Argentina`,
      format: "jsonv2",
      limit: "20",
      addressdetails: "1",
      countrycodes: "ar",
      layer: "address",
      "accept-language": "es-AR,es",
    }).toString();
    const response = await fetch(upstream, {
      headers: { "User-Agent": "ReportAR/1.0 (+https://github.com/franpfeiffer/reportAR)", "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return Response.json({ error: "No pudimos buscar esa dirección. Marcá el punto en el mapa." }, { status: 503 });
    const results: unknown = await response.json();
    const candidates = Array.isArray(results) ? results.filter(isRecord) : [];
    const inRequestedCity = candidates.filter(candidate => {
      if (!isRecord(candidate.address)) return false;
      const localities = [candidate.address.city, candidate.address.town, candidate.address.village, candidate.address.municipality, candidate.address.suburb]
        .filter((value): value is string => typeof value === "string");
      const localityMatches = localities.some(locality => normalize(locality) === normalize(city)
        || (normalize(city).length >= 6 && normalize(locality).includes(normalize(city)))
        || (normalize(locality).length >= 6 && normalize(city).includes(normalize(locality))));
      if (!localityMatches) return false;
      const state = typeof candidate.address.state === "string" ? normalize(candidate.address.state) : "";
      return !state || state === normalize(province) || state.includes(normalize(province)) || normalize(province).includes(state);
    });
    const numbers = [...address.matchAll(/\b\d+[a-zA-Z]?\b/g)];
    const requestedNumber = numbers.at(-1)?.[0];
    const match = inRequestedCity.find(candidate => isRecord(candidate.address) &&
      typeof candidate.address.house_number === "string" && candidate.address.house_number.toLocaleLowerCase() === requestedNumber?.toLocaleLowerCase())
      ?? inRequestedCity[0];
    if (!match) return Response.json({ error: `No encontramos esa dirección en ${city}, ${province}. Revisá la altura o marcá el punto en el mapa.` }, { status: 404 });
    const latitude = Number(match.lat);
    const longitude = Number(match.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return Response.json({ error: "No encontramos un punto válido para esa dirección." }, { status: 404 });
    }
    await db.insert(forwardGeocodeCache).values({ queryKey, latitude, longitude }).onConflictDoNothing();
    return Response.json({ latitude, longitude, approximate: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "No pudimos buscar esa dirección. Marcá el punto en el mapa." }, { status: 503 });
  }
}
