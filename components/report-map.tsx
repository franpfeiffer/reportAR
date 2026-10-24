"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";

export type MapPoint = { latitude: number; longitude: number; label?: string };
export function ReportMap({ points, onSelect }: {points: MapPoint[]; onSelect?: (point: MapPoint) => void}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layers = useRef<LayerGroup | null>(null);
  const select = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    import("leaflet").then(L => {
      if (disposed || !container.current) return;
      const instance = L.map(container.current, { scrollWheelZoom: false }).setView([-31.4201, -64.1888], 12);
      map.current = instance;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(instance);
      layers.current = L.layerGroup().addTo(instance);
      instance.on("click", event => select.current?.({latitude: event.latlng.lat, longitude: event.latlng.lng}));
      resize = new ResizeObserver(() => instance.invalidateSize());
      resize.observe(container.current);
      setReady(true);
    }).catch(() => setError("No pudimos cargar el mapa. Podés indicar la dirección por escrito."));
    return () => { disposed = true; resize?.disconnect(); map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    import("leaflet").then(L => {
      if (disposed || !map.current || !layers.current) return;
      layers.current.clearLayers();
      for (const point of points) {
        const marker = L.circleMarker([point.latitude, point.longitude], {radius: 9, color: "#6366f1", fillOpacity: 0.85}).addTo(layers.current);
        if (point.label) { const label = document.createElement("span"); label.textContent = point.label; marker.bindTooltip(label); }
      }
      if (points.length) map.current.fitBounds(L.latLngBounds(points.map(p => [p.latitude,p.longitude])), {maxZoom: 16, padding: [30,30]});
    });
    return () => {disposed = true;};
  }, [points, ready]);
  return <div><div ref={container} aria-label={onSelect ? "Mapa: seleccioná la ubicación del problema" : "Mapa de reclamos"} className="relative z-0 h-72 w-full overflow-hidden rounded-xl border border-zinc-700" />{error && <p role="alert" className="mt-2 text-sm text-amber-600">{error}</p>}</div>;
}
