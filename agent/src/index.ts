/**
 * FleetGraph Agent — entry point.
 * Starts HTTP server, connects event listener to Ship's WebSocket,
 * and runs the LangGraph graph on detected events.
 */
import { config } from 'dotenv';
config();

import { createServer } from './server.js';
import { EventListener } from './worker/event-listener.js';
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

// Start HTTP server
const app = createServer();

app.listen(PORT, () => {
  console.log(`FleetGraph agent started on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Ship API: ${SHIP_API_URL}`);
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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('FleetGraph agent shutting down...');
  eventListener.clear();
  process.exit(0);
});
