const { sendJson, isAdmin } = require('../_store');
module.exports = async (req, res) => sendJson(res, req.method === 'GET' ? 200 : 405, req.method === 'GET' ? { authenticated: isAdmin(req) } : { error: 'method-not-allowed' });
