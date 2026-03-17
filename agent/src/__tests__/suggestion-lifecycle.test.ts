import { describe, it, expect, vi } from 'vitest';
import { SuggestionLifecycle } from '../worker/suggestion-lifecycle.js';
import type { ShipClient } from '../lib/ship-client.js';

function mockClient(overrides: Partial<ShipClient> = {}): ShipClient {
  return {
    getAgentActions: vi.fn().mockResolvedValue([]),
    updateAgentAction: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as ShipClient;
}

describe('SuggestionLifecycle', () => {
  describe('processExpired', () => {
    it('archives snoozed suggestions past their expiry', async () => {
      const pastSnooze = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
      const client = mockClient({
        getAgentActions: vi.fn()
          .mockResolvedValueOnce([
            { id: 'a1', status: 'snoozed', snooze_until: pastSnooze, context: {}, created_at: new Date().toISOString() },
          ])
          .mockResolvedValueOnce([]), // pending query
      });

      const lifecycle = new SuggestionLifecycle(client);
      const result = await lifecycle.processExpired();

      expect(result.unsnoozed).toBe(1);
      expect(client.updateAgentAction).toHaveBeenCalledWith('a1', { status: 'dismissed' });
    });

    it('skips snoozed suggestions still within window', async () => {
      const futureSnooze = new Date(Date.now() + 60_000).toISOString(); // 1 min from now
      const client = mockClient({
        getAgentActions: vi.fn()
          .mockResolvedValueOnce([
            { id: 'a1', status: 'snoozed', snooze_until: futureSnooze, context: {}, created_at: new Date().toISOString() },
          ])
          .mockResolvedValueOnce([]),
      });

      const lifecycle = new SuggestionLifecycle(client);
      const result = await lifecycle.processExpired();

      expect(result.unsnoozed).toBe(0);
      expect(client.updateAgentAction).not.toHaveBeenCalled();
    });

    it('expires pending suggestions older than 7 days', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const client = mockClient({
        getAgentActions: vi.fn()
          .mockResolvedValueOnce([]) // snoozed query
          .mockResolvedValueOnce([
            { id: 'a2', status: 'pending', created_at: eightDaysAgo, context: {} },
          ]),
      });

      const lifecycle = new SuggestionLifecycle(client);
      const result = await lifecycle.processExpired();

      expect(result.expired).toBe(1);
      expect(client.updateAgentAction).toHaveBeenCalledWith('a2', { status: 'dismissed' });
    });

    it('does not expire recent pending suggestions', async () => {
      const client = mockClient({
        getAgentActions: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { id: 'a2', status: 'pending', created_at: new Date().toISOString(), context: {} },
          ]),
      });

      const lifecycle = new SuggestionLifecycle(client);
      const result = await lifecycle.processExpired();

      expect(result.expired).toBe(0);
    });
  });

  describe('isDuplicate', () => {
    it('returns true when a dismissed action exists for same entity', async () => {
      const client = mockClient({
        getAgentActions: vi.fn().mockResolvedValue([
          { id: 'a1', action_type: 'priority_change', status: 'dismissed', context: { entity_id: 'proj-1' } },
        ]),
      });

      const lifecycle = new SuggestionLifecycle(client);
      const result = await lifecycle.isDuplicate('user-1', 'priority_change', 'proj-1');

      expect(result).toBe(true);
    });

    it('returns false when no matching dismissed action', async () => {
      const client = mockClient({
        getAgentActions: vi.fn().mockResolvedValue([
          { id: 'a1', action_type: 'priority_change', status: 'approved', context: { entity_id: 'proj-1' } },
        ]),
      });

      const lifecycle = new SuggestionLifecycle(client);
      const result = await lifecycle.isDuplicate('user-1', 'priority_change', 'proj-1');

      expect(result).toBe(false);
    });

    it('returns false on API error', async () => {
      const client = mockClient({
        getAgentActions: vi.fn().mockRejectedValue(new Error('API error')),
      });

      const lifecycle = new SuggestionLifecycle(client);
      const result = await lifecycle.isDuplicate('user-1', 'priority_change', 'proj-1');

      expect(result).toBe(false);
    });
  });
});
