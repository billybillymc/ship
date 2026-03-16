# Category 7: Accessibility Compliance Audit

**Date:** 2026-03-10
**Standard:** WCAG 2.1 AA / Section 508
**Tools:** Lighthouse 12.8.2, pa11y 9.1.1 (HTML_CodeSniffer + axe-core 4.11)
**Environment:** Local development (Docker), dark theme, seeded data

---

## 1. Lighthouse Accessibility Scores (Per Page)

| Page | Path | Score |
|------|------|-------|
| Login | `/login` | **100** |
| Dashboard | `/dashboard` | **96** |
| My Week | `/my-week` | **96** |
| Documents | `/docs` | **100** |
| Issues | `/issues` | **100** |
| Projects | `/projects` | **96** |
| Programs | `/programs` | **100** |
| Team Allocation | `/team/allocation` | **96** |
| Team Directory | `/team/directory` | **100** |
| Team Status | `/team/status` | **96** |
| Settings | `/settings` | **100** |

**Average Lighthouse Score: 98.7**

All failures on the 96-scoring pages are **color-contrast** violations only.

---

## 2. Automated Scanner Results (pa11y: axe-core + HTML_CodeSniffer)

### Totals by Severity

| Severity | Count |
|----------|-------|
| **Errors (Critical/Serious)** | **178** |
| **Warnings (Moderate)** | **480** |
| Notices (Minor) | excluded from scan |

### Errors by Page

| Page | Errors | Warnings |
|------|--------|----------|
| Login | 8 | 6 |
| Dashboard | 22 | 19 |
| My Week | 28 | 16 |
| Documents | 8 | 6 |
| Issues | 10 | 318 |
| Projects | 31 | 26 |
| Programs | 9 | 11 |
| Team Allocation | 28 | 19 |
| Team Directory | 8 | 18 |
| Team Status | 18 | 30 |
| Settings | 8 | 11 |

### Top Error Categories

1. **`color-contrast` (axe-core)** — ~95 instances across all pages
   Elements fail WCAG AA 4.5:1 minimum contrast ratio. Primary culprits:
   - `text-accent` on dark background (ratio ~2.89:1)
   - `text-muted/50` (50% opacity muted text, ratio as low as ~2.15:1)
   - `bg-accent/20` with `text-accent` (ratio ~2.59:1)
   - White text on colored badges (`bg-green-500`, `bg-violet-500`, `bg-amber-500`, `bg-red-500`) — ratios 2.15:1 to 4.47:1

2. **`aria-hidden-focus` (axe-core)** — ~55 instances (global, every page)
   Two root causes:
   - **Radix UI focus guard**: `<span data-radix-focus-guard tabindex="0" aria-hidden="true">` — a known Radix UI pattern that pa11y flags but is intentional focus management
   - **Dialog/modal backdrop**: When a dialog opens, `aria-hidden="true"` is set on `#root > div > div` which contains the nav and skip-to-content link (focusable elements). This is standard Radix behavior but technically an axe violation.

3. **`WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail` (HTML_CodeSniffer)** — ~28 instances
   Explicit contrast ratio failures with measured ratios:
   - 2.15:1 (amber-500 bg, white text)
   - 2.28:1 (green-500 bg, white text)
   - 2.54:1 (emerald-500 bg, white text)
   - 2.59:1 (accent text on dark bg)
   - 2.89:1 (accent text)
   - 3.68:1 (blue-500 bg, white text)
   - 3.76:1 (red-500 bg, white text)
   - 4.23:1 (violet-500 bg, white text)
   - 4.47:1 (indigo-500 bg, white text)

### Top Warning Categories

1. **`G18.Alpha` (transparency warnings)** — **~420 instances**
   Text or backgrounds using CSS opacity/alpha channels where contrast cannot be programmatically verified. Mostly `bg-accent/20`, `text-muted/50`, and similar Tailwind opacity modifiers.

2. **`1_3_1_A.G141` (heading nesting)** — 2 per page (22 total)
   H2 elements appear where H1 is expected. The app uses H2 as the primary heading in the main content area (the page title), but the sidebar/nav may contain the visual "first" heading.

3. **`1_4_10` (position: fixed)** — 1 per page (11 total)
   The accountability banner uses `position: fixed`, which could require two-dimensional scrolling at 400% zoom.

---

## 3. Keyboard Navigation Completeness

**Rating: Partial**

