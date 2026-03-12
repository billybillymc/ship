# Feature Specification: Type Safety Improvements

**Feature Branch**: `category_1`
**Created**: 2026-03-10
**Status**: Draft
**Input**: AUDIT.md Category 1 findings

## User Scenarios & Testing

### User Story 1 - Replace explicit `any` types in the 5 most violation-dense route files (Priority: P1)

The 5 files with the most type safety violations are all API route handlers: `weeks.ts` (639), `projects.ts` (443), `team.ts` (440), `documents.ts` (374), `issues.ts` (340). These files use `any` for request bodies, query parameters, and database result rows, which means TypeScript catches zero bugs in the most critical business logic.

**Why this priority**: Route handlers are where user input meets database queries. Type errors here cause runtime crashes or silent data corruption. Fixing these files covers the highest violation density.

**Independent Test**: Run `pnpm test --workers=1` after each file is modified. All 451 API tests must pass. Run eslint `@typescript-eslint/no-unsafe-*` rules and count reduction.

**Acceptance Scenarios**:

1. **Given** `api/src/routes/weeks.ts` with 639 violations, **When** explicit `any` types are replaced with proper interfaces for request/response shapes, **Then** eslint violation count for this file drops by at least 25% and all tests pass.
2. **Given** a route handler using `req.body as any`, **When** replaced with a typed interface matching the OpenAPI schema, **Then** TypeScript catches invalid property access at compile time.
3. **Given** a Kysely query result typed as `any`, **When** replaced with the proper database row type, **Then** accessing a misspelled column name becomes a compile error.

---

### User Story 2 - Replace type assertions (`as`) with type guards (Priority: P2)

1,181 `as` assertions bypass TypeScript's type checker. The most dangerous are `as any` and assertions on database results. Replace the most impactful ones with proper type narrowing (type guards, `instanceof`, discriminated unions).

**Why this priority**: `as` assertions silence the compiler. Type guards actually validate at runtime, catching real bugs.

**Independent Test**: Grep count of `as` assertions before/after. Run full test suite.

**Acceptance Scenarios**:

1. **Given** a cast like `result as DocumentRow`, **When** replaced with a type guard that validates the shape, **Then** malformed database results are caught at runtime instead of causing downstream undefined-property errors.
2. **Given** 1,181 total `as` assertions, **When** the most dangerous ones (in route handlers and services) are replaced, **Then** total count drops by at least 25%.

---

### User Story 3 - Reduce non-null assertions (Priority: P3)

348 non-null assertions (`!`) assume values are never null/undefined without checking. Replace with proper null checks or optional chaining where the value genuinely could be absent.

**Why this priority**: Lower risk than `any` or `as` — non-null assertions at least preserve the base type. But they still hide potential null reference errors.

**Independent Test**: Eslint `@typescript-eslint/no-non-null-assertion` count before/after.

**Acceptance Scenarios**:

1. **Given** code using `user!.id`, **When** replaced with a null check or early return, **Then** the code handles the null case explicitly instead of crashing.

### Edge Cases

- Replacing `any` in a route handler must not break the Express type chain (`req`, `res`, `next`)
- Kysely's type inference depends on the database type definition — changes must align with the actual DB schema
- Some `as` assertions may be legitimate (e.g., Kysely `.executeTakeFirstOrThrow()` return narrowing) — don't remove those

## Requirements

### Functional Requirements

- **FR-001**: All type replacements MUST use correct types that reflect actual data shapes, not just `unknown`
- **FR-002**: Replacing `any` with `unknown` without adding type narrowing does NOT count as an improvement
- **FR-003**: All 451 API unit tests must pass after every change
- **FR-004**: No new `@ts-ignore` or `@ts-expect-error` directives may be introduced
- **FR-005**: Changes must be limited to type annotations — no runtime behavior changes

### Key Entities

- **Route handler types**: Request body, query params, route params, response body
- **Database row types**: Kysely result types from the `documents`, `users`, `workspaces` tables
- **Shared types**: Types in `shared/src/types/` used across api/ and web/

## Success Criteria

### Measurable Outcomes

- **SC-001**: 25% reduction in total type safety violations (from 7,458 unsafe any usages baseline)
- **SC-002**: At least 70 explicit `any` types eliminated (25% of 280)
- **SC-003**: At least 295 `as` assertions eliminated or converted to type guards (25% of 1,181)
- **SC-004**: Zero new `@ts-ignore` or `@ts-expect-error` directives
- **SC-005**: All existing tests pass with no modifications to test assertions
