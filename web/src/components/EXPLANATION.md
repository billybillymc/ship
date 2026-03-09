# web/src/components/

Reusable React components for the application UI.

## Core Components

- **Editor.tsx** -- The main TipTap rich text editor component with collaboration support, slash commands, mentions, drag handles, and all editor extensions wired together.
- **UnifiedEditor.tsx** -- Wrapper around Editor that adds the 4-panel layout (icon rail, contextual sidebar, editor, properties panel) and document-level CRUD operations.
- **CommandPalette.tsx** -- Global Cmd+K command palette for quick navigation and actions across documents.
- **ProtectedRoute.tsx** -- Route guard that redirects unauthenticated users to login.

## List & Navigation

- **IssuesList.tsx** -- Tabular issue list with sortable columns, inline editing, and multi-select.
- **KanbanBoard.tsx** -- Kanban board view for issues organized by status columns.
- **SelectableList.tsx** -- Canonical table with multi-select (Shift+Click, Ctrl+Click), keyboard navigation (j/k), and screen reader support.
- **BulkActionBar.tsx** -- Toolbar for bulk operations (archive, delete, status change, etc.) on selected items.
- **DocumentListToolbar.tsx** -- Toolbar with sort, view mode toggle, column picker, and create button.
- **FilterTabs.tsx** -- Generic tab bar for filtering list views.
- **DocumentTreeItem.tsx** -- Recursive tree item for wiki sidebar with expand/collapse and CRUD actions.
- **ContextTreeNav.tsx** -- Hierarchical tree navigation showing a document's ancestors and children.
- **DashboardSidebar.tsx** -- Dashboard sidebar toggling between "My Work" and "Overview" views.
- **InlineWeekSelector.tsx** -- Inline dropdown for assigning issues to weeks within a list row.

## Accountability & Status

- **AccountabilityBanner.tsx** -- Colored banner showing count of pending accountability items (red=overdue, amber=due today).
- **AccountabilityGrid.tsx** -- Grid view of sprint-level plan/review status per project across weeks.
- **ActionItems.tsx** -- Inline list of pending accountability tasks with due date badges.
- **ActionItemsModal.tsx** -- Modal version of action items list.
- **StatusOverviewHeatmap.tsx** -- Person-centric heatmap of weekly plan/retro completion across sprints.
- **PlanQualityBanner.tsx** -- AI-powered quality score bar for weekly plans and retros.

## Sprint/Week Components

- **StandupFeed.tsx** -- Chat-like feed for standup updates within a sprint.
- **WeekReconciliation.tsx** -- End-of-sprint UI for deciding what to do with incomplete issues.
- **WeekReview.tsx** -- TipTap editor for weekly sprint reviews with approval workflow.

## Document Features

- **ApprovalButton.tsx** -- Approval lifecycle button (not approved → approved → changes requested) with diff viewer.
- **ContentHistoryPanel.tsx** -- Version history panel with old/new content diffs.
- **DiffViewer.tsx** -- Inline text diff renderer (red deletions, green additions).
- **VisibilityDropdown.tsx** -- Dropdown for toggling document visibility (private/workspace).
- **EmojiPicker.tsx** -- Emoji picker popover using emoji-picker-react.
- **ProjectRetro.tsx** -- Project retrospective editor with success criteria and impact tracking.
- **ProjectSetupWizard.tsx** -- Modal wizard for creating new projects.

## Error Handling & UX

- **SessionTimeoutModal.tsx** -- Countdown warning for impending session expiration.
- **CacheCorruptionAlert.tsx** -- Alert banner for React Query cache corruption with recovery button.
- **MutationErrorToast.tsx** -- Global mutation error display via toast notifications.
- **UploadNavigationWarning.tsx** -- Warning modal when navigating away during file uploads.

## Test Files

- **PlanQualityBanner.test.tsx** -- Tests for the PlanQualityBanner component.

## Directories

- **editor/** -- TipTap editor extensions (slash commands, mentions, file uploads, etc.).
- **sidebars/** -- Document-type-specific property sidebars.
- **ui/** -- Low-level UI primitives (Combobox, Toast, Tooltip, etc.).
- **document-tabs/** -- Tab content components for the unified document page.
- **dashboard/** -- Dashboard layout variants.
- **dialogs/** -- Modal dialog components.
- **week/** -- Week/sprint detail components.
- **review/** -- Review workflow navigation.
- **icons/** -- Icon components including USWDS icons.
