/**
 * Full test suite — triggers all 8 use case graph runs against the live Docker API
 * to generate LangSmith trace links for FLEETGRAPH.md.
 *
 * Usage: npx tsx src/scripts/test-run.ts
 */
import { config } from 'dotenv';
config();

import { ShipClient } from '../lib/ship-client.js';
import { GeminiClient } from '../lib/gemini-client.js';
import { buildFleetGraph } from '../graph/graph.js';
import { v4 as uuidv4 } from 'uuid';

const SHIP_API_URL = process.env.SHIP_API_URL ?? 'http://localhost:3000';
const AGENT_TOKEN = process.env.AGENT_SERVICE_TOKEN ?? '';
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY ?? '';
const WORKSPACE_ID = process.env.WORKSPACE_ID ?? '';

if (!GOOGLE_AI_API_KEY) {
  console.error('GOOGLE_AI_API_KEY not set in agent/.env');
  process.exit(1);
}

const shipClient = new ShipClient(SHIP_API_URL, AGENT_TOKEN);
const geminiClient = new GeminiClient(GOOGLE_AI_API_KEY);
const graph = buildFleetGraph({ shipClient, geminiClient, workspaceId: WORKSPACE_ID });

async function getProjectByName(name: string): Promise<{ id: string; title: string } | null> {
  const res = await fetch(`${SHIP_API_URL}/api/documents?document_type=project`, {
    headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` },
  });
  const data = await res.json() as any;
  const docs = Array.isArray(data) ? data : (data.data ?? []);
  const match = docs.find((d: any) => d.title?.includes(name));
  return match ? { id: match.id, title: match.title } : null;
}

async function getUserByName(name: string): Promise<string | null> {
  const res = await fetch(`${SHIP_API_URL}/api/documents?document_type=person`, {
    headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` },
  });
  const data = await res.json() as any;
  const docs = Array.isArray(data) ? data : (data.data ?? []);
  const match = docs.find((d: any) => d.title === name);
  return match?.properties?.user_id ?? null;
}

interface TestResult {
  label: string;
  runId: string;
  violations: number;
  suggestions: number;
  mode: string;
  output: string;
  elapsed: number;
}

async function runTest(
  label: string,
  input: Record<string, unknown>,
): Promise<TestResult> {
  const runId = input.run_id as string;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${label} — run_id: ${runId}`);
  console.log(`${'='.repeat(60)}`);

  const start = Date.now();
  const result = await graph.invoke(input);
  const elapsed = Date.now() - start;

  const violations = result.violations?.length ?? 0;
  const suggestions = result.suggestions?.length ?? 0;
  const mode = result.gemini_output?.mode ?? 'unknown';
  const output = result.gemini_output?.content?.slice(0, 300) ?? '';

  console.log(`Completed in ${elapsed}ms | Mode: ${mode} | Violations: ${violations} | Suggestions: ${suggestions}`);
  console.log(`Output: ${output}...`);

  if (result.errors?.length > 0) {
    console.log(`Errors: ${result.errors.map((e: any) => `[${e.node}] ${e.message}`).join(', ')}`);
  }

  return { label, runId, violations, suggestions, mode, output, elapsed };
}

async function main() {
  console.log('FleetGraph — Full Test Suite (8 Use Cases)');
  console.log(`Ship API: ${SHIP_API_URL}`);
  console.log(`Gemini: gemini-2.5-flash`);
  console.log(`LangSmith: ${process.env.LANGCHAIN_PROJECT ?? 'default'}`);

  const results: TestResult[] = [];

  // UC1: Director Overview — cross-program portfolio scan
  const directFile = await getProjectByName('Direct File');
  results.push(await runTest('UC1: Director Overview', {
    trigger_type: 'scheduled',
    trigger_payload: { schedule_type: 'morning_briefing' },
    target_user_id: '',
    run_id: uuidv4(),
  }));

  // UC2: PM Alert — project with too many in-progress
  const paymentIntegrity = await getProjectByName('Payment Integrity');
  if (paymentIntegrity) {
    results.push(await runTest('UC2: PM Alert (in-progress overload)', {
      trigger_type: 'event',
      trigger_payload: { document_ids: [], project_id: paymentIntegrity.id, assignee_ids: [] },
      target_user_id: '',
      run_id: uuidv4(),
    }));
  }

  // UC3: Engineer Nudge — stale high-priority issue
  const imfMigration = await getProjectByName('Individual Master File');
  if (imfMigration) {
    results.push(await runTest('UC3: Engineer Nudge (stale issues)', {
      trigger_type: 'event',
      trigger_payload: { document_ids: [], project_id: imfMigration.id, assignee_ids: [] },
      target_user_id: '',
      run_id: uuidv4(),
    }));
  }

  // UC4: Morning Briefing — daily digest
  const rachelId = await getUserByName('Rachel Goldberg');
  results.push(await runTest('UC4: Morning Briefing', {
    trigger_type: 'scheduled',
    trigger_payload: { schedule_type: 'morning_briefing' },
    target_user_id: rachelId ?? '',
    run_id: uuidv4(),
  }));

  // UC5: Project Kickoff — orphaned issue clustering
  if (directFile) {
    results.push(await runTest('UC5: Project Kickoff Suggestion', {
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Are there any orphaned issues that should become a new project?',
        view_context: { document_type: 'workspace', document_id: WORKSPACE_ID, title: 'Treasury' },
      },
      target_user_id: '',
      run_id: uuidv4(),
    }));
  }

  // UC6: Coach — work pattern analysis
  if (rachelId) {
    results.push(await runTest('UC6: Coach (pattern analysis)', {
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'What are my work patterns and trends over the past few weeks?',
        view_context: { document_type: 'person', document_id: rachelId, title: 'Rachel Goldberg' },
      },
      target_user_id: rachelId,
      run_id: uuidv4(),
    }));
  }

  // UC7: Retro Autopilot — retro draft from completed issues
  if (directFile) {
    results.push(await runTest('UC7: Retro Autopilot', {
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Draft a retrospective for this project based on completed work',
        view_context: { document_type: 'project', document_id: directFile.id, title: directFile.title },
      },
      target_user_id: '',
      run_id: uuidv4(),
    }));
  }

  // UC8: Load Balancer — workload comparison
  if (directFile) {
    results.push(await runTest('UC8: Load Balancer', {
      trigger_type: 'on_demand',
      trigger_payload: {
        user_question: 'Can you balance the workload across team members on this project?',
        view_context: { document_type: 'project', document_id: directFile.id, title: directFile.title },
      },
      target_user_id: '',
      run_id: uuidv4(),
    }));
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`\n| # | Use Case | Mode | Violations | Suggestions | Time |`);
  console.log(`|---|----------|------|------------|-------------|------|`);
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    console.log(`| ${i + 1} | ${r.label} | ${r.mode} | ${r.violations} | ${r.suggestions} | ${r.elapsed}ms |`);
  }

  console.log(`\nAll ${results.length} traces sent to LangSmith project: ${process.env.LANGCHAIN_PROJECT}`);
  console.log('View at: https://smith.langchain.com');
}

main().catch(console.error);
