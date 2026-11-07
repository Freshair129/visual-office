import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {OFFICE_RELEASE_CSP} from './office-release-policy.mjs';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
};

export function createOfficeReleaseServer(artifactRoot) {
  const root = resolve(artifactRoot);
  return http.createServer(async (request, response) => {
    response.setHeader('Content-Security-Policy', OFFICE_RELEASE_CSP);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (!url.pathname.startsWith('/office/')) {
        response.writeHead(404).end('Not found');
        return;
      }
      let relativePath;
      try {
        relativePath = decodeURIComponent(url.pathname.slice('/office/'.length) || 'index.html');
      } catch {
        response.writeHead(400).end('Invalid path');
        return;
      }
      if (relativePath.split(/[\\/]/).includes('..')) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const path = resolve(root, relativePath);
      if (!path.startsWith(root + sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, {'Allow': 'GET, HEAD'}).end('Method not allowed');
        return;
      }
      const metadata = await stat(path);
      if (!metadata.isFile()) throw new Error('not a file');
      response.writeHead(200, {'Content-Type': contentTypes[extname(path).toLowerCase()] || 'application/octet-stream'});
      response.end(request.method === 'HEAD' ? undefined : await readFile(path));
    } catch {
      if (!response.headersSent) response.writeHead(404).end('Not found');
      else response.end();
    }
  });
}
