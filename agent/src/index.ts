/**
 * FleetGraph Agent — entry point.
 * Starts HTTP server + event listener (post-MVP).
 */
import { config } from 'dotenv';
config();

import { createServer } from './server.js';

const PORT = parseInt(process.env.AGENT_PORT ?? '3001', 10);

const app = createServer();

app.listen(PORT, () => {
  console.log(`FleetGraph agent started on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
});
