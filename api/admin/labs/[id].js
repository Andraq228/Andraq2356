const { sendJson, isAdmin, loadLabs, saveLabs, removeFile } = require('../../_store');
module.exports = async (req, res) => {
  if (req.method !== 'DELETE') return sendJson(res, 405, { error: 'method-not-allowed' });
  if (!isAdmin(req)) return sendJson(res, 401, { error: 'admin-required' });
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  try { const labs = await loadLabs(); const lab = labs.find((item) => item.id === id); if (!lab) return sendJson(res, 404, { error: 'not-found' }); await saveLabs(labs.filter((item) => item.id !== id)); await removeFile(lab.fileUrl); return sendJson(res, 200, { ok: true }); } catch { return sendJson(res, 500, { error: 'delete-failed' }); }
};
