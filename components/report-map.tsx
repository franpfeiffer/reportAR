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
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
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
      cleanup = () => { resize.disconnect(); map.remove(); };
    }).catch(() => undefined);
    return () => { disposed = true; cleanup?.(); };
  }, [points]);
  return <div ref={container} aria-label="Mapa de reclamos" className={`map-frame ${className}`} />;
}
