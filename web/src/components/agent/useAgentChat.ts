/**
 * Hook for managing on-demand agent chat via SSE.
 */
import { useState, useCallback, useRef } from 'react';

export interface InlineSuggestion {
  action_type: string;
  severity_score?: number;
  suggestion: Record<string, unknown>;
  status: 'pending' | 'approved' | 'dismissed';
}

export interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  suggestions?: InlineSuggestion[];
}

export interface ViewContext {
  document_type: string;
  document_id: string;
  title?: string;
}

const AGENT_API_URL = import.meta.env.VITE_AGENT_URL ?? 'http://localhost:3001';

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string, context?: ViewContext) => {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsStreaming(true);

    // Add empty agent message to stream into
    setMessages(prev => [...prev, { role: 'agent', content: '' }]);

    try {
      abortRef.current = new AbortController();

      const response = await fetch(`${AGENT_API_URL}/api/agent/on-demand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, context }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Agent returned ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'token') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'agent') {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + event.content,
                  };
                }
                return updated;
              });
            } else if (event.type === 'violations' && event.violations?.length > 0) {
              const summary = '\n\n---\n**Violations Detected (' + event.count + '):**\n' +
                event.violations.map((v: { type: string; entity_name: string; severity: number }) =>
                  `- [${v.type}] ${v.entity_name} (severity: ${v.severity})`
                ).join('\n');
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'agent') {
                  updated[updated.length - 1] = { ...last, content: last.content + summary };
                }
                return updated;
              });
            } else if (event.type === 'suggestions' && event.suggestions?.length > 0) {
              const inlineSuggestions: InlineSuggestion[] = event.suggestions.map(
                (s: { action_type: string; severity_score?: number; suggestion: Record<string, unknown> }) => ({
                  action_type: s.action_type,
                  severity_score: s.severity_score,
                  suggestion: s.suggestion,
                  status: 'pending' as const,
                })
              );
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'agent') {
                  updated[updated.length - 1] = {
                    ...last,
                    suggestions: [...(last.suggestions ?? []), ...inlineSuggestions],
                  };
                }
                return updated;
              });
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;

      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'agent' && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content: 'Sorry, I encountered an error. Please try again.',
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, []);

  const updateSuggestionStatus = useCallback((msgIndex: number, sugIndex: number, status: 'approved' | 'dismissed') => {
    setMessages(prev => {
      const updated = [...prev];
      const msg = updated[msgIndex];
      if (msg?.suggestions?.[sugIndex]) {
        const newSuggestions = [...msg.suggestions];
        newSuggestions[sugIndex] = { ...newSuggestions[sugIndex]!, status };
        updated[msgIndex] = { ...msg, suggestions: newSuggestions };
      }
      return updated;
    });
  }, []);

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setIsStreaming(false);
  }, []);

  return { messages, sendMessage, isStreaming, clearChat, updateSuggestionStatus };
}
