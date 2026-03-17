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
import { DIRECTOR_OVERVIEW_PROMPT } from '../prompts/director-overview.js';
import { COACH_PROMPT } from '../prompts/coach.js';
import { RETRO_DRAFT_PROMPT } from '../prompts/retro-draft.js';
import { LOAD_BALANCER_PROMPT } from '../prompts/load-balancer.js';
import { PROJECT_KICKOFF_PROMPT } from '../prompts/project-kickoff.js';

export type GeminiMode =
  | 'PROACTIVE_CLEAN'
  | 'PROACTIVE_VIOLATIONS'
  | 'ON_DEMAND'
  | 'DIRECTOR_OVERVIEW'
  | 'COACH'
  | 'RETRO_DRAFT'
  | 'LOAD_BALANCER'
  | 'PROJECT_KICKOFF';

export function createGeminiReasoner(geminiClient: GeminiClient) {
  return async function geminiReasoner(state: FleetGraphState): Promise<Partial<FleetGraphState>> {
    try {
      let prompt: string;
      let mode: GeminiMode;
      let context: string;

      if (state.trigger_type === 'on_demand') {
        const question = state.user_question?.toLowerCase() ?? '';
        const viewCtx = state.current_view_context;

        // Route to specialized modes based on question content
        if (question.includes('coach') || question.includes('pattern') || question.includes('trend')) {
          mode = 'COACH';
          prompt = COACH_PROMPT;
        } else if (question.includes('load') || question.includes('balance') || question.includes('reassign') || question.includes('workload')) {
          mode = 'LOAD_BALANCER';
          prompt = LOAD_BALANCER_PROMPT;
        } else if (question.includes('kickoff') || question.includes('new project') || question.includes('orphan')) {
          mode = 'PROJECT_KICKOFF';
          prompt = PROJECT_KICKOFF_PROMPT;
        } else {
          mode = 'ON_DEMAND';
          prompt = buildOnDemandPrompt(
            viewCtx?.document_type ?? 'workspace',
            viewCtx?.title ?? 'Unknown',
          );
        }

        context = JSON.stringify({
          question: state.user_question,
          project_data: state.project_data,
          person_data: state.person_data,
          program_data: state.program_data,
          history_data: state.history_data,
          retro_data: state.retro_data,
        });
      } else if (state.trigger_type === 'scheduled') {
        // Scheduled runs: if we have program_data, it's a director overview
        if (state.program_data) {
          mode = 'DIRECTOR_OVERVIEW';
          prompt = DIRECTOR_OVERVIEW_PROMPT;
        } else if (state.retro_data) {
          mode = 'RETRO_DRAFT';
          prompt = RETRO_DRAFT_PROMPT;
        } else if (state.violations.length > 0) {
          mode = 'PROACTIVE_VIOLATIONS';
          prompt = PROACTIVE_VIOLATIONS_PROMPT;
        } else {
          mode = 'PROACTIVE_CLEAN';
          prompt = PROACTIVE_CLEAN_PROMPT;
        }

        context = JSON.stringify({
          violations: state.violations,
          project_data: state.project_data,
          person_data: state.person_data,
          program_data: state.program_data,
          retro_data: state.retro_data,
        });
      } else {
        // Event-driven proactive
        if (state.violations.length > 0) {
          mode = 'PROACTIVE_VIOLATIONS';
          prompt = PROACTIVE_VIOLATIONS_PROMPT;
        } else {
          mode = 'PROACTIVE_CLEAN';
          prompt = PROACTIVE_CLEAN_PROMPT;
        }

        context = JSON.stringify({
          violations: state.violations,
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
