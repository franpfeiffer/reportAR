const fs = require('node:fs');
const path = require('node:path');
const { parseUpdate } = require('../src/parse-report');
const root = path.join(__dirname, '..');
const node = (id, name, type, typeVersion, position, parameters, extra = {}) => ({ id, name, type, typeVersion, position, parameters, ...extra });
const condition = expression => ({ conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'condition', leftValue: expression, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} });
const persistParameters = (reportExpression, keyExpression) => ({
  method: 'POST',
  url: '={{ $vars.REPORTAR_API_URL + "/api/bot/reports" }}',
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  sendHeaders: true,
  headerParameters: { parameters: [{ name: 'Idempotency-Key', value: keyExpression }] },
  sendBody: true,
  specifyBody: 'json',
  jsonBody: reportExpression,
  options: { timeout: 30000 },
});
const workflow = {
  name: 'ReportAR · Telegram · Persistencia',
  nodes: [
    node('trigger', 'Telegram Trigger', 'n8n-nodes-base.telegramTrigger', 1.2, [0, 0], { updates: ['message'], additionalFields: {} }, { webhookId: 'municipal-reportes-mvp' }),
    node('parse', 'Validar reporte', 'n8n-nodes-base.code', 2, [240, 0], { jsCode: `${parseUpdate.toString()}\nreturn $input.all().map(item => ({ json: parseUpdate(item.json) }));` }),
    node('ignore', 'Procesar mensaje', 'n8n-nodes-base.if', 2.2, [480, 0], condition('={{ $json.action !== "ignore" }}')),
    node('route', 'Es reporte valido', 'n8n-nodes-base.if', 2.2, [720, -80], condition('={{ $json.action === "create" }}')),
    node('persist', 'Guardar reporte', 'n8n-nodes-base.httpRequest', 4.2, [960, -180], persistParameters('={{ $json.report }}', '={{ $json.report.external_id }}'), { onError: 'continueErrorOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 1000 }),
    node('photo-retry-check-1', '¿Foto pendiente tras guardado?', 'n8n-nodes-base.if', 2.2, [1180, -180], condition('={{ $json.photo_status === "failed" }}')),
    node('photo-retry-1', 'Reintentar foto 1', 'n8n-nodes-base.httpRequest', 4.2, [1400, -300], persistParameters('={{ $("Validar reporte").item.json.report }}', '={{ $("Validar reporte").item.json.report.external_id }}'), { onError: 'continueErrorOutput' }),
    node('photo-retry-check-2', '¿Foto pendiente tras reintento?', 'n8n-nodes-base.if', 2.2, [1620, -300], condition('={{ $json.photo_status === "failed" }}')),
    node('photo-retry-2', 'Reintentar foto 2', 'n8n-nodes-base.httpRequest', 4.2, [1840, -420], persistParameters('={{ $("Validar reporte").item.json.report }}', '={{ $("Validar reporte").item.json.report.external_id }}'), { onError: 'continueErrorOutput' }),
    node('confirm', 'Preparar confirmacion', 'n8n-nodes-base.code', 2, [2060, -180], { jsCode: 'return $input.all().map((item, i) => { const original = $("Validar reporte").itemMatching(i).json; if (!/^[0-9a-f-]{36}$/i.test(item.json.id || "") || item.json.status !== "received") throw new Error("Respuesta inválida de persistencia"); const hasPhoto = Boolean(original.report.photo?.telegram_file_id); const photoStatus = item.json.photo_status; if (hasPhoto && !["stored", "failed"].includes(photoStatus)) throw new Error("Respuesta inválida de foto"); let reply = "Reporte guardado en ReportAR.\\nNúmero: " + item.json.id + "\\nCategoría: " + original.report.category + "\\nDirección: " + original.report.address; if (hasPhoto && photoStatus === "stored") reply += "\\n\\nLa foto quedó adjunta y está disponible en el seguimiento."; if (hasPhoto && photoStatus === "failed") reply = "El reclamo quedó guardado, pero no pudimos adjuntar la foto después de varios intentos.\\nNúmero: " + item.json.id + "\\nCategoría: " + original.report.category + "\\nDirección: " + original.report.address; reply += "\\n\\nEsto no confirma envío al municipio."; return { json: { chat_id: original.chat_id, reply } }; });' }, { onError: 'continueErrorOutput' }),
    node('photo-error', 'Informar foto pendiente', 'n8n-nodes-base.code', 2, [2060, 220], { jsCode: 'return $input.all().map((item, i) => { const original = $("Validar reporte").itemMatching(i).json; const saved = $("Guardar reporte").itemMatching(i).json; if (!/^[0-9a-f-]{36}$/i.test(saved.id || "") || saved.status !== "received" || saved.photo_status !== "failed") throw new Error("No se pudo confirmar el estado de la foto"); const reply = "El reclamo quedó guardado, pero no pudimos adjuntar la foto después de varios intentos.\\nNúmero: " + saved.id + "\\nCategoría: " + original.report.category + "\\nDirección: " + original.report.address + "\\n\\nEsto no confirma envío al municipio."; return { json: { chat_id: original.chat_id, reply } }; });' }, { onError: 'continueErrorOutput' }),
    node('error', 'Informar error de guardado', 'n8n-nodes-base.code', 2, [2060, 20], { jsCode: 'return $input.all().map((item, i) => ({ json: { chat_id: $("Validar reporte").itemMatching(i).json.chat_id, reply: "No pudimos confirmar el guardado del reporte. No se confirmó el envío al municipio." } }));' }),
    node('reply', 'Responder por Telegram', 'n8n-nodes-base.telegram', 1.2, [1460, -180], { resource: 'message', operation: 'sendMessage', chatId: '={{ $json.chat_id }}', text: '={{ $json.reply }}', additionalFields: { appendAttribution: false, parse_mode: 'HTML' } }),
    node('instructions', 'Explicar como reportar', 'n8n-nodes-base.telegram', 1.2, [960, 140], { resource: 'message', operation: 'sendMessage', chatId: '={{ $json.chat_id }}', text: '={{ $json.reply.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }}', additionalFields: { appendAttribution: false, parse_mode: 'HTML' } }),
    node('template', 'Enviar plantilla para copiar', 'n8n-nodes-base.telegram', 1.2, [1200, 140], { resource: 'message', operation: 'sendMessage', chatId: '={{ $("Validar reporte").first().json.chat_id }}', text: '={{ "<pre>" + $("Validar reporte").first().json.template.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</pre>" }}', additionalFields: { appendAttribution: false, parse_mode: 'HTML' } }),
    node('note', 'Como usar este MVP', 'n8n-nodes-base.stickyNote', 1, [0, -400], { width: 710, height: 280, content: '## Configuración\n1. Crear un bot con @BotFather.\n2. Elegir la misma credencial en Telegram Trigger, Responder por Telegram, Explicar como reportar y Enviar plantilla para copiar.\n3. Probar /start por chat privado.\n4. El bot envía instrucciones y después una plantilla en un mensaje separado. Completar Categoría, Descripción y Dirección.\nTambién admite una foto adjunta con ese texto como descripción.\n\n**Persistencia:** configurar REPORTAR_API_URL en Variables y una credencial Header Auth (Authorization: Bearer TOKEN) en Guardar reporte. No activar sin URL HTTPS real. Los reclamos se guardan en ReportAR; las fotos se guardan en el bucket privado y se ven en el seguimiento. Si falla la foto, el reporte se confirma con un aviso parcial. No se confirma envío al municipio. n8n puede conservar datos en su historial de ejecuciones. Usar datos ficticios.\n\nEl trigger necesita una URL pública HTTPS. Un bot admite un webhook activo: evitar usar el mismo bot en dos workflows.' }),
    node('api-note', 'Configuración API', 'n8n-nodes-base.stickyNote', 1, [900, -540], { width: 600, height: 300, content: '## Endpoint autenticado\nEl nodo HTTP Request usa: POST https://TU-APP/api/bot/reports\nAutenticación: credencial Header Auth con Authorization: Bearer ...\nBody JSON: {{ $json.report }}\nHeader Idempotency-Key: {{ $json.report.external_id }}\n\nLa API guarda con external_id único y responde { id, status: "received", photo_status?: "stored" | "failed" }. Para el estado failed, el workflow reintenta dos veces con el mismo reporte y la misma clave.\n\nEl servidor descarga la foto de Telegram y la sube al bucket privado Neon. No enviar bytes de imagen en el body. La página pública de seguimiento entrega el archivo a través de reportAR.' })
  ],
  connections: {
    'Telegram Trigger': { main: [[{ node: 'Validar reporte', type: 'main', index: 0 }]] },
    'Validar reporte': { main: [[{ node: 'Procesar mensaje', type: 'main', index: 0 }]] },
    'Procesar mensaje': { main: [[{ node: 'Es reporte valido', type: 'main', index: 0 }], []] },
    'Es reporte valido': { main: [[{ node: 'Guardar reporte', type: 'main', index: 0 }], [{ node: 'Explicar como reportar', type: 'main', index: 0 }]] },
    'Explicar como reportar': { main: [[{ node: 'Enviar plantilla para copiar', type: 'main', index: 0 }]] },
    'Guardar reporte': { main: [[{ node: '¿Foto pendiente tras guardado?', type: 'main', index: 0 }], [{ node: 'Informar error de guardado', type: 'main', index: 0 }]] },
    '¿Foto pendiente tras guardado?': { main: [[{ node: 'Reintentar foto 1', type: 'main', index: 0 }], [{ node: 'Preparar confirmacion', type: 'main', index: 0 }]] },
    'Reintentar foto 1': { main: [[{ node: '¿Foto pendiente tras reintento?', type: 'main', index: 0 }], [{ node: 'Informar foto pendiente', type: 'main', index: 0 }]] },
    '¿Foto pendiente tras reintento?': { main: [[{ node: 'Reintentar foto 2', type: 'main', index: 0 }], [{ node: 'Preparar confirmacion', type: 'main', index: 0 }]] },
    'Reintentar foto 2': { main: [[{ node: 'Preparar confirmacion', type: 'main', index: 0 }], [{ node: 'Informar foto pendiente', type: 'main', index: 0 }]] },
    'Informar foto pendiente': { main: [[{ node: 'Responder por Telegram', type: 'main', index: 0 }], [{ node: 'Informar error de guardado', type: 'main', index: 0 }]] },
    'Informar error de guardado': { main: [[{ node: 'Responder por Telegram', type: 'main', index: 0 }]] },
    'Preparar confirmacion': { main: [[{ node: 'Responder por Telegram', type: 'main', index: 0 }], [{ node: 'Informar error de guardado', type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1' }, active: false, pinData: {}, tags: []
};
// Escapar contenido del usuario para el parse_mode HTML de Telegram.
const reply = workflow.nodes.find(n => n.id === 'reply');
reply.parameters.text = '={{ $json.reply.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }}';
fs.mkdirSync(path.join(root, 'n8n'), { recursive: true });
fs.writeFileSync(path.join(root, 'n8n/reportes-municipales.json'), JSON.stringify(workflow, null, 2) + '\n');
