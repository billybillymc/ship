import { createServer } from 'http';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables (.env.local takes precedence)
config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../.env') });

// Global error handlers — prevent silent crashes and unlogged failures
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
  // Don't exit — log and continue. Most unhandled rejections are non-critical
  // (e.g., failed background persist, closed WebSocket writes).
});

process.on('uncaughtException', (error: Error) => {
  console.error('[FATAL] Uncaught exception:', error);
  // Uncaught exceptions leave the process in an undefined state.
  // Log, then exit gracefully so the process manager can restart.
  process.exit(1);
});

async function main() {
  // Load secrets from SSM in production (before importing app)
  if (process.env.NODE_ENV === 'production') {
    const { loadProductionSecrets } = await import('./config/ssm.js');
    await loadProductionSecrets();
  }

  // Now import app after secrets are loaded
  const { createApp } = await import('./app.js');
  const { setupCollaboration } = await import('./collaboration/index.js');

  const PORT = process.env.PORT || 3000;
  const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

  const app = createApp(CORS_ORIGIN);
  const server = createServer(app);

  // DDoS protection: Set server-wide timeouts to prevent slow-read attacks (Slowloris)
  server.timeout = 60000; // 60 seconds max request duration
  server.keepAliveTimeout = 65000; // 65 seconds (slightly longer than timeout)
  server.headersTimeout = 66000; // 66 seconds (slightly longer than keepAlive)

  // Serve static frontend if web/dist exists (Railway single-service deployment)
  const webDistPath = join(__dirname, '../../web/dist');
  if (existsSync(webDistPath)) {
    const express = await import('express');
    // Serve static assets
    app.use(express.default.static(webDistPath));
    // SPA fallback: serve index.html for all non-API routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/collaboration') || req.path.startsWith('/events') || req.path === '/health') {
        return next();
      }
      res.sendFile(join(webDistPath, 'index.html'));
    });
    console.log(`Serving static frontend from ${webDistPath}`);
  }

  // Setup WebSocket collaboration server
  setupCollaboration(server);

  // Start server
  server.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
    console.log(`CORS origin: ${CORS_ORIGIN}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
