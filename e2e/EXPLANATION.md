# e2e/

Playwright end-to-end test suite. Tests run against real API and web servers with either shared dev servers or fully isolated per-worker environments.

## Setup Files

- **global-setup.ts** -- Runs once before all tests to build API and web packages, enabling lightweight `vite preview` servers.
- **AGENTS.md** -- Documentation for AI agents about E2E test patterns and conventions.

## Test Spec Files

Tests are organized by feature area. Key test files include:

- **auth.spec.ts** -- Authentication flow tests (login, logout, session timeout).
- **authorization.spec.ts** -- Permission and access control tests.
- **documents.spec.ts** -- Document CRUD and collaboration tests.
- **accountability-*.spec.ts** -- Accountability system tests (banners, standups, weeks, owner changes).
- **bulk-selection.spec.ts** -- Multi-select and bulk action tests.
- **backlinks.spec.ts** -- Cross-document reference tests.
- **content-caching.spec.ts** -- IndexedDB cache behavior tests.
- **accessibility.spec.ts** / **check-aria.spec.ts** -- WCAG accessibility compliance tests.
- **emoji.spec.ts** / **icons.spec.ts** -- UI element rendering tests.
- **drag-handle.spec.ts** -- Block drag-and-drop tests.
- **inline-comments.spec.ts** -- Comment annotation tests.
- **file-attachments.spec.ts** / **file-upload-api.spec.ts** / **images.spec.ts** -- File handling tests.
- **edge-cases.spec.ts** / **error-handling.spec.ts** -- Error and boundary condition tests.
- **data-integrity.spec.ts** -- Database consistency tests.
- **document-workflows.spec.ts** / **document-isolation.spec.ts** -- Document lifecycle tests.
- **feedback-consolidation.spec.ts** -- Feedback system tests.
- **context-menus.spec.ts** -- Right-click menu tests.
- **features-real.spec.ts** / **critical-blockers.spec.ts** -- Integration and smoke tests.

## Directories

- **fixtures/** -- Test fixtures, helpers, and environment setup.
