# Ship Constitution

## Core Principles

### I. Everything is a Document (Unified Document Model)
All content types (wiki, issue, project, sprint, person) are stored in a single `documents` table with a `document_type` discriminator and a flexible `properties` JSONB column. There are NO separate content tables. New features must work within this model. See `docs/unified-document-model.md`.

### II. Maximally Simple / Boring Technology
Use well-understood tools over cutting-edge. Express, React, PostgreSQL, direct SQL via Kysely. No ORM magic. No microservices. Single Express process handles REST + WebSocket. Avoid complexity until proven necessary (YAGNI).

### III. All Tests Must Pass After Every Change (NON-NEGOTIABLE)
Every commit must leave the test suite green. API tests (Vitest), web tests (Vitest), and E2E tests (Playwright) must all pass. Run tests with `--workers=1` to avoid collisions. No skipping tests, no `test.skip()` to hide breakage.

### IV. Server is Source of Truth
Offline-tolerant, not offline-first. Yjs CRDT handles collaborative editing. Properties sync via REST. Last-write-wins for conflicts. IndexedDB is a cache, not a primary store.

### V. Section 508 / WCAG 2.1 AA Compliance
Government deployment requires strict accessibility. Keyboard navigation for all interactions. Screen reader support. Color contrast ratios (4.5:1 text, 3:1 UI). shadcn/ui (Radix primitives) provides the a11y foundation.

## Architecture Constraints

- **Monorepo**: `api/`, `web/`, `shared/` in one repo with pnpm workspaces
- **Tech Stack**: Node.js, Express, React + Vite, PostgreSQL, Kysely, TipTap + Yjs, TanStack Query + Zustand, shadcn/ui, Tailwind, React Router v6
- **No new content tables**: Everything goes in `documents` + `properties` JSONB
- **No external APM/error tracking**: CloudWatch only (gov-compliant)
- **Database migrations**: Kysely migrations, always write `down`, test rollback
- **4-panel editor layout**: Documents use the standard editor layout pattern

## Quality Gates

- TypeScript strict mode enabled
- All API routes must have OpenAPI schemas
- E2E tests cover critical user flows
- Bundle size monitored (currently 2,139 KB / 589 KB gzipped)
- API P95 response times monitored
- No `.catch(() => {})` silent error swallowing

## Sequential Execution

Categories are executed ONE AT A TIME, in order (see WINDOWS_DEV.md for full details). Each category's workspace lives at `/home/mcint/ship2-catN`. After each category is complete, it is merged into the `working_version` branch. The next category starts from `working_version` so it builds on all prior fixes.

`master` stays untouched as the baseline for comparison.

Each branch must:
1. Stay within its audit category scope
2. Merge `working_version` before starting (except the first category)
3. Provide before/after measurements against its own baseline
4. Preserve all existing functionality (tests green before AND after changes)
5. Use default ports (API 3000, Postgres 5432) — only one instance runs at a time

**Version**: 1.1 | **Ratified**: 2026-03-10 | **Last Amended**: 2026-03-10
