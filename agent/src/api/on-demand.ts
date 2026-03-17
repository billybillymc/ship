/**
 * On-demand chat endpoint — SSE streaming for the embedded chat interface.
 * POST /api/agent/on-demand
 * Body: { question: string, context: ViewContext }
 * Response: Server-Sent Events stream
 *
 * Command questions (health check, briefing, stale scan) run the full
 * graph including thresholds and suggestion generation.
 * Regular questions stream Gemini directly.
 */
import { Router, type Request, type Response } from 'express';
import type { FleetGraphState, ViewContext } from '../graph/state.js';
import type { GeminiClient } from '../lib/gemini-client.js';
import type { ShipClient } from '../lib/ship-client.js';
import { buildOnDemandPrompt } from '../graph/prompts/on-demand.js';
import { buildFleetGraph } from '../graph/graph.js';
import { v4 as uuidv4 } from 'uuid';

export interface OnDemandDeps {
  shipClient: ShipClient;
  geminiClient: GeminiClient;
  workspaceId: string;
}

const COMMAND_PATTERN = /health\s*check|run.*check|scan.*project|scan.*program|check.*threshold|morning\s*briefing|daily\s*briefing|give.*briefing|stale\s*issue|check.*stale|find.*stale|overdue|scan\s*all|portfolio.*scan|risk.*scan/i;

export function createOnDemandRouter(deps: OnDemandDeps): Router {
  const router = Router();
  const graph = buildFleetGraph(deps);

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { question, context } = req.body as {
      question?: string;
      context?: ViewContext;
    };

    if (!question) {
      res.status(400).json({ error: 'question is required' });
      return;
    }

    // Guardrail: reject off-topic questions
    const lowerQ = question.toLowerCase();
    const offTopicPatterns = [
      /write.*code|write.*script|write.*program/,
      /ignore.*instructions|ignore.*prompt|ignore.*system/,
      /pretend.*you.*are|act.*as.*if|role.*play/,
      /recipe|weather|joke|poem|story|lyrics|translate/,
      /how.*to.*hack|exploit|vulnerability|injection/,
    ];
    if (offTopicPatterns.some(p => p.test(lowerQ))) {
      res.status(400).json({
        error: 'FleetGraph can only answer questions about your projects, issues, team workload, and workspace. Please ask something related to your work in Ship.',
      });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const isCommand = COMMAND_PATTERN.test(question);

    try {
      if (isCommand) {
        // Command mode: run full graph (thresholds + suggestions)
        const runId = uuidv4();
        const result = await graph.invoke({
          trigger_type: 'on_demand',
          trigger_payload: {
            user_question: question,
            view_context: context ?? { document_type: 'workspace', document_id: '' },
          },
          target_user_id: '',
          run_id: runId,
        }) as FleetGraphState;

        // Stream the Gemini analysis
        if (result.gemini_output?.content) {
          res.write(`data: ${JSON.stringify({ type: 'token', content: result.gemini_output.content })}\n\n`);
        }

        // Stream violations as structured data
        if (result.violations?.length > 0) {
          res.write(`data: ${JSON.stringify({
            type: 'violations',
            count: result.violations.length,
            violations: result.violations.map(v => ({
              type: v.type,
              entity_name: v.entity_name,
              severity: v.severity,
              details: v.details,
            })),
          })}\n\n`);
        }

        // Stream suggestions as actionable cards
        if (result.suggestions?.length > 0) {
          res.write(`data: ${JSON.stringify({
            type: 'suggestions',
            count: result.suggestions.length,
            suggestions: result.suggestions.map(s => ({
              action_type: s.action_type,
              severity_score: s.severity_score,
              suggestion: s.suggestion,
            })),
          })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ type: 'done', mode: result.gemini_output?.mode ?? 'unknown' })}\n\n`);
        res.end();
      } else {
        // Chat mode: stream Gemini directly
        let projectData = null;
        if (context?.document_type === 'project' && context.document_id) {
          try {
            const [project, issues] = await Promise.all([
              deps.shipClient.getProject(context.document_id),
              deps.shipClient.getProjectIssues(context.document_id),
            ]);
            projectData = { project, issues };
          } catch (error) {
            console.error('Failed to fetch project data for on-demand:', error);
          }
        }

        const prompt = buildOnDemandPrompt(
          context?.document_type ?? 'workspace',
          context?.title ?? 'Unknown',
        );
        const contextStr = JSON.stringify({
          question,
          project_data: projectData,
          person_data: null,
        });

        const stream = deps.geminiClient.reasonStreaming(prompt, contextStr);
        for await (const chunk of stream) {
          res.write(`data: ${JSON.stringify({ type: 'token', content: chunk })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('On-demand chat error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', content: message })}\n\n`);
      res.end();
    }
  });

  return router;
}
