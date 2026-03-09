# api/

Express backend server providing the REST API, WebSocket collaboration server, and database layer.

## Files

- **package.json** -- Package config declaring dependencies (Express, pg, Yjs, zod, etc.) and scripts (`dev`, `build`, `start`).
- **tsconfig.json** -- TypeScript configuration for the API package.
- **vitest.config.ts** -- Vitest test runner configuration for API unit tests.
- **openapi.json** / **openapi.yaml** -- Auto-generated OpenAPI 3.0 specification files describing all API endpoints.

## Directories

- **src/** -- All application source code.
- **scripts/** -- CLI utility scripts for database and user management.
- **.ebextensions/** -- AWS Elastic Beanstalk environment configuration.
- **.platform/nginx/** -- Nginx configuration for the EB platform (WebSocket proxy).
