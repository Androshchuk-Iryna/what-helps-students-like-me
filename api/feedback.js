// POST /api/feedback  { useful: true|false, text?: string }
// GET  /api/feedback?key=ADMIN_KEY  -> latest comments (only if ADMIN_KEY env is set)
const { pipeline, limited, body, send, wrap } = require('../lib/store');

module.exports = wrap(async (req, res) => {
  if (req.method === 'GET') {
    const key = process.env.ADMIN_KEY;
    const url = new URL(req.url, 'http://x');
    if (!key || url.searchParams.get('key') !== key) return send(res, 403, { error: 'forbidden' });
    const [list] = await pipeline([['LRANGE', 'pisa:fb:list', 0, 199]]);
    return send(res, 200, { items: (list || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean) });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const b = await body(req);
  if (typeof b.useful !== 'boolean') return send(res, 400, { error: 'bad_useful' });
  if (await limited(req, 'fb', 5, 3600)) return send(res, 429, { error: 'rate' });
  const text = typeof b.text === 'string' ? b.text.trim().slice(0, 600) : '';
  const cmds = [['INCR', b.useful ? 'pisa:fb:yes' : 'pisa:fb:no']];
  if (text) cmds.push(['LPUSH', 'pisa:fb:list', JSON.stringify({ t: Date.now(), useful: b.useful, text })], ['LTRIM', 'pisa:fb:list', 0, 999]);
  await pipeline(cmds);
  send(res, 200, { ok: true });
});
