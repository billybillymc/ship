/**
 * AgentBriefing — renders the morning briefing from FleetGraph.
 * Shows in the suggestions panel when a briefing-type action exists.
 */
import type { AgentSuggestion } from './useAgentSuggestions';

interface AgentBriefingProps {
  briefing: AgentSuggestion;
  onDismiss: () => void;
}

export function AgentBriefing({ briefing, onDismiss }: AgentBriefingProps) {
  const content = (briefing.suggestion as Record<string, unknown>)['content'] as string
    ?? briefing.gemini_reasoning
    ?? 'No briefing content available.';

  const createdAt = new Date(briefing.created_at);
  const timeStr = createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = createdAt.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div className="rounded-lg border border-accent/20 bg-accent/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
          </svg>
          <h3 className="text-sm font-semibold text-foreground">Morning Briefing</h3>
        </div>
        <span className="text-xs text-muted">{dateStr} {timeStr}</span>
      </div>
      <pre className="whitespace-pre-wrap text-sm text-foreground/80 font-sans leading-relaxed">
        {content}
      </pre>
      <button
        onClick={onDismiss}
        className="text-xs text-muted hover:text-foreground"
      >
        Dismiss
      </button>
    </div>
  );
}
