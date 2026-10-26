"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSON as GeoJSONData, FeatureCollection } from "geojson";
import type { Map as MapLibreMap, Marker as MapLibreMarker, Popup as MapLibrePopup, GeoJSONSource } from "maplibre-gl";
import type { Boundary, BoundaryCollection } from "@/lib/geography/types";
import type { ExplorerData, ExplorerReport, TerritoryCount } from "@/lib/reports/explorer-types";
import { categoryLabels } from "@/lib/reports/validation";
import { categoryColors, MapIcon } from "./icons";

const countryBounds: [[number, number], [number, number]] = [[-74, -55.8], [-53.5, -21.5]];
const boundaryCache = new Map<string, BoundaryCollection>();
const emptyCollection: FeatureCollection = { type: "FeatureCollection", features: [] };

async function getBoundaries(path: string, signal: AbortSignal) {
  const existing = boundaryCache.get(path);
  if (existing) return existing;
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error("No se pudo cargar la cartografía.");
  const data = await response.json() as BoundaryCollection;
  boundaryCache.set(path, data);
  return data;
}

function boundsFor(feature: Boundary): [[number, number], [number, number]] | null {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  let found = false;
  const collect = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      west = Math.min(west, value[0]);
      south = Math.min(south, value[1]);
      east = Math.max(east, value[0]);
      north = Math.max(north, value[1]);
      found = true;
    }
    else value.forEach(collect);
  };
  collect(feature.geometry.coordinates);
  return found ? [[west, south], [east, north]] : null;
}

function makeTerritoryData(geography: BoundaryCollection, counts: TerritoryCount[], province: string, municipality: string) {
  const countById = new Map(counts.map(item => [item.id, item.count]));
  const maximum = Math.max(1, ...counts.map(item => item.count));
  return {
    type: "FeatureCollection" as const,
    features: geography.features.map(feature => {
      const id = feature.properties.id;
      const count = countById.get(id) ?? 0;
      const kind = province ? "municipality" : "province";
      return {
        type: "Feature" as const,
        id: `${kind}:${id}`,
        geometry: feature.geometry,
        properties: {
          ...feature.properties,
          mapId: `${kind}:${id}`,
          kind,
          count,
          intensity: Math.sqrt(count / maximum),
          selected: kind === "municipality" ? id === municipality : id === province,
          height: kind === "municipality" ? 1300 + Math.sqrt(count / maximum) * 5000 : 13000 + Math.sqrt(count / maximum) * 39000,
        },
      };
    }),
  };
}

function clusterPoints<T>(map: MapLibreMap, items: T[], position: (item: T) => [number, number], radius: number) {
  const clusters: { x: number; y: number; items: T[] }[] = [];
  const { clientWidth, clientHeight } = map.getCanvas();
  for (const item of items) {
    const [longitude, latitude] = position(item);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    const point = map.project([longitude, latitude]);
    if (point.x < -radius || point.y < -radius || point.x > clientWidth + radius || point.y > clientHeight + radius) continue;
    const existing = clusters.find(cluster => Math.hypot(cluster.x - point.x, cluster.y - point.y) < radius);
    if (existing) {
      const length = existing.items.length;
      existing.x = (existing.x * length + point.x) / (length + 1);
      existing.y = (existing.y * length + point.y) / (length + 1);
      existing.items.push(item);
    } else clusters.push({ x: point.x, y: point.y, items: [item] });
  }
  return clusters.map(cluster => ({
    items: cluster.items,
    position: map.unproject([cluster.x, cluster.y]).toArray() as [number, number],
  }));
}

function fillColorExpression(dark: boolean) {
  return [
    "case",
    ["boolean", ["get", "selected"], false], "#E86F50",
    ["==", ["get", "count"], 0], dark ? "#2A3933" : "#DFE9E2",
    ["interpolate", ["linear"], ["get", "intensity"], 0, dark ? "#477462" : "#A7CDB8", 1, dark ? "#A5D2B7" : "#286C60"],
  ] as never;
}

