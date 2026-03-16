# FleetGraph Implementation Plan

Detailed, step-by-step implementation plan for the Ship Graph Agent. Derived from PRESEARCH.md. Every task includes the exact files to create/modify, the specific code to write, and acceptance criteria.

Reference: `PRESEARCH.md` for all design decisions. `fleetgraph_specs.pdf` for grading requirements.

## Branching Strategy

**Every step gets its own branch.** Branch from the previous step's merged branch, not from `fleetgraph_start`.

- Base branch: `fleetgraph_start` (PRESEARCH.md + GRAPH_AGENT_PRD.md + seed data)
- Step 1: `fleetgraph/step-01-scaffolding` → PR into `fleetgraph_start`
- Step 2: `fleetgraph/step-02-migration` → PR into `fleetgraph_start`
- Step N: `fleetgraph/step-NN-description` → PR into `fleetgraph_start`

Naming convention: `fleetgraph/step-NN-short-description` (e.g., `fleetgraph/step-03-graph-definition`).

Merge each step before starting the next. If steps are independent, they can be worked in parallel on separate branches.

---

## Part 1: MVP (Due Tuesday 11:59 PM)

MVP delivers: one proactive detection end-to-end, one HITL gate, on-demand chat, LangSmith tracing, deployment.

---

### Step 1: Project Scaffolding

**Goal:** Set up the agent as a standalone service in the monorepo. The agent is a **separate process** that calls Ship's REST API over HTTP — it does not share the API's process, database connection, or express routes. It runs its own HTTP server for the on-demand chat and suggestion endpoints.

**Files to create:**
```
agent/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                  # Entry point — starts HTTP server + event listener
│   ├── server.ts                 # Express server for agent-specific routes (on-demand, suggestions)
│   ├── graph/
│   │   ├── state.ts              # FleetGraphState interface
│   │   ├── graph.ts              # LangGraph graph definition (nodes, edges, conditional routing)
│   │   ├── nodes/
│   │   │   ├── trigger-context.ts
│   │   │   ├── user-context.ts
│   │   │   ├── project-fetch.ts
│   │   │   ├── person-fetch.ts
│   │   │   ├── threshold-evaluator.ts
│   │   │   ├── gemini-reasoner.ts
│   │   │   ├── suggestion-generator.ts
│   │   │   └── notification-sender.ts
│   │   └── prompts/
│   │       ├── proactive-clean.ts
│   │       ├── proactive-violations.ts
│   │       └── on-demand.ts
│   ├── api/
│   │   ├── suggestions.ts        # CRUD routes for agent_actions
│   │   └── on-demand.ts          # SSE streaming chat endpoint
│   ├── worker/
│   │   ├── event-listener.ts     # WebSocket event subscription + debounce
│   │   └── scheduler.ts          # Cron/setInterval for scheduled runs (post-MVP, stub for now)
│   └── lib/
│       ├── ship-client.ts        # HTTP client for Ship REST API
│       ├── gemini-client.ts      # Gemini API wrapper
│       └── thresholds.ts         # Threshold constants and evaluation logic
```

**Files to modify:**
- `package.json` (root) — add `agent` to pnpm workspaces

**Architecture note:** The agent runs as its own process on a separate port (e.g., :3001). The frontend calls agent endpoints directly (or via a reverse proxy). The agent calls Ship's REST API at its configured base URL. The agent has its own database connection for the `agent_actions` table only — all Ship data is fetched via HTTP.

**Dependencies (agent/package.json):**
```json
{
  "dependencies": {
    "@langchain/langgraph": "latest",
    "@langchain/core": "latest",
    "langsmith": "latest",
    "@google/generative-ai": "latest"
  }
}
```

**Environment variables to add:**
```
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=<key>
GOOGLE_AI_API_KEY=<key>
AGENT_SERVICE_TOKEN=<long-lived token for service account>
```

**Acceptance criteria:**
- `pnpm install` succeeds with agent package
- Agent entry point starts without crashing
- LangSmith receives a trace when graph runs (even with empty state)

---

### Step 2: Database Migration — `agent_actions` Table

**Goal:** Create the persistence layer for agent suggestions.

**File to create:** `api/src/db/migrations/XXX_agent_actions.sql`

```sql
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  target_user_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  severity_score NUMERIC,
  context JSONB NOT NULL,
  suggestion JSONB NOT NULL,
  gemini_reasoning TEXT,
  snooze_until TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  langsmith_trace_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_actions_user_status ON agent_actions(target_user_id, status);
CREATE INDEX idx_agent_actions_workspace ON agent_actions(workspace_id);
```

**Acceptance criteria:**
- Migration runs successfully via `pnpm db:migrate`
- Table exists in local database
- Can insert and query rows manually

---

### Step 3: LangGraph State & Graph Definition

**Goal:** Define the graph state interface and wire up the LangGraph graph with all MVP nodes.

**File: `agent/src/graph/state.ts`**

Define `FleetGraphState` exactly as specified in PRESEARCH.md Section 11. Include all fields even if some are unused in MVP — the state schema is the contract.

**File: `agent/src/graph/graph.ts`**

