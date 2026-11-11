"use client";
import { useEffect, useRef } from "react";

export type MapPoint = { latitude: number; longitude: number; label?: string };

export function ReportMap({ points, className = "" }: { points: MapPoint[]; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    import("leaflet").then(L => {
      if (disposed || !container.current || !points.length) return;
      const map = L.map(container.current, { scrollWheelZoom: false });
      // Argenmap (IGN) is TMS; its dark layer follows the site theme.
      const tilesUrl = () => `https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/${document.documentElement.dataset.theme === "dark" ? "argenmap_oscuro" : "capabaseargenmap"}@EPSG%3A3857@png/{z}/{x}/{y}.png`;
      const tiles = L.tileLayer(tilesUrl(), { tms: true, maxZoom: 18, attribution: '<a href="https://www.ign.gob.ar/">Argenmap - IGN</a>' }).addTo(map);
      const theme = new MutationObserver(() => tiles.setUrl(tilesUrl()));
      theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      for (const point of points) {
        const marker = L.circleMarker([point.latitude, point.longitude], { radius: 7, weight: 2, color: "#ffffff", fillColor: "#116d63", fillOpacity: 0.95 }).addTo(map);
        if (point.label) { const label = document.createElement("span"); label.textContent = point.label; marker.bindTooltip(label); }
      }
      const bounds = L.latLngBounds(points.map(p => [p.latitude, p.longitude]));
      // Refit whenever the frame resizes (first layout, sidebar collapse) until the user moves the map.
      let touched = false;
      map.on("dragstart zoomstart", event => { if ((event as { originalEvent?: Event }).originalEvent) touched = true; });
      const fit = () => { map.invalidateSize(); if (!touched) map.fitBounds(bounds, { maxZoom: 15, padding: [24, 24] }); };
      fit();
      const resize = new ResizeObserver(fit);
      resize.observe(container.current);
      cleanup = () => { resize.disconnect(); theme.disconnect(); map.remove(); };
    }).catch(() => undefined);
    return () => { disposed = true; cleanup?.(); };
  }, [points]);
  return <div ref={container} aria-label="Mapa de reclamos" className={`map-frame ${className}`} />;
}
