/* eslint-disable @typescript-eslint/no-require-imports -- Test pure geography and aggregation without a database. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const exports = {}; cache.set(file, exports);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, require(name) {
    if (name === 'next/cache') return { cacheLife() {} };
    if (name === '@reportar/db') return {};
    if (name === '@reportar/db/schema') return { citizenReports: {} };
    if (name.startsWith('.') || name.startsWith('@/')) {
      const resolved = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(path.extname(resolved) ? resolved : `${resolved}.ts`);
    }
    return require(name);
  } }, { filename: file });
  return exports;
}
const { resolveTerritory, containsPoint } = load(path.join(root, 'lib/geography/resolve.ts'));
const { summarizeReports } = load(path.join(root, 'lib/reports/explorer.ts'));
const location = (address, latitude = null, longitude = null) => resolveTerritory({ address, latitude, longitude });
assert.equal(location('Córdoba 1900').provinceId, null, 'unqualified street must not invent a jurisdiction');
assert.equal(location('San Luis 2650, Santa Fe').provinceId, '82');
assert.equal(location('San Luis 2650, Santa Fe').municipalityId, null, 'province alone must not become its capital');
assert.equal(location('Urquiza 2293, Santa Fe, Santa Fe').municipalityId, '820147');
assert.equal(location('Aristóbulo 1443, Santo Tome, Santa Fe').municipalityId, '820154', 'accent-insensitive exact matching');
assert.equal(location('Rosario, Santa Fe', -32.9504615, -60.6386815).municipalityId, '820210');
assert.equal(location('Av. Corrientes 1500, CABA', -34.6044631, -58.39588).provinceId, '02');
assert.equal(location('Wrong city, Santa Fe', -34.6044631, -58.39588).provinceId, '02', 'coordinates take precedence');
assert.equal(location('Somewhere', 45, 3).provinceId, null, 'outside Argentina remains unassigned');
const shape = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[0,0],[10,0],[10,10],[0,10],[0,0]],[[2,2],[8,2],[8,8],[2,8],[2,2]]] } };
assert.equal(containsPoint(shape, 1, 1), true);
assert.equal(containsPoint(shape, 5, 5), false, 'polygon holes must be excluded');
const base = { address: 'Santa Fe', description: '', hasPhoto: false, displayablePhoto: false, createdAt: '2026-01-01T00:00:00Z' };
const reports = Array.from({ length: 503 }, (_, i) => ({ ...base, id: String(i), category: i % 2 ? 'BACHE' : 'BASURA', status: i % 3 ? 'RECIBIDO' : 'RESUELTO', provinceId: '82', municipalityId: '820147', latitude: -31.6476, longitude: -60.7137 }));
reports.push({ ...base, id: 'unknown', category: 'OTRO', status: 'EN_REVISION', provinceId: null, municipalityId: null, latitude: null, longitude: null });
const index = { reports, updatedAt: '2026-01-01T00:00:00Z' };
const all = summarizeReports(index, { page: 1 });
assert.equal(all.total, 504); assert.equal(all.markers.length, 400); assert.equal(all.located, 503);
assert.equal(all.unassigned, 1); assert.equal(all.reports.length, 9); assert.equal(all.pages, 56);
assert.equal(all.provinces.find(p => p.id === '82').count, 503, 'counts must include records beyond marker/card limits');
const filtered = summarizeReports(index, { province: '82', municipality: '820147', category: 'BACHE', status: 'RESUELTO', page: 999 });
const expected = reports.filter(r => r.provinceId === '82' && r.category === 'BACHE' && r.status === 'RESUELTO');
assert.equal(filtered.total, expected.length); assert.equal(filtered.page, filtered.pages);
assert.equal(filtered.categories.BACHE, expected.length);
assert.ok(filtered.categories.BASURA > 0, 'category facets exclude own filter');
assert.ok(filtered.statuses.RECIBIDO > 0, 'status facets exclude own filter');
assert.equal(filtered.municipalities.find(m => m.id === '820147').count, expected.length);
const empty = summarizeReports(index, { province: '14', page: 1 });
assert.equal(empty.total, 0); assert.equal(empty.pages, 1); assert.ok(empty.municipalities.length > 0);
console.log('Explorer checks passed: spatial attribution, holes, ambiguous addresses, CABA, filters, full counts, pagination, 400-marker limit, empty states.');
