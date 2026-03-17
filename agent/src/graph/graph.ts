/**
 * LangGraph graph definition — the single graph for all modes.
 * Per Rule 3: one graph, two modes. The difference is the trigger and conditional edges.
 * Per Rule 6: fetch nodes are always parallel (fan-out).
 */
import { StateGraph, END } from '@langchain/langgraph';
import { FleetGraphAnnotation, type FleetGraphState } from './state.js';
import { triggerContext } from './nodes/trigger-context.js';
import { userContext } from './nodes/user-context.js';
import { createProjectFetch } from './nodes/project-fetch.js';
import { createPersonFetch } from './nodes/person-fetch.js';
import { createProgramFetch } from './nodes/program-fetch.js';
import { createHistoryFetch } from './nodes/history-fetch.js';
import { createRetroFetch } from './nodes/retro-fetch.js';
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
  const programFetch = createProgramFetch(deps.shipClient);
  const historyFetch = createHistoryFetch(deps.shipClient);
  const retroFetch = createRetroFetch(deps.shipClient);
  const geminiReasoner = createGeminiReasoner(deps.geminiClient);
  const notificationSender = createNotificationSender(deps.shipClient, deps.workspaceId);

  const graph = new StateGraph(FleetGraphAnnotation)
    .addNode('triggerContext', triggerContext)
    .addNode('userContext', userContext)
    .addNode('projectFetch', projectFetch)
    .addNode('personFetch', personFetch)
    .addNode('programFetch', programFetch)
    .addNode('historyFetch', historyFetch)
    .addNode('retroFetch', retroFetch)
    .addNode('thresholdEvaluator', thresholdEvaluator)
    .addNode('geminiReasoner', geminiReasoner)
    .addNode('suggestionGenerator', suggestionGenerator)
    .addNode('notificationSender', notificationSender)

    // Entry → trigger → user context
    .addEdge('__start__', 'triggerContext')
    .addEdge('triggerContext', 'userContext')

    // User context → parallel fetch (fan-out based on trigger type)
    .addConditionalEdges('userContext', (state: FleetGraphState) => {
      if (state.trigger_type === 'on_demand') {
        const question = state.user_question?.toLowerCase() ?? '';
        // Coach needs history; load balancer needs person data
        if (question.includes('coach') || question.includes('pattern') || question.includes('trend')) {
          return ['personFetch', 'historyFetch'];
        }
        if (question.includes('load') || question.includes('balance') || question.includes('workload')) {
          return ['projectFetch', 'personFetch'];
        }
        return ['projectFetch', 'personFetch'];
      }
      if (state.trigger_type === 'scheduled') {
        // Scheduled runs fetch broadly
        return ['projectFetch', 'personFetch', 'programFetch'];
      }
      // Event-driven: fetch affected project + person
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
    .addConditionalEdges('programFetch', (state: FleetGraphState) => {
      if (state.trigger_type === 'on_demand') {
        return ['geminiReasoner'];
      }
      return ['thresholdEvaluator'];
    })
    .addConditionalEdges('historyFetch', (_state: FleetGraphState) => {
      // History is only fetched for on-demand coach mode
      return ['geminiReasoner'];
    })

    // RetroFetch runs after projectFetch populates project_data
    .addConditionalEdges('retroFetch', (_state: FleetGraphState) => {
      return ['geminiReasoner'];
    })

    // Threshold → Gemini (always runs, per Rule 4)
    .addEdge('thresholdEvaluator', 'geminiReasoner')

    // After Gemini: conditional routing based on violations
    .addConditionalEdges('geminiReasoner', (state: FleetGraphState) => {
      if (state.trigger_type === 'on_demand') {
        return ['notificationSender'];
      }
      if (state.violations.length > 0) {
        return ['suggestionGenerator'];
      }
      return ['notificationSender'];
    })

    // Suggestion generator → notification sender
    .addEdge('suggestionGenerator', 'notificationSender')

    // Terminal
    .addEdge('notificationSender', END);

  return graph.compile();
}
