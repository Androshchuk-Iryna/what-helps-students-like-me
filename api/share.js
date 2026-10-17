// POST /api/share  { sel, subj, plan: [ids] }  -> { id }
// GET  /api/share?id=abc123                     -> { sel, subj, plan }
const crypto = require('crypto');
const { pipeline, SUBJ, RECS, cleanSel, limited, body, send, wrap } = require('../lib/store');

module.exports = wrap(async (req, res) => {
  if (req.method === 'GET') {
    const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
    if (!/^[A-Za-z0-9_-]{6,12}$/.test(id)) return send(res, 400, { error: 'bad_id' });
    const [v] = await pipeline([['GET', 'pisa:share:' + id]]);
    if (!v) return send(res, 404, { error: 'not_found' });
    return send(res, 200, JSON.parse(v), 'public, s-maxage=86400');
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const b = await body(req);
  const sel = cleanSel(b.sel);
  if (!sel) return send(res, 400, { error: 'bad_sel' });
  if (await limited(req, 'share', 30, 3600)) return send(res, 429, { error: 'rate' });
  const subj = SUBJ.includes(b.subj) ? b.subj : 'ALL';
  const plan = Array.isArray(b.plan) ? [...new Set(b.plan.filter(x => RECS.includes(x)))] : [];
  const id = crypto.randomBytes(6).toString('base64url').slice(0, 8);
  await pipeline([['SET', 'pisa:share:' + id, JSON.stringify({ sel, subj, plan }), 'EX', 60 * 60 * 24 * 365]]);
  send(res, 200, { id });
});
