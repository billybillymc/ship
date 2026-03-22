# FleetGraph Final Presentation Script

**Format**: Walk-through of 8 test cases with live LangSmith traces.
**Duration**: ~20 minutes.
**Premise**: Show how the graph makes decisions, not just what features exist.

---

## Opening (2 min)

FleetGraph is a graph agent that monitors Ship projects for risk conditions — priority overload, WIP violations, staleness, workload imbalance. It uses a single LangGraph state graph with Gemini 2.5 Flash for reasoning.

**Three things to watch for in every trace:**

1. **Execution path** — which nodes ran, which were skipped, and why
2. **Human decision point** — where the agent stops and waits for approval
3. **Deterministic vs AI** — thresholds are math, Gemini provides explanation text only

The agent has three trigger modes:

| Mode | When it fires | Example |
|------|--------------|---------|
| **Event-driven** | Issue created/updated via WebSocket | PM changes a priority → agent re-evaluates in <30s |
| **Scheduled** | Cron (daily briefing, hourly staleness) | 7am briefing scans all projects |
| **On-demand** | User asks a question in chat panel | "What are the biggest risks?" |

Every mode runs through the **same graph**. The difference is which fetch nodes activate and whether the threshold evaluator runs.

---

## Test Case 1: Director Overview (Scheduled)

**Role**: Director
**Trigger**: Morning briefing cron
**Ship State**: Full workspace — 4 programs, 12 projects, 40+ issues

**Execution Path**:
```
Trigger → User → [Project Fetch || Person Fetch || Program Fetch] → Threshold → Gemini (DIRECTOR_OVERVIEW) → Notification
```

**What to look for in the trace:**
- Three fetch nodes run **in parallel** (fan-out). You can see them start at the same timestamp.
- Program Fetch fires because `trigger_type === 'scheduled'` — event-driven runs skip it.
- Gemini mode is `DIRECTOR_OVERVIEW` — it produces a portfolio-level health ranking, not per-issue detail.
- No suggestions generated — this is a read-only briefing. No human approval needed.

**When the agent acts**: Immediately — briefings are informational.
**When the agent waits**: Never. Read-only output, no mutations.