### What works well:
- **Skip-to-main-content link** (`App.tsx:265`): Present and functional, targets `#main-content`
- **Tab navigation**: All major interactive elements (nav buttons, sidebar items, list rows, buttons) receive focus
- **Focus indicators**: 96 instances of `focus:ring` / `focus-visible:ring` matching 96 instances of `outline-none` — focus rings are consistently applied
- **Command Palette** (`CommandPalette.tsx`): Full focus trap with `Tab`/`Shift+Tab` cycling
- **SelectableList** (`SelectableList.tsx`): Arrow key navigation with roving tabindex
- **Context Menu** (`ContextMenu.tsx`): Arrow key navigation for menu items
- **Combobox** (`Combobox.tsx`): Proper ARIA combobox pattern with keyboard support
- **TabBar** (`TabBar.tsx`): Proper `role="tab"` with keyboard navigation
- **Kanban Board** (`KanbanBoard.tsx`): `role="button"` with `aria-grabbed` and keyboard instructions

### Issues found:
- **Drag-and-drop**: KanbanBoard has ARIA attributes but actual keyboard-only drag reordering may not fully work (uses `@dnd-kit` which has limited keyboard support)
- **Org Chart** (`OrgChartPage.tsx`): Uses roving tabindex (`tabIndex={isFocused ? 0 : -1}`) which is good, but some child elements have `tabIndex={-1}` that may be unreachable
- **Bulk action menus** (`BulkActionBar.tsx`): Status dropdown opens but lacks `aria-live` region for screen reader announcement

---

## 4. Color Contrast Failures

**Total unique contrast failure patterns: ~30+ component locations**

### Critical failures (ratio < 3:1):

| Ratio | Pattern | Location(s) |
|-------|---------|-------------|
| **2.15:1** | White text on `amber-500` badge | TeamMode, StatusOverviewPage |
| **2.28:1** | White text on `green-500` badge | TeamMode |
| **2.54:1** | White text on `emerald-500` badge | StatusOverviewPage |
| **2.59:1** | `text-accent` on dark bg (dashboard day labels) | DashboardVariantC |
| **2.89:1** | `text-accent` ("Week 14" label) | TeamMode, StatusOverviewPage |

### Serious failures (ratio 3:1 – 4.5:1):

| Ratio | Pattern | Location(s) |
|-------|---------|-------------|
| **3.68:1** | White text on `blue-500` badge | StatusOverviewPage |
| **3.76:1** | White text on `red-500` badge | TeamMode, StatusOverviewPage |
| **4.23:1** | White text on `violet-500` badge | TeamMode, StatusOverviewPage |
| **4.47:1** | White text on `indigo-500` badge | TeamMode |

### Systemic patterns (unmeasurable due to alpha transparency):

| Pattern | Class | Files affected |
|---------|-------|---------------|
| Muted text at 50% opacity | `text-muted/50` | ~15 files |
| Accent text on accent/20 bg | `bg-accent/20 text-accent` | ~20 files |
| Muted badge counts | `bg-muted/30 text-muted` | Projects, Issues |

---

## 5. Missing ARIA Labels or Roles

### Present and correct:
- `<html lang="en">` — yes
- Skip navigation link — yes (`App.tsx:265`)
- Main landmark — yes (`<main id="main-content" role="main">` at `App.tsx:541`)
- Nav landmark — yes (`<nav role="navigation" aria-label="Primary navigation">` at `App.tsx:299`)
- Form labels — All inputs have associated labels (many use `sr-only` class)
- Image alt text — All `<img>` elements have `alt` attributes
- USWDS Icon component — Properly sets `aria-hidden="true"` or `role="img"` with `aria-label` (`Icon.tsx:108-117`)

### Issues:

| Issue | Location | Severity |
|-------|----------|----------|
| Radix focus guard focusable while aria-hidden | Every page (from Radix UI primitives) | Low (intentional library behavior) |
| Dialog backdrop hides focusable content | Every page with modal/dialog | Low (Radix pattern) |
| Heading hierarchy: H2 used as primary heading, no H1 on pages | All pages | Moderate |
| Missing aria-hidden on decorative SVGs | ~220+ inline SVG elements across components (ActionItems, AccountabilityBanner, AccountabilityGrid, etc.) | Moderate |
| Drag-and-drop lacks aria-live announcements | KanbanBoard.tsx | Moderate |

---

## 6. Per-Page Detailed Results

### Login (/login)
- Errors: 8, Warnings: 6
- ERROR [aria-hidden-focus]: 7 (Radix focus-guard + skip-link + nav)
- ERROR [color-contrast]: 1 (nav active button with bg-accent/20 text-accent)
- WARN: heading nesting (2), position:fixed (1), transparency contrast (3)

