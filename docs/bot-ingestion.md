# Persistencia del bot

`POST /api/bot/reports` recibe el JSON generado por Bot-reportar. No requiere una sesión ciudadana: usa `Authorization: Bearer <REPORTS_API_TOKEN>` y `Idempotency-Key: <external_id>`. El secreto se genera en `.env` local ignorado por Git; configurar el mismo valor como variable de servidor en Vercel y en una credencial Header Auth de n8n. No usar prefijos NEXT_PUBLIC para secretos.

Respuesta sin foto: `{ "id": "<public_id>", "status": "received" }`. Con foto agrega `photo_status: "stored" | "failed"`. Una reentrega vuelve a intentar la foto si todavía no quedó guardada. Creación: 201; reentrega: 200, con el mismo ID incluso si el reclamo ya fue resuelto. El seguimiento está en `/reclamo/<id>` y el panel administrativo incluye los reportes con origen TELEGRAM. Los identificadores de Telegram no se publican en esas vistas.

```json
{
  "source": "telegram",
  "external_id": "telegram:123:42",
  "category": "inundacion",
  "description": "Hay agua acumulada en la esquina",
  "address": "Belgrano 123, Córdoba",
  "reporter": { "telegram_user_id": "456", "telegram_chat_id": "123" },
  "photo": { "telegram_file_id": "referencia-de-telegram" },
  "reported_at": "2026-10-24T12:00:00Z"
}
```

`photo` puede ser null u omitirse. El bot solo envía una foto adjunta al mismo mensaje que contiene el reclamo; álbumes e imágenes enviadas como documentos quedan fuera de esta versión. Cuando existe `telegram_file_id`, reportAR lo descarga y guarda la imagen en el bucket privado `report-images`; la página de seguimiento la sirve mediante el endpoint de fotos. Las descargas están limitadas a 20 MB y se valida tipo y formato real. Si falla la operación de foto, el reclamo permanece guardado y la respuesta lleva `photo_status: "failed"`. Categorías: bache, inundacion, alumbrado, basura, arbolado, otro. Descripción: 10–2000 caracteres; dirección: 5–300. Límite del cuerpo: 20.000 bytes, también sin Content-Length. Errores: 401 sin autorización; 400 JSON inválido; 422 validación o idempotencia inválida; 413 cuerpo excesivo; 503 configuración ausente o fallo de persistencia. No registrar tokens ni payloads en logs.

## Base

Migración versionada: `drizzle/0005_bot_reports.sql`. Aplicada primero en `dev-bot-persistence` (`br-falling-grass-b6uokwje`) y después en production. El enum debe confirmarse antes de insertar INUNDACION. La restricción única permite reportes WEB con external_id null y resuelve reintentos concurrentes sin sobreescribir contenido o estado.

## Bucket privado creado

- Proyecto: reportAR-storage (`steep-hill-04074866`), aws-us-east-1.
- Rama: production (`br-billowing-firefly-b7dfmibk`).
- Bucket: report-images, acceso privado.
- Endpoint S3: https://br-billowing-firefly-b7dfmibk.storage.c-13.us-east-1.aws.neon.tech
- Credencial de servidor con storage:read y storage:write, guardada en `.env` ignorado.

Variables de servidor en Vercel: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION, REPORT_IMAGES_BUCKET y TELEGRAM_BOT_TOKEN. El SDK S3 usa direccionamiento path-style (`forcePathStyle: true`). No exponer credenciales ni guardar URLs firmadas en la base.

La configuración declarativa está en `infrastructure/storage/neon.ts`, deliberadamente separada del neon.ts principal: Object Storage no está disponible en São Paulo y ambos proyectos tienen ramas independientes. No aplicar esa configuración al proyecto de base/Auth ni reutilizarlo para Pixly.

Se verificó carga/lectura autenticada de un archivo temporal y se retiró. No se requiere storage para guardar reportes.

## Conectar n8n después del despliegue

Importar `integrations/telegram-bot/n8n/reportes-municipales.json` de este repositorio. Configurar URL HTTPS de Vercel y credencial Header Auth antes de publicar. El workflow queda inactivo en el archivo para evitar registrar un webhook sin configuración. No mantener dos workflows activos para el mismo bot. Ver instrucciones en `integrations/telegram-bot/README.md`.

