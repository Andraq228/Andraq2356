const crypto = require('node:crypto');
const { sendJson, readBody, isAdmin, loadLabs, saveLabs, storeFile, removeFile, safeFilename } = require('../../_store');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });
  if (!isAdmin(req)) return sendJson(res, 401, { error: 'admin-required' });
  try {
    const body = JSON.parse(await readBody(req));
    const match = String(body.fileDataUrl || '').match(/^data:([^;,]+);base64,(.+)$/);
    if (!body.title || !match) return sendJson(res, 400, { error: 'title-and-file-required' });
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 3 * 1024 * 1024) return sendJson(res, 413, { error: 'file-too-large' });
    const id = `lab-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const fileName = safeFilename(body.fileName);
    const fileUrl = await storeFile(`labspace/files/${id}-${fileName}`, buffer, match[1]);
    const lab = { id, title: String(body.title).trim(), description: String(body.description || '').trim(), subject: String(body.subject || 'Другое'), status: String(body.status || 'submitted'), fileName: body.fileName || fileName, fileType: body.fileType || match[1], fileSize: buffer.length, publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), fileUrl };
    try { const labs = await loadLabs(); await saveLabs([lab, ...labs]); } catch (error) { await removeFile(fileUrl); throw error; }
    return sendJson(res, 201, { lab });
  } catch (error) { return sendJson(res, error.message === 'payload-too-large' ? 413 : 400, { error: 'publish-failed' }); }
};
