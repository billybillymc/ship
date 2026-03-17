/**
 * FleetGraph State — the contract for all graph runs.
 * Matches PRESEARCH.md Section 11 exactly.
 */
import { Annotation } from '@langchain/langgraph';

// ── Payload types ──────────────────────────────────────────────────────

export interface EventPayload {
  document_ids: string[];
  project_id: string;
  assignee_ids: string[];
}

export interface SchedulePayload {
  schedule_type: 'morning_briefing' | 'staleness_cron';
}

export interface OnDemandPayload {
  user_question: string;
  view_context: ViewContext;
}

export interface ViewContext {
  document_type: string;
  document_id: string;
  title?: string;
}

// ── Data snapshots ─────────────────────────────────────────────────────

export interface Issue {
  id: string;
  title: string;
  state: string;
  priority: string;
  assignee_id: string | null;
  estimate: number | null;
  updated_at: string;
  created_at: string;
  ticket_number?: number;
}

export interface Project {
  id: string;
  title: string;
  properties: Record<string, unknown>;
}

export interface ProjectSnapshot {
  project: Project;
  issues: Issue[];
}

export interface PersonSnapshot {
  person_id: string;
  person_name: string;
  issues: Issue[];
}

export interface ProgramSnapshot {
  program_id: string;
  program_name: string;
  projects: Project[];
}

export interface RetroSnapshot {
  week_id: string;
  completed_issues: Issue[];
  carryover_issues: Issue[];
}

export interface AgentActionHistory {
  actions: AgentAction[];
}

// ── Reasoning outputs ──────────────────────────────────────────────────

export interface Violation {
  type: 'priority_overload' | 'in_progress_overload' | 'person_overload' | 'stale_issue';
  severity: number;
  entity_type: 'project' | 'person';
  entity_id: string;
  entity_name: string;
  details: Record<string, unknown>;
}

export interface GeminiReasonerOutput {
  mode: 'PROACTIVE_CLEAN' | 'PROACTIVE_VIOLATIONS' | 'ON_DEMAND'
    | 'DIRECTOR_OVERVIEW' | 'COACH' | 'RETRO_DRAFT' | 'LOAD_BALANCER' | 'PROJECT_KICKOFF';
  content: string;
  token_count?: number;
}

// ── Action outputs ─────────────────────────────────────────────────────

export interface PendingSuggestion {
  action_type: string;
  target_user_id: string;
  context: Record<string, unknown>;
  suggestion: Record<string, unknown>;
  gemini_reasoning: string;
  severity_score: number;
}

export interface DraftContent {
  document_id: string;
  content: string;
}

export interface Notification {
  user_id: string;
  message: string;
  action_ids?: string[];
}

export interface AgentAction {
  id: string;
  workspace_id: string;
  target_user_id: string;
  action_type: string;
  status: string;
  severity_score: number | null;
  context: Record<string, unknown>;
  suggestion: Record<string, unknown>;
  gemini_reasoning: string | null;
  snooze_until: string | null;
  resolved_at: string | null;
  langsmith_trace_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GraphError {
  node: string;
  message: string;
  timestamp: string;
}

export interface Message {
  role: 'user' | 'agent';
  content: string;
}

// ── LangGraph state annotation ─────────────────────────────────────────

export const FleetGraphAnnotation = Annotation.Root({
  // Trigger
  trigger_type: Annotation<'event' | 'scheduled' | 'on_demand'>({
    reducer: (_prev, next) => next,
    default: () => 'event' as const,
  }),
  trigger_payload: Annotation<EventPayload | SchedulePayload | OnDemandPayload | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // User
  target_user_id: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  user_role: Annotation<'director' | 'pm' | 'engineer'>({
    reducer: (_prev, next) => next,
    default: () => 'engineer' as const,
  }),

  // Fetched data
  project_data: Annotation<ProjectSnapshot | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  person_data: Annotation<PersonSnapshot | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  program_data: Annotation<ProgramSnapshot | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  retro_data: Annotation<RetroSnapshot | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  history_data: Annotation<AgentActionHistory | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // Reasoning
  violations: Annotation<Violation[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  gemini_output: Annotation<GeminiReasonerOutput | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // Actions
  suggestions: Annotation<PendingSuggestion[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  drafts: Annotation<DraftContent[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  notifications: Annotation<Notification[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  // On-demand chat
  conversation_history: Annotation<Message[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  user_question: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  current_view_context: Annotation<ViewContext | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // Meta
  run_id: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  errors: Annotation<GraphError[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

export type FleetGraphState = typeof FleetGraphAnnotation.State;
