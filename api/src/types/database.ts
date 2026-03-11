/**
 * Database row types for SQL query results.
 * These replace `any` in extractFromRow helpers and query parameter arrays.
 */

/** Valid SQL parameter types for parameterized queries */
export type SqlParam = string | number | boolean | null | undefined | string[] | number[];

/** Base document row from the documents table */
export interface DocumentRow {
  id: string;
  workspace_id: string;
  document_type: string;
  title: string;
  content: Record<string, unknown> | null;
  yjs_state: Buffer | null;
  parent_id: string | null;
  position: number;
  properties: Record<string, unknown>;
  ticket_number: number | null;
  archived_at: string | null;
  deleted_at: string | null;
  visibility: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  reopened_at: string | null;
  converted_to_id: string | null;
  converted_from_id: string | null;
  converted_at: string | null;
  converted_by: string | null;
  original_type: string | null;
  conversion_count: number;
}

/** Issue row with JOIN fields (assignee, creator names) */
export interface IssueRow extends DocumentRow {
  assignee_name?: string;
  assignee_archived?: boolean;
  created_by_name?: string;
  can_access?: boolean;
}

/** Project row with JOIN fields (owner, counts, program, status) */
export interface ProjectRow extends DocumentRow {
  owner_id?: string;
  owner_name?: string;
  owner_email?: string;
  program_id?: string | null;
  sprint_count?: string;
  issue_count?: string;
  inferred_status?: string;
}

/** Program row with JOIN fields (owner, counts) */
export interface ProgramRow extends DocumentRow {
  owner_id?: string;
  owner_name?: string;
  owner_email?: string;
  issue_count?: string;
  sprint_count?: string;
}

/** Sprint row with JOIN fields (owner, program, counts) */
export interface SprintRow extends DocumentRow {
  owner_id?: string;
  owner_name?: string;
  owner_email?: string;
  program_id?: string | null;
  program_name?: string;
  program_prefix?: string;
  program_accountable_id?: string | null;
  owner_reports_to?: string | null;
  workspace_sprint_start_date?: string;
  issue_count?: string;
  completed_count?: string;
  started_count?: string;
  has_plan?: boolean | string;
  has_retro?: boolean | string;
  retro_outcome?: string | null;
  retro_id?: string | null;
  project_id?: string | null;
  project_name?: string | null;
}

/** Feedback row with JOIN fields */
export interface FeedbackRow extends DocumentRow {
  program_id?: string | null;
  program_name?: string;
  program_prefix?: string;
  program_color?: string;
  created_by_name?: string;
}

/** Standup row for formatStandupResponse */
export interface StandupRow {
  id: string;
  parent_id: string;
  title: string;
  content: Record<string, unknown> | null;
  author_id: string;
  author_name: string;
  author_email: string;
  created_at: string;
  updated_at: string;
}

/** Issue state values used in filter callbacks */
export type IssueState = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';

/** Row with issue state from a query (used in filter callbacks) */
export interface IssueStateRow {
  state: IssueState | string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

/** TipTap document node structure */
export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

/** TipTap document root */
export interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}
