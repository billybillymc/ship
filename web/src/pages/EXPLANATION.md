# web/src/pages/

Top-level route page components. Each file corresponds to a URL route in the application.

## Files

- **App.tsx** -- Root application component with React Router route definitions, layout (sidebar + content), and global providers (auth, workspace, documents, issues, programs, projects contexts).
- **Login.tsx** -- Login page with email/password form and CAIA PIV smartcard authentication button.
- **Dashboard.tsx** -- Main dashboard showing the user's work overview, accountability items, and focus areas.
- **Issues.tsx** -- Issues list page with list/tree/kanban view modes, filtering, sorting, bulk actions, and inline editing.
- **Projects.tsx** -- Projects list page with card/list views, ICE score sorting, and program grouping.
- **Programs.tsx** -- Programs list page displaying program cards with aggregated metrics and child project counts.
- **Documents.tsx** -- Wiki documents page with hierarchical tree navigation and CRUD.
- **UnifiedDocumentPage.tsx** -- Universal document editor page that renders any document type using the 4-panel layout with type-specific tabs and sidebars.
- **PersonEditor.tsx** -- Person document editor with profile fields, team allocations, and reports-to hierarchy.
- **TeamDirectory.tsx** -- Team member directory with status overview and person cards.
- **TeamMode.tsx** -- Team grid view showing all members' sprint allocations and accountability status.
- **ReviewsPage.tsx** -- Manager review queue for approving/requesting changes on weekly plans and retros.
- **StatusOverviewPage.tsx** -- Status overview heatmap showing team-wide weekly plan/retro completion.
- **MyWeekPage.tsx** -- Personal weekly view showing the current user's plan, retro, standup, and assigned projects for a given week.
- **OrgChartPage.tsx** -- Organization chart visualization of team reporting structure.
- **AdminDashboard.tsx** -- Super-admin dashboard for managing workspaces across the platform.
- **AdminWorkspaceDetail.tsx** -- Detailed admin view of a specific workspace's members, invites, and settings.
- **FeedbackEditor.tsx** -- Feedback submission/editing page for program-level user feedback.
- **Setup.tsx** -- Initial setup wizard for creating the first admin user and workspace.
- **WorkspaceSettings.tsx** -- Workspace settings page for managing members, invites, and configuration.
- **InviteAccept.tsx** -- Invite acceptance page for joining a workspace via invite link.
- **PublicFeedback.tsx** -- Public-facing feedback submission form (no auth required).
- **ConvertedDocuments.tsx** -- Page showing recently converted documents (issue ↔ project conversions).
- **Dashboard.test.tsx** -- Unit tests for the Dashboard component.
