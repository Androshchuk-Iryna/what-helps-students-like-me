// Local preview: `npm run dev` -> http://localhost:3000 (uses an in-memory store).
const http = require('http'), fs = require('fs'), path = require('path');
const routes = Object.fromEntries(fs.readdirSync(path.join(__dirname, 'api')).map(f => [f.replace(/\.js$/, ''), require('./api/' + f)]));
http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  const m = p.match(/^\/api\/([a-z]+)$/);
  if (m && routes[m[1]]) return routes[m[1]](req, res);
  if (p === '/' || p === '/index.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res); }
  res.statusCode = 404; res.end('not found');
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
