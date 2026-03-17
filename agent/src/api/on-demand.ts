/**
 * On-demand chat endpoint — SSE streaming for the embedded chat interface.
 * POST /api/agent/on-demand
 * Body: { question: string, context: ViewContext }
 * Response: Server-Sent Events stream
 */
import { Router, type Request, type Response } from 'express';
import type { FleetGraphState, ViewContext } from '../graph/state.js';
import type { GeminiClient } from '../lib/gemini-client.js';
import type { ShipClient } from '../lib/ship-client.js';
import { buildOnDemandPrompt } from '../graph/prompts/on-demand.js';

export interface OnDemandDeps {
  shipClient: ShipClient;
  geminiClient: GeminiClient;
  workspaceId: string;
}

export function createOnDemandRouter(deps: OnDemandDeps): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { question, context } = req.body as {
      question?: string;
      context?: ViewContext;
    };

    if (!question) {
      res.status(400).json({ error: 'question is required' });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      // Fetch data based on context
      let projectData = null;
      let personData = null;

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

      // Build prompt and context string
      const prompt = buildOnDemandPrompt(
        context?.document_type ?? 'workspace',
        context?.title ?? 'Unknown',
      );

      const contextStr = JSON.stringify({
        question,
        project_data: projectData,
        person_data: personData,
      });

      // Stream Gemini response via SSE
      const stream = deps.geminiClient.reasonStreaming(prompt, contextStr);

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ type: 'token', content: chunk })}\n\n`);
      }

      // Send completion event
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('On-demand chat error:', error);

      // If headers already sent (streaming started), send error as SSE event
      res.write(`data: ${JSON.stringify({ type: 'error', content: message })}\n\n`);
      res.end();
    }
  });

  return router;
}
