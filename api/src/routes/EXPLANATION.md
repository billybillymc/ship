# api/src/routes/

REST API endpoint handlers. Each file exports an Express router for a specific resource. Test files (`*.test.ts`) are co-located with their route handlers.

## Route Files

- **auth.ts** -- Email/password login, session creation/validation, logout. Sessions use secure random IDs with 15-minute idle timeout.
- **caia-auth.ts** -- Treasury CAIA OAuth/OIDC flow for PIV smartcard authentication using email as the primary identifier.
- **documents.ts** -- Core CRUD for the unified document model (create, read, update, delete any document type) with visibility checks and Yjs cache invalidation.
- **issues.ts** -- CRUD for issue documents with ticket numbering, state transitions, priority, assignee, and belongs-to associations.
- **projects.ts** -- CRUD for project documents with ICE scoring (impact/confidence/ease), inferred status, and field change history.
- **programs.ts** -- CRUD for program documents with color, emoji, owner, and aggregated child counts.
- **weeks.ts** -- CRUD for sprint/week documents with owner lookup, supervisor visibility, and issue link transformation.
- **associations.ts** -- Manages document-to-document associations (parent, project, sprint, program) via the junction table.
- **standups.ts** -- Creates standalone standup documents for a user on a given date (idempotent).
- **weekly-plans.ts** -- Creates and retrieves weekly plan and retro documents per person per sprint with pre-populated templates.
- **comments.ts** -- Document-scoped threaded comments with nested reply support.
- **search.ts** -- Mention search across people and documents with visibility filtering.
- **backlinks.ts** -- Retrieves documents that reference a given document (cross-document links).
- **dashboard.ts** -- Aggregated prioritized dashboard of work items with urgency levels and ICE scores.
- **accountability.ts** -- Computes action items (missing standups, overdue plans, empty sprints) dynamically.
- **activity.ts** -- Returns 30-day activity counts for programs, projects, or sprints.
- **team.ts** -- Team grid data with sprint allocations across a configurable range.
- **feedback.ts** -- Public and authenticated routes for user feedback submissions.
- **files.ts** -- File upload/download with local filesystem (dev) or S3 presigned URLs (prod).
- **invites.ts** -- Workspace invite validation, acceptance, and account creation.
- **iterations.ts** -- Sprint iteration tracking (pass/fail/in_progress) for experiments.
- **ai.ts** -- AI-powered analysis of weekly plans and retros via AWS Bedrock.
- **claude.ts** -- Rich context payloads for Claude AI skills (standups, reviews, retros).
- **admin.ts** -- Super-admin routes for managing workspaces across the platform.
- **admin-credentials.ts** -- Super-admin routes for configuring CAIA OAuth credentials.
- **api-tokens.ts** -- CRUD for personal API tokens with SHA-256 hashing.
- **setup.ts** -- Initial app setup: creates first admin user, workspace, and welcome document.
- **health.test.ts** -- Unit test for the `GET /health` endpoint.

## Test Files

- **auth.test.ts**, **documents.test.ts**, **issues.test.ts**, **projects.test.ts**, **weeks.test.ts**, etc. -- Unit tests for corresponding route handlers.
- **associations-regression.test.ts**, **circular-reference.test.ts** -- Regression tests for edge cases.
- **documents-visibility.test.ts** -- Tests for document visibility filtering.
