/**
 * Express server for agent-specific routes.
 * The agent runs on its own port, separate from the Ship API.
 */
import express, { type Express } from 'express';
import cors from 'cors';
import { createOnDemandRouter, type OnDemandDeps } from './api/on-demand.js';

export interface ServerDeps {
  onDemand?: OnDemandDeps;
}

export function createServer(deps: ServerDeps = {}): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'fleetgraph-agent' });
  });

  // On-demand chat (SSE streaming)
  if (deps.onDemand) {
    app.use('/api/agent/on-demand', createOnDemandRouter(deps.onDemand));
  }

  return app;
}