export function IncidentMap({ data, province, municipality, onTerritory, onReport }: {
  data: ExplorerData | null; province: string; municipality: string;
  onTerritory: (province: string, municipality?: string) => void; onReport: (report: ExplorerReport, nearby?: ExplorerReport[]) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const popup = useRef<MapLibrePopup | null>(null);
  const territoryMarkers = useRef<MapLibreMarker[]>([]);
  const reportMarkers = useRef<MapLibreMarker[]>([]);
  const scope = useRef("");
  const callbacks = useRef({ onTerritory, onReport });
  const view = useRef({ data, province, municipality, geography: null as { provinces: BoundaryCollection; municipalities: BoundaryCollection; province: string } | null });
  const renderMarkers = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [geography, setGeography] = useState<{ provinces: BoundaryCollection; municipalities: BoundaryCollection; province: string } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  view.current = { data, province, municipality, geography };

  useEffect(() => { callbacks.current = { onTerritory, onReport }; }, [onTerritory, onReport]);

  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    let themeObserver: MutationObserver | undefined;
    import("maplibre-gl").then(({ Map, Marker, Popup, AttributionControl, setWorkerUrl }) => {
      if (disposed || !container.current) return;
      setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
      const dark = document.documentElement.dataset.theme === "dark";
      const instance = new Map({
        container: container.current,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: "reportar-ground", type: "background", paint: { "background-color": dark ? "#17231F" : "#EAF0EC" } }],
        },
        center: [-63.5, -38.5], zoom: 3.25, pitch: 44, bearing: -12,
        minZoom: 2.4, maxZoom: 12.5, maxPitch: 58,
        attributionControl: false, scrollZoom: false, dragRotate: false,
      });
      map.current = instance;
      instance.addControl(new AttributionControl({ compact: true, customAttribution: '<a href="https://www.argentina.gob.ar/georef">Límites: GeoRef / IGN</a>' }), "bottom-right");

      const rebuildMarkers = () => {
        territoryMarkers.current.forEach(marker => marker.remove());
        reportMarkers.current.forEach(marker => marker.remove());
        territoryMarkers.current = [];
        reportMarkers.current = [];
        const current = view.current;
        const currentData = current.data;
        if (!currentData) return;

        const territories = current.province ? currentData.municipalities : currentData.provinces;
        const territoryGroups = clusterPoints(instance, territories.filter(item => item.count > 0), item => [item.center[1], item.center[0]], 42);
        for (const group of territoryGroups) {
          const total = group.items.reduce((sum, item) => sum + item.count, 0);
          const names = group.items.map(item => `${item.name}: ${item.count}`).join(" · ");
          const element = document.createElement("button");
          element.type = "button";
          element.className = "territory-map-count";
          element.textContent = total.toLocaleString("es-AR", { notation: "compact", maximumFractionDigits: 1 });
          element.title = names;
          element.setAttribute("aria-label", names);
          element.addEventListener("click", event => {
            event.stopPropagation();
            if (group.items.length === 1) {
              const territory = group.items[0];
              callbacks.current.onTerritory(current.province || territory.id, current.province ? territory.id : "");
            } else instance.easeTo({ center: group.position, zoom: Math.min(instance.getZoom() + 2.2, current.province ? 9 : 7), duration: 650 });
          });
          territoryMarkers.current.push(new Marker({ element, anchor: "center" }).setLngLat(group.position).addTo(instance));
        }

        if (current.province) {
          const reportGroups = clusterPoints(instance, currentData.markers.filter(report => report.latitude !== null && report.longitude !== null), report => [report.longitude!, report.latitude!], 34);
          for (const group of reportGroups) {
            const report = group.items[0];
            const multiple = group.items.length > 1;
            const element = document.createElement("button");
            element.type = "button";
            element.className = multiple ? "incident-map-cluster" : "incident-map-dot";
            if (!multiple) element.style.setProperty("--incident-color", report.status === "RESUELTO" ? "#188246" : categoryColors[report.category]);
            element.textContent = multiple ? String(group.items.length) : report.status === "RESUELTO" ? "✓" : "";
            element.title = multiple ? `${group.items.length} incidentes cercanos` : `${categoryLabels[report.category]}: ${report.address}`;
            element.setAttribute("aria-label", element.title);
            element.addEventListener("click", event => {
              event.stopPropagation();
              callbacks.current.onReport(report, group.items);
            });
            reportMarkers.current.push(new Marker({ element, anchor: "center" }).setLngLat(group.position).addTo(instance));
          }
        }
      };
      renderMarkers.current = rebuildMarkers;
      instance.on("moveend", rebuildMarkers);
      instance.on("zoomend", rebuildMarkers);

      instance.on("load", () => {
        instance.addSource("territories", { type: "geojson", data: emptyCollection, promoteId: "mapId" });
        instance.addLayer({
          id: "territory-extrusion", type: "fill-extrusion", source: "territories",
          paint: {
            "fill-extrusion-color": fillColorExpression(dark),
            "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 3, ["get", "height"], 7, ["*", ["get", "height"], 0.42], 11, ["*", ["get", "height"], 0.06], 13, ["*", ["get", "height"], 0.015]],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.96,
            "fill-extrusion-vertical-gradient": true,
          },
        });
        instance.addLayer({
          id: "territory-outlines", type: "line", source: "territories",
          paint: {
            "line-color": ["case", ["boolean", ["get", "selected"], false], "#E86F50", dark ? "#78988A" : "#FFFFFF"],
            "line-width": ["case", ["boolean", ["get", "selected"], false], 2.4, 1.2],
            "line-opacity": 0.95,
          },
        });
        instance.addLayer({
          id: "territory-hover", type: "line", source: "territories",
          filter: ["==", ["get", "mapId"], ""],
          paint: { "line-color": "#E86F50", "line-width": 3.2 },
        });
        instance.on("mouseenter", "territory-extrusion", () => { instance.getCanvas().style.cursor = "pointer"; });
        instance.on("mouseleave", "territory-extrusion", () => { instance.getCanvas().style.cursor = ""; popup.current?.remove(); });
        instance.on("mousemove", "territory-extrusion", event => {
          const feature = event.features?.[0];
          if (!feature) return;
          instance.setFilter("territory-hover", ["==", ["get", "mapId"], String(feature.properties?.mapId ?? "")]);
          const tooltip = document.createElement("div");
          tooltip.className = "explorer-tooltip";
          tooltip.textContent = `${String(feature.properties?.name ?? "Zona")} · ${Number(feature.properties?.count ?? 0).toLocaleString("es-AR")} incidentes`;
          if (!popup.current) popup.current = new Popup({ closeButton: false, closeOnClick: false, offset: 10, maxWidth: "260px" });
          popup.current.setLngLat(event.lngLat).setDOMContent(tooltip).addTo(instance);
        });
        instance.on("click", "territory-extrusion", event => {
          const feature = event.features?.[0];
          const id = String(feature?.properties?.id ?? "");
          if (feature?.properties?.kind === "municipality") callbacks.current.onTerritory(view.current.province, id);
          else if (id) callbacks.current.onTerritory(id);
        });
        instance.on("click", event => {
          if (!instance.queryRenderedFeatures(event.point, { layers: ["territory-extrusion"] }).length) popup.current?.remove();
        });

        const observer = new ResizeObserver(() => instance.resize());
        if (container.current) observer.observe(container.current);
        resize = observer;
        const themeObserverInstance = new MutationObserver(() => {
          const isDark = document.documentElement.dataset.theme === "dark";
          instance.setPaintProperty("reportar-ground", "background-color", isDark ? "#17231F" : "#EAF0EC");
          instance.setPaintProperty("territory-extrusion", "fill-extrusion-color", fillColorExpression(isDark));
          instance.setPaintProperty("territory-outlines", "line-color", ["case", ["boolean", ["get", "selected"], false], "#E86F50", isDark ? "#78988A" : "#FFFFFF"]);
          renderMarkers.current();
        });
        themeObserverInstance.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        themeObserver = themeObserverInstance;
        setReady(true);
      });
      instance.on("error", () => setError("No pudimos abrir el mapa. Usá la lista de zonas para explorar los reportes."));
    }).catch(() => setError("No pudimos abrir el mapa. Usá la lista de zonas para explorar los reportes."));
    return () => {
      disposed = true;
      resize?.disconnect();
      themeObserver?.disconnect();
      popup.current?.remove();
      territoryMarkers.current.forEach(marker => marker.remove());
      reportMarkers.current.forEach(marker => marker.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getBoundaries("/geography/provinces.json", controller.signal),
      province ? getBoundaries(`/geography/municipalities/${province}.json`, controller.signal) : Promise.resolve(emptyCollection as BoundaryCollection),
    ]).then(([provinces, municipalities]) => {
      if (controller.signal.aborted) return;
      setError("");
      setGeography({ provinces, municipalities, province });
    }).catch(() => { if (!controller.signal.aborted) setError("No pudimos cargar los límites del mapa. Podés seguir explorando desde la lista."); });
    return () => controller.abort();
  }, [province, retry]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !geography || geography.province !== province || !instance.isStyleLoaded()) return;
    const territories = province ? geography.municipalities : geography.provinces;
    const counts = province ? data?.municipalities ?? [] : data?.provinces ?? [];
    const source = instance.getSource("territories") as GeoJSONSource | undefined;
    source?.setData(makeTerritoryData(territories, counts, province, municipality) as GeoJSONData);

    const nextScope = `${province}/${municipality}`;
    if (scope.current !== nextScope) {
      scope.current = nextScope;
      const target = province
        ? municipality ? geography.municipalities.features.find(feature => feature.properties.id === municipality) : geography.provinces.features.find(feature => feature.properties.id === province)
        : null;
      const targetBounds = target ? boundsFor(target) : null;
      if (targetBounds) instance.fitBounds(targetBounds, { padding: { top: 42, right: 42, bottom: 42, left: 42 }, duration: 650, maxZoom: municipality ? 10.5 : 6.5 });
      else instance.fitBounds(countryBounds, { padding: { top: 25, right: 25, bottom: 25, left: 25 }, duration: 650, maxZoom: 4.2 });
    }
    renderMarkers.current();
  }, [data, geography, municipality, province, ready]);

  return <div className="incident-map-wrap">
    <div ref={container} className="incident-map" aria-label="Mapa interactivo de incidentes de ReportAR" />
    <div className="map-tools" aria-label="Controles del mapa">
      <button type="button" onClick={() => map.current?.zoomIn()} aria-label="Acercar mapa">+</button>
      <button type="button" onClick={() => map.current?.zoomOut()} aria-label="Alejar mapa">−</button>
      <button type="button" onClick={() => { callbacks.current.onTerritory(""); map.current?.fitBounds(countryBounds, { padding: { top: 25, right: 25, bottom: 25, left: 25 }, duration: 650, maxZoom: 4.2 }); }} aria-label="Ver toda Argentina"><MapIcon kind="layers" size={18}/></button>
    </div>
    <div className="map-hint"><span className="map-hint-dot" />{province ? "Elegí un municipio o un incidente" : "Elegí una provincia para explorar"}</div>
    {!geography && !error && <div className="map-loading" role="status">Cargando mapa de Argentina…</div>}
    {error && <div className="map-message" role="alert">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div>}
    <div className="map-legend"><span className="map-legend-scale"/>Menos <span aria-hidden="true">—</span> Más incidentes</div>
  </div>;
}
