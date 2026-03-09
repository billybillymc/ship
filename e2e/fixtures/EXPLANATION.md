# e2e/fixtures/

Playwright test fixtures and helpers.

## Files

- **isolated-env.ts** -- Fully isolated E2E test fixture: each Playwright worker gets its own PostgreSQL container (via testcontainers), API server, and Vite preview server, plus comprehensive seed data (users, programs, sprints, issues, wikis).
- **dev-server.ts** -- Lightweight fixture connecting to already-running local dev servers (no containers) for fast local iteration.
- **test-helpers.ts** -- Reusable retry-based helpers for flaky-resistant tests: `triggerMentionPopup`, `hoverWithRetry`, `waitForTableData`.
- **test.pdf** -- Sample PDF file used in file upload tests.