Build the LangGraph `StateGraph`:
1. Add nodes: `triggerContext`, `userContext`, `projectFetch`, `personFetch`, `thresholdEvaluator`, `geminiReasoner`, `suggestionGenerator`, `notificationSender`
2. Add edges:
   - `triggerContext` → `userContext`
   - `userContext` → `[projectFetch, personFetch]` (parallel via LangGraph fan-out)
   - `[projectFetch, personFetch]` → `thresholdEvaluator` (fan-in)
   - `thresholdEvaluator` → `geminiReasoner`
   - `geminiReasoner` → conditional edge (Gemini Reasoner **always runs** on both paths — the conditional determines what happens **after** it):
     - If violations exist → `suggestionGenerator` → `notificationSender`
     - If clean → `notificationSender` (summary only, Suggestion Generator skipped)
     - If on-demand → stream response directly (Threshold Evaluator and Suggestion Generator both skipped)
3. Compile the graph

**Acceptance criteria:**
- Graph compiles and can be invoked with a test payload
- LangSmith trace shows all nodes executing in correct order
- Parallel fetch nodes visible in trace as concurrent executions

---

### Step 4: Ship API Client

**Goal:** Build the HTTP client that calls Ship's REST API, authenticated as the service account.

**File: `agent/src/lib/ship-client.ts`**

```typescript
class ShipClient {
  constructor(baseUrl: string, serviceToken: string)

  // Fetch nodes use these
  async getProjectIssues(projectId: string): Promise<Issue[]>
  async getPersonIssues(assigneeId: string): Promise<Issue[]>
  async getProject(projectId: string): Promise<Project>
  async getProgramProjects(programId: string): Promise<Project[]>

  // Action nodes use these
  async updateIssue(issueId: string, updates: Partial<Issue>): Promise<void>
  async createAgentAction(action: NewAgentAction): Promise<AgentAction>
  async getAgentActions(userId: string, status?: string): Promise<AgentAction[]>
  async updateAgentAction(actionId: string, updates: Partial<AgentAction>): Promise<AgentAction>
}
```

All methods include error handling: retry with backoff on 5xx, throw on 4xx. Every call logs the request/response for debugging.

**Acceptance criteria:**
- Can fetch issues for a known project from the running Ship API
- Can create and read back an `agent_action` row
- Errors are caught and logged, not swallowed

---

### Step 5: Threshold Evaluator

**Goal:** Implement the deterministic threshold checks — no Gemini, pure math.

**File: `agent/src/lib/thresholds.ts`**

```typescript
interface ThresholdConfig {
  highPriorityPerProject: number;    // default 7
  mediumPriorityPerProject: number;  // default 10
  inProgressPerProject: number;      // default 5
  highPriorityPerPerson: number;     // default 2
  mediumPriorityPerPerson: number;   // default 3
  staleDaysHigh: number;             // default 2
  staleDaysMedium: number;           // default 5
  staleDaysLow: number;              // default 30
}

interface Violation {
  type: 'priority_overload' | 'in_progress_overload' | 'person_overload' | 'stale_issue';
  severity: number;          // computed score
  entity_type: 'project' | 'person';
  entity_id: string;
  entity_name: string;
  details: Record<string, any>;  // threshold, actual value, affected issue IDs
}

function evaluateThresholds(
  projectData: ProjectSnapshot,
  personData: PersonSnapshot,
  config: ThresholdConfig
): Violation[]
```

**File: `agent/src/graph/nodes/threshold-evaluator.ts`**

LangGraph node that calls `evaluateThresholds` and writes violations to state.

**Acceptance criteria:**
- Given a project with 9 high-priority issues, produces a `priority_overload` violation with severity score
- Given a person with 3 high-priority issues, produces a `person_overload` violation
- Given an issue with `updated_at` 3 days ago and priority `high`, produces a `stale_issue` violation
- Given a healthy project, produces zero violations
- Unit tests pass for all threshold combinations

---

### Step 6: Gemini Reasoner Node

**Goal:** Wire Gemini API calls with mode-specific prompts. For MVP, implement `PROACTIVE_CLEAN` and `PROACTIVE_VIOLATIONS` modes.

**File: `agent/src/lib/gemini-client.ts`**

```typescript
class GeminiClient {
  constructor(apiKey: string)
  async reason(prompt: string, context: string): Promise<string>
  async reasonStreaming(prompt: string, context: string): AsyncGenerator<string>
}
```

**File: `agent/src/graph/prompts/proactive-clean.ts`**
System prompt for clean runs. Input: project snapshot. Output: 2-3 sentence health summary.

**File: `agent/src/graph/prompts/proactive-violations.ts`**
System prompt for violation runs. Input: violations + project data. Output: structured analysis with root cause, risk, and recommended action per violation. Must reference specific issue IDs.

**File: `agent/src/graph/nodes/gemini-reasoner.ts`**

LangGraph node that:
1. Reads `violations` from state
2. Selects prompt mode: `violations.length > 0` → `PROACTIVE_VIOLATIONS`, else → `PROACTIVE_CLEAN`
3. Calls Gemini with the selected prompt + fetched data as context
4. Writes `gemini_output` to state (includes the mode used, for LangSmith trace differentiation)

