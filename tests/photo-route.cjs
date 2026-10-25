/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test harness for the photo route. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const id = '12345678-1234-4123-8123-123456789012';

function compileRoute(report, photoUrl = null, photoStorageKey = 'reports/key') {
  const exports = {};
  const projection = { photoUrl, photoStorageKey, photoContentType: 'image/png', photoFilename: 'foto.png' };
  const db = { select: () => ({ from: () => ({ where: () => ({ limit: async () => report ? [projection] : [] }) }) }) };
  const photoService = {
    getSignedReportPhotoUrl: async (key, options) => {
      assert.equal(key, projection.photoStorageKey);
      return `https://storage.example.test/signed/${options.download ? 'download' : 'inline'}`;
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
              : name === '@/lib/reports/neon-storage' ? photoService : require(name),
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
  assert.equal(inline.status, 307);
  assert.equal(inline.headers.get('location'), 'https://storage.example.test/signed/inline');
  assert.equal(inline.headers.get('cache-control'), 'private, no-store');

  const download = await GET(new Request(`https://reportar.test/api/reports/${id}/photo?download=1`), { params: Promise.resolve({ id }) });
  assert.equal(download.status, 307);
  assert.equal(download.headers.get('location'), 'https://storage.example.test/signed/download');

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
  console.log('Photo route tests passed (Neon signed URLs, legacy Vercel Blob inline/download, invalid ID)');
})().catch(error => { console.error(error); process.exitCode = 1; });
