import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv[2] || 8768);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8' };

http.createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://localhost');
        const pathname = decodeURIComponent(url.pathname);
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(root + path.sep) || pathname.split('/').some(part => part.startsWith('.')) || !['GET', 'HEAD'].includes(request.method)) {
            response.writeHead(403).end();
            return;
        }
        const info = await stat(file);
        if (!info.isFile()) throw new Error('Not a file');
        if (path.extname(file) === '.html' && url.searchParams.has('audit')) {
            const html = (await readFile(file, 'utf8')).replace('<head>', '<head><script src="/scripts/performance-audit.js"></script>');
            response.writeHead(200, { 'Content-Type': types['.html'], 'Cache-Control': 'no-store' });
            response.end(html);
            return;
        }
        response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream',
            'Content-Length': info.size, 'Cache-Control': 'no-store' });
        if (request.method === 'HEAD') response.end();
        else createReadStream(file).pipe(response);
    } catch {
        response.writeHead(404).end('Not found');
    }
}).listen(port, '127.0.0.1', () => process.stdout.write(`MIX preview: http://127.0.0.1:${port}\n`));
