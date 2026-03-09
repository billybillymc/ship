# web/src/contexts/

React context providers for global state management.

## Files

- **WorkspaceContext.tsx** -- Current workspace state, workspace list, admin status, workspace switching, and refresh.
- **CurrentDocumentContext.tsx** -- Tracks the currently open document's ID, type, and associated project ID.
- **ArchivedPersonsContext.tsx** -- Global subscription-based store of archived person IDs, used by TipTap mention NodeViews.
- **ReviewQueueContext.tsx** -- Sequential review queue for batch plan/retro reviewing with start/advance/skip/exit navigation.
- **SelectionPersistenceContext.tsx** -- Persists multi-select state across re-renders using ref-based store keyed by context.
- **UploadContext.tsx** -- Tracks active file uploads and triggers browser beforeunload warning during uploads.
- **DocumentsContext.tsx** -- *(Deprecated)* Legacy context wrapper for wiki documents, superseded by `useUnifiedDocuments`.
- **IssuesContext.tsx** -- *(Deprecated)* Legacy context wrapper for issues, superseded by `useUnifiedDocuments`.
- **ProgramsContext.tsx** -- *(Deprecated)* Backward-compatibility wrapper around `useProgramsQuery`.
- **ProjectsContext.tsx** -- *(Deprecated)* Backward-compatibility wrapper around `useProjectsQuery`.

## Test Files

- **SelectionPersistenceContext.test.tsx** -- Tests for selection persistence.
