import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createServer } from 'node:http';

const apkPath = resolve(process.argv[2] ?? 'artifacts/field-test/AGM-Transporte-1.3.0-field-test.apk');
const port = Number(process.argv[3] ?? 8765);
const apkName = basename(apkPath);

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex').toUpperCase();
}

const apkStat = await stat(apkPath);
const apkHash = await sha256(apkPath);
const downloadPath = `/${encodeURIComponent(apkName)}`;

const server = createServer(async (request, response) => {
  const method = request.method ?? 'GET';
  const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;

  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' });
    response.end();
    return;
  }

  if (pathname === '/') {
    const html = `<!doctype html>
<html lang="ro"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AGM Transporte — APK test local</title>
<style>body{font-family:system-ui;background:#050d16;color:#eef8ff;max-width:760px;margin:0 auto;padding:32px}a{display:inline-block;background:#ff8a24;color:#071018;text-decoration:none;font-weight:800;padding:16px 22px;border-radius:14px}code{overflow-wrap:anywhere;color:#75d8ff}.card{background:#0c2030cc;border:1px solid #2b779d;padding:24px;border-radius:18px}</style>
<div class="card"><h1>AGM Transporte 1.3.0</h1><p>APK debug pentru testare locală în teren.</p><p><a href="${downloadPath}">Descarcă APK (${(apkStat.size / 1024 / 1024).toFixed(1)} MB)</a></p><p>Package: <code>com.agm.cockpit</code></p><p>SHA-256: <code>${apkHash}</code></p><p>Instalați numai pe telefoanele AGM autorizate pentru test.</p></div></html>`;
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-length': Buffer.byteLength(html),
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    if (method === 'HEAD') response.end(); else response.end(html);
    return;
  }

  if (pathname === `${downloadPath}.sha256`) {
    const body = `${apkHash}  ${apkName}\n`;
    response.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'content-length': Buffer.byteLength(body),
      'cache-control': 'no-store',
    });
    if (method === 'HEAD') response.end(); else response.end(body);
    return;
  }

  if (pathname === downloadPath) {
    response.writeHead(200, {
      'content-type': 'application/vnd.android.package-archive',
      'content-length': apkStat.size,
      'content-disposition': `attachment; filename="${apkName}"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    if (method === 'HEAD') response.end(); else createReadStream(apkPath).pipe(response);
    return;
  }

  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Not found');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`AGM field-test APK server: http://0.0.0.0:${port}/`);
  console.log(`APK: ${apkName}`);
  console.log(`SHA-256: ${apkHash}`);
});
