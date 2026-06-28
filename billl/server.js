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

function handleLocalGroqProxy(req, res) {
    // CORS Headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (req.method === 'OPTIONS') {
        res.writeHead(200, corsHeaders);
        res.end();
        return;
    }

    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const apiPath = urlObj.searchParams.get('path') || 'chat/completions';
    const targetUrl = `https://api.groq.com/openai/v1/${apiPath}`;

    // Get the Groq API key (first check environment, then check if client provided one)
    let localKey = process.env.GROQ_API_KEY;
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const providedKey = authHeader.replace('Bearer ', '').trim();
        if (providedKey && providedKey !== 'undefined' && providedKey !== 'null' && providedKey.length > 15) {
            localKey = providedKey;
        }
    }

    if (!localKey) {
        // Fallback to config.js file contents
        try {
            const configContent = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf8');
            const match = configContent.match(/window\.GROQ_API_KEY\s*=\s*['"]([^'"]+)['"]/);
            if (match) {
                localKey = match[1];
            }
        } catch (e) {
            // Ignore if config.js doesn't exist
        }
    }

    if (!localKey) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ error: 'GROQ_API_KEY not found on server. Please configure process.env.GROQ_API_KEY or billl/config.js.' }));
        return;
    }

    // Read body
    let bodyChunks = [];
    req.on('data', chunk => {
        bodyChunks.push(chunk);
    });

    req.on('end', async () => {
        const bodyBuffer = Buffer.concat(bodyChunks);
        
        const headers = {
            'Authorization': `Bearer ${localKey}`,
        };
        const contentType = req.headers['content-type'] || req.headers['Content-Type'];
        if (contentType) {
            headers['Content-Type'] = contentType;
        }

        try {
            // Use global fetch (Node 18+) or fallback to https request
            if (typeof fetch !== 'undefined') {
                const response = await fetch(targetUrl, {
                    method: req.method,
                    headers: headers,
                    body: bodyBuffer
                });
                const resBody = await response.text();
                
                res.writeHead(response.status, {
                    'Content-Type': response.headers.get('content-type') || 'application/json',
                    ...corsHeaders
                });
                res.end(resBody);
            } else {
                // Node < 18 fallback using https module
                const https = require('https');
                const parsedUrl = new URL(targetUrl);
                const options = {
                    hostname: parsedUrl.hostname,
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: req.method,
                    headers: headers
                };
                
                const proxyReq = https.request(options, (proxyRes) => {
                    const resHeaders = { ...corsHeaders };
                    if (proxyRes.headers['content-type']) {
                        resHeaders['Content-Type'] = proxyRes.headers['content-type'];
                    }
                    res.writeHead(proxyRes.statusCode, resHeaders);
                    proxyRes.pipe(res);
                });
                
                proxyReq.on('error', (err) => {
                    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
                    res.end(JSON.stringify({ error: err.message }));
                });
                
                proxyReq.write(bodyBuffer);
                proxyReq.end();
            }
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
            res.end(JSON.stringify({ error: error.message }));
        }
    });
}

const server = http.createServer((req, res) => {
    // Intercept Netlify function calls for local development
    if (req.url.startsWith('/.netlify/functions/groq-proxy')) {
        handleLocalGroqProxy(req, res);
        return;
    }

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
        if (ext === '.html' || ext === '.js' || ext === '.css') {
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

