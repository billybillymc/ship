# Windows Development Setup

## Runtime Environment

The Ship app runs inside **WSL Ubuntu**, not native Windows. Claude Code (running on Windows) can interact with the app through WSL:

- **PostgreSQL** runs inside WSL Ubuntu (not Docker, not native Windows)
- **Node/pnpm** run inside WSL Ubuntu
- The dev servers (`pnpm dev`) bind to `localhost` inside WSL, which Windows can reach at `localhost` or `127.0.0.1` thanks to WSL networking
- The repo lives on the Windows filesystem (`C:\gauntlet\ship2`) but is accessible from WSL at `/mnt/c/gauntlet/ship2`

### Interacting with the running app

From Claude Code's bash shell (Windows Git Bash), you can:

```bash
# Hit API endpoints directly (WSL ports are forwarded to Windows)
curl http://localhost:3000/api/health
curl http://localhost:5173                # Vite dev server

# Run WSL commands when needed
wsl -e bash -c "psql -U postgres -c 'SELECT 1'"
wsl -e bash -c "cd /mnt/c/gauntlet/ship2 && pnpm dev"
```

### Key differences from pure Linux dev

| Concern | How it works |
|---------|-------------|
| File paths | Use `/mnt/c/...` from WSL, `C:\...` from Windows |
| Line endings | Git is configured with `core.autocrlf`. Watch for CRLF issues in shell scripts |
| File watchers | Vite's file watcher works across the WSL boundary but may be slower on Windows-mounted paths |
| Ports | WSL2 forwards ports to Windows automatically |

---

## Using spec-kit for Audit Improvements

We completed a comprehensive 7-category audit (see `AUDIT.md`). Now we use [GitHub's spec-kit](https://github.com/github/spec-kit) to structure the improvement work into specs, plans, and tasks that Claude Code can execute methodically.

### Step 1: Install spec-kit

```bash
# Requires Python/uvx (or use pipx)
uvx --from git+https://github.com/github/spec-kit.git specify init --here --ai claude --force
```

This creates the `.specify/` directory with:
- `.specify/memory/constitution.md` — project principles (we'll populate from CLAUDE.md + docs/)
- `.specify/specs/` — one spec per improvement category
- `.specify/plans/` — implementation plans generated from specs
- `.specify/tasks/` — concrete task breakdowns from plans

### Step 2: Write the Constitution

Run `/speckit.constitution` or manually create `.specify/memory/constitution.md` drawing from:
- `CLAUDE.md` (architecture, patterns, philosophy)
- `docs/unified-document-model.md` (data model)
- `docs/application-architecture.md` (tech stack)

Key principles to encode:
- Everything is a document (unified document model)
- 4-panel editor layout
- No new content tables
- YAGNI / boring technology
- All tests must pass after every change

### Step 3: Create 7 Specs (one per audit category)

Each spec lives in `.specify/specs/` and maps directly to an audit category and its own git branch.

| # | Audit Category | Branch Name | Spec File | Improvement Target |
|---|---------------|-------------|-----------|-------------------|
| 1 | Type Safety | `audit/type-safety` | `type-safety.md` | Eliminate 25% of type safety violations |
| 2 | Bundle Size | `audit/bundle-size` | `bundle-size.md` | 15% bundle reduction or 20% initial load reduction |
| 3 | API Response Time | `audit/api-response-time` | `api-response-time.md` | 20% P95 reduction on 2+ endpoints |
| 4 | Database Query Efficiency | `audit/db-query-efficiency` | `db-query-efficiency.md` | 20% query reduction on 1+ flow, or 50% on slowest query |
| 5 | Test Coverage | `audit/test-coverage` | `test-coverage.md` | 3 meaningful tests for untested critical paths |
| 6 | Error Handling | `audit/error-handling` | `error-handling.md` | Fix 3 error handling gaps (1 must be data-loss scenario) |
| 7 | Accessibility | `audit/accessibility` | `accessibility.md` | Fix all Critical/Serious a11y violations on 3 top pages |

For each spec, use `/speckit.specify` or manually write the spec file referencing:
- The specific audit findings from `AUDIT.md`
- The improvement target (quantitative)
- The files identified as problematic
- Before/after measurement methodology

### Step 4: Generate Plans from Specs

For each spec, run `/speckit.plan` to produce an implementation plan. The plan should:
- List the exact files to modify
- Order changes by dependency (shared types first, then API, then web)
- Include verification steps (run tests, re-measure benchmarks)
- Stay within the scope of one audit category

### Step 5: Generate Tasks from Plans

Run `/speckit.tasks` on each plan. Each task should be:
- Scoped to 1-2 files
- Independently testable
- Ordered with explicit dependencies

### Step 6: Execute on Branches

```bash
# Create all 7 branches from master
git branch audit/type-safety
git branch audit/bundle-size
git branch audit/api-response-time
git branch audit/db-query-efficiency
git branch audit/test-coverage
git branch audit/error-handling
git branch audit/accessibility
```

Work each branch independently. The categories are mostly orthogonal:
- **Type Safety** touches type annotations across api/ and web/ — no runtime behavior changes
- **Bundle Size** touches web/vite.config.ts, lazy imports, package.json — frontend only
- **API Response Time** touches api/src/routes/ — backend query optimization
- **DB Query Efficiency** touches api/src/db/migrations/ and api/src/routes/ — backend + new indexes
- **Test Coverage** adds new test files — no production code changes
- **Error Handling** touches api/src/app.ts, api/src/index.ts, web/src/components/ — cross-cutting but small surface
- **Accessibility** touches web/src/components/ — frontend only, CSS + ARIA attributes

### Step 7: Merge Strategy

After each branch passes its improvement target with before/after evidence:

```bash
git checkout master
git merge --no-ff audit/type-safety    # etc.
```

Merge order recommendation (least to most conflict risk):
1. `audit/test-coverage` (new files only)
2. `audit/db-query-efficiency` (new migration files + minor route changes)
3. `audit/accessibility` (frontend component attribute changes)
4. `audit/error-handling` (small cross-cutting changes)
5. `audit/api-response-time` (route handler refactors)
6. `audit/bundle-size` (frontend config + import changes)
7. `audit/type-safety` (touches everything, but only type annotations)

---

## Quick Reference: Audit Baseline Numbers

From `AUDIT.md`, the numbers to beat:

| Category | Baseline | Target |
|----------|----------|--------|
| Type Safety | 280 explicit `any`, 7,458 unsafe usages, 1,181 `as` assertions | 25% reduction |
| Bundle Size | 2,139 KB (589 KB gzip) | 15% smaller or 20% less initial load |
| API Response (P95) | /documents 310ms, /issues 193ms | 20% faster on 2+ endpoints |
| DB Queries | 23 queries for main page load | 20% fewer on 1+ flow |
| Test Coverage | API 40.3% stmt, Web 0% (broken) | 3 new critical-path test suites |
| Error Handling | 84 console errors, no unhandled rejection handler, silent `.catch(() => {})` | Fix 3 gaps |
| Accessibility | 178 critical/serious violations, ~30 contrast failures | Fix all on 3 top pages |
