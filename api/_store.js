const crypto = require('node:crypto');
const { put, list, del } = require('@vercel/blob');

const COOKIE = 'labspace_admin';
const INDEX_PATH = 'labspace/index.json';

function sendJson(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
}

function readBody(req, limit = 4_400_000) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => { total += chunk.length; if (total > limit) { reject(new Error('payload-too-large')); req.destroy(); return; } chunks.push(chunk); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => part.trim().split('=')) .filter(([key, value]) => key && value));
}

function secret() { return process.env.ADMIN_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-development-secret'); }
function signature() { return crypto.createHmac('sha256', secret()).update('labspace-admin').digest('hex'); }
function isAdmin(req) { const value = parseCookies(req)[COOKIE] || ''; const expected = signature(); return Boolean(secret()) && value.length === expected.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected)); }
function adminCookie(maxAge) { const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''; return `${COOKIE}=${maxAge ? signature() : ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`; }

async function loadLabs() {
  const result = await list({ prefix: INDEX_PATH, limit: 10 });
  const blob = result.blobs.find((item) => item.pathname === INDEX_PATH) || result.blobs[0];
  if (!blob) return [];
  const response = await fetch(`${blob.url}?v=${Date.now()}`);
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
async function saveLabs(labs) { await put(INDEX_PATH, JSON.stringify(labs), { access: 'public', addRandomSuffix: false, contentType: 'application/json' }); }
async function storeFile(pathname, buffer, contentType) { const blob = await put(pathname, buffer, { access: 'public', addRandomSuffix: false, contentType: contentType || 'application/octet-stream' }); return blob.url; }
async function removeFile(url) { if (url) { try { await del(url); } catch {} } }
function safeFilename(value) { return String(value || 'file').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100); }

module.exports = { sendJson, readBody, isAdmin, adminCookie, loadLabs, saveLabs, storeFile, removeFile, safeFilename };
