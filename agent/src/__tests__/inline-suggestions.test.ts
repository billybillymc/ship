/**
 * Tests for inline suggestion handling in on-demand command mode.
 * Verifies that command questions produce structured suggestion events
 * in the SSE stream, and that the graph generates suggestions when
 * thresholds are violated during on-demand command runs.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildFleetGraph } from '../graph/graph.js';
import type { ShipClient } from '../lib/ship-client.js';
import type { GeminiClient } from '../lib/gemini-client.js';
import type { Issue } from '../graph/state.js';

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

function buildMockShipClient(projectIssues: Issue[]): ShipClient {
  return {
    getProjectIssues: vi.fn().mockResolvedValue(projectIssues),
    getPersonIssues: vi.fn().mockResolvedValue([]),
    getProject: vi.fn().mockResolvedValue({ id: 'proj-1', title: 'Test Project', properties: {} }),
    getPrograms: vi.fn().mockResolvedValue([]),
    getProgramProjects: vi.fn().mockResolvedValue([]),
    getAllIssues: vi.fn().mockResolvedValue(projectIssues),
    updateIssue: vi.fn().mockResolvedValue(undefined),
    createAgentAction: vi.fn().mockResolvedValue({ id: 'action-1' }),
    getAgentActions: vi.fn().mockResolvedValue([]),
    updateAgentAction: vi.fn().mockResolvedValue({ id: 'action-1' }),
    notifyUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as ShipClient;
}

function buildMockGemini(): GeminiClient {
  return {
    reason: vi.fn().mockResolvedValue('Analysis complete.'),
    reasonStreaming: vi.fn(),
  } as unknown as GeminiClient;
}

describe('Inline suggestions from on-demand commands', () => {
  it('"health check" command runs thresholds and generates suggestions for overloaded project', async () => {
    const issues = Array.from({ length: 9 }, (_, i) =>
      makeIssue({ id: `hp-${i}`, priority: 'high', assignee_id: 'eng-1' })
    );
    const ship = buildMockShipClient(issues);
    const graph = buildFleetGraph({ shipClient: ship, geminiClient: buildMockGemini(), workspaceId: 'ws-1' });

    const result = await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Run a health check on this project',
        view_context: { document_type: 'project', document_id: 'proj-1', title: 'Direct File' },
      },
      target_user_id: 'pm-1',
      run_id: 'inline-health-check',
    });

    // Thresholds should have run (command mode)
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v: any) => v.type === 'priority_overload')).toBe(true);

    // Suggestions should have been generated
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].action_type).toBe('priority_change');
  });

  it('"check stale issues" command detects stale items and generates suggestions', async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const issues = [
      makeIssue({ id: 'stale-1', title: 'Old issue', priority: 'high', state: 'todo', updated_at: fiveDaysAgo }),
      makeIssue({ id: 'fresh-1', title: 'New issue', priority: 'high', state: 'todo' }),
    ];
    const ship = buildMockShipClient(issues);
    const graph = buildFleetGraph({ shipClient: ship, geminiClient: buildMockGemini(), workspaceId: 'ws-1' });

    const result = await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Check for stale issues on this project',
        view_context: { document_type: 'project', document_id: 'proj-1', title: 'IMF Migration' },
      },
      target_user_id: 'eng-1',
      run_id: 'inline-stale-check',
    });

    const staleViolations = result.violations.filter((v: any) => v.type === 'stale_issue');
    expect(staleViolations).toHaveLength(1);
    expect(staleViolations[0].details['issue_id']).toBe('stale-1');

    // Should generate a suggestion for the stale issue
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('regular on-demand question does NOT run thresholds or generate suggestions', async () => {
    const issues = Array.from({ length: 9 }, (_, i) =>
      makeIssue({ id: `hp-${i}`, priority: 'high', assignee_id: 'eng-1' })
    );
    const ship = buildMockShipClient(issues);
    const graph = buildFleetGraph({ shipClient: ship, geminiClient: buildMockGemini(), workspaceId: 'ws-1' });

    const result = await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'How is this project doing?',
        view_context: { document_type: 'project', document_id: 'proj-1', title: 'Direct File' },
      },
      target_user_id: 'pm-1',
      run_id: 'inline-regular-question',
    });

    // No thresholds, no suggestions — just Gemini response
    expect(result.violations).toHaveLength(0);
    expect(result.suggestions).toHaveLength(0);
  });

  it('"morning briefing" command routes through thresholds', async () => {
    const ship = buildMockShipClient([makeIssue({ priority: 'medium' })]);
    const graph = buildFleetGraph({ shipClient: ship, geminiClient: buildMockGemini(), workspaceId: 'ws-1' });

    const result = await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Give me my morning briefing',
        view_context: { document_type: 'workspace', document_id: 'ws-1', title: 'Ship' },
      },
      target_user_id: 'user-1',
      run_id: 'inline-briefing',
    });

    // Should complete without error — briefing goes through thresholds
    expect(result.gemini_output).toBeDefined();
    // No violations on a healthy project = no suggestions
    expect(result.suggestions).toHaveLength(0);
  });

  it('suggestion contains correct issue_id, field, from, and to for priority_change', async () => {
    const issues = Array.from({ length: 9 }, (_, i) =>
      makeIssue({ id: `hp-${i}`, priority: 'high', assignee_id: 'eng-1' })
    );
    const ship = buildMockShipClient(issues);
    const graph = buildFleetGraph({ shipClient: ship, geminiClient: buildMockGemini(), workspaceId: 'ws-1' });

    const result = await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Run a health check on this project',
        view_context: { document_type: 'project', document_id: 'proj-1', title: 'Test' },
      },
      target_user_id: 'pm-1',
      run_id: 'inline-suggestion-shape',
    });

    const sug = result.suggestions.find((s: any) => s.action_type === 'priority_change');
    expect(sug).toBeDefined();
    expect(sug!.suggestion['issue_id']).toBeDefined();
    expect(sug!.suggestion['field']).toBe('priority');
    expect(sug!.suggestion['from']).toBe('high');
    expect(sug!.suggestion['to']).toBe('medium');
    expect(sug!.severity_score).toBeGreaterThan(0);
  });

  it('in-progress overload command produces status_change suggestion', async () => {
    const issues = Array.from({ length: 6 }, (_, i) =>
      makeIssue({ id: `ip-${i}`, state: 'in_progress', priority: 'medium', assignee_id: 'eng-1' })
    );
    const ship = buildMockShipClient(issues);
    const graph = buildFleetGraph({ shipClient: ship, geminiClient: buildMockGemini(), workspaceId: 'ws-1' });

    const result = await graph.invoke({
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Run a health check on this project',
        view_context: { document_type: 'project', document_id: 'proj-1', title: 'Payment Integrity' },
      },
      target_user_id: 'pm-1',
      run_id: 'inline-ip-overload',
    });

    const ipSug = result.suggestions.find((s: any) => s.action_type === 'status_change');
    expect(ipSug).toBeDefined();
    expect(ipSug!.suggestion['from']).toBe('in_progress');
    expect(ipSug!.suggestion['to']).toBe('todo');
  });
});
