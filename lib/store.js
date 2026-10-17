// Minimal Upstash Redis REST client (no dependencies).
// Works with the Vercel Marketplace "Upstash for Redis" integration, which sets
// KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN).
const crypto = require('crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// In-memory fallback for local development (`node dev-server.js`) when no DB is set.
const mem = global.__pisaMem || (global.__pisaMem = new Map());
const memCmd = ([c, k, ...a]) => {
  c = c.toUpperCase();
  const get = () => mem.get(k);
  switch (c) {
    case 'INCR': case 'INCRBY': { const v = (+get() || 0) + (c === 'INCR' ? 1 : +a[0]); mem.set(k, String(v)); return v; }
    case 'GET': return get() ?? null;
    case 'SET': { if (a.includes('NX') && mem.has(k)) return null; mem.set(k, a[0]); return 'OK'; }
    case 'EXPIRE': return 1;
    case 'HINCRBY': { const h = get() || {}; h[a[0]] = String((+h[a[0]] || 0) + +a[1]); mem.set(k, h); return +h[a[0]]; }
    case 'HGETALL': { const h = get() || {}; return Object.entries(h).flat(); }
    case 'LPUSH': { const l = get() || []; l.unshift(...a.reverse()); mem.set(k, l); return l.length; }
    case 'LTRIM': { const l = get() || []; mem.set(k, l.slice(+a[0], +a[1] + 1)); return 'OK'; }
    case 'LRANGE': { const l = get() || []; return l.slice(+a[0], +a[1] === -1 ? undefined : +a[1] + 1); }
    default: throw new Error('unsupported ' + c);
  }
};

const enabled = () => Boolean(URL_ && TOKEN) || process.env.PISA_MEMORY_STORE === '1';

async function pipeline(cmds) {
  if (!URL_ || !TOKEN) {
    if (process.env.PISA_MEMORY_STORE === '1') return cmds.map(memCmd);
    throw Object.assign(new Error('Database is not connected'), { status: 503 });
  }
  const r = await fetch(URL_.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds.map(c => c.map(String))),
  });
  if (!r.ok) throw Object.assign(new Error('Redis error ' + r.status), { status: 502 });
  const out = await r.json();
  return out.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

const hash = arr => { const o = {}; for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = +arr[i + 1]; return o; };

// Answer options per question (must match DIMS in index.html).
const DIMS = { ses: 3, hc: 2, hn: 2, sc: 2, sn: 2, ai: 3, cu: 2, pe: 2, safe: 2, bul: 2, be: 2 };
const SUBJ = ['ALL', 'MATH', 'READ', 'SCIE'];
const RECS = ['safety', 'practice', 'selfreg', 'ifthen', 'growth', 'phone', 'ai', 'tech', 'belong'];

function cleanSel(sel) {
  if (!sel || typeof sel !== 'object') return null;
  const out = {};
  for (const [k, n] of Object.entries(DIMS)) {
    const v = Number(sel[k]);
    if (!Number.isInteger(v) || v < 0 || v >= n) return null;
    out[k] = v;
  }
  return out;
}

function ipKey(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  return crypto.createHash('sha256').update(ip + (process.env.KV_REST_API_TOKEN || 'salt')).digest('hex').slice(0, 16);
}

// Simple fixed-window limit: `max` requests per `win` seconds per IP and bucket.
async function limited(req, bucket, max, win) {
  const k = 'pisa:rl:' + bucket + ':' + ipKey(req);
  const [n] = await pipeline([['INCR', k], ['EXPIRE', k, win]]);
  return n > max;
}

async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
}

function send(res, status, data, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(JSON.stringify(data));
}

function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) { send(res, e.status || 500, { error: e.status === 503 ? 'db_not_connected' : 'server_error' }); if (!e.status) console.error(e); }
  };
}

module.exports = { pipeline, hash, DIMS, SUBJ, RECS, cleanSel, limited, body, send, wrap, enabled };
