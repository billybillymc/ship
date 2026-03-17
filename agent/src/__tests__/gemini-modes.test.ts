import { describe, it, expect, vi } from 'vitest';
import { createGeminiReasoner } from '../graph/nodes/gemini-reasoner.js';
import type { GeminiClient } from '../lib/gemini-client.js';
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
    run_id: 'test',
    errors: [],
    ...overrides,
  };
}

function mockGemini(): GeminiClient {
  return {
    reason: vi.fn().mockResolvedValue('Gemini response'),
    reasonStreaming: vi.fn(),
  } as unknown as GeminiClient;
}

describe('Gemini Reasoner mode routing', () => {
  it('uses PROACTIVE_CLEAN when no violations (event)', async () => {
    const gemini = mockGemini();
    const node = createGeminiReasoner(gemini);
    const result = await node(makeState({ violations: [] }));
    expect(result.gemini_output?.mode).toBe('PROACTIVE_CLEAN');
  });

  it('uses PROACTIVE_VIOLATIONS when violations exist (event)', async () => {
    const gemini = mockGemini();
    const node = createGeminiReasoner(gemini);
    const result = await node(makeState({
      violations: [{ type: 'priority_overload', severity: 12, entity_type: 'project', entity_id: 'p1', entity_name: 'P1', details: {} }],
    }));
    expect(result.gemini_output?.mode).toBe('PROACTIVE_VIOLATIONS');
  });

  it('uses ON_DEMAND for general questions', async () => {
    const gemini = mockGemini();
    const node = createGeminiReasoner(gemini);
    const result = await node(makeState({
      trigger_type: 'on_demand',
      user_question: 'How is this project doing?',
      current_view_context: { document_type: 'project', document_id: 'p1', title: 'Auth' },
    }));
    expect(result.gemini_output?.mode).toBe('ON_DEMAND');
  });

  it('uses COACH when question mentions patterns', async () => {
    const gemini = mockGemini();
    const node = createGeminiReasoner(gemini);
    const result = await node(makeState({
      trigger_type: 'on_demand',
      user_question: 'What are my work patterns?',
    }));
    expect(result.gemini_output?.mode).toBe('COACH');
  });

  it('uses LOAD_BALANCER when question mentions workload', async () => {
    const gemini = mockGemini();
    const node = createGeminiReasoner(gemini);
    const result = await node(makeState({
      trigger_type: 'on_demand',
      user_question: 'Can you balance the workload on this project?',
    }));
    expect(result.gemini_output?.mode).toBe('LOAD_BALANCER');
  });

  it('uses PROJECT_KICKOFF when question mentions new project', async () => {
    const gemini = mockGemini();
    const node = createGeminiReasoner(gemini);
    const result = await node(makeState({
      trigger_type: 'on_demand',
      user_question: 'Should we create a new project from these orphaned issues?',
    }));
    expect(result.gemini_output?.mode).toBe('PROJECT_KICKOFF');
  });

  it('uses DIRECTOR_OVERVIEW for scheduled run with program data', async () => {
    const gemini = mockGemini();
    const node = createGeminiReasoner(gemini);
    const result = await node(makeState({
      trigger_type: 'scheduled',
      program_data: { program_id: 'all', program_name: 'Portfolio', projects: [] },
    }));
    expect(result.gemini_output?.mode).toBe('DIRECTOR_OVERVIEW');
  });

  it('uses RETRO_DRAFT for scheduled run with retro data', async () => {
    const gemini = mockGemini();
    const node = createGeminiReasoner(gemini);
    const result = await node(makeState({
      trigger_type: 'scheduled',
      retro_data: { week_id: 'w1', completed_issues: [], carryover_issues: [] },
    }));
    expect(result.gemini_output?.mode).toBe('RETRO_DRAFT');
  });

  it('falls back to structured output on Gemini failure', async () => {
    const gemini = mockGemini();
    (gemini.reason as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API timeout'));

    const node = createGeminiReasoner(gemini);
    const result = await node(makeState({
      violations: [{ type: 'stale_issue', severity: 8, entity_type: 'project', entity_id: 'p1', entity_name: 'P1', details: { issue_id: 'i1' } }],
    }));

    expect(result.errors).toHaveLength(1);
    expect(result.gemini_output?.mode).toBe('PROACTIVE_VIOLATIONS');
    expect(result.gemini_output?.content).toContain('stale_issue');
  });
});
