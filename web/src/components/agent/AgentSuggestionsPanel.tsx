/**
 * AgentSuggestionsPanel — action queue showing pending agent suggestions.
 * Each card has approve/dismiss/snooze buttons.
 */
import { useAgentSuggestions, type AgentSuggestion } from './useAgentSuggestions';
import { AgentBriefing } from './AgentBriefing';

interface AgentSuggestionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChat?: () => void;
}

function SuggestionCard({
  suggestion,
  onApprove,
  onDismiss,
  onSnooze,
}: {
  suggestion: AgentSuggestion;
  onApprove: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
}) {
  const { action_type, suggestion: proposed, severity_score } = suggestion;

  const issueTitle = proposed['issue_title'] as string ?? '';
  const actionLabel = action_type === 'priority_change'
    ? `Change priority: ${proposed['from']} → ${proposed['to']}`
    : action_type === 'status_change'
    ? `Change status: ${proposed['from']} → ${proposed['to']}`
    : action_type;

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{actionLabel}</p>
          {issueTitle && (
            <p className="text-xs text-muted mt-0.5">{issueTitle}</p>
          )}
        </div>
        {severity_score != null && (
          <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-xs text-orange-600 whitespace-nowrap ml-2">
            {severity_score}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="rounded px-2 py-1 text-xs bg-green-600 text-white hover:bg-green-700"
        >
          Approve
        </button>
        <button
          onClick={onDismiss}
          className="rounded px-2 py-1 text-xs bg-border text-muted hover:bg-border/80"
        >
          Dismiss
        </button>
        <button
          onClick={onSnooze}
          className="rounded px-2 py-1 text-xs bg-blue-600/10 text-blue-600 hover:bg-blue-600/20"
        >
          Snooze 24h
        </button>
      </div>
    </div>
  );
}

export function AgentSuggestionsPanel({ isOpen, onClose, onOpenChat }: AgentSuggestionsPanelProps) {
  const { suggestions, approve, dismiss, snooze } = useAgentSuggestions();

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col border-l border-border bg-background shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">FleetGraph Actions</h2>
        <div className="flex gap-1">
          <button
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-border/50 hover:text-foreground"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Suggestions list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Briefings at top */}
        {suggestions
          .filter(s => s.action_type === 'briefing')
          .map(s => (
            <AgentBriefing key={s.id} briefing={s} onDismiss={() => dismiss(s.id)} />
          ))
        }

        {/* Action suggestions */}
        {suggestions.filter(s => s.action_type !== 'briefing').length === 0 &&
         suggestions.filter(s => s.action_type === 'briefing').length === 0 ? (
          <p className="text-sm text-muted text-center mt-8">
            No pending suggestions
          </p>
        ) : (
          suggestions
            .filter(s => s.action_type !== 'briefing')
            .map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onApprove={() => approve(s.id)}
                onDismiss={() => dismiss(s.id)}
                onSnooze={() => snooze(s.id, 24)}
              />
            ))
        )}
      </div>
    </div>
  );
}
