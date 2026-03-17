import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShipClient } from '../lib/ship-client.js';

describe('ShipClient', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends Authorization header with Bearer token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve([]),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new ShipClient('http://localhost:3000', 'test-token');
    await client.getProjectIssues('proj-1');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe('http://localhost:3000/api/issues?project_id=proj-1');
    expect(opts.headers['Authorization']).toBe('Bearer test-token');
  });

  it('retries on 5xx errors', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve({
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        });
      }
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve([]),
      });
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new ShipClient('http://localhost:3000', 'token');
    const result = await client.getProjectIssues('proj-1');
    expect(result).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws on 4xx without retrying', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 404,
      text: () => Promise.resolve('Not Found'),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new ShipClient('http://localhost:3000', 'token');
    await expect(client.getProjectIssues('proj-1')).rejects.toThrow('Ship API 404');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('handles array response for getProjectIssues', async () => {
    const issues = [{ id: '1', title: 'Issue 1' }];
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve(issues),
    }) as unknown as typeof fetch;

    const client = new ShipClient('http://localhost:3000', 'token');
    const result = await client.getProjectIssues('proj-1');
    expect(result).toEqual(issues);
  });

  it('handles { data: [...] } response wrapper', async () => {
    const issues = [{ id: '1', title: 'Issue 1' }];
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ data: issues }),
    }) as unknown as typeof fetch;

    const client = new ShipClient('http://localhost:3000', 'token');
    const result = await client.getProjectIssues('proj-1');
    expect(result).toEqual(issues);
  });

  it('updateIssue sends PATCH request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 200 });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new ShipClient('http://localhost:3000', 'token');
    await client.updateIssue('issue-1', { priority: 'medium' } as any);

    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe('http://localhost:3000/api/issues/issue-1');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({ priority: 'medium' });
  });

  it('createAgentAction sends POST request', async () => {
    const action = {
      workspace_id: 'ws-1',
      target_user_id: 'user-1',
      action_type: 'priority_change',
      severity_score: 12,
      context: {},
      suggestion: {},
      gemini_reasoning: 'test',
      langsmith_trace_id: null,
    };
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ id: 'action-1', ...action }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new ShipClient('http://localhost:3000', 'token');
    const result = await client.createAgentAction(action);
    expect(result.id).toBe('action-1');

    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe('http://localhost:3000/api/agent/suggestions');
    expect(opts.method).toBe('POST');
  });
});
