import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GET as getArrival } from './api/arrival.mjs';
import { POST as postSoundscape } from './api/soundscape.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const page = join(root, 'outputs', 'route-21-vinyl-prototype.html');
const port = Number(process.env.PORT) || 3000;

createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/api/soundscape' && request.method === 'POST') {
    try {
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 16_384) { response.writeHead(413).end('Request too large'); return; }
      }
      const result = await postSoundscape(new Request('http://localhost/api/soundscape', { method: 'POST', headers: { 'Content-Type': request.headers['content-type'] || 'application/json' }, body }));
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) {
      console.error(error);
      response.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Soundscape request failed.' }));
    }
    return;
  }
  if (request.method !== 'GET') {
    response.writeHead(405).end('Method not allowed');
    return;
  }
  if (path === '/api/arrival') {
    const result = await getArrival();
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(await result.text());
    return;
  }
  if (path === '/' || path === '/outputs/route-21-vinyl-prototype.html') {
    try {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(await readFile(page));
    } catch (error) {
      console.error(error);
      response.writeHead(500).end('Could not load prototype');
    }
    return;
  }
  response.writeHead(404).end('Not found');
}).listen(port, '127.0.0.1', () => {
  console.log(`Route 21 prototype: http://localhost:${port}/`);
});
