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

/**
 * Detect if an on-demand question is a "command" that should run
 * the proactive path (thresholds + suggestions) instead of just chat.
 */
function isCommandQuestion(question: string | null): boolean {
  if (!question) return false;
  const q = question.toLowerCase();
  return /health\s*check|run.*check|scan.*project|scan.*program|check.*threshold/.test(q)
    || /morning\s*briefing|daily\s*briefing|give.*briefing/.test(q)
    || /stale\s*issue|check.*stale|find.*stale|overdue/.test(q)
    || /scan\s*all|scan.*program|portfolio.*scan|risk.*scan/.test(q);
}

function isCoachQuestion(question: string | null): boolean {
  if (!question) return false;
  const q = question.toLowerCase();
  return /coach|pattern|trend/.test(q);
}

function isScanAllQuestion(question: string | null): boolean {
  if (!question) return false;
  const q = question.toLowerCase();
  return /scan\s*all|all\s*program|portfolio|director.*overview|morning.*briefing|daily.*briefing/.test(q);
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

    // User context → parallel fetch (fan-out based on trigger type + question)
    .addConditionalEdges('userContext', (state: FleetGraphState) => {
      if (state.trigger_type === 'on_demand') {
        const q = state.user_question;
        if (isCoachQuestion(q)) {
          return ['personFetch', 'historyFetch'];
        }
        if (isScanAllQuestion(q)) {
          return ['projectFetch', 'personFetch', 'programFetch'];
        }
        return ['projectFetch', 'personFetch'];
      }
      if (state.trigger_type === 'scheduled') {
        return ['projectFetch', 'personFetch', 'programFetch'];
      }
      return ['projectFetch', 'personFetch'];
    })

    // Fetch fan-in: commands go through thresholds, pure chat skips to Gemini
    .addConditionalEdges('projectFetch', (state: FleetGraphState) => {
      if (state.trigger_type === 'on_demand' && !isCommandQuestion(state.user_question)) {
        return ['geminiReasoner'];
      }
      return ['thresholdEvaluator'];
    })
    .addConditionalEdges('personFetch', (state: FleetGraphState) => {
      if (state.trigger_type === 'on_demand' && !isCommandQuestion(state.user_question)) {
        return ['geminiReasoner'];
      }
      return ['thresholdEvaluator'];
    })
    .addConditionalEdges('programFetch', (state: FleetGraphState) => {
      if (state.trigger_type === 'on_demand' && !isCommandQuestion(state.user_question)) {
        return ['geminiReasoner'];
      }
      return ['thresholdEvaluator'];
    })
    .addConditionalEdges('historyFetch', (_state: FleetGraphState) => {
      return ['geminiReasoner'];
    })
    .addConditionalEdges('retroFetch', (_state: FleetGraphState) => {
      return ['geminiReasoner'];
    })

    // Threshold → Gemini (always runs, per Rule 4)
    .addEdge('thresholdEvaluator', 'geminiReasoner')

    // After Gemini: route to suggestions if violations found
    // Commands in on-demand mode now also generate suggestions
    .addConditionalEdges('geminiReasoner', (state: FleetGraphState) => {
      if (state.trigger_type === 'on_demand' && !isCommandQuestion(state.user_question)) {
        // Pure chat: no suggestions
        return ['notificationSender'];
      }
      if (state.violations.length > 0) {
        return ['suggestionGenerator'];
      }
      return ['notificationSender'];
    })

    .addEdge('suggestionGenerator', 'notificationSender')
    .addEdge('notificationSender', END);

  return graph.compile();
}
