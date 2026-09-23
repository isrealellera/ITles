/**
 * Single-process server: REST API + static UI. Used for local development, end-to-end tests and
 * as the production server on a VPS (Node 20+ with PostgreSQL via DATABASE_URL).
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { handle } from '../server/app.js';

const port = Number(process.env.PORT ?? 8787);
process.env.DATABASE_URL ??= 'pglite:' + path.resolve('.data/pg');
process.env.SETUP_KEY ??= 'dev-setup-key';
const root = path.resolve(process.env.STATIC_DIR ?? 'dist');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.apk': 'application/vnd.android.package-archive',
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
};

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 12_000_000) throw new Error('body too large');
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks);
}

async function serveStatic(pathname: string, res: http.ServerResponse) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(root, '.' + rel);
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const st = await stat(file);
    if (st.isDirectory()) {
      res.writeHead(301, { location: pathname + '/' }).end();
      return;
    }
    const ext = path.extname(file);
    const immutable = rel.startsWith('/assets/');
    res.writeHead(200, {
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Не найдено');
  }
}

http
  .createServer(async (req, res) => {
    try {
      const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] ?? 'http';
      const url = new URL(req.url ?? '/', `${proto}://${req.headers.host ?? 'localhost'}`);
      if (url.pathname.startsWith('/api/')) {
        const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
        const response = await handle(new Request(url, { method: req.method, headers, body: body ? new Uint8Array(body) : undefined }));
        const out: Record<string, string> = {};
        response.headers.forEach((v, k) => (out[k] = v));
        res.writeHead(response.status, out);
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      await serveStatic(url.pathname, res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  })
  .listen(port, () => console.log(`ITles: http://localhost:${port}  (DATABASE_URL=${process.env.DATABASE_URL?.split('@').pop()})`));
