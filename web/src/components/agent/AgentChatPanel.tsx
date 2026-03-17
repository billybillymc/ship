/**
 * AgentChatPanel — slide-out panel for on-demand FleetGraph chat.
 * Overlays from the right edge, renders messages and streams responses.
 */
import { useState, useRef, useEffect } from 'react';
import { useAgentChat, type ViewContext } from './useAgentChat';

interface AgentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context?: ViewContext;
}

export function AgentChatPanel({ isOpen, onClose, context }: AgentChatPanelProps) {
  const { messages, sendMessage, isStreaming, clearChat } = useAgentChat();
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
    clearChat();
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted text-center mt-8">
            Ask FleetGraph about {context?.title ?? 'your workspace'}
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
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
              {msg.role === 'agent' && isStreaming && i === messages.length - 1 && (
                <span className="inline-block w-1.5 h-3 bg-foreground/50 animate-pulse ml-0.5" />
              )}
            </div>
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
