const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const f = require('../src/form-report');
const workflow = require('../n8n/reportes-formulario-demo.json');
const id = 'bbddc5e7-027b-4613-a1ae-c9ec8176f51c';
const message = { message_id: 42, date: 1792846800, chat: { id: 123, type: 'private' }, from: { id: 456 }, text: 'hola' };
const provinces = [{ id: '82', name: 'Santa Fe' }, { id: '06', name: 'Buenos Aires' }];
const catalog = { statusCode: 200, body: { provinces } };
const localities = { statusCode: 200, body: { localities: [{ name: 'ROSARIO' }] } };
const data = { 'Tipo de problema': 'Árboles y espacios verdes', 'Descripción': 'Hay ramas caídas bloqueando la vereda.', Provincia: 'Santa Fe', 'Ciudad o localidad': 'Rosario', 'Calle y altura': 'Córdoba 1900' };
const prepared = f.prepareProvinces(catalog, f.prepareForm({ message }));
const original = f.validateLocality(localities, f.parseFormResponse({ data }, prepared.context, provinces));
const bytes = Buffer.from('original-photo');
const binary = { Foto: { data: bytes.toString('base64'), fileName: 'foto.heic', mimeType: 'image/heic' } };
const photo = f.validateLocality(localities, f.parseFormResponse({ data }, prepared.context, provinces, binary));
const received = (photo_status, statusCode = 201) => ({ statusCode, body: { id, status: 'received', ...(photo_status ? { photo_status } : {}) } });
const pending = { statusCode: 201, body: { ...received('pending').body, photoUploadToken: 'a'.repeat(64) } };
const authorized = { statusCode: 200, body: { type: 'blob.generate-client-token', clientToken: 'vercel_blob_client_teststore_signed' } };
const evaluate = (expression, json, lookup = {}) => vm.runInNewContext(expression.slice(3, -2).trim(), { $json: json, $: key => ({ first: () => lookup[key] }) });
async function runCode(name, items, lookup = {}, helpers = {}) {
  return await vm.runInNewContext('(async function(){' + workflow.nodes.find(n => n.name === name).parameters.jsCode + '}).call({helpers})', {
    $input: { all: () => items }, $: key => ({ first: branch => typeof lookup[key] === 'function' ? lookup[key](branch) : lookup[key] }), helpers,
  });
}
test('hola abre un formulario nacional con provincias visibles y seleccionables', () => {
  for (const text of ['hola', '/start', '/reportar']) assert.equal(f.prepareForm({ message: { ...message, text } }).action, 'form');
  const form = workflow.nodes.find(n => n.id === 'form');
  assert.equal(form.parameters.operation, 'sendAndWait');
  assert.equal(form.parameters.defineForm, 'json');
  const fields = JSON.parse(evaluate(form.parameters.jsonOutput, {}, { 'Preparar provincias': { json: prepared } }));
  assert.deepEqual(fields.map(x => x.fieldLabel), ['Tipo de problema', 'Descripción', 'Provincia', 'Ciudad o localidad', 'Calle y altura', 'Foto']);
  assert.deepEqual(fields[2].fieldOptions.values, provinces.map(p => ({ option: p.name })));
  assert.equal(fields[5].multipleFiles, false);
  assert.equal(fields[5].acceptFileTypes, undefined);
  assert.equal(f.prepareProvinces({ error: {} }, prepared).action, 'reply');
});
test('valida geografía, seis categorías y límites sin recortar', () => {
  assert.equal(original.report.address, 'Córdoba 1900, ROSARIO, Santa Fe');
  for (const response of [{ error: {} }, { statusCode: 200, body: { localities: [] } }]) assert.equal(f.validateLocality(response, photo).action, 'reply');
  for (const [label, category] of [['Bache o vereda rota', 'bache'], ['Inundación', 'inundacion'], ['Alumbrado público', 'alumbrado'], ['Basura o limpieza', 'basura'], ['Árboles y espacios verdes', 'arbolado'], ['Otro problema', 'otro']]) assert.equal(f.parseFormResponse({ data: { ...data, 'Tipo de problema': label } }, prepared.context, provinces).report.category, category);
  for (const [key, value] of [['Descripción', 'x'.repeat(2001)], ['Tipo de problema', 'Inválido'], ['Provincia', 'Inventada']]) assert.equal(f.parseFormResponse({ data: { ...data, [key]: value } }, prepared.context, provinces).action, 'reply');
  const long = f.parseFormResponse({ data: { ...data, 'Calle y altura': 'x'.repeat(290) } }, prepared.context, provinces);
  assert.match(f.validateLocality(localities, long).reply, /No se recortó/);
  assert.match(f.parseFormResponse({}, prepared.context, provinces).reply, /venció/);
});
test('usa un original de hasta 100 MiB del formulario; no procesa fotos por Telegram', () => {
  assert.equal(photo.report.expectsPhoto, true);
  assert.equal(photo.report.photo, null);
  assert.equal(photo.report.external_id, 'telegram:123:42');
  const fromChat = f.prepareForm({ message: { ...message, photo: [{ file_id: 'telegram-file' }], document: { file_id: 'doc' } } });
  assert.equal(fromChat.context.photo, undefined);
  assert.equal(f.parseFormResponse({ data }, fromChat.context, provinces).report.expectsPhoto, false);
  assert.equal(f.parseFormResponse({ data }, prepared.context, provinces, { Foto_0: binary.Foto, Foto_1: binary.Foto }).action, 'reply');
  assert.equal(f.parseFormResponse({ data: { ...data, Foto: [{ filename: 'foto.png' }] } }, prepared.context, provinces).action, 'reply');
  assert.equal(f.validateFormPhoto({ length: 0 }, binary.Foto).ok, false);
  assert.equal(f.validateFormPhoto({ length: 100 * 1024 * 1024 + 1 }, binary.Foto).ok, false);
  assert.equal(f.validateFormPhoto({ length: 100 * 1024 * 1024 }, binary.Foto).mimeType, 'image/heic');
  assert.equal(workflow.nodes.some(n => n.parameters.operation === 'sendPhoto'), false);
  assert.doesNotMatch(JSON.stringify(workflow.nodes.filter(n => n.type !== 'n8n-nodes-base.stickyNote')), /getFile|telegram_file_id|AWS_ACCESS_KEY_ID/);
});
test('crea ID → autorización normal → Blob → adjunto normal; reintento conserva pathname', () => {
  const upload = f.prepareBlobUpload(pending, photo, binary.Foto);
  assert.equal(upload.action, 'upload');
  assert.equal(upload.pathname, `reports/${id}/${id}-foto.heic`);
  assert.deepEqual(JSON.parse(upload.token_request.payload.clientPayload), { reportId: id, token: 'a'.repeat(64), client: 'n8n' });
  assert.equal(f.prepareBlobUpload({ ...pending, statusCode: 200 }, photo, binary.Foto).pathname, upload.pathname);
  assert.equal(f.prepareBlobUpload(received('stored', 200), photo).action, 'result');
  assert.equal(f.prepareBlobUpload(received(), original).action, 'result');
  assert.equal(f.prepareBlobUpload(received('pending'), photo).action, 'result');
  const token = f.prepareBlobToken(authorized, upload);
  assert.equal(token.store_id, 'teststore');
  assert.equal(f.prepareBlobToken({ statusCode: 401, body: { error: 'unauthorized' } }, upload).action, 'recheck');
  const response = { statusCode: 200, body: { url: `https://teststore.public.blob.vercel-storage.com/${upload.pathname}`, pathname: upload.pathname } };
  assert.deepEqual(f.prepareBlobAttachment(response, token).attachment, { token: 'a'.repeat(64), url: response.body.url });
  assert.equal(f.prepareBlobAttachment({ ...response, body: { ...response.body, url: 'https://elsewhere.test/photo' } }, token).action, 'recheck');
});
test('confirma texto, foto guardada o fallo parcial; auth inválida y errores no confirman', () => {
  assert.equal(f.formatFormResult(received(), original).confirmed, true);
  assert.equal(f.formatFormResult({ statusCode: 200, body: { ok: true } }, photo, pending).photo_status, 'stored');
  const failed = f.formatFormResult({ error: { code: 'ETIMEDOUT' } }, photo, pending);
  assert.equal(failed.confirmed, true);
  assert.equal(failed.photo_status, 'failed');
  assert.equal(failed.report_id, id);
  assert.equal(failed.retry_event.idempotency_key, photo.report.external_id);
  assert.match(failed.reply, /reclamo quedó guardado/);
  assert.equal(f.formatFormResult(received('stored', 200), photo, pending).photo_status, 'stored');
  for (const response of [{ statusCode: 401, body: { error: 'unauthorized' } }, { statusCode: 503, body: { error: 'persistence_failed' } }, { error: { code: 'ETIMEDOUT' } }, received(undefined, 202), { statusCode: 200, body: { status: 'received' } }]) {
    const result = f.formatFormResult(response, original);
    assert.equal(result.confirmed, false);
    assert.equal(result.retry_event.report, original.report);
    assert.match(result.reply, /No pudimos confirmar/);
  }
});
test('ejecuta Code exportado con binario del formulario hasta confirmación de adjunto', async () => {
  const lookup = {};
  const run = async (name, item, helpers) => { const [result] = await runCode(name, [item], lookup, helpers); lookup[name] = result; return result; };
  await run('Preparar formulario', { json: { message } });
  await run('Preparar provincias', { json: catalog });
  await run('Validar formulario', { json: { data }, binary });
  const located = await run('Validar localidad', { json: localities });
  await run('Revisar foto', located, { getBinaryDataBuffer: async () => bytes });
  lookup['Guardar reporte'] = { json: pending };
  const upload = await run('Preparar carga Blob', { json: pending });
  const token = await run('Preparar binario Blob', { json: authorized });
  assert.equal(token.binary.Foto.data, binary.Foto.data);
  assert.equal(token.binary.Foto.fileName, binary.Foto.fileName);
  await run('Preparar adjunto', { json: { statusCode: 200, body: { pathname: upload.json.pathname, url: `https://teststore.public.blob.vercel-storage.com/${upload.json.pathname}` } } });
  const result = await run('Preparar resultado', { json: { statusCode: 200, body: { ok: true } } });
  assert.equal(result.json.confirmed, true);
  assert.equal(result.json.photo_status, 'stored');
});
test('resultado tolera salidas vacías y evita undefined.json', async () => {
  const [direct] = await runCode('Preparar resultado', [{ json: received('failed') }], { 'Revisar foto': { json: photo }, 'Guardar reporte': () => { throw new Error('Salida vacía'); } });
  assert.equal(direct.json.confirmed, true);
  const [saved] = await runCode('Preparar resultado', [{ json: { error: {} } }], { 'Revisar foto': { json: photo }, 'Guardar reporte': branch => branch === 1 ? { json: pending } : undefined });
  assert.equal(saved.json.confirmed, true);
  const [unknown] = await runCode('Preparar resultado', [{ json: { error: {} } }], { 'Revisar foto': { json: original } });
  assert.equal(unknown.json.confirmed, false);
  await assert.rejects(runCode('Preparar resultado', [{ json: received() }]), /Falta el contexto/);
});
test('HTTP conserva body, clave y archivo en hasta tres intentos; export inactivo sin secretos', () => {
  for (const nodeId of ['persist', 'recheck']) {
    const node = workflow.nodes.find(n => n.id === nodeId);
    const lookup = { 'Revisar foto': { json: photo } };
    assert.equal(evaluate(node.parameters.jsonBody, {}, lookup), photo.report);
    assert.equal(evaluate(node.parameters.headerParameters.parameters[0].value, {}, lookup), photo.report.external_id);
    assert.equal(node.parameters.genericAuthType, 'httpHeaderAuth');
  }
  for (const node of workflow.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest')) {
    assert.equal(node.maxTries, 3);
    assert.equal(workflow.connections[node.name].main[1].length, 1);
  }
  assert.equal(workflow.nodes.find(n => n.id === 'photo-put').parameters.contentType, 'binaryData');
  assert.equal(workflow.active, false);
  assert.doesNotMatch(JSON.stringify(workflow), /Bearer\s+[a-zA-Z0-9_-]{24,}|\$vars/);
  const names = new Set(workflow.nodes.map(n => n.name));
  for (const outputs of Object.values(workflow.connections)) for (const branch of outputs.main) for (const edge of branch) assert.ok(names.has(edge.node));
});
