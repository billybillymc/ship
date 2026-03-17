import { describe, it, expect } from 'vitest';
import { createServer } from '../server.js';
import http from 'http';

function request(app: ReturnType<typeof createServer>, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        return reject(new Error('No address'));
      }
      const port = addr.port;
      http.get(`http://localhost:${port}${path}`, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode ?? 0, body: data });
        });
      }).on('error', (err) => {
        server.close();
        reject(err);
      });
    });
  });
}

describe('Agent Server', () => {
  it('responds to /health with ok', async () => {
    const app = createServer();
    const res = await request(app, '/health');
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('fleetgraph-agent');
  });
});
