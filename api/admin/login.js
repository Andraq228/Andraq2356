const { sendJson, readBody, adminCookie } = require('../_store');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });
  if (!process.env.ADMIN_PASSWORD) return sendJson(res, 500, { error: 'ADMIN_PASSWORD is not configured' });
  try { const body = JSON.parse(await readBody(req, 20_000)); if (body.password !== process.env.ADMIN_PASSWORD) return sendJson(res, 401, { error: 'invalid-password' }); return sendJson(res, 200, { ok: true }, { 'Set-Cookie': adminCookie(604800) }); } catch { return sendJson(res, 400, { error: 'invalid-request' }); }
};
