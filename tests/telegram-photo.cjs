/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness for the Telegram photo service. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'lib/reports/telegram-photo.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const reportId = '12345678-1234-4123-8123-123456789012';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv5sAAAAASUVORK5CYII=', 'base64');

function loadPhotoService({ fetch, env = {} }) {
  const calls = [];
  const clients = [];
  class S3Client {
    constructor(options) { this.options = options; this.commands = []; clients.push(this); }
    async send(command) { this.commands.push(command); return {}; }
  }
  class PutObjectCommand { constructor(input) { this.input = input; } }
  class GetObjectCommand { constructor(input) { this.input = input; } }
  const aws = { S3Client, PutObjectCommand, GetObjectCommand };
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require: id => id === '@aws-sdk/client-s3' ? aws : require(id),
    process: { env: { ...env } },
    Buffer,
    URL,
    AbortSignal,
    fetch: async (...args) => { calls.push(args); return fetch(...args); },
    console,
  });
  return { service: exports, calls, clients };
}

const configured = {
  TELEGRAM_BOT_TOKEN: 'test-token',
  AWS_ACCESS_KEY_ID: 'test-access-key',
  AWS_SECRET_ACCESS_KEY: 'test-secret-key',
  AWS_ENDPOINT_URL_S3: 'https://storage.example.test',
  AWS_REGION: 'us-east-1',
  REPORT_IMAGES_BUCKET: 'report-images',
};

test('downloads one image, validates its bytes, and uploads a stable private object key', async () => {
  const { service, calls, clients } = loadPhotoService({
    env: configured,
    fetch: async url => String(url).endsWith('/getFile')
      ? Response.json({ ok: true, result: { file_path: 'photos/telegram-photo.png', file_size: png.length } })
      : new Response(png, { headers: { 'content-length': String(png.length), 'content-type': 'application/octet-stream' } }),
  });
  const result = await service.storeTelegramPhoto(reportId, 'telegram-file-id');
  assert.equal(result.contentType, 'image/png');
  assert.equal(result.filename, 'foto.png');
  assert.match(result.key, new RegExp(`^reports/${reportId}/telegram-[a-f0-9]{24}\\.png$`));
  assert.equal(calls.length, 2);
  assert.equal(clients[0].options.forcePathStyle, true);
  assert.equal(clients[0].commands[0].input.Bucket, 'report-images');
  assert.equal(clients[0].commands[0].input.ContentType, 'image/png');
  assert.deepEqual(Buffer.from(clients[0].commands[0].input.Body), png);
});

test('rejects Telegram files above 20 MB before downloading', async () => {
  const { service, clients } = loadPhotoService({
    env: configured,
    fetch: async () => Response.json({ ok: true, result: { file_path: 'photos/too-large.png', file_size: 20 * 1024 * 1024 + 1 } }),
  });
  await assert.rejects(service.storeTelegramPhoto(reportId, 'large-file-id'), /download limit/);
  assert.equal(clients.length, 0);
});

test('checks declared content type against real image bytes', async () => {
  for (const contentType of ['text/html', 'image/jpeg']) {
    const invalidType = loadPhotoService({
      env: configured,
      fetch: async url => String(url).endsWith('/getFile')
        ? Response.json({ ok: true, result: { file_path: 'photos/mismatch.png' } })
        : new Response(png, { headers: { 'content-type': contentType } }),
    });
    await assert.rejects(invalidType.service.storeTelegramPhoto(reportId, 'wrong-type'), /content type/);
    assert.equal(invalidType.clients.length, 0);
  }
});

test('enforces the 20 MB limit while streaming when content length is absent', async () => {
  const tooLarge = new Uint8Array(20 * 1024 * 1024 + 1);
  const { service, clients } = loadPhotoService({
    env: configured,
    fetch: async url => String(url).endsWith('/getFile')
      ? Response.json({ ok: true, result: { file_path: 'photos/streamed-large.png' } })
      : new Response(new ReadableStream({ start(controller) { controller.enqueue(tooLarge); controller.close(); } })),
  });
  await assert.rejects(service.storeTelegramPhoto(reportId, 'streamed-large'), /download limit/);
  assert.equal(clients.length, 0);
});

test('does not reach storage when Telegram fails to provide a file', async () => {
  const { service, calls, clients } = loadPhotoService({
    env: configured,
    fetch: async () => new Response('unavailable', { status: 502 }),
  });
  await assert.rejects(service.storeTelegramPhoto(reportId, 'unavailable'), /getFile failed/);
  assert.equal(calls.length, 1);
  assert.equal(clients.length, 0);
});

test('rejects non-image content and unsafe Telegram file paths', async () => {
  const nonImage = loadPhotoService({
    env: configured,
    fetch: async url => String(url).endsWith('/getFile')
      ? Response.json({ ok: true, result: { file_path: 'photos/not-image.bin' } })
      : new Response('<html>not an image</html>', { headers: { 'content-type': 'application/octet-stream' } }),
  });
  await assert.rejects(nonImage.service.storeTelegramPhoto(reportId, 'not-image'), /not a supported image/);
  assert.equal(nonImage.clients.length, 0);

  const unsafePath = loadPhotoService({
    env: configured,
    fetch: async () => Response.json({ ok: true, result: { file_path: '../private.png' } }),
  });
  await assert.rejects(unsafePath.service.storeTelegramPhoto(reportId, 'bad-path'), /invalid file path/);
  assert.equal(unsafePath.calls.length, 1);
});

test('only reads Telegram photos from the expected report key namespace', async () => {
  const { service, clients } = loadPhotoService({ env: configured, fetch: async () => { throw new Error('unexpected fetch'); } });
  await assert.rejects(service.getTelegramPhoto('../private.png'), /Invalid Telegram photo storage key/);
  assert.equal(clients.length, 0);
});

test('reports missing server credentials without attempting Telegram or Neon', async () => {
  const { service, calls, clients } = loadPhotoService({ fetch: async () => { throw new Error('unexpected fetch'); } });
  await assert.rejects(service.storeTelegramPhoto(reportId, 'file-id'), /token is not configured/);
  assert.equal(calls.length, 0);
  assert.equal(clients.length, 0);
});
