# Bot municipal · MVP n8n

## Levantar n8n local con Docker (Ubuntu)

```sh
bash scripts/setup-local-n8n.sh
```

El script solicita la contraseña de administrador en tu terminal, instala `docker.io` y `docker-compose-v2` si faltan, inicia el daemon y espera que n8n esté listo en http://localhost:5678. Usa la imagen oficial `n8nio/n8n:2.44.6` y un volumen persistente para SQLite, credenciales y clave de cifrado. El puerto solo se publica en localhost. Creá tu cuenta de propietario en el primer inicio.

Comandos desde esta carpeta:

```sh
sudo docker compose ps
sudo docker compose logs --tail=100 n8n
sudo docker compose stop
sudo docker compose up -d --wait
```

No ejecutar `docker compose down -v` si querés conservar los datos. Para recibir mensajes de Telegram hará falta configurar un túnel HTTPS público y `WEBHOOK_URL`; el editor local por sí solo no recibe webhooks externos.

## Importar el flujo

Importar `n8n/reportes-municipales.json` desde **Import from File** en n8n. El archivo histórico `reportes-municipales-mock.json` es solo demostrativo y no debe activarse.

1. Crear un bot en Telegram con **@BotFather** y guardar su token en una credencial Telegram de n8n.
2. Seleccionar esa credencial en **Telegram Trigger**, **Responder por Telegram**, **Explicar como reportar** y **Enviar plantilla para copiar**.
3. Tener n8n accesible mediante HTTPS público para recibir el webhook.
4. Ejecutar la prueba del workflow y escribir `/start` al bot por chat privado. Para uso continuo, publicar/activar el workflow según la versión instalada. No usar simultáneamente el webhook de prueba y el de producción con el mismo bot.
5. Enviar un reporte de ejemplo:

El bot responde a `/start`, `/plantilla`, `/reportar`, `/ayuda`, saludos o mensajes que no sean reportes válidos con **dos mensajes consecutivos**: instrucciones y una plantilla en bloque de texto para copiar. Reemplazar los corchetes y conservar las etiquetas:

```text
Categoría: [tipo de problema]
Descripción: [contá qué está pasando]
Dirección: [calle, altura o esquina y localidad]
```

Los campos incompletos no generan un reporte. También sigue aceptando el formato anterior con separadores `|`.

```text
bache | Pozo grande en la esquina | San Martín 123
```

Categorías: `bache`, `inundacion`, `alumbrado`, `basura`, `arbolado`, `otro`. También se admite una foto individual adjunta al mismo mensaje que lleva ese texto como descripción. La dirección es texto libre: no hay validación geográfica. Los álbumes, imágenes enviadas como documento, audio, GPS y seguimiento de estados quedan fuera de este MVP.

El workflow de persistencia confirma el número solo después de recibir `status: received` de reportAR. Si la foto queda pendiente, el bot lo informa; no afirma que el reclamo se envió al municipio. n8n puede guardar el contenido en el historial de ejecuciones. Usar datos ficticios.

## Endpoint de reportAR

El nodo **Guardar reporte** envía el reporte a `POST /api/bot/reports` con Bearer e idempotencia. Su entrada contiene `report`, el JSON que se envía a reportAR. reportAR descarga la foto de Telegram y la guarda en el bucket privado Neon; la página de seguimiento la entrega a través de una ruta del servidor.

`src/mock-api.js` es un servidor local opcional con persistencia en archivo para una siguiente prueba de integración; el workflow entregado no lo llama. Ejecutarlo con `REPORTS_API_TOKEN` definido mediante `npm start`. Escucha únicamente en localhost. No es un backend de producción.

## Desarrollo

Node.js 22 o superior, sin dependencias externas:

```sh
npm run build:workflow
npm test
```

Las pruebas verifican validación, código embebido, confirmación simulada y conexiones. La importación y recepción real requieren una instancia n8n y un token Telegram; no se probaron contra servicios reales.

Referencias: [Telegram en n8n](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.telegram/), [Telegram Bot API](https://core.telegram.org/bots/api).


## Persistencia real con reportAR

El workflow listo para conectar es `n8n/reportes-municipales.json` (generado por `npm run build:workflow`). El archivo histórico `reportes-municipales-mock.json` es solo demostrativo y no debe activarse para persistencia.

1. Desplegar reportAR en Vercel con DATABASE_URL y REPORTS_API_TOKEN configurados del lado servidor. El token generado está en el `.env` ignorado de la app; no pegarlo en el JSON del workflow ni en Git.
2. Importar el workflow nuevo en n8n. En Guardar reporte, establecer la URL HTTPS completa `https://<dominio-vercel>/api/bot/reports`. La expresión inicial usa `$vars.REPORTAR_API_URL` sin barra final; si la edición de n8n no admite Variables, reemplazarla directamente por la URL completa.
3. Crear una credencial Header Auth: nombre `Authorization`, valor `Bearer <REPORTS_API_TOKEN>`. Seleccionarla en Guardar reporte. Configurar la misma credencial Telegram en todos los nodos Telegram.
4. Desactivar el workflow anterior y activar el nuevo únicamente con URL y credenciales reales. Telegram admite un único webhook por bot.
5. Enviar un reclamo de prueba y comprobar su ID en `/reclamo/<id>` y en administración. Reejecutar el mismo payload debe devolver el mismo ID. Un mensaje nuevo de Telegram tiene otro external_id y crea otro reclamo.

El workflow reintenta hasta tres veces guardar la foto, siempre con la misma clave de idempotencia. El reporte se conserva aunque Telegram o Neon no permitan adjuntar la imagen; en ese caso el bot confirma el número e informa que la foto quedó pendiente. La ayuda y los mensajes incompletos no se persisten. No se confirma envío al municipio.

El bot usa POST `/api/bot/reports`, Authorization Bearer y el header Idempotency-Key igual a `report.external_id`. El endpoint local `src/mock-api.js` sigue siendo una herramienta de desarrollo y no es el endpoint publicado. No activar el workflow generado sin completar la configuración.

La app clasifica los reportes web y de Telegram con TypeSafe/JEV en el servidor. El clasificador recibe la descripción y la categoría declarada, sin dirección, fotos ni identificadores. Si la probabilidad de la categoría principal es menor que 0.70 o el servicio no responde, el reporte se conserva y queda para revisión municipal.
