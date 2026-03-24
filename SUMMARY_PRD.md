# Ship - Comprehensive Product & Technical Specification

> **Purpose**: Exhaustive guide to ALL features, architecture, and implementation details of the Ship application. Intended as a complete reference for recreating the app from scratch.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Core Philosophy](#2-core-philosophy)
3. [Architecture Overview](#3-architecture-overview)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Shared Package (`shared/`)](#5-shared-package)
6. [Database Schema](#6-database-schema)
7. [Database Migrations](#7-database-migrations)
8. [API Backend (`api/`)](#8-api-backend)
9. [WebSocket Collaboration System](#9-websocket-collaboration-system)
10. [Frontend (`web/`)](#10-frontend)
11. [FleetGraph Agent (`agent/`)](#11-fleetgraph-agent)
12. [Authentication & Security](#12-authentication--security)
13. [Infrastructure & Deployment](#13-infrastructure--deployment)
14. [E2E Testing](#14-e2e-testing)
15. [MCP Server & AI Integration](#15-mcp-server--ai-integration)

---

## 1. Product Overview

Ship is an enterprise project management platform built for government teams (US Treasury). It combines real-time collaborative document editing (like Notion) with structured project management (like Linear) and AI-powered project health monitoring (FleetGraph agent).

### What Ship Does

- **Program Management**: Long-lived organizational goals with RACI ownership
- **Project Tracking**: Hypothesis-driven projects with ICE scoring (Impact x Confidence x Ease)
- **Weekly Accountability**: Fixed 7-day cadence with plans, retros, standups, and manager approvals
- **Issue Tracking**: Full lifecycle (triage → backlog → todo → in_progress → in_review → done)
- **Real-time Collaborative Editing**: TipTap + Yjs CRDT for conflict-free multi-user editing
- **AI Project Health Monitoring**: FleetGraph agent detects overloads, stale issues, and workload imbalance
- **Performance Management**: OPM 5-level rating scale with objective accountability data
- **PIV/CAC Authentication**: Government smart card authentication via FPKI/CAIA

### Key Differentiators

- **Everything is a document**: Programs, projects, weeks, issues, people — all stored in one `documents` table with a `document_type` discriminator
- **Hypothesis-driven development**: Plans are hypotheses, weeks are experiments, retros are conclusions
- **Binary validation**: Projects are either validated or invalidated (no "partial success")
- **Accountability over blocking**: Missing items create yellow/red indicators, not blocking gates

---

## 2. Core Philosophy

### Unified Document Model (Notion Paradigm)

Every content type (wiki, issue, program, project, sprint, person, weekly_plan, weekly_retro, standup, weekly_review) is a row in the `documents` table. The difference between types is `properties` (JSONB), not structure.

### Hierarchy

```
Programs (long-lived goals)
  └── Projects (validated hypotheses, ICE-scored)
        └── Weeks/Sprints (7-day accountability windows)
              └── Issues (work units)
                    └── Sub-issues (parent_id hierarchy)
```

### Scientific Method Applied to Work

| Phase | Artifact | Question |
|-------|----------|----------|
| Hypothesis | Weekly Plan | "What will we accomplish?" |
| Experiment | The Sprint Week | "Execute the plan" |
| Conclusion | Weekly Retro | "What did we learn?" |

### Accountability Model

- **RACI**: Responsible (does work), Accountable (approves), Consulted, Informed
- **Visibility over blocking**: Gaps are made visible (yellow → red escalation), not blocking
- **Auto-escalation**: 7+ days overdue items auto-generate accountability issues
- **Manager approval flow**: Plans approved before week starts, retros within 3 days of week end
- **Approval states**: `null` → `approved` → `changed_since_approved` → `changes_requested`

### Design Principles

- **YAGNI**: Only build what's needed now
- **Boring Technology**: PostgreSQL, Express, React — nothing exotic
- **No ORM**: Direct SQL via `pg` driver
- **4-Panel Layout**: Icon Rail (48px) | Sidebar (224px) | Content (flex-1) | Properties (256px)
- **"Untitled" everywhere**: All new documents use exactly `"Untitled"` (not "Untitled Issue")

---

## 3. Architecture Overview

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TanStack React Query v5, TipTap (rich text), Yjs (CRDT), Tailwind CSS |
| **Backend** | Node.js 20+, Express.js, WebSocket (ws), Yjs sync protocol |
| **Database** | PostgreSQL 16 (direct SQL via `pg`, no ORM) |
| **AI Agent** | LangGraph (state machine), Google Gemini 2.5 Flash, LangSmith (tracing) |
| **Infra** | AWS (Elastic Beanstalk, S3, CloudFront, Aurora, SSM), Docker, Terraform |
| **Auth** | PIV/CAC (FPKI/CAIA OAuth2), password fallback, API tokens (SHA-256) |
| **Testing** | Playwright (E2E), Vitest (unit) |

### Data Flow

```
Browser ─── REST API ──── PostgreSQL
  │              │
  │         WebSocket ─── Yjs CRDT State (persisted to PostgreSQL)
  │              │
  │         /events ───── Real-time notifications
  │
  └── SSE ────── FleetGraph Agent ──── Gemini AI
                      │
                      └── Ship REST API (read/write via ShipClient)
```

### State Management

- **Server state**: TanStack React Query with IndexedDB persistence (stale-while-revalidate)
- **Editor state**: Yjs CRDT synced via WebSocket
- **Auth state**: React Context + localStorage cache
- **UI state**: React Context (workspace, documents, programs, projects, issues)

---

## 4. Monorepo Structure

```
ship/
├── package.json              # Root workspace config
├── pnpm-workspace.yaml       # Workspace: api, web, shared, agent
├── shared/                   # TypeScript types shared between packages
│   ├── src/
│   │   ├── index.ts          # Re-exports all types + constants
│   │   ├── constants.ts      # HTTP_STATUS, ERROR_CODES, SESSION_TIMEOUT_MS
│   │   └── types/
│   │       ├── api.ts        # ApiResponse<T>, ApiError
│   │       ├── auth.ts       # (minimal)
│   │       ├── document.ts   # Document, all typed variants, properties interfaces
│   │       ├── user.ts       # User interface
│   │       └── workspace.ts  # Workspace, WorkspaceMembership, WorkspaceInvite, AuditLog
│   ├── package.json
│   └── tsconfig.json
├── api/                      # Express backend
├── web/                      # React + Vite frontend
├── agent/                    # FleetGraph AI agent (separate process)
├── e2e/                      # Playwright E2E tests
├── terraform/                # AWS infrastructure
├── scripts/                  # Dev/deploy scripts
├── docs/                     # Architecture & philosophy docs
└── docker-compose*.yml       # Container orchestration
```

### Package Manager

- **pnpm 10.27.0** with workspaces
- **Node.js 20+** required
- Build order: `shared` → `api` / `web` / `agent` (shared must build first)

### Key Scripts

```bash
pnpm dev                    # Auto-create DB, find ports, start api + web
pnpm dev:api                # Express server on :3000
pnpm dev:web                # Vite dev server on :5173
pnpm build                  # Build all packages
pnpm build:shared           # Build shared types (required first)
pnpm test                   # Run all unit tests
pnpm test:e2e               # Playwright E2E tests
pnpm db:seed                # Seed database with test data
pnpm db:migrate             # Run database migrations
pnpm type-check             # TypeScript checking across all packages
```

---

## 5. Shared Package

### Constants (`shared/src/constants.ts`)

```typescript
HTTP_STATUS = { OK: 200, CREATED: 201, NO_CONTENT: 204, BAD_REQUEST: 400,
  UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500 }

ERROR_CODES = { VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, FORBIDDEN,
  INTERNAL_ERROR, INVALID_CREDENTIALS, SESSION_EXPIRED, ALREADY_EXISTS }

SESSION_TIMEOUT_MS = 15 * 60 * 1000       // 15 minutes (NIST SP 800-63B-4)
ABSOLUTE_SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000  // 12 hours
```

### Document Types (`shared/src/types/document.ts`)

```typescript
type DocumentType = 'wiki' | 'issue' | 'program' | 'project' | 'sprint'
  | 'person' | 'weekly_plan' | 'weekly_retro' | 'standup' | 'weekly_review';

type DocumentVisibility = 'private' | 'workspace';
type BelongsToType = 'program' | 'project' | 'sprint' | 'parent';
type IssueState = 'triage' | 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';
type IssueSource = 'internal' | 'external' | 'action_items';
type ICEScore = 1 | 2 | 3 | 4 | 5;
type ApprovalState = null | 'approved' | 'changed_since_approved' | 'changes_requested';
type AccountabilityType = 'standup' | 'weekly_plan' | 'weekly_retro' | 'weekly_review'
  | 'week_start' | 'week_issues' | 'project_plan' | 'project_retro'
  | 'changes_requested_plan' | 'changes_requested_retro';
```

### Property Interfaces

**IssueProperties:**
```typescript
{ state: IssueState, priority: IssuePriority, assignee_id?: string | null,
  estimate?: number | null, source: IssueSource, rejection_reason?: string | null,
  due_date?: string | null, is_system_generated?: boolean,
  accountability_target_id?: string | null, accountability_type?: AccountabilityType | null }
```

**ProgramProperties:**
```typescript
{ color: string, emoji?: string | null, owner_id?: string | null,
  accountable_id?: string | null, consulted_ids?: string[], informed_ids?: string[] }
```

**ProjectProperties:**
```typescript
{ impact: ICEScore | null, confidence: ICEScore | null, ease: ICEScore | null,
  owner_id?: string | null, accountable_id?: string | null,
  consulted_ids?: string[], informed_ids?: string[], color: string, emoji?: string | null,
  plan_validated?: boolean | null, monetary_impact_expected?: string | null,
  monetary_impact_actual?: string | null, success_criteria?: string[] | null,
  next_steps?: string | null, plan_approval?: ApprovalTracking | null,
  retro_approval?: ApprovalTracking | null, has_design_review?: boolean | null,
  design_review_notes?: string | null }
```

**WeekProperties:**
```typescript
{ sprint_number: number, owner_id: string, status?: 'planning' | 'active' | 'completed',
  plan?: string | null, success_criteria?: string[] | null, confidence?: number | null,
  plan_history?: PlanHistoryEntry[] | null, plan_approval?: ApprovalTracking | null,
  review_approval?: ApprovalTracking | null,
  review_rating?: { value: number, rated_by: string, rated_at: string } | null }
```

**PersonProperties:**
```typescript
{ email?: string | null, role?: string | null, capacity_hours?: number | null,
  reports_to?: string | null }
```

**WeeklyPlanProperties / WeeklyRetroProperties:**
```typescript
{ person_id: string, project_id?: string, week_number: number,
  submitted_at?: string | null }
```

**StandupProperties:**
```typescript
{ author_id: string, date?: string, submitted_at?: string | null }
```

**WeeklyReviewProperties:**
```typescript
{ sprint_id: string, owner_id: string, plan_validated: boolean | null }
```

**ApprovalTracking:**
```typescript
{ state: ApprovalState, approved_by: string | null, approved_at: string | null,
  approved_version_id: number | null, feedback?: string | null, comment?: string | null }
```

### Base Document Interface

```typescript
interface Document {
  id: string; workspace_id: string; document_type: DocumentType;
  title: string; content: Record<string, unknown>; yjs_state?: Uint8Array | null;
  parent_id?: string | null; position: number; properties: Record<string, unknown>;
  ticket_number?: number | null; archived_at?: Date | null;
  created_at: Date; updated_at: Date; created_by?: string | null;
  visibility: DocumentVisibility;
  started_at?: Date | null; completed_at?: Date | null;
  cancelled_at?: Date | null; reopened_at?: Date | null;
  converted_to_id?: string | null; converted_from_id?: string | null;
  converted_at?: Date | null; converted_by?: string | null;
}
```

### Typed Variants

Each document type has a typed variant: `WikiDocument`, `IssueDocument`, `ProgramDocument`, `ProjectDocument`, `WeekDocument`, `PersonDocument`, `WeeklyPlanDocument`, `WeeklyRetroDocument`, `StandupDocument`, `WeeklyReviewDocument`.

### Helpers

```typescript
function computeICEScore(impact, confidence, ease): number | null
const DEFAULT_PROJECT_PROPERTIES = { impact: null, confidence: null, ease: null,
  owner_id: null, color: '#6366f1' }
```

---

## 6. Database Schema

### Tables (15 total)

#### `workspaces`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT NOT NULL | |
| sprint_start_date | DATE NOT NULL | Monday-aligned, default: CURRENT_DATE |
| archived_at | TIMESTAMPTZ | Soft archive |
| created_at, updated_at | TIMESTAMPTZ | |

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | TEXT UNIQUE NOT NULL | Case-insensitive via LOWER() index |
| password_hash | TEXT | Nullable (null for PIV-only users) |
| name | TEXT NOT NULL | |
| is_super_admin | BOOLEAN | Default: false |
| last_workspace_id | UUID FK | Last active workspace |
| x509_subject_dn | TEXT | PIV certificate distinguished name |
| piv_first_login_at | TIMESTAMPTZ | |
| last_auth_provider | VARCHAR(50) | 'fpki_validator', 'caia', null |
| created_at, updated_at | TIMESTAMPTZ | |

#### `workspace_memberships`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| workspace_id | UUID FK CASCADE | |
| user_id | UUID FK CASCADE | |
| role | TEXT CHECK | 'admin' or 'member' |
| created_at, updated_at | TIMESTAMPTZ | |
| **Constraint** | UNIQUE | (workspace_id, user_id) |

#### `workspace_invites`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| workspace_id | UUID FK CASCADE | |
| email | TEXT NOT NULL | |
| token | TEXT UNIQUE | Nullable for PIV invites |
| role | TEXT CHECK | 'admin' or 'member' |
| invited_by_user_id | UUID FK | |
| x509_subject_dn | TEXT | For PIV invites |
| expires_at, used_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

#### `sessions`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | 64-char hex (NOT UUID) |
| user_id | UUID FK CASCADE | |
| workspace_id | UUID FK CASCADE | |
| expires_at | TIMESTAMPTZ NOT NULL | |
| last_activity | TIMESTAMPTZ | Default: now() |
| user_agent, ip_address | TEXT | Session binding |
| created_at | TIMESTAMPTZ | |

#### `oauth_state`
| Column | Type | Notes |
|--------|------|-------|
| state_id | TEXT PK | |
| nonce | TEXT NOT NULL | |
| code_verifier | TEXT NOT NULL | PKCE |
| created_at, expires_at | TIMESTAMPTZ | |

#### `documents` (THE CORE TABLE)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| workspace_id | UUID FK NOT NULL CASCADE | |
| document_type | ENUM | wiki, issue, program, project, sprint, person, weekly_plan, weekly_retro, standup, weekly_review |
| title | TEXT NOT NULL | Default: 'Untitled' |
| content | JSONB | TipTap JSON. Default: `{"type":"doc","content":[{"type":"paragraph"}]}` |
| yjs_state | BYTEA | Yjs binary CRDT state |
| parent_id | UUID FK CASCADE | Self-reference for hierarchy |
| position | INTEGER | Default: 0 |
| properties | JSONB | Type-specific data. Default: `{}` |
| ticket_number | INTEGER | Per-workspace auto-increment sequence |
| archived_at | TIMESTAMPTZ | Soft archive |
| deleted_at | TIMESTAMPTZ | Soft delete (hard delete after 30 days) |
| started_at | TIMESTAMPTZ | First transition to in_progress |
| completed_at | TIMESTAMPTZ | Transition to done |
| cancelled_at | TIMESTAMPTZ | Transition to cancelled |
| reopened_at | TIMESTAMPTZ | Return from done/cancelled |
| converted_to_id | UUID FK | Points to converted document |
| converted_from_id | UUID FK | Points to source document |
| converted_at | TIMESTAMPTZ | |
| converted_by | UUID FK | |
| original_type | VARCHAR(50) | Pre-conversion type |
| conversion_count | INTEGER | Default: 0 |
| visibility | TEXT CHECK | 'private' or 'workspace'. Default: 'workspace' |
| created_at, updated_at | TIMESTAMPTZ | |
| created_by | UUID FK | |
| **Constraint** | CHECK | id != parent_id (no self-reference) |
| **Trigger** | | prevent_circular_parent (prevents circular chains) |

#### `document_associations` (Junction table)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| document_id | UUID FK CASCADE | |
| related_id | UUID FK CASCADE | |
| relationship_type | ENUM | 'parent', 'project', 'sprint', 'program' |
| metadata | JSONB | Default: `{}` |
| created_at | TIMESTAMPTZ | |
| **Constraint** | UNIQUE | (document_id, related_id, relationship_type) |
| **Constraint** | CHECK | document_id != related_id |

#### `document_history` (Change audit trail)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| document_id | UUID FK CASCADE | |
| field | TEXT NOT NULL | e.g., 'title', 'state', 'priority' |
| old_value, new_value | TEXT | |
| changed_by | UUID FK | |
| automated_by | TEXT | e.g., 'claude' for AI changes |
| created_at | TIMESTAMPTZ | |

#### `document_snapshots` (Type conversion preservation)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| document_id | UUID FK CASCADE | |
| document_type | VARCHAR | Pre-conversion type |
| title | TEXT | |
| properties | JSONB | Pre-conversion properties |
| ticket_number | INTEGER | |
| snapshot_reason | VARCHAR(50) | Default: 'conversion' |
| created_at | TIMESTAMPTZ | |
| created_by | UUID FK | |

#### `api_tokens` (CLI/API auth)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK | |
| workspace_id | UUID FK | |
| name | TEXT NOT NULL | User-provided name |
| token_hash | TEXT NOT NULL | SHA-256 hash (plaintext NEVER stored) |
| token_prefix | TEXT NOT NULL | First 8 chars for identification |
| last_used_at | TIMESTAMPTZ | |
| expires_at | TIMESTAMPTZ | Nullable = never expires |
| revoked_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| **Constraint** | UNIQUE | (user_id, workspace_id, name) |

#### `sprint_iterations`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| sprint_id | UUID FK CASCADE | |
| workspace_id | UUID FK CASCADE | |
| story_id | TEXT | |
| story_title | TEXT NOT NULL | |
| status | TEXT CHECK | 'pass', 'fail', 'in_progress' |
| what_attempted | TEXT | |
| blockers_encountered | TEXT | |
| author_id | UUID FK | |
| created_at, updated_at | TIMESTAMPTZ | |

#### `issue_iterations`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| issue_id | UUID FK CASCADE | |
| workspace_id | UUID FK CASCADE | |
| status | TEXT CHECK | 'pass', 'fail', 'in_progress' |
| what_attempted | TEXT | |
| blockers_encountered | TEXT | |
| author_id | UUID FK | |
| created_at, updated_at | TIMESTAMPTZ | |

#### `files` (Attachments)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| workspace_id | UUID FK CASCADE | |
| uploaded_by | UUID FK CASCADE | |
| filename, mime_type | TEXT | |
| size_bytes | BIGINT | |
| s3_key | TEXT | S3 object key or local path |
| cdn_url | TEXT | CloudFront URL |
| status | TEXT CHECK | 'pending', 'uploaded', 'failed' |
| created_at, updated_at | TIMESTAMPTZ | |

#### `document_links` (Backlinks)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| source_id | UUID FK CASCADE | |
| target_id | UUID FK CASCADE | |
| created_at | TIMESTAMPTZ | |
| **Constraint** | UNIQUE | (source_id, target_id) |

#### `comments` (Inline document comments)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| document_id | UUID FK CASCADE | |
| comment_id | UUID NOT NULL | Thread identifier (matches TipTap mark) |
| parent_id | UUID FK CASCADE | Null for root, set for replies |
| author_id | UUID FK | |
| workspace_id | UUID FK CASCADE | |
| content | TEXT NOT NULL | |
| resolved_at | TIMESTAMPTZ | |
| created_at, updated_at | TIMESTAMPTZ | |

#### `agent_actions` (FleetGraph suggestions)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| target_user_id | UUID FK | |
| action_type | VARCHAR(50) | e.g., 'priority_change', 'status_change', 'briefing' |
| status | VARCHAR(20) | Default: 'pending' |
| severity_score | NUMERIC | |
| context | JSONB NOT NULL | |
| suggestion | JSONB NOT NULL | |
| gemini_reasoning | TEXT | |
| snooze_until | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ | |
| langsmith_trace_id | VARCHAR(100) | |
| created_at, updated_at | TIMESTAMPTZ | |

#### `audit_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| workspace_id | UUID FK | Nullable |
| actor_user_id | UUID FK | Nullable (for failed logins) |
| impersonating_user_id | UUID FK | |
| action | TEXT NOT NULL | |
| resource_type, resource_id | TEXT/UUID | |
| details | JSONB | |
| ip_address | INET | |
| user_agent | TEXT | |
| created_at | TIMESTAMPTZ | |

### Indexes (50+)

Every table has comprehensive indexes optimized for the query patterns. Key indexes include:
- Documents: workspace_id, parent_id, document_type, properties (GIN), person user_id, visibility, active composite
- Associations: document_id, related_id, relationship_type, composites
- Sessions: user_id, expires_at, workspace_id
- Users: LOWER(email), x509_subject_dn

---

## 7. Database Migrations

39 numbered migrations track the schema evolution:

| # | Name | What It Does |
|---|------|-------------|
| 001 | properties_jsonb | Add JSONB properties column |
| 002 | person_membership_decoupling | Separate auth from person documents |
| 003 | document_history | Create audit trail table |
| 004 | fix_person_user_id_backfill | Backfill person document references |
| 005 | create_missing_person_documents | Auto-create person docs for members |
| 006 | document_visibility | Add private/workspace visibility |
| 007 | archived_and_deleted_at | Add soft-delete columns |
| 007b | remove_prefix_add_emoji | Remove prefix, add emoji to properties |
| 008 | consolidate_feedback | Consolidate feedback tracking |
| 009 | audit_logs_nullable_actor | Allow null actor (failed logins) |
| 010 | oauth_state | Create OAuth state table |
| 011 | piv_invite_support | Add x509_subject_dn to invites |
| 012 | require_invite_email | Require email on invites |
| 013 | fix_duplicate_users | Handle duplicate cleanup |
| 014 | api_tokens | Create API tokens table |
| 014b | backfill_missing_person_documents | Backfill missing person docs |
| 015 | add_last_auth_provider | Track last auth method |
| 015b | sprint_iterations | Create sprint iterations table |
| 016 | document_history_automated_by | Track AI changes |
| 017 | standup_sprint_review_types | Add standup, weekly_review types |
| 018 | archive_orphaned_pending_persons | Clean up orphaned persons |
| 018b | document_conversion | Add conversion tracking columns |
| 019 | migrate_ice_333_to_null | Migrate default ICE scores to null |
| 020 | document_associations | Create junction table |
| 020b | sprint_assignee_ids | Sprint assignee tracking |
| 021 | migrate_associations | Migrate existing data to junction table |
| 022 | sprint_project_associations | Finalize sprint/project associations |
| 023 | document_snapshots | Create snapshots table |
| 024 | renumber_collision_migrations | Fix numbering collision |
| 025 | prevent_circular_parent | Add circular parent prevention trigger |
| 026 | issue_iterations | Create issue iterations table |
| 027 | drop_legacy_association_columns | Drop sprint_id and project_id columns |
| 028 | backfill_program_associations | Backfill program associations |
| 029 | drop_program_id_column | Drop program_id (idempotent, self-healing) |
| 030 | deprecate_goal_to_hypothesis | Rename goal → hypothesis |
| 031 | cleanup_accountability_issues | Remove system-generated issues |
| 032 | rename_hypothesis_to_plan | Rename hypothesis → plan |
| 033 | sprint_to_week_rename | Rename sprint references |
| 034 | backfill_past_weekly_docs_submitted | Backfill submitted_at timestamps |
| 035 | add_comments | Create comments table |
| 036 | fix_audit_and_comments_fks | Fix foreign key constraints |
| 037 | week_dashboard_model | Week dashboard model |
| 039 | agent_actions | Create FleetGraph agent_actions table |

### Migration System

- Located in `api/src/db/migrations/`
- Named: `NNN_description.sql`
- Tracked in `schema_migrations` table
- Each runs in a transaction (auto-rollback on failure)
- Auto-runs on deploy via `api/src/db/migrate.ts`
- `schema.sql` for initial setup only — never modify for existing tables

---

## 8. API Backend

### Express App Configuration (`api/src/app.ts`)

**Middleware Stack (in order):**
1. **Helmet** — CSP, HSTS, X-Frame-Options
2. **CORS** — Origin: `http://localhost:5173` (configurable)
3. **Express Session** — 15-minute timeout
4. **CSRF** — Synchronous token validation (skipped for Bearer tokens)
5. **Rate Limiting**:
   - Login: 5 failed attempts / 15 minutes
   - General API: 100 req/min (prod), 1000 (dev), 10000 (test)
6. **Body Parser** — 10MB limit

### Route Modules (22 total)

#### Authentication (`/api/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Email/password login → session cookie |
| POST | /api/auth/logout | Clear session |
| POST | /api/auth/validate-session | Check current session |
| POST | /api/auth/caia | PIV/FPKI OAuth2 callback |
| POST | /api/auth/piv | Alias for /caia |

#### Documents (`/api/documents`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/documents | List documents (filter: type, parent_id) |
| POST | /api/documents | Create document (any type) |
| GET | /api/documents/:id | Get single document |
| PUT | /api/documents/:id | Update document |
| DELETE | /api/documents/:id | Soft delete (sets deleted_at) |
| POST | /api/documents/:id/archive | Archive document |
| POST | /api/documents/:id/unarchive | Unarchive document |
| POST | /api/documents/:id/convert | Convert to different type |
| GET | /api/documents/:id/history | Get change history |
| GET | /api/documents/:id/backlinks | Get documents linking to this one |
| POST | /api/documents/:id/backlinks | Update backlinks |
| GET | /api/documents/:id/associations | Get associations |
| POST | /api/documents/:id/associations | Create association |
| DELETE | /api/documents/:id/associations/:assocId | Remove association |
| GET | /api/documents/:id/comments | Get comments (threaded) |
| POST | /api/documents/:id/comments | Create comment |
| PATCH | /api/documents/:id/comments/:commentId | Update/resolve comment |
| DELETE | /api/documents/:id/comments/:commentId | Delete comment |

#### Issues (`/api/issues`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/issues | List issues (filter: state, priority, assignee, program, sprint, source) |
| POST | /api/issues | Create issue (auto ticket_number) |
| GET | /api/issues/:id | Get single issue |
| PUT | /api/issues/:id | Update issue (tracks state transitions) |
| POST | /api/issues/:id/reject | Reject issue with reason |
| POST | /api/issues/:id/iterations | Log work iteration |
| GET | /api/issues/:id/iterations | Get iterations |

**Issue State Transitions**: When state changes, timestamps are auto-set:
- → `in_progress`: sets `started_at` (first time) or `reopened_at`
- → `done`: sets `completed_at`
- → `cancelled`: sets `cancelled_at`

#### Programs (`/api/programs`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/programs | List programs (with issue/sprint counts) |
| POST | /api/programs | Create program |
| GET | /api/programs/:id | Get single program |
| PUT | /api/programs/:id | Update program |
| DELETE | /api/programs/:id | Archive program |

#### Projects (`/api/projects`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/projects | List projects (with ICE scores, inferred status) |
| POST | /api/projects | Create project |
| GET | /api/projects/:id | Get single project |
| PUT | /api/projects/:id | Update project |
| POST | /api/projects/:id/retros | Create retro document |
| GET | /api/projects/:id/retros | Get retro documents |
| POST | /api/projects/:id/approve-retro | Approve retro |
| GET | /api/projects/:id/sprints | Get associated sprints |

#### Weeks/Sprints (`/api/weeks`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/weeks | List weeks (filter: sprint_number, project_id) |
| POST | /api/weeks | Create week |
| GET | /api/weeks/:id | Get single week |
| PUT | /api/weeks/:id | Update week |
| POST | /api/weeks/:id/approve-plan | Approve plan |
| POST | /api/weeks/:id/reject-plan | Reject plan with comment |
| POST | /api/weeks/:id/approve-retro | Approve retro |
| POST | /api/weeks/:id/reject-retro | Reject retro with comment |
| POST | /api/weeks/:id/iterations | Log sprint iteration |
| GET | /api/weeks/lookup-person | Find person document by user_id |

#### Weekly Plans (`/api/weekly-plans`)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/weekly-plans | Create plan (idempotent) |
| GET | /api/weekly-plans | Get plan (filter: week_number, person_id) |
| PUT | /api/weekly-plans/:id | Update plan |
| POST | /api/weekly-plans/:id/approve | Approve plan |
| POST | /api/weekly-retros | Create retro |
| GET | /api/weekly-retros | Get retro |

#### Standups (`/api/standups`)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/standups | Create standup (idempotent per user+date) |
| GET | /api/standups?date=... | Get standups for date |

#### Team (`/api/team`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/team/grid | Team heatmap data (allocations, plan/retro status) |
| GET | /api/team/members | All team members (person documents) |

#### Workspaces (`/api/workspaces`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/workspaces | User's workspaces |
| PUT | /api/workspaces/:id | Update workspace |
| POST | /api/workspaces/:id/switch | Switch active workspace |

#### Admin (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/workspaces | All workspaces (super-admin) |
| POST | /api/admin/workspaces | Create workspace |
| GET | /api/admin/workspaces/:id/members | Workspace members |
| POST | /api/admin/workspaces/:id/members | Add member |
| DELETE | /api/admin/workspaces/:id/members/:userId | Remove member |
| POST | /api/admin/users | Create user (super-admin) |
| GET | /api/admin/users | List users (super-admin) |
| PUT | /api/admin/users/:id | Update user (super-admin) |
| POST | /api/admin/credentials | Manage OAuth credentials |

#### Other Routes

| Route | Description |
|-------|-------------|
| GET /api/invites/:token | Validate invite token (public) |
| POST /api/invites/:token/accept | Accept invite (create/link user) |
| POST /api/api-tokens | Create API token (returns plaintext once) |
| GET /api/api-tokens | List active tokens |
| DELETE /api/api-tokens/:id | Revoke token |
| GET /api/search/mentions?q=... | Search people + documents |
| GET /api/search/wiki?q=... | Search wiki documents |
| GET /api/search/documents?q=... | Search all documents |
| POST /api/files/upload-request | Get presigned S3 upload URL |
| GET /api/files/:id | File metadata |
| DELETE /api/files/:id | Delete file |
| GET /api/files/:id/download | Presigned download URL |
| GET /api/activity/:entityType/:entityId | 30-day activity counts |
| GET /api/dashboard/my-work | User's work items by urgency |
| GET /api/accountability/action-items | Inferred accountability items |
| GET /api/ai/status | AI availability check |
| POST /api/ai/analyze-plan | AI plan quality analysis |
| POST /api/ai/analyze-retro | AI retro quality analysis |
| POST /api/agent/suggestions | Create agent suggestion |
| GET /api/agent/suggestions | List suggestions |
| GET /api/agent/suggestions/:id | Get suggestion |
| PATCH /api/agent/suggestions/:id | Update suggestion status |
| POST /api/agent/on-demand | Proxy to FleetGraph agent (SSE) |
| GET /health | Health check |
| GET /api/csrf-token | Get CSRF token |

### Services (`api/src/services/`)

| Service | Functions |
|---------|-----------|
| **audit.ts** | `logAuditEvent(input)` — inserts audit log |
| **ai-analysis.ts** | `isAiAvailable()`, `checkRateLimit(userId)` (120 req/hr), `analyzePlan(content)` → falsifiability/workload, `analyzeRetro(retro, plan)` → coverage/evidence |
| **accountability.ts** | `checkMissingAccountability(userId, workspaceId)` → array of missing items (standup, weekly_plan, weekly_retro, etc.) |
| **invite-acceptance.ts** | `linkUserToWorkspaceViaInvite(userId, token)` — creates membership + person doc |
| **oauth-state.ts** | `createOAuthState()`, `validateOAuthState(state)` |
| **caia.ts** | `initializeCAIA()`, `handlePIVCallback(code, state)` — FPKI auth |
| **secrets-manager.ts** | `loadProductionSecrets()` — AWS SSM Parameter Store |

### Utilities (`api/src/utils/`)

| Utility | Functions |
|---------|-----------|
| **document-crud.ts** | `logDocumentChange()`, `getTimestampUpdates()`, `getBelongsToAssociations()`, `getBelongsToAssociationsBatch()`, TRACKED_FIELDS |
| **business-days.ts** | `isBusinessDay()`, `getNextBusinessDay()`, `daysUntilDue()` |
| **document-content.ts** | `extractText(tipTapNode)`, `hasContent(tipTapContent)`, TEMPLATE_HEADINGS |
| **extractHypothesis.ts** | `extractHypothesisFromContent()`, `extractSuccessCriteriaFromContent()`, `extractVisionFromContent()`, `extractGoalsFromContent()`, `checkDocumentCompleteness()` |
| **transformIssueLinks.ts** | `transformIssueLinks(content)`, `extractTicketNumbersFromContents()`, `batchLookupIssues()` |
| **yjsConverter.ts** | `yjsToJson()`, `jsonToYjs()`, `loadContentFromYjsState()` |
| **allocation.ts** | `getAllocations(workspaceId, personId, userId, sprintNumber)` |

### Middleware (`api/src/middleware/`)

| Middleware | Purpose |
|-----------|---------|
| **authMiddleware** | Validates Bearer token OR session cookie, attaches userId/workspaceId to request |
| **superAdminMiddleware** | Requires `req.isSuperAdmin` |
| **workspaceAdminMiddleware** | Requires `req.isWorkspaceAdmin` |
| **VISIBILITY_FILTER_SQL** | SQL fragment: shows workspace docs + user's private docs + admin bypass |

### OpenAPI Documentation (`api/src/openapi/`)

- Zod schema registry auto-generates OpenAPI 3.1.0 spec
- 20 schema files cover all endpoints
- `GET /api/openapi.json` and `GET /api/openapi.yaml` serve the spec
- Swagger UI available at `/api/docs`
- MCP tools auto-generated from OpenAPI spec

---

## 9. WebSocket Collaboration System

### Architecture (`api/src/collaboration/index.ts`)

**Connection Path**: `/collaboration/{docType}:{docId}`

**Protocols**: Yjs sync protocol (y-protocols)

### Message Types

| Type | Value | Purpose |
|------|-------|---------|
| messageSync | 0 | Yjs document synchronization |
| messageAwareness | 1 | Presence/cursor tracking |
| messageCustomEvent | 2 | Custom notifications |
| messageClearCache | 3 | Clear IndexedDB before sync |

### Rate Limiting

- **Connection**: 30 connections/min per IP
- **Message**: 50 messages/sec per connection
- **DDoS protection**: Close after 50 violations

### Document Persistence

1. Debounced (2 seconds) persistence on every change
2. Encodes Yjs state to binary
3. Converts Yjs to TipTap JSON
4. Extracts structured data (hypothesis, success_criteria, vision, goals)
5. Updates database: `yjs_state`, `content`, `properties`, `title`
6. Logs content history for weekly plans/retros (minimum 1x/min)

### Awareness (Presence)

Tracks per-document:
- Active editors (client ID, user ID, workspace ID)
- Cursor position and selection
- Shared via Yjs awareness protocol

### Broadcast Functions

- `broadcastToUser(userId, event, data)` — all user's connections
- `broadcastToWorkspace(workspaceId, event, data)` — all workspace connections
- Events: `document:updated`, `document:deleted`, `accountability:updated`

---

## 10. Frontend

### Tech Stack

- React 18 with TypeScript
- Vite (dev server + build)
- TanStack React Query v5 (server state)
- TipTap (rich text editor with Yjs CRDT collaboration)
- Tailwind CSS (styling)
- React Router v6 (navigation)
- IndexedDB (query cache persistence)

### Route Structure

**Public Routes:**
- `/login` — Login page
- `/setup` — First-time workspace setup
- `/invite/:token` — Accept workspace invitation
- `/feedback/:programId` — Public feedback submission

**Protected Routes:**
- `/my-week` — Personal accountability (default route, `/` redirects here)
- `/dashboard` — Dashboard with standup cards, action items
- `/docs` — Wiki document tree
- `/documents/:id/*` — Unified document editor (handles all types via tabs)
- `/issues` — Issues list (list/kanban modes)
- `/projects` — Projects list
- `/programs` — Programs list
- `/team/allocation` — Sprint allocation grid
- `/team/directory` — Team member directory
- `/team/status` — Team status heatmap
- `/team/reviews` — Weekly review approval queue
- `/team/org-chart` — Organization chart
- `/team/:id` — Person profile editor
- `/settings` — Workspace settings
- `/settings/conversions` — Document conversion history

**Legacy Redirects:**
- `/docs/:id` → `/documents/:id`
- `/issues/:id` → `/documents/:id`
- `/projects/:id` → `/documents/:id`
- `/programs/:id/*` → `/documents/:id/*`
- `/sprints/:id/*` → `/documents/:id/*`

**Admin Routes:**
- `/admin` — Super admin dashboard
- `/admin/workspaces/:id` — Workspace management

### Provider Architecture (Nesting Order)

```
PersistQueryClientProvider (TanStack Query + IndexedDB)
  └── ToastProvider
        └── BrowserRouter
              └── ReviewQueueProvider
                    └── WorkspaceProvider
                          └── AuthProvider
                                └── RealtimeEventsProvider
                                      └── CurrentDocumentProvider
                                            └── ArchivedPersonsProvider
                                                  └── DocumentsProvider
                                                        └── ProgramsProvider
                                                              └── ProjectsProvider
                                                                    └── IssuesProvider
                                                                          └── UploadProvider
```

### 4-Panel Editor Layout

```
┌──────────┬────────────┬──────────────────────┬──────────────┐
│ Icon     │ Context    │                      │ Properties   │
│ Rail     │ Sidebar    │   Main Content       │ Sidebar      │
│ (48px)   │ (224px)    │   (flex-1)           │ (256px)      │
│          │            │                      │              │
│ Mode     │ Mode's     │   TipTap Editor      │ Doc-type     │
│ icons    │ item list  │   or Tab content     │ specific     │
│          │            │                      │ properties   │
└──────────┴────────────┴──────────────────────┴──────────────┘
```

### Document Type Tab Configurations

| Type | Tabs |
|------|------|
| **project** | Details, Issues, Weeks, Retro |
| **program** | Overview, Issues, Projects, Weeks |
| **sprint** (week) | Overview, Planning, Issues, Review, Standups |
| **issue** | (no tabs, single editor) |
| **wiki** | (no tabs, single editor) |
| **weekly_plan** | (no tabs, editor + quality banner) |
| **weekly_retro** | (no tabs, editor + quality banner) |

### Core Components

#### Editor System

| Component | Purpose |
|-----------|---------|
| `Editor.tsx` | TipTap rich text editor with collaboration |
| `UnifiedEditor.tsx` | Unified wrapper for all document types |
| `DragHandle.ts` | Block drag handles |
| `MentionExtension.ts` | @mention team members |
| `ImageUpload.ts` | Image insertion with CDN |
| `FileAttachment.ts` | File attachment system |
| `DetailsExtension.ts` | Collapsible/toggle blocks |
| `EmojiExtension.ts` | Emoji picker |
| `TableOfContents.ts` | Auto-generated outline |
| `HypothesisBlockExtension.ts` | Theory/evidence structure blocks |
| `CommentMark.ts` | Inline comment annotations |
| `PlanReferenceBlock.ts` | Hierarchical plan linking |

#### Properties Panels (Right Sidebar)

| Component | For Type |
|-----------|----------|
| `WikiSidebar.tsx` | Wiki (visibility, maintainer, backlinks) |
| `IssueSidebar.tsx` | Issue (state, priority, estimate, assignee, sprint) |
| `ProjectSidebar.tsx` | Project (ICE, color, emoji, owner, RACI) |
| `WeekSidebar.tsx` | Week (status, owner, approval) |
| `ProgramSidebar.tsx` | Program (color, owner, RACI) |
| `DocumentTypeSelector.tsx` | Document type conversion UI |
| `QualityAssistant.tsx` | Plan/retro approval likelihood |

#### Dashboard Components

| Component | Purpose |
|-----------|---------|
| `DashboardVariantC.tsx` | Main dashboard layout |
| `AccountabilityBanner.tsx` | Task completion celebration |
| `AccountabilityGrid.tsx` | Accountability status grid |
| `ActionItems.tsx` | Action items list |
| `ActionItemsModal.tsx` | Action items queue |
| `StandupFeed.tsx` | Daily standup entries |
| `StatusOverviewHeatmap.tsx` | Team status heatmap |
| `PlanQualityBanner.tsx` | Plan/retro quality indicator |

#### Agent Components

| Component | Purpose |
|-----------|---------|
| `AgentChatPanel.tsx` | FleetGraph on-demand chat overlay |
| `AgentSuggestionsPanel.tsx` | Pending AI suggestions queue |
| `AgentBriefing.tsx` | Agent context briefing display |

#### Command Palette

`CommandPalette.tsx` — Cmd+K search/create/convert interface

### Custom Hooks (40+)

#### Data Query Hooks (TanStack Query)

| Hook | Purpose |
|------|---------|
| `useDocumentsQuery()` | Fetch wiki documents |
| `useIssuesQuery()` | Fetch issues with cascade warnings |
| `useProgramsQuery()` | Fetch programs |
| `useProjectsQuery()` | Fetch projects |
| `useWeeksQuery()` | Fetch sprints/weeks |
| `useTeamMembersQuery()` | Fetch team members |
| `useStandupStatusQuery()` | Check standup due status |
| `useActionItemsQuery()` | Fetch accountability items |
| `useDashboardActionItems()` | Dashboard-specific items |
| `useMyWeekQuery()` | Personal week view data |
| `useCommentsQuery()` | Document comments |
| `useContentHistoryQuery()` | Document version history |
| `useDocumentContextQuery()` | Document with breadcrumbs |
| `useDashboardFocus()` | Dashboard focus areas |
| `useUnifiedDocuments()` | Cross-type document fetching |

#### State/UI Hooks

| Hook | Purpose |
|------|---------|
| `useAuth()` | Auth state + login/logout |
| `useSelection()` | Multi-select state for lists |
| `useListFilters()` | List view/sort/filter state |
| `useColumnVisibility()` | Column visibility toggles |
| `useAutoSave()` | Throttled auto-save |
| `useSessionTimeout()` | Session timeout countdown |
| `useDocumentConversion()` | Type conversion logic |
| `useFocusOnNavigate()` | Focus management on route change |
| `useGlobalListNavigation()` | Keyboard navigation for lists |
| `useWeeklyReviewActions()` | Review approval tracking |

#### Agent Hooks

| Hook | Purpose |
|------|---------|
| `useAgentChat()` | On-demand chat state + SSE streaming |
| `useAgentSuggestions()` | Suggestions queue state |

### Libraries (`web/src/lib/`)

| File | Purpose |
|------|---------|
| `api.ts` | HTTP client (apiGet, apiPost, apiPatch, apiDelete) with CSRF + session handling |
| `queryClient.ts` | TanStack Query config with IndexedDB persistence (v2 schema, 5-min stale, 24-hour GC) |
| `cn.ts` | Tailwind merge + WCAG AA contrast text color |
| `date-utils.ts` | Relative time formatting |
| `documentTree.ts` | Flat → hierarchical tree builder |
| `accountability.ts` | Accountability type labels + weekly doc helpers |
| `statusColors.ts` | Issue state/priority → color mapping |
| `contextMenuActions.ts` | Per-document-type context menu definitions |
| `document-tabs.ts` | Tab registry per document type |

### Upload System (`web/src/services/`)

- `uploadFile()` — Presigned S3 URL upload with progress callback
- `uploadTracker.ts` — Global upload state for navigation warnings
- File size limit: 1GB
- Executable extensions blocked

### Styling

**Tailwind Theme:**
```
background: #0d0d0d (dark)
foreground: #f5f5f5 (light text)
muted: #8a8a8a (5.1:1 contrast)
border: #262626
accent: #2563eb (blue-600)
accent-hover: #3b82f6 (blue-500)
accent-foreground: #60a5fa (blue-400)
Font: Inter (with system fallback)
```

### Build Configuration (Vite)

- Path alias: `@` → `./src`
- Proxy: `/api` → API server, `/collaboration` → WebSocket, `/events` → WebSocket
- Manual chunks: vendor-react, vendor-tiptap, vendor-query, vendor-dnd
- All pages lazy-loaded via React.lazy()
- PWA manifest with app shortcuts (Issues, Projects, Documents)

---

## 11. FleetGraph Agent

### Overview

FleetGraph is a **separate process** that monitors project health using a LangGraph state machine and Google Gemini AI. It:
1. Listens for issue events via WebSocket
2. Runs scheduled health checks
3. Responds to on-demand chat queries
4. Detects violations (overloads, stale issues)
5. Generates actionable suggestions
6. Persists suggestions to `agent_actions` table

### Architecture Rules

1. **Separate process** — never imports from `api/src/` directly
2. **All Ship data via REST API** — never queries DB directly
3. **One graph, two modes** — proactive and on-demand use same StateGraph
4. **Gemini Reasoner always runs** — every execution includes AI reasoning
5. **Nodes never throw uncaught** — errors written to `state.errors`
6. **Fetch nodes parallel** — LangGraph fan-out
7. **Suggestions from violations, not Gemini text** — deterministic action mapping

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| AGENT_PORT | 3001 | HTTP server port |
| SHIP_API_URL | http://localhost:3000 | Ship API base |
| SHIP_WS_URL | ws://localhost:3000 | Ship WebSocket base |
| AGENT_SERVICE_TOKEN | (dev token) | Bearer token for auth |
| GOOGLE_AI_API_KEY | (required) | Gemini API key |
| WORKSPACE_ID | (required) | Target workspace |
| LANGCHAIN_PROJECT | default | LangSmith project |
| LANGCHAIN_TRACING_V2 | (optional) | Enable tracing |
| LANGCHAIN_API_KEY | (optional) | LangSmith API key |

### Graph State (`agent/src/graph/state.ts`)

```typescript
FleetGraphState {
  // Trigger
  trigger_type: 'event' | 'scheduled' | 'on_demand';
  trigger_payload: EventPayload | SchedulePayload | OnDemandPayload | null;

  // User context
  target_user_id: string;
  user_role: 'director' | 'pm' | 'engineer';

  // Fetched data
  project_data: ProjectSnapshot | null;   // { project, issues[] }
  person_data: PersonSnapshot | null;     // { person_id, person_name, issues[] }
  program_data: ProgramSnapshot | null;   // { program_id, program_name, projects[] }
  retro_data: RetroSnapshot | null;       // { week_id, completed_issues[], carryover_issues[] }
  history_data: AgentActionHistory | null; // { actions[] }

  // Reasoning
  violations: Violation[];
  gemini_output: GeminiReasonerOutput | null;

  // Actions
  suggestions: PendingSuggestion[];
  drafts: DraftContent[];
  notifications: Notification[];

  // On-demand
  conversation_history: Message[];
  user_question: string | null;
  current_view_context: ViewContext | null;

  // Meta
  run_id: string;
  errors: GraphError[];
}
```

### Graph Topology (10 Nodes)

```
__start__
  → triggerContext        (extracts trigger metadata)
  → userContext           (resolves user role)
  → [CONDITIONAL FAN-OUT]
      → projectFetch     ┐
      → personFetch      │ (parallel, error-safe)
      → programFetch     │
      → historyFetch     │
      → retroFetch       ┘
  → [CONDITIONAL FAN-IN]
  → thresholdEvaluator   (deterministic violation checks)
  → geminiReasoner       (AI reasoning, ALWAYS runs)
  → [CONDITIONAL ROUTING]
      → suggestionGenerator  (if violations exist)
      → OR skip to notificationSender
  → notificationSender   (persists to DB, broadcasts via WebSocket)
  → END
```

### Conditional Edge Logic

**Fan-out (which fetches run):**
- On-demand + coach → personFetch, historyFetch
- On-demand + scan-all → projectFetch, personFetch, programFetch
- On-demand + other → projectFetch, personFetch
- Scheduled → projectFetch, personFetch, programFetch
- Event → projectFetch, personFetch

**Post-fetch routing:**
- On-demand + non-command → skip thresholdEvaluator, go to geminiReasoner
- Otherwise → thresholdEvaluator

**Post-Gemini routing:**
- On-demand + non-command → notificationSender (pure chat, no suggestions)
- Violations exist → suggestionGenerator
- No violations → notificationSender (clean summary)

### Node Details

#### triggerContext
Extracts `user_question`, `current_view_context` from on-demand payload, or `target_user_id` from event payload.

#### userContext
Sets `user_role` (defaults to 'engineer').

#### projectFetch
Parallel: `shipClient.getProject()` + `shipClient.getProjectIssues()`. Returns `ProjectSnapshot`.

#### personFetch
Fetches: `shipClient.getPersonIssues(assigneeId)`. Returns `PersonSnapshot`.

#### programFetch
Fetches all programs, then parallel-fetches projects per program. Returns `ProgramSnapshot`.

#### historyFetch
Fetches: `shipClient.getAgentActions(userId)`. Returns `AgentActionHistory`.

#### retroFetch
Filters project issues into completed vs carryover. Returns `RetroSnapshot`.

#### thresholdEvaluator
Deterministic checks against configurable thresholds:

| Threshold | Default | Violation Type |
|-----------|---------|---------------|
| High priority per project | 7 | `priority_overload` |
| Medium priority per project | 10 | `priority_overload` |
| In-progress per project | 5 | `in_progress_overload` |
| High priority per person | 2 | `person_overload` |
| Medium priority per person | 3 | `person_overload` |
| Stale days (high) | 2 | `stale_issue` |
| Stale days (medium) | 5 | `stale_issue` |
| Stale days (low) | 30 | `stale_issue` |

**Severity Calculation:**
- `priority_overload`: base 6 × (count - threshold)
- `in_progress_overload`: base 5 × (count - threshold)
- `person_overload`: base 7 × (count - threshold)
- `stale_issue`: base 8 × ceil(days - threshold)

#### geminiReasoner (8 Modes)

| Mode | When | Prompt |
|------|------|--------|
| PROACTIVE_CLEAN | Event/scheduled, no violations | Health summary in 2-3 sentences |
| PROACTIVE_VIOLATIONS | Event/scheduled, violations exist | Per-violation analysis with root cause, risk, action |
| ON_DEMAND | On-demand, non-command | Answer user's question from data |
| DIRECTOR_OVERVIEW | Scheduled, has program_data | Portfolio risk ranking, systemic patterns |
| COACH | On-demand, "coach/pattern/trend" | Work pattern analysis, trends, recommendations |
| LOAD_BALANCER | On-demand, "load/balance/reassign" | Workload comparison, specific reassignments |
| PROJECT_KICKOFF | On-demand, "kickoff/new project" | Cluster analysis for new project suggestions |
| RETRO_DRAFT | Scheduled, has retro_data | Structured retro from quantitative data |

**Context cap**: 100k characters max.
**Fallback**: On Gemini error, returns structured templated violations.
**System preamble**: Constrains Gemini to project management only; prevents code generation, creative writing, off-topic responses.

#### suggestionGenerator

Maps violations to concrete actions **deterministically** (Rule 7 — Gemini provides reasoning text, not the action itself):

| Violation | Action | Logic |
|-----------|--------|-------|
| `priority_overload` | `priority_change` | Demote least-critical issue (heuristic scoring) |
| `in_progress_overload` | `status_change` | Move least-critical to todo |
| `person_overload` | `priority_change` | Demote for overloaded person |
| `stale_issue` (in_progress) | `status_change` | Move to todo |
| `stale_issue` (other) | `priority_change` | Bump to urgent |

**Issue Selection Heuristic (`pickLeastCriticalIssue`):**
- Low priority keywords (score -10): dashboard, report, audit, test, analytics, monitor, log, metric, documentation, cleanup
- High priority keywords (score +10): critical, security, auth, payment, fraud, fix, bug, block, crash, data loss

#### notificationSender
- Persists each suggestion via `shipClient.createAgentAction()`
- Broadcasts via `shipClient.notifyUser()` (WebSocket, best-effort)
- Attaches `langsmith_trace_id = run_id`

### Workers

#### EventListener (`agent/src/worker/event-listener.ts`)
- Connects to Ship's `/events?token=xxx` WebSocket
- Listens for `issue:created` and `issue:updated` events
- 30-second per-project debounce (prevents graph spam)
- Auto-reconnect on close (5s backoff)
- Triggers graph with `trigger_type: 'event'`

#### Scheduler (`agent/src/worker/scheduler.ts`)
- **Morning Briefing** (hourly check, fires at 07:00 UTC): Fetches all issues, groups by assignee, creates briefing per user
- **Staleness Cron** (hourly): Checks all non-done issues for staleness, triggers graph per project

#### SuggestionLifecycle (`agent/src/worker/suggestion-lifecycle.ts`)
- Expires snoozed suggestions past `snooze_until`
- Dismisses pending suggestions older than 7 days
- Deduplication check before creating new suggestions

### API Endpoints

#### POST `/api/agent/on-demand` (SSE Streaming)

**Request:** `{ question: string, context?: ViewContext }`

**SSE Event Types:**
- `{ type: 'token', content: string }` — streaming Gemini tokens
- `{ type: 'violations', count, violations }` — violation list
- `{ type: 'suggestions', count, suggestions }` — action cards
- `{ type: 'done', mode? }` — end of stream
- `{ type: 'error', content }` — error

**Logic:**
1. Off-topic detection → 400
2. Command pattern match → full graph execution
3. Pure chat → direct Gemini streaming with optional project context

#### Suggestions CRUD (via Ship API proxy)
- `POST /api/agent/suggestions` — create
- `GET /api/agent/suggestions` — list (filter: status, user_id)
- `GET /api/agent/suggestions/:id` — get
- `PATCH /api/agent/suggestions/:id` — update (approve/dismiss/snooze)

### ShipClient (`agent/src/lib/ship-client.ts`)

**Fetch:** `getProjectIssues()`, `getPersonIssues()`, `getProject()`, `getProgramProjects()`, `getPrograms()`, `getAllIssues()`

**Mutate:** `updateIssue()`, `createAgentAction()`, `updateAgentAction()`, `notifyUser()`

**Error Handling:** 5xx → retry with exponential backoff (3 attempts), 4xx → throw immediately

### GeminiClient (`agent/src/lib/gemini-client.ts`)

- Model: `gemini-2.5-flash`
- `reason(systemPrompt, context)` — single response
- `reasonStreaming(systemPrompt, context)` — AsyncGenerator for SSE

### Dependencies

```
@langchain/core: ^0.3.0
@langchain/langgraph: ^0.2.0
@google/generative-ai: ^0.21.0
langsmith: ^0.3.0
express: ^4.21.2
cors: ^2.8.5
ws: ^8.18.0
uuid: ^11.0.3
dotenv: ^16.4.7
```

---

## 12. Authentication & Security

### Authentication Methods

#### 1. Session Cookie Auth (Primary for Web)
- Login: `POST /api/auth/login` → `{ email, password }`
- Session ID: 64-char hex string (not UUID)
- Cookie: `session_id`, HTTPOnly, Secure (prod), SameSite=Strict
- Inactivity timeout: 15 minutes (NIST SP 800-63B-4)
- Absolute timeout: 12 hours
- IP + User-Agent binding
- Auto-refresh on valid request

#### 2. PIV/CAC Auth (Government Smart Cards)
- OAuth2 flow via CAIA/FPKI validator
- PKCE (Proof Key for Code Exchange) with code_verifier
- x509_subject_dn from certificate
- Creates user on first login if invited
- No password required

#### 3. API Token Auth (CLI/Automation)
- `POST /api/api-tokens` → returns plaintext token (shown once)
- Storage: SHA-256 hash only (plaintext never stored)
- Identification: first 8 chars as prefix
- Optional expiration
- Revocation support
- Header: `Authorization: Bearer <token>`

### CSRF Protection
- Synchronous token validation
- Skipped for Bearer token auth
- Applied to all state-changing endpoints

### Rate Limiting
- Login: 5 failed attempts / 15 minutes per IP
- API: 100 req/min (prod), 1000 (dev)
- WebSocket: 50 msgs/sec + 30 conns/min per IP
- AI analysis: 120 req/hr per user

### Password Security
- bcrypt hashing (10 rounds)
- No plaintext storage

### Visibility Model
- **workspace**: All workspace members can see
- **private**: Only creator can see (admin bypass)
- Enforced in SQL via `VISIBILITY_FILTER_SQL` fragment

### Audit Logging
- All auth events (login, logout, failed attempts)
- All data changes via `document_history`
- IP + User-Agent tracking
- Super-admin impersonation tracking

---

## 13. Infrastructure & Deployment

### Docker

**4 Dockerfiles:**
- `Dockerfile` — Production (ECR public base, runs migrations, port 80)
- `Dockerfile.dev` — API development (auto-migrate, auto-seed)
- `Dockerfile.web` — Web development (Vite dev server)
- `Dockerfile.agent` — FleetGraph agent

**docker-compose.yml** — PostgreSQL 16 only (port 5432)
**docker-compose.local.yml** — Full stack: Postgres (5433) + API (3000) + Web (5173) + Agent (3001)

### AWS Infrastructure (Terraform)

| Service | Purpose |
|---------|---------|
| **Elastic Beanstalk** | API Docker container |
| **Aurora Serverless v2** | PostgreSQL database |
| **S3** | Frontend static files + file attachments |
| **CloudFront** | CDN for frontend + file serving |
| **SSM Parameter Store** | Secrets management |
| **WAF** | Web application firewall |
| **VPC** | Network isolation |

### Terraform Modules

```
terraform/
├── modules/
│   ├── aurora/           # Aurora Serverless v2 cluster
│   ├── cloudfront-s3/    # S3 + CloudFront distribution
│   ├── elastic-beanstalk/ # EB environment
│   ├── security-groups/  # Network security
│   ├── ssm/              # Parameter Store secrets
│   └── vpc/              # VPC + subnets
├── environments/
│   ├── prod/             # Production config
│   ├── dev/              # Development config
│   └── shadow/           # UAT/shadow config
├── database.tf
├── elastic-beanstalk.tf
├── s3-cloudfront.tf
├── security-groups.tf
├── ssm.tf
├── vpc.tf
├── waf.tf
└── variables.tf
```

### Deployment Scripts

```bash
./scripts/deploy.sh prod           # Backend → Elastic Beanstalk
./scripts/deploy-frontend.sh prod  # Frontend → S3/CloudFront
```

### Dev Server (`scripts/dev.sh`)

1. Creates `api/.env.local` with DATABASE_URL if missing
2. Creates database (e.g., `ship_auth_jan_6`) if it doesn't exist
3. Runs migrations and seeds on fresh databases
4. Finds available ports (API: 3000+, Web: 5173+) for multi-worktree dev
5. Writes `.ports` file for reference
6. Starts both servers in parallel

### Health Checks

- API: `GET /health` → `{ status: 'ok' }`
- Agent: `GET /health` → `{ status: 'ok', service: 'fleetgraph-agent' }`

---

## 14. E2E Testing

### Configuration

- **Framework**: Playwright (Chromium only)
- **Isolation**: Per-worker PostgreSQL + API + preview server
- **Memory**: ~500MB per worker, 4 workers default
- **Retries**: 1 locally, 2 in CI
- **Timeout**: 60 seconds
- **Global setup**: Builds API + Web once before all workers

### Test Fixtures (`e2e/fixtures/`)

- `isolated-env.ts` — Creates isolated database + server per worker
- `test-helpers.ts` — Common test utilities
- `dev-server.ts` — Dev server management

### Test Files (70+ spec files)

| Category | Files |
|----------|-------|
| **Auth** | auth, authorization, session-timeout, security |
| **Documents** | documents, document-workflows, document-isolation, private-documents |
| **Issues** | issues, issues-bulk-operations, issue-display-id, issue-estimates |
| **Projects** | projects, project-weeks |
| **Programs** | programs, program-mode-week-ux |
| **Team** | team-mode, admin-workspace-members |
| **Accountability** | accountability-standup, accountability-week, weekly-accountability |
| **Editor** | inline-code, inline-comments, mentions, emoji, tables, syntax-highlighting |
| **UI** | drag-handle, bulk-selection, context-menus, tooltips, icons |
| **Performance** | performance, content-caching, autosave-race-conditions |
| **Accessibility** | accessibility, accessibility-remediation, check-aria, status-colors-accessibility |
| **AI/Agent** | ai-analysis-api |
| **Other** | backlinks, search-api, file-attachments, error-handling, edge-cases |

---

## 15. MCP Server & AI Integration

### MCP Server (`api/src/mcp/server.ts`)

- Auto-generates MCP tools from OpenAPI spec
- Each API endpoint becomes an MCP tool
- Authentication via `SHIP_API_TOKEN` environment variable
- Enables Claude Code to interact with Ship's API directly

### AI Analysis (AWS Bedrock)

- **Model**: Claude (via AWS Bedrock)
- **Plan Analysis**: Returns falsifiability (high/medium/low), workload (realistic/aggressive/relaxed)
- **Retro Analysis**: Returns coverage (strong/partial/weak), has_evidence (boolean)
- **Rate Limit**: 120 requests/hour per user

### FleetGraph (Google Gemini)

- **Model**: Gemini 2.5 Flash
- **8 reasoning modes**: Proactive clean/violations, on-demand, director overview, coach, load balancer, project kickoff, retro draft
- **System preamble**: Constrains to project management topics only
- **Streaming**: SSE for real-time token delivery

---

## Appendix A: Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": {}
  }
}
```

## Appendix B: TipTap Content Structure

Default empty document:
```json
{
  "type": "doc",
  "content": [
    { "type": "paragraph" }
  ]
}
```

Supported block types: paragraph, heading (1-6), bulletList, orderedList, taskList, codeBlock (with language), blockquote, horizontalRule, table, image, details (toggle), hypothesisBlock, planReferenceBlock, mention, fileAttachment

## Appendix C: Week Number Calculation

Week numbers are derived from `workspace.sprint_start_date`:
```
weekNumber = floor((targetDate - sprintStartDate) / 7) + 1
```
Where `sprintStartDate` is always a Monday. All programs in a workspace share the same week cadence.

## Appendix D: Seed Data Structure

The seed creates:
- 1 workspace with `sprint_start_date` = 3 months ago (Monday-aligned)
- 1 admin user (dev@ship.local) + 10 team members
- Multiple programs, projects, sprints, issues
- Weekly plans and retros
- Document associations linking everything together

## Appendix E: Performance Optimizations

1. **50+ database indexes** for common query patterns
2. **GIN indexes** on JSONB properties column
3. **Auth caching**: `isWorkspaceAdmin` cached per request
4. **WebSocket debounce**: 2-second persistence debounce
5. **Query cache**: TanStack Query with IndexedDB persistence (5-min stale, 24-hour GC)
6. **Code splitting**: All pages lazy-loaded via React.lazy()
7. **Bundle chunks**: vendor-react, vendor-tiptap, vendor-query, vendor-dnd
8. **Optimistic mutations**: Instant UI feedback before server confirmation
9. **Batch queries**: Document association lookups
10. **Agent debounce**: 30-second per-project event debounce
