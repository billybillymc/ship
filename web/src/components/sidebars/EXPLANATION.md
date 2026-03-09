# web/src/components/sidebars/

Document-type-specific property sidebars. These render in the right panel of the 4-panel editor layout.

## Files

- **PropertiesPanel.tsx** -- Unified entry point that dispatches to the correct sidebar based on `document_type` (wiki, issue, project, sprint, program, weekly_plan, weekly_retro).
- **IssueSidebar.tsx** -- Properties for issues: status, priority, estimate, assignee, project/program/week associations, triage actions, and promotion to project.
- **ProjectSidebar.tsx** -- Properties for projects: ICE scoring sliders, RACI assignments, design review checkbox, plan/retro approvals, color/emoji, and conversion to issue.
- **ProjectContextSidebar.tsx** -- Navigation sidebar for project context: expandable tree with tabs, per-person weekly plan/retro links with status indicators, and issues list.
- **ProgramSidebar.tsx** -- Properties for programs: color selection, RACI role assignments, and merge into another program.
- **WeekSidebar.tsx** -- Properties for sprints/weeks: owner assignment, status, progress bar, plan/review approval workflows with OPM 5-level performance rating.
- **WikiSidebar.tsx** -- Properties for wikis: maintainer selection, visibility toggle, timestamps, and backlinks panel.
- **DocumentTypeSelector.tsx** -- Dropdown for changing a document's type with required-field detection.
- **QualityAssistant.tsx** -- AI-powered advisory components that analyze weekly plan/retro content, displaying quality meters and per-item feedback.
- **index.ts** -- Barrel exports for all sidebar components.
