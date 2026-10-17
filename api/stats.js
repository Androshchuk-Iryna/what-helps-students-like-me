// GET /api/stats -> aggregated anonymous answers of everyone who used the page
const { pipeline, hash, DIMS, send, wrap } = require('../lib/store');

module.exports = wrap(async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method' });
  const keys = Object.keys(DIMS);
  const out = await pipeline([
    ['GET', 'pisa:visits'], ['GET', 'pisa:fb:yes'], ['GET', 'pisa:fb:no'],
    ['HGETALL', 'pisa:plan'], ['HGETALL', 'pisa:hard'], ['HGETALL', 'pisa:subj'],
    ...keys.map(k => ['HGETALL', 'pisa:dim:' + k]),
  ]);
  const dims = {};
  keys.forEach((k, i) => {
    const h = hash(out[6 + i]);
    dims[k] = Array.from({ length: DIMS[k] }, (_, j) => h[j] || 0);
  });
  const hard = hash(out[4]);
  send(res, 200, {
    visits: +out[0] || 0,
    feedback: { yes: +out[1] || 0, no: +out[2] || 0 },
    plan: hash(out[3]),
    hard: [0, 1, 2, 3, 4, 5].map(i => hard[i] || 0),
    subj: hash(out[5]),
    dims,
  }, 'public, max-age=0, s-maxage=10, stale-while-revalidate=30');
});
