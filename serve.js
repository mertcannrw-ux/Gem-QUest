// Quick local server that handles the trailing-space path issue.
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = process.cwd();

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
  let p = decodeURIComponent(url.parse(req.url).pathname);
  if (p === '/') p = '/index.html';
  const fpath = path.join(ROOT, p);
  fs.readFile(fpath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + p);
      return;
    }
    const ext = path.extname(fpath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Serving ' + ROOT + ' on http://localhost:' + PORT);
});
