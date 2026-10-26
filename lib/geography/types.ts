import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

export type Territory = { id: string; name: string; provinceId: string; center: number[] };
export type Boundary = Feature<Polygon | MultiPolygon, Territory>;
export type BoundaryCollection = FeatureCollection<Polygon | MultiPolygon, Territory>;
