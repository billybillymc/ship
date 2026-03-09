# web/src/components/document-tabs/

Tab content components for the unified document page. Each tab renders a different view of a document's data.

## Files

- **index.ts** -- Barrel exports for all tab components.
- **ProgramOverviewTab.tsx** -- Program document editor with optimistic updates and team member data.
- **ProgramIssuesTab.tsx** -- Issues list filtered to a specific program.
- **ProgramProjectsTab.tsx** -- Projects list filtered to a specific program.
- **ProgramWeeksTab.tsx** -- Weeks/sprints list filtered to a specific program.
- **ProjectDetailsTab.tsx** -- Project document editor with ICE scoring, type conversion, and RACI fields.
- **ProjectIssuesTab.tsx** -- Issues list filtered to a specific project.
- **ProjectWeeksTab.tsx** -- Weeks/sprints list filtered to a specific project.
- **ProjectRetroTab.tsx** -- Project retrospective editor tab.
- **WeekOverviewTab.tsx** -- Sprint/week document editor with owner selection and program association.
- **WeekIssuesTab.tsx** -- Issues list filtered to a specific sprint/week.
- **WeekPlanningTab.tsx** -- Sprint planning view for managing issue assignments.
- **WeekStandupsTab.tsx** -- Standup feed for a specific sprint/week.
- **WeekReviewTab.tsx** -- Sprint review editor tab.
