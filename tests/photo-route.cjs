/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test harness for the photo route. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const id = '12345678-1234-4123-8123-123456789012';
const image = Buffer.from('private-image');

function compileRoute(report, photoUrl = null, photoStorageKey = 'reports/key') {
  const exports = {};
  const projection = { photoUrl, photoStorageKey, photoContentType: 'image/png', photoFilename: 'foto.png' };
  const db = { select: () => ({ from: () => ({ where: () => ({ limit: async () => report ? [projection] : [] }) }) }) };
  const photoService = {
    getTelegramPhoto: async key => {
      assert.equal(key, projection.photoStorageKey);
      return {
        ContentLength: image.length,
        ContentType: 'image/png',
        Body: { transformToWebStream: () => new ReadableStream({ start(controller) { controller.enqueue(image); controller.close(); } }) },
      };
    },
  };
  const source = fs.readFileSync(path.join(root, 'app/api/reports/[id]/photo/route.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, {
    exports,
    require: name => name === '@reportar/db' ? { db }
      : name === '@reportar/db/schema' ? { citizenReports: { publicId: 'publicId', photoUrl: 'photoUrl', photoStorageKey: 'photoStorageKey', photoContentType: 'photoContentType', photoFilename: 'photoFilename' } }
        : name === 'drizzle-orm' ? { eq: () => true }
          : name === '@vercel/blob' ? { head: async () => ({ downloadUrl: 'https://download.example.test/foto.png' }) }
            : name === '@/lib/reports/validation' ? { isUuid: value => /^[0-9a-f-]{36}$/i.test(value) }
              : name === '@/lib/reports/telegram-photo' ? photoService : require(name),
    Buffer,
    Response,
    Headers,
    URL,
    ReadableStream,
  });
  return exports;
}

(async () => {
  const { GET } = compileRoute(true);
  const inline = await GET(new Request(`https://reportar.test/api/reports/${id}/photo`), { params: Promise.resolve({ id }) });
  assert.equal(inline.status, 200);
  assert.equal(inline.headers.get('content-type'), 'image/png');
  assert.equal(inline.headers.get('content-disposition'), 'inline; filename="foto.png"');
  assert.deepEqual(Buffer.from(await inline.arrayBuffer()), image);

  const download = await GET(new Request(`https://reportar.test/api/reports/${id}/photo?download=1`), { params: Promise.resolve({ id }) });
  assert.equal(download.headers.get('content-disposition'), 'attachment; filename="foto.png"');

  const webBlobUrl = 'https://abc.public.blob.vercel-storage.com/foto.png';
  const { GET: getWebBlob } = compileRoute(true, webBlobUrl, null);
  const webInline = await getWebBlob(new Request(`https://reportar.test/api/reports/${id}/photo`), { params: Promise.resolve({ id }) });
  assert.equal(webInline.status, 307);
  assert.equal(webInline.headers.get('location'), webBlobUrl);
  const webDownload = await getWebBlob(new Request(`https://reportar.test/api/reports/${id}/photo?download=1`), { params: Promise.resolve({ id }) });
  assert.equal(webDownload.status, 307);
  assert.equal(webDownload.headers.get('location'), 'https://download.example.test/foto.png');

  const missing = await GET(new Request('https://reportar.test/api/reports/not-a-uuid/photo'), { params: Promise.resolve({ id: 'not-a-uuid' }) });
  assert.equal(missing.status, 404);
  console.log('Telegram photo route tests passed (private read, Telegram inline/download, Vercel Blob inline/download, invalid ID)');
})().catch(error => { console.error(error); process.exitCode = 1; });
