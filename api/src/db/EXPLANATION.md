# api/src/db/

Database layer: connection pool, schema, migrations, and seed data.

## Files

- **client.ts** -- Creates and exports a `pg` Pool with production-tuned settings (connection limits, timeouts, statement timeout, connection recycling) and graceful shutdown handlers.
- **schema.sql** -- Initial database schema defining all tables (workspaces, users, documents, document_associations, audit_logs, etc.) for the unified document model.
- **migrate.ts** -- Migration runner that applies `schema.sql` for initial setup, then executes numbered SQL migration files sequentially within transactions, tracking versions in `schema_migrations`.
- **seed.ts** -- Seeds the database with comprehensive development data (users, workspaces, programs, projects, sprints, issues, documents, and associations).
- **welcomeDocument.ts** -- Exports the title and TipTap JSON content for the onboarding tutorial document shown to new users.

## Directories

- **migrations/** -- Numbered SQL migration files applied in order.
- **scripts/** -- Diagnostic and remediation scripts for data issues.
