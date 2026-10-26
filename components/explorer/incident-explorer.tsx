"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import provinces from "@/lib/geography/provinces.json";
import type { ExplorerData, ExplorerReport } from "@/lib/reports/explorer-types";
import { categoryLabels, statusLabels, urgencyLabels, type Category, type ReportStatus, type Urgency } from "@/lib/reports/validation";
import { StatusPill } from "@/components/status-pill";
import { IncidentMap } from "./incident-map";
import { ReportPhoto } from "./report-photo";
import { CategoryIcon, MapIcon, categoryColors, shortCategory } from "./icons";

const provinceOptions = [...provinces].sort((a, b) => a.name.localeCompare(b.name, "es"));
const number = (value: number) => value.toLocaleString("es-AR");
const shortName = (name: string) => name === "Ciudad Autónoma de Buenos Aires" ? "Ciudad de Buenos Aires" : name.startsWith("Tierra del Fuego,") ? "Tierra del Fuego" : name;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function IncidentExplorer() {
  const [province, setProvince] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [status, setStatus] = useState<ReportStatus | "">("");
  const [urgency, setUrgency] = useState<Urgency | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: ExplorerData; error?: string } | null>(null);
  const [selected, setSelected] = useState<ExplorerReport | null>(null);
  const [nearby, setNearby] = useState<ExplorerReport[]>([]);
  const selectedIndex = nearby.findIndex(report => report.id === selected?.id);
  const query = new URLSearchParams({ province, municipality, category, status, urgency, page: String(page) }).toString();
  const key = `${query}&retry=${retry}`;
  const data = result?.key === key ? result.data ?? null : null;
  const error = result?.key === key ? result.error : null;
  const loading = !data && !error;
  const provinceName = provinces.find(p => p.id === province)?.name;
  const municipalityName = data?.municipalities.find(m => m.id === municipality)?.name;
  const place = municipalityName || (provinceName ? shortName(provinceName) : "Argentina");
  const territories = province ? data?.municipalities ?? [] : data?.provinces ?? [];
  const visibleTerritories = territories.filter(t => normalize(t.name).includes(normalize(search)));
  const chooseTerritory = useCallback((nextProvince: string, nextMunicipality = "") => {
    setProvince(nextProvince); setMunicipality(nextMunicipality); setSearch(""); setPage(1); setSelected(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 20000);
    fetch(`/api/reports/explorer?${query}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("No pudimos cargar los incidentes. Volvé a intentar.");
        return response.json() as Promise<ExplorerData>;
      })
      .then(next => { if (!disposed) setResult({ key, data: next }); })
      .catch(() => { if (!disposed) setResult({ key, error: "No pudimos cargar los incidentes. Volvé a intentar." }); })
      .finally(() => clearTimeout(timeout));
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [query, key]);

  function chooseCategory(next: Category | "") { setCategory(next); setPage(1); setSelected(null); }
  function chooseStatus(next: ReportStatus | "") { setStatus(next); setPage(1); setSelected(null); }
  function chooseUrgency(next: Urgency | "") { setUrgency(next); setPage(1); setSelected(null); }
  function clearFilters() { chooseTerritory(""); setCategory(""); setStatus(""); setUrgency(""); }

  return <section id="mapa" className="site-shell explorer-section" aria-labelledby="explorer-heading">
    <div className="explorer-heading">
      <div><h2 id="explorer-heading" className="section-title">Cada reporte cuenta. Y se ve.</h2><p className="body-lead mt-3">Explorá qué pasa en cada provincia y municipio. Son los reportes de nuestra comunidad.</p></div>
      <a href="#incidentes" className="civic-link explorer-heading-link">Ver reportes <MapIcon kind="arrow" size={18}/></a>
    </div>

    <div className="explorer-surface">
      <div className="explorer-toolbar">
        <label className="explorer-select"><span>Provincia</span><select aria-label="Provincia" value={province} onChange={event => chooseTerritory(event.target.value)}><option value="">Toda Argentina</option>{provinceOptions.map(p => <option key={p.id} value={p.id}>{shortName(p.name)}</option>)}</select></label>
        <label className="explorer-select"><span>Municipio o comuna</span><select aria-label="Municipio o comuna" value={municipality} disabled={!province || loading || !data?.municipalities.length} onChange={event => chooseTerritory(province, event.target.value)}><option value="">{!province ? "Primero elegí una provincia" : "Todos los municipios"}</option>{[...(data?.municipalities ?? [])].sort((a, b) => a.name.localeCompare(b.name, "es")).map(m => <option key={m.id} value={m.id}>{m.name} ({m.count})</option>)}</select></label>
        <label className="explorer-select explorer-status-select"><span>Estado</span><select aria-label="Estado" value={status} onChange={event => chooseStatus(event.target.value as ReportStatus | "")}><option value="">Todos los estados</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="explorer-select explorer-status-select"><span>Urgencia</span><select aria-label="Urgencia" value={urgency} onChange={event => chooseUrgency(event.target.value as Urgency | "")}><option value="">Todas</option>{Object.entries(urgencyLabels).map(([value, label]) => <option key={value} value={value}>{label} ({data ? number(data.urgencies[value as Urgency]) : "—"})</option>)}</select></label>
        {(province || category || status || urgency) && <button className="explorer-clear" type="button" onClick={clearFilters}>Limpiar filtros <MapIcon kind="close" size={14}/></button>}
      </div>
      <div className="explorer-categories" aria-label="Filtrar por tipo de incidente">
        <button type="button" aria-pressed={!category} className={`category-filter ${!category ? "is-active" : ""}`} onClick={() => chooseCategory("")}>Todos los tipos<span>{data ? number(Object.values(data.categories).reduce((sum, count) => sum + count, 0)) : "—"}</span></button>
        {(Object.keys(categoryLabels) as Category[]).map(value => <button key={value} type="button" aria-pressed={category === value} className={`category-filter ${category === value ? "is-active" : ""}`} onClick={() => chooseCategory(category === value ? "" : value)}><span className="category-color" style={{ color: categoryColors[value] }}><CategoryIcon category={value} size={17}/></span>{shortCategory[value]}<span>{data ? number(data.categories[value]) : "—"}</span></button>)}
      </div>
      {error && <div className="explorer-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div>}
      <div className="explorer-workspace">
        <aside className="explorer-sidebar" aria-label="Resumen y zonas">
          <div className="explorer-place-summary" aria-live="polite" aria-busy={loading}>
            <div className="explorer-breadcrumb"><button type="button" onClick={() => chooseTerritory("")}>Argentina</button>{province && <><span>/</span><button type="button" onClick={() => chooseTerritory(province)}>{shortName(provinceName || "Provincia")}</button></>}</div>
            <h3>{place}</h3>
            <div className="explorer-main-count"><strong>{data ? number(data.total) : "—"}</strong><span>incidentes{category && <small>{shortCategory[category].toLowerCase()}</small>}</span></div>
            <div className="explorer-state-counts"><span><i className="state-pending"/>{data ? number(status === "RESUELTO" ? 0 : status ? data.statuses[status] : data.statuses.RECIBIDO + data.statuses.EN_REVISION) : "—"} pendientes</span><span><i className="state-resolved"/>{data ? number(!status || status === "RESUELTO" ? data.statuses.RESUELTO : 0) : "—"} resueltos</span></div>
          </div>
          <div className="explorer-territory-heading"><h4>{province ? "Municipios y comunas" : "Por provincia"}</h4><span>{data ? territories.length : "—"}</span></div>
          <label className="explorer-search"><MapIcon kind="search" size={17}/><input aria-label={province ? "Buscar municipio" : "Buscar provincia"} placeholder={province ? "Buscar municipio…" : "Buscar provincia…"} value={search} onChange={event => setSearch(event.target.value)}/></label>
          <div className="explorer-territories" aria-busy={loading}>
            {loading ? <p className="explorer-list-message" role="status">Cargando incidentes…</p> : visibleTerritories.map(territory => <button key={territory.id} className={`territory-row ${territory.id === municipality ? "is-selected" : ""}`} type="button" aria-pressed={territory.id === municipality} onClick={() => chooseTerritory(province || territory.id, province ? territory.id : "")}><span>{shortName(territory.name)}</span><span className={territory.count ? "territory-total has-incidents" : "territory-total"}>{number(territory.count)}</span><MapIcon kind="arrow" size={14}/></button>)}
            {data && !visibleTerritories.length && <p className="explorer-list-message">{search ? "No encontramos una zona con ese nombre." : province === "02" ? "La Ciudad de Buenos Aires se muestra como un distrito único." : "No hay municipios en este catálogo para la provincia seleccionada."}</p>}
          </div>
          <p className="explorer-sidebar-note">{data ? `${number(data.located)} de ${number(data.total)} incidentes tienen un punto en el mapa.` : "Los conteos se calculan con reportes de ReportAR."}{data && data.unassigned > 0 ? ` ${number(data.unassigned)} sin provincia identificada.` : ""}{data && province && province !== "02" && data.withoutMunicipality > 0 ? ` ${number(data.withoutMunicipality)} sin municipio identificado.` : ""}</p>
        </aside>
        <div className="explorer-map-panel">
          <IncidentMap data={data} province={province} municipality={municipality} onTerritory={chooseTerritory} onReport={(report, group = []) => { setSelected(report); setNearby(group); }}/>
          {selected && <article className="map-report-preview" aria-label="Incidente seleccionado"><button type="button" className="map-preview-close" aria-label="Cerrar incidente" onClick={() => setSelected(null)}><MapIcon kind="close" size={17}/></button><div className="map-preview-photo"><ReportPhoto key={selected.id} report={selected}/></div><div className="map-preview-body">{nearby.length > 1 && <nav className="map-preview-pagination" aria-label="Incidentes cercanos"><button type="button" aria-label="Incidente anterior" disabled={selectedIndex === 0} onClick={() => setSelected(nearby[selectedIndex - 1])}>‹</button><span>Incidente {selectedIndex + 1} de {nearby.length}</span><button type="button" aria-label="Incidente siguiente" disabled={selectedIndex === nearby.length - 1} onClick={() => setSelected(nearby[selectedIndex + 1])}>›</button></nav>}<StatusPill status={selected.status}/><h4>{categoryLabels[selected.category]}</h4><p>{selected.address}</p><Link href={`/reclamo/${selected.id}`} className="civic-link">Ver foto y detalle <MapIcon kind="arrow" size={16}/></Link></div></article>}
        </div>
      </div>
      <div className="explorer-map-footer"><span><MapIcon kind="layers" size={15}/>Datos de ReportAR. Los conteos incluyen reportes sin coordenadas.</span><span>{data ? `Actualizado ${new Date(data.updatedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}` : "Cargando datos…"}</span></div>
      {data && data.located > data.markerLimit && <p className="explorer-limit-note">El mapa muestra las {number(data.markerLimit)} ubicaciones más recientes. Los conteos y el listado incluyen todos los resultados.</p>}
    </div>

    <div id="incidentes" className="explorer-gallery-heading"><div><h3 className="section-title">Lo que pasa en {place}</h3><p>{data ? `${number(data.total)} ${data.total === 1 ? "reporte" : "reportes"}` : "Cargando reportes…"}{category ? ` de ${shortCategory[category].toLowerCase()}` : ""}{status ? ` · ${statusLabels[status]}` : ""}{urgency ? ` · ${urgencyLabels[urgency]}` : ""}. Más recientes primero.</p></div><Link href="/reportar" className="civic-button civic-button-outline">Hacer un reporte <MapIcon kind="arrow" size={17}/></Link></div>
    {loading ? <div className="explorer-gallery" aria-label="Cargando reportes" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="report-card-skeleton"/>)}</div> : error ? <p className="explorer-empty">El listado estará disponible cuando se restablezca la conexión. <button className="civic-link" type="button" onClick={() => setRetry(value => value + 1)}>Volver a intentar</button></p> : data?.reports.length ? <div className="explorer-gallery">{data.reports.map(report => <article className="explorer-report-card" key={report.id}><Link href={`/reclamo/${report.id}`} className="explorer-report-link"><div className="explorer-report-image"><ReportPhoto report={report}/><div className="explorer-photo-status"><StatusPill status={report.status}/></div></div><div className="explorer-report-body"><div className="explorer-report-category" style={{ color: categoryColors[report.category] }}><CategoryIcon category={report.category} size={17}/>{shortCategory[report.category]}</div><h4>{report.address}</h4><p>{report.description}</p><div className="explorer-report-bottom"><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" })}</time><span>Ver reporte <MapIcon kind="arrow" size={17}/></span></div></div></Link></article>)}</div> : <div className="explorer-empty"><MapIcon kind="pin" size={30}/><h4>No hay reportes con estos filtros.</h4><p>Probá otra zona o categoría. Si hay un problema en tu barrio, podés ser la primera persona en reportarlo.</p><button type="button" className="civic-link" onClick={() => { chooseCategory(""); chooseStatus(""); chooseUrgency(""); }}>Ver todos los tipos y estados</button></div>}
    {data && data.pages > 1 && <nav className="explorer-pagination" aria-label="Páginas de incidentes"><button className="civic-button civic-button-outline" type="button" disabled={data.page === 1} onClick={() => setPage(data.page - 1)}>Anterior</button><span>Página {data.page} de {data.pages}</span><button className="civic-button civic-button-outline" type="button" disabled={data.page === data.pages} onClick={() => setPage(data.page + 1)}>Siguiente</button></nav>}
  </section>;
}
