const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { prepareForm, parseFormResponse, validateLocality } = require('../src/form-report');
const root = process.env.REPORTAR_CODEBASE || path.resolve(__dirname, '../../..');
const present = fs.existsSync(path.join(root, 'lib/reports/bot-validation.ts'));
test('el formulario nacional con foto pasa el validador real del endpoint reportAR', { skip: !present && 'Ejecutar dentro del repo o definir REPORTAR_CODEBASE' }, () => {
  const req = createRequire(path.join(root, 'package.json'));
  const ts = req('typescript');
  function compile(file, load = req) {
    const exports = {};
    const js = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, { exports, require: load });
    return exports;
  }
  const validation = compile('lib/reports/validation.ts');
  const bot = compile('lib/reports/bot-validation.ts', p => p === './validation' ? validation : req(p));
  const context = prepareForm({ message: { message_id: 42, date: 1792846800, chat: { id: 123, type: 'private' }, from: { id: 456 }, text: 'hola' } }).context;
  const provinces = [{ id: '82', name: 'Santa Fe' }];
  const data = { 'Tipo de problema': 'Árboles y espacios verdes', 'Descripción': 'Hay ramas bloqueando la vereda.', Provincia: 'Santa Fe', 'Ciudad o localidad': 'Rosario', 'Calle y altura': 'Córdoba 1900' };
  const form = parseFormResponse({ data }, context, provinces, { Foto: { fileName: 'foto.jpg' } });
  const located = validateLocality({ statusCode: 200, body: { localities: [{ id: '82084270000', name: 'ROSARIO' }] } }, form);
  const payload = located.report;
  const parsed = bot.parseBotReport(payload, payload.external_id);
  assert.equal(parsed.category, 'ARBOLADO');
  assert.equal(parsed.address, 'Córdoba 1900, ROSARIO, Santa Fe');
  assert.equal(parsed.telegramFileId, null);
  assert.equal(parsed.expectsPhoto, true);
  assert.equal(parsed.externalId, 'telegram:123:42');
  assert.equal(parsed.source, 'TELEGRAM');
  const textOnly = bot.parseBotReport({ ...payload, expectsPhoto: false }, payload.external_id);
  assert.equal(textOnly.telegramFileId, null);
  assert.equal(textOnly.expectsPhoto, false);
});