**Acceptance criteria:**
- Clean run produces a short health summary in LangSmith trace
- Violation run produces structured analysis referencing issue IDs
- The two traces are visibly different in LangSmith (different prompt, different output length, different downstream routing)
- Gemini errors are caught — node writes error to `state.errors` and graph continues to fallback path

---

### Step 6b: Error & Fallback Nodes

**Goal:** Handle Ship API failures, missing data, and Gemini errors gracefully — the spec explicitly requires error and fallback nodes.

**File: `agent/src/graph/nodes/error-handler.ts`**

LangGraph error handler node that:
1. Catches errors from any fetch node (Ship API down, 404 for missing project/person, timeout)
2. Writes error details to `state.errors`
3. Routes to fallback behavior:
   - **Fetch node failure:** Skip that data source, continue with available data. E.g., if Person Fetch fails but Project Fetch succeeded, run Threshold Evaluator with project data only.
   - **Gemini failure:** Fall back to structured templated alerts from Threshold Evaluator violations. No natural language, but violations still surface.
   - **All fetches fail (Ship API down):** Terminate the run, log failure, wait for next trigger. No partial suggestions written.

**Implementation in graph.ts:**
- Wrap each fetch node with LangGraph error handling (try/catch within the node, write to `state.errors`)
- Add a conditional edge after fetch fan-in: if all fetches failed → terminate early. If partial failure → continue with available data.
- After Gemini Reasoner: if Gemini errored → route to a `fallback-notifier` node that generates templated messages from violations.

**Acceptance criteria:**
- Ship API returning 500 for project fetch → graph continues with person data only, LangSmith trace shows the error
- Gemini API timeout → structured violation alerts still appear in action queue
- All fetches fail → graph terminates cleanly, no suggestions written, error logged
- No uncaught exceptions crash the agent process

---

### Step 7: Suggestion Generator & Action Queue Writer

**Goal:** When violations are detected and Gemini recommends actions, write them as pending suggestions to the `agent_actions` table.

**File: `agent/src/graph/nodes/suggestion-generator.ts`**

