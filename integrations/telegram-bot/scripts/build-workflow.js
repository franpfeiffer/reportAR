const fs = require('node:fs');
const path = require('node:path');
const { parseUpdate } = require('../src/parse-report');
const root = path.join(__dirname, '..');
const node = (id, name, type, typeVersion, position, parameters, extra = {}) => ({ id, name, type, typeVersion, position, parameters, ...extra });
const condition = expression => ({ conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'condition', leftValue: expression, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} });
const workflow = {
  name: 'ReportAR · Telegram · Persistencia',
  nodes: [
    node('trigger', 'Telegram Trigger', 'n8n-nodes-base.telegramTrigger', 1.2, [0, 0], { updates: ['message'], additionalFields: {} }, { webhookId: 'municipal-reportes-mvp' }),
    node('parse', 'Validar reporte', 'n8n-nodes-base.code', 2, [240, 0], { jsCode: `${parseUpdate.toString()}\nreturn $input.all().map(item => ({ json: parseUpdate(item.json) }));` }),
    node('ignore', 'Procesar mensaje', 'n8n-nodes-base.if', 2.2, [480, 0], condition('={{ $json.action !== "ignore" }}')),
    node('route', 'Es reporte valido', 'n8n-nodes-base.if', 2.2, [720, -80], condition('={{ $json.action === "create" }}')),
    node('persist', 'Guardar reporte', 'n8n-nodes-base.httpRequest', 4.2, [960, -180], { method: 'POST', url: '={{ $vars.REPORTAR_API_URL + "/api/bot/reports" }}', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendHeaders: true, headerParameters: { parameters: [{ name: 'Idempotency-Key', value: '={{ $json.report.external_id }}' }] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.report }}', options: { timeout: 30000 } }, { onError: 'continueErrorOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 1000 }),
    node('confirm', 'Preparar confirmacion', 'n8n-nodes-base.code', 2, [1200, -180], { jsCode: 'return $input.all().map((item, i) => { const original = $("Validar reporte").itemMatching(i).json; if (!/^[0-9a-f-]{36}$/i.test(item.json.id || "") || item.json.status !== "received") throw new Error("Respuesta inválida de persistencia"); return { json: { chat_id: original.chat_id, reply: "Reporte guardado en ReportAR.\\nNúmero: " + item.json.id + "\\nCategoría: " + original.report.category + "\\nDirección: " + original.report.address + "\\n\\nLa foto, si adjuntaste una, todavía no se almacena. Esto no confirma envío al municipio." } }; });' }, { onError: 'continueErrorOutput' }),
    node('error', 'Informar error de guardado', 'n8n-nodes-base.code', 2, [1200, -20], { jsCode: 'return $input.all().map((item, i) => ({ json: { chat_id: $("Validar reporte").itemMatching(i).json.chat_id, reply: "No pudimos confirmar el guardado. Reintentá reenviando el mensaje original. No se confirmó el envío al municipio." } }));' }),
    node('reply', 'Responder por Telegram', 'n8n-nodes-base.telegram', 1.2, [1460, -180], { resource: 'message', operation: 'sendMessage', chatId: '={{ $json.chat_id }}', text: '={{ $json.reply }}', additionalFields: { appendAttribution: false, parse_mode: 'HTML' } }),
    node('instructions', 'Explicar como reportar', 'n8n-nodes-base.telegram', 1.2, [960, 140], { resource: 'message', operation: 'sendMessage', chatId: '={{ $json.chat_id }}', text: '={{ $json.reply.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }}', additionalFields: { appendAttribution: false, parse_mode: 'HTML' } }),
    node('template', 'Enviar plantilla para copiar', 'n8n-nodes-base.telegram', 1.2, [1200, 140], { resource: 'message', operation: 'sendMessage', chatId: '={{ $("Validar reporte").first().json.chat_id }}', text: '={{ "<pre>" + $("Validar reporte").first().json.template.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</pre>" }}', additionalFields: { appendAttribution: false, parse_mode: 'HTML' } }),
    node('note', 'Como usar este MVP', 'n8n-nodes-base.stickyNote', 1, [0, -400], { width: 710, height: 280, content: '## Configuración\n1. Crear un bot con @BotFather.\n2. Elegir la misma credencial en Telegram Trigger, Responder por Telegram, Explicar como reportar y Enviar plantilla para copiar.\n3. Probar /start por chat privado.\n4. El bot envía instrucciones y después una plantilla en un mensaje separado. Completar Categoría, Descripción y Dirección.\nTambién admite una foto con ese texto como descripción.\n\n**Persistencia:** configurar REPORTAR_API_URL en Variables y una credencial Header Auth (Authorization: Bearer TOKEN) en Guardar reporte. No activar sin URL HTTPS real. Se guardan reclamos en ReportAR; no se confirma envío al municipio. n8n puede conservar datos en el historial de ejecuciones. Usar datos ficticios.\n\nEl trigger necesita una URL pública HTTPS. Un bot admite un webhook activo: evitar usar el mismo bot en dos workflows.' }),
    node('api-note', 'Configuración API', 'n8n-nodes-base.stickyNote', 1, [900, -540], { width: 600, height: 300, content: '## Endpoint autenticado\nEl nodo HTTP Request usa: POST https://TU-APP/api/bot/reports\nAutenticación: credencial Header Auth con Authorization: Bearer ...\nBody JSON: {{ $json.report }}\nHeader Idempotency-Key: {{ $json.report.external_id }}\n\nLa API debe guardar con external_id único y responder { id, status: "received" }. Preparar confirmacion debe tomar chat_id/report desde Validar reporte y el id desde la respuesta HTTP. Agregar rama de error: nunca confirmar éxito si falla el guardado.\n\nLa foto se representa por telegram_file_id, no por una URL pública. Para almacenarla, descargarla mediante Telegram y subirla al almacenamiento de la app.' })
  ],
  connections: {
    'Telegram Trigger': { main: [[{ node: 'Validar reporte', type: 'main', index: 0 }]] },
    'Validar reporte': { main: [[{ node: 'Procesar mensaje', type: 'main', index: 0 }]] },
    'Procesar mensaje': { main: [[{ node: 'Es reporte valido', type: 'main', index: 0 }], []] },
    'Es reporte valido': { main: [[{ node: 'Guardar reporte', type: 'main', index: 0 }], [{ node: 'Explicar como reportar', type: 'main', index: 0 }]] },
    'Explicar como reportar': { main: [[{ node: 'Enviar plantilla para copiar', type: 'main', index: 0 }]] },
    'Guardar reporte': { main: [[{ node: 'Preparar confirmacion', type: 'main', index: 0 }], [{ node: 'Informar error de guardado', type: 'main', index: 0 }]] },
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
