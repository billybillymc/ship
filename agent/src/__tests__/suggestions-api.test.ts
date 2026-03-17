/**
 * Tests for the agent suggestions API endpoints on the Ship API.
 * Requires the Docker stack to be running.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const SHIP_API_URL = process.env.SHIP_API_URL ?? 'http://localhost:3000';
const AGENT_TOKEN = process.env.AGENT_SERVICE_TOKEN ?? 'ship_fleetgraph_dev_token_do_not_use_in_prod';

const isApiAvailable = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${SHIP_API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
};

async function getTestIds(): Promise<{ workspaceId: string; userId: string } | null> {
  try {
    // Get workspace and agent user IDs from the API
    const res = await fetch(`${SHIP_API_URL}/api/team`, {
      headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const members = Array.isArray(data) ? data : data.data ?? [];
    const agent = members.find((m: any) => m.email === 'agent@ship.internal' || m.name === 'Ship Agent');
    if (!agent) return null;
    return { workspaceId: agent.workspace_id ?? '', userId: agent.user_id ?? agent.id ?? '' };
  } catch {
    return null;
  }
}

describe('Agent Suggestions API', () => {
  let apiAvailable: boolean;
  let testIds: { workspaceId: string; userId: string } | null;
  let createdActionId: string | null = null;

  beforeAll(async () => {
    apiAvailable = await isApiAvailable();
    if (apiAvailable) {
      testIds = await getTestIds();
    }
  });

  afterAll(async () => {
    // Clean up any test actions
    if (createdActionId && apiAvailable) {
      await fetch(`${SHIP_API_URL}/api/agent/suggestions/${createdActionId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AGENT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'dismissed' }),
      });
    }
  });

  it('GET /api/agent/suggestions returns suggestions list', async () => {
    if (!apiAvailable) return;

    const res = await fetch(`${SHIP_API_URL}/api/agent/suggestions?status=pending`, {
      headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/agent/suggestions creates a new suggestion', async () => {
    if (!apiAvailable || !testIds) return;

    const res = await fetch(`${SHIP_API_URL}/api/agent/suggestions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AGENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspace_id: testIds.workspaceId,
        target_user_id: testIds.userId,
        action_type: 'priority_change',
        severity_score: 12,
        context: { test: true, threshold: 7, count: 9 },
        suggestion: { issue_id: 'test-issue', field: 'priority', from: 'high', to: 'medium' },
        gemini_reasoning: 'Test reasoning — this is a test suggestion.',
        langsmith_trace_id: 'test-trace-001',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.status).toBe('pending');
    expect(body.action_type).toBe('priority_change');
    createdActionId = body.id;
  });

  it('PATCH /api/agent/suggestions/:id dismisses a suggestion', async () => {
    if (!apiAvailable || !createdActionId) return;

    const res = await fetch(`${SHIP_API_URL}/api/agent/suggestions/${createdActionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AGENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'dismissed' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('dismissed');
    expect(body.resolved_at).toBeDefined();
    createdActionId = null; // Already dismissed, no cleanup needed
  });

  it('rejects invalid suggestion creation', async () => {
    if (!apiAvailable) return;

    const res = await fetch(`${SHIP_API_URL}/api/agent/suggestions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AGENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Missing required fields
        action_type: 'test',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated requests', async () => {
    if (!apiAvailable) return;

    const res = await fetch(`${SHIP_API_URL}/api/agent/suggestions`);
    expect(res.status).toBe(401);
  });
});
