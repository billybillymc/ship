*** Re-run tests -> 1 worker, more causing collisions

Category 1: Type Safety 
What you are measuring: The strength of TypeScript’s type system as used in this codebase. This includes explicit any types, type assertions (as), non-null assertions (!), @ts-ignore and @ts-expect-error directives, untyped function parameters, and implicit any from missing return types. 

How to Measure 
[x] Run grep or a static analysis tool to count all type safety violations across the codebase 
    -> using eslint
[x] Check the tsconfig.json for strict mode settings. If strict mode is off, run tsc --strict --noEmit and count the errors 
[x] Break down violations by package (web/, api/, shared/) and by violation type 
[x] Identify the 5 most violation-dense files and explain why they are problematic 

Audit Deliverable
[x] Total any types -> 280 explicit & 7,458 unsafe any usages (eslint)
[x] Total type assertions (as) -> 1,181 (grep)
[x] Total non-null assertions (!) -> 348 (eslint)
[x] Total @ts-ignore / @ts-expect-error -> 0
[x] Strict mode enabled? -> Yes
[x] Strict mode error count (if disabled) -> n/a
[x] Top 5 violation-dense files -> (eslint)
    639 api/src/routes/weeks.ts
    443 api/src/routes/projects.ts
    440 api/src/routes/team.ts
    374 api/src/routes/documents.ts
    340 api/src/routes/issues.ts

Improvement Target 
Eliminate 25% of type safety violations. Every fix must preserve existing functionality (all tests still pass). Superficial fixes do not count. Replacing any with unknown without proper type narrowing is not an improvement. Each fix must include correct, meaningful types that reflect the actual data. 


Category 2: Bundle Size 
What you are measuring: The size of the production frontend bundle. Large bundles slow down initial page load, hurt performance on slow networks, and waste bandwidth. You are looking for oversized dependencies, missing code splitting, unused imports, and opportunities to reduce what the browser has to download.

How to Measure 
[x] Build the production frontend and record the total output size 
[x] Use a bundle visualization tool (e.g., rollup-plugin-visualizer, vite-bundle-analyzer, or source-map-explorer) to generate a treemap of the bundle 
    vite-bundle-visualizer -> bundle-stats.html
[x] Identify the largest chunks and the largest individual dependencies within them 
[x] Check for unused dependencies: cross-reference package.json dependencies against actual imports in the source code 
[x] Evaluate whether code splitting is in use and where lazy loading could reduce initial load 

Audit Deliverable 
[x] Total production bundle size -> 2,139 KB (589 KB zipped) + 65 KB CSS (4.4 MB across HTML, icons, etc.)
[x] Largest chunk -> index-C2vAyoQ1.js -> 2,074 KB
[x] Number of chunks -> 261
[x] Top 3 largest dependencies -> List with sizes 
    emoji-picker-react - 398 KB
    highlight.js - 376 KB
    react-router - 347 KB
[x] Unused dependencies identified -> List
    @tanstack/query-sync-storage-persister — in package.json but not imported
    @uswds/uswds — the full USWDS package (25 MB on disk) is listed as a dependency but not directly imported (icons are loaded individually via lazy chunks)

Improvement Target 
15% reduction in total production bundle size, or implement code splitting that reduces initial page load bundle by 20%. Provide before/after bundle analysis output. Removing functionality to shrink the bundle does not count. 


Category 3: API Response Time 
What you are measuring: How fast the backend responds under realistic conditions. This is not about testing with an empty database. Seed the database with meaningful volume, then measure. 

How to Measure 
[x] Seed the database with realistic data: 500+ documents, 100+ issues, 20+ users, 10+ sprints. Use pnpm db:seed or write your own seed script 
[x] Identify the 5 most important API endpoints by tracing the frontend’s network requests during common user flows 
[x] Benchmark each endpoint using a load testing tool (autocannon, k6, hey, or similar). Record P50, P95, and P99 response times 
[x] Test under concurrent load: 10, 25, and 50 simultaneous connections 
[x] Identify the slowest endpoints and hypothesize why they are slow 

Audit Deliverable
Load testing tool: hey (v0.0.1, Go-based HTTP load generator) — 500 requests per endpoint at 10, 25, and 50 concurrent connections.

Endpoints - P50 - P95 - P99
    Slowest ->
  1. GET /api/documents — P50=247ms, P95=310ms, P99=599ms
  2. GET /api/issues — P50=149ms, P95=193ms, P99=356ms
  3. GET /api/dashboard/my-week — P50=96ms, P95=118ms, P99=193ms
  4. GET /api/documents/:id/context — P50=51ms, P95=65ms, P99=90ms
  5. GET /api/auth/me — P50=44ms, P95=71ms, P99=112ms
  -> all are at benchmark-results.csv

    Most Important ->
  ┌─────┬────────────────────────────────┬───────────────────────────────────────────────┬────────────┬────────────┬────────────┬───────┐
  │  #  │            Endpoint            │                   User Flow                   │ P50 (c=50) │ P95 (c=50) │ P99 (c=50) │ Req/s │
  ├─────┼────────────────────────────────┼───────────────────────────────────────────────┼────────────┼────────────┼────────────┼───────┤
  │ 1   │ GET /api/auth/me               │ Every page load (session check)               │ 44ms       │ 71ms       │ 112ms      │ 1,095 │
  ├─────┼────────────────────────────────┼───────────────────────────────────────────────┼────────────┼────────────┼────────────┼───────┤
  │ 2   │ GET /api/documents             │ Page load, navigation, sidebar population     │ 247ms      │ 310ms      │ 599ms      │ 193   │
  ├─────┼────────────────────────────────┼───────────────────────────────────────────────┼────────────┼────────────┼────────────┼───────┤
  │ 3   │ GET /api/documents/:id/context │ Viewing any document (breadcrumbs, hierarchy) │ 51ms       │ 65ms       │ 90ms       │ 944   │
  ├─────┼────────────────────────────────┼───────────────────────────────────────────────┼────────────┼────────────┼────────────┼───────┤
  │ 4   │ GET /api/issues                │ Issue board view, project planning            │ 149ms      │ 193ms      │ 356ms      │ 318   │
  ├─────┼────────────────────────────────┼───────────────────────────────────────────────┼────────────┼────────────┼────────────┼───────┤
  │ 5   │ GET /api/dashboard/my-week     │ Personal dashboard load, week switching       │ 96ms       │ 118ms      │ 193ms      │ 502   │
  └─────┴────────────────────────────────┴───────────────────────────────────────────────┴────────────┴────────────┴────────────┴───────┘

Improvement Target
20% reduction in P95 response time on at least 2 endpoints. You must provide before/after benchmarks run under identical conditions (same data volume, same concurrency, same hardware). Document the root cause of each bottleneck. 


Category 4: Database Query Efficiency 
What you are measuring: How efficiently the application queries the database. The unified document model (everything in one table) creates specific query patterns worth examining. You are looking for N+1 queries, missing indexes, full table scans, and unnecessary data fetching. 

How to Measure 
[x] Enable PostgreSQL query logging (log_statement = 'all' in postgresql.conf or via Docker environment variables) 
[x] Execute 5 common user flows: load the main page, view a document, list issues, load a sprint board, search for content 
[x] Count total queries executed per flow 
[x] Run EXPLAIN ANALYZE on the slowest queries 
[x] Check for missing indexes by examining WHERE clauses against existing indexes 
[x] Identify N+1 patterns: places where a list view triggers one query per item instead of a batch query

Audit Deliverable

