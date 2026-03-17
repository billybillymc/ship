import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Scheduler } from '../worker/scheduler.js';
import type { ShipClient } from '../lib/ship-client.js';
import type { GeminiClient } from '../lib/gemini-client.js';

function mockShipClient(): ShipClient {
  return {
    getProjectIssues: vi.fn().mockResolvedValue([]),
    getPersonIssues: vi.fn().mockResolvedValue([
      { id: 'i1', title: 'Issue 1', state: 'todo', priority: 'high', assignee_id: 'user-1', estimate: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
      { id: 'i2', title: 'Issue 2', state: 'in_progress', priority: 'medium', assignee_id: 'user-2', estimate: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
    ]),
    getProject: vi.fn().mockResolvedValue({ id: 'p1', title: 'P1', properties: {} }),
    getProgramProjects: vi.fn().mockResolvedValue([]),
    updateIssue: vi.fn(),
    createAgentAction: vi.fn().mockResolvedValue({ id: 'action-1' }),
    getAgentActions: vi.fn().mockResolvedValue([]),
    updateAgentAction: vi.fn(),
  } as unknown as ShipClient;
}

function mockGeminiClient(): GeminiClient {
  return {
    reason: vi.fn().mockResolvedValue('Morning briefing: All projects look healthy.'),
    reasonStreaming: vi.fn(),
  } as unknown as GeminiClient;
}

describe('Scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a scheduler without crashing', () => {
    const scheduler = new Scheduler({
      shipClient: mockShipClient(),
      geminiClient: mockGeminiClient(),
      workspaceId: 'ws-1',
      graphInvoke: vi.fn().mockResolvedValue({}),
    });
    expect(scheduler).toBeDefined();
    scheduler.clear();
  });

  it('schedule() fires callback at interval', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler({
      shipClient: mockShipClient(),
      geminiClient: mockGeminiClient(),
      workspaceId: 'ws-1',
      graphInvoke: vi.fn().mockResolvedValue({}),
    });

    scheduler.schedule('test', 1000, callback);
    expect(callback).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).toHaveBeenCalledTimes(2);

    scheduler.clear();
  });

  it('clear() stops all scheduled jobs', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler({
      shipClient: mockShipClient(),
      geminiClient: mockGeminiClient(),
      workspaceId: 'ws-1',
      graphInvoke: vi.fn().mockResolvedValue({}),
    });

    scheduler.schedule('test', 1000, callback);
    scheduler.clear();

    await vi.advanceTimersByTimeAsync(5000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('runMorningBriefings() calls Gemini and persists briefing', async () => {
    vi.useRealTimers(); // Need real timers for async

    const ship = mockShipClient();
    const gemini = mockGeminiClient();

    const scheduler = new Scheduler({
      shipClient: ship,
      geminiClient: gemini,
      workspaceId: 'ws-1',
      graphInvoke: vi.fn().mockResolvedValue({}),
    });

    await scheduler.runMorningBriefings();

    // Should call getPersonIssues to get all issues
    expect(ship.getPersonIssues).toHaveBeenCalled();

    // Should call Gemini for each unique assignee
    expect(gemini.reason).toHaveBeenCalled();

    // Should persist briefings
    expect(ship.createAgentAction).toHaveBeenCalled();
    const call = (ship.createAgentAction as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(call.action_type).toBe('briefing');
    expect(call.workspace_id).toBe('ws-1');

    scheduler.clear();
  });

  it('runStalenessScan() detects stale issues', async () => {
    vi.useRealTimers();

    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const ship = mockShipClient();
    (ship.getPersonIssues as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'stale-1', title: 'Stale Issue', state: 'todo', priority: 'high', assignee_id: 'user-1', estimate: null, updated_at: fiveDaysAgo, created_at: fiveDaysAgo },
      { id: 'fresh-1', title: 'Fresh Issue', state: 'todo', priority: 'high', assignee_id: 'user-2', estimate: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
    ]);

    const graphInvoke = vi.fn().mockResolvedValue({});

    const scheduler = new Scheduler({
      shipClient: ship,
      geminiClient: mockGeminiClient(),
      workspaceId: 'ws-1',
      graphInvoke,
    });

    await scheduler.runStalenessScan();

    // Should trigger a graph run for the stale issue
    expect(graphInvoke).toHaveBeenCalled();

    scheduler.clear();
  });

  it('runStalenessScan() skips fresh issues', async () => {
    vi.useRealTimers();

    const ship = mockShipClient();
    (ship.getPersonIssues as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'fresh-1', title: 'Fresh Issue', state: 'todo', priority: 'high', assignee_id: 'user-1', estimate: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
    ]);

    const graphInvoke = vi.fn().mockResolvedValue({});

    const scheduler = new Scheduler({
      shipClient: ship,
      geminiClient: mockGeminiClient(),
      workspaceId: 'ws-1',
      graphInvoke,
    });

    await scheduler.runStalenessScan();

    // No stale issues → no graph runs
    expect(graphInvoke).not.toHaveBeenCalled();

    scheduler.clear();
  });

  it('handles errors in scheduled callbacks without crashing', async () => {
    const callback = vi.fn().mockRejectedValue(new Error('boom'));
    const scheduler = new Scheduler({
      shipClient: mockShipClient(),
      geminiClient: mockGeminiClient(),
      workspaceId: 'ws-1',
      graphInvoke: vi.fn().mockResolvedValue({}),
    });

    // Should not throw
    scheduler.schedule('failing-job', 1000, callback);
    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).toHaveBeenCalledOnce();

    // Job continues running despite the error
    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).toHaveBeenCalledTimes(2);

    scheduler.clear();
  });
});
