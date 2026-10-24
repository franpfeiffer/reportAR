const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const workflow = require('../n8n/reportes-municipales.json');
const { parseUpdate } = require('../src/parse-report');
const message = { message_id: 42, date: 1792846800, chat: { id: 123, type: 'private' }, from: { id: 456 }, text: 'bache | Pozo grande en la esquina | San Martín 123' };
const runCode = (name, json) => vm.runInNewContext(`(function(){${workflow.nodes.find(n => n.name === name).parameters.jsCode}})()`, { $input: { all: () => [{ json }] } })[0].json;
test('HTTP autenticado conecta éxito y error por ramas separadas', () => {
  const save = workflow.nodes.find(n => n.id === 'persist');
  assert.equal(save.type, 'n8n-nodes-base.httpRequest');
  assert.equal(save.parameters.genericAuthType, 'httpHeaderAuth');
  assert.match(save.parameters.url, /api\/bot\/reports/);
  assert.equal(save.parameters.headerParameters.parameters[0].name, 'Idempotency-Key');
  assert.equal(workflow.connections['Guardar reporte'].main[0][0].node, 'Preparar confirmacion');
  assert.equal(workflow.connections['Guardar reporte'].main[1][0].node, 'Informar error de guardado');
  assert.equal(workflow.connections['Preparar confirmacion'].main[1][0].node, 'Informar error de guardado');
});
test('confirmación solo después de una respuesta válida; errores no confirman éxito', () => {
  const parsed = parseUpdate({ message });
  const execute = (name, response) => vm.runInNewContext(`(function(){${workflow.nodes.find(n => n.name === name).parameters.jsCode}})()`, {
    $input: {all: () => [{json: response}]}, $: () => ({itemMatching: () => ({json: parsed})})
  })[0].json;
  const reply = execute('Preparar confirmacion', {id:'12345678-1234-4123-8123-123456789012',status:'received'});
  assert.match(reply.reply, /Reporte guardado/);
  assert.equal(reply.chat_id, '123');
  assert.throws(() => execute('Preparar confirmacion', {error:'failed'}));
  assert.match(execute('Informar error de guardado', {}).reply, /No pudimos confirmar/);
});
test('ayuda, inválidos y mensajes de grupos no crean reportes', () => {
  assert.equal(parseUpdate({ message: { ...message, text: '/start' } }).action, 'reply');
  assert.equal(parseUpdate({ message: { ...message, text: 'hola' } }).action, 'reply');
  assert.equal(parseUpdate({ message: { ...message, chat: { id: -1, type: 'group' } } }).action, 'ignore');
  assert.equal(parseUpdate({}).action, 'ignore');
});
test('foto con descripción y categoría acentuada', () => {
  const result = parseUpdate({ message: { ...message, text: undefined, caption: 'inundación | Agua acumulada en la calle | Belgrano 450', photo: [{ file_id: 'small' }, { file_id: 'large' }] } });
  assert.equal(result.report.category, 'inundacion');
  assert.equal(result.report.photo.telegram_file_id, 'large');
});
test('acepta arbolado y explica qué datos recibe TypeSafe/JEV', () => {
  for (const category of ['arbolado', 'arbolados']) {
    const result = parseUpdate({ message: { ...message, text: `${category} | Hay ramas caídas sobre la vereda | San Martín 123` } });
    assert.equal(result.report.category, 'arbolado');
  }
  const help = runCode('Validar reporte', { message: { ...message, text: '/start' } });
  assert.match(help.reply, /TypeSafe\/JEV/);
  assert.match(help.reply, /solo la descripción y la categoría declarada/);
  assert.match(help.reply, /no se envían dirección, foto ni identificadores/);
});
test('plantilla y saludos ofrecen un ejemplo válido sin crear reportes', () => {
  for (const text of ['/start', '/plantilla', '/reportar', '/plantilla@MiBot', 'hola']) {
    const result = runCode('Validar reporte', { message: { ...message, text } });
    assert.equal(result.action, 'reply');
    assert.match(result.reply, /se guardan en ReportAR/);
    assert.match(result.reply, /foto todavía no se almacena/);
    assert.match(result.template, /Categoría: \[tipo de problema\]/);
    assert.match(result.reply, /UNA foto/);
    assert.ok(!result.report);
    assert.equal(parseUpdate({ message: { ...message, text: result.template } }).action, 'reply');
    const example = result.template.replace('[tipo de problema]', 'bache').replace('[contá qué está pasando]', 'Hay un pozo grande en la esquina').replace('[calle, altura o esquina y localidad]', 'San Martín 123, Córdoba');
    assert.equal(parseUpdate({ message: { ...message, text: example } }).action, 'create');
  }
});
test('acepta descripción en varias líneas y exige completar los campos', () => {
  const text = 'Categoría: inundación\nDescripción: Hay agua acumulada.\nNo se puede cruzar la calle.\nDirección: Belgrano 450, Córdoba';
  const parsed = runCode('Validar reporte', { message: { ...message, text } });
  assert.equal(parsed.report.category, 'inundacion');
  assert.equal(parsed.report.description, 'Hay agua acumulada.\nNo se puede cruzar la calle.');
  assert.equal(parseUpdate({ message: { ...message, text: text.replace('Belgrano 450, Córdoba', '[dirección]') } }).action, 'reply');
});
test('la explicación se envía antes de la plantilla y el éxito va por otra rama', () => {
  assert.equal(workflow.connections['Es reporte valido'].main[1][0].node, 'Explicar como reportar');
  assert.equal(workflow.connections['Explicar como reportar'].main[0][0].node, 'Enviar plantilla para copiar');
  assert.equal(workflow.connections['Preparar confirmacion'].main[0][0].node, 'Responder por Telegram');
});
test('acepta espacios, emojis, líneas vacías, CRLF, plural y campos en otro orden', () => {
  const text = '📍 Dirección : [San Martín 123, Córdoba]\r\n\r\n🏷 Categoría : [Baches]\r\n\r\n✍️ Descripción : [Hay un pozo grande en la esquina]';
  const parsed = runCode('Validar reporte', { message: { ...message, text } });
  assert.equal(parsed.action, 'create');
  assert.equal(parsed.report.category, 'bache');
  assert.equal(parsed.report.address, 'San Martín 123, Córdoba');
});
test('los errores indican qué campo corregir y no repiten la bienvenida', () => {
  const parsed = runCode('Validar reporte', { message: { ...message, text: 'Categoría: bache\nDescripción: pozo\nDirección: San Martín 123' } });
  assert.equal(parsed.action, 'reply');
  assert.match(parsed.reply, /Descripción: escribí entre 10/);
  assert.doesNotMatch(parsed.reply, /¡Hola!/);
});
test('todas las conexiones apuntan a nodos existentes', () => {
  const names = new Set(workflow.nodes.map(n => n.name));
  for (const [source, output] of Object.entries(workflow.connections)) {
    assert.ok(names.has(source));
    for (const branch of output.main) for (const edge of branch) assert.ok(names.has(edge.node));
  }
  assert.equal(workflow.active, false);
});
