// POST /api/visit  { sel: {ses:1,...}, subj: "ALL" }
// Records one anonymous answer profile (the page sends it once per browser session).
const { pipeline, DIMS, SUBJ, cleanSel, limited, body, send, wrap } = require('../lib/store');

module.exports = wrap(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const b = await body(req);
  const sel = cleanSel(b.sel);
  if (!sel) return send(res, 400, { error: 'bad_sel' });
  if (await limited(req, 'visit', 10, 3600)) return send(res, 429, { error: 'rate' });
  const subj = SUBJ.includes(b.subj) ? b.subj : 'ALL';
  const cmds = [['INCR', 'pisa:visits'], ['HINCRBY', 'pisa:subj', subj, 1]];
  for (const k of Object.keys(DIMS)) cmds.push(['HINCRBY', 'pisa:dim:' + k, sel[k], 1]);
  // How many hard conditions at once (0..), useful for the "you are not alone" line.
  const hard = (sel.hc + sel.hn) + (sel.sc + sel.sn) + sel.cu + sel.pe + sel.safe + sel.bul + sel.be + (sel.ses === 0 ? 1 : 0);
  cmds.push(['HINCRBY', 'pisa:hard', Math.min(hard, 5), 1]);
  await pipeline(cmds);
  send(res, 200, { ok: true });
});
