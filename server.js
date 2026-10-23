#!/usr/bin/env node
/* A tiny zero-dependency server for the public catalog and its admin publisher. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const url = require('node:url');

const ROOT = __dirname;
const STORAGE_ROOT = process.env.LABSPACE_STORAGE_DIR ? path.resolve(process.env.LABSPACE_STORAGE_DIR) : ROOT;
const DATA_DIR = path.join(STORAGE_ROOT, '.data');
const UPLOAD_DIR = path.join(STORAGE_ROOT, 'uploads');
const LABS_FILE = path.join(DATA_DIR, 'labs.json');
const PORT = Number(process.env.PORT) || 4173;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'labspace-admin';
const MAX_BODY = 32 * 1024 * 1024;
if (!process.env.ADMIN_PASSWORD && process.env.NODE_ENV === 'production') throw new Error('Set ADMIN_PASSWORD before starting Labspace in production');
const sessions = new Map();

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(LABS_FILE)) fs.writeFileSync(LABS_FILE, '[]\n', 'utf8');

function readLabs() {
  try {
    const parsed = JSON.parse(fs.readFileSync(LABS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function writeLabs(labs) { fs.writeFileSync(LABS_FILE, JSON.stringify(labs, null, 2) + '\n', 'utf8'); }
function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(payload);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; let chunks = [];
    req.on('data', (chunk) => { size += chunk.length; if (size > MAX_BODY) { reject(Object.assign(new Error('body too large'), { code: 'LIMIT' })); req.destroy(); return; } chunks.push(chunk); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('invalid json')); } });
    req.on('error', reject);
  });
}
function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key, value]) => key && value));
}
function isAdmin(req) {
  const token = cookies(req).labspace_session;
  const session = token && sessions.get(token);
  if (!session || session < Date.now()) { if (token) sessions.delete(token); return false; }
  return true;
}
function extension(fileName, mime) {
  const safe = String(fileName || '').toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0];
  if (safe) return safe;
  const map = { 'application/pdf': '.pdf', 'application/zip': '.zip', 'text/plain': '.txt', 'text/csv': '.csv' };
  return map[mime] || '.bin';
}
function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  if (requested.includes('..') || requested.startsWith('/.data') || requested.startsWith('/server.js')) return send(res, 404, 'Not found');
  const root = requested.startsWith('/uploads/') ? UPLOAD_DIR : ROOT;
  const relative = requested.startsWith('/uploads/') ? requested.slice('/uploads/'.length) : requested.slice(1);
  const filename = path.resolve(root, relative);
  if (!filename.startsWith(path.resolve(root) + path.sep)) return send(res, 403, 'Forbidden');
  fs.readFile(filename, (error, data) => {
    if (error) return send(res, error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 'Not found' : 'Server error');
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[path.extname(filename).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime }); res.end(data);
  });
}
async function handle(req, res) {
  const parsed = url.parse(req.url, true); const pathname = parsed.pathname;
  if (pathname === '/api/labs' && req.method === 'GET') return send(res, 200, readLabs());
  if (pathname === '/api/admin/session' && req.method === 'GET') return send(res, 200, { authenticated: isAdmin(req) });
  if (pathname === '/api/admin/login' && req.method === 'POST') {
    try { const body = await readBody(req); if (String(body.password || '') !== ADMIN_PASSWORD) return send(res, 401, { error: 'Неверный пароль' }); } catch { return send(res, 400, { error: 'Некорректный запрос' }); }
    const token = crypto.randomBytes(24).toString('hex'); sessions.set(token, Date.now() + 24 * 60 * 60 * 1000);
    return send(res, 200, { authenticated: true }, { 'Set-Cookie': `labspace_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400` });
  }
  if (pathname === '/api/admin/logout' && req.method === 'POST') { const token = cookies(req).labspace_session; if (token) sessions.delete(token); return send(res, 200, { authenticated: false }, { 'Set-Cookie': 'labspace_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' }); }
  if (pathname === '/api/admin/labs' && req.method === 'POST') {
    if (!isAdmin(req)) return send(res, 401, { error: 'Требуется вход администратора' });
    let body; try { body = await readBody(req); } catch (error) { return send(res, error.code === 'LIMIT' ? 413 : 400, { error: 'Некорректный JSON или слишком большой файл' }); }
    const dataUrl = String(body.fileDataUrl || ''); const match = dataUrl.match(/^data:([^;,]+)?;base64,([a-z0-9+/=\r\n]+)$/i);
    if (!body.title || !body.subject || !body.fileName || !match) return send(res, 400, { error: 'Нужны название, дисциплина и файл' });
    const id = `lab-${crypto.randomUUID()}`; const fileName = `${id}${extension(body.fileName, match[1])}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, fileName), Buffer.from(match[2].replace(/\s/g, ''), 'base64'));
    const now = new Date().toISOString(); const lab = { id, number: Number(body.number) || undefined, subject: String(body.subject).trim(), title: String(body.title).trim(), description: String(body.description || '').trim(), tags: Array.isArray(body.tags) ? body.tags : [], status: ['in-progress', 'submitted', 'review'].includes(body.status) ? body.status : 'in-progress', fileName: String(body.fileName), fileType: String(body.fileType || match[1] || 'application/octet-stream'), fileSize: Number(body.fileSize) || 0, fileUrl: `/uploads/${fileName}`, submittedAt: body.status === 'submitted' ? now : null, updatedAt: now, isDemo: false, published: true };
    const labs = [lab, ...readLabs()]; writeLabs(labs); return send(res, 201, lab);
  }
  if (pathname.startsWith('/api/admin/labs/') && req.method === 'DELETE') {
    if (!isAdmin(req)) return send(res, 401, { error: 'Требуется вход администратора' });
    const id = decodeURIComponent(pathname.slice('/api/admin/labs/'.length)); const labs = readLabs(); const lab = labs.find((item) => item.id === id); if (!lab) return send(res, 404, { error: 'Работа не найдена' });
    if (lab.fileUrl?.startsWith('/uploads/')) fs.rmSync(path.join(UPLOAD_DIR, path.basename(lab.fileUrl)), { force: true }); writeLabs(labs.filter((item) => item.id !== id)); return send(res, 200, { deleted: true });
  }
  if (req.method === 'GET') return serveStatic(req, res, pathname);
  return send(res, 404, { error: 'Not found' });
}

http.createServer((req, res) => handle(req, res).catch(() => send(res, 500, { error: 'Внутренняя ошибка сервера' }))).listen(PORT, () => {
  console.log(`Labspace: http://localhost:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) console.log('Admin password: labspace-admin (set ADMIN_PASSWORD before publishing)');
});
