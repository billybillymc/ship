# api/src/openapi/schemas/

Zod schema definitions that register request/response shapes with the OpenAPI registry. Each file corresponds to a resource and defines the schemas that appear in the Swagger documentation.

## Files

- **common.ts** -- Shared schemas (pagination, error responses, date formats).
- **auth.ts** -- Login request/response, session validation schemas.
- **documents.ts** -- Document CRUD request/response schemas.
- **issues.ts** -- Issue-specific schemas (create, update, list with filters).
- **projects.ts** -- Project schemas including ICE scoring fields.
- **programs.ts** -- Program schemas with color, emoji, owner fields.
- **weeks.ts** -- Sprint/week schemas with status and owner fields.
- **weekly-plans.ts** -- Weekly plan and retro document schemas.
- **standups.ts** -- Standup document schemas.
- **team.ts** -- Team grid data schemas.
- **search.ts** -- Search/mention query and result schemas.
- **backlinks.ts** -- Backlink query and result schemas.
- **dashboard.ts** -- Dashboard aggregation schemas.
- **accountability.ts** -- Action item schemas.
- **activity.ts** -- Activity count schemas.
- **ai.ts** -- AI analysis request/response schemas.
- **claude.ts** -- Claude context payload schemas.
- **comments.ts** -- Comment CRUD schemas.
- **files.ts** -- File upload/download schemas.
- **workspaces.ts** -- Workspace management schemas.
- **index.ts** -- Barrel export importing all schema files to trigger registration.
