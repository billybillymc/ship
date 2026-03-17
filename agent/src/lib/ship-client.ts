/**
 * HTTP client for Ship's REST API, authenticated as the service account.
 * All Ship data comes through here — the agent never queries Ship's DB directly.
 */
import type { Issue, Project, AgentAction, PendingSuggestion } from '../graph/state.js';

export interface NewAgentAction {
  workspace_id: string;
  target_user_id: string;
  action_type: string;
  severity_score: number | null;
  context: Record<string, unknown>;
  suggestion: Record<string, unknown>;
  gemini_reasoning: string | null;
  langsmith_trace_id: string | null;
}

export class ShipClient {
  constructor(
    private baseUrl: string,
    private serviceToken: string,
  ) {}

  private async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.serviceToken}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await globalThis.fetch(url, { ...options, headers });

        if (response.status >= 500) {
          lastError = new Error(`Ship API returned ${response.status}: ${await response.text()}`);
          // Retry on 5xx with exponential backoff
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }

        if (response.status >= 400) {
          const body = await response.text();
          throw new Error(`Ship API ${response.status} on ${path}: ${body}`);
        }

        return response;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Ship API 4')) {
          throw error; // Don't retry 4xx
        }
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError ?? new Error(`Ship API request failed after retries: ${path}`);
  }

  // ── Fetch methods (used by fetch nodes) ───────────────────────────────

  async getProjectIssues(projectId: string): Promise<Issue[]> {
    const res = await this.fetch(`/api/issues?project_id=${projectId}`);
    const data = await res.json() as Issue[] | { data: Issue[] };
    return Array.isArray(data) ? data : (data.data ?? []);
  }

  async getPersonIssues(assigneeId: string): Promise<Issue[]> {
    const res = await this.fetch(`/api/issues?assignee_id=${assigneeId}`);
    const data = await res.json() as Issue[] | { data: Issue[] };
    return Array.isArray(data) ? data : (data.data ?? []);
  }

  async getProject(projectId: string): Promise<Project> {
    const res = await this.fetch(`/api/documents/${projectId}`);
    return await res.json() as Project;
  }

  async getProgramProjects(programId: string): Promise<Project[]> {
    const res = await this.fetch(`/api/documents?program_id=${programId}&document_type=project`);
    const data = await res.json() as Project[] | { data: Project[] };
    return Array.isArray(data) ? data : (data.data ?? []);
  }

  async getPrograms(): Promise<Project[]> {
    const res = await this.fetch('/api/programs');
    const data = await res.json() as Project[] | { data: Project[] };
    return Array.isArray(data) ? data : (data.data ?? []);
  }

  async getAllIssues(): Promise<Issue[]> {
    const res = await this.fetch('/api/issues');
    const data = await res.json() as Issue[] | { data: Issue[] };
    return Array.isArray(data) ? data : (data.data ?? []);
  }

  // ── Action methods (used by action nodes) ─────────────────────────────

  async updateIssue(issueId: string, updates: Partial<Issue>): Promise<void> {
    await this.fetch(`/api/issues/${issueId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async createAgentAction(action: NewAgentAction): Promise<AgentAction> {
    const res = await this.fetch('/api/agent/suggestions', {
      method: 'POST',
      body: JSON.stringify(action),
    });
    return await res.json() as AgentAction;
  }

  async getAgentActions(userId: string, status?: string): Promise<AgentAction[]> {
    const params = new URLSearchParams({ user_id: userId });
    if (status) params.set('status', status);
    const res = await this.fetch(`/api/agent/suggestions?${params}`);
    const data = await res.json() as AgentAction[] | { data: AgentAction[] };
    return Array.isArray(data) ? data : (data.data ?? []);
  }

  async notifyUser(userId: string, eventType: string, data: Record<string, unknown>): Promise<void> {
    // POST to Ship API which broadcasts via WebSocket
    await this.fetch('/api/agent/notify', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, event_type: eventType, data }),
    });
  }

  async updateAgentAction(
    actionId: string,
    updates: { status: string; snooze_until?: string },
  ): Promise<AgentAction> {
    const res = await this.fetch(`/api/agent/suggestions/${actionId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return await res.json() as AgentAction;
  }
}