### Dashboard (/dashboard)
- Errors: 22, Warnings: 19
- ERROR [color-contrast]: 16 elements — day labels (text-muted/50 ratio 2.59:1), active sidebar button (text-accent), day abbreviations in week view
- ERROR [aria-hidden-focus]: 5 (Radix focus-guard pattern + modal backdrop)
- ERROR [G18.Fail]: Explicit contrast failure — "Tue" label text-accent at 2.59:1
- WARN: transparency contrast (15), heading nesting (2), position:fixed (1)

### My Week (/my-week)
- Errors: 28, Warnings: 16
- ERROR [color-contrast]: 23 elements — "Current" badge (bg-accent/20 text-accent), numbered list items (text-muted/50), plan item labels, week indicators
- ERROR [aria-hidden-focus]: 5 (Radix pattern)
- WARN: transparency contrast (12), heading nesting (2), position:fixed (1)

### Documents (/docs)
- Errors: 8, Warnings: 6
- ERROR [aria-hidden-focus]: 7 (Radix pattern)
- ERROR [color-contrast]: 1 (nav active button)
- WARN: heading nesting (2), transparency (2), position:fixed (1)

### Issues (/issues)
- Errors: 10, Warnings: 318
- ERROR [aria-hidden-focus]: 9 (Radix pattern)
- ERROR [color-contrast]: 1 (nav active button)
- WARN: transparency contrast (314 — every issue row has multiple transparent elements), heading nesting (2), position:fixed (1)

### Projects (/projects)
- Errors: 31, Warnings: 26
- ERROR [color-contrast]: 22 elements — filter tab count badges (bg-muted/30 text-muted), completion percentage badges (bg-accent/20 text-accent), project table cells
- ERROR [aria-hidden-focus]: 9 (Radix pattern)
- WARN: transparency contrast (22), heading nesting (2), position:fixed (1)

### Programs (/programs)
- Errors: 9, Warnings: 11
- ERROR [aria-hidden-focus]: 8 (Radix pattern)
- ERROR [color-contrast]: 1 (nav active button)
- WARN: transparency contrast (7), heading nesting (2), position:fixed (1)

### Team Allocation (/team/allocation)
- Errors: 28, Warnings: 19
- ERROR [G18.Fail]: 6 explicit failures — program color badges with white text on: violet-500 (4.23:1), amber-500 (2.15:1), red-500 (3.76:1), green-500 (2.28:1), indigo-500 (4.47:1), blue-500 (3.68:1)
- ERROR [color-contrast]: 12 elements — "Week 14" text-accent (2.89:1), nav active button, program badges
- ERROR [aria-hidden-focus]: 5 (Radix pattern)
- WARN: transparency contrast (15), heading nesting (2), position:fixed (1)

### Team Directory (/team/directory)
- Errors: 8, Warnings: 18
- ERROR [aria-hidden-focus]: 5 (Radix pattern)
- ERROR [color-contrast]: 3 (nav active button, notification text-muted, standup action text)
- WARN: transparency contrast (14), heading nesting (2), position:fixed (1)

### Team Status (/team/status)
- Errors: 18, Warnings: 30
- ERROR [G18.Fail]: 6 explicit failures — status badges with white text on colored backgrounds: emerald-500 (2.54:1), violet-500 (4.23:1), amber-500 (2.15:1), red-500 (3.76:1), blue-500 (3.68:1)
- ERROR [color-contrast]: 7 elements — "Week 14" text-accent, nav button, status badges
- ERROR [aria-hidden-focus]: 5 (Radix pattern)
- WARN: transparency contrast (26), heading nesting (2), position:fixed (1)

### Settings (/settings)
- Errors: 8, Warnings: 11
- ERROR [aria-hidden-focus]: 5 (Radix pattern)
- ERROR [color-contrast]: 3 (nav active button, notification text, action items text)
- WARN: transparency contrast (7), heading nesting (2), position:fixed (1)

---

## Summary Scorecard

| Metric | Baseline |
|--------|----------|
| **Lighthouse accessibility score (per page)** | 96–100 (avg 98.7) |
| **Total Critical/Serious violations** | **178 errors** (95 color-contrast, 55 aria-hidden-focus, 28 explicit contrast failures) |
| **Keyboard navigation completeness** | **Partial** — main flows work, drag-and-drop and some advanced interactions incomplete |
| **Color contrast failures** | **~30+ unique patterns** across all pages; systemic use of low-opacity text (`text-muted/50`, `text-accent` on dark) |
| **Missing ARIA labels or roles** | Heading hierarchy (no H1, H2 as primary heading on all pages); ~220 decorative SVGs without `aria-hidden`; Radix focus-guard pattern (55 instances, low severity) |

