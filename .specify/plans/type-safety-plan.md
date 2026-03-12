# Implementation Plan: Type Safety Improvements

**Branch**: `category_1` | **Date**: 2026-03-10 | **Spec**: `.specify/specs/type-safety.md`

## Summary

Eliminate 25% of type safety violations by replacing `any` types, `as` assertions, and non-null assertions with proper types in the highest-violation files. Focus on API route handlers first (where type errors cause runtime bugs), then shared types, then web components.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled)
**Primary Dependencies**: Express, Kysely, React, TanStack Query
**Storage**: PostgreSQL via Kysely (type-safe query builder)
**Testing**: Vitest (`pnpm test --workers=1`)
**Target Platform**: Node.js (API), Browser (Web)
**Project Type**: Monorepo (api/, web/, shared/)
**Constraints**: No runtime behavior changes. Types only. All 451 API tests must pass after every change.

## Constitution Check

- [x] No new content tables
- [x] No runtime behavior changes (types only)
- [x] All tests must pass after every change
- [x] YAGNI — only fix types that matter, don't over-abstract

## Phase 1: Shared Types Foundation

Establish proper types in `shared/` that route handlers and web components can reference.

### Files to modify (ordered by dependency):

1. **`shared/src/types/index.ts`** — Review existing shared types. Add any missing document/property interfaces that route handlers need.
2. **`shared/src/types/api.ts`** — Review API request/response types. Ensure route handlers can import typed request bodies.

### Verification:
- `pnpm build` succeeds across all packages
- No new `any` types introduced

## Phase 2: API Route Handlers (highest violation density)

Fix the 5 most violation-dense files, in order:

1. **`api/src/routes/weeks.ts`** (639 violations)
   - Replace `any` on request body/query params with typed interfaces
   - Replace `any` on Kysely query results with proper row types
   - Convert dangerous `as` assertions to type guards where data shape isn't guaranteed
   - **Verify**: `pnpm --filter api test --workers=1`

2. **`api/src/routes/projects.ts`** (443 violations)
   - Same approach: req/res types, query result types, assertion cleanup
   - **Verify**: tests pass

3. **`api/src/routes/team.ts`** (440 violations)
   - Same approach
   - **Verify**: tests pass

4. **`api/src/routes/documents.ts`** (374 violations)
   - Same approach
   - **Verify**: tests pass

5. **`api/src/routes/issues.ts`** (340 violations)
   - Same approach
   - **Verify**: tests pass

### Additional high-value API files:
6. **`api/src/routes/dashboard.ts`** — Dashboard aggregation queries use many `any` casts
7. **`api/src/routes/accountability.ts`** — 6.3% coverage, likely many untyped paths
8. **`api/src/routes/programs.ts`** — Program CRUD operations
9. **`api/src/routes/weekly-plans.ts`** — Weekly plan queries
10. **`api/src/services/ai-analysis.ts`** — AI response typing

## Phase 3: Middleware and Utilities

11. **`api/src/middleware/auth.ts`** — Type the `req.user`, `req.workspaceId` extensions on Express Request
12. **`api/src/utils/document-crud.ts`** — Shared document CRUD helpers, likely many `any` on Kysely results
13. **`api/src/utils/allocation.ts`** — 0% coverage, likely untyped
14. **`api/src/db/client.ts`** — Ensure Kysely database type definition covers all columns

## Phase 4: Web Components (if needed to reach 25%)

15. **`web/src/pages/App.tsx`** — Main app router, likely `any` on route props
16. **`web/src/components/Editor.tsx`** — TipTap/Yjs integration types
17. **`web/src/components/KanbanBoard.tsx`** — Drag-and-drop event types
18. **`web/src/lib/api.ts`** — API client return types

## Measurement

### Before (run once at start):
```bash
npx eslint . --rule '{"@typescript-eslint/no-unsafe-any": "warn"}' 2>&1 | grep -c "warning"
grep -r "as " --include="*.ts" --include="*.tsx" api/ web/ shared/ | wc -l
npx eslint . --rule '{"@typescript-eslint/no-non-null-assertion": "warn"}' 2>&1 | grep -c "warning"
```

### After (run after all changes):
Same commands. Compare counts. Target: 25% reduction across the board.

## Risk Mitigation

- **Risk**: Changing types breaks runtime behavior
  **Mitigation**: Types-only changes. No `as unknown as X` hacks. If a type change requires a runtime change, stop and evaluate.

- **Risk**: Kysely type changes cause query compilation errors
  **Mitigation**: Work one file at a time. Run tests after each file. The Kysely DB type in `db/client.ts` must match the actual schema.

- **Risk**: Express request extension types conflict
  **Mitigation**: Use module augmentation for `req.user`, `req.workspaceId` — standard Express pattern.