## Validación

`pnpm test:bot`, `pnpm exec tsc --noEmit` (después de `pnpm exec next typegen`) y build de Next.js. Prueba de integración en rama aislada: ocho solicitudes simultáneas producen una fila, un 201 y siete 200; conservan referencia de foto y estado RESUELTO ante reentrega. También se verificó inserción WEB con los valores por defecto.

Prueba de integración reproducible: con DATABASE_URL de la rama aislada, ejecutar `REPORTAR_TEST_BRANCH=dev-bot-persistence node tests/bot-integration.cjs`. Crea datos sintéticos únicamente en esa rama; no ejecutarla contra producción.

## Walkthrough para el agente de n8n

### Configuración del HTTP Request

- Método: POST.
- URL: `https://<dominio-real-de-reportAR>/api/bot/reports`.
- Authentication: Generic Credential Type → Header Auth.
- Credencial: Name `Authorization`; Value `Bearer <REPORTS_API_TOKEN>`.
- Header adicional: `Idempotency-Key` = `{{ $json.report.external_id }}`.
- Body Content Type: JSON; Specify Body: Using JSON; valor `{{ $json.report }}`.
- Content-Type: application/json. No enviar multipart, bytes de imagen ni el update completo de Telegram.
- Timeout: 30 segundos. Reintentar hasta 3 veces manteniendo exactamente external_id y cuerpo; espera de 1 segundo entre intentos.
- On Error: Continue using error output. Conectar esa salida a una respuesta de error, nunca a la confirmación de éxito.

El JSON del ejemplo anterior es el cuerpo completo. `source` debe ser exactamente `telegram`; las categorías deben ir en minúscula y sin acentos. No usar el endpoint `/api/reports`, reservado para el formulario web.

### Mapeo de Telegram y validación exacta

| Campo | Valor y restricciones |
| --- | --- |
| source | String literal `telegram`, obligatorio. |
| external_id | `telegram:<message.chat.id>:<message.message_id>`; regex `^telegram:-?\d+:\d+$`; máximo 150 caracteres. |
| category | `bache`, `inundacion`, `alumbrado`, `basura`, `arbolado` u `otro`. |
| description | String; mínimo 10 caracteres después de trim, máximo 2000 antes de trim; se guarda con trim. |
| address | String; mínimo 5 caracteres después de trim, máximo 300 antes de trim; se guarda con trim. |
| reporter.telegram_user_id | `String(message.from.id)`; entre 1 y 30 dígitos, sin signo. |
| reporter.telegram_chat_id | `String(message.chat.id)`; entre 1 y 30 dígitos, signo negativo opcional. Debe coincidir exactamente con el chat de external_id. |
| reported_at | String de fecha válido para Date.parse; enviar ISO 8601 UTC a partir de `new Date(message.date * 1000).toISOString()`. |
| photo | Omitido, null, o un objeto con telegram_file_id. |
| photo.telegram_file_id | String no vacío después de trim, máximo 1024 caracteres; tomar la última variante de `message.photo`. Se conserva la referencia original. |

No generar un external_id aleatorio ni uno nuevo en cada reintento. Reejecutar el mismo evento es idempotente; reenviarlo en Telegram genera otro message_id y otro reporte. El servidor no exige coordenadas ni nombre/email. El parser actual solo procesa chats privados, ignora bots y responde con ayuda a mensajes incompletos; esos mensajes no se envían a persistencia.

### Procesar la respuesta

Creación: HTTP 201. Duplicado: HTTP 200. Sin foto:

```json
{ "id": "12345678-1234-4123-8123-123456789012", "status": "received" }
```

`photo_status` vale `stored` o `failed` cuando el JSON incluye una foto. `id` es el UUID público del reclamo, apto para el enlace `https://<dominio-real>/reclamo/<id>`. `status: received` confirma persistencia del reclamo; no representa el estado municipal actual. Un duplicado puede corresponder a un reclamo RESUELTO y seguir devolviendo received. El reintento no modifica el contenido ni el estado existente; si la foto aún falta, vuelve a intentar adjuntarla.

