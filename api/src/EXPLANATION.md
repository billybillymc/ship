# api/src/

Main source directory for the Express backend.

## Files

- **app.ts** -- Creates and configures the Express application with security middleware (Helmet, CORS, CSRF, rate limiting, sessions) and mounts all API route handlers.
- **index.ts** -- Entry point that loads environment variables and production secrets, creates the HTTP server, attaches the WebSocket collaboration server, and starts listening.
- **swagger.ts** -- Sets up Swagger UI at `/api/docs` and serves the OpenAPI spec in JSON/YAML formats generated from Zod schemas.

## Directories

- **routes/** -- REST API endpoint handlers organized by resource.
- **services/** -- Business logic services (AI analysis, audit, OAuth, etc.).
- **db/** -- Database client, migrations, schema, and seed data.
- **collaboration/** -- Yjs CRDT-based real-time collaboration server over WebSocket.
- **middleware/** -- Express middleware for authentication and document visibility.
- **openapi/** -- OpenAPI schema registration and document generation.
- **mcp/** -- Model Context Protocol server for LLM tool integration.
- **utils/** -- Shared utility functions (date calculations, document helpers, Yjs conversion).
- **config/** -- Configuration loaders (AWS SSM Parameter Store).
- **types/** -- TypeScript type declarations.
- **scripts/** -- Code generation scripts (OpenAPI spec output).
- **test/** -- Test setup and configuration.
- **__tests__/** -- Top-level unit tests.