LangGraph node that:
1. Reads `violations` from state (not Gemini output — suggestions are derived deterministically from violations, not parsed from free text)
2. Maps each violation to a concrete action: `priority_overload` → suggest demoting the lowest-severity high-priority issue; `person_overload` → suggest reassigning one issue to the least-loaded team member; `stale_issue` → suggest status change or update reminder
3. Attaches `gemini_reasoning` from the Gemini Reasoner output as the human-readable explanation
4. For each action, creates a `PendingSuggestion` with:
   - `action_type` (e.g., `priority_change`)
   - `target_user_id` (the assignee of the affected issue)
   - `context` (violation details, threshold values)
   - `suggestion` (proposed change: `{ issue_id, field, from, to }`)
   - `gemini_reasoning` (Gemini's explanation)
   - `severity_score` (from threshold evaluator)
4. Writes suggestions to state

**File: `agent/src/graph/nodes/notification-sender.ts`**

LangGraph node that:
1. Reads suggestions from state
2. Calls `ShipClient.createAgentAction()` for each suggestion
3. If user is online (check WebSocket presence), push a notification via WebSocket
4. For MVP, skip the WebSocket push — just persist to database. Frontend polls.

**Acceptance criteria:**
- After a violation run, `agent_actions` table has new rows with status `pending`
- Each row has a valid `gemini_reasoning` explanation
- Each row has the correct `target_user_id` (the issue assignee)

---

### Step 8: Agent API Routes

**Goal:** Build the REST endpoints the frontend needs to display and interact with the action queue.

**File: `agent/src/api/suggestions.ts`**

```
GET  /api/agent/suggestions?status=pending    → list pending suggestions for current user
PATCH /api/agent/suggestions/:id              → approve, dismiss, or snooze a suggestion
```

**Approve handler:**
1. Update `agent_actions.status` to `approved`
2. Execute the suggested mutation (e.g., `PATCH /api/issues/:id` to change priority)
3. Set `resolved_at`

**Dismiss handler:**
1. Update `agent_actions.status` to `dismissed`
2. Set `resolved_at`

**Snooze handler:**
1. Update `agent_actions.status` to `snoozed`
2. Set `snooze_until` to requested timestamp

**File to modify:** `api/src/index.ts` — mount routes at `/api/agent/`

**Acceptance criteria:**
- `GET /api/agent/suggestions?status=pending` returns suggestions for the logged-in user
- `PATCH /api/agent/suggestions/:id` with `{ status: 'approved' }` changes the issue priority and marks the suggestion as resolved
- `PATCH /api/agent/suggestions/:id` with `{ status: 'dismissed' }` marks it dismissed without mutating data

---

### Step 9: Event Listener (Proactive Trigger)

**Goal:** Wire the proactive mode — when an issue changes in Ship, the agent evaluates it. This is the implementation of MVP Use Case 3 (Engineer Nudge): when a threshold fires for an engineer-role user (staleness or person overload), the suggestion targets that engineer.

**File: `agent/src/worker/event-listener.ts`**

1. Connect to Ship's existing `/events` WebSocket endpoint (already exists in `api/src/collaboration/index.ts` — supports `broadcastToUser` with JSON messages). Authenticate using the service account session.
2. Listen for document change events (the API already broadcasts events like `accountability:updated`). May need to add new broadcast calls in issue/document mutation routes if `document:updated` events aren't already emitted for all issue changes.
3. Implement 30-second debounce per project: collect all events for the same project within the window, then fire one graph run
4. For each debounced batch:
   - Build trigger payload: `{ trigger_type: 'event', document_ids: [...], project_id, assignee_ids: [...] }`
   - Invoke the LangGraph graph with this payload
   - The graph runs: fetch → threshold → gemini → suggestions → persist

**File: `agent/src/index.ts`**

On startup:
1. Start the event listener
2. Register API routes
3. Log "FleetGraph agent started"

**Acceptance criteria:**
- Change an issue's priority in Ship → agent detects it within 30 seconds + debounce
- If the change pushes a project over threshold → suggestion appears in `agent_actions`
- If the change doesn't trigger any threshold → clean run, no suggestion, but LangSmith trace shows the run
- Two rapid changes to the same project within 30 seconds → only one graph run (debounce working)

---

### Step 10: On-Demand Chat Endpoint

**Goal:** Build the SSE endpoint for the embedded chat interface.

**File: `agent/src/api/on-demand.ts`**

```
POST /api/agent/on-demand
Body: { question: string, context: ViewContext }
Response: SSE stream
```

Handler:
1. Build trigger payload: `{ trigger_type: 'on_demand', user_question: question, view_context: context }`
2. Invoke the LangGraph graph
3. The graph takes a **different path for on-demand**: Trigger Context → User Context → Fetch nodes (based on view context) → Gemini Reasoner in `ON_DEMAND` mode. **Threshold Evaluator and Suggestion Generator are skipped** — on-demand mode answers the user's question, it doesn't generate persistent suggestions. The conditional edge after Trigger Context routes on-demand runs directly from fetch to Gemini Reasoner.
4. Stream Gemini's response back via SSE
5. If the user's question implies an action ("change the priority of AUTH-42"), the Gemini Reasoner outputs structured action metadata alongside the response text, which the frontend renders as inline approve/dismiss buttons.

**File: `agent/src/graph/prompts/on-demand.ts`**

System prompt: "The user is looking at [context.document_type]: [context.title]. They asked: [question]. Using the data below, provide a specific, actionable answer. Reference issue IDs, names, and dates. If you identify problems, suggest concrete next steps."

**Acceptance criteria:**
- `POST /api/agent/on-demand` with `{ question: "What's going on with this project?", context: { document_type: "project", document_id: "..." } }` returns an SSE stream
- Response references actual issue data from the project
- LangSmith trace shows the on-demand run with the user's question in the trace metadata

---

### Step 11: Frontend — Chat Panel

**Goal:** Build the embedded chat UI in Ship's frontend.

**Files to create:**
```
web/src/components/agent/
├── AgentChatPanel.tsx       # Slide-out panel component
├── AgentChatMessage.tsx     # Individual message bubble (user + agent)
├── AgentChatInput.tsx       # Text input + send button
├── AgentIcon.tsx            # Icon for the rail
└── useAgentChat.ts          # Hook: manages SSE connection, message state
```

**File to modify:** `web/src/components/IconRail.tsx` (or equivalent) — add agent icon button

**AgentChatPanel.tsx:**
- Slide-out from right edge, 400px wide, overlays properties sidebar
- Header shows context: "FleetGraph — Project: Login Revamp"
- Message list with user messages (right-aligned) and agent responses (left-aligned)
- Agent responses render markdown
- Close button dismisses panel and clears conversation

**useAgentChat.ts:**
- Manages message state: `{ role: 'user' | 'agent', content: string }[]`
- On send: POST to `/api/agent/on-demand` with question + current view context
- Reads SSE stream, appends tokens to current agent message as they arrive
- Exposes: `messages`, `sendMessage(text)`, `isStreaming`, `clearChat`

**How context is determined:**
- Read from React Router params or current document store
- If user is viewing a project → `{ document_type: 'project', document_id: params.projectId, title: project.title }`
- If user is viewing an issue → `{ document_type: 'issue', document_id: params.issueId, title: issue.title }`
- If no specific document → `{ document_type: 'workspace', document_id: workspaceId }`

**Acceptance criteria:**
- Agent icon appears in icon rail
- Clicking it opens the chat panel
- Typing a question and pressing Enter sends it
- Response streams in token-by-token
- Panel shows correct context in header
- Navigating to a different document updates the context

---

### Step 12: Frontend — Action Queue

**Goal:** Build the UI for viewing and acting on agent suggestions.

**Files to create:**
```
web/src/components/agent/
├── AgentSuggestionsPanel.tsx   # List of pending suggestions
├── AgentSuggestionCard.tsx     # Individual suggestion with approve/dismiss/snooze
└── useAgentSuggestions.ts      # Hook: fetches and manages suggestions
```

**Note:** The chat panel (Step 11) and action queue are **two separate UI surfaces**. The chat panel is a slide-out overlay for on-demand conversations. The action queue is a persistent list of agent suggestions accessible from the agent icon (notification badge shows pending count). When the agent icon is clicked, the user sees the action queue by default; a "Chat" tab or button switches to the chat panel.

**File to modify:** Add notification badge to the agent icon showing pending suggestion count.

**AgentSuggestionCard.tsx:**
- Shows: what the agent wants to do (bold), why (Gemini reasoning), severity indicator
- Three buttons: Approve (green), Dismiss (gray), Snooze (blue)
- Approve calls `PATCH /api/agent/suggestions/:id` with `{ status: 'approved' }` and shows success toast
- Dismiss calls with `{ status: 'dismissed' }`
- Snooze opens a small picker (24h, 1 week) then calls with `{ status: 'snoozed', snooze_until: timestamp }`

**useAgentSuggestions.ts:**
- Polls `GET /api/agent/suggestions?status=pending` every 30 seconds (upgrade to WebSocket push post-MVP)
- Returns `{ suggestions, approve(id), dismiss(id), snooze(id, until), isLoading }`

**Acceptance criteria:**
- Pending suggestions appear in the UI
- Approving a priority change suggestion actually changes the issue's priority
- Dismissed suggestions disappear from the list
- Badge count updates when new suggestions arrive

---

### Step 13: Seed Data

**Goal:** Create seed data that triggers agent detections for demo purposes.

**File to update:** `api/src/db/seed-fleet.ts` (already exists with Treasury department seed data — needs modifications to ensure FleetGraph threshold triggers are met)

The existing seed data has many high-priority issues across projects but needs these specific additions:
1. Program "Platform" with projects: "Auth Revamp" (overloaded), "Dashboard" (healthy), "API Gateway" (stale)
2. Program "Mobile" with projects: "iOS App" (in-progress overload), "Android App" (healthy)
3. "Auth Revamp" gets 9 high-priority issues (triggers >7 threshold) — assigned across 3 people
4. One person ("Alice") gets 3 high-priority issues across projects (triggers >2 person threshold)
5. "API Gateway" has 2 high-priority issues with `updated_at` set to 4 days ago (triggers staleness)
6. "iOS App" has 6 in-progress issues (triggers >5 threshold)
7. "Dashboard" has 3 medium-priority issues, all updated recently (clean run)
8. Person documents must have an `agent_role` property set to `'director'` | `'pm'` | `'engineer'` (the existing seed stores job titles as `role`, which is a free-text string — the agent needs a structured enum). Update seed to add `agent_role` to person document properties.
9. One empty project "Performance Optimization" (for project kickoff use case, post-MVP)
10. Verify: at least one project must have >7 non-done high-priority issues concentrated (the existing seed spreads high-priority issues across many projects — may need to concentrate them)

**File to modify:** `package.json` — add script `"db:seed-fleet": "ts-node api/src/db/seed-fleet.ts"`

**Acceptance criteria:**
- Running `pnpm db:seed-fleet` creates all data
- Agent proactive run against "Auth Revamp" triggers priority_overload violation
- Agent proactive run against "Dashboard" produces clean summary
- LangSmith traces show different paths for these two runs

---

### Step 14: LangSmith Tracing Verification

**Goal:** Produce the two required LangSmith trace links showing different execution paths.

**Trace 1: Clean run**
1. Trigger agent against "Dashboard" project (healthy, no violations)
2. Trace shows: Trigger Context → User Context → [Project Fetch, Person Fetch] → Threshold Evaluator (0 violations) → Gemini Reasoner (PROACTIVE_CLEAN mode, short summary) → Notification Sender
3. Save shared trace link

**Trace 2: Problem-detected run**
1. Trigger agent against "Auth Revamp" project (9 high-priority issues)
2. Trace shows: Trigger Context → User Context → [Project Fetch, Person Fetch] → Threshold Evaluator (violations found) → Gemini Reasoner (PROACTIVE_VIOLATIONS mode, detailed analysis) → Suggestion Generator (creates pending actions) → Notification Sender
3. Save shared trace link

**Acceptance criteria:**
- Both traces are publicly accessible via shared links
- The two traces show visibly different execution: different Gemini prompt mode, different output length, Suggestion Generator only appears in trace 2
- Trace metadata includes run_id, trigger_type, project_id

---

### Step 15: Deployment

**Goal:** Deploy the agent as a separate process alongside the Ship API.

**Approach:** The agent runs as its own process on the same EB instance (or a separate one). It has its own HTTP server for agent-specific routes and connects to Ship's API and WebSocket as an external client.

**Files to modify:**
- `Procfile` or `.ebextensions/` — add agent as a second process: `agent: node agent/dist/index.js`
- Environment variables added to EB configuration (LANGCHAIN keys, GOOGLE_AI key, AGENT_SERVICE_TOKEN, SHIP_API_URL)
- Frontend config — agent API base URL (e.g., same host, different port, or proxied path)

**Acceptance criteria:**
- Agent process is running on the deployed instance, separate from the API process
- On-demand chat works from the deployed frontend
- Proactive detection fires when issues are changed on the deployed instance
- LangSmith traces appear for deployed runs

---

### Step 16: FLEETGRAPH.md (MVP Sections)

**Goal:** Fill in the MVP-required sections of FLEETGRAPH.md.

**File to create:** `FLEETGRAPH.md`

Sections to complete for MVP:
1. **Agent Responsibility** — copy from PRESEARCH.md Section 1, reformatted as prose
2. **Graph Diagram** — Mermaid diagram showing all nodes, edges, conditional branches for both proactive and on-demand modes
3. **Use Cases** — table with all 8 use cases (role, trigger, detection, human decision)
4. **Trigger Model** — hybrid decision with tradeoff analysis, copied from PRESEARCH.md Section 3
5. **Two LangSmith trace links** from Step 14

**Acceptance criteria:**
- All MVP sections filled in
- Graph diagram renders correctly in markdown
- Trace links are clickable and show different execution paths

---

## Part 2: Final Submission (Due Sunday 11:59 PM)

Everything below builds on the MVP foundation.

**Dependency ordering:**
- Step 17 (Scheduler) must come first — Steps 18, 19, 21 depend on it
- Steps 18 (Director) and 19 (Morning Briefing) can be parallelized after Step 17
- Steps 20 (Coach), 21 (Retro Autopilot), 22 (Load Balancer), 23 (Project Kickoff) are independent of each other
- Step 24 (Snooze/Dismiss) and Step 25 (Severity Scoring) are independent of use case steps
- Step 26 (WebSocket Push) is independent
- Steps 27-30 (test cases, cost analysis, architecture docs, polish) are sequential and come last

---

### Step 17: Scheduled Worker — Morning Briefing & Staleness Cron

**File: `agent/src/worker/scheduler.ts`**

Two scheduled jobs:

**Morning briefing (daily):**
1. Run at configurable time (default: 07:00 workspace timezone)
2. For each user in the workspace:
   - Fetch all projects the user is involved in (has assigned issues)
   - Run the graph with `trigger_type: 'scheduled'` for each project
   - Aggregate violations across projects
   - Call Gemini with `BRIEFING` prompt to compose a unified briefing
   - Write briefing as an `agent_action` with `action_type: 'briefing'`
3. Include suggested actions within the briefing, linked to their individual `agent_action` rows

**Staleness cron (hourly):**
1. Query all issues where `updated_at < NOW() - threshold_days` based on priority
2. For each stale issue, run the graph with the issue's project as context
3. Debounce: group stale issues by project, one graph run per project

**Acceptance criteria:**
- Morning briefing generates per-user summaries
- Staleness cron detects issues that haven't been updated
- Both produce LangSmith traces

---

### Step 18: Director Overview (Use Case 1)

**Goal:** Cross-program systemic issue detection.

**Implementation:**
- New fetch node: `ProgramFetch` — fetches all projects for all programs
- Threshold Evaluator runs against each project, aggregates violations
- Gemini Reasoner in `DIRECTOR_OVERVIEW` mode ranks projects by severity across the portfolio
- Generates suggestions targeting the director role

**New prompt: `agent/src/graph/prompts/director-overview.ts`**
"You are analyzing the health of an entire program portfolio. Rank projects by risk. Identify systemic patterns: are the same people overloaded across projects? Are multiple projects in the same program struggling? Recommend portfolio-level actions."

**Acceptance criteria:**
- Director receives a ranked view of project health across all programs
- Cross-project patterns (same person overloaded on multiple projects) are identified

---

### Step 19: Morning Briefing (Use Case 4)

**Goal:** Daily digest with actionable suggestions.

Uses the scheduled worker from Step 17. Frontend additions:

**File: `web/src/components/agent/AgentBriefing.tsx`**
- Renders the morning briefing as a formatted card
- Each suggested action within the briefing is an inline approve/dismiss button
- "No changes since yesterday" state when nothing is new

**Acceptance criteria:**
- User sees their morning briefing when they open Ship
- Suggested actions within the briefing are actionable
- Briefing content is different for different roles (director vs. engineer)

---

### Step 20: Coach (Use Case 6)

**Goal:** On-demand pattern analysis for a person's work history.

**Implementation:**
- New fetch node: `HistoryFetch` — fetches past `agent_actions` for this user + issue history over past N weeks
- Compute: carryover per week, done-to-added ratio trend, priority distribution over time
- Gemini Reasoner in `COACH` mode analyzes patterns

**New prompt: `agent/src/graph/prompts/coach.ts`**
"Analyze this person's work patterns over the past [N] weeks. Data includes: issues completed per week, issues carried over, priority distribution of completed vs. assigned, average time-to-completion by priority. Identify: (1) trends — improving, declining, or stable, (2) specific concerns with data backing, (3) actionable recommendations. Be constructive, not critical."

**Cold start handling:**
- If less than 3 weeks of data, Coach says: "I need more history to identify patterns. Check back in [N] weeks."
- Backfill: on first run, derive historical patterns from existing issue `created_at`, `updated_at`, and status transitions

**Acceptance criteria:**
- Coach identifies carryover patterns with specific week references
- Coach provides actionable recommendations
- Cold start message appears when insufficient history
- Pattern detection is per-person across all projects

---

### Step 21: Retro Autopilot (Use Case 7)

**Goal:** Auto-draft retrospectives from week data.

**Implementation:**
- Trigger: scheduled check at Mon 08:00 workspace timezone
- New fetch node: `RetroFetch` — completed issues, carryover issues, velocity for the week
- Gemini Reasoner in `RETRO_DRAFT` mode
- Draft Generator writes content to the retro document via REST API
- Before writing: check WebSocket presence — if user is editing, queue in sidebar instead

**New prompt: `agent/src/graph/prompts/retro-draft.ts`**
"Draft a weekly retrospective from this data. Structure: ## What Went Well (completed issues with IDs), ## What Carried Over (issues that moved to next week, with IDs and why if inferable), ## Velocity (done count vs. planned, trend vs. previous weeks). Keep it factual — the user will add qualitative narrative."

**Acceptance criteria:**
- Retro draft appears in the retro document with real issue data
- Draft is not generated if 0 completed issues
- WebSocket presence check prevents overwriting active editing
- User can edit the draft before confirming

---

### Step 22: Load Balancer (Use Case 8)

**Goal:** On-demand workload comparison and reassignment suggestions.

**Implementation:**
- Triggered from Resource view via on-demand chat
- Fetch all people on the project/program with their issue counts, priorities, in-progress counts
- Gemini Reasoner in `LOAD_BALANCER` mode suggests specific reassignments
- Each reassignment suggestion becomes an `agent_action` with `action_type: 'reassignment'`

**New prompt: `agent/src/graph/prompts/load-balancer.ts`**
"Compare workload across these team members. For each person show: total issues, high/medium/low breakdown, in-progress count. Identify imbalances. Suggest specific reassignments: 'Move [ISSUE-ID] from [Person A] to [Person B]' with justification. Only suggest moves that reduce imbalance without creating new ones."

**Acceptance criteria:**
- Load balancer identifies the most overloaded and least loaded team members
- Suggestions reference specific issue IDs and people
- Approving a reassignment changes the issue's assignee

---

### Step 23: Project Kickoff Suggestion (Use Case 5)

**Goal:** Agent suggests new projects based on patterns.

**Implementation:**
- Triggered during morning briefing scan
- Detect: orphaned issues (no project association), empty projects, clusters of related issues
- Gemini Reasoner in `PROJECT_KICKOFF` mode
- Suggestions require multi-turn conversation before approval

**New prompt: `agent/src/graph/prompts/project-kickoff.ts`**
"Based on the following orphaned issues and organizational goals, suggest whether a new project should be created. If yes, propose: project name, scope description, initial issue breakdown (5-10 issues). If the evidence is weak, say so — don't force a suggestion."

**Acceptance criteria:**
- Agent identifies clusters of related orphaned issues
- Suggestion includes proposed project name and initial issues
- User can have a conversation refining the scope before approving
- Approving creates the project and issues in Ship

---

### Step 24: Snooze/Dismiss Re-evaluation Logic

**Goal:** Implement the snooze expiration and dismiss-until-changed logic.

**File: `agent/src/worker/suggestion-lifecycle.ts`**

Scheduled job (runs hourly, alongside staleness cron):
1. Find all `snoozed` suggestions where `snooze_until < NOW()`
2. For each, re-fetch the current state of the affected entity
3. Compare against the violation snapshot stored in `context`
4. If condition **worsened** → create new suggestion, archive the snoozed one
5. If condition **same or improved** → silently archive (set status to `expired`)

For dismissed suggestions:
- The dismiss is recorded with a snapshot of the violation state at dismiss time
- On future runs, the Threshold Evaluator checks: "has this violation been dismissed at this exact level?" If yes, skip. If the level has changed (worsened), create a new suggestion.

**File to modify:** `agent/src/graph/nodes/suggestion-generator.ts`
- Before creating a suggestion, check `agent_actions` for existing dismissed/snoozed entries for the same entity + violation type
- Skip if dismissed and condition hasn't changed

**Acceptance criteria:**
- Snoozed suggestion that worsened → new suggestion appears after snooze expires
- Snoozed suggestion that stayed the same → silently archived
- Dismissed suggestion → not re-raised until condition changes
- Dismissed suggestion with worsened condition → new suggestion created

---

### Step 25: Severity Scoring & Action Queue Ranking

**Goal:** Implement the unified severity score for ranking suggestions.

**File to modify:** `agent/src/lib/thresholds.ts`

Add severity scoring:
```typescript
const SEVERITY_WEIGHTS = {
  stale_high_priority: 8,
  priority_overload: 6,
  person_overload: 7,
  in_progress_overload: 5,
};

function computeSeverity(violation: Violation): number {
  const base = SEVERITY_WEIGHTS[violation.type];
  const overage = violation.details.actual - violation.details.threshold;
  return base * Math.max(overage, 1);
}
```

**File to modify:** `agent/src/api/suggestions.ts`
- `GET /api/agent/suggestions` returns results ordered by `severity_score DESC`
- Add `limit` parameter (default 5) with pagination for "see all"

**Acceptance criteria:**
- Suggestions are ranked by severity in the API response
- A person with 4 high-priority issues (threshold 2, overage 2) ranks higher than a project with 8 high-priority issues (threshold 7, overage 1)

---

### Step 26: WebSocket Push Notifications

**Goal:** Replace polling with real-time push for suggestions.

**File to modify:** `agent/src/graph/nodes/notification-sender.ts`
- After persisting suggestion to database, broadcast via WebSocket to the target user
- Use Ship's existing `broadcastToUser` infrastructure
- Event type: `agent:suggestion` with payload `{ suggestion_id, action_type, severity_score, preview }`

**File to modify:** `web/src/components/agent/useAgentSuggestions.ts`
- Replace 30-second polling with WebSocket listener for `agent:suggestion` events
- Keep polling as fallback if WebSocket disconnects

**Acceptance criteria:**
- New suggestions appear in the UI within seconds of being created
- No polling needed when WebSocket is connected
- Graceful fallback to polling on disconnect

---

### Step 27: Full Test Cases with Trace Links

**Goal:** Complete the test cases table in FLEETGRAPH.md.

For each of the 8 use cases:
1. Set up the Ship state that triggers the use case (using seed data or manual changes)
2. Run the agent
3. Verify the expected output
4. Save the LangSmith trace link

| # | Ship State | Expected Output | Trace Link |
|---|-----------|----------------|------------|
| 1 | Program with 2 projects, one has 9 high-priority issues | Director alert: "Auth Revamp has priority inflation" | [link] |
| 2 | Project with 6 in-progress issues after new issue added | PM alert: "Too many items in progress" | [link] |
| 3 | Engineer's high-priority issue not updated for 3 days | Engineer nudge: "AUTH-42 needs an update" | [link] |
| 4 | Morning — multiple projects with various health states | Per-user briefing with ranked concerns | [link] |
| 5 | 4 orphaned issues with similar themes | Project suggestion: "Consider creating a Performance project" | [link] |
| 6 | Person with declining done-to-added ratio over 4 weeks | Coach: "Your completion rate has dropped from 80% to 50%" | [link] |
| 7 | Week ended, retro document empty, 8 completed issues | Retro draft with what went well + carryover sections | [link] |
| 8 | Resource view showing Alice with 5 issues, Frank with 1 | "Move AUTH-42 from Alice to Frank" suggestion | [link] |

---

### Step 28: Cost Analysis

**Goal:** Complete the cost analysis section of FLEETGRAPH.md.

**Development costs:** Track actual Gemini API spend during development via Google AI Studio dashboard.

**Production projections:**

Assumptions:
- Proactive: 1 morning briefing per user per day + ~10 event-driven runs per project per day (most are threshold-only, no Gemini)
- On-demand: 2 invocations per user per day average
- Average tokens per Gemini call: ~5k input, ~1k output
- Gemini model: Gemini 2.0 Flash (fast, cheap) for proactive/clean runs; Gemini 2.0 Pro for deep analysis/coaching. Use current pricing from Google AI pricing page at time of submission.

| Scale | Users | Briefings/day | On-demand/day | Gemini calls/day | Est. monthly |
|-------|-------|--------------|---------------|-----------------|-------------|
| 100 projects | 20 | 20 | 40 | 60 | $__/month |
| 1,000 projects | 200 | 200 | 400 | 600 | $__/month |
| 10,000 projects | 2,000 | 2,000 | 4,000 | 6,000 | $__/month |

Fill in actual numbers based on Gemini pricing at time of submission.

---

### Step 29: Architecture Decisions Section

**Goal:** Complete the Architecture Decisions section of FLEETGRAPH.md.

Document and defend:
1. **Framework: LangGraph** — why not raw function calls, why not CrewAI, why not Autogen. Answer: conditional branching, parallel execution, native LangSmith tracing, TypeScript support.
2. **AI: Gemini** — model selection rationale, streaming support, cost comparison.
3. **Node design: Threshold Evaluator separate from Gemini Reasoner** — deterministic checks are fast and cheap, Gemini only runs for analysis. Ensures cost control and testability.
4. **State: ephemeral graph state + persistent agent_actions table** — graph runs are stateless and idempotent, suggestions persist for user interaction.
5. **Suggestions as separate table, not documents** — ephemeral workflow state doesn't belong in the document model.
6. **Hybrid trigger model** — event-driven for changes, scheduled for time-based detection and staleness, bulk API for imports. Defense of each.
7. **Chat embedded in context, not standalone** — the agent is a power feature, not the primary interface. Context-awareness is the differentiator.

---

### Step 30: Final Polish & Deployment

1. Run all 8 test cases, collect trace links
2. Verify all FLEETGRAPH.md sections are complete
3. Fill in actual cost numbers
4. Deploy final version
5. Verify deployed agent handles all use cases
6. Final review of PRESEARCH.md for any stale content