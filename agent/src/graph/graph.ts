/**
 * LangGraph graph definition — the single graph for both proactive and on-demand modes.
 * Per Rule 3: one graph, two modes. The difference is the trigger and conditional edges.
 * Per Rule 6: fetch nodes are always parallel (fan-out).
 */
import { StateGraph, END } from '@langchain/langgraph';
import { FleetGraphAnnotation, type FleetGraphState } from './state.js';
import { triggerContext } from './nodes/trigger-context.js';
import { userContext } from './nodes/user-context.js';
import { createProjectFetch } from './nodes/project-fetch.js';
import { createPersonFetch } from './nodes/person-fetch.js';
import { thresholdEvaluator } from './nodes/threshold-evaluator.js';
import { createGeminiReasoner } from './nodes/gemini-reasoner.js';
import { suggestionGenerator } from './nodes/suggestion-generator.js';
import { createNotificationSender } from './nodes/notification-sender.js';
import type { ShipClient } from '../lib/ship-client.js';
import type { GeminiClient } from '../lib/gemini-client.js';

export interface GraphDependencies {
  shipClient: ShipClient;
  geminiClient: GeminiClient;
  workspaceId: string;
}

export function buildFleetGraph(deps: GraphDependencies) {
  const projectFetch = createProjectFetch(deps.shipClient);
  const personFetch = createPersonFetch(deps.shipClient);
  const geminiReasoner = createGeminiReasoner(deps.geminiClient);
  const notificationSender = createNotificationSender(deps.shipClient, deps.workspaceId);

  const graph = new StateGraph(FleetGraphAnnotation)
    .addNode('triggerContext', triggerContext)
    .addNode('userContext', userContext)
    .addNode('projectFetch', projectFetch)
    .addNode('personFetch', personFetch)
    .addNode('thresholdEvaluator', thresholdEvaluator)
    .addNode('geminiReasoner', geminiReasoner)
    .addNode('suggestionGenerator', suggestionGenerator)
    .addNode('notificationSender', notificationSender)

    // Entry → trigger → user context
    .addEdge('__start__', 'triggerContext')
    .addEdge('triggerContext', 'userContext')

    // User context → parallel fetch (fan-out)
    .addConditionalEdges('userContext', (state: FleetGraphState) => {
      // On-demand skips threshold evaluation — goes straight to fetch then Gemini
      if (state.trigger_type === 'on_demand') {
        return ['projectFetch', 'personFetch'];
      }
      return ['projectFetch', 'personFetch'];
    })

    // Fetch fan-in → threshold evaluator (or Gemini for on-demand)
    .addConditionalEdges('projectFetch', (state: FleetGraphState) => {
      if (state.trigger_type === 'on_demand') {
        return ['geminiReasoner'];
      }
      return ['thresholdEvaluator'];
    })
    .addConditionalEdges('personFetch', (state: FleetGraphState) => {
      if (state.trigger_type === 'on_demand') {
        return ['geminiReasoner'];
      }
      return ['thresholdEvaluator'];
    })

    // Threshold → Gemini (always runs, per Rule 4)
    .addEdge('thresholdEvaluator', 'geminiReasoner')

    // After Gemini: conditional routing based on violations
    .addConditionalEdges('geminiReasoner', (state: FleetGraphState) => {
      if (state.trigger_type === 'on_demand') {
        // On-demand: skip suggestion generator, go straight to notification
        return ['notificationSender'];
      }
      if (state.violations.length > 0) {
        return ['suggestionGenerator'];
      }
      // Clean run: summary only
      return ['notificationSender'];
    })

    // Suggestion generator → notification sender
    .addEdge('suggestionGenerator', 'notificationSender')

    // Terminal
    .addEdge('notificationSender', END);

  return graph.compile();
}
