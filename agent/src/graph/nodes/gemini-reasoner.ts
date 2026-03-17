/**
 * Gemini Reasoner node — always runs on every graph execution.
 * Clean runs get a health summary, problem runs get deep analysis,
 * on-demand runs answer the user's question.
 *
 * Per Rule 4: Gemini Reasoner always runs.
 * Per Rule 5: catches its own errors and writes to state.errors.
 */
import type { FleetGraphState, GeminiReasonerOutput, GraphError } from '../state.js';
import type { GeminiClient } from '../../lib/gemini-client.js';
import { PROACTIVE_CLEAN_PROMPT } from '../prompts/proactive-clean.js';
import { PROACTIVE_VIOLATIONS_PROMPT } from '../prompts/proactive-violations.js';
import { buildOnDemandPrompt } from '../prompts/on-demand.js';

export function createGeminiReasoner(geminiClient: GeminiClient) {
  return async function geminiReasoner(state: FleetGraphState): Promise<Partial<FleetGraphState>> {
    try {
      let prompt: string;
      let mode: GeminiReasonerOutput['mode'];
      let context: string;

      if (state.trigger_type === 'on_demand') {
        mode = 'ON_DEMAND';
        const viewCtx = state.current_view_context;
        prompt = buildOnDemandPrompt(
          viewCtx?.document_type ?? 'workspace',
          viewCtx?.title ?? 'Unknown',
        );
        context = JSON.stringify({
          question: state.user_question,
          project_data: state.project_data,
          person_data: state.person_data,
        });
      } else if (state.violations.length > 0) {
        mode = 'PROACTIVE_VIOLATIONS';
        prompt = PROACTIVE_VIOLATIONS_PROMPT;
        context = JSON.stringify({
          violations: state.violations,
          project_data: state.project_data,
          person_data: state.person_data,
        });
      } else {
        mode = 'PROACTIVE_CLEAN';
        prompt = PROACTIVE_CLEAN_PROMPT;
        context = JSON.stringify({
          project_data: state.project_data,
          person_data: state.person_data,
        });
      }

      const content = await geminiClient.reason(prompt, context);

      return {
        gemini_output: { mode, content },
      };
    } catch (error) {
      const graphError: GraphError = {
        node: 'geminiReasoner',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      // Fallback: produce a structured summary without Gemini
      const fallbackContent = state.violations.length > 0
        ? state.violations.map(v =>
            `[${v.type}] ${v.entity_name}: severity ${v.severity} — ${JSON.stringify(v.details)}`
          ).join('\n')
        : 'Health check completed. No violations detected.';

      return {
        errors: [graphError],
        gemini_output: {
          mode: state.violations.length > 0 ? 'PROACTIVE_VIOLATIONS' : 'PROACTIVE_CLEAN',
          content: fallbackContent,
        },
      };
    }
  };
}
