"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, GeoJSON, Path } from "leaflet";
import type { Boundary, BoundaryCollection } from "@/lib/geography/types";
import type { ExplorerData, ExplorerReport } from "@/lib/reports/explorer-types";
import { categoryLabels } from "@/lib/reports/validation";
import { categoryColors, MapIcon } from "./icons";

const countryBounds: [[number, number], [number, number]] = [[-55.8, -74], [-21.5, -53.5]];
const boundaryCache = new Map<string, BoundaryCollection>();
async function getBoundaries(path: string, signal: AbortSignal) {
  const existing = boundaryCache.get(path);
  if (existing) return existing;
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error("No se pudo cargar la cartografía.");
  const data = await response.json() as BoundaryCollection;
  boundaryCache.set(path, data);
  return data;
}
export function IncidentMap({ data, province, municipality, onTerritory, onReport }: {
  data: ExplorerData | null; province: string; municipality: string;
  onTerritory: (province: string, municipality?: string) => void; onReport: (report: ExplorerReport, nearby?: ExplorerReport[]) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layers = useRef<LayerGroup | null>(null);
  const scope = useRef("");
  const callbacks = useRef({ onTerritory, onReport });
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(4);
  const [geography, setGeography] = useState<{ provinces: BoundaryCollection; municipalities: BoundaryCollection; province: string } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => { callbacks.current = { onTerritory, onReport }; }, [onTerritory, onReport]);
  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    import("leaflet").then(L => {
      if (disposed || !container.current) return;
      const instance = L.map(container.current, { zoomControl: false, scrollWheelZoom: false, minZoom: 3, maxZoom: 18 });
      map.current = instance;
      instance.on("zoomend", () => setZoom(instance.getZoom()));
      instance.fitBounds(countryBounds, { padding: [16, 16] });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(instance);
      instance.attributionControl.addAttribution('<a href="https://www.argentina.gob.ar/georef">GeoRef / IGN</a>');
      layers.current = L.layerGroup().addTo(instance);
      resize = new ResizeObserver(() => instance.invalidateSize());
      resize.observe(container.current);
      setReady(true);
    }).catch(() => setError("No pudimos abrir el mapa. Usá la lista de zonas para explorar los reportes."));
    return () => { disposed = true; resize?.disconnect(); map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getBoundaries("/geography/provinces.json", controller.signal),
      province ? getBoundaries(`/geography/municipalities/${province}.json`, controller.signal) : Promise.resolve({ type: "FeatureCollection", features: [] } as BoundaryCollection),
    ]).then(([provinces, municipalities]) => {
      if (controller.signal.aborted) return;
      setError(""); setGeography({ provinces, municipalities, province });
    }).catch(() => { if (!controller.signal.aborted) setError("No pudimos cargar los límites del mapa. Podés seguir explorando desde la lista."); });
    return () => controller.abort();
  }, [province, retry]);
  useEffect(() => {
    if (!ready || !geography || geography.province !== province) return;
    let disposed = false;
    import("leaflet").then(L => {
      if (disposed || !map.current || !layers.current) return;
      const instance = map.current;
      const group = layers.current;
      group.clearLayers();
      const provinceCounts = new Map(data?.provinces.map(p => [p.id, p.count]) ?? []);
      const municipalityCounts = new Map(data?.municipalities.map(p => [p.id, p.count]) ?? []);
      const maxCount = Math.max(1, ...(province ? municipalityCounts : provinceCounts).values());
      const fill = (count: number) => count ? `hsl(166 38% ${Math.round(74 - Math.sqrt(Math.min(1, count / maxCount)) * 37)}%)` : "#DCE6DF";
      const addBoundary = (feature: Boundary, local: boolean) => {
        const id = feature.properties.id;
        const count = (local ? municipalityCounts : provinceCounts).get(id) ?? 0;
        const selected = local ? municipality === id : province === id;
        const color = selected ? "#E86F50" : local ? "#6B8E81" : "#658D7C";
        const layer: GeoJSON = L.geoJSON(feature, { style: {
          color, weight: selected ? 2.5 : local ? .7 : 1.2,
          fillColor: fill(count), fillOpacity: local ? .48 : province ? .13 : .68,
        }}).addTo(group);
        const label = document.createElement("div");
        label.textContent = `${feature.properties.name} · ${data ? `${count} incidentes` : "Cargando datos"}`;
        layer.bindTooltip(label, { sticky: true, className: "explorer-tooltip" });
        const choose = () => callbacks.current.onTerritory(local ? province : id, local ? id : "");
        layer.on("click", choose);
        layer.on("mouseover", () => layer.setStyle({ weight: 2.5, fillOpacity: .7 }));
        layer.on("mouseout", () => layer.setStyle({ weight: selected ? 2.5 : local ? .7 : 1.2, fillOpacity: local ? .48 : province ? .13 : .68 }));
        layer.eachLayer(child => {
          const element = (child as Path).getElement?.();
          if (!element) return;
          element.setAttribute("role", "button");
          element.setAttribute("aria-label", label.textContent || feature.properties.name);
          // Keyboard users have the equivalent, ordered territory list next to the map.
          element.setAttribute("tabindex", "-1");
        });
        return layer;
      };
      let target: GeoJSON | undefined;
      for (const feature of geography.provinces.features) {
        const layer = addBoundary(feature, false);
        if (feature.properties.id === province) target = layer;
      }
      if (province) for (const feature of geography.municipalities.features) {
        const layer = addBoundary(feature, true);
        if (feature.properties.id === municipality) target = layer;
      }
      const countTerritories = province ? data?.municipalities : data?.provinces;
      const territoryClusters: { x: number; y: number; territories: NonNullable<typeof countTerritories> }[] = [];
      for (const territory of countTerritories ?? []) {
        if (!territory.count || municipality) continue;
        const center = territory.id === "94" ? [-54, -67] : territory.center;
        const point = instance.project([center[0], center[1]], zoom);
        const cluster = territoryClusters.find(group => Math.hypot(group.x - point.x, group.y - point.y) < 42);
        if (cluster) cluster.territories.push(territory);
        else territoryClusters.push({ x: point.x, y: point.y, territories: [territory] });
      }
      for (const cluster of territoryClusters) {
        const territory = cluster.territories[0];
        const center = territory.id === "94" ? [-54, -67] : territory.center;
        const total = cluster.territories.reduce((sum, item) => sum + item.count, 0);
        const names = cluster.territories.map(item => `${item.name}: ${item.count}`).join(" · ");
        const marker = L.marker([center[0], center[1]], {
          icon: L.divIcon({ className: "territory-count-icon", html: `<span>${total}</span>`, iconSize: [36, 36], iconAnchor: [18, 18] }),
          title: `${names} incidentes`, keyboard: true, zIndexOffset: 500,
        }).addTo(group);
        const label = document.createElement("span"); label.textContent = names;
        marker.bindTooltip(label, { direction: "top", className: "explorer-tooltip" });
        marker.on("click", () => {
          if (cluster.territories.length === 1) callbacks.current.onTerritory(province || territory.id, province ? territory.id : "");
          else instance.fitBounds(L.latLngBounds(cluster.territories.map(item => [item.center[0], item.center[1]])), { padding: [65, 65], maxZoom: 13 });
        });
      }
      if (province) {
        const clusters: { x: number; y: number; reports: ExplorerReport[] }[] = [];
        const markers = municipality || !geography.municipalities.features.length ? data?.markers ?? [] : [];
        for (const report of markers) {
          if (report.latitude === null || report.longitude === null) continue;
          const point = instance.project([report.latitude, report.longitude], zoom);
          const cluster = clusters.find(group => Math.hypot(group.x - point.x, group.y - point.y) < 34);
          if (cluster) cluster.reports.push(report);
          else clusters.push({ x: point.x, y: point.y, reports: [report] });
        }
        for (const cluster of clusters) {
          const report = cluster.reports[0];
          const multiple = cluster.reports.length > 1;
          const marker = L.marker([report.latitude!, report.longitude!], {
            icon: L.divIcon({
              className: multiple ? "incident-cluster-icon" : "incident-dot-icon",
              html: multiple ? `<span>${cluster.reports.length}</span>` : `<span style="--dot-color:${report.status === "RESUELTO" ? "#188246" : categoryColors[report.category]}">${report.status === "RESUELTO" ? "✓" : ""}</span>`,
              iconSize: multiple ? [34, 34] : [24, 24], iconAnchor: multiple ? [17, 17] : [12, 12],
            }),
            title: multiple ? `${cluster.reports.length} incidentes cercanos. Ver reportes` : `${categoryLabels[report.category]}: ${report.address}`,
            keyboard: true, zIndexOffset: 600,
          }).addTo(group);
          const label = document.createElement("span");
          label.textContent = multiple ? `${cluster.reports.length} incidentes en esta zona` : `${categoryLabels[report.category]} · ${report.address}`;
          marker.bindTooltip(label, { direction: "top", className: "explorer-tooltip" });
          marker.on("click", () => callbacks.current.onReport(report, cluster.reports));
        }
      }
      const nextScope = `${province}/${municipality}`;
      if (scope.current !== nextScope) {
        scope.current = nextScope;
        if (province === "94" && !municipality) instance.fitBounds([[-55.5, -69], [-52.5, -63]], { padding: [35, 35] });
        else if (target) instance.fitBounds(target.getBounds(), { padding: [40, 40], maxZoom: municipality ? 13 : 9 });
        else instance.fitBounds(countryBounds, { padding: [16, 16] });
      }
    });
    return () => { disposed = true; };
  }, [data, geography, municipality, province, ready, zoom]);
  return <div className="incident-map-wrap">
    <div ref={container} className="incident-map" aria-label="Mapa interactivo de incidentes de ReportAR" />
    <div className="map-tools" aria-label="Controles del mapa">
      <button type="button" onClick={() => map.current?.zoomIn()} aria-label="Acercar mapa">+</button>
      <button type="button" onClick={() => map.current?.zoomOut()} aria-label="Alejar mapa">−</button>
      <button type="button" onClick={() => { callbacks.current.onTerritory(""); map.current?.fitBounds(countryBounds, { padding: [16, 16] }); }} aria-label="Ver toda Argentina"><MapIcon kind="layers" size={18}/></button>
    </div>
    <div className="map-hint"><span className="map-hint-dot" />{province ? "Elegí un municipio o un incidente" : "Elegí una provincia para explorar"}</div>
    {!geography && !error && <div className="map-loading" role="status">Cargando mapa de Argentina…</div>}
    {error && <div className="map-message" role="alert">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div>}
    <div className="map-legend"><span className="map-legend-scale"/>Menos <span aria-hidden="true">—</span> Más incidentes</div>
  </div>;
}
