"""Import official GeoRef boundaries. Run with python3 scripts/import-map-geography.py.
Source: https://apis.datos.gob.ar/georef/api/{provincias,municipios}.geojson
Keep original geometries; strip unused metadata and round coordinates to 5 decimals.
"""
import json
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
def coordinates(value):
    if isinstance(value, list):
        return [coordinates(item) for item in value]
    return round(value, 5)
def convert(feature):
    props = feature['properties']
    geom = feature['geometry']
    return {'type': 'Feature', 'properties': {
        'id': props['id'], 'name': props['nombre'],
        'provinceId': props.get('provincia', {}).get('id', props['id']),
        'center': [props['centroide']['lat'], props['centroide']['lon']],
    }, 'geometry': {'type': geom['type'], 'coordinates': coordinates(geom['coordinates'])}}
def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
def read(resource):
    return json.loads(subprocess.check_output(['curl', '--fail', '--location', '--silent', '--show-error', '--max-time', '60', 'https://apis.datos.gob.ar/georef/api/' + resource + '.geojson']))
provinces = [convert(f) for f in read('provincias')['features']]
municipalities = [convert(f) for f in read('municipios')['features']]
write(root / 'public/geography/provinces.json', {'type': 'FeatureCollection', 'features': provinces})
for p in provinces:
    write(root / ('public/geography/municipalities/' + p['properties']['id'] + '.json'), {
        'type': 'FeatureCollection', 'features': [f for f in municipalities if f['properties']['provinceId'] == p['properties']['id']]})
write(root / 'lib/geography/catalog.json', {
    'provinces': [f['properties'] for f in provinces],
    'municipalities': [f['properties'] for f in municipalities],
})
print(f'Imported {len(provinces)} provinces and {len(municipalities)} municipalities.')

write(root / 'lib/geography/provinces.json', [f['properties'] for f in provinces])
with (root / 'lib/geography/boundaries.ts').open('w') as output:
    output.write('import type { BoundaryCollection } from "./types";\nimport provinces from "../../public/geography/provinces.json";\n')
    for p in provinces:
        code = p['properties']['id']
        output.write(f'import municipalities{code} from "../../public/geography/municipalities/{code}.json";\n')
    output.write('\nexport const provinceBoundaries = provinces as BoundaryCollection;\nexport const municipalityBoundaries = {\n')
    for p in provinces:
        code = p['properties']['id']
        output.write(f'  "{code}": municipalities{code} as BoundaryCollection,\n')
    output.write('} as Record<string, BoundaryCollection>;\n')
