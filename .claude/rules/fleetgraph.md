# FleetGraph Agent — Engineering Rules

These rules apply when working on the graph agent (`agent/` package). Read `PRESEARCH.md` and `GRAPH_AGENT_PRD.md` before starting any implementation step — they are the source of truth for all design decisions.

## Architecture Guardrails

1. **The agent is a separate process.** Never import from `api/src/` directly. Never share database connections with the Ship API. All communication with Ship goes through HTTP (REST API) or WebSocket (`/events`). If you feel tempted to "just import that one helper," don't — copy it or build an equivalent.

2. **All Ship data comes from the REST API.** The agent does not query Ship's database tables directly. The only table the agent owns and queries directly is `agent_actions`. Everything else (issues, projects, programs, persons, weeks) is fetched via `ShipClient` over HTTP.

3. **One graph, two modes.** Both proactive and on-demand modes run through the same LangGraph `StateGraph`. Do not build a second graph, a shortcut function, or a "simple path" that bypasses the graph. The difference between modes is the trigger and the conditional edges — not the graph definition.

4. **Gemini Reasoner always runs.** Every graph execution must invoke the Gemini Reasoner node — clean runs get a health summary, problem runs get deep analysis, on-demand runs answer the user's question. Never skip it for "optimization." LangSmith traces must show Gemini Reasoner on every run.

## Code Patterns

5. **Nodes never throw uncaught.** Every node must catch its own errors and write them to `state.errors`. The graph must never crash the agent process. If a fetch node fails, the graph continues with available data. If Gemini fails, the graph falls back to structured templated alerts.

6. **Fetch nodes are always parallel.** Use LangGraph fan-out for fetch nodes. Never serialize fetches "because it's easier" or "just for now." Parallel fetch is visible in LangSmith traces and is a graded requirement.

7. **Suggestions come from violations, not from Gemini text.** The Suggestion Generator maps violations to concrete actions deterministically (e.g., `priority_overload` → suggest demoting lowest-severity issue). Gemini provides the `gemini_reasoning` explanation text, not the action itself. Never parse free-text Gemini output to decide what action to take.

8. **LangSmith trace metadata on every run.** Every graph invocation must include metadata: `trigger_type`, `project_id` (or `document_id` for on-demand), `target_user_id`, and `run_id`. This is required for the test cases table in FLEETGRAPH.md.

## Frontend

9. **Chat panel and action queue are separate surfaces.** The chat panel is a slide-out overlay for on-demand conversations (ephemeral, cleared on close). The action queue is a persistent list of pending suggestions (approve/dismiss/snooze). Do not merge them into one component.

10. **On-demand chat streams via SSE.** The `POST /api/agent/on-demand` endpoint returns a Server-Sent Events stream. The frontend renders tokens as they arrive. Never wait for the full Gemini response before rendering.

## Process

11. **Every step gets its own branch.** Branch naming: `fleetgraph/step-NN-short-description`. Branch from `fleetgraph_start`. Merge before starting the next dependent step.

12. **Read the planning docs first.** Before starting any implementation step, re-read the relevant sections of `PRESEARCH.md` and `GRAPH_AGENT_PRD.md`. They contain the exact interfaces, schemas, prompt strategies, and acceptance criteria.

13. **Don't sign commits.** No Co-Authored-By lines or AI attribution in commit messages.
