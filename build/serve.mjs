#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Server statico per l'anteprima locale di docs/.
//
//   node build/serve.mjs          -> http://localhost:8080
//   PORT=3000 node build/serve.mjs
//
// Serve aprirlo da http://localhost e non con file://, altrimenti il browser
// non concede né i moduli JavaScript né la Web Crypto API.
// ---------------------------------------------------------------------------

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DOCS = path.resolve(import.meta.dirname, '..', 'docs');
const PORTA = Number(process.env.PORT) || 8080;

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const server = createServer(async (richiesta, risposta) => {
  try {
    const url = new URL(richiesta.url, `http://localhost:${PORTA}`);
    let relativo = decodeURIComponent(url.pathname);
    if (relativo.endsWith('/')) relativo += 'index.html';

    const file = path.join(DOCS, path.normalize(relativo));
    if (!file.startsWith(DOCS)) {
      risposta.writeHead(403).end('403');
      return;
    }

    const info = await stat(file);
    const finale = info.isDirectory() ? path.join(file, 'index.html') : file;
    const contenuto = await readFile(finale);

    risposta.writeHead(200, {
      'content-type': TIPI[path.extname(finale).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    risposta.end(contenuto);
  } catch {
    risposta.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    risposta.end('<p>Non trovato. Hai lanciato <code>npm run build</code>?</p>');
  }
});

server.listen(PORTA, () => {
  console.log(`\n  Anteprima su http://localhost:${PORTA}  (Ctrl+C per fermare)\n`);
});
