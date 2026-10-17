// GET /api/health -> { db: true|false }
const { enabled, pipeline, send, wrap } = require('../lib/store');
module.exports = wrap(async (req, res) => {
  let db = false;
  if (enabled()) { try { await pipeline([['GET', 'pisa:visits']]); db = true; } catch {} }
  send(res, 200, { ok: true, db });
});