---

## Top Recommendations (Priority Order)

1. **Fix color contrast** — Replace `text-muted/50` with a solid color meeting 4.5:1 ratio. Darken badge backgrounds or use dark text on light badges instead of white-on-color.
2. **Fix heading hierarchy** — Add a visually-hidden H1 to each page or promote the existing H2 to H1.
3. **Add `aria-hidden="true"` to decorative SVGs** — Audit all inline `<svg>` elements and add `aria-hidden="true"` to decorative ones.
4. **Monitor Radix UI focus-guard** — The `aria-hidden-focus` violations are from Radix UI's focus management. Track upstream fixes or consider overriding `tabindex` on focus guards.
5. **Improve drag-and-drop keyboard support** — Add `aria-live` region to announce drag/drop state changes in KanbanBoard.

---

## 7. Deep Audit — WCAG 2.1 AAA Scan (Stricter Standard)

Running against AAA (7:1 contrast ratio, stricter heading rules) reveals the true scope:

| Page | Errors | Warnings | Notices |
|------|--------|----------|---------|
| Login | 30 | 2 | 56 |
| Dashboard | 53 | 2 | 45 |
| My Week | 77 | 2 | 45 |
| Documents | 30 | 2 | 56 |
| Issues | **1039** | 2 | 45 |
| Projects | 169 | 2 | 45 |
| Programs | 65 | 2 | 45 |
| Team Allocation | 88 | 2 | 45 |
| Team Directory | 53 | 2 | 45 |
| Team Status | 113 | 2 | 45 |
| Team Org Chart | 53 | 2 | 45 |
| Team Reviews | 75 | 2 | 45 |
| Settings | 65 | 2 | 45 |
| Issue Editor | 143 | 13 | 253 |
| Issue Editor 2 | 144 | 13 | 253 |

**AAA TOTALS: 2,197 errors, 52 warnings, 1,113 notices**

### Unique AAA error types:
- **`G17.Fail` (AAA contrast 7:1)** — 1,960 instances. Nearly every text element on every page fails the 7:1 enhanced contrast ratio. The dark theme's `#8a8a8a` muted text on `#0d0d0d` background achieves only ~5.3:1.
- **`color-contrast` (axe-core)** — 111 instances (AA-level failures, same as before)
- **`aria-hidden-focus`** — 96 instances (Radix UI pattern)
- **`G141` (heading nesting)** — 30 instances (no H1 on any page)

---

## 8. Deep Audit — Zoom/Reflow (200% and 400%)

WCAG 1.4.4 (Resize Text) requires content to work at 200% zoom. WCAG 1.4.10 (Reflow) requires no horizontal scrolling at 400% / 320px viewport.

| Page | 200% Issues | 400% Issues |
|------|-------------|-------------|
| Dashboard | 1 text-clipping (sr-only link) | 1 text-clipping |
| Issues | **10 text-clipping** — issue titles truncated | **10 text-clipping** |
| Issue Editor | **10 text-clipping** — sidebar issue titles truncated | **10 text-clipping** |
| Team Allocation | **9 text-clipping** — project names truncated (`.truncate` class) | **9 text-clipping** |
| Team Status | 1 text-clipping | 1 text-clipping |

**Key finding:** Issue titles in the sidebar use `overflow: hidden` with `text-overflow: ellipsis` (`.truncate`, `.flex-1`) which clips content at both 200% and 400% zoom. Team Allocation project names similarly clipped. Content is lost, not just truncated — no mechanism to see full text.

---

## 9. Deep Audit — Focus Indicators

**48 interactive elements lack visible focus indicators** on the Documents page alone:

- Skip-to-content link (A.sr-only)
- Accountability banner button
- All icon rail navigation buttons (Dashboard, Docs, Programs, Projects, Teams, Settings)
- User avatar button
- "New document" button
- "Collapse sidebar" button
- Tree expand/collapse buttons
- All document links in the sidebar tree
- All "Document actions" context menu triggers

