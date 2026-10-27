export type LocatedReport = {
  id: string;
  address: string;
  category?: string;
  latitude: number | null;
  longitude: number | null;
};

export type ReportGroup<T> = {
  id: string;
  items: T[];
  count: number;
  latitude: number | null;
  longitude: number | null;
  match: "distance" | "address";
};

// 0.001 degrees covers 50 m in either axis across Argentina, including the south.
const CELL_SIZE = 0.001;
const normalizeAddress = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function distanceMeters(a: LocatedReport, b: LocatedReport) {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) return Number.POSITIVE_INFINITY;
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const lat1 = a.latitude * rad;
  const lat2 = b.latitude * rad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

/** Groups nearby submissions for display while retaining every report as an individual item. */
export function groupNearbyReports<T extends LocatedReport>(reports: T[], radiusMeters = 50): ReportGroup<T>[] {
  const groups: ReportGroup<T>[] = [];
  const coordinateCells = new Map<string, number[]>();
  const addressGroups = new Map<string, number>();

  for (const report of reports) {
    if (report.latitude === null || report.longitude === null) {
      const address = normalizeAddress(report.address);
      if (!address) {
        groups.push({ id: report.id, items: [report], count: 1, latitude: null, longitude: null, match: "address" });
        continue;
      }
      const key = `${report.category ?? ""}:${address}`;
      const existingIndex = addressGroups.get(key);
      if (existingIndex === undefined) {
        addressGroups.set(key, groups.length);
        groups.push({ id: report.id, items: [report], count: 1, latitude: null, longitude: null, match: "address" });
      } else {
        const group = groups[existingIndex];
        group.items.push(report);
        group.count++;
      }
      continue;
    }

    const cellLat = Math.floor(report.latitude / CELL_SIZE);
    const cellLon = Math.floor(report.longitude / CELL_SIZE);
    const candidates = new Set<number>();
    for (let latOffset = -1; latOffset <= 1; latOffset++) {
      for (let lonOffset = -1; lonOffset <= 1; lonOffset++) {
        const cell = coordinateCells.get(`${cellLat + latOffset}:${cellLon + lonOffset}`);
        cell?.forEach(index => candidates.add(index));
      }
    }

    const matching = [...candidates]
      .filter(index => groups[index].items.every(item => distanceMeters(report, item) <= radiusMeters))
      .sort((a, b) => distanceMeters(report, groups[a].items[0]) - distanceMeters(report, groups[b].items[0]))[0];

    let groupIndex = matching;
    if (groupIndex === undefined) {
      groupIndex = groups.length;
      groups.push({ id: report.id, items: [], count: 0, latitude: null, longitude: null, match: "distance" });
    }
    const group = groups[groupIndex];
    group.items.push(report);
    group.count++;
    group.latitude = group.items.reduce((sum, item) => sum + item.latitude!, 0) / group.count;
    group.longitude = group.items.reduce((sum, item) => sum + item.longitude!, 0) / group.count;
    const cellKey = `${cellLat}:${cellLon}`;
    const cell = coordinateCells.get(cellKey) ?? [];
    cell.push(groupIndex);
    coordinateCells.set(cellKey, cell);
  }

  return groups;
}
