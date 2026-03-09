# web/src/lib/

Utility functions, API client, and configuration.

## Files

- **api.ts** -- HTTP client wrapping `fetch` with auth headers, base URL, error handling, and typed response parsing for all API endpoints.
- **cn.ts** -- `cn()` utility (clsx + tailwind-merge) for conditional class merging, plus `getContrastTextColor()` for WCAG AA contrast on colored backgrounds.
- **accountability.ts** -- Helpers for the weekly accountability system: type-to-label mapping, plan/retro document creation/retrieval, and due-date formatting.
- **contextMenuActions.ts** -- Registry of right-click context menu actions per document type with filtering for bulk-select mode.
- **date-utils.ts** -- Date formatting utilities: relative time strings and compact date range formatting.
- **documentTree.ts** -- Builds hierarchical trees from flat wiki document lists using `parent_id`, plus ancestor ID retrieval for breadcrumbs.
- **queryClient.ts** -- TanStack Query client with IndexedDB persistence, cache versioning/migration, corruption detection, and stale-while-revalidate defaults.
- **statusColors.ts** -- Centralized Tailwind CSS color classes for issue statuses, sprint statuses, and priorities (WCAG AA compliant).
- **document-tabs.tsx** -- Tab configuration registry defining which tabs appear for each document type with lazy-loaded components and count-based labels.

## Test Files

- **accountability.test.ts**, **document-tabs.test.ts** -- Unit tests for utility functions.
