# Ship Graph Agent Pre-Search

**Framework:** LangGraph (provides conditional branching, parallel node execution, state management). All graph runs are traced via LangSmith from day one. AI reasoning is powered by the Gemini API (Google AI SDK).

**Architecture principle:** Both proactive and on-demand modes run through the same LangGraph graph. The difference is the trigger, not the graph.

## Phase 1: Define Your Agent

### 1. Agent Responsibility Scoping
* **What events in Ship should the agent monitor proactively?**
  Issue status change, issue priority change, issue update change, issue assignee change, new issue, retro status, retro ICE scores, retro completed issues count, retro outstanding issues count, program creation, project added to program, project owner change, project consulted change, project informed change.
* **What constitutes a condition worth surfacing?**
  Excessive high priority on project (>7), excessive medium priority on project (>10), excessive in progress statuses on project (>5), high ratio of completed to excessive issues in retro (> 3:1), excessive high priority on assignee (>2), excessive medium priority on assignee (>3), too long since update on high priority (> 2 days), too long since update on medium priority (> 5 days), too long since update on low priority (> 30 days).
  When person-level and project-level thresholds conflict (e.g., agent wants to demote an issue for person relief, but the project isn't over its threshold), person-level takes precedence for suggestions — the agent suggests the change and explains the person-level justification. The PM can dismiss if the project context overrides.
* **What is the agent allowed to do without human approval?**
  The agent is allowed to create new requests for the user to: change issue priority or change issue status. The agent is also allowed to draft a retro completion and create a request for user approval. It cannot finalize or 'close' a document without a human signature. It can also decide that it *should* plan a project and create a request for user approval to do so. It can also look at projects that could be worth building.
  The agent authenticates as a service account but writes suggestions *for* specific users. Every `agent_actions` row has a `target_user_id` — the service account is the author, the target user is the audience.
* **What must always require confirmation?**
  The agent will always require confirmation to change issue priority or change issue status. It will also require confirmation that it is okay to put together the initial issues for an empty project. The same will be true for projects that it suggests every morning: it will require user permission to create those projects, following a requisite conversation about the project details (impact, complexity, etc).
* **How does the agent know who is on a project?**
  Look at who has issues assigned to them on that project. The assignees are the team. No need for explicit membership. If you have issues on a project, you're on it.
* **How does the agent know who to notify?**
  - Issue-level alerts (stale updates, priority concerns) → notify the assignee
  - Project-level alerts (too many high-priority, too many in-progress) → notify the project owner. If no explicit owner, look for a Program Owner first. If no Program Owner exists, notify the de facto lead (assignee with the most issues) but tag the notification as 'Unowned Project' to alert the Director.
  - Retro alerts → notify the week owner
* **How does the on-demand mode use context from the current view?**
  The on-demand mode is accessed via a chat interface embedded directly in the Ship UI — not a standalone chatbot page. The chat panel is context-aware: opening it on an issue scopes the agent to that issue, opening it on a sprint scopes to that sprint. The current view (document, mode, filters) is passed as context to the LangGraph graph's Trigger Context node.

  When a user opens the agent from inside Ship, pass the current view as context: which document they're looking at, which mode (Programs/Weeks/Resource), and any active filters. The agent then scopes its analysis to that context instead of scanning everything. E.g., if you're looking at a project, it analyzes that project. If you're in the Resource view filtered to a person, it analyzes that person's workload.

* **What does the agent reason about differently in on-demand vs. proactive mode?**
  Proactive reasoning is threshold-driven and narrow: "did this change violate a rule?" The agent checks specific conditions and only speaks when something is wrong.

  On-demand reasoning is open-ended and exploratory. The user asks a question or requests analysis, and the Gemini reasoning node interprets the fetched data in context. Examples:
  - "What's the biggest risk on this project?" — the agent reasons about priority distribution, staleness patterns, assignee load, and velocity trends to identify risk, even if no threshold is violated.
  - "How is this sprint going?" — the agent synthesizes completion rate, carryover trend, and blockers into a narrative assessment.
  - "What should I work on next?" — the agent considers the user's current assignments, priorities, deadlines, and team context to recommend the highest-impact next action.
  - "Why is this project behind?" — the agent traces back through issue history, carryover, and assignee patterns to construct a causal explanation.

  The key difference: proactive mode asks "is something wrong?" On-demand mode asks "what does the user want to know?" — which may include things that are fine but worth understanding.

### 2. Use Case Discovery (minimum 5)
Role: Director
  - Trigger: Morning scan — looks across all programs/projects for systemic issues
  - Detection: Finds projects with priority inflation (>7 high), overloaded individuals (>2 high across all their work), stale high-priority items across the org
  - Human Decision: Director decides whether to escalate, reassign across teams, or adjust project scope

  Role: PM
  - Trigger: Project-level changes — new issues added, status changes, retro window approaching
  - Detection: Surfaces project health: too many items in-progress (>5), priority distribution skewed, retro has enough data to complete, empty project that needs initial planning
  - Human Decision: PM approves priority changes, confirms retro completion, greenlights initial issue breakdown for a new project

  Role: Engineer
  - Trigger: Assignment changes or staleness on their own issues
  - Detection: "You have a high-priority issue with no update in 2 days", "3 items in-progress — consider finishing one before starting another"
  - Human Decision: Engineer updates status, reprioritizes, or pushes back on load

  Use Case 4: Morning Briefing
  - Trigger: Daily scheduled run (no user present)
  - Detection: Agent compiles overnight changes, new issues, approaching staleness thresholds, retros ready for completion
  - Human Decision: User reviews briefing, approves/dismisses suggested actions

  Use Case 5: Project Kickoff Suggestion
  - Trigger: Agent identifies a pattern worth a new project — e.g., recurring issues without a parent project, or suggests projects based on its assessment of what could be valuable
  - Detection: Clusters orphaned issues or uses its own reasoning about what the org should build
  - Human Decision: User has a conversation with the agent about impact/complexity, then approves project creation and initial issue breakdown
  - What is worth building will be defined according to heuristics: (a) clustering orphaned issues into themes, (b) reading org-level wiki docs for stated goals, (c) user-seeded prompts like "we want to improve onboarding", (d) all of the above. Needs its own deeper design pass.

  Use Case 6: Coach (on-demand)
  - Trigger: User invokes agent while looking at their own work or a direct report's work
  - Detection: Analyzes patterns over time — "You tend to underestimate high-priority items", "This person has had 3 consecutive weeks with carryover", "Your done-to-added ratio has been declining for 4 weeks"
  - Human Decision: User decides whether to adjust behavior, tell the agent to make its suggested adjustments if any, have a conversation with the report, or dismiss the observation
  - Pattern detection is scoped per-person across all their projects — not per-project. "Carryover" means issues assigned to this person that rolled from one week to the next, regardless of project. "Done-to-added ratio" is this person's total done vs. total new assignments. Project-level patterns are covered by the Director and PM use cases, not Coach.

  Use Case 7: Retro Autopilot
  - Trigger: Week ends (Mon 08:00 in the workspace timezone, with option to change) and retro document exists but is empty. The agent will not draft if the project has 0 completed issues to avoid 'empty' drafts. Workspace timezone must be stored as a workspace setting; default to UTC if not set.
  - Detection: Agent pulls completed issues, carryover issues, ICE scores, and velocity data — drafts the retro content with what went well, what carried over, and why
  - Human Decision: User reviews the draft, edits it, and confirms completion
  - The agent can only draft from quantitative data (completed issues, carryover, velocity). Qualitative observations — "we got blocked by the design team," "requirements changed mid-week" — aren't in the issue data. Set the expectation: the draft is quantitative scaffolding, the user adds the narrative.

  Use Case 8: Load Balancer (on-demand)
  - Trigger: PM or Director invokes agent from Resource view
  - Detection: Compares workload across all people on a project or program — hours estimated, priority weights, number of in-progress items. Suggests specific reassignments: "Move AUTH-42 from Alice to Frank — Alice has 3 high-priority, Frank has capacity"
  - Human Decision: Approves or rejects each suggested reassignment
  - Director Overview (proactive) may surface the same overload that Load Balancer (on-demand) addresses. Intended relationship: the briefing is the *alert*, Load Balancer is the *tool to act on it*. Briefing suggestions should link to Load Balancer when the fix involves reassignment.

### 3. Trigger Model Decision
* **When does the proactive agent run without a user present?**
  Two schedules:
  - Morning briefing: Once daily, early morning before work starts. Scans everything, generates briefings per user, queues suggested actions.
  - Event-driven: Whenever a document changes (issue updated, status changed, new issue created). This is where the thresholds get checked — did this change push a project over 7 high-priority items?
  - Staleness cron (hourly): Scans for issues that have aged past their update thresholds. The absence of an update never triggers a webhook, so staleness detection requires a scheduled tick.
* **Poll vs. webhook vs. hybrid - what are the tradeoffs?**
  - Webhook-style (event-driven): You already have WebSocket infrastructure for collaboration. When a document mutation hits the API, fire an internal event that the agent evaluates. No polling overhead, rapid detection. This covers use cases 1-3 and 5 — anything triggered by a change.
  - Poll (scheduled): Morning briefing (use case 4) and retro autopilot (use case 7) are time-based. Additionally, staleness checks ("no update in 2 days") require a scheduled tick — an hourly cron job will scan for issues that have aged past their update thresholds, since the absence of an update will never trigger a webhook.

  Pure polling would mean scanning all projects every N minutes looking for changes you already know about at write time. Wasteful. Pure webhooks miss the time-based triggers and can't detect the absence of events.

  All data mutations — including bulk operations, imports, and scripts — must go through the API. A bulk API endpoint accepts multiple mutations in one request and fires events for all of them. The agent's 30-second debounce window naturally batches these into a single evaluation. No bypass paths, no special rescan mechanisms — if it writes data, it goes through the API and the agent sees it.

* **How stale is too stale for your use cases?**
  For event-driven: detection should happen within seconds of the triggering change, since it's evaluated inline or immediately after the API write. No staleness concern.

  For scheduled: morning briefing runs once daily, so up to 24 hours stale — but that's fine because it's a summary, not an alert. Retro autopilot checks at week end, staleness is irrelevant.

  The real staleness question is: how long between "agent detects condition" and "user sees it"? If the user is online, instant via WebSocket. If offline, they see it next time they open Ship. That's acceptable — this isn't an incident response system.

* **What does your choice cost at 100 projects? At 1,000?**
  Event-driven cost scales with write volume, not project count. Each document mutation triggers a lightweight threshold check (a few SQL
  queries against that project's issues). No Gemini call needed for threshold detection — that's just math.
  Debouncing scope: a single issue reassignment can affect two projects and one person. The debounce window groups by *all* affected entities (projects + persons), not just the changed document's project.

  Gemini calls happen only when:
  - Composing the morning briefing (~1 call per user per day)
  - Drafting a retro (~1 call per retro)
  - Coach or Load Balancer on-demand (~1 call per user request)
  - Project kickoff suggestion (~1 call when conditions met)

  At 100 projects: maybe 20 users, so ~20 morning briefings/day + a handful of on-demand calls. Negligible cost. Pennies.

  At 1,000 projects: the threshold checks are still just SQL. The Gemini calls scale with users and actions, not projects. Maybe 200 users = 200 briefings/day. Still manageable — the main cost cliff would be if you ran Gemini reasoning on every single document change, which this design avoids.

  At 10,000 projects: ~2,000 users. 2,000 morning briefings/day is the primary cost driver. Threshold checks remain SQL-only and scale linearly with event volume. The debounce window and per-project scoping keep API call count proportional to active projects, not total. On-demand costs scale with user engagement, not project count. The architecture holds — no redesign needed, just infrastructure scaling for the worker process and database query load.

## Phase 2: Graph Architecture

### 4. Node Design
* **What are your context, fetch, reasoning, action, and output nodes?**
  - Trigger Context — what kicked this off? Event-driven (which document changed, what changed) or scheduled (morning briefing, retro check) or on-demand (which user, which view they're on)
  - User Context — who is this for? Their role, their assignments, their history with the coach. Role (Director, PM, Engineer) must be an explicit property on the person document — not inferred — so the agent can reliably tailor output. The same violation is framed differently per audience: a director sees "across your portfolio, AUTH is the worst offender," an engineer sees "your assigned issue AUTH-42 is one of 9."

  For Event-driven triggers, implement a standard 30-second debounce window. If multiple mutations occur on the same project (e.g., a bulk CSV import or a PM cleaning up a board), the agent batches them into a single Graph run to prevent redundant queries and notification spam.

  - Project Fetch — issues, priorities, statuses, assignees for a project
  - Person Fetch — all issues assigned to a person across projects, their workload
  - Program Fetch — all projects in a program, rollup health
  - Retro Fetch — completed issues, carryover, ICE scores, velocity for a week
  - History Fetch — past agent suggestions and whether user accepted/dismissed (for coach patterns)

  Reasoning nodes (evaluate and decide):
  - Threshold Evaluator — deterministic math, no Gemini call. Checks all defined thresholds (>7 high priority, >2 days stale, etc.). Outputs a structured violations list. This node always runs and is always visible in the LangSmith trace.
  > **v2 optimization:** To prevent database pressure during bulk updates, consider a `project_stats` table with running counters via database triggers. Not needed at v1 scale.
  - Gemini Reasoner — always runs after Threshold Evaluator, on every graph execution. On a **clean run** (no violations), it performs a lightweight health summary: "Project AUTH looks healthy — 3 issues in progress, all updated within 24 hours." On a **problem-detected run**, it performs deep analysis: reasoning about relationships between violations, root causes, risk assessment, and concrete recommendations. This ensures the LangSmith trace shows visibly different execution paths — the Gemini Reasoner produces different output and routes to different action nodes depending on what the Threshold Evaluator found. For on-demand mode, the Gemini Reasoner takes the user's question as additional input and reasons about the fetched data in the context of that question.

  Action nodes (produce mutations):
  - Suggestion Generator — creates pending action requests (change priority, change status, reassign)
  - Draft Generator — creates draft content (retro text, project issue breakdown). Writes via REST API, not the Yjs collaboration protocol. If a user opens the document between the presence check and the write completing, the REST-written content and Yjs state could diverge. Mitigation: after writing via REST, invalidate the Yjs cache for that document so the next user to open it gets a fresh sync.
  - Briefing Composer — assembles the morning briefing from all violations and insights

  Output nodes (deliver to user):
  - Notification Sender — pushes to user via WebSocket if online, queues if offline
  - Action Queue Writer — persists suggested actions for user to approve/dismiss in the UI

* **Which fetch nodes run in parallel?**
  Almost all of them, depending on the trigger:

  - Morning briefing: Program Fetch, Person Fetch, and Retro Fetch all run in parallel (they're independent queries). History Fetch can also run in parallel.
  - Event-driven (issue changed): Project Fetch and Person Fetch run in parallel — you need both the project's health and the assignee's load to evaluate thresholds.
  - On-demand coach: Person Fetch and History Fetch run in parallel.

  The only sequencing: Fetch nodes must complete before Reasoning nodes. Gemini Reasoner always runs after Threshold Evaluator — on clean runs it produces a lightweight summary, on problem runs it performs deep analysis.

* **Where are your conditional edges and what triggers each branch?**
  Three key branch points:

  1. After Trigger Context → which fetch nodes to invoke. Event-driven triggers only fetch the affected project + person. Scheduled triggers fetch everything. On-demand fetches based on the user's current view.
  2. After Threshold Evaluator → Gemini Reasoner always runs, but the conditional edge determines its *mode*. Clean run (no violations) → Gemini produces a lightweight health summary and the graph routes to Notification Sender only. Problem-detected run → Gemini performs deep analysis and the graph routes to Suggestion Generator and/or Draft Generator. This ensures visibly different LangSmith traces for clean vs. problem runs.
  3. After Gemini Reasoner → which output path. If the reasoning produced actionable suggestions (priority change, reassignment) → Action Queue Writer. If it produced content (retro draft, briefing) → Draft Generator → Notification Sender. If both → both paths run in parallel. If clean → summary notification only.

  A fourth minor branch: After Notification Sender → online vs. offline. WebSocket if connected, persist to queue if not.

### 5. State Management
* **What state does the graph carry across a session?**
  - Trigger payload — the event or schedule context that started this run
  - Fetched data — project issues, person workloads, retro data. Lives only for the duration of the run, discarded after.
  - Violations list — output of Threshold Evaluator, passed to Gemini Reasoner
  - Generated suggestions — the actions and drafts produced, passed to output nodes
  - User context — role, current view (for on-demand), carried through so output is scoped correctly
  - Conversation context (Coach and Project Kickoff only) — these use cases involve multi-turn conversation. A lightweight conversation session (stored in memory or a short-lived database row) accumulates user messages and passes them as additional context to each new graph run. The graph itself remains single-pass; the conversation wrapper calls it repeatedly with growing context.

* **What state persists between proactive runs?**
  - Suggestion history - what the agent suggested and whether the user accepted, dismissed, or snoozed. This is essential for the Coach use case (pattern detection over time) and for avoiding nagging (don't re-suggest something that was dismissed yesterday).
  - Coach detects patterns like "3 consecutive weeks with carryover" — that requires weeks of suggestion history before it has anything useful to say. Options: (a) accept a ramp-up period where Coach is silent, (b) backfill history from existing issue/retro data at agent launch (derive past patterns from what's already in the database), (c) both — backfill what you can, acknowledge Coach improves over time.
  - Last-run timestamps - per project, per user. So event-driven runs know what's already been evaluated and scheduled runs can detect "new since last briefing."
  - Snooze/dismiss state - if a user dismisses "AUTH has too many high-priority items," don't surface it again until the count changes.
  - User Sensitivity Score - Track the ratio of 'Dismiss' vs. 'Approve' per user. If a user dismisses >80% of alerts, the agent automatically increases the threshold for that user (e.g., from >7 high priority to >10) to reduce 'notification fatigue' and maintain perceived value.

  This is a small table — something like agent_actions(id, user_id, action_type, context, status, created_at, resolved_at). Not a complex persistence layer.

* **How do you avoid redundant API calls?**
  Three mechanisms:

  1. Event-driven scoping. When an issue changes, you already know which project and which assignee are affected. Only fetch data for those — not all projects.
  2. Last-run diffing. For morning briefings, track what was reported yesterday. If the violation set is identical (same projects over threshold, same stale issues), don't regenerate — just confirm "no changes since yesterday" or skip entirely.
  3. Fetch result sharing within a run. If a single event triggers both a project-level and person-level evaluation, the issue data fetched once serves both reasoning paths. Pass it through state rather than querying twice.

  No external cache layer needed. The database is the cache — these are just SQL queries against data you already have.

### 6. Human-in-the-Loop Design
* **Which actions require confirmation?**
  Everything that mutates data:
  - Change issue priority
  - Change issue status
  - Create issues (project kickoff breakdown)
  - Complete a retro
  - Create a new project

  Everything that's read-only does not need confirmation:
  - Morning briefing
  - Coach observations
  - Load balance suggestions (until you approve a specific reassignment)
  - Threshold alerts

  Simple rule: if it writes to the board, it asks first.

* **What does the confirmation experience look like in Ship?**
  An action queue that lives in the UI — think of it as the agent's inbox to you.
  - The action queue is a new UI surface that needs design. It will live in a new mode alongside Programs/Weeks/Resource/Docs.
  - If a director oversees 15 projects and 8 are over threshold, that's 8+ suggestions in one morning. The action queue should rank by severity and cap at top N items per user per day (e.g., 5), with a "see all" expansion. Otherwise the volume undermines the value. Ranking uses a unified severity score: each violation type gets a base weight (e.g., stale high-priority = 8, project over threshold = 6, person overloaded = 7), multiplied by how far over threshold the condition is (e.g., 9 high-priority on a >7 threshold = 6 x 2 = 12).
  Each item shows:
  - What the agent wants to do ("Change AUTH-42 from high to medium priority")
  - Why ("Project AUTH has 9 high-priority issues, above the 7 threshold. This issue has had no update in 14 days.")
  - Three buttons: Approve, Dismiss, Snooze

  For richer actions like retro drafts or project kickoff plans, the agent opens the draft in the editor and you edit it before confirming. It's not a modal — it's content in the document you can revise. Before drafting, the agent checks WebSocket presence data. If a user is actively editing the document, the agent queues the draft in the UI sidebar as a suggestion rather than mutating the live canvas.

  For morning briefings, it's a notification with a summary. No approval needed, just read it. Suggested actions within the briefing link to their action queue items.

* **What happens if the human dismisses or snoozes?**
  Dismiss: Agent records it and won't resurface that specific suggestion. But if conditions change (e.g., the high-priority count goes from 9 to 11), it can raise it again as a new violation. The dismiss applies to the snapshot, not the rule.

  Snooze: Agent suppresses that suggestion for a duration (24h, 1 week — user picks). After the snooze expires, it re-evaluates. If the condition has *worsened* (e.g., high priority count went from 8 to 10), it resurfaces. If the condition is exactly the same or improved but still over threshold, the agent silently archives it. If it resolved itself, nothing happens. This prevents the "snooze expiration trap" where users learn that snooze just delays annoyance.

  No response (ignored): Suggestions age out after a configurable window — say 7 days. Stale suggestions get auto-archived. The agent doesn't escalate or nag. If the condition is still present, a fresh evaluation on a future run will create a new suggestion.

### 7. Error and Failure Handling
* **What does the agent do when Ship API is down?**
  Retry with exponential backoff. After N failed attempts, mark the run as failed and wait for the next scheduled trigger. No partial actions — if the agent fetched some data but can't complete the run or write suggestions, it discards the whole run. Next run starts clean. This is safe because runs are stateless and idempotent. Suggestions already written to the action queue from prior runs are unaffected — they live in Ship's database.
* **How does it degrade gracefully?**
  1. Full capability. Ship API + Gemini both healthy. Agent reasons, drafts, coaches.
  2. Gemini unavailable, Ship API up. Agent falls back to structured alerts only — threshold violations rendered as templated messages (e.g., "Project X: 9 High Priority Items, threshold: 7"). Skips Coaching and Drafting nodes but maintains Threshold notifications. The system remains functional as a deterministic monitor. Still useful.
  3. Ship API down. Agent can't do anything. Retries with backoff, then waits for next trigger. No silent failures — failed runs are logged so you know the agent was offline.
* **What gets cached and for how long?**
  Persisted state (not cached — this is durable, written to the `agent_actions` database table):
  - Dismissed/snoozed suggestions. When a user refuses or snoozes a suggestion, that decision is persisted so the agent doesn't re-raise the same condition. Dismissals persist until the underlying condition changes (e.g., high-priority count goes from 9 to 12 — new violation, new suggestion). Snoozes persist for the duration the user chose (24h, 1 week, etc.) then expire and the agent re-evaluates.
  - Last-run violation snapshots. Stored per project/user so the agent can diff against the current state and only surface new or changed violations. Without this, every morning briefing would repeat everything from yesterday.
  - No fetch data caching. Every run hits Ship's API fresh. The data changes too frequently and the queries are scoped enough that caching would add complexity for no benefit.
  - No Gemini response caching. Each generation is unique to its inputs.

  The short version: the agent persists its own decisions and what users said about them, not Ship's data.

  All thresholds (>7 high priority, >2 days stale, etc.) are default starting points, but can be updated in the settings section.

## Phase 3: Stack and Deployment

### 8. Deployment Model
* **Where does the proactive agent run when no user is present?**
  A separate long-running process inside the Ship API for the recurring and additional endpoints for the on-demand, so that they can share functionalities inside the back end section of the monorepo.
* **How is it kept alive?**
  Two mechanisms depending on trigger type:
  - Scheduled runs (morning briefing, retro checks): A cron job or a simple setInterval in the worker process. If the process dies, the EB health check restarts it — same as the API server.
  - Event-driven runs: The worker subscribes to Ship's existing WebSocket event stream (document changes). When a relevant event comes through, it kicks off a graph run. If the connection drops, it reconnects with backoff.

  No orchestration framework needed. It's one process with a timer and a WebSocket listener.
* **How does it authenticate with Ship without a user session?**
  A service account — a regular user in the system (`agent@ship.internal`) with a long-lived bearer token (not a 15-minute session cookie). Ship's API needs a new bearer token auth middleware (checks `Authorization: Bearer <token>` header, falls through to session auth if absent). The `/events` WebSocket accepts the token as a query param (`?token=xxx`). This is a prerequisite (PRD Step 0) before the agent can function. Benefits:

  - Every suggestion the agent writes is attributed to a known user ("Ship Agent"), so there's an audit trail
  - The service account is a workspace member, so it has the same data access as any user — no special permissions layer
  - The token is stored as an environment variable on the worker process. Rotation is manual, quarterly — requires an EB environment variable update and worker restart. Automate in v2 if this becomes operationally painful.
  - If you ever need to revoke the agent's access, you deactivate the account like any other user
  - **Security boundary:** While the agent authenticates as the service account, Fetch Nodes must respect the read-permissions of the *target user* it is generating the briefing or suggestion for. Today this is a no-op (workspace-level permissions — all members see all documents), but this boundary must exist so that if per-program or per-document permissions are added later, the agent doesn't leak private data into unauthorized briefings.

### 9. Performance
* **How does your trigger model achieve the < 5 minute detection latency goal?**
  Event-driven triggers beat that easily. The worker receives the event, waits for the 30-second debounce window to close, runs threshold checks against the API, and writes suggestions. The whole cycle is well under a minute.

  Scheduled triggers (morning briefing) aren't latency-sensitive — they run once a day and nobody is waiting for real-time delivery.

  The only scenario where latency matters is: a change happens, the worker evaluates it, and the user is online to see the notification. That's WebSocket end-to-end. Well under 5 minutes.
* **What is your token budget per invocation?**
  Every invocation calls Gemini (the Gemini Reasoner always runs — clean runs get a health summary, problem runs get deep analysis). Token usage per invocation type:
  - Clean run (no violations): ~1-2k input (project snapshot), ~200-500 output (short summary). Cheapest path.
  - Violation run: ~2-3k input (violations + project data), ~500-1k output (structured analysis). One per triggered project.
  - Morning briefing: ~2-3k input (aggregated violations + context), ~500-1k output. One per user per day.
  - Retro draft: ~3-5k input (completed issues, carryover, velocity data), ~1-2k output. One per retro.
  - Coach insight: ~3-5k input (person's history, patterns, suggestion history), ~500-1k output. On-demand only.
  - Project kickoff: ~2-3k input, ~2-3k output (issue breakdown). Rare — only when conditions are met and user approves.

  Budget per invocation: cap at 10k total tokens. If input context exceeds that, summarize the fetch data before passing to Gemini.
* **Where are the cost cliffs in your architecture?**
  1. User count, not project count. Morning briefings scale linearly with users. 20 users = 20 Gemini calls/day, cheap. 2,000 users = 2,000 calls/day, noticeable but still manageable.
  2. Coach overuse. If every user hits Coach 10 times a day, that's the most expensive path since it needs history analysis. Mitigate with a daily cap per user (say 5 coach interactions/day) that kicks in the day following the entire team hitting a collective cap (say averaging more than 5 coach interactions/day).
  3. Event storms. A bulk import of 500 issues fires 500 events. Without batching, the worker runs 500 threshold checks in rapid succession. Mitigate with a cooldown period. A single Project/User pair can only trigger a Gemini-based suggestion once every 30 minutes, even if data changes constantly. Threshold-only (SQL) checks remain near-instant but are batched every 5 seconds.

  No cliff where costs suddenly jump by an order of magnitude. The expensive operations (Gemini calls) are gated behind user actions or daily schedules, not raw event volume.

### 10. Testing Strategy
- Threshold Evaluator: unit tests with fixture data. Given a project with N issues at X priorities, assert the correct violations are produced.
- Debounce logic: unit tests verifying event batching across entities (projects + persons).
- Gemini Reasoner: no automated correctness tests. During development, use golden-file comparisons (same input → review output manually). In production, track user approve/dismiss ratios as a proxy for quality.
- Integration: end-to-end test that fires a document change event and asserts a suggestion appears in the action queue within the debounce window.
- LangSmith tracing: every test case must produce a shared LangSmith trace link showing the full LangGraph execution. Clean runs and problem-detected runs must show visibly different execution paths in the trace. Test cases are documented in FLEETGRAPH.md with their corresponding trace links.

## Phase 4: Implementation Details

### 11. LangGraph State Schema

```typescript
interface FleetGraphState {
  // Trigger
  trigger_type: 'event' | 'scheduled' | 'on_demand';
  trigger_payload: EventPayload | SchedulePayload | OnDemandPayload;

  // User
  target_user_id: string;
  user_role: 'director' | 'pm' | 'engineer';

  // Fetched data (populated by fetch nodes)
  project_data: ProjectSnapshot | null;
  person_data: PersonSnapshot | null;
  program_data: ProgramSnapshot | null;
  retro_data: RetroSnapshot | null;
  history_data: AgentActionHistory | null;

  // Reasoning outputs
  violations: Violation[];
  gemini_output: GeminiReasonerOutput | null;

  // Action outputs
  suggestions: PendingSuggestion[];
  drafts: DraftContent[];
  notifications: Notification[];

  // On-demand chat
  conversation_history: Message[];
  user_question: string | null;
  current_view_context: ViewContext | null;

  // Meta
  run_id: string;
  errors: GraphError[];
}
```

### 12. Ship API Endpoints Required

Existing endpoints the agent calls:
- `GET /api/issues?project_id=X` — Project Fetch
- `GET /api/issues?assignee_id=X` — Person Fetch
- `GET /api/projects?program_id=X` — Program Fetch
- `GET /api/documents?program_id=X&document_type=project` — Program Fetch (all projects in a program)
- `GET /api/documents?document_type=person` — fetch person documents for user roles
- `GET /api/weeks/:id/iterations` — Retro Fetch
- `PATCH /api/issues/:id` — for approved mutations (priority, status, assignee changes)

New endpoints required:
- `POST /api/agent/suggestions` — agent writes a pending suggestion
- `GET /api/agent/suggestions?user_id=X&status=pending` — frontend fetches action queue
- `PATCH /api/agent/suggestions/:id` — user approves/dismisses/snoozes
- `POST /api/agent/on-demand` — on-demand chat endpoint (SSE streaming response)
- `POST /api/documents/bulk` — bulk mutations endpoint for imports/scripts
- `GET /api/agent/briefing/:user_id` — fetch latest morning briefing for a user

### 13. Gemini Prompt Strategy

Mode-specific system prompts, selected by the conditional edge before the Gemini call:
- `PROACTIVE_CLEAN` — "Summarize the health of this project in 2-3 sentences. Be concise."
- `PROACTIVE_VIOLATIONS` — "Analyze these violations. For each, explain the root cause, assess risk, and recommend a concrete action with a specific issue ID."
- `RETRO_DRAFT` — "Draft a retrospective from this data. Structure: what went well, what carried over, velocity trend. Use issue IDs."
- `COACH` — "Analyze this person's work patterns over the past N weeks. Identify trends, concerns, and actionable observations. Be specific with data."
- `ON_DEMAND` — "The user is looking at [context] and asked: [question]. Answer using the fetched data. Be specific — reference issue IDs, assignee names, and dates."
- `LOAD_BALANCER` — "Compare workload across these people. Suggest specific reassignments with justification. Reference issue IDs."
- `PROJECT_KICKOFF` — "Given these orphaned issues and org goals, suggest a project scope and initial issue breakdown."

Smaller, focused prompts produce better output than one prompt trying to do everything. The mode is determined before the Gemini call based on trigger type + Threshold Evaluator results.

### 14. Chat UI Design

The on-demand chat is a slide-out panel from the right edge, overlaying the properties sidebar:
- Invoked by an agent icon in the icon rail (leftmost 48px panel) + keyboard shortcut (Cmd+Shift+A or similar)
- The panel header shows what context is active: "Chatting about: AUTH-42" or "Chatting about: Project Login Revamp"
- Responses stream in real-time via SSE from the `POST /api/agent/on-demand` endpoint
- The Gemini Reasoner node streams output token-by-token back through the SSE connection; the frontend renders incrementally
- Suggested actions within chat responses are rendered as inline approve/dismiss buttons, not just text
- The panel persists across navigation within the same mode — switching documents updates the context
- Closing the panel discards the conversation (no persistence needed for on-demand chat)

### 15. Agent Actions Table Schema

```sql
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  target_user_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,  -- 'priority_change', 'status_change', 'retro_draft', 'reassignment', 'briefing', 'coach_insight'
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'dismissed', 'snoozed', 'expired'
  severity_score NUMERIC,
  context JSONB NOT NULL,            -- violation details, affected document IDs, threshold values
  suggestion JSONB NOT NULL,         -- what the agent proposes (new priority, new status, draft content)
  gemini_reasoning TEXT,             -- natural language explanation
  snooze_until TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  langsmith_trace_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_actions_user_status ON agent_actions(target_user_id, status);
CREATE INDEX idx_agent_actions_workspace ON agent_actions(workspace_id);
```

Suggestions are stored in a separate table, not as documents. They are ephemeral (expire, get dismissed), have workflow state (pending/approved/dismissed), and need fast queries by user + status. Keeping them separate preserves "everything is a document" for actual content.

### 16. On-Demand Fetch Strategy

For v1: always fetch everything relevant to the current view context, pass it all to Gemini. If the user is looking at a project, fetch all issues for that project. Let Gemini decide what's relevant to the question.

Don't try to have Gemini pick which fetch nodes to call — that adds a reasoning step before reasoning, and the data volume per project is small enough that over-fetching is cheap. Optimize in v2 if context windows become a concern at scale.

### 17. Seed Data Requirements

To demonstrate all 8 use cases, the seed data must include:
- At least 2 programs with 3+ projects each
- At least one project with >7 high-priority issues (triggers Director/PM detection)
- At least one project with >5 in-progress issues (triggers in-progress threshold)
- At least one person with >2 high-priority issues across projects (triggers person overload)
- Issues with `updated_at` older than 2 days on high-priority (triggers staleness detection)
- A completed week with enough done + carryover issues for retro drafting
- At least 5 people with issues assigned across projects (for load balancer comparisons)
- At least one empty project with no issues (for project kickoff suggestion)
- Person documents with explicit `role` property set (director, pm, engineer)

### 18. MVP Scope (Due Tuesday)

**In scope for MVP:**
- Use Case 3 (Engineer Nudge) as the proactive detection — event fires, threshold check, Gemini frames it, suggestion lands in queue
- Priority change confirmation as the human-in-the-loop gate — approve/dismiss a suggested priority change
- On-demand chat with basic "What's going on with this project?" — demonstrates context-aware on-demand mode
- LangSmith traces showing clean vs. problem-detected paths (minimum 2 shared trace links)
- FLEETGRAPH.md with Agent Responsibility, Use Cases (8), Graph Diagram, Trigger Model sections completed
- Deployed and publicly accessible

**Post-MVP (Early Submission / Final):**
- Use Case 1 (Director Overview)
- Use Case 4 (Morning Briefing) — requires scheduled cron
- Use Case 5 (Project Kickoff Suggestion)
- Use Case 6 (Coach) — requires history accumulation
- Use Case 7 (Retro Autopilot) — requires timezone handling
- Use Case 8 (Load Balancer)
- Severity scoring and action queue ranking
- Snooze/dismiss persistence and re-evaluation logic
- Seed data script for demo scenarios
- Full test cases with trace links
- Cost analysis with 100/1,000/10,000 user projections