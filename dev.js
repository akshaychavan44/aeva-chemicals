// Local static server for the site. `pnpm dev` (or `node dev.js`); PORT overrides 5288,
// and if the port is busy it moves to the next free one.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

let port = Number(process.env.PORT) || 5288;

const notFound = (res) => {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
};

// api/cms.mjs is written for Vercel, which parses the query and JSON body and adds
// res.status() and res.json(). Add the same here so the admin panel works locally.
// Returns false if it has already answered the request.
async function addVercelHelpers(req, res) {
  const LIMIT = 5 * 1024 * 1024; // Vercel's request body limit is about 4.5 MB
  res.status = code => { res.statusCode = code; return res; };
  res.json = value => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(value));
    return res;
  };
  req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > LIMIT) { res.status(413).json({ error: 'Request is too large.' }); return false; }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text && /^application\/json\b/i.test(req.headers['content-type'] || '')) {
    try { req.body = JSON.parse(text); } catch { res.status(400).json({ error: 'Invalid JSON.' }); return false; }
  }
  // The admin API only accepts changes sent from https://<its own address>. This server is
  // plain http on 127.0.0.1, so treat a request from this same local address as that.
  if (req.headers.origin === `http://${req.headers.host}`) req.headers.origin = `https://${req.headers.host}`;
  return true;
}

const server = http.createServer(async (req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    return notFound(res); // malformed escape in the URL
  }
  // GitHub Pages serves the site under /aeva-chemicals/, so accept that prefix too.
  urlPath = urlPath.replace(/^\/aeva-chemicals(?=\/)/, '');

  if (urlPath === '/api/inquiry' || urlPath === '/api/cms') {
    if (!process.env.DATABASE_URL && fs.existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));
  }

  if (urlPath === '/api/inquiry') {
    const { default: inquiry } = await import('./api/inquiry.mjs');
    return inquiry(req, res);
  }

  if (urlPath === '/api/cms') {
    if (!(await addVercelHelpers(req, res))) return;
    const { default: cms } = await import('./api/cms.mjs');
    return cms(req, res);
  }

  const segments = path.normalize(urlPath).split(path.sep);
  if (segments.some(segment => segment.startsWith('.'))) return notFound(res);

  let filePath = path.join(ROOT, urlPath);
  // Never serve anything outside the project folder.
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) return notFound(res);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');

  fs.readFile(filePath, (err, data) => {
    if (err) return notFound(res);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

server.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') throw err;
  console.warn(`  Port ${port} is in use, trying ${port + 1}...`);
  server.listen(++port, '127.0.0.1');
});

server.listen(port, '127.0.0.1', () => console.log(`\n  ➜  Local:   http://127.0.0.1:${port}/\n`));
