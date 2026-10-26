import catalog from "./catalog.json";
import { municipalityBoundaries, provinceBoundaries } from "./boundaries";
import type { Boundary } from "./types";

export const normalizePlace = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const aliases: Record<string, string> = { caba: "02", "capital federal": "02", "ciudad de buenos aires": "02", "tierra del fuego": "94" };
const provinceNames = new Map(catalog.provinces.map(p => [normalizePlace(p.name), p.id]));
const boxes = new WeakMap<Boundary, number[]>();
function bounds(feature: Boundary) {
  const cached = boxes.get(feature);
  if (cached) return cached;
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of polygons) for (const ring of polygon) for (const [x, y] of ring) {
    box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
  }
  boxes.set(feature, box);
  return box;
}
function inRing(x: number, y: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function containsPoint(feature: Boundary, latitude: number, longitude: number) {
  const [west, south, east, north] = bounds(feature);
  if (longitude < west || longitude > east || latitude < south || latitude > north) return false;
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return polygons.some(rings => inRing(longitude, latitude, rings[0]) && !rings.slice(1).some(ring => inRing(longitude, latitude, ring)));
}

/** Coordinates determine jurisdiction. Only exact, province-scoped address names are a fallback. */
export function resolveTerritory(report: { address: string; latitude: number | null; longitude: number | null }) {
  const parts = report.address.split(",").map(normalizePlace).filter(Boolean).filter(p => p !== "argentina");
  const textProvince = provinceNames.get(parts.at(-1) || "") || aliases[parts.at(-1) || ""];
  const hasPoint = report.latitude !== null && report.longitude !== null && Number.isFinite(report.latitude) && Number.isFinite(report.longitude);
  const spatialProvince = hasPoint ? provinceBoundaries.features.find(p => containsPoint(p, report.latitude!, report.longitude!))?.properties.id : undefined;
  const provinceId = spatialProvince || textProvince || null;
  if (!provinceId) return { provinceId: null, municipalityId: null };
  const municipalities = municipalityBoundaries[provinceId]?.features ?? [];
  const spatialMunicipality = hasPoint ? municipalities.find(m => containsPoint(m, report.latitude!, report.longitude!))?.properties.id : undefined;
  // Never assume that a province name on its own identifies its capital city.
  const cityParts = textProvince === provinceId ? parts.slice(1, -1) : [];
  const exact = municipalities.filter(m => cityParts.includes(normalizePlace(m.properties.name)));
  return { provinceId, municipalityId: spatialMunicipality || (exact.length === 1 ? exact[0].properties.id : null) };
}
