export async function GET() {
  try {
    const response = await fetch("https://apis.datos.gob.ar/georef/api/provincias?orden=nombre&max=50&campos=id,nombre", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return Response.json({ error: "No pudimos cargar las provincias." }, { status: 503 });
    const data = await response.json() as { provincias?: Array<{ id?: string; nombre?: string }> };
    const provinces = (data.provincias ?? []).filter(item => typeof item.id === "string" && typeof item.nombre === "string").map(item => ({ id: item.id!, name: item.nombre! }));
    return Response.json({ provinces }, { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
  } catch {
    return Response.json({ error: "No pudimos cargar las provincias." }, { status: 503 });
  }
}
