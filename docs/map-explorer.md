# Explorador público de ReportAR

## Dirección visual

Un atlas de incidentes: el mapa ocupa el centro de la portada y el panel lateral permite pasar de país a provincia y municipio. Encabezado breve, alineado a izquierda; controles y conteos siempre junto al mapa; fotos reales en una galería debajo.

Paleta: tinta #173735, verde ReportAR #116D63, agua #E7EEF0, papel #FFFFFF, coral #E86F50, resuelto #188246. Public Sans mantiene la identidad y una escala de títulos compacta deja protagonismo a los datos. El color de categoría identifica los puntos; el verde de estado identifica las resoluciones.

Revisión: se conserva el hero y su ilustración; el explorador se integra inmediatamente debajo con los mismos colores, bordes y tipografía. No se agregan cifras de ejemplo, una sección hero de altura completa ni tarjetas de métricas desligadas del mapa. Los contornos y las fotos son el elemento visual principal.

## Datos y precisión

- Reportes y conteos: `citizen_reports` en Neon, proyección pública explícita. Nunca se envían identificadores de Telegram, claves de almacenamiento o tokens de carga.
- Geometrías: GeoRef / IGN, descargadas de https://apis.datos.gob.ar/georef/api/provincias.geojson y https://apis.datos.gob.ar/georef/api/municipios.geojson. Copia local para no depender de la API en cada visita. Los municipios se cargan por provincia.
- Jurisdicción: punto dentro del polígono oficial; como alternativa, coincidencia exacta de municipio y provincia en la dirección. No se atribuyen reclamos a la ciudad más cercana ni se interpreta una provincia como su capital.
- Reportes sin jurisdicción identificable: incluidos en el total nacional y la galería, indicados por separado. Los que no tienen coordenadas no se representan mediante puntos ficticios.
- Ciudad Autónoma de Buenos Aires: distrito propio; no se inventan municipios donde el catálogo no los incluye.
- Conteos de todas las filas coincidentes, galería paginada de 9 y hasta 400 ubicaciones recientes por vista, con aviso explícito cuando se supera ese límite.
- Caché de consulta de 30 segundos; caché HTTP corta. No se promete actualización en tiempo real.
- Municipios y localidades no son equivalentes. El explorador usa jurisdicciones municipales; el formulario de dirección conserva su catálogo de localidades.

Regeneración de geometrías: `python3 scripts/import-map-geography.py`. Las geometrías se redondean a 5 decimales, sin simplificar contornos.
