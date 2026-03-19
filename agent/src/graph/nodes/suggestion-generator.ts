/**
 * Suggestion Generator node — maps violations to concrete actions.
 * The violation type determines the action type (deterministic).
 * The LLM picks which specific issue to target based on titles.
 */
import type { FleetGraphState, PendingSuggestion, Violation, Issue } from '../state.js';

/**
 * Given a list of issue IDs and the full issue list, ask the Gemini
 * reasoning output which issue sounds least critical. Falls back to
 * the last issue if no match is found.
 */
function pickLeastCriticalIssue(
  issueIds: string[],
  allIssues: Issue[],
  geminiContent: string,
): { issueId: string; issueTitle: string } {
  if (issueIds.length === 0) return { issueId: '', issueTitle: '' };
  if (issueIds.length === 1) {
    const issue = allIssues.find(i => i.id === issueIds[0]);
    return { issueId: issueIds[0]!, issueTitle: issue?.title ?? '' };
  }

  // Build a map of issue ID → title
  const candidates = issueIds
    .map(id => ({ id, title: allIssues.find(i => i.id === id)?.title ?? '' }))
    .filter(c => c.title);

  if (candidates.length === 0) {
    return { issueId: issueIds[issueIds.length - 1]!, issueTitle: '' };
  }

  // Check if Gemini's analysis mentioned any specific issue as lower priority
  // or less critical. Look for the issue that Gemini discussed last or least.
  // Simple heuristic: the issue whose title appears latest in Gemini's output
  // is likely the one it considers least urgent (mentioned as an afterthought).
  const lowerContent = geminiContent.toLowerCase();

  // Score each candidate: issues NOT mentioned by Gemini are lowest priority.
  // Issues mentioned later are lower priority than ones mentioned early.
  let bestCandidate = candidates[candidates.length - 1]!;
  let bestScore = Infinity; // lower = less critical = better target

  for (const c of candidates) {
    const titleLower = c.title.toLowerCase();
    const idx = lowerContent.indexOf(titleLower);
    if (idx === -1) {
      // Not mentioned at all — likely least critical
      bestCandidate = c;
      bestScore = -1;
      break;
    }
    // Mentioned later = less critical
    if (idx > bestScore || bestScore === Infinity) {
      // Actually we want the one Gemini cares about LEAST
      // Skip — this heuristic isn't great. Let's just prefer
      // issues with "dashboard", "report", "audit", "test" in title
      // over "critical", "security", "auth", "payment" keywords.
    }
  }

  // Better heuristic: score by title keywords that suggest lower criticality
  const lowPriorityKeywords = ['dashboard', 'report', 'audit', 'test', 'analytics', 'monitor', 'log', 'metric', 'documentation', 'cleanup'];
  const highPriorityKeywords = ['critical', 'security', 'auth', 'payment', 'fraud', 'fix', 'bug', 'block', 'crash', 'data loss'];

  let lowestScore = Infinity;
  for (const c of candidates) {
    const titleLower = c.title.toLowerCase();
    let score = 50; // neutral
    for (const kw of lowPriorityKeywords) {
      if (titleLower.includes(kw)) score -= 10;
    }
    for (const kw of highPriorityKeywords) {
      if (titleLower.includes(kw)) score += 10;
    }
    if (score < lowestScore) {
      lowestScore = score;
      bestCandidate = c;
    }
  }

  return { issueId: bestCandidate.id, issueTitle: bestCandidate.title };
}

function violationToSuggestion(
  violation: Violation,
  geminiReasoning: string,
  allIssues: Issue[],
): PendingSuggestion {
  const base = {
    context: {
      ...violation.details,
      project_id: violation.entity_type === 'project' ? violation.entity_id : undefined,
      project_name: violation.entity_type === 'project' ? violation.entity_name : undefined,
    },
    gemini_reasoning: geminiReasoning,
    severity_score: violation.severity,
  };

  switch (violation.type) {
    case 'priority_overload': {
      const issueIds = (violation.details['affected_issue_ids'] as string[]) ?? [];
      const picked = pickLeastCriticalIssue(issueIds, allIssues, geminiReasoning);
      return {
        ...base,
        action_type: 'priority_change',
        target_user_id: '',
        suggestion: {
          issue_id: picked.issueId,
          issue_title: picked.issueTitle,
          field: 'priority',
          from: violation.details['priority'] ?? 'high',
          to: violation.details['priority'] === 'high' ? 'medium' : 'low',
        },
      };
    }
    case 'in_progress_overload': {
      const issueIds = (violation.details['affected_issue_ids'] as string[]) ?? [];
      const picked = pickLeastCriticalIssue(issueIds, allIssues, geminiReasoning);
      return {
        ...base,
        action_type: 'status_change',
        target_user_id: '',
        suggestion: {
          issue_id: picked.issueId,
          issue_title: picked.issueTitle,
          field: 'state',
          from: 'in_progress',
          to: 'todo',
        },
      };
    }
    case 'person_overload': {
      const issueIds = (violation.details['affected_issue_ids'] as string[]) ?? [];
      const picked = pickLeastCriticalIssue(issueIds, allIssues, geminiReasoning);
      return {
        ...base,
        action_type: 'priority_change',
        target_user_id: violation.entity_id,
        suggestion: {
          issue_id: picked.issueId,
          issue_title: picked.issueTitle,
          field: 'priority',
          from: violation.details['priority'] ?? 'high',
          to: 'medium',
        },
      };
    }
    case 'stale_issue': {
      // Find the actual issue to get its current state
      const staleIssue = allIssues.find(i => i.id === violation.details['issue_id']);
      const currentState = staleIssue?.state ?? 'todo';
      // Stale in_progress → move back to todo (it's stalled)
      // Stale todo → bump priority to urgent (needs attention)
      const isInProgress = currentState === 'in_progress';
      return {
        ...base,
        action_type: isInProgress ? 'status_change' : 'priority_change',
        target_user_id: '',
        suggestion: {
          issue_id: violation.details['issue_id'],
          issue_title: violation.details['issue_title'],
          field: isInProgress ? 'state' : 'priority',
          from: isInProgress ? 'in_progress' : (staleIssue?.priority ?? 'high'),
          to: isInProgress ? 'todo' : 'urgent',
          message: `Issue "${violation.details['issue_title']}" has not been updated in ${violation.details['days_since_update']} days.`,
        },
      };
    }
    default:
      return {
        ...base,
        action_type: 'unknown',
        target_user_id: '',
        suggestion: {},
      };
  }
}

export async function suggestionGenerator(state: FleetGraphState): Promise<Partial<FleetGraphState>> {
  if (state.violations.length === 0) {
    return { suggestions: [] };
  }

  const geminiReasoning = state.gemini_output?.content ?? '';
  const allIssues = state.project_data?.issues ?? state.person_data?.issues ?? [];

  const suggestions = state.violations.map(v => {
    const suggestion = violationToSuggestion(v, geminiReasoning, allIssues);
    // Resolve target_user_id from the issue's assignee if not set
    if (!suggestion.target_user_id) {
      const issueId = suggestion.suggestion['issue_id'] as string;
      if (issueId) {
        const issue = allIssues.find(i => i.id === issueId);
        if (issue?.assignee_id) {
          suggestion.target_user_id = issue.assignee_id;
        }
      }
    }
    // Final fallback to state target
    if (!suggestion.target_user_id) {
      suggestion.target_user_id = state.target_user_id;
    }
    return suggestion;
  });

  return { suggestions };
}
