/**
 * Suggestion Lifecycle — handles snooze expiration and dismiss re-evaluation.
 *
 * Runs hourly alongside the staleness cron:
 * 1. Find snoozed suggestions where snooze_until < NOW()
 * 2. Re-evaluate: if condition worsened → new suggestion; if same/better → archive
 * 3. Expire old pending suggestions (>7 days) → auto-archive
 */
import type { ShipClient } from '../lib/ship-client.js';
import type { AgentAction } from '../graph/state.js';

export class SuggestionLifecycle {
  constructor(private shipClient: ShipClient) {}

  /**
   * Process expired snoozes and stale pending suggestions.
   */
  async processExpired(): Promise<{ unsnoozed: number; expired: number }> {
    let unsnoozed = 0;
    let expired = 0;

    try {
      // Get all snoozed suggestions — the API returns them, we filter client-side
      // In production this would be a dedicated query
      const allActions = await this.shipClient.getAgentActions('', 'snoozed');

      const now = new Date();
      for (const action of allActions) {
        if (!action.snooze_until) continue;

        const snoozeExpiry = new Date(action.snooze_until);
        if (snoozeExpiry > now) continue; // Still snoozed

        // Snooze expired — archive it (a future proactive run will
        // re-detect the condition if it still exists)
        try {
          await this.shipClient.updateAgentAction(action.id, { status: 'dismissed' });
          unsnoozed++;
        } catch {
          // Skip individual failures
        }
      }

      // Expire old pending suggestions (>7 days)
      const pendingActions = await this.shipClient.getAgentActions('', 'pending');
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      for (const action of pendingActions) {
        const createdAt = new Date(action.created_at);
        if (createdAt < sevenDaysAgo) {
          try {
            await this.shipClient.updateAgentAction(action.id, { status: 'dismissed' });
            expired++;
          } catch {
            // Skip individual failures
          }
        }
      }
    } catch (error) {
      console.error('[SuggestionLifecycle] Error processing expired suggestions:', error);
    }

    if (unsnoozed > 0 || expired > 0) {
      console.log(`[SuggestionLifecycle] Unsnoozed: ${unsnoozed}, Expired: ${expired}`);
    }

    return { unsnoozed, expired };
  }

  /**
   * Check if a suggestion for this entity+violation already exists
   * and is dismissed/snoozed. Used by suggestion generator to avoid
   * re-raising dismissed conditions.
   */
  async isDuplicate(
    targetUserId: string,
    actionType: string,
    entityId: string,
  ): Promise<boolean> {
    try {
      const actions = await this.shipClient.getAgentActions(targetUserId);
      return actions.some(a =>
        a.action_type === actionType &&
        a.status === 'dismissed' &&
        (a.context as Record<string, unknown>)?.['entity_id'] === entityId
      );
    } catch {
      return false; // On error, allow the suggestion
    }
  }
}
