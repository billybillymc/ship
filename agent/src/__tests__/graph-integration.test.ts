import { describe, it, expect, vi } from 'vitest';
import { buildFleetGraph } from '../graph/graph.js';
import type { ShipClient } from '../lib/ship-client.js';
import type { GeminiClient } from '../lib/gemini-client.js';
import type { FleetGraphState } from '../graph/state.js';

// Mock ShipClient — the agent calls Ship over HTTP, not directly
function mockShipClient(): ShipClient {
  return {
    getProjectIssues: vi.fn().mockResolvedValue([
      { id: 'issue-1', title: 'Fix login bug', state: 'todo', priority: 'high', assignee_id: 'user-1', estimate: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
      { id: 'issue-2', title: 'Add OAuth', state: 'in_progress', priority: 'medium', assignee_id: 'user-1', estimate: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
    ]),
    getPersonIssues: vi.fn().mockResolvedValue([
      { id: 'issue-1', title: 'Fix login bug', state: 'todo', priority: 'high', assignee_id: 'user-1', estimate: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
    ]),
    getProject: vi.fn().mockResolvedValue({ id: 'proj-1', title: 'Auth Revamp', properties: {} }),
    getProgramProjects: vi.fn().mockResolvedValue([]),
    updateIssue: vi.fn().mockResolvedValue(undefined),
    createAgentAction: vi.fn().mockResolvedValue({ id: 'action-1' }),
    getAgentActions: vi.fn().mockResolvedValue([]),
    updateAgentAction: vi.fn().mockResolvedValue({ id: 'action-1' }),
  } as unknown as ShipClient;
}

function mockGeminiClient(): GeminiClient {
  return {
    reason: vi.fn().mockResolvedValue('Project Auth Revamp looks healthy. 2 issues tracked, 1 in progress.'),
    reasonStreaming: vi.fn(),
  } as unknown as GeminiClient;
}

describe('FleetGraph integration', () => {
  it('compiles the graph without errors', () => {
    const graph = buildFleetGraph({
      shipClient: mockShipClient(),
      geminiClient: mockGeminiClient(),
      workspaceId: 'ws-1',
    });

    expect(graph).toBeDefined();
    expect(typeof graph.invoke).toBe('function');
  });

  it('runs a clean proactive event through the full graph', async () => {
    const shipClient = mockShipClient();
    const geminiClient = mockGeminiClient();

    const graph = buildFleetGraph({
      shipClient,
      geminiClient,
      workspaceId: 'ws-1',
    });

    const input: Partial<FleetGraphState> = {
      trigger_type: 'event',
      trigger_payload: {
        document_ids: ['doc-1'],
        project_id: 'proj-1',
        assignee_ids: ['user-1'],
      },
      target_user_id: 'user-1',
      run_id: 'test-clean-run',
    };

    const result = await graph.invoke(input);

    // Fetch nodes were called
    expect(shipClient.getProject).toHaveBeenCalledWith('proj-1');
    expect(shipClient.getProjectIssues).toHaveBeenCalledWith('proj-1');
    expect(shipClient.getPersonIssues).toHaveBeenCalledWith('user-1');

    // Clean run — no violations (only 1 high priority, threshold is 7)
    expect(result.violations).toHaveLength(0);

    // Gemini was still called (Rule 4: always runs)
    expect(geminiClient.reason).toHaveBeenCalled();

    // Clean run → PROACTIVE_CLEAN mode
    expect(result.gemini_output?.mode).toBe('PROACTIVE_CLEAN');

    // No suggestions on clean run
    expect(result.suggestions).toHaveLength(0);

    // Notification sent (summary)
    expect(result.notifications.length).toBeGreaterThanOrEqual(1);
  });

  it('runs a violation proactive event with suggestions', async () => {
    // 9 high-priority issues → triggers priority_overload
    const highPriorityIssues = Array.from({ length: 9 }, (_, i) => ({
      id: `hp-${i}`, title: `High Issue ${i}`, state: 'todo', priority: 'high',
      assignee_id: 'user-1', estimate: null,
      updated_at: new Date().toISOString(), created_at: new Date().toISOString(),
    }));

    const shipClient = mockShipClient();
    (shipClient.getProjectIssues as ReturnType<typeof vi.fn>).mockResolvedValue(highPriorityIssues);

    const geminiClient = mockGeminiClient();
    (geminiClient.reason as ReturnType<typeof vi.fn>).mockResolvedValue(
      'Project Auth Revamp has 9 high-priority issues, exceeding the threshold of 7. Consider demoting the least urgent items.'
    );

    const graph = buildFleetGraph({
      shipClient,
      geminiClient,
      workspaceId: 'ws-1',
    });

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: {
        document_ids: ['doc-1'],
        project_id: 'proj-1',
        assignee_ids: ['user-1'],
      },
      target_user_id: 'user-1',
      run_id: 'test-violation-run',
    });

    // Violations detected
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v: any) => v.type === 'priority_overload')).toBe(true);

    // Gemini ran with PROACTIVE_VIOLATIONS mode
    expect(result.gemini_output?.mode).toBe('PROACTIVE_VIOLATIONS');

    // Suggestions were generated from violations
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].action_type).toBe('priority_change');

    // Notification sender persisted suggestions
    expect(shipClient.createAgentAction).toHaveBeenCalled();
  });

  it('runs on-demand mode skipping threshold evaluator', async () => {
    const shipClient = mockShipClient();
    const geminiClient = mockGeminiClient();
    (geminiClient.reason as ReturnType<typeof vi.fn>).mockResolvedValue(
      'This project has 2 issues. One is in progress (Add OAuth) and one is in todo (Fix login bug).'
    );

    const graph = buildFleetGraph({
      shipClient,
      geminiClient,
      workspaceId: 'ws-1',
    });

    const result = await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'What is going on with this project?',
        view_context: { document_type: 'project', document_id: 'proj-1', title: 'Auth Revamp' },
      },
      target_user_id: 'user-1',
      run_id: 'test-on-demand',
    });

    // Gemini was called in ON_DEMAND mode
    expect(result.gemini_output?.mode).toBe('ON_DEMAND');

    // No suggestions generated (on-demand doesn't create persistent suggestions)
    expect(result.suggestions).toHaveLength(0);

    // User question is preserved
    expect(result.user_question).toBe('What is going on with this project?');
  });

  it('handles Gemini failure gracefully with fallback', async () => {
    const shipClient = mockShipClient();
    // 9 high-priority issues
    (shipClient.getProjectIssues as ReturnType<typeof vi.fn>).mockResolvedValue(
      Array.from({ length: 9 }, (_, i) => ({
        id: `hp-${i}`, title: `Issue ${i}`, state: 'todo', priority: 'high',
        assignee_id: 'user-1', estimate: null,
        updated_at: new Date().toISOString(), created_at: new Date().toISOString(),
      }))
    );

    const geminiClient = mockGeminiClient();
    (geminiClient.reason as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Gemini API timeout'));

    const graph = buildFleetGraph({
      shipClient,
      geminiClient,
      workspaceId: 'ws-1',
    });

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: {
        document_ids: ['doc-1'],
        project_id: 'proj-1',
        assignee_ids: ['user-1'],
      },
      target_user_id: 'user-1',
      run_id: 'test-gemini-failure',
    });

    // Graph did not crash (Rule 5)
    expect(result).toBeDefined();

    // Error was recorded
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e: any) => e.node === 'geminiReasoner')).toBe(true);

    // Fallback output was generated
    expect(result.gemini_output).toBeDefined();
    expect(result.gemini_output?.content).toContain('priority_overload');
  });

  it('handles Ship API failure in fetch nodes gracefully', async () => {
    const shipClient = mockShipClient();
    (shipClient.getProject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Ship API down'));
    (shipClient.getProjectIssues as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Ship API down'));

    const geminiClient = mockGeminiClient();

    const graph = buildFleetGraph({
      shipClient,
      geminiClient,
      workspaceId: 'ws-1',
    });

    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: {
        document_ids: ['doc-1'],
        project_id: 'proj-1',
        assignee_ids: ['user-1'],
      },
      target_user_id: 'user-1',
      run_id: 'test-api-failure',
    });

    // Graph did not crash
    expect(result).toBeDefined();

    // Errors were recorded for fetch nodes
    expect(result.errors.some((e: any) => e.node === 'projectFetch')).toBe(true);
  });
});
