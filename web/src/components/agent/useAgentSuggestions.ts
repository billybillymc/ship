/**
 * Hook for managing agent suggestions (action queue).
 * Polls the Ship API for pending suggestions.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from '../../lib/api';

export interface AgentSuggestion {
  id: string;
  action_type: string;
  status: string;
  severity_score: number | null;
  context: Record<string, unknown>;
  suggestion: Record<string, unknown>;
  gemini_reasoning: string | null;
  created_at: string;
}

export function useAgentSuggestions() {
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiGet('/api/agent/suggestions?status=pending');
      if (res.ok) {
        const body = await res.json();
        setSuggestions(body.data ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch agent suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchSuggestions();
    const interval = setInterval(fetchSuggestions, 30_000);
    return () => clearInterval(interval);
  }, [fetchSuggestions]);

  const approve = useCallback(async (id: string) => {
    try {
      const res = await apiPatch(`/api/agent/suggestions/${id}`, { status: 'approved' });
      if (res.ok) {
        setSuggestions(prev => prev.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('Failed to approve suggestion:', error);
    }
  }, []);

  const dismiss = useCallback(async (id: string) => {
    try {
      const res = await apiPatch(`/api/agent/suggestions/${id}`, { status: 'dismissed' });
      if (res.ok) {
        setSuggestions(prev => prev.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error);
    }
  }, []);

  const snooze = useCallback(async (id: string, hours: number) => {
    const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    try {
      const res = await apiPatch(`/api/agent/suggestions/${id}`, {
        status: 'snoozed',
        snooze_until: snoozeUntil,
      });
      if (res.ok) {
        setSuggestions(prev => prev.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('Failed to snooze suggestion:', error);
    }
  }, []);

  return { suggestions, isLoading, approve, dismiss, snooze, refresh: fetchSuggestions };
}
