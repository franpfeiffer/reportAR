// Endpoint local de desarrollo. No publicar en Internet.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, timingSafeEqual } = require('node:crypto');
const token = process.env.REPORTS_API_TOKEN;
if (!token) throw new Error('Falta REPORTS_API_TOKEN');
const file = path.join(__dirname, '../data/reports.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
const reports = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
http.createServer(async (req, res) => {
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  const actual = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${token}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return send(401, { error: 'unauthorized' });
  if (req.method !== 'POST' || req.url !== '/api/reports') return send(404, { error: 'not_found' });
  try {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 20000) return send(413, { error: 'payload_too_large' }); }
    const body = JSON.parse(raw);
    if (body.source !== 'telegram' || !/^telegram:-?\d+:\d+$/.test(body.external_id || '') || !['bache','inundacion','alumbrado','basura','arbolado','otro'].includes(body.category) || typeof body.description !== 'string' || body.description.length < 10 || body.description.length > 2000 || typeof body.address !== 'string' || body.address.length < 5 || body.address.length > 300 || !/^\d+$/.test(body.reporter?.telegram_user_id || '') || !/^-?\d+$/.test(body.reporter?.telegram_chat_id || '') || !Number.isFinite(Date.parse(body.reported_at)) || (body.photo !== null && (typeof body.photo?.telegram_file_id !== 'string' || !body.photo.telegram_file_id))) return send(422, { error: 'invalid_report' });
    if (req.headers['idempotency-key'] !== body.external_id) return send(422, { error: 'invalid_idempotency_key' });
    const existing = reports.find(r => r.external_id === body.external_id);
    if (existing) return send(200, { id: existing.id, status: existing.status });
    const report = { ...body, id: randomUUID(), status: 'received', created_at: new Date().toISOString() };
    const next = [...reports, report];
    fs.writeFileSync(file + '.tmp', JSON.stringify(next, null, 2), { mode: 0o600 });
    fs.renameSync(file + '.tmp', file);
    reports.push(report);
    send(201, { id: report.id, status: report.status });
  } catch { send(400, { error: 'request_failed' }); }
}).listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log('API de prueba: http://127.0.0.1:' + (process.env.PORT || 3000)));
