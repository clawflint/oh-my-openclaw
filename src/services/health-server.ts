/**
 * Lightweight HTTP health endpoint for oh-my-openclaw.
 * Starts on the configured port (default 9100) and responds to GET /health.
 */

import { createServer, type Server } from 'node:http';
import { AGENT_REGISTRY } from '../agents/index.js';

const DEFAULT_PORT = 9100;

let server: Server | null = null;

export function startHealthServer(port: number = DEFAULT_PORT): Server {
  if (server) return server;

  server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      const body = JSON.stringify({
        status: 'ok',
        agents: Object.keys(AGENT_REGISTRY).length,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(body);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[omoc] health server listening on :${port}/health`);
  });

  return server;
}

export function stopHealthServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