Confirmar el reclamo solo con HTTP 200/201, id UUID válido y status received. Si el reporte tenía foto, confirmar la foto solo con `photo_status: stored`. El workflow repite el POST hasta tres veces cuando `photo_status` es `failed`, conservando body e `Idempotency-Key`; tras el tercer fallo confirma el reclamo e informa que la foto quedó pendiente. Conservar chat_id y datos del reporte desde el nodo Validar reporte: el HTTP Request devuelve solo la respuesta. El workflow usa `$("Validar reporte").itemMatching(i).json` para recuperar el item correspondiente; evitar first() al manejar varios items.

Con `photo_status: stored`, el texto confirma que la foto quedó adjunta y disponible en seguimiento. Con `photo_status: failed`, confirma el número del reclamo y aclara que la foto quedó pendiente. Escapar &, < y > si se usa parse_mode HTML en Telegram. Si falla la API o su respuesta es inválida: “No pudimos confirmar el guardado”. Un timeout puede ocurrir después del insert; por eso no afirmar que no se guardó.

### Errores exactos

| HTTP | Cuerpo JSON | Acción n8n |
| --- | --- | --- |
| 400 | {"error":"invalid_json"} | Corregir serialización; no confirmar. |
| 401 | {"error":"unauthorized"} | Revisar credencial Bearer; no confirmar. |
| 413 | {"error":"payload_too_large"} | Reducir cuerpo; límite total 20.000 bytes. |
| 422 | {"error":"invalid_report"} | Revisar campos/tipos/límites; no confirmar. |
| 422 | {"error":"invalid_idempotency_key"} | Igualar header a external_id. |
| 503 | {"error":"service_unavailable"} | Falta REPORTS_API_TOKEN del lado de reportAR. |
| 503 | {"error":"persistence_failed"} | Reintentar el mismo evento con la misma clave. |

Una URL incorrecta, proxy o protección de despliegue puede devolver otros códigos o HTML: tratarlos como fallo, sin confirmación. El token debe configurarse en el entorno de Vercel que atiende esa URL; no confundirlo con TELEGRAM_BOT_TOKEN ni con credenciales Neon.

### Checklist de integración

1. Desplegar master de reportAR en Vercel; configurar DATABASE_URL y REPORTS_API_TOKEN como secretos de servidor. La migración ya se aplicó a la base production de São Paulo.
2. Completar URL real y Header Auth en el workflow nuevo; conservar las credenciales Telegram existentes. No cambiar el webhook a un segundo workflow activo.
3. Enviar texto válido: comprobar 201, confirmación con UUID y presencia en administración/seguimiento.
4. Reejecutar el mismo payload/clave: comprobar 200 y el mismo UUID, sin fila adicional.
5. Enviar una foto con caption válido: comprobar `photo_status: "stored"`, que aparezca en el seguimiento y que la descarga use la ruta de reportAR.
6. Forzar un fallo temporal de Telegram o Neon: verificar que el reclamo siga guardado, que n8n reintente con la misma clave y que, tras tres intentos, informe que la foto quedó pendiente.
7. Probar credencial incorrecta y fallo de base: comprobar ausencia de confirmación de éxito.
8. Publicar el workflow solo después de completar estas configuraciones. Los accesos al bucket no son necesarios en n8n.

## Código del bot en este repositorio

El bot y el workflow están en `integrations/telegram-bot/`. Ejecutar `npm --prefix integrations/telegram-bot test` para las pruebas y `npm --prefix integrations/telegram-bot run build:workflow` para regenerar el JSON. El paquete se mantiene fuera del workspace `packages/*` de la app. El endpoint mock sigue siendo solo local; no desplegarlo en Vercel.

## Criticidad de reparación con JEV

El servidor evalúa la urgencia tanto para reportes web como de Telegram y conserva la categoría declarada. Solo envía a TypeSafe la descripción y la categoría. Con probabilidad de urgencia ≥ 0,70 asigna `URGENTE`; con probabilidad ≤ 0,30 asigna `NO_URGENTE`. Los valores intermedios o fallos del proveedor quedan pendientes de revisión municipal. Los reintentos de Telegram no vuelven a clasificar el reporte.

Aplicar `drizzle/0009_jev_urgency_classification.sql` antes de desplegar el código de criticidad. La migración agrega los campos de urgencia y marca los reportes existentes para revisión. `TYPESAFE_API_KEY` se configura únicamente en el servidor de reportAR.
