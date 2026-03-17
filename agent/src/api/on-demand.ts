/**
 * On-demand chat endpoint — stub for Step 10.
 * Will implement SSE streaming for the embedded chat interface.
 */
import { Router } from 'express';

export function createOnDemandRouter(): Router {
  const router = Router();

  // POST /api/agent/on-demand
  router.post('/', (_req, res) => {
    res.json({ message: 'On-demand chat — not yet implemented' });
  });

  return router;
}
