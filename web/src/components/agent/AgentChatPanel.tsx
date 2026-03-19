/**
 * AgentChatPanel — slide-out panel for on-demand FleetGraph chat.
 * Overlays from the right edge, renders messages and streams responses.
 */
import { useState, useRef, useEffect } from 'react';
import { useAgentChat, type ViewContext, type InlineSuggestion } from './useAgentChat';
import { useIssues } from '../../contexts/IssuesContext';

interface AgentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context?: ViewContext;
}

export function AgentChatPanel({ isOpen, onClose, context }: AgentChatPanelProps) {
  const { messages, sendMessage, isStreaming, clearChat, updateSuggestionStatus } = useAgentChat();
  const { updateIssue } = useIssues();

  const handleApprove = async (msgIndex: number, sugIndex: number, suggestion: InlineSuggestion) => {
    const issueId = suggestion.suggestion['issue_id'] as string;
    const field = suggestion.suggestion['field'] as string;
    const to = suggestion.suggestion['to'] as string;
    if (issueId && field && to) {
      try {
        await updateIssue(issueId, { [field]: to } as any);
        updateSuggestionStatus(msgIndex, sugIndex, 'approved');
      } catch (error) {
        console.error('Failed to apply suggestion:', error);
      }
    }
  };

  const handleDismiss = (msgIndex: number, sugIndex: number) => {
    updateSuggestionStatus(msgIndex, sugIndex, 'dismissed');
  };
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    sendMessage(text, context);
  };

  const handleClose = () => {
    // Don't clear messages — keep history when panel is closed
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col border-l border-border bg-background shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">FleetGraph</h2>
          {context?.title && (
            <p className="text-xs text-muted">
              {context.document_type}: {context.title}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="rounded px-2 py-1 text-xs text-muted hover:bg-border/50 hover:text-foreground"
          >
            Clear
          </button>
        )}
        <button
          onClick={handleClose}
          className="rounded p-1 text-muted hover:bg-border/50 hover:text-foreground"
          aria-label="Close chat"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted text-center">
              FleetGraph AI — {context?.title ?? 'your workspace'}
            </p>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted px-1">Ask a question or run a command:</p>
              {[
                { label: 'Run a health check on this project', desc: 'Thresholds + suggestions' },
                { label: 'Give me my morning briefing', desc: 'Portfolio risk overview' },
                { label: 'Check for stale issues', desc: 'Find overdue items' },
                { label: 'Scan all programs for risk', desc: 'Cross-program analysis' },
                { label: 'Balance the workload on this team', desc: 'Reassignment suggestions' },
                { label: 'What are my work patterns?', desc: 'Coach mode' },
                { label: 'Draft a retrospective', desc: 'From completed work' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => { setInput(''); sendMessage(item.label, context); }}
                  className="flex w-full items-start gap-2 rounded-md border border-border/50 px-3 py-2 text-left text-sm hover:bg-border/20 transition-colors"
                >
                  <span className="text-foreground">{item.label}</span>
                  <span className="ml-auto text-xs text-muted whitespace-nowrap">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, msgIdx) => (
          <div key={msgIdx}>
            <div
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-border/30 text-foreground'
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                {msg.role === 'agent' && isStreaming && msgIdx === messages.length - 1 && (
                  <span className="inline-block w-1.5 h-3 bg-foreground/50 animate-pulse ml-0.5" />
                )}
              </div>
            </div>
            {/* Inline suggestion action cards */}
            {msg.suggestions && msg.suggestions.length > 0 && (
              <div className="mt-2 space-y-2 ml-0">
                <p className="text-xs font-medium text-muted">Suggested Actions:</p>
                {msg.suggestions.map((sug, sugIdx) => (
                  <div key={sugIdx} className="rounded-md border border-border p-2.5 text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        {sug.action_type === 'priority_change' ? 'Change priority' :
                         sug.action_type === 'status_change' ? 'Change status' :
                         sug.action_type}
                      </span>
                      {sug.status === 'approved' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-600/10 text-green-600">
                          Applied
                        </span>
                      )}
                      {sug.status === 'dismissed' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-border text-muted">
                          Dismissed
                        </span>
                      )}
                    </div>
                    {sug.suggestion['issue_title'] && (
                      <p className="text-xs text-foreground/80 font-medium">
                        {String(sug.suggestion['issue_title'])}
                      </p>
                    )}
                    <p className="text-xs text-muted">
                      {(() => {
                        const friendly: Record<string, string> = {
                          todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review',
                          done: 'Done', current: 'Current', needs_update: 'Needs Update',
                          high: 'High', medium: 'Medium', low: 'Low', urgent: 'Urgent',
                        };
                        const fmt = (v: unknown) => friendly[String(v)] ?? String(v);
                        return `${sug.suggestion['field']}: ${fmt(sug.suggestion['from'])} → ${fmt(sug.suggestion['to'])}`;
                      })()}
                    </p>
                    {sug.status === 'approved' && (
                      <p className="text-xs text-green-600">
                        {(() => {
                          const friendly: Record<string, string> = {
                            todo: 'To Do', in_progress: 'In Progress', current: 'Current',
                            needs_update: 'Needs Update', high: 'High', medium: 'Medium', low: 'Low',
                          };
                          const fmt = (v: unknown) => friendly[String(v)] ?? String(v);
                          return `Done — "${String(sug.suggestion['issue_title'] || 'issue')}" ${sug.suggestion['field']} changed from "${fmt(sug.suggestion['from'])}" to "${fmt(sug.suggestion['to'])}".`;
                        })()}
                      </p>
                    )}
                    {sug.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(msgIdx, sugIdx, sug)}
                          className="rounded px-2.5 py-1 text-xs font-medium bg-green-600 text-white hover:bg-green-700"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => handleDismiss(msgIdx, sugIdx)}
                          className="rounded px-2.5 py-1 text-xs bg-border text-muted hover:bg-border/80"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask FleetGraph..."
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
