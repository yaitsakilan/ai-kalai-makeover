const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Prevent directory traversal attacks and decode URI
    let safeUrl = path.normalize(decodeURIComponent(req.url)).replace(/^(\.\.[\/\\])+/, '');
    if (safeUrl === '/' || safeUrl === '\\') {
        safeUrl = '/index.html';
    }

    const filePath = path.join(__dirname, safeUrl);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        const headers = { 'Content-Type': contentType };
        if (ext === '.html') {
            headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            headers['Pragma'] = 'no-cache';
            headers['Expires'] = '0';
        }

        res.writeHead(200, headers);
        
        const stream = fs.createReadStream(filePath);
        stream.on('error', (streamErr) => {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Internal Server Error');
        });
        stream.pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Serving: index.html`);
});
