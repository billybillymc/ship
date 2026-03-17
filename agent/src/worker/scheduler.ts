/**
 * Scheduler — runs morning briefings and staleness cron.
 *
 * Morning briefing (daily): For each user, aggregates violations across
 * their projects and composes a Gemini-powered briefing.
 *
 * Staleness cron (hourly): Scans for issues past their update thresholds
 * and triggers graph runs grouped by project.
 */
import { v4 as uuidv4 } from 'uuid';
import type { ShipClient } from '../lib/ship-client.js';
import type { GeminiClient } from '../lib/gemini-client.js';
import { evaluateProjectThresholds, DEFAULT_THRESHOLDS } from '../lib/thresholds.js';
import type { Violation, ProjectSnapshot, Issue } from '../graph/state.js';

export interface SchedulerDeps {
  shipClient: ShipClient;
  geminiClient: GeminiClient;
  workspaceId: string;
  graphInvoke: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const BRIEFING_PROMPT = `You are FleetGraph, an AI project health monitor. Compose a concise morning briefing for this user.

Summarize:
1. Projects that need attention (violations detected)
2. Stale issues that need updates
3. Overall workload health

Keep it to 3-5 bullet points. Reference specific project names and issue counts. If everything is healthy, say so in one sentence.`;

export class Scheduler {
  private intervals: NodeJS.Timeout[] = [];
  private deps: SchedulerDeps;

  constructor(deps: SchedulerDeps) {
    this.deps = deps;
  }

  /**
   * Start all scheduled jobs.
   */
  start(): void {
    // Morning briefing — run daily (check every hour, fire at 07:00 UTC)
    this.schedule('morning-briefing', 60 * 60 * 1000, async () => {
      const hour = new Date().getUTCHours();
      if (hour === 7) {
        await this.runMorningBriefings();
      }
    });

    // Staleness cron — run hourly
    this.schedule('staleness-cron', 60 * 60 * 1000, async () => {
      await this.runStalenessScan();
    });

    console.log('[Scheduler] Started morning briefing (07:00 UTC) and staleness cron (hourly)');
  }

  /**
   * Run morning briefings for all users.
   */
  async runMorningBriefings(): Promise<void> {
    console.log('[Scheduler] Running morning briefings...');

    try {
      // Get all users with assigned issues
      const allIssues = await this.deps.shipClient.getPersonIssues('');
      // Group issues by assignee
      const issuesByUser = new Map<string, Issue[]>();
      for (const issue of allIssues) {
        if (!issue.assignee_id) continue;
        const existing = issuesByUser.get(issue.assignee_id) ?? [];
        existing.push(issue);
        issuesByUser.set(issue.assignee_id, existing);
      }

      let briefingsCreated = 0;
      for (const [userId, userIssues] of issuesByUser) {
        try {
          await this.createBriefingForUser(userId, userIssues);
          briefingsCreated++;
        } catch (error) {
          console.error(`[Scheduler] Briefing failed for user ${userId}:`, error);
        }
      }

      console.log(`[Scheduler] Created ${briefingsCreated} morning briefings`);
    } catch (error) {
      console.error('[Scheduler] Morning briefing run failed:', error);
    }
  }

  private async createBriefingForUser(userId: string, issues: Issue[]): Promise<void> {
    // Group issues by project (we don't have project IDs on issues directly,
    // so we pass the person's full issue set to Gemini for analysis)
    const highPriority = issues.filter(i => i.priority === 'high' && i.state !== 'done');
    const inProgress = issues.filter(i => i.state === 'in_progress');

    const context = JSON.stringify({
      user_id: userId,
      total_issues: issues.length,
      high_priority_count: highPriority.length,
      in_progress_count: inProgress.length,
      issues: issues.slice(0, 50), // Cap context size
    });

    const briefingContent = await this.deps.geminiClient.reason(BRIEFING_PROMPT, context);

    // Persist as an agent_action with type 'briefing'
    if (this.deps.workspaceId) {
      await this.deps.shipClient.createAgentAction({
        workspace_id: this.deps.workspaceId,
        target_user_id: userId,
        action_type: 'briefing',
        severity_score: null,
        context: { type: 'morning_briefing', issue_count: issues.length },
        suggestion: { content: briefingContent },
        gemini_reasoning: briefingContent,
        langsmith_trace_id: null,
      });
    }
  }

  /**
   * Scan for stale issues and trigger graph runs per project.
   */
  async runStalenessScan(): Promise<void> {
    console.log('[Scheduler] Running staleness scan...');

    try {
      // Fetch all non-done issues and check staleness
      const allIssues = await this.deps.shipClient.getPersonIssues('');
      const now = new Date();
      const staleByProject = new Map<string, { projectId: string; assigneeIds: Set<string> }>();

      for (const issue of allIssues) {
        if (issue.state === 'done') continue;

        const daysSinceUpdate = (now.getTime() - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24);
        let threshold: number | null = null;

        if (issue.priority === 'high') threshold = DEFAULT_THRESHOLDS.staleDaysHigh;
        else if (issue.priority === 'medium') threshold = DEFAULT_THRESHOLDS.staleDaysMedium;
        else if (issue.priority === 'low') threshold = DEFAULT_THRESHOLDS.staleDaysLow;

        if (threshold !== null && daysSinceUpdate > threshold) {
          // We need the project ID — for now use issue ID as a grouping key
          // In a full implementation, we'd fetch project associations
          const key = issue.id;
          if (!staleByProject.has(key)) {
            staleByProject.set(key, { projectId: '', assigneeIds: new Set() });
          }
          if (issue.assignee_id) {
            staleByProject.get(key)!.assigneeIds.add(issue.assignee_id);
          }
        }
      }

      // Trigger graph runs for stale issues
      let runsTriggered = 0;
      for (const [_key, { projectId, assigneeIds }] of staleByProject) {
        const runId = uuidv4();
        try {
          await this.deps.graphInvoke({
            trigger_type: 'scheduled',
            trigger_payload: { schedule_type: 'staleness_cron' },
            target_user_id: [...assigneeIds][0] ?? '',
            run_id: runId,
          });
          runsTriggered++;
        } catch (error) {
          console.error(`[Scheduler] Staleness graph run failed:`, error);
        }
      }

      console.log(`[Scheduler] Staleness scan: ${staleByProject.size} stale issues, ${runsTriggered} graph runs`);
    } catch (error) {
      console.error('[Scheduler] Staleness scan failed:', error);
    }
  }

  /** Schedule a repeating job */
  schedule(name: string, intervalMs: number, callback: () => Promise<void>): void {
    const id = setInterval(async () => {
      try {
        await callback();
      } catch (error) {
        console.error(`[Scheduler] Job "${name}" failed:`, error);
      }
    }, intervalMs);
    this.intervals.push(id);
  }

  /** Clear all scheduled jobs */
  clear(): void {
    for (const id of this.intervals) {
      clearInterval(id);
    }
    this.intervals = [];
  }
}
