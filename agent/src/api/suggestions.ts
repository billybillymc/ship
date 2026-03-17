/**
 * Agent suggestions API routes — stub for Step 8.
 * Will be fully implemented with CRUD for agent_actions.
 */
import { Router } from 'express';

export function createSuggestionsRouter(): Router {
  const router = Router();

  // GET /api/agent/suggestions?status=pending
  router.get('/', (_req, res) => {
    res.json({ data: [], message: 'Suggestions endpoint — not yet implemented' });
  });

  // PATCH /api/agent/suggestions/:id
  router.patch('/:id', (_req, res) => {
    res.json({ message: 'Suggestion update — not yet implemented' });
  });

  return router;
}
