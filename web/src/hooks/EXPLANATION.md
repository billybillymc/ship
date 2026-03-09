# web/src/hooks/

Custom React hooks for data fetching, authentication, UI state, and real-time features.

## Authentication & Session

- **useAuth.tsx** -- Authentication context (login, logout, session check, impersonation) with localStorage caching and workspace management.
- **useSessionTimeout.ts** -- Inactivity-based and absolute session timeout logic with warnings, activity listeners, and sleep/wake handling.

## Data Fetching (TanStack Query)

- **useDocumentsQuery.ts** -- CRUD hooks for wiki documents with optimistic updates.
- **useIssuesQuery.ts** -- CRUD hooks for issues with optimistic updates, belongs_to helpers, and cascade warning handling.
- **useProjectsQuery.ts** -- CRUD hooks for projects with optimistic ICE score recomputation and sub-resource hooks.
- **useProgramsQuery.ts** -- CRUD hooks for programs with optimistic updates.
- **useWeeksQuery.ts** -- CRUD hooks for sprints/weeks by program or project, plus active weeks across workspace.
- **useActionItemsQuery.ts** -- Fetches accountability action items on a 30-second stale/60-second refetch cycle.
- **useDashboardActionItems.ts** -- Fetches dashboard action items (plan/retro deadlines) with urgency levels.
- **useDashboardFocus.ts** -- Fetches "My Focus" dashboard data (allocated projects, plan items, recent activity).
- **useMyWeekQuery.ts** -- Fetches user's weekly dashboard data (plan, retro, standup slots, assigned projects).
- **useCommentsQuery.ts** -- CRUD hooks for document comments.
- **useContentHistoryQuery.ts** -- Fetches version history for weekly plan/retro documents.
- **useDocumentContextQuery.ts** -- Fetches a document's hierarchical context (ancestors, children, breadcrumbs).
- **useStandupStatusQuery.ts** -- Fetches whether standup is due today with 5-minute auto-refetch.
- **useTeamMembersQuery.ts** -- Fetches team members with an assignable-only filter variant.
- **useUnifiedDocuments.ts** -- Aggregates wiki, issue, project, and program queries into a single interface.
- **useWeeklyReviewActions.ts** -- Manages review workflow (approval, request-changes, rating, queue navigation).

## UI State & Interaction

- **useAutoSave.ts** -- Throttled save with retry queue and exponential backoff.
- **useSelection.ts** -- List selection state (single toggle, Ctrl+Click, Shift+Click range, Ctrl+A, keyboard nav).
- **useListFilters.ts** -- List view state (sort, view mode, URL-synced filters) with localStorage persistence.
- **useGlobalListNavigation.ts** -- Superhuman-style j/k keyboard navigation across list views.
- **useColumnVisibility.ts** -- Table column visibility with localStorage persistence.
- **useDocumentConversion.ts** -- Issue-to-project and project-to-issue document type conversion.
- **useFocusOnNavigate.ts** -- Accessibility hook moving focus to main content on route change (WCAG 2.4.3).

## Real-time

- **useRealtimeEvents.tsx** -- WebSocket real-time events with auto-reconnect, keepalive pings, and pub/sub API.

## Test Files

- **useSelection.test.ts**, **useSessionTimeout.test.ts** -- Unit tests for hooks.
