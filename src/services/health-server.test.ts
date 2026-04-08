import { describe, it, expect, afterEach } from 'vitest';
import { startHealthServer, stopHealthServer } from './health-server.js';

describe('health-server', () => {
  afterEach(() => {
    stopHealthServer();
  });

  it('GET /health returns status ok with agent count', async () => {
    const server = startHealthServer(0); // random port
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no address');

    const res = await fetch(`http://127.0.0.1:${address.port}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.agents).toBe(11);
  });

  it('returns 404 for unknown routes', async () => {
    const server = startHealthServer(0);
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no address');

    const res = await fetch(`http://127.0.0.1:${address.port}/unknown`);
    expect(res.status).toBe(404);
  });
});
