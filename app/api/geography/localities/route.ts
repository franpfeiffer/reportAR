export async function GET(request: Request) {
  const provinceId = new URL(request.url).searchParams.get("province");
  if (!provinceId || !/^\d{2}$/.test(provinceId)) return Response.json({ error: "Elegí una provincia válida." }, { status: 400 });
  try {
    const url = new URL("https://apis.datos.gob.ar/georef/api/localidades");
    url.search = new URLSearchParams({ provincia: provinceId, orden: "nombre", max: "5000", campos: "id,nombre" }).toString();
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return Response.json({ error: "No pudimos cargar las ciudades de esa provincia." }, { status: 503 });
    const data = await response.json() as { localidades?: Array<{ id?: string; nombre?: string }> };
    const localities = (data.localidades ?? []).filter(item => typeof item.id === "string" && typeof item.nombre === "string").map(item => ({ id: item.id!, name: item.nombre! }));
    return Response.json({ localities }, { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
  } catch {
    return Response.json({ error: "No pudimos cargar las ciudades de esa provincia." }, { status: 503 });
  }
}
