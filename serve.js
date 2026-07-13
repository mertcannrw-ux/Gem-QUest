// Minimal development server with safe path resolution and production-like
// security headers. For public hosting, deploy the static files behind a CDN.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = fs.realpathSync(path.resolve(__dirname));
const PUBLIC_TOP_LEVEL = new Set(['index.html', 'styles.css', 'js', 'assets']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.wav':  'audio/wav',
  '.mp3':  'audio/mpeg'
};

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }

  const rawTarget = String(req.url || '').split(/[?#]/, 1)[0];
  let decodedTarget;
  try {
    decodedTarget = decodeURIComponent(rawTarget).replaceAll('\\', '/');
  } catch (_) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  let pathname = decodedTarget;
  if (pathname === '/') pathname = '/index.html';
  const relativePath = pathname.replace(/^[/\\]+/, '');
  const segments = relativePath.split('/');
  const isPublicPath = (
    (relativePath === 'index.html' || relativePath === 'styles.css') ||
    ((segments[0] === 'js' || segments[0] === 'assets') && segments.length > 1)
  );

  if (
    !isPublicPath ||
    !PUBLIC_TOP_LEVEL.has(segments[0]) ||
    segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.'))
  ) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const fpath = path.resolve(ROOT, relativePath);
  const insideRoot = fpath === ROOT || fpath.startsWith(ROOT + path.sep);
  if (!insideRoot) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.realpath(fpath, (resolveError, realPath) => {
    if (resolveError) {
      res.writeHead(resolveError.code === 'EACCES' ? 403 : 404);
      res.end('Not found');
      return;
    }

    const insidePublicRoot = realPath === ROOT || realPath.startsWith(ROOT + path.sep);
    if (!insidePublicRoot) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(realPath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'EACCES' ? 403 : 404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(fpath).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // This bundled server is for local development. Never cache assets or
      // browsers can keep running stale JavaScript after an edit.
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' https://sdk.crazygames.com",
        "connect-src 'self' https://*.crazygames.com wss://*.crazygames.com",
        "img-src 'self' data:",
        // The game updates DOM control positions and visibility via element.style.
        // Keep scripts strict while allowing these narrowly scoped inline styles.
        "style-src 'self' 'unsafe-inline'",
        "media-src 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'self' https://*.crazygames.com"
      ].join('; ')
    };
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
});

const requestedPort = Number.parseInt(process.env.PORT || '8080', 10);
const PORT = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort < 65536
  ? requestedPort
  : 8080;
server.listen(PORT, '127.0.0.1', () => {
  console.log('Serving ' + ROOT + ' on http://localhost:' + PORT);
});
