# Formulario de reportAR con fotos en el mismo Blob de la web

Importar `reportes-formulario-demo.json`, entregado **inactivo**. Antes de activarlo, desplegar los cambios de `/api/bot/reports` que agregan `expectsPhoto` y `photoUploadToken`, y el ajuste de reintentos de `/api/reports/photo-upload`.

## Configuración

1. Credencial Telegram en **Telegram Trigger**, **Formulario de reclamo** y **Responder por Telegram**.
2. Header Auth en **Guardar reporte** y **Reconsultar mismo reclamo**: Name `Authorization`; Value `Bearer <REPORTS_API_TOKEN>`, igual al servidor. No poner el secreto en los parámetros ni en el export.
3. La URL de la app es `https://reportar-one.vercel.app`, fija por pedido del usuario. No usa `$vars`. El token de escritura de **Vercel Blob**, `BLOB_READ_WRITE_TOKEN`, queda solo en Vercel: debe ser el mismo store que usa la web. Este formulario no necesita credenciales AWS ni token de Telegram en reportAR.
4. n8n necesita su propia `WEBHOOK_URL` pública HTTPS. El enlace individual lo genera Send and Wait y vence a los 30 minutos. Desactivar el workflow anterior antes de activar esta variante.
5. Para archivos grandes, revisar los límites de subida de n8n y del proxy. El flujo valida un máximo de 100 MiB como la web; un límite menor de infraestructura puede rechazar la subida antes del workflow. Referencia: [límites de endpoints de n8n](https://docs.n8n.io/hosting/configuration/environment-variables/endpoints/).

## Uso

Escribir **hola** o `/reportar` → **Completar reclamo** → completar el formulario → volver al chat para recibir el número. Los campos son tipo de problema, descripción, provincia, localidad, calle y altura y foto opcional. La foto se carga **en el formulario**, aunque se haya enviado previamente por chat. Se admite un archivo original, incluidos HEIC/RAW, con el mismo criterio de la web.

Las seis categorías se conservan. Provincias se cargan desde la app y se serializan como opciones JSON ya resueltas. La localidad escrita se valida contra el catálogo de la provincia. Calle, localidad y provincia forman `address`, sin recortar campos. No se solicitan coordenadas porque el endpoint del bot no las guarda. No se confirma derivación a un organismo ni se inventan enlaces.

## Carga de foto

1. n8n conserva el binario y crea el reclamo con `expectsPhoto: true`, `photo: null` e idempotencia `telegram:<chat>:<mensaje>`.
2. reportAR devuelve el ID y `photoUploadToken`, como en su formulario web.
3. **Autorizar foto como la web** pide un token limitado al archivo a `/api/reports/photo-upload`.
4. **Subir al Blob de la web** hace PUT directo a Blob. Usa el protocolo del SDK de la app, API v13; no expone `BLOB_READ_WRITE_TOKEN` ni envía el archivo a Telegram.
5. **Vincular foto al reclamo** usa la ruta web `/api/reports/{id}/photo/attach` con `{ token, url }`.

Cada nodo HTTP tiene hasta tres intentos, incluidos los errores de autenticación. Los intentos conservan evento, cuerpo, clave y pathname. Una autorización de Blob dura diez minutos: para reintentar una ejecución antigua, volver a **Guardar reporte** con los datos originales y generar otra autorización antes del PUT.

Si falla la foto, se reconsulta el mismo reclamo con la misma clave para detectar una respuesta de adjunto perdida. El reclamo confirmado conserva su número y el bot informa que no pudo confirmar la foto. Si falla la creación, no se afirma guardado. El resultado conserva `retry_event` y un diagnóstico sin secretos; el detalle HTTP está en los nodos de ejecución. Los datos y el binario se retienen en el historial de n8n para la demo.

El flujo anterior de plantilla y foto vía Telegram se conserva como variante heredada. Este export usa exclusivamente la foto del formulario y el almacenamiento web.

## Verificación

`npm run build:form-workflow` regenera el export. `npm test` cubre campos, provincias, foto original, contrato de API, confirmaciones y errores. Dentro de reportAR, `npm run test:bot` prueba idempotencia y el protocolo de Blob contra el SDK instalado, con dobles HTTP/DB y sin tocar producción.
