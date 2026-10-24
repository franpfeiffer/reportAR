/* eslint-disable @typescript-eslint/no-require-imports -- Exercise handlers and SDK without a real store. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const id = 'bbddc5e7-027b-4613-a1ae-c9ec8176f51c';
const token = 'a'.repeat(64);
const pathname = `reports/${id}/${id}-foto.heic`;
const bytes = Buffer.from('original HEIC bytes preserved');
const blob = { url: `https://teststore.public.blob.vercel-storage.com/${pathname}`, pathname, contentType: 'image/heic', downloadUrl: 'https://teststore.public.blob.vercel-storage.com/download', contentDisposition: 'attachment', size: bytes.length };
let available = true;
function compile(file, load) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, require: load, process, Buffer, Response, Request, URL, console });
  return exports;
}
const photoService = { MAX_PHOTO_BYTES: 100 * 1024 * 1024, canUploadPhoto: async (reportId, capability) => available && reportId === id && capability === token };
const validation = { isRecord: value => value !== null && typeof value === 'object' && !Array.isArray(value), isUuid: value => value === id };
const request = body => new Request('https://reportar.test/api/reports/photo-upload', { method: 'POST', body: JSON.stringify(body) });
const body = (file = pathname, client = 'n8n', capability = token) => ({ type: 'blob.generate-client-token', payload: { pathname: file, multipart: false, clientPayload: JSON.stringify({ reportId: id, token: capability, client }) } });
const decode = clientToken => JSON.parse(Buffer.from(Buffer.from(clientToken.split('_')[4], 'base64').toString().split('.')[1], 'base64').toString());

(async () => {
  const client = await import('@vercel/blob/client');
  const uploadRoute = compile('app/api/reports/photo-upload/route.ts', name => name === '@vercel/blob/client' ? client : name === '@/lib/reports/photo-upload' ? photoService : name === '@/lib/reports/validation' ? validation : require(name));
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_teststore_testonly';
  try {
    const response = await uploadRoute.POST(request(body()));
    assert.equal(response.status, 200);
    const authorized = await response.json();
    const claims = decode(authorized.clientToken);
    assert.equal(claims.pathname, pathname);
    assert.equal(claims.maximumSizeInBytes, 100 * 1024 * 1024);
    assert.equal(claims.allowOverwrite, true);
    assert.equal(claims.addRandomSuffix, false);
    assert.ok(claims.validUntil > Date.now() && claims.validUntil <= Date.now() + 10 * 60_000);
    const web = await uploadRoute.POST(request(body(pathname, 'web')));
    assert.equal(decode((await web.json()).clientToken).allowOverwrite, undefined);
    assert.equal((await uploadRoute.POST(request(body('reports/wrong-report/foto.jpg')))).status, 400);
    assert.equal((await uploadRoute.POST(request(body(pathname, 'n8n', 'wrong')))).status, 400);

    // Compare the n8n HTTP upload with the actual SDK request on a mock transport.
    const req = createRequire(require.resolve('@vercel/blob'));
    const { MockAgent, getGlobalDispatcher, setGlobalDispatcher } = req('undici');
    const previousDispatcher = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    let captured;
    mock.get('https://vercel.com').intercept({ method: 'PUT', path: '/api/blob/?' + new URLSearchParams({ pathname }) }).reply(options => {
      captured = options;
      return { statusCode: 200, data: JSON.stringify(blob), responseOptions: { headers: { 'content-type': 'application/json' } } };
    });
    setGlobalDispatcher(mock);
    try {
      const saved = await client.put(pathname, bytes, { access: 'public', token: authorized.clientToken, contentType: 'image/heic' });
      assert.equal(saved.url, blob.url);
      assert.deepEqual(Buffer.from(captured.body), bytes);
      const headers = new Headers(captured.headers);
      const workflow = require('../integrations/telegram-bot/n8n/reportes-formulario-demo.json');
      const putNode = workflow.nodes.find(node => node.id === 'photo-put');
      const item = { pathname, clientToken: authorized.clientToken, store_id: 'teststore', content_type: 'image/heic' };
      const evaluate = expression => expression.startsWith('={{') ? vm.runInNewContext(expression.slice(3, -2).trim(), { $json: item }) : expression;
      for (const header of putNode.parameters.headerParameters.parameters) assert.equal(evaluate(header.value), headers.get(header.name));
      assert.equal(putNode.parameters.url + '?' + new URLSearchParams({ pathname }), 'https://vercel.com' + captured.path);
      mock.assertNoPendingInterceptors();
    } finally { setGlobalDispatcher(previousDispatcher); await mock.close(); }

    let stored;
    const db = { update: () => ({ set: values => ({ where: () => ({ returning: async () => { stored = values; available = false; return [{ id }]; } }) }) }) };
    const attachment = compile('app/api/reports/[id]/photo/attach/route.ts', name => name === '@vercel/blob' ? { head: async url => { assert.equal(url, blob.url); return blob; } }
      : name === '@reportar/db' ? { db } : name === '@reportar/db/schema' ? { citizenReports: {} }
        : name === 'drizzle-orm' ? { eq: () => true, and: () => true }
          : name === '@/lib/reports/photo-upload' ? photoService : name === '@/lib/reports/validation' ? validation : require(name));
    const params = { params: Promise.resolve({ id }) };
    assert.equal((await attachment.POST(request({ token, url: 'https://untrusted.test/photo' }), params)).status, 400);
    const attached = await attachment.POST(request({ token, url: blob.url }), params);
    assert.equal(attached.status, 200);
    assert.deepEqual(await attached.json(), { ok: true });
    assert.equal(stored.photoUrl, blob.url);
    assert.equal(stored.photoFilename, 'foto.heic');
    assert.equal(stored.photoUploadTokenHash, null);
    assert.equal((await attachment.POST(request({ token, url: blob.url }), params)).status, 403);
    assert.equal((await uploadRoute.POST(request(body()))).status, 400);
    delete process.env.BLOB_READ_WRITE_TOKEN;
    assert.equal((await uploadRoute.POST(request(body()))).status, 503);
    console.log('Shared Blob tests passed (web capability, scoped token, exact SDK upload protocol, original bytes, attach and consumed token).');
  } finally {
    if (previousToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previousToken;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
