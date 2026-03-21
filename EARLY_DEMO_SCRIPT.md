# FleetGraph Demo Script (~5 min)

**Setup:** Ship API + Agent running, LangSmith open, suggestions pre-populated from initial scan.

---

## 1. System Overview (30 sec)

- Two terminals: Ship API (:3000) and FleetGraph Agent (:3001)
- Agent log shows: `[EventListener] Connected to Ship events`
- "Separate process, WebSocket listener, 8 use cases, all traced in LangSmith."

---

## 2. Proactive Detection + HITL (2 min)

### Show pre-populated suggestions (UC2: PM Alert, UC3: Engineer Nudge)

Open the beaker icon in Ship UI. 5 suggestion cards from initial scan:
- **Priority overload** on Direct File (>7 high-priority, UC2)
- **Stale issues** on IMF Migration (>2 days without update, UC3)
- Each card: action, project link, issue link, Approve/Dismiss/Snooze

### Approve one (HITL loop)

Click **Approve** on a priority change card. The issue priority changes in Ship immediately. "Agent never mutates without human approval."

### Dismiss + Snooze

Dismiss one card, snooze another. "Dismissed items won't return unless the condition worsens. Snoozed items re-evaluate after 24h — only resurface if worse."

---

## 3. On-Demand Chat — All 5 Chat Use Cases (2 min)

Run through each using the quick-action buttons in the chat panel:

### UC1: Director Overview / UC4: Morning Briefing
Click **"Give me my morning briefing"** — portfolio-wide scan streams in, ranking Direct File (priority overload), Payment Integrity (WIP overload), IMF Migration (stale issues).

### UC5: Project Kickoff
Type **"Should we create a new project from orphaned issues?"** — agent evaluates whether clustering is warranted.

### UC6: Coach
Type **"What are the work patterns for Andrew Martinez?"** — analyzes workload patterns, flags 10 high-priority items, notes cold-start if insufficient history.

### UC7: Retro Autopilot
Navigate to Direct File, click **"Draft a retrospective"** — generates structured retro: what went well (3 done issues by name), carryover, velocity.

### UC8: Load Balancer
Click **"Balance the workload on this team"** — compares Rachel (2 high), Devon (3 active), Aisha (2 active), Carlos (3 active), suggests specific reassignments.

### UC2: Health Check with inline HITL
Click **"Run a health check on this project"** on Payment Integrity — finds 6 in-progress issues (threshold: 5). Inline suggestion card appears with **Apply/Dismiss** buttons. Click Apply — status changes in Ship.

---

## 4. LangSmith Trace Walkthrough (1 min)

Open both traces side-by-side (or toggle between tabs):

### Violation Trace
[https://smith.langchain.com/public/3f9912f3-b3f8-46f2-a9ba-4fea56065d4a/r](https://smith.langchain.com/public/3f9912f3-b3f8-46f2-a9ba-4fea56065d4a/r)

Walk through the node spans:
1. **triggerContext + userContext** — sets up the event payload and target user
2. **projectFetch + personFetch** — "These two spans are concurrent. LangGraph fan-out, visible right here in the trace."
3. **thresholdEvaluator** — "Expand this node's output: you can see the violations array — `priority_overload`, severity 12, the exact issue IDs that pushed past the threshold."
4. **geminiReasoner** — "Mode: `PROACTIVE_VIOLATIONS`. Gemini received the violations + project data, produced root-cause analysis referencing specific issues."
5. **suggestionGenerator** — "Deterministic: violation mapped to 'demote lowest high-priority issue'. Gemini provides the explanation text, not the action."
6. **notificationSender** — "Persists to `agent_actions` table. User sees it in the action queue."

### Clean/On-Demand Trace
[https://smith.langchain.com/public/ccfa67d3-900f-4c3c-a977-58fcba4fd65b/r](https://smith.langchain.com/public/ccfa67d3-900f-4c3c-a977-58fcba4fd65b/r)

"Now look at this trace — visibly different. Same graph, different path:"
- **No thresholdEvaluator node** — skipped entirely
- **No suggestionGenerator node** — skipped entirely
- **geminiReasoner** — different prompt mode, shorter output, answers the user's question directly
- "This proves conditional routing is working. Both traces come from the same compiled graph, but LangSmith shows different execution paths."

---

## 5. Close (15 sec)

"8 use cases, one graph, two visible execution paths in LangSmith. Event to suggestion in ~45 seconds. Well under the 5-minute SLA."

---

## Latency Budget

| Phase | Time |
|-------|------|
| WebSocket event delivery | < 100ms |
| Debounce window | 30s |
| Parallel fetch | 1-3s |
| Threshold evaluator (pure math) | < 100ms |
| Gemini reasoner | 3-15s |
| Suggestion + persist | 1-2s |
| **Total** | **~35-50s** |

## Self-Test: Verify < 5 Minute SLA

```bash
# Terminal 1: Start Ship
cd ship2 && pnpm dev

# Terminal 2: Start Agent
cd ship2/agent && pnpm dev
# Wait for "[EventListener] Connected to Ship events"
```

1. Open `localhost:5173`, login as `dev@ship.local` / `admin123`
2. Wait ~2.5 min for initial scan to populate suggestions
3. Open beaker icon — verify 5 suggestion cards (UC2, UC3)
4. Approve one — verify issue changes in Ship (HITL)
5. Open chat — run each use case:
   - "Give me my morning briefing" (UC1/UC4)
   - "Should we create a new project?" (UC5)
   - "What are work patterns for Andrew Martinez?" (UC6)
   - "Draft a retrospective" on Direct File (UC7)
   - "Balance the workload on this team" (UC8)
   - "Run a health check" on Payment Integrity (UC2 + inline HITL)
6. **Debounce test:** change 3 issues rapidly — only 1 LangSmith trace appears
7. Check LangSmith — verify parallel fetches, metadata on every trace

## Use Case Reference

| # | Use Case | Role | Trigger | Demo Method |
|---|----------|------|---------|-------------|
| 1 | Director Overview | Director | Morning scan | Chat: "morning briefing" |
| 2 | PM Alert | PM | Project change | Suggestion panel + chat health check |
| 3 | Engineer Nudge | Engineer | Staleness | Suggestion panel (stale issues) |
| 4 | Morning Briefing | All | Daily cron | Chat: "morning briefing" |
| 5 | Project Kickoff | PM/Director | Pattern detection | Chat: "create new project?" |
| 6 | Coach | Engineer/Mgr | On-demand | Chat: "work patterns for [name]" |
| 7 | Retro Autopilot | PM | Week end | Chat: "draft a retrospective" |
| 8 | Load Balancer | PM/Director | On-demand | Chat: "balance the workload" |
