/**
 * Suggestion Generator node — maps violations to concrete actions deterministically.
 * Per Rule 7: suggestions come from violations, not from Gemini text.
 * Gemini provides the gemini_reasoning explanation, not the action.
 */
import type { FleetGraphState, PendingSuggestion, Violation } from '../state.js';

function violationToSuggestion(violation: Violation, geminiReasoning: string): PendingSuggestion {
  const base = {
    context: violation.details,
    gemini_reasoning: geminiReasoning,
    severity_score: violation.severity,
  };

  switch (violation.type) {
    case 'priority_overload': {
      // Suggest demoting the lowest-severity high-priority issue
      const issueIds = (violation.details['affected_issue_ids'] as string[]) ?? [];
      const lastIssue = issueIds[issueIds.length - 1];
      return {
        ...base,
        action_type: 'priority_change',
        target_user_id: '', // Filled in below from state
        suggestion: {
          issue_id: lastIssue,
          field: 'priority',
          from: violation.details['priority'] ?? 'high',
          to: violation.details['priority'] === 'high' ? 'medium' : 'low',
        },
      };
    }
    case 'in_progress_overload': {
      const issueIds = (violation.details['affected_issue_ids'] as string[]) ?? [];
      const lastIssue = issueIds[issueIds.length - 1];
      return {
        ...base,
        action_type: 'status_change',
        target_user_id: '',
        suggestion: {
          issue_id: lastIssue,
          field: 'state',
          from: 'in_progress',
          to: 'todo',
        },
      };
    }
    case 'person_overload': {
      const issueIds = (violation.details['affected_issue_ids'] as string[]) ?? [];
      const lastIssue = issueIds[issueIds.length - 1];
      return {
        ...base,
        action_type: 'priority_change',
        target_user_id: violation.entity_id,
        suggestion: {
          issue_id: lastIssue,
          field: 'priority',
          from: violation.details['priority'] ?? 'high',
          to: 'medium',
        },
      };
    }
    case 'stale_issue': {
      return {
        ...base,
        action_type: 'status_change',
        target_user_id: '',
        suggestion: {
          issue_id: violation.details['issue_id'],
          field: 'state',
          from: 'current',
          to: 'needs_update',
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
  const suggestions = state.violations.map(v => {
    const suggestion = violationToSuggestion(v, geminiReasoning);
    // Fill in target_user_id from state if not set by violation
    if (!suggestion.target_user_id) {
      suggestion.target_user_id = state.target_user_id;
    }
    return suggestion;
  });

  return { suggestions };
}