> [View Trace](https://smith.langchain.com/public/6945189a-b7fe-44d5-883b-412ebb3068a8/r)

**Expected Result**: Portfolio health ranking identifying weekly plan submission gaps and workload distribution patterns across all programs.

**Actual Result**: Matched. Identified submission gaps and workload patterns.

---

## Test Case 2: PM Alert — In-Progress Overload (Event-Driven)

**Role**: PM
**Trigger**: Issue status changed to "in_progress" on Payment Integrity project
**Ship State**: Payment Integrity has 6 in-progress issues (threshold: 5)

**Execution Path**:
```
Trigger → User → [Project Fetch || Person Fetch] → Threshold (1 violation) → Gemini (PROACTIVE_VIOLATIONS) → Suggestion Generator → Notification
```

**What to look for in the trace:**
- Only two fetch nodes (no Program Fetch — this is event-driven, not scheduled).
- Threshold Evaluator outputs 1 violation: `in_progress_overload`, severity based on how far over the limit.
- Gemini mode switches to `PROACTIVE_VIOLATIONS` because violations > 0. If it were 0, mode would be `PROACTIVE_CLEAN`.
- **Suggestion Generator fires** — this is the key difference from Test Case 1. It maps the violation to a concrete action: "Move [issue] back to todo."
- Gemini provides the *explanation text*, not the action. The action is deterministic.

**When the agent acts**: It writes a pending suggestion to `agent_actions`.
**When the agent waits**: Right here. The suggestion sits in the action queue until the PM approves, dismisses, or snoozes it.

**The human decision**: PM sees a card: "Move [issue] back to todo — 6 items in progress exceeds your WIP limit of 5." Three buttons: Approve / Dismiss / Snooze.

- **Approve** → Ship API executes `PATCH /api/issues/:id` setting `state: 'todo'`. The PATCH fires a WebSocket event → agent re-evaluates after 30s debounce.
- **Dismiss** → Suggestion archived. Won't resurface unless count worsens.
- **Snooze 24h** → Hourly lifecycle cron re-checks after expiry. If still over, new suggestion appears.

> [View Trace](https://smith.langchain.com/public/95a871d6-2adf-49e6-ac1f-1a6555ce7483/r)

**Expected Result**: 1 `in_progress_overload` violation, 1 suggestion to move an item back to todo.

**Actual Result**: Matched exactly. 1 violation, 1 suggestion with specific issue ID.

---

## Test Case 3: Engineer Nudge — Stale Issues (Event-Driven)

**Role**: Engineer
**Trigger**: Hourly staleness cron detects 3 issues with no update in 5+ days
**Ship State**: IMF Migration project — 3 issues with `updated_at` older than 5 days

**Execution Path**:
```
Trigger → User → [Project Fetch || Person Fetch] → Threshold (3 violations) → Gemini (PROACTIVE_VIOLATIONS) → Suggestion Generator → Notification
```

**What to look for in the trace:**
- Threshold Evaluator finds 3 violations, all type `stale_issue`. Severity varies by how far past the threshold each issue is.
- Suggestion Generator creates 3 separate suggestions — one per stale issue. Each names the specific issue.
- Gemini provides a combined analysis explaining the staleness pattern across all three.

**When the agent acts**: Writes 3 pending suggestions.
**When the agent waits**: Engineer sees 3 cards in their action queue. They can approve (update status), dismiss (already handled offline), or snooze each independently.

**The human decision**: Per-issue. Engineer might approve updating one, dismiss another they already discussed verbally, and snooze a third that's blocked.

> [View Trace](https://smith.langchain.com/public/d14d9859-55b3-46e9-8f4a-985aeb532309/r)

**Expected Result**: 3 `stale_issue` violations, 3 suggestions with specific issue IDs.

**Actual Result**: Matched. 3 violations, 3 suggestions targeting the correct issues.

---

## Test Case 4: Morning Briefing (Scheduled)

**Role**: Individual (Rachel Goldberg)
**Trigger**: Daily morning briefing cron
**Ship State**: Rachel's projects scanned — Direct File has priority issues

**Execution Path**:
```
Trigger → User → [Project Fetch || Person Fetch || Program Fetch] → Threshold → Gemini (DIRECTOR_OVERVIEW) → Suggestion Generator → Notification
```

**What to look for in the trace:**
- Same scheduled path as Test Case 1, but **scoped to one user** (Rachel).
- Threshold finds Direct File has priority inflation. 1 violation.
- Because violations > 0, Suggestion Generator fires (unlike Test Case 1 which was clean).
- The briefing combines informational content (health summary) with an actionable suggestion.

**When the agent acts**: Generates briefing + 1 pending suggestion.
**When the agent waits**: Rachel reviews the briefing. The suggestion sits in her queue.

> [View Trace](https://smith.langchain.com/public/a15211a5-ea9d-4bdf-965a-357a0a42d7ea/r)

**Expected Result**: Briefing identifying Direct File as high-risk, flagging Rachel's 2 high-priority items, 1 suggestion.

**Actual Result**: Matched. Direct File flagged, Rachel's workload identified.

---

## Test Case 5: Project Kickoff (On-Demand)

**Role**: PM/Director
**Trigger**: User asks "Are there orphaned issues that should become a project?"
**Ship State**: Workspace scanned for orphaned issues (issues without parent project)

**Execution Path**:
```
Trigger → User → [Project Fetch || Person Fetch] → Gemini (PROJECT_KICKOFF) → Notification
```

**What to look for in the trace:**
- This is on-demand but NOT a command question, so it skips the Threshold Evaluator entirely.
- Gemini mode is `PROJECT_KICKOFF` — a specialized prompt that evaluates whether orphaned work warrants a new project.
- No suggestions generated. The output is advisory — a conversation starter, not an action.

**When the agent acts**: Returns analysis immediately via SSE stream.
**When the agent waits**: It doesn't gate on approval because no mutation is proposed.

**Why this matters**: Shows the graph correctly routing an on-demand question that doesn't need thresholds or suggestions. The conditional edge after `userContext` skips the threshold path.

> [View Trace](https://smith.langchain.com/public/f4a2bbc1-67d4-4889-b4bd-b9f77df29515/r)

**Expected Result**: Evaluation of orphaned issues, recommendation on whether to create a project.

**Actual Result**: Correctly reported insufficient orphaned issues to justify a project.

---

## Test Case 6: Coach (On-Demand)

**Role**: Engineer/Manager
**Trigger**: User asks "What patterns do you see in my work?"
**Ship State**: Rachel Goldberg's work history

**Execution Path**:
```
Trigger → User → [Person Fetch || History Fetch] → Gemini (COACH) → Notification
```

**What to look for in the trace:**
- **Different fetch nodes activate.** Instead of Project Fetch, this path uses History Fetch — it pulls from the `agent_actions` table to find patterns in past suggestions, approvals, and dismissals.
- Person Fetch and History Fetch run in parallel.
- No Threshold Evaluator — coaching is purely AI-driven pattern analysis.
- Gemini mode is `COACH` — a prompt designed for behavioral observations, not violations.
- No suggestions generated. Coach output is read-only.

**When the agent acts**: Returns coaching observation via SSE.
**When the agent waits**: Doesn't. Read-only analysis.

**Why this matters**: Shows the graph taking a completely different path based on the question content. The `isCoachQuestion()` function routes to History Fetch instead of the standard project path.

> [View Trace](https://smith.langchain.com/public/f4a2bbc1-67d4-4889-b4bd-b9f77df29515/r)

**Expected Result**: Pattern analysis with trends and recommendations.

**Actual Result**: Identified insufficient weekly data, recommended checking back after history accumulates. Honest answer — the agent doesn't fabricate patterns.

---

## Test Case 7: Retro Autopilot (On-Demand)

**Role**: PM
**Trigger**: User asks "Draft a retro for this project"
**Ship State**: Direct File project with completed issues

**Execution Path**:
```
Trigger → User → [Project Fetch || Person Fetch] → Gemini (ON_DEMAND / RETRO_DRAFT) → Notification
```

**What to look for in the trace:**
- Retro Fetch node activates to split issues into completed vs carryover.
- Gemini mode is `RETRO_DRAFT` — produces a structured retrospective with what went well, what didn't, and carryover items.
- The draft goes into `drafts` in the graph state — it's presented to the user for editing before any mutation happens.

**When the agent acts**: Generates a draft document.
**When the agent waits**: The user must review, edit, and explicitly confirm the retro. The agent never publishes it automatically.

**The human decision**: "Here's a draft retro based on your completed issues. Edit it, then confirm." The user owns the final content.

> [View Trace](https://smith.langchain.com/public/f4a2bbc1-67d4-4889-b4bd-b9f77df29515/r)

**Expected Result**: Retro draft with completed issue IDs, assignees, and priority analysis.

**Actual Result**: Generated retro listing completed issues, assignees, and priority distribution.

---

## Test Case 8: Load Balancer (On-Demand)

**Role**: PM/Director
**Trigger**: User asks "Who's overloaded? Can we rebalance?"
**Ship State**: Direct File team — Rachel (2 high), Devon (3 active), Aisha (2 active), Carlos (3 active)

**Execution Path**:
```
Trigger → User → [Project Fetch || Person Fetch] → Gemini (LOAD_BALANCER) → Notification
```

**What to look for in the trace:**
- Gemini mode is `LOAD_BALANCER` — compares workload across team members and suggests specific reassignments.
- The analysis names specific issues and people: "Move AUTH-42 from Alice to Frank."
- Suggestions generated require approval — reassignment is a mutation.

**When the agent acts**: Writes reassignment suggestions to the action queue.
**When the agent waits**: Each reassignment is a separate approval. The manager can approve moving one issue but reject another.

**The human decision**: Per-reassignment approval. "Move AUTH-42 from Alice to Frank" — Approve / Dismiss. The agent never moves work without explicit consent.

> [View Trace](https://smith.langchain.com/public/f4a2bbc1-67d4-4889-b4bd-b9f77df29515/r)

**Expected Result**: Workload comparison with specific reassignment suggestions.

**Actual Result**: Compared all team members, suggested specific rebalancing moves with rationale.

---

## Summary: Execution Path Map (1 min)

| Test | Mode | Threshold? | Suggestions? | Human Approval? |
|------|------|:----------:|:------------:|:---------------:|
| 1. Director Overview | Scheduled | Yes | No (clean) | No — read-only |
| 2. PM Alert | Event | Yes | Yes (1) | Yes — approve/dismiss/snooze |
| 3. Engineer Nudge | Event | Yes | Yes (3) | Yes — per-issue |
| 4. Morning Briefing | Scheduled | Yes | Yes (1) | Yes — in briefing queue |
| 5. Project Kickoff | On-demand | No | No | No — advisory |
| 6. Coach | On-demand | No | No | No — read-only |
| 7. Retro Draft | On-demand | No | No (draft) | Yes — user edits before confirm |
| 8. Load Balancer | On-demand | No | Yes | Yes — per-reassignment |

**The pattern**:
- **Threshold runs** = proactive and scheduled modes. Deterministic math, zero AI cost.
- **Suggestions generated** = only when violations detected OR load-balancing requested.
- **Human approval required** = any time the agent proposes a data mutation.
- **Read-only output** = briefings, coaching, kickoff analysis. No approval needed.

---

## Closing: Three Architectural Bets (1 min)

1. **Deterministic thresholds + AI explanation** — The agent never decides what to do based on Gemini output. Thresholds decide. Gemini explains why. This makes the system auditable and testable.

2. **Single graph, multiple paths** — One `StateGraph` with conditional edges. No "simple mode" shortcuts. Every run produces a LangSmith trace showing exactly which path was taken and why.

3. **Suggest, never execute** — Every mutation goes through the action queue. The agent's job is to surface the right information at the right time. The human's job is to decide.

**105 unit tests. 8 use cases. 12 public traces. < $5 total development cost.**
