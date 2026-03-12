# Tasks: Type Safety Improvements

**Plan**: `.specify/plans/type-safety-plan.md`

## Pre-flight

- [ ] **T0**: Merge working_version and run baseline measurement
  - Files: (none — measurement only)
  - **FIRST**: Merge `working_version` into this branch (contains all 6 prior categories). Run `pnpm install`, `pnpm db:migrate`, verify tests pass. Prior categories may have incidentally improved some types — baseline must be measured AFTER merge.
  - Run: `npx eslint . --rule '{"@typescript-eslint/no-unsafe-any": "warn"}' 2>&1 | grep -c "warning"`
  - Run: `grep -rn " as " --include="*.ts" --include="*.tsx" api/ web/ shared/ | wc -l`
  - Save counts to `baseline-type-violations.txt`
  - Depends on: prior categories merged into working_version

## Phase 1: Shared Types

- [ ] **T1**: Review and extend shared type definitions
  - Files: `shared/src/types/index.ts`, `shared/src/types/api.ts`
  - Action: Ensure document row types, request body types, and response types exist for all route handlers to import
  - Depends on: T0
  - Verify: `pnpm build`

## Phase 2: API Route Handlers

- [ ] **T2**: Fix type violations in `api/src/routes/weeks.ts`
  - Files: `api/src/routes/weeks.ts`
  - Action: Replace `any` on req/res types, query results, and assertions with proper types
  - Depends on: T1
  - Verify: `pnpm --filter api test --workers=1`

- [ ] **T3**: Fix type violations in `api/src/routes/projects.ts`
  - Files: `api/src/routes/projects.ts`
  - Depends on: T1
  - Verify: `pnpm --filter api test --workers=1`

- [ ] **T4**: Fix type violations in `api/src/routes/team.ts`
  - Files: `api/src/routes/team.ts`
  - Depends on: T1
  - Verify: `pnpm --filter api test --workers=1`

- [ ] **T5**: Fix type violations in `api/src/routes/documents.ts`
  - Files: `api/src/routes/documents.ts`
  - Depends on: T1
  - Verify: `pnpm --filter api test --workers=1`

- [ ] **T6**: Fix type violations in `api/src/routes/issues.ts`
  - Files: `api/src/routes/issues.ts`
  - Depends on: T1
  - Verify: `pnpm --filter api test --workers=1`

- [ ] **T7**: Fix type violations in `api/src/routes/dashboard.ts`
  - Files: `api/src/routes/dashboard.ts`
  - Depends on: T1
  - Verify: `pnpm --filter api test --workers=1`

- [ ] **T8**: Fix type violations in remaining high-value route files
  - Files: `api/src/routes/accountability.ts`, `api/src/routes/programs.ts`, `api/src/routes/weekly-plans.ts`
  - Depends on: T1
  - Verify: `pnpm --filter api test --workers=1`

## Phase 3: Middleware and Utilities

- [ ] **T9**: Type Express request extensions in auth middleware
  - Files: `api/src/middleware/auth.ts`
  - Action: Add module augmentation for `req.user`, `req.workspaceId`, `req.tokenInfo`
  - Depends on: T1
  - Verify: `pnpm --filter api test --workers=1`

- [ ] **T10**: Fix types in utility files
  - Files: `api/src/utils/document-crud.ts`, `api/src/utils/allocation.ts`
  - Depends on: T1
  - Verify: `pnpm --filter api test --workers=1`

- [ ] **T11**: Fix types in service files
  - Files: `api/src/services/ai-analysis.ts`, `api/src/services/invite-acceptance.ts`
  - Depends on: T1
  - Verify: `pnpm --filter api test --workers=1`

## Phase 4: Web (if needed)

- [ ] **T12**: Fix type violations in web components (if not yet at 25% target)
  - Files: `web/src/pages/App.tsx`, `web/src/components/Editor.tsx`, `web/src/lib/api.ts`
  - Depends on: T2-T11
  - Verify: `pnpm --filter web test`

## Post-flight

- [ ] **T13**: Run final measurement and document results
  - Files: (none — measurement only)
  - Run: same commands as T0
  - Compare: before/after counts, calculate % reduction
  - Save to `results-type-violations.txt`
  - Depends on: all above

- [ ] **T14**: Save results file to Windows audit notes
  - Files: `C:/gauntlet/ship_audit_notes/CATEGORY_1_RESULTS.md`
  - Action: Create a detailed results markdown file with before/after metrics, all changes made, and any deviations from plan
  - Depends on: T13

- [ ] **T15**: Commit and push to GitHub
  - Action: Commit all changes on `category_1` branch. Push to GitHub via chain: `git push windows category_1` (pushes to /mnt/c/gauntlet/ship2), then from Windows repo `git push origin category_1`. Then merge into `working_version` and push that too.
  - Depends on: T14
