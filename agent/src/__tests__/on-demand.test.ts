import { describe, it, expect, vi } from 'vitest';
import { createServer } from '../server.js';
import http from 'http';
import type { ShipClient } from '../lib/ship-client.js';
import type { GeminiClient } from '../lib/gemini-client.js';

function mockShipClient(): ShipClient {
  return {
    getProject: vi.fn().mockResolvedValue({ id: 'proj-1', title: 'Auth Revamp', properties: {} }),
    getProjectIssues: vi.fn().mockResolvedValue([
      { id: 'i1', title: 'Fix login', state: 'todo', priority: 'high', assignee_id: 'u1' },
    ]),
    getPersonIssues: vi.fn().mockResolvedValue([]),
    getProgramProjects: vi.fn().mockResolvedValue([]),
    updateIssue: vi.fn(),
    createAgentAction: vi.fn(),
    getAgentActions: vi.fn().mockResolvedValue([]),
    updateAgentAction: vi.fn(),
  } as unknown as ShipClient;
}

function mockGeminiClient(): GeminiClient {
  return {
    reason: vi.fn().mockResolvedValue('The project looks healthy.'),
    reasonStreaming: vi.fn().mockImplementation(async function* () {
      yield 'The project ';
      yield 'looks healthy.';
    }),
  } as unknown as GeminiClient;
}

function postSSE(
  app: ReturnType<typeof createServer>,
  path: string,
  body: unknown,
): Promise<{ status: number; events: string[] }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        return reject(new Error('No address'));
      }
      const port = addr.port;
      const postData = JSON.stringify(body);

      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        (res) => {
          const events: string[] = [];
          res.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                events.push(line.slice(6));
              }
            }
          });
          res.on('end', () => {
            server.close();
            resolve({ status: res.statusCode ?? 0, events });
          });
        },
      );

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      req.write(postData);
      req.end();
    });
  });
}

describe('On-demand SSE endpoint', () => {
  it('returns 400 when question is missing', async () => {
    const app = createServer({
      onDemand: {
        shipClient: mockShipClient(),
        geminiClient: mockGeminiClient(),
        workspaceId: 'ws-1',
      },
    });

    const result = await postSSE(app, '/api/agent/on-demand', { context: {} });
    expect(result.status).toBe(400);
  });

  it('streams tokens via SSE for a valid question', async () => {
    const gemini = mockGeminiClient();
    const app = createServer({
      onDemand: {
        shipClient: mockShipClient(),
        geminiClient: gemini,
        workspaceId: 'ws-1',
      },
    });

    const result = await postSSE(app, '/api/agent/on-demand', {
      question: 'How is this project?',
      context: { document_type: 'project', document_id: 'proj-1', title: 'Auth Revamp' },
    });

    expect(result.status).toBe(200);

    // Should have token events and a done event
    const parsed = result.events.map(e => JSON.parse(e));
    const tokens = parsed.filter(e => e.type === 'token');
    const done = parsed.find(e => e.type === 'done');

    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0].content).toBe('The project ');
    expect(done).toBeDefined();

    // Gemini streaming was called
    expect(gemini.reasonStreaming).toHaveBeenCalled();
  });

  it('fetches project data when context is a project', async () => {
    const ship = mockShipClient();
    const app = createServer({
      onDemand: {
        shipClient: ship,
        geminiClient: mockGeminiClient(),
        workspaceId: 'ws-1',
      },
    });

    await postSSE(app, '/api/agent/on-demand', {
      question: 'What is going on?',
      context: { document_type: 'project', document_id: 'proj-1', title: 'Auth' },
    });

    expect(ship.getProject).toHaveBeenCalledWith('proj-1');
    expect(ship.getProjectIssues).toHaveBeenCalledWith('proj-1');
  });
});
