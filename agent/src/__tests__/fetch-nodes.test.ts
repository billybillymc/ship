import { describe, it, expect, vi } from 'vitest';
import { createProgramFetch } from '../graph/nodes/program-fetch.js';
import { createHistoryFetch } from '../graph/nodes/history-fetch.js';
import { createRetroFetch } from '../graph/nodes/retro-fetch.js';
import type { ShipClient } from '../lib/ship-client.js';
import type { FleetGraphState } from '../graph/state.js';

function makeState(overrides: Partial<FleetGraphState> = {}): FleetGraphState {
  return {
    trigger_type: 'event',
    trigger_payload: null,
    target_user_id: 'user-1',
    user_role: 'engineer',
    project_data: null,
    person_data: null,
    program_data: null,
    retro_data: null,
    history_data: null,
    violations: [],
    gemini_output: null,
    suggestions: [],
    drafts: [],
    notifications: [],
    conversation_history: [],
    user_question: null,
    current_view_context: null,
    run_id: 'test-run',
    errors: [],
    ...overrides,
  };
}

describe('ProgramFetch node', () => {
  it('fetches all programs and their projects', async () => {
    const client = {
      getPrograms: vi.fn().mockResolvedValue([
        { id: 'prog-1', title: 'IRS', properties: {} },
        { id: 'prog-2', title: 'FinCEN', properties: {} },
      ]),
      getProgramProjects: vi.fn()
        .mockResolvedValueOnce([{ id: 'p1', title: 'Direct File', properties: {} }])
        .mockResolvedValueOnce([{ id: 'p2', title: 'BSA E-Filing', properties: {} }]),
    } as unknown as ShipClient;

    const node = createProgramFetch(client);
    const result = await node(makeState());

    expect(result.program_data).toBeDefined();
    expect(result.program_data!.projects).toHaveLength(2);
    expect(result.program_data!.program_name).toBe('Portfolio Overview');
  });

  it('handles empty programs list', async () => {
    const client = {
      getPrograms: vi.fn().mockResolvedValue([]),
    } as unknown as ShipClient;

    const node = createProgramFetch(client);
    const result = await node(makeState());
    expect(result.program_data).toBeUndefined();
  });

  it('continues if one program fetch fails', async () => {
    const client = {
      getPrograms: vi.fn().mockResolvedValue([
        { id: 'prog-1', title: 'IRS', properties: {} },
        { id: 'prog-2', title: 'FinCEN', properties: {} },
      ]),
      getProgramProjects: vi.fn()
        .mockResolvedValueOnce([{ id: 'p1', title: 'Direct File', properties: {} }])
        .mockRejectedValueOnce(new Error('API error')),
    } as unknown as ShipClient;

    const node = createProgramFetch(client);
    const result = await node(makeState());

    expect(result.program_data!.projects).toHaveLength(1);
  });

  it('records error when getPrograms fails', async () => {
    const client = {
      getPrograms: vi.fn().mockRejectedValue(new Error('API down')),
    } as unknown as ShipClient;

    const node = createProgramFetch(client);
    const result = await node(makeState());

    expect(result.errors).toHaveLength(1);
    expect(result.errors![0]!.node).toBe('programFetch');
  });
});

describe('HistoryFetch node', () => {
  it('fetches agent actions for the target user', async () => {
    const client = {
      getAgentActions: vi.fn().mockResolvedValue([
        { id: 'a1', action_type: 'priority_change', status: 'approved' },
        { id: 'a2', action_type: 'status_change', status: 'dismissed' },
      ]),
    } as unknown as ShipClient;

    const node = createHistoryFetch(client);
    const result = await node(makeState({ target_user_id: 'user-1' }));

    expect(result.history_data).toBeDefined();
    expect(result.history_data!.actions).toHaveLength(2);
    expect(client.getAgentActions).toHaveBeenCalledWith('user-1');
  });

  it('returns empty when no target user', async () => {
    const client = {
      getAgentActions: vi.fn(),
    } as unknown as ShipClient;

    const node = createHistoryFetch(client);
    const result = await node(makeState({ target_user_id: '' }));

    expect(result.history_data).toBeUndefined();
    expect(client.getAgentActions).not.toHaveBeenCalled();
  });

  it('records error on failure', async () => {
    const client = {
      getAgentActions: vi.fn().mockRejectedValue(new Error('DB error')),
    } as unknown as ShipClient;

    const node = createHistoryFetch(client);
    const result = await node(makeState({ target_user_id: 'user-1' }));

    expect(result.errors).toHaveLength(1);
    expect(result.errors![0]!.node).toBe('historyFetch');
  });
});

describe('RetroFetch node', () => {
  it('splits issues into completed and carryover', async () => {
    const node = createRetroFetch({} as ShipClient);
    const result = await node(makeState({
      project_data: {
        project: { id: 'p1', title: 'P1', properties: {} },
        issues: [
          { id: 'i1', title: 'Done issue', state: 'done', priority: 'high', assignee_id: 'u1', estimate: null, updated_at: '', created_at: '' },
          { id: 'i2', title: 'Todo issue', state: 'todo', priority: 'medium', assignee_id: 'u1', estimate: null, updated_at: '', created_at: '' },
          { id: 'i3', title: 'In progress', state: 'in_progress', priority: 'high', assignee_id: 'u1', estimate: null, updated_at: '', created_at: '' },
        ],
      },
    }));

    expect(result.retro_data).toBeDefined();
    expect(result.retro_data!.completed_issues).toHaveLength(1);
    expect(result.retro_data!.carryover_issues).toHaveLength(2);
  });

  it('returns empty when no completed issues', async () => {
    const node = createRetroFetch({} as ShipClient);
    const result = await node(makeState({
      project_data: {
        project: { id: 'p1', title: 'P1', properties: {} },
        issues: [
          { id: 'i1', title: 'Todo', state: 'todo', priority: 'medium', assignee_id: 'u1', estimate: null, updated_at: '', created_at: '' },
        ],
      },
    }));

    expect(result.retro_data).toBeUndefined();
  });

  it('returns empty when no project data', async () => {
    const node = createRetroFetch({} as ShipClient);
    const result = await node(makeState());
    expect(result.retro_data).toBeUndefined();
  });
});