These elements use `outline-none` (or Tailwind's `focus:outline-none`) but rely on `focus:ring` or `focus-visible:ring` — the issue is that `:focus-visible` doesn't trigger on mouse click, but more critically, **the focus ring may not be visible on the dark background** due to low contrast of the ring color.

---

## 10. Deep Audit — Computed Contrast Failures (Runtime Measurement)

Browser-computed contrast measurement found:

| Ratio | Text | Color | Background | Class |
|-------|------|-------|------------|-------|
| **1:1** | "S" (workspace initial) | `rgb(0, 94, 162)` | `rgba(0, 94, 162, 0.2)` | `flex h-8 w-8` |

The workspace initial button has **identical foreground and effective background hue** — `text-accent` on `bg-accent/20` yields near-invisible text for the single-letter workspace identifier.

---

## 11. Deep Audit — Reduced Motion

**1 animation still running** with `prefers-reduced-motion: reduce`:
- An SVG `pulse` animation (likely a loading indicator or notification badge)

WCAG 2.3.3 requires respecting the user's motion preferences.

---

## 12. Deep Audit — Additional Findings from Static Analysis

### Tables without accessible names (WCAG 1.3.1)
All `<table>` elements lack `aria-label`, `aria-labelledby`, or `<caption>`:
- `AdminDashboard.tsx` — 3 tables (workspaces list, users, audit log)
- `AdminWorkspaceDetail.tsx` — 2 tables (members, invites)
- `WorkspaceSettings.tsx` — 4 tables (members, invites, API keys, webhook config)
- `TeamDirectory.tsx` — 1 table (team members)
- `IssuesList.tsx` — 1 table (issues list)
- `Projects.tsx` — 1 table (projects list)
- `Programs.tsx` — 1 table (programs list)
- `Documents.tsx` — 1 table (documents list)
- `SelectableList.tsx` — shared component used by multiple pages

### Form controls without programmatic labels (WCAG 4.1.2)
`PropertyRow` component (`web/src/components/ui/PropertyRow.tsx`) renders a `<label>` that is **not associated** with its child input/select via `htmlFor`/`id`. This means all property sidebar selects (Status, Priority, Assignee, etc.) across Issue, Project, Week, and Wiki editors are **unlabeled to screen readers**.

Affected selects:
- `IssueSidebar.tsx` — Status, Priority, Estimate selects
- `WeekSidebar.tsx` — Status select
- `ProjectSidebar.tsx` — Status select
- `DocumentTypeSelector.tsx` — Type select
- `AdminWorkspaceDetail.tsx` — 3 selects (role, add-user role, invite role) — zero ARIA labels in entire file

### No light mode / high contrast mode (WCAG 1.4.3, Section 508)
The application is **hard-coded to dark mode only**:
- `tailwind.config.js` defines fixed dark colors (`background: '#0d0d0d'`, `foreground: '#f5f5f5'`)
- No `darkMode` config in Tailwind (so `dark:` utilities in code are dead code)
- No theme toggle exists
- No `prefers-color-scheme` media query for CSS (only in HTML meta tags)
- No Windows High Contrast Mode support (`forced-colors` media query absent)

### Decorative SVGs without aria-hidden (~220+)
Inline `<svg>` icons in these components lack `aria-hidden="true"`:
- `ActionItems.tsx`, `ActionItemsModal.tsx`
- `AccountabilityBanner.tsx`, `AccountabilityGrid.tsx`
- `DashboardVariantC.tsx`
- `StandupFeed.tsx`
- Various sidebar components

(The USWDS `Icon` component properly handles this — the issue is hand-coded SVGs.)

---

## Revised Summary Scorecard

| Metric | Baseline |
|--------|----------|
| **Lighthouse accessibility score** | 96–100 (avg 98.7) — scores are inflated; Lighthouse samples a subset |
| **pa11y WCAG AA errors** | **178** across 11 pages |
| **pa11y WCAG AAA errors** | **2,197** across 15 pages (incl. editor) |
| **Total Critical/Serious (AA)** | 95 color-contrast + 55 aria-hidden-focus + 28 measured contrast failures |
| **Keyboard navigation** | **Partial** — 48 elements missing visible focus indicators; drag-and-drop incomplete |
| **Color contrast failures** | **~30+ unique patterns**; worst ratio 1:1 (workspace initial), many at 2.15:1–2.89:1 |
| **Zoom/reflow failures** | Text clipping at 200%/400% on Issues, Editor sidebar, Team Allocation (~30 elements) |
| **Missing ARIA labels/roles** | No H1 on any page; ~13 tables without names; all PropertyRow selects unlabeled; ~220 SVGs without aria-hidden; AdminWorkspaceDetail has zero ARIA |
| **Theme/contrast modes** | **Dark mode only** — no light mode, no high-contrast, no forced-colors support |
| **Reduced motion** | 1 animation ignores `prefers-reduced-motion` |
