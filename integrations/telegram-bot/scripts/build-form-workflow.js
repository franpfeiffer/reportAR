const fs = require('node:fs');
const path = require('node:path');
const { prepareForm, prepareProvinces, parseFormResponse, validateLocality, validateFormPhoto, prepareBlobUpload, prepareBlobToken, prepareBlobAttachment, formatFormResult, prepareFormResults } = require('../src/form-report');
const node = (id, name, type, position, parameters, extra = {}) => ({
  id, name, type: 'n8n-nodes-base.' + type,
  typeVersion: type === 'telegram' || type === 'telegramTrigger' ? 1.2 : type === 'httpRequest' ? 4.2 : type === 'if' ? 2.2 : type === 'stickyNote' ? 1 : 2,
  position, parameters, ...extra,
});
const condition = value => ({ conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
  conditions: [{ id: 'condition', leftValue: value, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
  combinator: 'and',
}, options: {} });
const httpOptions = { timeout: 60000, response: { response: { fullResponse: true, responseFormat: 'json' } } };
const retry = { onError: 'continueErrorOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 1000 };
const persist = () => ({
  method: 'POST', url: 'https://reportar-one.vercel.app/api/bot/reports',
  authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendHeaders: true,
  headerParameters: { parameters: [{ name: 'Idempotency-Key', value: '={{ $("Revisar foto").first().json.report.external_id }}' }] },
  sendBody: true, specifyBody: 'json',
  jsonBody: '={{ $("Revisar foto").first().json.report }}',
  options: httpOptions,
});
const workflow = {
  name: 'ReportAR · Argentina · Formulario n8n', active: false,
  nodes: [
    node('trigger', 'Telegram Trigger', 'telegramTrigger', [0, 0], { updates: ['message'], additionalFields: {} }, { webhookId: 'reportar-formulario-demo' }),
    node('prepare', 'Preparar formulario', 'code', [220, 0], { jsCode: `${prepareForm.toString()}\nreturn $input.all().map((item, i) => ({ json: prepareForm(item.json), pairedItem: { item: i } }));` }),
    node('open', '¿Abrir formulario?', 'if', [440, 0], condition('={{ $json.action === "form" }}')),
    node('reply-check', '¿Responder mensaje?', 'if', [660, 480], condition('={{ $json.action === "reply" }}')),
    node('provinces-http', 'Cargar provincias de reportAR', 'httpRequest', [660, -120], {
      url: 'https://reportar-one.vercel.app/api/geography/provinces', options: httpOptions,
    }, retry),
    node('provinces', 'Preparar provincias', 'code', [880, -120], {
      jsCode: `${prepareProvinces.toString()}\nreturn $input.all().map((item, i) => ({ json: prepareProvinces(item.json, $("Preparar formulario").first().json), pairedItem: { item: i } }));`,
    }),
    node('geo-ready', '¿Catálogo disponible?', 'if', [1100, -120], condition('={{ $json.action === "form" }}')),
    node('form', 'Formulario de reclamo', 'telegram', [1320, -240], {
      resource: 'message', operation: 'sendAndWait', chatId: '={{ $json.chat_id }}',
      message: '={{ $json.welcome }}', responseType: 'customForm', defineForm: 'json',
      jsonOutput: '={{ JSON.stringify($("Preparar provincias").first().json.form_fields) }}',
      options: {
        appendAttribution: false, messageButtonLabel: '📝 Completar reclamo',
        responseFormTitle: 'reportAR · Reclamos en Argentina',
        responseFormDescription: 'Completá los datos y volvé a Telegram para recibir el número del reclamo. La localidad debe pertenecer a la provincia elegida. Foto opcional: un archivo original de hasta 100 MiB, como en la web. Adjuntalo acá aunque ya lo hayas enviado por chat. No atiende emergencias.',
        responseFormButtonLabel: 'Enviar reclamo',
        limitWaitTime: { values: { limitType: 'afterTimeInterval', resumeAmount: 30, resumeUnit: 'minutes' } },
      },
    }, { webhookId: '3773bb09-c527-4f69-a3bd-242cb462005f' }),
    node('validate', 'Validar formulario', 'code', [1540, -240], {
      jsCode: `${parseFormResponse.toString()}\nconst prepared = $("Preparar provincias").first().json;\nreturn $input.all().map((item, i) => ({ json: parseFormResponse(item.json, prepared.context, prepared.provinces, item.binary), binary: item.binary, pairedItem: { item: i } }));`,
    }),
    node('valid', '¿Datos válidos?', 'if', [1760, -240], condition('={{ $json.action === "validate_location" }}')),
    node('localities-http', 'Cargar localidades de reportAR', 'httpRequest', [1980, -360], {
      url: 'https://reportar-one.vercel.app/api/geography/localities',
      sendQuery: true, queryParameters: { parameters: [{ name: 'province', value: '={{ $json.location.province_id }}' }] },
      options: httpOptions,
    }, retry),
    node('locality', 'Validar localidad', 'code', [2200, -360], {
      jsCode: `${validateLocality.toString()}\nconst original = $("Validar formulario").first();\nreturn $input.all().map((item, i) => ({ json: validateLocality(item.json, original.json), binary: original.binary, pairedItem: { item: i } }));`,
    }),
    node('location-valid', '¿Localidad válida?', 'if', [2420, -360], condition('={{ $json.action === "create" }}')),
    node('photo-validate', 'Revisar foto', 'code', [2640, -480], {
      jsCode: `${validateFormPhoto.toString()}\nreturn await Promise.all($input.all().map(async (item, i) => {\n  const key = item.json.form_photo_key;\n  if (!key) return { ...item, pairedItem: { item: i } };\n  try {\n    const bytes = await this.helpers.getBinaryDataBuffer(i, key);\n    const check = validateFormPhoto(bytes, item.binary[key]);\n    if (!check.ok) return { json: { ...item.json, action: "reply", reply: check.error + " No enviamos el reclamo. Escribí /reportar y completá otro formulario." }, pairedItem: { item: i } };\n    return { json: item.json, binary: { ...item.binary, [key]: { ...item.binary[key], mimeType: check.mimeType } }, pairedItem: { item: i } };\n  } catch { return { json: { ...item.json, action: "reply", error_stage: "form_binary", reply: "No pudimos leer la foto. El reclamo no se envió. Probá de nuevo con /reportar." }, pairedItem: { item: i } }; }\n}));`,
    }),
    node('photo-valid', '¿Foto válida?', 'if', [2860, -480], condition('={{ $json.action === "create" }}')),
    node('persist', 'Guardar reporte', 'httpRequest', [3080, -600], persist(), retry),
    node('photo-plan', 'Preparar carga Blob', 'code', [3300, -600], {
      jsCode: `${prepareBlobUpload.toString()}\nconst original = $("Revisar foto").first();\nreturn $input.all().map((item, i) => ({ json: prepareBlobUpload(item.json, original.json, original.binary?.[original.json.form_photo_key]), pairedItem: { item: i } }));`,
    }),
    node('photo-needed', '¿Adjuntar foto?', 'if', [3520, -600], condition('={{ $json.action === "upload" }}')),
    node('photo-authorize', 'Autorizar foto como la web', 'httpRequest', [3740, -720], {
      method: 'POST', url: 'https://reportar-one.vercel.app/api/reports/photo-upload',
      sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.token_request }}', options: httpOptions,
    }, retry),
    node('photo-binary', 'Preparar binario Blob', 'code', [3960, -720], {
      jsCode: `${prepareBlobToken.toString()}\nconst upload = $("Preparar carga Blob").first().json;\nconst original = $("Revisar foto").first();\nreturn $input.all().map((item, i) => ({ json: prepareBlobToken(item.json, upload), binary: original.binary, pairedItem: { item: i } }));`,
    }),
    node('token-ready', '¿Foto autorizada?', 'if', [4180, -720], condition('={{ $json.action === "upload" }}')),
    node('photo-put', 'Subir al Blob de la web', 'httpRequest', [4400, -840], {
      method: 'PUT', url: 'https://vercel.com/api/blob/', sendQuery: true,
      queryParameters: { parameters: [{ name: 'pathname', value: '={{ $json.pathname }}' }] },
      sendHeaders: true, headerParameters: { parameters: [
        { name: 'Authorization', value: '={{ "Bearer " + $json.clientToken }}' },
        { name: 'x-api-version', value: '13' },
        { name: 'x-vercel-blob-store-id', value: '={{ $json.store_id }}' },
        { name: 'x-vercel-blob-access', value: 'public' },
        { name: 'x-content-type', value: '={{ $json.content_type }}' },
      ] },
      sendBody: true, contentType: 'binaryData', inputDataFieldName: '={{ $json.form_photo_key }}',
      options: { ...httpOptions, timeout: 180000 },
    }, retry),
    node('attach-prepare', 'Preparar adjunto', 'code', [4620, -840], {
      jsCode: `${prepareBlobAttachment.toString()}\nconst upload = $("Preparar binario Blob").first().json;\nreturn $input.all().map((item, i) => ({ json: prepareBlobAttachment(item.json, upload), pairedItem: { item: i } }));`,
    }),
    node('blob-ready', '¿Archivo subido?', 'if', [4840, -840], condition('={{ $json.action === "attach" }}')),
    node('photo-attach', 'Vincular foto al reclamo', 'httpRequest', [5060, -960], {
      method: 'POST', url: '={{ "https://reportar-one.vercel.app/api/reports/" + $json.report_id + "/photo/attach" }}',
      sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.attachment }}', options: httpOptions,
    }, retry),
    node('attached-check', '¿Adjunto confirmado?', 'if', [5280, -960], condition('={{ $json.statusCode === 200 && $json.body?.ok === true }}')),
    node('recheck', 'Reconsultar mismo reclamo', 'httpRequest', [5500, -480], persist(), retry),
    node('result', 'Preparar resultado', 'code', [5720, -240], {
      jsCode: `${formatFormResult.toString()}\n${prepareFormResults.toString()}\nreturn prepareFormResults($input.all(), (name, branch) => $(name).first(branch)?.json);`,
    }),
    node('reply', 'Responder por Telegram', 'telegram', [5940, 80], {
      resource: 'message', operation: 'sendMessage', chatId: '={{ $json.chat_id }}',
      text: '={{ $json.reply.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }}',
      replyMarkup: 'none', additionalFields: { appendAttribution: false, parse_mode: 'HTML' },
    }),
    node('note', 'Configuración de la demo', 'stickyNote', [0, -700], {
      width: 740, height: 560,
      content: '## reportAR · Formulario + fotos como la web\nINACTIVO. Requiere desplegar el contrato expectsPhoto del endpoint del bot antes de activar.\n\nCredencial Telegram: Telegram Trigger, Formulario de reclamo y Responder por Telegram. Header Auth: Name Authorization; Value Bearer <REPORTS_API_TOKEN>, en Guardar reporte y Reconsultar mismo reclamo. No poner secretos en este JSON.\n\nURL de reportAR: https://reportar-one.vercel.app. n8n necesita su propia WEBHOOK_URL pública HTTPS. El formulario individual vence a los 30 minutos. Desactivar el workflow anterior antes de activar este.\n\nHola → formulario nativo: tipo, descripción, provincia, localidad, calle y altura, foto opcional hasta 100 MiB. Las opciones de provincia se resuelven como JSON; la localidad se valida contra el catálogo de la app.\n\nFoto: crear reclamo con expectsPhoto → autorización /api/reports/photo-upload → PUT directo a Vercel Blob → /api/reports/{id}/photo/attach. Mismo store y rutas que la web; BLOB_READ_WRITE_TOKEN queda solo en Vercel. No usa sendPhoto, getFile ni AWS para esta carga.\n\nCada HTTP admite hasta 3 intentos. external_id, Idempotency-Key y pathname permanecen iguales. Si falla el adjunto se reconsulta el mismo reclamo para reconocer una carga ya completada. Se conserva el ID y se informa el fallo de foto.\n\nLas ejecuciones guardan el archivo y autorizaciones temporales para reintentar. Restringir acceso y retención en n8n; usar datos ficticios en la demo. No se confirma derivación a organismos.',
    }),
  ],
  connections: {}, settings: { executionOrder: 'v1', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all', saveManualExecutions: true }, pinData: {}, tags: [],
};
const edge = name => ({ node: name, type: 'main', index: 0 });
const connect = (from, success, error) => { workflow.connections[from] = { main: [success.map(edge), ...(error === undefined ? [] : [error.map(edge)])] }; };
connect('Telegram Trigger', ['Preparar formulario']);
connect('Preparar formulario', ['¿Abrir formulario?']);
connect('¿Abrir formulario?', ['Cargar provincias de reportAR'], ['¿Responder mensaje?']);
connect('¿Responder mensaje?', ['Responder por Telegram'], []);
connect('Cargar provincias de reportAR', ['Preparar provincias'], ['Preparar provincias']);
connect('Preparar provincias', ['¿Catálogo disponible?']);
connect('¿Catálogo disponible?', ['Formulario de reclamo'], ['Responder por Telegram']);
connect('Formulario de reclamo', ['Validar formulario']);
connect('Validar formulario', ['¿Datos válidos?']);
connect('¿Datos válidos?', ['Cargar localidades de reportAR'], ['Responder por Telegram']);
connect('Cargar localidades de reportAR', ['Validar localidad'], ['Validar localidad']);
connect('Validar localidad', ['¿Localidad válida?']);
connect('¿Localidad válida?', ['Revisar foto'], ['Responder por Telegram']);
connect('Revisar foto', ['¿Foto válida?']);
connect('¿Foto válida?', ['Guardar reporte'], ['Responder por Telegram']);
connect('Guardar reporte', ['Preparar carga Blob'], ['Preparar resultado']);
connect('Preparar carga Blob', ['¿Adjuntar foto?']);
connect('¿Adjuntar foto?', ['Autorizar foto como la web'], ['Preparar resultado']);
connect('Autorizar foto como la web', ['Preparar binario Blob'], ['Preparar binario Blob']);
connect('Preparar binario Blob', ['¿Foto autorizada?']);
connect('¿Foto autorizada?', ['Subir al Blob de la web'], ['Reconsultar mismo reclamo']);
connect('Subir al Blob de la web', ['Preparar adjunto'], ['Preparar adjunto']);
connect('Preparar adjunto', ['¿Archivo subido?']);
connect('¿Archivo subido?', ['Vincular foto al reclamo'], ['Reconsultar mismo reclamo']);
connect('Vincular foto al reclamo', ['¿Adjunto confirmado?'], ['Reconsultar mismo reclamo']);
connect('¿Adjunto confirmado?', ['Preparar resultado'], ['Reconsultar mismo reclamo']);
connect('Reconsultar mismo reclamo', ['Preparar resultado'], ['Preparar resultado']);
connect('Preparar resultado', ['Responder por Telegram']);
const target = path.join(__dirname, '../n8n/reportes-formulario-demo.json');
fs.writeFileSync(target, JSON.stringify(workflow, null, 2) + '\n');
console.log(target);
