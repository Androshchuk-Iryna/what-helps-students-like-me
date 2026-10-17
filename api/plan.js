// POST /api/plan  { id: "practice", on: true }
// Counts how often each piece of advice is added to (or removed from) a plan.
const { pipeline, RECS, limited, body, send, wrap } = require('../lib/store');

module.exports = wrap(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const b = await body(req);
  if (!RECS.includes(b.id)) return send(res, 400, { error: 'bad_id' });
  if (await limited(req, 'plan', 60, 3600)) return send(res, 429, { error: 'rate' });
  await pipeline([['HINCRBY', 'pisa:plan', b.id, b.on === false ? -1 : 1]]);
  send(res, 200, { ok: true });
});
