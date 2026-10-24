import { createHash } from "node:crypto";
import { db, getSql } from "@reportar/db";
import { forwardGeocodeCache } from "@reportar/db/schema";
import { eq } from "drizzle-orm";
import { isRecord } from "@/lib/reports/validation";

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es-AR");
}

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("q")?.trim().replace(/\s+/g, " ") ?? "";
  if (address.length < 5 || address.length > 200) {
    return Response.json({ error: "Escribí una dirección de al menos 5 caracteres." }, { status: 400 });
  }
  const parts = address.split(",").map(part => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return Response.json({ error: "Agregá también la ciudad después de una coma. Ejemplo: Córdoba 1900, Rosario." }, { status: 400 });
  }
  const city = parts[1];
  const normalized = normalize(address);
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
      q: `${address}, Argentina`,
      format: "jsonv2",
      limit: "10",
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
      const localities = [candidate.address.city, candidate.address.town, candidate.address.village, candidate.address.municipality]
        .filter((value): value is string => typeof value === "string");
      return localities.some(locality => normalize(locality) === normalize(city)
        || normalize(locality).includes(normalize(city))
        || normalize(city).includes(normalize(locality)));
    });
    const numbers = [...parts[0].matchAll(/\b\d+[a-zA-Z]?\b/g)];
    const requestedNumber = numbers.at(-1)?.[0];
    const match = inRequestedCity.find(candidate => isRecord(candidate.address) &&
      typeof candidate.address.house_number === "string" && candidate.address.house_number.toLocaleLowerCase() === requestedNumber?.toLocaleLowerCase())
      ?? inRequestedCity[0];
    if (!match) return Response.json({ error: `No encontramos esa dirección en ${city}. Revisá la ciudad y la altura, o marcá el punto en el mapa.` }, { status: 404 });
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
