const { sendJson, loadLabs } = require('./_store');
module.exports = async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' }, { Allow: 'GET' });
  try { return sendJson(res, 200, { labs: await loadLabs() }); } catch (error) { return sendJson(res, 500, { error: 'catalog-unavailable' }); }
};
