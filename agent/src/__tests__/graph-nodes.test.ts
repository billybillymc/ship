import { describe, it, expect } from 'vitest';
import { triggerContext } from '../graph/nodes/trigger-context.js';
import { userContext } from '../graph/nodes/user-context.js';
import { thresholdEvaluator } from '../graph/nodes/threshold-evaluator.js';
import type { FleetGraphState, EventPayload, OnDemandPayload } from '../graph/state.js';

function makeState(overrides: Partial<FleetGraphState> = {}): FleetGraphState {
  return {
    trigger_type: 'event',
    trigger_payload: null,
    target_user_id: '',
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

describe('triggerContext node', () => {
  it('extracts user_question and view_context for on-demand', async () => {
    const payload: OnDemandPayload = {
      user_question: 'How is this project?',
      view_context: { document_type: 'project', document_id: 'proj-1', title: 'Auth' },
    };
    const state = makeState({ trigger_type: 'on_demand', trigger_payload: payload });

    const result = await triggerContext(state);
    expect(result.user_question).toBe('How is this project?');
    expect(result.current_view_context?.document_type).toBe('project');
  });

  it('extracts target_user_id from event payload', async () => {
    const payload: EventPayload = {
      document_ids: ['doc-1'],
      project_id: 'proj-1',
      assignee_ids: ['user-assignee'],
    };
    const state = makeState({ trigger_type: 'event', trigger_payload: payload });

    const result = await triggerContext(state);
    expect(result.target_user_id).toBe('user-assignee');
  });

  it('returns empty object for scheduled trigger', async () => {
    const state = makeState({
      trigger_type: 'scheduled',
      trigger_payload: { schedule_type: 'morning_briefing' },
    });

    const result = await triggerContext(state);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('userContext node', () => {
  it('passes through target_user_id and role', async () => {
    const state = makeState({ target_user_id: 'user-1', user_role: 'pm' });
    const result = await userContext(state);
    expect(result.target_user_id).toBe('user-1');
    expect(result.user_role).toBe('pm');
  });

  it('defaults to engineer role', async () => {
    const state = makeState({ target_user_id: 'user-1' });
    const result = await userContext(state);
    expect(result.user_role).toBe('engineer');
  });
});

describe('thresholdEvaluator node', () => {
  it('produces violations from project data', async () => {
    const issues = Array.from({ length: 9 }, (_, i) => ({
      id: `i-${i}`, title: `Issue ${i}`, state: 'todo', priority: 'high',
      assignee_id: 'u1', estimate: null,
      updated_at: new Date().toISOString(), created_at: new Date().toISOString(),
    }));
    const state = makeState({
      project_data: {
        project: { id: 'p1', title: 'P1', properties: {} },
        issues,
      },
    });

    const result = await thresholdEvaluator(state);
    expect(result.violations!.length).toBeGreaterThan(0);
    expect(result.violations!.some(v => v.type === 'priority_overload')).toBe(true);
  });

  it('produces empty violations for healthy data', async () => {
    const state = makeState({
      project_data: {
        project: { id: 'p1', title: 'P1', properties: {} },
        issues: [
          { id: 'i1', title: 'I1', state: 'todo', priority: 'medium', assignee_id: 'u1', estimate: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
        ],
      },
    });

    const result = await thresholdEvaluator(state);
    expect(result.violations).toHaveLength(0);
  });

  it('handles null project and person data gracefully', async () => {
    const state = makeState();
    const result = await thresholdEvaluator(state);
    expect(result.violations).toHaveLength(0);
  });
});