Deliverable 1: Enable PostgreSQL Query Logging

  Status: DONE

  ALTER SYSTEM SET log_statement = 'all';
  ALTER SYSTEM SET log_duration = 'on';
  SELECT pg_reload_conf();

  Verified active on the running Docker container:

  SHOW log_statement;  → all
  SHOW log_duration;   → on

  Logs captured via docker logs ship2-postgres-1 with sentinel queries (SELECT '---START_FLOWNAME---') inserted between each flow to delineate boundaries.

  ---
  Deliverable 2: Execute 5 Common User Flows

  Status: DONE

  Authentication: API token (Bearer ship_test_token_for_audit_12345678) inserted directly into api_tokens table to bypass CSRF. Logs captured from PostgreSQL stderr via Docker.

  ┌───────────────────┬─────────────────────────────────────────────────────────────────────────────────────┬───────────────────────┐
  │       Flow        │                                   Endpoint(s) Hit                                   │     curl Command      │
  ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ Load main page    │ GET /api/dashboard/my-work, GET /api/dashboard/my-focus, GET /api/dashboard/my-week │ 3 sequential requests │
  ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ View a document   │ GET /api/documents/37e9554f-a3b4-4c7c-9319-2653dfe6c112 (issue)                     │ 1 request             │
  ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ List issues       │ GET /api/issues                                                                     │ 1 request             │
  ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ Load sprint board │ GET /api/dashboard/my-week                                                          │ 1 request             │
  ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ Search content    │ GET /api/documents (command palette) + GET /api/search/mentions?q=auth              │ 2 requests            │
  └───────────────────┴─────────────────────────────────────────────────────────────────────────────────────┴───────────────────────┘

  Dataset: 257 documents (104 issues, 35 sprints, 32 weekly_plans, 27 weekly_retros, 15 projects, 11 persons, 7 wikis, 6 standups, 5 programs, 15 weekly_reviews). Single workspace, 11 users.

  ---
  Deliverable 3: Count Total Queries Executed Per Flow

  Status: DONE

  Counted from execute <unnamed>: lines in PostgreSQL logs between sentinel boundaries. Each execute = one actual SQL query. Parse/bind duration entries are overhead logged separately by PG's extended query
  protocol.

  Load Main Page (3 endpoints combined)

  GET /api/dashboard/my-work — 7 queries

  ┌─────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬────────┐
  │  #  │                                                                                           Query                                                                                           │ Exec   │
  │     │                                                                                                                                                                                           │  (ms)  │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ 1   │ SELECT t.id, t.user_id... FROM api_tokens t JOIN users u WHERE t.token_hash = $1                                                                                                          │ 0.079  │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ 2   │ UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1                                                                                                                                  │ 0.221  │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ 3   │ SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2                                                                                                           │ 0.092  │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ 4   │ SELECT sprint_start_date FROM workspaces WHERE id = $1                                                                                                                                    │ 0.033  │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │     │ SELECT d.id, d.title, d.properties, d.ticket_number... FROM documents d LEFT JOIN document_associations sprint_assoc... LEFT JOIN documents sprint... LEFT JOIN document_associations     │        │
  │ 5   │ prog_da... LEFT JOIN documents p... WHERE d.workspace_id = $1 AND d.document_type = 'issue' AND (d.properties->>'assignee_id')::uuid = $2 AND d.properties->>'state' NOT IN               │ 0.510  │
  │     │ ('done','cancelled')...                                                                                                                                                                   │        │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │     │ SELECT d.id, d.title, d.properties, p.title as program_name, CASE WHEN d.archived_at IS NOT NULL THEN 'archived' ELSE COALESCE((SELECT CASE MAX(...) ... FROM documents issue JOIN        │        │
  │ 6   │ document_associations sprint_assoc... JOIN documents sprint... JOIN document_associations proj_assoc... JOIN workspaces w...), 'backlog') END as inferred_status FROM documents d LEFT    │ 0.198  │
  │     │ JOIN document_associations prog_da... LEFT JOIN documents p... WHERE d.document_type = 'project' AND (d.properties->>'owner_id')::uuid = $2...                                            │        │
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ 7   │ SELECT d.id, d.title, d.properties, p.title as program_name, (d.properties->>'sprint_number')::int FROM documents d JOIN document_associations prog_da... JOIN documents p... WHERE       │ 0.798  │
  │     │ d.document_type = 'sprint' AND (d.properties->>'owner_id')::uuid = $2 AND (d.properties->>'sprint_number')::int = $3...                                                                   │        │
  └─────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴────────┘

  GET /api/dashboard/my-focus — 7 queries

  ┌─────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬─────────┐
  │  #  │                                                                                          Query                                                                                           │  Exec   │
  │     │                                                                                                                                                                                          │  (ms)   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 1   │ Auth: token lookup                                                                                                                                                                       │ 0.064   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 2   │ Auth: token update                                                                                                                                                                       │ 0.097   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 3   │ SELECT id, title FROM documents WHERE workspace_id = $1 AND document_type = 'person' AND (properties->>'user_id') = $2 LIMIT 1                                                           │ 0.031   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 4   │ SELECT sprint_start_date FROM workspaces WHERE id = $1                                                                                                                                   │ 0.020   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 5   │ SELECT DISTINCT proj.id, proj.title, prog.title FROM documents s JOIN documents proj ON (s.properties->>'project_id')::uuid = proj.id... WHERE s.document_type = 'sprint' AND            │ 0.154   │
  │     │ s.properties->'assignee_ids' ? $2 AND (s.properties->>'sprint_number')::int = $3...                                                                                                      │         │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 6   │ SELECT id, content, properties FROM documents WHERE document_type = 'weekly_plan' AND (properties->>'person_id') = $2 AND (properties->>'project_id') = ANY($3) AND                      │ 0.121   │
  │     │ (properties->>'week_number')::int IN ($4, $5)...                                                                                                                                         │         │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 7   │ SELECT d.id, d.title, d.ticket_number, COALESCE(d.properties->>'state','backlog'), d.updated_at, proj_assoc.related_id FROM documents d JOIN document_associations proj_assoc... WHERE   │ 0.358   │
  │     │ d.document_type = 'issue' AND proj_assoc.related_id = ANY($2) AND d.updated_at >= NOW() - INTERVAL '7 days'                                                                              │         │
  └─────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴─────────┘

  GET /api/dashboard/my-week — 9 queries

  ┌─────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬──────────┐
  │  #  │                                                                                          Query                                                                                          │  Exec    │
  │     │                                                                                                                                                                                         │   (ms)   │
  ├─────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 1   │ Auth: token lookup                                                                                                                                                                      │ 0.068    │
  ├─────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 2   │ Auth: token update                                                                                                                                                                      │ 0.121    │
  ├─────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 3   │ SELECT id, title FROM documents WHERE document_type = 'person' AND (properties->>'user_id') = $2 LIMIT 1                                                                                │ 0.054    │
  ├─────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 4   │ SELECT sprint_start_date FROM workspaces WHERE id = $1                                                                                                                                  │ 0.023    │
  ├─────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 5   │ SELECT id, title, content, properties... FROM documents WHERE document_type = 'weekly_plan' AND (properties->>'person_id') = $2 AND (properties->>'week_number')::int = $3... LIMIT 1   │ 0.096    │
  ├─────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 6   │ SELECT id, title, content, properties... FROM documents WHERE document_type = 'weekly_retro' AND (properties->>'person_id') = $2 AND (properties->>'week_number')::int = $3... LIMIT 1  │ 0.075    │
  ├─────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 7   │ SELECT id, title, properties FROM documents WHERE document_type = 'weekly_retro' AND (properties->>'person_id') = $2 AND (properties->>'week_number')::int = $3... (previous retro)     │ 0.033    │
  ├─────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 8   │ SELECT id, title, properties, created_at, updated_at FROM documents WHERE document_type = 'standup' AND (properties->>'author_id') = $2 AND (properties->>'date') = ANY($3)...          │ 0.041    │
  ├─────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┤
  │ 9   │ SELECT DISTINCT proj.id, proj.title, prog.title FROM documents s JOIN documents proj... WHERE s.document_type = 'sprint' AND s.properties->'assignee_ids' ? $2 AND                      │ 0.167    │
  │     │ (s.properties->>'sprint_number')::int = $3...                                                                                                                                           │          │
  └─────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────┘

  View a Document

  GET /api/documents/:id — 4 queries

  ┌─────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬─────────┐
  │  #  │                                                                                          Query                                                                                           │  Exec   │
  │     │                                                                                                                                                                                          │  (ms)   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 1   │ Auth: token lookup                                                                                                                                                                       │ 0.050   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 2   │ Auth: token update                                                                                                                                                                       │ 0.073   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 3   │ SELECT d.*, (d.visibility = 'workspace' OR d.created_by = $2 OR (SELECT role FROM workspace_memberships WHERE workspace_id = $3 AND user_id = $2) = 'admin') as can_access FROM          │ 0.044   │
  │     │ documents d WHERE d.id = $1 AND d.workspace_id = $3 AND d.deleted_at IS NULL                                                                                                             │         │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 4   │ SELECT da.related_id as id, da.relationship_type as type, d.title, d.properties->>'color' as color FROM document_associations da LEFT JOIN documents d ON da.related_id = d.id WHERE     │ 0.045   │
  │     │ da.document_id = $1 ORDER BY da.relationship_type, da.created_at                                                                                                                         │         │
  └─────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴─────────┘

  Note: This was an issue document. Project documents add 1 more query (owner lookup). Sprint documents add 1 more. Weekly plan/retro adds 1 more (person name).

  List Issues

  GET /api/issues — 5 queries

  #: 1
  Query: Auth: token lookup
  Exec (ms): 0.052
  ────────────────────────────────────────
  #: 2
  Query: Auth: token update
  Exec (ms): 0.072
  ────────────────────────────────────────
  #: 3
  Query: SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 (isWorkspaceAdmin)
  Exec (ms): 0.032
  ────────────────────────────────────────
  #: 4
  Query: SELECT d.id, d.title, d.properties, d.ticket_number, d.content, d.created_at, d.updated_at, d.created_by, d.started_at, d.completed_at, d.cancelled_at, d.reopened_at, d.converted_from_id, u.name as
    assignee_name, CASE WHEN person_doc.archived_at IS NOT NULL THEN true ELSE false END as assignee_archived FROM documents d LEFT JOIN users u ON (d.properties->>'assignee_id')::uuid = u.id LEFT JOIN
    documents person_doc ON person_doc.workspace_id = d.workspace_id AND person_doc.document_type = 'person' AND person_doc.properties->>'user_id' = d.properties->>'assignee_id' WHERE d.workspace_id = $1 AND
    d.document_type = 'issue' AND (d.visibility = 'workspace' OR d.created_by = $2 OR $3 = TRUE) AND d.archived_at IS NULL AND d.deleted_at IS NULL ORDER BY CASE d.properties->>'priority' WHEN 'urgent' THEN
    1... END, d.updated_at DESC
  Exec (ms): 0.822
  ────────────────────────────────────────
  #: 5
  Query: SELECT da.document_id, da.related_id as id, da.relationship_type as type, d.title, d.properties->>'color' as color FROM document_associations da LEFT JOIN documents d ON da.related_id = d.id WHERE
    da.document_id = ANY($1) ORDER BY da.document_id, da.relationship_type, da.created_at
  Exec (ms): 0.782

  Load Sprint Board

  GET /api/dashboard/my-week — 9 queries (same as Flow 1c above)

  ┌─────┬─────────────────────────┬───────────┐
  │  #  │          Query          │ Exec (ms) │
  ├─────┼─────────────────────────┼───────────┤
  │ 1   │ Auth: token lookup      │ 0.068     │
  ├─────┼─────────────────────────┼───────────┤
  │ 2   │ Auth: token update      │ 0.121     │
  ├─────┼─────────────────────────┼───────────┤
  │ 3   │ Person doc lookup       │ 0.054     │
  ├─────┼─────────────────────────┼───────────┤
  │ 4   │ Workspace sprint config │ 0.023     │
  ├─────┼─────────────────────────┼───────────┤
  │ 5   │ Plan document           │ 0.096     │
  ├─────┼─────────────────────────┼───────────┤
  │ 6   │ Retro document          │ 0.075     │
  ├─────┼─────────────────────────┼───────────┤
  │ 7   │ Previous retro          │ 0.033     │
  ├─────┼─────────────────────────┼───────────┤
  │ 8   │ Standups (7 days)       │ 0.041     │
  ├─────┼─────────────────────────┼───────────┤
  │ 9   │ Project allocations     │ 0.167     │
  └─────┴─────────────────────────┴───────────┘

  Search Content

  GET /api/documents (command palette) — 4 queries

  ┌─────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬─────────┐
  │  #  │                                                                                          Query                                                                                           │  Exec   │
  │     │                                                                                                                                                                                          │  (ms)   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 1   │ Auth: token lookup                                                                                                                                                                       │ 0.055   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 2   │ Auth: token update                                                                                                                                                                       │ 0.091   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 3   │ SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 (isWorkspaceAdmin)                                                                                       │ 0.022   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 4   │ SELECT id, workspace_id, document_type, title, parent_id, position, ticket_number, properties, created_at, updated_at, created_by, visibility FROM documents WHERE workspace_id = $1 AND │ 1.477   │
  │     │  archived_at IS NULL AND deleted_at IS NULL AND (visibility = 'workspace' OR created_by = $2 OR $3 = TRUE) ORDER BY position ASC, created_at DESC                                        │         │
  └─────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴─────────┘

  GET /api/search/mentions?q=auth — 5 queries

  ┌─────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬─────────┐
  │  #  │                                                                                          Query                                                                                           │  Exec   │
  │     │                                                                                                                                                                                          │  (ms)   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 1   │ Auth: token lookup                                                                                                                                                                       │ 0.038   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 2   │ Auth: token update                                                                                                                                                                       │ 0.067   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 3   │ SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 (isWorkspaceAdmin)                                                                                       │ 0.026   │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 4   │ SELECT d.id::text, d.title as name, 'person' as document_type FROM documents d WHERE d.workspace_id = $1 AND d.document_type = 'person' AND d.archived_at IS NULL AND d.deleted_at IS    │ 0.068   │
  │     │ NULL AND d.title ILIKE $2 ORDER BY d.title ASC LIMIT 5                                                                                                                                   │         │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┤
  │ 5   │ SELECT id, title, document_type, visibility FROM documents WHERE workspace_id = $1 AND document_type IN ('wiki','issue','project','program') AND deleted_at IS NULL AND title ILIKE $2   │ 0.269   │
  │     │ AND (visibility = 'workspace' OR created_by = $3 OR $4 = TRUE) ORDER BY CASE document_type... END, updated_at DESC LIMIT 10                                                              │         │
  └─────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴─────────┘

  Summary Table

  ┌───────────────────┬───────────┬───────────────┬────────────────────┬───────────────────────────┬──────┐
  │     User Flow     │ API Calls │ Total Queries │ Total PG Time (ms) │ Slowest Single Query (ms) │ N+1? │
  ├───────────────────┼───────────┼───────────────┼────────────────────┼───────────────────────────┼──────┤
  │ Load main page    │     3     │      23       │       24.85        │           3.286           │  No  │
  ├───────────────────┼───────────┼───────────────┼────────────────────┼───────────────────────────┼──────┤
  │ View a document   │     1     │       4       │        1.79        │           0.404           │  No  │
  ├───────────────────┼───────────┼───────────────┼────────────────────┼───────────────────────────┼──────┤
  │ List issues       │     1     │       5       │        4.35        │           0.822           │  No  │
  ├───────────────────┼───────────┼───────────────┼────────────────────┼───────────────────────────┼──────┤
  │ Load sprint board │     1     │       9       │        5.44        │           1.427           │  No  │
  ├───────────────────┼───────────┼───────────────┼────────────────────┼───────────────────────────┼──────┤
  │ Search content    │     2     │       9       │        5.19        │           1.477           │  No  │
  └───────────────────┴───────────┴───────────────┴────────────────────┴───────────────────────────┴──────┘

  ---
  Deliverable 4: EXPLAIN ANALYZE on Slowest Queries

  Status: DONE

  Slowest Query #1: Projects list with 3 correlated subqueries (1.521 ms)

  Source: GET /api/projects (projects.ts:385-411)

  EXPLAIN ANALYZE SELECT d.id, d.title, d.properties, prog_da.related_id as program_id,
         d.archived_at, d.created_at, d.updated_at, d.converted_from_id,
         (d.properties->>'owner_id')::uuid as owner_id,
         u.name as owner_name, u.email as owner_email,
         (SELECT COUNT(*) FROM documents s
          JOIN document_associations da ON da.document_id = s.id
            AND da.related_id = d.id AND da.relationship_type = 'project'
          WHERE s.document_type = 'sprint') as sprint_count,
         (SELECT COUNT(*) FROM documents i
          JOIN document_associations da ON da.document_id = i.id
            AND da.related_id = d.id AND da.relationship_type = 'project'
          WHERE i.document_type = 'issue') as issue_count,
         CASE WHEN d.archived_at IS NOT NULL THEN 'archived'
              WHEN d.properties->>'plan_validated' IS NOT NULL THEN 'completed'
              ELSE COALESCE(
                (SELECT CASE MAX(CASE
                  WHEN CURRENT_DATE BETWEEN
                    (w.sprint_start_date + ((sprint.properties->>'sprint_number')::int - 1) * 7)
                    AND (w.sprint_start_date + ((sprint.properties->>'sprint_number')::int - 1) * 7 + 6)
                  THEN 3
                  WHEN CURRENT_DATE < (w.sprint_start_date + ((sprint.properties->>'sprint_number')::int - 1) * 7)
                  THEN 2 ELSE 1 END)
                 WHEN 3 THEN 'active' WHEN 2 THEN 'planned' ELSE NULL END
                 FROM documents sprint
                 JOIN workspaces w ON w.id = sprint.workspace_id
                 WHERE sprint.document_type = 'sprint' AND sprint.workspace_id = d.workspace_id
                   AND (sprint.properties->>'project_id')::uuid = d.id
                   AND jsonb_array_length(COALESCE(sprint.properties->'assignee_ids','[]'::jsonb)) > 0),
                'backlog')
         END as inferred_status
  FROM documents d
  LEFT JOIN users u ON u.id = (d.properties->>'owner_id')::uuid
  LEFT JOIN document_associations prog_da ON prog_da.document_id = d.id
    AND prog_da.relationship_type = 'program'
  WHERE d.workspace_id = $1 AND d.document_type = 'project'
    AND (d.visibility = 'workspace' OR d.created_by = $2 OR $3 = TRUE)
    AND d.archived_at IS NULL
  ORDER BY ((COALESCE((d.properties->>'impact')::int, 3)
           * COALESCE((d.properties->>'confidence')::int, 3)
           * COALESCE((d.properties->>'ease')::int, 3))) DESC;

   Sort  (cost=1443.75..1443.79 rows=15 width=403) (actual time=1.065..1.068 rows=15 loops=1)
     Sort Key: (((COALESCE(((d.properties ->> 'impact')::int, 3) * ...))) DESC
     Sort Method: quicksort  Memory: 33kB
     ->  Hash Left Join  (cost=28.00..1443.46 rows=15 width=403) (actual time=0.315..1.015 rows=15 loops=1)
           Hash Cond: (((d.properties ->> 'owner_id'))::uuid = u.id)
           ->  Hash Right Join  (rows=15)
                 ->  Seq Scan on document_associations prog_da (rows=154)
                       Filter: (relationship_type = 'program')
                       Rows Removed by Filter: 247
                 ->  Bitmap Heap Scan on documents d (rows=15)
                       Recheck Cond: (document_type = 'project')
                       ->  Bitmap Index Scan on idx_documents_document_type (rows=15)
           SubPlan 1 (sprint_count) — executes 15 times:
             ->  Aggregate (actual time=0.017 per loop, 15 loops)
                   ->  Nested Loop (rows=2 per loop)
                         ->  Bitmap Heap Scan on document_associations da (rows=9 per loop)
                               Index: idx_document_associations_related_type
                         ->  Memoize (139 lookups, 0 hits)
                               ->  Index Scan on documents s
                                     Rows Removed by Filter: 1
           SubPlan 2 (issue_count) — executes 15 times:
             ->  Aggregate (actual time=0.015 per loop, 15 loops)
                   ->  Nested Loop (rows=7 per loop)
                         ->  Bitmap Heap Scan on document_associations da_1 (rows=9 per loop)
                         ->  Memoize (139 lookups, 0 hits)
           SubPlan 3 (inferred_status) — executes 15 times:
             ->  Aggregate (actual time=0.021 per loop, 15 loops)
                   ->  Nested Loop (rows=2 per loop)
                         ->  Bitmap Heap Scan on documents sprint (rows=2 per loop)
                               Recheck Cond: (document_type = 'sprint')
                               Filter: (project_id = d.id AND jsonb_array_length > 0)
                               Rows Removed by Filter: 33
                               Heap Blocks: exact=60
   Planning Time: 2.140 ms
   Execution Time: 1.394 ms

  Problem: 3 correlated subqueries × 15 project rows = 45 subquery executions. Each subquery scans sprint docs (35 rows) or document_associations. SubPlan 1 and 2 both scan the same document_associations rows
  with 139 lookups and 0 cache hits. SubPlan 3 does a bitmap heap scan of all 35 sprint documents per project (60 heap blocks across 15 loops).

  ---
  Slowest Query #2: Search — full documents table scan (1.477 ms)

  Source: GET /api/documents (documents.ts:94-131)

  EXPLAIN ANALYZE SELECT id, workspace_id, document_type, title, parent_id, position,
         ticket_number, properties,
         created_at, updated_at, created_by, visibility
  FROM documents
  WHERE workspace_id = $1
    AND archived_at IS NULL AND deleted_at IS NULL
    AND (visibility = 'workspace' OR created_by = $2 OR $3 = TRUE)
  ORDER BY position ASC, created_at DESC;

   Sort  (cost=37.78..38.43 rows=257 width=332) (actual time=0.520..0.528 rows=257 loops=1)
     Sort Key: "position", created_at DESC
     Sort Method: quicksort  Memory: 112kB
     ->  Seq Scan on documents  (cost=0.00..27.50 rows=257 width=332)
           (actual time=0.007..0.241 rows=257 loops=1)
           Filter: ((archived_at IS NULL) AND (deleted_at IS NULL)
                    AND (workspace_id = '...'::uuid)
                    AND ((visibility = 'workspace') OR (created_by = '...'::uuid)))
   Planning Time: 1.149 ms
   Execution Time: 0.570 ms

  Problem: Sequential scan of entire documents table (257 rows, none filtered out). The idx_documents_active partial index exists (WHERE archived_at IS NULL AND deleted_at IS NULL) but the planner chose seq
  scan because the table is small and every row matches. At scale with thousands of documents, this becomes a problem — no pagination, all rows returned, all properties JSONB included in the result.

  ---
  Slowest Query #3: List issues main query (0.822 ms)

  Source: GET /api/issues (issues.ts:124-222)

  EXPLAIN ANALYZE SELECT d.id, d.title, d.properties, d.ticket_number, d.content,
         d.created_at, d.updated_at, d.created_by,
         d.started_at, d.completed_at, d.cancelled_at, d.reopened_at,
         d.converted_from_id,
         u.name as assignee_name,
         CASE WHEN person_doc.archived_at IS NOT NULL THEN true ELSE false END as assignee_archived
  FROM documents d
  LEFT JOIN users u ON (d.properties->>'assignee_id')::uuid = u.id
  LEFT JOIN documents person_doc ON person_doc.workspace_id = d.workspace_id
    AND person_doc.document_type = 'person'
    AND person_doc.properties->>'user_id' = d.properties->>'assignee_id'
  WHERE d.workspace_id = $1 AND d.document_type = 'issue'
    AND (d.visibility = 'workspace' OR d.created_by = $2 OR $3 = TRUE)
    AND d.archived_at IS NULL AND d.deleted_at IS NULL
  ORDER BY CASE d.properties->>'priority'
      WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
      WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5
    END, d.updated_at DESC;

   Sort  (cost=58.85..59.11 rows=104 width=682) (actual time=0.675..0.682 rows=104 loops=1)
     Sort Method: quicksort  Memory: 64kB
     ->  Hash Left Join  (cost=24.89..55.37 rows=104 width=682)
           (actual time=0.118..0.441 rows=104 loops=1)
           Hash Cond: ((d.properties ->> 'assignee_id') = (person_doc.properties ->> 'user_id'))
           ->  Hash Left Join  (cost=1.25..29.71 rows=104 width=693)
                 Hash Cond: (((d.properties ->> 'assignee_id'))::uuid = u.id)
                 ->  Seq Scan on documents d  (actual time=0.009..0.191 rows=104 loops=1)
                       Filter: (archived_at IS NULL AND deleted_at IS NULL
                                AND workspace_id = '...' AND document_type = 'issue'
                                AND (visibility = 'workspace' OR created_by = '...'))
                       Rows Removed by Filter: 153
                 ->  Hash (users, 11 rows)
           ->  Hash (person_doc, 11 rows)
                 ->  Bitmap Heap Scan on documents person_doc
                       Recheck Cond: (document_type = 'person')
                       Filter: (workspace_id = '...')
   Planning Time: 1.538 ms
   Execution Time: 0.790 ms

  Problem: The LEFT JOIN documents person_doc ON person_doc.properties->>'user_id' = d.properties->>'assignee_id' is a JSONB-to-JSONB join. PostgreSQL uses a Hash Left Join here (cost-effective at this scale)
  but the join condition extracts JSONB text on both sides for every row pair. Also, the query fetches d.content (full TipTap JSON) for all 104 issues when the list view only needs title/state/priority —
  unnecessary data transfer.

  ---
  Slowest Query #4: Sprint board project allocations (0.167 ms in isolation, 1.427 ms with parse overhead)

  Source: GET /api/dashboard/my-week (dashboard.ts:684-700)

  EXPLAIN ANALYZE SELECT DISTINCT
    proj.id as project_id, proj.title as project_title, prog.title as program_name
  FROM documents s
  JOIN documents proj ON (s.properties->>'project_id')::uuid = proj.id
    AND proj.document_type = 'project'
  LEFT JOIN document_associations prog_da ON proj.id = prog_da.document_id
    AND prog_da.relationship_type = 'program'
  LEFT JOIN documents prog ON prog_da.related_id = prog.id
    AND prog.document_type = 'program'
  WHERE s.workspace_id = $1
    AND s.document_type = 'sprint'
    AND s.properties->'assignee_ids' ? $2
    AND (s.properties->>'sprint_number')::int = $3
    AND s.deleted_at IS NULL
    AND proj.archived_at IS NULL;

   Unique  (cost=79.88..79.89 rows=1 width=52) (actual time=0.613..0.615 rows=0 loops=1)
     ->  Sort  (cost=42.13..42.14 rows=1 width=52) (actual time=0.612..0.614 rows=0 loops=1)
           ->  Nested Loop Left Join  (cost=4.87..42.12 rows=1 width=52)
                 ->  Nested Loop  (cost=4.57..38.69 rows=1 width=34)
                       ->  Bitmap Heap Scan on documents s  (actual time=0.561..0.561 rows=0)
                             Recheck Cond: (document_type = 'sprint')
                             Filter: (deleted_at IS NULL AND workspace_id = '...'
                                      AND (properties -> 'assignee_ids') ? $person_id
                                      AND ((properties ->> 'sprint_number')::int = 14))
                             Rows Removed by Filter: 35
                             Heap Blocks: exact=4
   Planning Time: 1.743 ms
   Execution Time: 0.794 ms

  Problem: Scans all 35 sprint documents and filters in-memory by JSONB ? operator and sprint_number extraction. The idx_documents_document_type index narrows to sprint rows but the JSONB property filters
  happen as post-scan filters. With hundreds of sprints this will degrade.

  ---
  Deliverable 5: Check for Missing Indexes

  Status: DONE

  Methodology: Extracted every WHERE clause, JOIN ON condition, and ORDER BY from the queries captured in Deliverable 3, then compared against the 37 existing indexes in schema.sql (lines 336-433).

  Existing indexes that ARE being used effectively

  ┌──────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────┐
  │                                        Index                                         │                       Used By                        │
  ├──────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ sessions_pkey (text)                                                                 │ Auth middleware session lookup                       │
  ├──────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ idx_documents_document_type                                                          │ Every query that filters by document_type            │
  ├──────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ idx_documents_person_user_id (properties->>'user_id' WHERE document_type = 'person') │ Person doc lookups in my-focus, my-week              │
  ├──────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ idx_document_associations_document_id                                                │ getBelongsToAssociations()                           │
  ├──────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ idx_document_associations_related_type (related_id, relationship_type)               │ sprint_count/issue_count subqueries in projects list │
  ├──────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ idx_document_associations_document_type (document_id, relationship_type)             │ Sprint/program association lookups                   │
  ├──────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ documents_pkey                                                                       │ Single document fetches                              │
  └──────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────┘

  Missing indexes identified

  ┌─────────────────────────────────────────────────┬───────────────────────────────────────────┬──────────────────────────────────────────────┬────────────────────────────────────────────────────────────┐
  │              WHERE Clause Pattern               │                  Used In                  │                Current Index                 │                            Gap                             │
  ├─────────────────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ (properties->>'assignee_id')::uuid = $user_id   │ my-work issues, issues list               │ idx_documents_properties (GIN) — supports @> │ MISSING: No B-tree index on properties->>'assignee_id' for │
  │                                                 │                                           │  containment, not ->>'key' = value equality  │  issue assignment lookups                                  │
  ├─────────────────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ (properties->>'owner_id')::uuid = $user_id      │ my-work projects, my-work sprints,        │ idx_documents_properties (GIN) — same issue  │ MISSING: No B-tree index on properties->>'owner_id' for    │
  │                                                 │ projects list                             │                                              │ ownership lookups                                          │
  ├─────────────────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │                                                 │ my-work sprints, my-focus allocations,    │                                              │ MISSING: No index on sprint number. All 35 sprint          │
  │ (properties->>'sprint_number')::int = $N        │ my-week allocations, inferred_status      │ None                                         │ documents scanned per query                                │
  │                                                 │ subquery                                  │                                              │                                                            │
  ├─────────────────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ properties->'assignee_ids' ? $person_id         │ my-focus and my-week project allocations  │ idx_documents_properties (GIN) — does        │ OK — GIN works but only if combined with document_type =   │
  │                                                 │                                           │ support the ? operator                       │ 'sprint' which is the bitmap index used                    │
  ├─────────────────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ (properties->>'person_id') = $id AND            │                                           │                                              │ MISSING: No index on person_id + week_number for weekly    │
  │ (properties->>'week_number')::int = $N          │ my-week plan/retro/prev-retro lookups     │ None                                         │ document lookups. Scans all weekly_plan (32) or            │
  │                                                 │                                           │                                              │ weekly_retro (27) rows                                     │
  ├─────────────────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ (properties->>'author_id') = $id AND            │ my-week standups                          │ None                                         │ MISSING: No index for standup lookups by author+date       │
  │ (properties->>'date') = ANY(...)                │                                           │                                              │                                                            │
  ├─────────────────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ title ILIKE '%query%'                           │ search/mentions people, search/mentions   │ None                                         │ MISSING: No trigram index for ILIKE substring search.      │
  │                                                 │ docs                                      │                                              │ Currently seq scans                                        │
  ├─────────────────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ workspace_id = $1 AND user_id = $2 on           │ Auth middleware, isWorkspaceAdmin (every  │ UNIQUE(workspace_id, user_id) constraint     │ OK — unique constraint creates implicit index, but planner │
  │ workspace_memberships                           │ request)                                  │                                              │  chose seq scan (11 rows too small)                        │
  ├─────────────────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ (properties->>'project_id')::uuid = d.id on     │ inferred_status subquery in projects list │ None                                         │ MISSING: No index on sprint's properties->>'project_id'    │
  │ sprint docs                                     │                                           │                                              │ for project-sprint relationship lookups                    │
  └─────────────────────────────────────────────────┴───────────────────────────────────────────┴──────────────────────────────────────────────┴────────────────────────────────────────────────────────────┘

  Recommended new indexes

  -- 1. Issue assignee lookups (my-work, issues list)
  CREATE INDEX idx_documents_assignee_id ON documents
    ((properties->>'assignee_id'))
    WHERE document_type = 'issue' AND archived_at IS NULL AND deleted_at IS NULL;

  -- 2. Document owner lookups (my-work projects/sprints, projects list)
  CREATE INDEX idx_documents_owner_id ON documents
    ((properties->>'owner_id'))
    WHERE document_type IN ('project', 'sprint') AND archived_at IS NULL;

  -- 3. Sprint number lookups (used in 5+ queries)
  CREATE INDEX idx_documents_sprint_number ON documents
    (((properties->>'sprint_number')::int))
    WHERE document_type = 'sprint';

  -- 4. Weekly plan/retro person+week lookup
  CREATE INDEX idx_documents_weekly_person_week ON documents
    ((properties->>'person_id'), ((properties->>'week_number')::int))
    WHERE document_type IN ('weekly_plan', 'weekly_retro') AND deleted_at IS NULL;

  -- 5. Sprint project_id for inferred_status subquery
  CREATE INDEX idx_documents_sprint_project ON documents
    (((properties->>'project_id')::uuid))
    WHERE document_type = 'sprint';

  -- 6. Trigram index for ILIKE search (requires pg_trgm extension)
  -- CREATE EXTENSION IF NOT EXISTS pg_trgm;
  -- CREATE INDEX idx_documents_title_trgm ON documents USING GIN (title gin_trgm_ops);

  ---
  Deliverable 6: Identify N+1 Patterns

  Status: DONE

  N+1 patterns NOT found (properly batched)

  ┌──────────────────────────────────────────────────────┬───────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                       Location                       │                Pattern                │                                             How It's Avoided                                              │
  ├──────────────────────────────────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ GET /api/issues list → associations                  │ Could be 1 query per issue to get     │ getBelongsToAssociationsBatch(issueIds) at issues.ts:227 uses WHERE da.document_id = ANY($1) — single     │
  │                                                      │ belongs_to                            │ query for all issues                                                                                      │
  ├──────────────────────────────────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ GET /api/dashboard/my-focus → plans for multiple     │ Could be 1 query per project          │ Single query with AND (properties->>'project_id') = ANY($3) at dashboard.ts:399-409                       │
  │ projects                                             │                                       │                                                                                                           │
  ├──────────────────────────────────────────────────────┼───────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ GET /api/dashboard/my-focus → activity for multiple  │ Could be 1 query per project          │ Single query with AND proj_assoc.related_id = ANY($2) at dashboard.ts:426-438                             │
  │ projects                                             │                                       │                                                                                                           │
  └──────────────────────────────────────────────────────┴───────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Potential N+1 patterns found (currently safe but fragile)

  1. syncBelongsToAssociations() — Sequential INSERTs in a loop

  Source: document-crud.ts:195-213

  export async function syncBelongsToAssociations(documentId, associations) {
    await pool.query('DELETE FROM document_associations WHERE document_id = $1', [documentId]);
    for (const assoc of associations) {
      await pool.query(
        `INSERT INTO document_associations (document_id, related_id, relationship_type) VALUES ($1, $2, $3)`,
        [documentId, assoc.id, assoc.type]
      );
    }
  }

  Verdict: N+1 on write path. Each association is a separate INSERT. For an issue with 3 associations (project + sprint + program), that's 1 DELETE + 3 INSERTs = 4 queries instead of 1 DELETE + 1 bulk INSERT.
  Not on any read flow measured, but fires on every issue update that changes associations.

  2. GET /api/documents/:id — conditional owner lookups per document type

  Source: documents.ts:265-304

  // Project owner lookup
  if (doc.document_type === 'project' && props.owner_id) {
    const ownerResult = await pool.query(/*...*/);  // +1 query
  }
  // Sprint owner lookup
  if (doc.document_type === 'sprint' && props.assignee_ids?.[0]) {
    const ownerResult = await pool.query(/*...*/);  // +1 query
  }
  // Weekly plan/retro person name
  if ((doc.document_type === 'weekly_plan' || doc.document_type === 'weekly_retro') && props.person_id) {
    const personResult = await pool.query(/*...*/);  // +1 query
  }

  Verdict: Not N+1 (single document view, not a list), but adds 1 extra query per document view for projects/sprints/weekly docs. Could be consolidated into the main canAccessDocument query with a LEFT JOIN.

  3. GET /api/projects — 3 correlated subqueries per row

  Source: projects.ts:385-411

  (SELECT COUNT(*) FROM documents s JOIN document_associations da ... WHERE da.related_id = d.id) as sprint_count,
  (SELECT COUNT(*) FROM documents i JOIN document_associations da ... WHERE da.related_id = d.id) as issue_count,
  (SELECT ... FROM documents sprint JOIN workspaces w ... WHERE (sprint.properties->>'project_id')::uuid = d.id) as inferred_status

  Verdict: This IS effectively an N+1 pattern expressed as correlated subqueries in SQL. For 15 projects, PostgreSQL executes each subquery 15 times = 45 subquery executions. The EXPLAIN ANALYZE confirms this:
   actual time=0.017 per loop, 15 loops for sprint_count, 0.015 per loop, 15 loops for issue_count, 0.021 per loop, 15 loops for inferred_status. With 100 projects this would be 300 subquery executions. Should
   be rewritten as LEFT JOINs with GROUP BY or lateral joins.

Improvement Target
20% reduction in total query count on at least one user flow, or 50% improvement on the slowest query. Provide before/after EXPLAIN ANALYZE output. Document what was inefficient and why your change fixes it. 


Category 5: Test Coverage and Quality 
What you are measuring: What the existing test suite covers, what it misses, and how reliable it is. Ship has 73+ Playwright E2E tests. Your job is to understand what they test, find the gaps, and assess test reliability. 

How to Measure 
[x] Run the full test suite: pnpm test. Record pass/fail counts and total runtime 
[x] Read the test files. Catalog what user flows are covered and which are not 
[x] Identify flaky tests: run the suite 3 times and note any tests that pass sometimes and fail others 
[x] Map critical user flows (document CRUD, real-time sync, auth, sprint management) against existing test coverage 
[x] If code coverage tooling is not configured, configure it and report line/branch coverage per package 

Audit Deliverable

  ┌─────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────┐
  │       Metric        │                                          Value                                          │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────┤
  │ Total Tests         │ 1,436 (451 API unit + 119 web unit + 866 E2E)                                           │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────┤
  │ Pass / Fail / Flaky │ API: 451 / 0 / 0 (3 runs, all green)                                                    │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────┤
  │                     │ Web: 0 / 119 / 0 (all crash — ESM dependency bug in html-encoding-sniffer@6.0.0)        │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────┤
  │                     │ E2E: not run (requires testcontainers + full build; per CLAUDE.md use /e2e-test-runner) │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────┤
  │ Suite runtime       │ API: ~42s consistently across 3 runs                                                    │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────┤
  │                     │ Web: <1s (crashes before executing)                                                     │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────┤
  │ Code coverage       │ api: 40.3% statements, 33.4% branch, 40.9% functions                                    │
  ├─────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────┤
  │                     │ web: 0% (tests broken)                                                                  │
  └─────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────┘

  Critical flows with zero or near-zero coverage (API unit tests)

  ┌────────────────────────────────┬────────────┬───────────────────────────────────────────────────────────────┐
  │              Flow              │  Coverage  │                            Detail                             │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ Collaboration/WebSocket server │ 8.5% lines │ src/collaboration/index.ts — the entire real-time sync engine │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ Accountability routes          │ 6.3%       │ src/routes/accountability.ts                                  │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ Programs CRUD                  │ 5.1%       │ src/routes/programs.ts                                        │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ Weekly plans                   │ 4.8%       │ src/routes/weekly-plans.ts                                    │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ Dashboard                      │ 2.0%       │ src/routes/dashboard.ts                                       │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ Team management                │ 8.7%       │ src/routes/team.ts                                            │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ AI analysis service            │ 9.0%       │ src/services/ai-analysis.ts                                   │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ CAIA auth                      │ 3.9%       │ src/routes/caia-auth.ts                                       │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ Comments                       │ 9.0%       │ src/routes/comments.ts                                        │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ Admin routes                   │ 14.5%      │ src/routes/admin.ts                                           │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ Invite acceptance              │ 0%         │ src/services/invite-acceptance.ts                             │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ Allocation utils               │ 0%         │ src/utils/allocation.ts                                       │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ Secrets manager                │ 1.6%       │ src/services/secrets-manager.ts                               │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ Database migrations            │ no tests   │ No test file exists                                           │
  ├────────────────────────────────┼────────────┼───────────────────────────────────────────────────────────────┤
  │ All web-side logic             │ 0%         │ 119 tests exist but none execute                              │
  └────────────────────────────────┴────────────┴───────────────────────────────────────────────────────────────┘

  Well-covered areas (API)

  ┌───────────────────────┬──────────┐
  │         Flow          │ Coverage │
  ├───────────────────────┼──────────┤
  │ Business days utility │ 100%     │
  ├───────────────────────┼──────────┤
  │ OpenAPI schemas       │ ~100%    │
  ├───────────────────────┼──────────┤
  │ Auth middleware       │ 77%      │
  ├───────────────────────┼──────────┤
  │ Backlinks routes      │ 89%      │
  ├───────────────────────┼──────────┤
  │ Search routes         │ 84%      │
  ├───────────────────────┼──────────┤
  │ Activity routes       │ 93%      │
  ├───────────────────────┼──────────┤
  │ Iterations routes     │ 89%      │
  ├───────────────────────┼──────────┤
  │ extractHypothesis     │ 89%      │
  ├───────────────────────┼──────────┤
  │ transformIssueLinks   │ 89%      │
  └───────────────────────┴──────────┘

  Key findings

  1. Zero flaky tests in API suite (3/3 runs identical)
  2. Web test suite completely broken — html-encoding-sniffer@6.0.0 ESM/CJS incompatibility prevents any test from loading
  3. Collaboration server has 8.5% coverage despite being the most complex and risk-prone subsystem
  4. No test.fixme() or test.skip() in E2E — all 866 E2E tests are active
  5. Coverage already configured in api/vitest.config.ts (v8 provider) but @vitest/coverage-v8 was not installed

Improvement Target
Add meaningful tests for 3 previously untested critical paths, or fix 3 flaky tests with documented root cause analysis. "Meaningful" means the test catches a real regression, not just asserting that a page loads. Each test must include a comment explaining what risk it mitigates. 


Category 6: Runtime Error and Edge Case Handling 
What you are measuring: How the application behaves when things go wrong. This covers error boundaries, unhandled promise rejections, network failurerecovery (especially during real-time collaboration), malformed input handling, and user-facing error states. 

How to Measure 
[x] Open browser DevTools and monitor the console during normal usage. Count errors and warnings 
[x] Test network failure: disconnect while editing a document collaboratively, then reconnect. Does data survive? Does the UI recover? 
[ ] Test malformed input: submit empty forms, extremely long text, special characters, HTML/script injection 
[ ] Test concurrent edge cases: two users editing the same document field simultaneously 
[ ] Throttle the network to 3G and use the app. Note every spinner that hangs, every silent failure, every missing loading state 
[ ] Check server logs for unhandled errors during all of the above

Audit Deliverable
Metric - Your Baseline
Console errors during normal usage -> ~84 console.error/warn across 39 files
Unhandled promise rejections (server) -> 
    No process.on('unhandledRejection') handler (api/src/index.ts)
    No Express catch-all error middleware (api/src/app.ts)
    persistDocument(docName, doc) called from setTimeout in schedulePersist — it's async but not awaited
    persistDocument(docName, doc) in the ws.on('close') cleanup — also not awaited 
Network disconnect recovery {Pass / Partial / Fail}
  The Editor (web/src/components/Editor.tsx) has solid disconnect handling:
  - y-websocket auto-reconnects by default
  - y-indexeddb caches content locally — survives full disconnects
  - SyncStatus indicator shows Saved / Cached / Saving / Offline with color-coded dot (green/blue/yellow/red) + aria-live="polite" for a11y
  - Browser online/offline events tracked — UI shows "Offline" when browser detects network loss
  - Special close codes handled: 4403 (access revoked), 4100 (document converted), 4101 (content updated via API)
  - useAutoSave.ts retries with exponential backoff (up to maxRetries)
  - TanStack Query retries up to 3x for server errors, skips retries on 4xx
  - CSRF token auto-refreshes on 403
  Data survives disconnects: Yes — Yjs CRDT state is cached in IndexedDB and reconciled on reconnect.
Missing error boundaries {List locations}
    App.tsx:542 -> <Outlet /> (the main route content)
    Editor.tsx:980 -> Sidebar portal content only
Silent failures identified {List with reproduction steps}
    .catch(() => {}) — swallows all fetch errors silently. User gets no feedback if plan quality checks/approvals fail
        Repro: Disconnect network, click any approval/dismissal button on plan quality banner
    .catch(() => {}) on status changes
        Repro: Disconnect, change issue status
    .catch(() => {}) on merge operation
        Repro: Disconnect, attempt to merge programs
    .catch(() => setAiAvailable(false)) — silently disables AI with no user message
        Repro: AI endpoint fails
    If a route handler's try/catch misses an error, Express sends raw HTML stack trace (dev) or hangs (prod)
        Repro: Trigger an unhandled throw in any route
    Server crashes without logging on any unhandled promise rejection
        Repro: Any promise rejection outside a try/catch
    Uses alert() for "access revoked" — blocks UI, no graceful UX
        Repro: Revoke document access while another user is editing

Improvement Targets
Fix 3 error handling gaps. At least one must involve a real user-facing data loss or confusion scenario (not just a missing loading spinner). Each fix requires reproduction steps, before/after behavior, and a screenshot or recording.


Category 7: Accessibility Compliance 
What you are measuring: Ship claims Section 508 compliance and WCAG 2.1 AA conformance. Your job is to verify those claims. This means automatedaccessibility scanning, keyboard navigation testing, screen reader testing, and color contrast verification across the application’s major pages. 

How to Measure 
[x] Run Lighthouse accessibility audits on every major page of the application. Record the score for each 
[x] Run an automated accessibility scanner (axe-core, pa11y, or the axe browser extension) and categorize violations by severity (Critical, Serious, Moderate, Minor) 
[x] Test full keyboard navigation: can you reach every interactive element using only Tab, Enter, Escape, and arrow keys? 
[x] Test with a screen reader (VoiceOver, NVDA, or similar). Can you understand the page structure and interact with all controls? 
[x] Check color contrast ratios on text, buttons, and interactive elements against the WCAG 2.1 AA 4.5:1 minimum 

Audit Deliverable

Initial Lighthouse reports scored very highly, and turned out to be misleading. See LIGHTHOUSE_REPORT.md for the most detail.

  Lighthouse Accessibility Score (Per Page)

  ┌─────────────────┬───────┐
  │      Page       │ Score │
  ├─────────────────┼───────┤
  │ Login           │ 100   │
  ├─────────────────┼───────┤
  │ Dashboard       │ 96    │
  ├─────────────────┼───────┤
  │ My Week         │ 96    │
  ├─────────────────┼───────┤
  │ Documents       │ 100   │
  ├─────────────────┼───────┤
  │ Issues          │ 100   │
  ├─────────────────┼───────┤
  │ Projects        │ 96    │
  ├─────────────────┼───────┤
  │ Programs        │ 100   │
  ├─────────────────┼───────┤
  │ Team Allocation │ 96    │
  ├─────────────────┼───────┤
  │ Team Directory  │ 100   │
  ├─────────────────┼───────┤
  │ Team Status     │ 96    │
  ├─────────────────┼───────┤
  │ Settings        │ 100   │
  └─────────────────┴───────┘

  Average: 98.7 (all 96-score pages fail on color-contrast only)

  ---
  Total Critical/Serious Violations: 178

  - 95 color-contrast (axe-core)
  - 55 aria-hidden-focus (Radix UI focus guards — low severity, intentional library behavior)
  - 28 explicit measured contrast failures (HTML_CodeSniffer)

  ---
  Keyboard Navigation Completeness: Partial

  Works: Skip-to-main link, tab navigation, focus rings on major elements, Command Palette focus trap, SelectableList arrow keys, context menus, comboboxes, tab bars.

  Broken/incomplete: Drag-and-drop in KanbanBoard (no real keyboard reorder), OrgChart has unreachable child elements, BulkActionBar lacks aria-live announcements, 48 elements on Docs page alone lack visible
  focus indicators.

  ---
  Color Contrast Failures: ~30+ unique patterns

  Critical (<3:1):

  ┌────────┬─────────────────────────────────────────────────────┬──────────────────────────────┐
  │ Ratio  │                        What                         │            Where             │
  ├────────┼─────────────────────────────────────────────────────┼──────────────────────────────┤
  │ 1:1    │ Workspace initial "S" (text-accent on bg-accent/20) │ Global sidebar               │
  ├────────┼─────────────────────────────────────────────────────┼──────────────────────────────┤
  │ 2.15:1 │ White on amber-500 badge                            │ TeamMode, StatusOverviewPage │
  ├────────┼─────────────────────────────────────────────────────┼──────────────────────────────┤
  │ 2.28:1 │ White on green-500 badge                            │ TeamMode                     │
  ├────────┼─────────────────────────────────────────────────────┼──────────────────────────────┤
  │ 2.54:1 │ White on emerald-500 badge                          │ StatusOverviewPage           │
  ├────────┼─────────────────────────────────────────────────────┼──────────────────────────────┤
  │ 2.59:1 │ text-accent on dark bg                              │ DashboardVariantC            │
  ├────────┼─────────────────────────────────────────────────────┼──────────────────────────────┤
  │ 2.89:1 │ text-accent "Week 14" label                         │ TeamMode, StatusOverviewPage │
  └────────┴─────────────────────────────────────────────────────┴──────────────────────────────┘

  Serious (3:1–4.5:1): White on blue-500 (3.68:1), red-500 (3.76:1), violet-500 (4.23:1), indigo-500 (4.47:1)

  Systemic (unmeasurable): text-muted/50 (~15 files), bg-accent/20 text-accent (~20 files), bg-muted/30 text-muted (Projects, Issues)

  ---
  Missing ARIA Labels or Roles

  ┌─────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                        Issue                        │                                                                  Location(s)                                                                  │
  ├─────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ No H1 on any page (H2 used as primary)              │ All 11+ pages                                                                                                                                 │
  ├─────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ ~220 decorative SVGs without aria-hidden            │ ActionItems, ActionItemsModal, AccountabilityBanner, AccountabilityGrid, DashboardVariantC, StandupFeed, sidebar components                   │
  ├─────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ ~13 tables without aria-label/caption               │ AdminDashboard (3), AdminWorkspaceDetail (2), WorkspaceSettings (4), TeamDirectory, IssuesList, Projects, Programs, Documents, SelectableList │
  ├─────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ PropertyRow selects unlabeled to screen readers     │ IssueSidebar (Status/Priority/Estimate), WeekSidebar (Status), ProjectSidebar (Status), DocumentTypeSelector (Type)                           │
  ├─────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ AdminWorkspaceDetail — zero ARIA labels             │ 3 selects (role, add-user role, invite role)                                                                                                  │
  ├─────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Radix focus-guard aria-hidden on focusable elements │ Every page (55 instances, low severity)                                                                                                       │
  └─────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

I tested screen reading with NVDA. It was basically comprehensible with some room for improvement.

Improvement Target
Achieve a Lighthouse accessibility score improvement of 10+ points on the lowest-scoring page, or fix all Critical/Serious violations on the 3 most important pages. Provide before/after Lighthouse reports or axe scan output as evidence. 