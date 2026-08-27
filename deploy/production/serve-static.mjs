import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = process.env.AGM_WEB_ROOT ?? '/srv/agm-web';
const port = Number(process.env.PORT ?? 4173);
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
]);

function safeFile(pathname) {
  const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  const candidate = join(root, relative);
  if (!candidate.startsWith(root)) return null;
  try {
    return statSync(candidate).isFile() ? candidate : null;
  } catch {
    return null;
  }
}

createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (pathname === '/') {
    response.writeHead(308, {
      'Cache-Control': 'no-cache',
      Location: '/basic',
    }).end();
    return;
  }
  const requested = pathname;
  const file = safeFile(requested) ?? join(root, 'index.html');
  const headers = {
    'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    'Content-Security-Policy': "default-src 'self'; connect-src 'self' https://api.agmcockpit.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; frame-ancestors 'none'",
    'Content-Type': mime.get(extname(file).toLowerCase()) ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  };
  response.writeHead(200, headers);
  if (request.method === 'HEAD') response.end();
  else createReadStream(file).pipe(response);
}).listen(port, '0.0.0.0');
