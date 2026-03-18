/**
 * FleetGraph Agent — entry point.
 * Starts HTTP server, connects event listener to Ship's WebSocket,
 * starts the scheduler, and runs the LangGraph graph on detected events.
 */
import { config } from 'dotenv';
config();

import { createServer } from './server.js';
import { EventListener } from './worker/event-listener.js';
import { Scheduler } from './worker/scheduler.js';
import { SuggestionLifecycle } from './worker/suggestion-lifecycle.js';
import { ShipClient } from './lib/ship-client.js';
import { GeminiClient } from './lib/gemini-client.js';
import { buildFleetGraph } from './graph/graph.js';
import { v4 as uuidv4 } from 'uuid';

const PORT = parseInt(process.env.AGENT_PORT ?? '3001', 10);
const SHIP_API_URL = process.env.SHIP_API_URL ?? 'http://localhost:3000';
const SHIP_WS_URL = process.env.SHIP_WS_URL ?? 'ws://localhost:3000';
const AGENT_TOKEN = process.env.AGENT_SERVICE_TOKEN ?? 'ship_fleetgraph_dev_token_do_not_use_in_prod';
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY ?? '';
const WORKSPACE_ID = process.env.WORKSPACE_ID ?? '';

// Initialize clients
const shipClient = new ShipClient(SHIP_API_URL, AGENT_TOKEN);
const geminiClient = new GeminiClient(GOOGLE_AI_API_KEY);

// Build the graph
const graph = buildFleetGraph({
  shipClient,
  geminiClient,
  workspaceId: WORKSPACE_ID,
});

// Start HTTP server with on-demand chat
const app = createServer({
  onDemand: { shipClient, geminiClient, workspaceId: WORKSPACE_ID },
});

app.listen(PORT, () => {
  console.log(`FleetGraph agent started on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Ship API: ${SHIP_API_URL}`);
  console.log(`  Gemini: gemini-2.5-flash`);
  console.log(`  LangSmith: ${process.env.LANGCHAIN_PROJECT ?? 'default'}`);
});

// Connect event listener for proactive mode
const eventListener = new EventListener();

eventListener.connect(SHIP_WS_URL, AGENT_TOKEN, async (projectId, assigneeIds) => {
  const runId = uuidv4();
  console.log(`[FleetGraph] Proactive run triggered — project: ${projectId}, run: ${runId}`);

  try {
    const result = await graph.invoke({
      trigger_type: 'event',
      trigger_payload: {
        document_ids: [],
        project_id: projectId,
        assignee_ids: assigneeIds,
      },
      target_user_id: assigneeIds[0] ?? '',
      run_id: runId,
    });

    const violationCount = result.violations?.length ?? 0;
    const suggestionCount = result.suggestions?.length ?? 0;
    console.log(`[FleetGraph] Run ${runId} complete — ${violationCount} violations, ${suggestionCount} suggestions`);
  } catch (error) {
    console.error(`[FleetGraph] Run ${runId} failed:`, error);
  }
});

// Start scheduler for morning briefings and staleness cron
const scheduler = new Scheduler({
  shipClient,
  geminiClient,
  workspaceId: WORKSPACE_ID,
  graphInvoke: (input) => graph.invoke(input),
});
scheduler.start();

// Start suggestion lifecycle worker (hourly: snooze expiry + stale pending cleanup)
const lifecycle = new SuggestionLifecycle(shipClient);
scheduler.schedule('suggestion-lifecycle', 60 * 60 * 1000, async () => {
  await lifecycle.processExpired();
});

// Run initial scan on startup — populate the action queue with existing violations
async function runInitialScan() {
  console.log('[FleetGraph] Running initial scan against seed data...');

  try {
    // Get actual projects (document_type=project) from the projects API
    const projRes = await globalThis.fetch(`${SHIP_API_URL}/api/projects`, {
      headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` },
    });
    const projData = await projRes.json() as any;
    const projects = (Array.isArray(projData) ? projData : (projData.data ?? []))
      .map((p: any) => ({ id: p.id, title: p.title ?? p.name }));
    console.log(`[FleetGraph] Scanning ${projects.length} projects...`);

    let totalViolations = 0;
    let totalSuggestions = 0;

    for (const project of projects) {
      const runId = uuidv4();
      try {
        // Timeout each project scan at 30 seconds
        const result = await Promise.race([
          graph.invoke({
            trigger_type: 'event',
            trigger_payload: {
              document_ids: [],
              project_id: project.id,
              assignee_ids: [],
            },
            target_user_id: '',
            run_id: runId,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000)),
        ]) as any;

        const v = result.violations?.length ?? 0;
        const s = result.suggestions?.length ?? 0;
        if (v > 0) {
          console.log(`  [${project.title}] ${v} violations, ${s} suggestions`);
          totalViolations += v;
          totalSuggestions += s;
        }
      } catch (error) {
        console.error(`  [${project.title}] scan failed:`, error instanceof Error ? error.message : error);
      }
    }

    console.log(`[FleetGraph] Initial scan complete — ${totalViolations} violations, ${totalSuggestions} suggestions across ${projects.length} projects`);
  } catch (error) {
    console.error('[FleetGraph] Initial scan failed:', error instanceof Error ? error.message : error);
  }
}

// Delay initial scan to let the API finish seeding
setTimeout(runInitialScan, 5000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('FleetGraph agent shutting down...');
  eventListener.clear();
  scheduler.clear();
  process.exit(0);
});
