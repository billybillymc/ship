/**
 * Manual test script — triggers graph runs against the live Docker API
 * to verify Gemini reasoning and LangSmith tracing.
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

async function getProjectByName(name: string): Promise<string | null> {
  const res = await fetch(`${SHIP_API_URL}/api/documents?document_type=project`, {
    headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` },
  });
  const data = await res.json() as any;
  const docs = Array.isArray(data) ? data : (data.data ?? []);
  const match = docs.find((d: any) => d.title?.includes(name));
  return match?.id ?? null;
}

async function runTest(label: string, projectName: string, triggerType: 'event' | 'on_demand' = 'event', question?: string) {
  const runId = uuidv4();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${label} — run_id: ${runId}`);
  console.log(`${'='.repeat(60)}`);

  const projectId = await getProjectByName(projectName);
  if (!projectId) {
    console.error(`Project "${projectName}" not found`);
    return;
  }
  console.log(`Project: ${projectName} (${projectId})`);

  const input: Record<string, unknown> = {
    trigger_type: triggerType,
    run_id: runId,
    target_user_id: '', // Will be filled by fetch
  };

  if (triggerType === 'event') {
    input.trigger_payload = {
      document_ids: [],
      project_id: projectId,
      assignee_ids: [],
    };
  } else {
    input.trigger_payload = {
      user_question: question ?? 'How is this project doing?',
      view_context: { document_type: 'project', document_id: projectId, title: projectName },
    };
  }

  try {
    const start = Date.now();
    const result = await graph.invoke(input);
    const elapsed = Date.now() - start;

    console.log(`\nCompleted in ${elapsed}ms`);
    console.log(`Violations: ${result.violations?.length ?? 0}`);
    console.log(`Suggestions: ${result.suggestions?.length ?? 0}`);
    console.log(`Errors: ${result.errors?.length ?? 0}`);
    console.log(`Gemini mode: ${result.gemini_output?.mode}`);
    console.log(`\nGemini output:\n${result.gemini_output?.content?.slice(0, 500)}`);

    if (result.violations?.length > 0) {
      console.log(`\nViolations:`);
      for (const v of result.violations) {
        console.log(`  - [${v.type}] ${v.entity_name}: severity ${v.severity}`);
      }
    }

    if (result.errors?.length > 0) {
      console.log(`\nErrors:`);
      for (const e of result.errors) {
        console.log(`  - [${e.node}] ${e.message}`);
      }
    }
  } catch (error) {
    console.error('Graph run failed:', error);
  }
}

async function main() {
  console.log('FleetGraph Test Runs');
  console.log(`Ship API: ${SHIP_API_URL}`);
  console.log(`Gemini model: gemini-2.5-flash`);
  console.log(`LangSmith project: ${process.env.LANGCHAIN_PROJECT}`);

  // Test 1: Clean run — healthy project
  await runTest('TRACE 1: Clean Run (Taxpayer Digital Experience)', 'Taxpayer Digital Experience');

  // Test 2: Violation run — overloaded project
  await runTest('TRACE 2: Violation Run (Direct File)', 'Direct File');

  // Test 3: On-demand chat
  await runTest(
    'TRACE 3: On-Demand Chat (Direct File)',
    'Direct File',
    'on_demand',
    'What are the biggest risks on this project?'
  );

  console.log('\n\nDone! Check LangSmith for traces.');
}

main().catch(console.error);
