/**
 * digital-fireworks 専用の静的ファイルサーバ。
 * 依存パッケージゼロ。Node 18+ の標準モジュールだけで動く。
 *
 *   node server.mjs             -> http://localhost:5180
 *   node server.mjs --port 8080 -> http://localhost:8080
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const portArgIndex = argv.findIndex((a) => a === '--port' || a === '-p');
const PORT = Number(
  (portArgIndex >= 0 ? argv[portArgIndex + 1] : undefined) ?? process.env.PORT ?? 5180
);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    ...headers,
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);
  // ディレクトリトラバーサル防止
  if (!filePath.startsWith(ROOT)) {
    return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      return send(res, 404, 'Not Found: ' + urlPath, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    send(res, 200, data, { 'Content-Type': type });
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  🎆  digital-fireworks');
  console.log('  ─────────────────────────────────────');
  console.log('  ローカル:  http://localhost:' + PORT + '/');
  console.log('  停止:      Ctrl + C');
  console.log('');
});
