/**
 * Express server for agent-specific routes.
 * The agent runs on its own port, separate from the Ship API.
 */
import express, { type Express } from 'express';
import cors from 'cors';

export function createServer(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'fleetgraph-agent' });
  });

  // Agent routes will be mounted here in later steps:
  // - POST /api/agent/on-demand (SSE streaming chat)
  // - GET  /api/agent/suggestions
  // - PATCH /api/agent/suggestions/:id

  return app;
}
