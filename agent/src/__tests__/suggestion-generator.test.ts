import { describe, it, expect } from 'vitest';
import { suggestionGenerator } from '../graph/nodes/suggestion-generator.js';
import type { FleetGraphState, Violation } from '../graph/state.js';

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
    run_id: 'test-run-1',
    errors: [],
    ...overrides,
  };
}

describe('suggestionGenerator', () => {
  it('returns empty suggestions when no violations', async () => {
    const state = makeState({ violations: [] });
    const result = await suggestionGenerator(state);
    expect(result.suggestions).toHaveLength(0);
  });

  it('maps priority_overload to priority_change suggestion', async () => {
    const violation: Violation = {
      type: 'priority_overload',
      severity: 12,
      entity_type: 'project',
      entity_id: 'proj-1',
      entity_name: 'Auth Revamp',
      details: {
        priority: 'high',
        count: 9,
        threshold: 7,
        affected_issue_ids: ['issue-1', 'issue-2', 'issue-3'],
      },
    };

    const state = makeState({
      violations: [violation],
      gemini_output: { mode: 'PROACTIVE_VIOLATIONS', content: 'Analysis here.' },
    });

    const result = await suggestionGenerator(state);
    expect(result.suggestions).toHaveLength(1);

    const s = result.suggestions![0]!;
    expect(s.action_type).toBe('priority_change');
    expect(s.suggestion['field']).toBe('priority');
    expect(s.suggestion['from']).toBe('high');
    expect(s.suggestion['to']).toBe('medium');
    expect(s.gemini_reasoning).toBe('Analysis here.');
    expect(s.severity_score).toBe(12);
  });

  it('maps in_progress_overload to status_change suggestion', async () => {
    const violation: Violation = {
      type: 'in_progress_overload',
      severity: 5,
      entity_type: 'project',
      entity_id: 'proj-1',
      entity_name: 'iOS App',
      details: {
        count: 6,
        threshold: 5,
        affected_issue_ids: ['issue-a', 'issue-b'],
      },
    };

    const state = makeState({ violations: [violation] });
    const result = await suggestionGenerator(state);

    const s = result.suggestions![0]!;
    expect(s.action_type).toBe('status_change');
    expect(s.suggestion['from']).toBe('in_progress');
    expect(s.suggestion['to']).toBe('todo');
  });

  it('maps person_overload to priority_change for the person', async () => {
    const violation: Violation = {
      type: 'person_overload',
      severity: 7,
      entity_type: 'person',
      entity_id: 'person-alice',
      entity_name: 'Alice',
      details: {
        priority: 'high',
        count: 3,
        threshold: 2,
        affected_issue_ids: ['issue-x', 'issue-y', 'issue-z'],
      },
    };

    const state = makeState({ violations: [violation] });
    const result = await suggestionGenerator(state);

    const s = result.suggestions![0]!;
    expect(s.action_type).toBe('priority_change');
    expect(s.target_user_id).toBe('person-alice');
  });

  it('maps stale_issue to status_change suggestion', async () => {
    const violation: Violation = {
      type: 'stale_issue',
      severity: 16,
      entity_type: 'project',
      entity_id: 'proj-1',
      entity_name: 'API Gateway',
      details: {
        issue_id: 'issue-stale',
        issue_title: 'Fix auth bug',
        priority: 'high',
        days_since_update: 4,
        threshold_days: 2,
      },
    };

    const state = makeState({ violations: [violation] });
    const result = await suggestionGenerator(state);

    const s = result.suggestions![0]!;
    expect(s.action_type).toBe('status_change');
    expect(s.suggestion['issue_id']).toBe('issue-stale');
  });

  it('fills target_user_id from state when violation does not set it', async () => {
    const violation: Violation = {
      type: 'in_progress_overload',
      severity: 5,
      entity_type: 'project',
      entity_id: 'proj-1',
      entity_name: 'Test',
      details: { count: 6, threshold: 5, affected_issue_ids: ['issue-1'] },
    };

    const state = makeState({
      target_user_id: 'user-fallback',
      violations: [violation],
    });
    const result = await suggestionGenerator(state);
    expect(result.suggestions![0]!.target_user_id).toBe('user-fallback');
  });

  it('generates one suggestion per violation', async () => {
    const violations: Violation[] = [
      {
        type: 'priority_overload', severity: 12, entity_type: 'project',
        entity_id: 'p1', entity_name: 'P1',
        details: { priority: 'high', count: 9, threshold: 7, affected_issue_ids: ['i1'] },
      },
      {
        type: 'stale_issue', severity: 8, entity_type: 'project',
        entity_id: 'p1', entity_name: 'P1',
        details: { issue_id: 'i2', issue_title: 'Old', priority: 'high', days_since_update: 5, threshold_days: 2 },
      },
    ];

    const state = makeState({ violations });
    const result = await suggestionGenerator(state);
    expect(result.suggestions).toHaveLength(2);
  });
});
