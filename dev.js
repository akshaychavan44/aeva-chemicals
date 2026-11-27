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

const server = http.createServer(async (req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    return notFound(res); // malformed escape in the URL
  }
  // GitHub Pages serves the site under /aeva-chemicals/, so accept that prefix too.
  urlPath = urlPath.replace(/^\/aeva-chemicals(?=\/)/, '');

  if (urlPath === '/api/inquiry') {
    if (!process.env.DATABASE_URL && fs.existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));
    const { default: inquiry } = await import('./api/inquiry.mjs');
    return inquiry(req, res);
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
