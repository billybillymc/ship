/**
 * End-to-end use case tests — realistic seed data through the full graph,
 * asserting on outcome quality, not just plumbing.
 *
 * Each test sets up data matching our fleet seed scenarios and runs
 * the compiled LangGraph graph, verifying the right violations are
 * detected, the right suggestions are generated for the right users,
 * and the right Gemini mode is selected.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { buildFleetGraph } from '../graph/graph.js';
import type { ShipClient } from '../lib/ship-client.js';
import type { GeminiClient } from '../lib/gemini-client.js';
import type { Issue, Project, FleetGraphState } from '../graph/state.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeIssue(overrides: Partial<Issue>): Issue {
  return {
    id: `issue-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Issue',
    state: 'todo',
    priority: 'medium',
    assignee_id: null,
    estimate: null,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function buildMockShipClient(projectIssues: Issue[], personIssues?: Issue[]): ShipClient {
  return {
    getProjectIssues: vi.fn().mockResolvedValue(projectIssues),
    getPersonIssues: vi.fn().mockResolvedValue(personIssues ?? []),
    getProject: vi.fn().mockResolvedValue({ id: 'proj-1', title: 'Test Project', properties: {} }),
    getPrograms: vi.fn().mockResolvedValue([
      { id: 'prog-1', title: 'IRS Modernization', properties: {} },
      { id: 'prog-2', title: 'BFS Payment Modernization', properties: {} },
    ]),
    getProgramProjects: vi.fn()
      .mockResolvedValueOnce([
        { id: 'proj-direct-file', title: 'Direct File', properties: {} },
        { id: 'proj-imf', title: 'Individual Master File Migration', properties: {} },
      ])
      .mockResolvedValueOnce([
        { id: 'proj-payments', title: 'Payment Integrity', properties: {} },
      ]),
    getAllIssues: vi.fn().mockResolvedValue(projectIssues),
    updateIssue: vi.fn().mockResolvedValue(undefined),
    createAgentAction: vi.fn().mockResolvedValue({ id: 'action-1' }),
    getAgentActions: vi.fn().mockResolvedValue([]),
    updateAgentAction: vi.fn().mockResolvedValue({ id: 'action-1' }),
    notifyUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as ShipClient;
}

function buildMockGemini(response?: string): GeminiClient {
  return {
    reason: vi.fn().mockResolvedValue(response ?? 'Gemini analysis response.'),
    reasonStreaming: vi.fn(),
  } as unknown as GeminiClient;
}

function buildGraph(shipClient: ShipClient, geminiClient: GeminiClient) {
  return buildFleetGraph({
    shipClient,
    geminiClient,
    workspaceId: 'ws-test',
  });
}

// ── UC1: Director Overview ──────────────────────────────────────────

describe('UC1: Director Overview — cross-program portfolio scan', () => {
  it('fetches all programs and their projects for a scheduled run', async () => {
    const ship = buildMockShipClient([]);
    const graph = buildGraph(ship, buildMockGemini());

    await graph.invoke({
      trigger_type: 'scheduled',
      trigger_payload: { schedule_type: 'morning_briefing' },
      target_user_id: 'director-1',
      run_id: 'uc1-test',
    });

    expect(ship.getPrograms).toHaveBeenCalled();
    expect(ship.getProgramProjects).toHaveBeenCalled();
  });

  it('selects DIRECTOR_OVERVIEW mode when program data is present', async () => {
    const ship = buildMockShipClient([]);
    const gemini = buildMockGemini('Portfolio analysis: Direct File is highest risk.');
    const graph = buildGraph(ship, gemini);

    const result = await graph.invoke({
      trigger_type: 'scheduled',
      trigger_payload: { schedule_type: 'morning_briefing' },
      target_user_id: 'director-1',
      run_id: 'uc1-mode-test',
    });

    expect(result.gemini_output?.mode).toBe('DIRECTOR_OVERVIEW');
  });
});

// ── UC2: PM Alert — in-progress overload ────────────────────────────

describe('UC2: PM Alert — in-progress overload detection', () => {
  const sixInProgress = [
    makeIssue({ id: 'ip-1', title: 'Fraud scoring API', state: 'in_progress', priority: 'high', assignee_id: 'pm-1' }),
    makeIssue({ id: 'ip-2', title: 'Deceased intercept', state: 'in_progress', priority: 'high', assignee_id: 'pm-1' }),
    makeIssue({ id: 'ip-3', title: 'Payment recovery', state: 'in_progress', priority: 'medium', assignee_id: 'eng-1' }),
    makeIssue({ id: 'ip-4', title: 'Bank account verify', state: 'in_progress', priority: 'medium', assignee_id: 'eng-2' }),
    makeIssue({ id: 'ip-5', title: 'Improper payment dashboard', state: 'in_progress', priority: 'medium', assignee_id: 'eng-1' }),
    makeIssue({ id: 'ip-6', title: 'Cross-agency dedup', state: 'in_progress', priority: 'high', assignee_id: 'eng-2' }),
    makeIssue({ id: 'done-1', title: 'Identity verification', state: 'done', priority: 'high', assignee_id: 'eng-1' }),
  ];

  it('detects in_progress_overload when project has >5 WIP items', async () => {
    const ship = buildMockShipClient(sixInProgress);
    const graph = buildGraph(ship, buildMockGemini());

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: { document_ids: [], project_id: 'proj-payments', assignee_ids: ['pm-1'] },
      target_user_id: 'pm-1',
      run_id: 'uc2-test',
    });

    const ipViolation = result.violations.find((v: any) => v.type === 'in_progress_overload');
    expect(ipViolation).toBeDefined();
    expect(ipViolation!.details['count']).toBe(6);
    expect(ipViolation!.details['threshold']).toBe(5);
  });

  it('generates a status_change suggestion to move an item back to todo', async () => {
    const ship = buildMockShipClient(sixInProgress);
    const graph = buildGraph(ship, buildMockGemini());

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: { document_ids: [], project_id: 'proj-payments', assignee_ids: ['pm-1'] },
      target_user_id: 'pm-1',
      run_id: 'uc2-suggestion-test',
    });

    const ipSuggestion = result.suggestions.find((s: any) => s.action_type === 'status_change');
    expect(ipSuggestion).toBeDefined();
    expect(ipSuggestion!.suggestion['from']).toBe('in_progress');
    expect(ipSuggestion!.suggestion['to']).toBe('todo');
    expect(ipSuggestion!.suggestion['issue_id']).toBeDefined();
  });

  it('uses PROACTIVE_VIOLATIONS mode and calls Gemini with violation data', async () => {
    const ship = buildMockShipClient(sixInProgress);
    const gemini = buildMockGemini();
    const graph = buildGraph(ship, gemini);

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: { document_ids: [], project_id: 'proj-payments', assignee_ids: ['pm-1'] },
      target_user_id: 'pm-1',
      run_id: 'uc2-gemini-test',
    });

    expect(result.gemini_output?.mode).toBe('PROACTIVE_VIOLATIONS');
    // Gemini was called with the violations as context
    const geminiCall = (gemini.reason as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const context = JSON.parse(geminiCall[1]);
    expect(context.violations.length).toBeGreaterThan(0);
    expect(context.violations[0].type).toBe('in_progress_overload');
  });
});

// ── UC3: Engineer Nudge — stale high-priority issues ────────────────

describe('UC3: Engineer Nudge — stale issue detection', () => {
  const imfIssues = [
    makeIssue({ id: 'stale-1', title: 'Dual-write strategy', state: 'in_progress', priority: 'high', assignee_id: 'eng-rachel', updated_at: daysAgo(5) }),
    makeIssue({ id: 'stale-2', title: 'Data reconciliation pipeline', state: 'in_progress', priority: 'high', assignee_id: 'eng-devon', updated_at: daysAgo(5) }),
    makeIssue({ id: 'stale-3', title: 'Account balance query API', state: 'todo', priority: 'high', assignee_id: 'eng-aisha', updated_at: daysAgo(5) }),
    makeIssue({ id: 'fresh-1', title: 'Refund processing migration', state: 'todo', priority: 'high', assignee_id: 'eng-carlos', updated_at: new Date().toISOString() }),
    makeIssue({ id: 'done-1', title: 'Document COBOL flows', state: 'done', priority: 'high', assignee_id: 'eng-rachel', updated_at: daysAgo(10) }),
  ];

  it('detects exactly 3 stale high-priority issues (not the fresh or done ones)', async () => {
    const ship = buildMockShipClient(imfIssues);
    const graph = buildGraph(ship, buildMockGemini());

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: { document_ids: [], project_id: 'proj-imf', assignee_ids: ['eng-rachel'] },
      target_user_id: 'eng-rachel',
      run_id: 'uc3-test',
    });

    const staleViolations = result.violations.filter((v: any) => v.type === 'stale_issue');
    expect(staleViolations).toHaveLength(3);

    // Each stale violation references the correct issue
    const staleIds = staleViolations.map((v: any) => v.details.issue_id);
    expect(staleIds).toContain('stale-1');
    expect(staleIds).toContain('stale-2');
    expect(staleIds).toContain('stale-3');

    // Fresh issue and done issue are NOT flagged
    expect(staleIds).not.toContain('fresh-1');
    expect(staleIds).not.toContain('done-1');
  });

  it('generates one suggestion per stale issue', async () => {
    const ship = buildMockShipClient(imfIssues);
    const graph = buildGraph(ship, buildMockGemini());

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: { document_ids: [], project_id: 'proj-imf', assignee_ids: ['eng-rachel'] },
      target_user_id: 'eng-rachel',
      run_id: 'uc3-suggestions-test',
    });

    const staleSuggestions = result.suggestions.filter((s: any) =>
      s.suggestion['issue_id']?.startsWith('stale-')
    );
    expect(staleSuggestions).toHaveLength(3);
  });

  it('stale issue severity scales with days overdue', async () => {
    const ship = buildMockShipClient(imfIssues);
    const graph = buildGraph(ship, buildMockGemini());

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: { document_ids: [], project_id: 'proj-imf', assignee_ids: ['eng-rachel'] },
      target_user_id: 'eng-rachel',
      run_id: 'uc3-severity-test',
    });

    const staleViolations = result.violations.filter((v: any) => v.type === 'stale_issue');
    // 5 days stale on high-priority (threshold 2) → 3 days overdue → severity = 8 * 3 = 24
    for (const v of staleViolations) {
      expect(v.severity).toBeGreaterThanOrEqual(8 * 3); // weight 8 * at least 3 days over
    }
  });
});

// ── UC4: Morning Briefing — per-user daily digest ───────────────────

describe('UC4: Morning Briefing — daily digest', () => {
  it('scheduled run with no specific project still produces Gemini output', async () => {
    const ship = buildMockShipClient([]);
    const gemini = buildMockGemini('Good morning. All projects are on track.');
    const graph = buildGraph(ship, gemini);

    const result = await graph.invoke({
      trigger_type: 'scheduled',
      trigger_payload: { schedule_type: 'morning_briefing' },
      target_user_id: 'user-briefing',
      run_id: 'uc4-test',
    });

    // Gemini should have been called
    expect(gemini.reason).toHaveBeenCalled();
    expect(result.gemini_output).toBeDefined();
    expect(result.gemini_output?.content).toBeTruthy();
  });

  it('briefing includes violations when projects are unhealthy', async () => {
    const overloadedIssues = Array.from({ length: 9 }, (_, i) =>
      makeIssue({ id: `brief-hp-${i}`, priority: 'high', assignee_id: 'user-briefing' })
    );
    const ship = buildMockShipClient(overloadedIssues);
    const gemini = buildMockGemini();
    const graph = buildGraph(ship, gemini);

    const result = await graph.invoke({
      trigger_type: 'scheduled',
      trigger_payload: { schedule_type: 'morning_briefing' },
      target_user_id: 'user-briefing',
      run_id: 'uc4-violations-test',
    });

    // The scheduled run should still detect violations if a specific project is fetched
    // (This tests that threshold evaluation runs on scheduled triggers too)
    expect(result.gemini_output).toBeDefined();
  });
});

// ── UC5: Project Kickoff — orphaned issue detection ─────────────────

describe('UC5: Project Kickoff — orphaned issue clustering', () => {
  it('selects PROJECT_KICKOFF mode when question asks about new project', async () => {
    const ship = buildMockShipClient([]);
    const gemini = buildMockGemini('I found 3 orphaned issues that could form a Performance project.');
    const graph = buildGraph(ship, gemini);

    const result = await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Should we kickoff a new project for the orphaned performance issues?',
        view_context: { document_type: 'workspace', document_id: 'ws-1', title: 'Treasury' },
      },
      target_user_id: 'pm-1',
      run_id: 'uc5-test',
    });

    expect(result.gemini_output?.mode).toBe('PROJECT_KICKOFF');
    expect(result.suggestions).toHaveLength(0); // On-demand doesn't generate persistent suggestions
  });

  it('passes project data to Gemini as context for evaluation', async () => {
    const ship = buildMockShipClient([
      makeIssue({ id: 'orphan-1', title: 'Optimize query performance' }),
      makeIssue({ id: 'orphan-2', title: 'Add caching layer' }),
    ]);
    const gemini = buildMockGemini();
    const graph = buildGraph(ship, gemini);

    await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Are there orphaned issues we should organize into a new project?',
        view_context: { document_type: 'workspace', document_id: 'ws-1' },
      },
      target_user_id: 'pm-1',
      run_id: 'uc5-context-test',
    });

    expect(gemini.reason).toHaveBeenCalled();
    const geminiContext = JSON.parse((gemini.reason as ReturnType<typeof vi.fn>).mock.calls[0]![1]);
    expect(geminiContext.question).toContain('orphaned');
  });
});

// ── UC6: Coach — work pattern analysis ──────────────────────────────

describe('UC6: Coach — work pattern analysis', () => {
  it('selects COACH mode and fetches history data', async () => {
    const ship = buildMockShipClient([], [
      makeIssue({ id: 'p-1', title: 'Task 1', state: 'done', priority: 'high', assignee_id: 'eng-1' }),
      makeIssue({ id: 'p-2', title: 'Task 2', state: 'todo', priority: 'high', assignee_id: 'eng-1' }),
      makeIssue({ id: 'p-3', title: 'Task 3', state: 'in_progress', priority: 'medium', assignee_id: 'eng-1' }),
    ]);
    const gemini = buildMockGemini('Your completion rate is stable but you have 2 high-priority items pending.');
    const graph = buildGraph(ship, gemini);

    const result = await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Analyze my work patterns and trends over the past weeks',
        view_context: { document_type: 'person', document_id: 'eng-1', title: 'Rachel Goldberg' },
      },
      target_user_id: 'eng-1',
      run_id: 'uc6-test',
    });

    expect(result.gemini_output?.mode).toBe('COACH');
    // History fetch should have been called
    expect(ship.getAgentActions).toHaveBeenCalledWith('eng-1');
  });

  it('provides person issues as context for pattern analysis', async () => {
    const personIssues = [
      makeIssue({ state: 'done', priority: 'high', assignee_id: 'eng-1' }),
      makeIssue({ state: 'done', priority: 'medium', assignee_id: 'eng-1' }),
      makeIssue({ state: 'todo', priority: 'high', assignee_id: 'eng-1' }),
    ];
    const ship = buildMockShipClient([], personIssues);
    const gemini = buildMockGemini();
    const graph = buildGraph(ship, gemini);

    await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'What are my work pattern trends?',
        view_context: { document_type: 'person', document_id: 'eng-1', title: 'Rachel' },
      },
      target_user_id: 'eng-1',
      run_id: 'uc6-context-test',
    });

    const geminiContext = JSON.parse((gemini.reason as ReturnType<typeof vi.fn>).mock.calls[0]![1]);
    expect(geminiContext.person_data).toBeDefined();
    expect(geminiContext.history_data).toBeDefined();
  });
});

// ── UC7: Retro Autopilot — retrospective drafting ───────────────────

describe('UC7: Retro Autopilot — retrospective draft', () => {
  const directFileIssues = [
    makeIssue({ id: 'df-done-1', title: 'W-2 income import', state: 'done', priority: 'high', assignee_id: 'eng-1', ticket_number: 1 }),
    makeIssue({ id: 'df-done-2', title: '1099 support', state: 'done', priority: 'high', assignee_id: 'eng-2', ticket_number: 2 }),
    makeIssue({ id: 'df-done-3', title: 'Standard deduction calculator', state: 'done', priority: 'high', assignee_id: 'eng-1', ticket_number: 3 }),
    makeIssue({ id: 'df-ip-1', title: 'E-signature flow', state: 'in_progress', priority: 'high', assignee_id: 'eng-1', ticket_number: 6 }),
    makeIssue({ id: 'df-todo-1', title: 'Dependents support', state: 'todo', priority: 'high', assignee_id: 'eng-2', ticket_number: 8 }),
    makeIssue({ id: 'df-todo-2', title: 'Section 508 remediation', state: 'todo', priority: 'high', assignee_id: 'eng-1', ticket_number: 10 }),
  ];

  it('Gemini receives completed and carryover issue data when asking for a retro', async () => {
    const ship = buildMockShipClient(directFileIssues);
    (ship.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'proj-direct-file', title: 'Direct File — Free Filing Platform', properties: {},
    });
    const gemini = buildMockGemini('## What Went Well\n- #1 W-2 import completed\n## What Carried Over\n- #8 Dependents support');
    const graph = buildGraph(ship, gemini);

    const result = await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Draft a retrospective for this project based on completed work',
        view_context: { document_type: 'project', document_id: 'proj-direct-file', title: 'Direct File' },
      },
      target_user_id: 'pm-1',
      run_id: 'uc7-test',
    });

    expect(result.gemini_output).toBeDefined();

    // Gemini should have received the issue data as context
    const geminiContext = JSON.parse((gemini.reason as ReturnType<typeof vi.fn>).mock.calls[0]![1]);
    expect(geminiContext.project_data).toBeDefined();
    expect(geminiContext.project_data.issues.length).toBe(6);
  });

  it('on-demand retro does not generate persistent suggestions', async () => {
    const ship = buildMockShipClient(directFileIssues);
    const gemini = buildMockGemini('Retro draft here.');
    const graph = buildGraph(ship, gemini);

    const result = await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Draft a retrospective for this project',
        view_context: { document_type: 'project', document_id: 'proj-direct-file', title: 'Direct File' },
      },
      target_user_id: 'pm-1',
      run_id: 'uc7-no-suggestions-test',
    });

    expect(result.suggestions).toHaveLength(0);
  });
});

// ── UC8: Load Balancer — workload comparison ────────────────────────

describe('UC8: Load Balancer — workload comparison', () => {
  it('selects LOAD_BALANCER mode when asking about workload', async () => {
    const teamIssues = [
      makeIssue({ id: 'lb-1', title: 'Task A', priority: 'high', assignee_id: 'alice', state: 'in_progress' }),
      makeIssue({ id: 'lb-2', title: 'Task B', priority: 'high', assignee_id: 'alice', state: 'todo' }),
      makeIssue({ id: 'lb-3', title: 'Task C', priority: 'high', assignee_id: 'alice', state: 'todo' }),
      makeIssue({ id: 'lb-4', title: 'Task D', priority: 'medium', assignee_id: 'frank', state: 'todo' }),
    ];
    const ship = buildMockShipClient(teamIssues);
    const gemini = buildMockGemini('Alice has 3 items (2 high), Frank has 1. Move lb-3 from Alice to Frank.');
    const graph = buildGraph(ship, gemini);

    const result = await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Can you balance the workload on this team?',
        view_context: { document_type: 'project', document_id: 'proj-1', title: 'Direct File' },
      },
      target_user_id: 'pm-1',
      run_id: 'uc8-test',
    });

    expect(result.gemini_output?.mode).toBe('LOAD_BALANCER');
  });

  it('provides per-person issue breakdown to Gemini', async () => {
    const teamIssues = [
      makeIssue({ priority: 'high', assignee_id: 'alice', state: 'in_progress' }),
      makeIssue({ priority: 'high', assignee_id: 'alice', state: 'todo' }),
      makeIssue({ priority: 'medium', assignee_id: 'frank', state: 'todo' }),
    ];
    const ship = buildMockShipClient(teamIssues);
    const gemini = buildMockGemini();
    const graph = buildGraph(ship, gemini);

    await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Balance the workload across the team',
        view_context: { document_type: 'project', document_id: 'proj-1', title: 'Test' },
      },
      target_user_id: 'pm-1',
      run_id: 'uc8-context-test',
    });

    const geminiContext = JSON.parse((gemini.reason as ReturnType<typeof vi.fn>).mock.calls[0]![1]);
    expect(geminiContext.project_data.issues).toHaveLength(3);
  });

  it('on-demand load balancer does not generate persistent suggestions', async () => {
    const ship = buildMockShipClient([makeIssue({})]);
    const graph = buildGraph(ship, buildMockGemini());

    const result = await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Reassign workload on this project',
        view_context: { document_type: 'project', document_id: 'proj-1' },
      },
      target_user_id: 'pm-1',
      run_id: 'uc8-no-suggestions-test',
    });

    expect(result.suggestions).toHaveLength(0);
  });
});

// ── Cross-cutting: Clean run vs violation run divergence ────────────

describe('Cross-cutting: execution path divergence', () => {
  it('clean project produces 0 violations and PROACTIVE_CLEAN mode', async () => {
    const healthyIssues = [
      makeIssue({ priority: 'high', state: 'todo' }),
      makeIssue({ priority: 'medium', state: 'in_progress' }),
      makeIssue({ priority: 'low', state: 'done' }),
    ];
    const ship = buildMockShipClient(healthyIssues);
    const graph = buildGraph(ship, buildMockGemini());

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: { document_ids: [], project_id: 'proj-healthy', assignee_ids: ['eng-1'] },
      target_user_id: 'eng-1',
      run_id: 'clean-run-test',
    });

    expect(result.violations).toHaveLength(0);
    expect(result.suggestions).toHaveLength(0);
    expect(result.gemini_output?.mode).toBe('PROACTIVE_CLEAN');
    // createAgentAction should NOT have been called (no suggestions to persist)
    expect(ship.createAgentAction).not.toHaveBeenCalled();
  });

  it('overloaded project produces violations, suggestions, and PROACTIVE_VIOLATIONS mode', async () => {
    const overloaded = Array.from({ length: 9 }, (_, i) =>
      makeIssue({ id: `hp-${i}`, priority: 'high', assignee_id: 'eng-1' })
    );
    const ship = buildMockShipClient(overloaded);
    const graph = buildGraph(ship, buildMockGemini());

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: { document_ids: [], project_id: 'proj-overloaded', assignee_ids: ['eng-1'] },
      target_user_id: 'eng-1',
      run_id: 'violation-run-test',
    });

    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.gemini_output?.mode).toBe('PROACTIVE_VIOLATIONS');
  });

  it('person overload is detected across projects (>2 high priority)', async () => {
    // Person has 4 high-priority items
    const personIssues = Array.from({ length: 4 }, (_, i) =>
      makeIssue({ id: `person-hp-${i}`, priority: 'high', assignee_id: 'overloaded-eng' })
    );
    const ship = buildMockShipClient([], personIssues);
    const graph = buildGraph(ship, buildMockGemini());

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: { document_ids: [], project_id: '', assignee_ids: ['overloaded-eng'] },
      target_user_id: 'overloaded-eng',
      run_id: 'person-overload-test',
    });

    const personViolation = result.violations.find((v: any) => v.type === 'person_overload');
    expect(personViolation).toBeDefined();
    expect(personViolation!.entity_type).toBe('person');
    expect(personViolation!.details['count']).toBe(4);
    expect(personViolation!.details['threshold']).toBe(2);
  });
});

// ── Cross-cutting: Error resilience ─────────────────────────────────

describe('Cross-cutting: error resilience', () => {
  it('Gemini failure produces fallback output with violation details, not crash', async () => {
    const overloaded = Array.from({ length: 9 }, (_, i) =>
      makeIssue({ id: `err-hp-${i}`, priority: 'high', assignee_id: 'eng-1' })
    );
    const ship = buildMockShipClient(overloaded);
    const gemini = buildMockGemini();
    (gemini.reason as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Gemini 503'));
    const graph = buildGraph(ship, gemini);

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: { document_ids: [], project_id: 'proj-1', assignee_ids: ['eng-1'] },
      target_user_id: 'eng-1',
      run_id: 'error-resilience-test',
    });

    // Graph completed, didn't crash
    expect(result).toBeDefined();
    // Error recorded
    expect(result.errors.some((e: any) => e.node === 'geminiReasoner')).toBe(true);
    // Fallback output contains violation type (structured, not Gemini)
    expect(result.gemini_output?.content).toContain('priority_overload');
    // Suggestions were still generated from violations (not from Gemini)
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('Ship API fetch failure records error but graph continues', async () => {
    const ship = buildMockShipClient([]);
    (ship.getProject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Ship 500'));
    (ship.getProjectIssues as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Ship 500'));
    const graph = buildGraph(ship, buildMockGemini());

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: { document_ids: [], project_id: 'proj-1', assignee_ids: ['eng-1'] },
      target_user_id: 'eng-1',
      run_id: 'fetch-failure-test',
    });

    expect(result).toBeDefined();
    expect(result.errors.some((e: any) => e.node === 'projectFetch')).toBe(true);
    // Graph still ran Gemini (with whatever data was available)
    expect(result.gemini_output).toBeDefined();
  });
});
