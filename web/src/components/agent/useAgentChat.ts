/**
 * Hook for managing on-demand agent chat via SSE.
 */
import { useState, useCallback, useRef } from 'react';

export interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
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

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setIsStreaming(false);
  }, []);

  return { messages, sendMessage, isStreaming, clearChat };
}
