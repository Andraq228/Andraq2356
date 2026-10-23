const { sendJson, adminCookie } = require('../_store');
module.exports = async (req, res) => req.method === 'POST' ? sendJson(res, 200, { ok: true }, { 'Set-Cookie': adminCookie(0) }) : sendJson(res, 405, { error: 'method-not-allowed' });
