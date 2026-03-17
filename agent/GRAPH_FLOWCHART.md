# FleetGraph — System Flowchart

## The Agent Loop

The FleetGraph agent is a continuous loop, not a one-shot pipeline. There are three ways the loop re-enters:

1. **Proactive loop**: Issue mutation → WebSocket event → debounce → graph run → suggestion → user approves → Ship API mutation → WebSocket event → graph re-evaluates
2. **Scheduled loop**: Cron fires → graph run → surfaces new violations → user acts → mutations trigger proactive loop
3. **Command loop**: User types command in chat (e.g. "run a health check") → full graph runs with thresholds + suggestions → results stream into chat with inline actions → user approves → mutation → proactive loop

### On-Demand: Chat vs Command

Regular chat questions ("how is this project?") stream Gemini directly — no thresholds, no suggestions.

Command questions trigger the full proactive pipeline inside the chat:

| Command | What Runs |
|---------|-----------|
| "Run a health check on this project" | Fetch → Threshold → Gemini → Suggestions |
| "Give me my morning briefing" | ProgramFetch → Threshold → Gemini DIRECTOR_OVERVIEW |
| "Check for stale issues" | Fetch → Threshold (staleness) → Gemini → Suggestions |
| "Scan all programs for risk" | ProgramFetch → Threshold per project → Gemini DIRECTOR_OVERVIEW |

```mermaid
flowchart TD
    subgraph TRIGGERS["🔵 ENTRY POINTS"]
        E1["👤 User Chat<br/><i>on-demand</i>"]
        E2["📝 Issue Changed<br/><i>WebSocket event</i>"]
        E3["⏰ Daily Briefing<br/><i>cron @ 07:00</i>"]
        E4["⏰ Staleness Scan<br/><i>hourly cron</i>"]
    end

    DB["⏳ 30s Debounce<br/><i>per project</i>"]
    E2 --> DB

    subgraph GRAPH["🟡 LANGGRAPH STATE GRAPH"]
        direction TB

        TC["1. Trigger Context"] --> UC["2. User Context"]

        UC --> FETCH

        subgraph FETCH["⚡ Parallel Fetch (fan-out)"]
            direction LR
            PF["3. Project\nFetch"]
            PeF["4. Person\nFetch"]
            PrF["5. Program\nFetch"]
            HF["6. History\nFetch"]
            RF["7. Retro\nFetch"]
        end

        FETCH -->|"proactive path"| TE["8. Threshold Evaluator\n<i>deterministic math</i>\n• >7 high priority?\n• >5 in-progress?\n• >2 high/person?\n• stale >2/5/30 days?"]

        FETCH -->|"on-demand path"| GR

        TE --> GR["9. Gemini Reasoner\n<i>gemini-2.5-flash</i>\n<b>ALWAYS RUNS</b>\n8 prompt modes"]

        GR -->|"violations found"| SG["10. Suggestion\nGenerator\n<i>deterministic</i>"]
        GR -->|"clean / on-demand"| NS

        SG --> NS["11. Notification\nSender"]
    end

    E1 --> TC
    DB --> TC
    E3 --> TC
    E4 --> TC

    subgraph OUTPUT["🟢 OUTPUT"]
        direction LR
        AQ["📋 Action Queue\n<i>approve / dismiss / snooze</i>"]
        CP["💬 Chat Panel\n<i>SSE streaming</i>"]
        DB2["🗄️ agent_actions\n<i>persistent history</i>"]
        LS["📊 LangSmith\n<i>traces</i>"]
    end

    NS --> AQ
    NS --> DB2
    GR -.->|"streaming tokens"| CP
    GRAPH -.-> LS

    subgraph HITL["🔴 HUMAN-IN-THE-LOOP"]
        APPROVE["✅ Approve\n<i>executes the change</i>"]
        DISMISS["❌ Dismiss\n<i>archived, won't repeat\nunless condition worsens</i>"]
        SNOOZE["💤 Snooze\n<i>re-evaluate after\n24h or 1 week</i>"]
    end

    AQ --> APPROVE
    AQ --> DISMISS
    AQ --> SNOOZE

    %% === THE LOOP ===
    APPROVE -->|"PATCH /api/issues/:id\nchanges priority or status"| MUTATION["📝 Ship API\nMutation"]
    MUTATION -->|"broadcasts\nissue:updated"| E2

    SNOOZE -->|"snooze expires"| E4

    %% Styling
    style MUTATION fill:#fef3c7,stroke:#d97706
    style E2 fill:#dbeafe,stroke:#3b82f6
    style E4 fill:#dbeafe,stroke:#3b82f6
    style APPROVE fill:#d1fae5,stroke:#059669
    style DISMISS fill:#f3f4f6,stroke:#6b7280
    style SNOOZE fill:#dbeafe,stroke:#3b82f6
```

## Gemini Mode Selection

```mermaid
flowchart LR
    subgraph TRIGGER["Trigger Type"]
        T1["event"]
        T2["scheduled"]
        T3["on_demand"]
    end

    subgraph CONDITION["Condition"]
        V0["no violations"]
        V1["violations detected"]
        PD["program_data present"]
        RD["retro_data present"]
        QC["question: coach/pattern"]
        QL["question: workload/balance"]
        QK["question: kickoff/new project"]
        QG["question: general"]
    end

    subgraph MODE["Gemini Mode"]
        M1["PROACTIVE_CLEAN"]
        M2["PROACTIVE_VIOLATIONS"]
        M3["DIRECTOR_OVERVIEW"]
        M4["RETRO_DRAFT"]
        M5["COACH"]
        M6["LOAD_BALANCER"]
        M7["PROJECT_KICKOFF"]
        M8["ON_DEMAND"]
    end

    T1 --> V0 --> M1
    T1 --> V1 --> M2
    T2 --> PD --> M3
    T2 --> RD --> M4
    T2 --> V1 --> M2
    T2 --> V0 --> M1
    T3 --> QC --> M5
    T3 --> QL --> M6
    T3 --> QK --> M7
    T3 --> QG --> M8

    style M1 fill:#d1fae5
    style M2 fill:#fee2e2
    style M3 fill:#dbeafe
    style M4 fill:#e0e7ff
    style M5 fill:#fef3c7
    style M6 fill:#fce7f3
    style M7 fill:#f0fdf4
    style M8 fill:#f5f5f4
```

## The Loop in Plain English

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ENTRY: Issue changes in Ship (or cron fires)           │
│    ↓                                                    │
│  DEBOUNCE: 30 seconds per project                       │
│    ↓                                                    │
│  FETCH: Get project issues + person workload            │
│    ↓                                                    │
│  EVALUATE: Check thresholds (deterministic, no AI)      │
│    ↓                                                    │
│  REASON: Gemini 2.5 Flash analyzes (always runs)        │
│    ↓                                                    │
│  SUGGEST: Map violations → concrete actions             │
│    ↓                                                    │
│  PERSIST: Write to agent_actions + notify user          │
│    ↓                                                    │
│  HUMAN: User sees suggestion → Approve / Dismiss / Snooze│
│    ↓                                                    │
│  IF APPROVE: Ship API patches the issue                 │
│    ↓                                                    │
│  LOOP: Mutation fires WebSocket event → back to top     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

The agent never stops. Proactive mode loops through events continuously. Scheduled mode adds periodic sweeps. On-demand mode is a user-initiated single pass through the graph that returns a streaming response.
