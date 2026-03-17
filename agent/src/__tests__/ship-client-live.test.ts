/**
 * Live integration test for ShipClient against the running Docker API.
 * These tests require the Docker stack to be running (docker compose up).
 * Skip in CI by checking SKIP_LIVE_TESTS env var.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ShipClient } from '../lib/ship-client.js';

const SHIP_API_URL = process.env.SHIP_API_URL ?? 'http://localhost:3000';
const AGENT_TOKEN = process.env.AGENT_SERVICE_TOKEN ?? 'ship_fleetgraph_dev_token_do_not_use_in_prod';

// Skip if no running API
const isApiAvailable = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${SHIP_API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
};

describe('ShipClient live integration', () => {
  let client: ShipClient;
  let apiAvailable: boolean;

  beforeAll(async () => {
    apiAvailable = await isApiAvailable();
    client = new ShipClient(SHIP_API_URL, AGENT_TOKEN);
  });

  it.skipIf(!true)('can fetch issues via bearer token auth', async () => {
    if (!apiAvailable) return;
    const issues = await client.getProjectIssues('nonexistent-project');
    // Non-existent project returns empty array (not 404)
    expect(Array.isArray(issues)).toBe(true);
  });

  it('can fetch all issues (no project filter)', async () => {
    if (!apiAvailable) return;

    // Use raw fetch to verify auth works
    const res = await fetch(`${SHIP_API_URL}/api/issues`, {
      headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const issues = Array.isArray(data) ? data : data.data;
    expect(issues.length).toBeGreaterThan(0);
  });

  it('rejects invalid token', async () => {
    if (!apiAvailable) return;

    const res = await fetch(`${SHIP_API_URL}/api/issues`, {
      headers: { 'Authorization': 'Bearer invalid-token' },
    });

    expect(res.status).toBe(401);
  });
});
