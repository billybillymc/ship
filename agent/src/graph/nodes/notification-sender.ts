/**
 * Notification Sender node — persists suggestions to the action queue
 * and sends notifications. For MVP, just persists (no WebSocket push).
 */
import type { FleetGraphState, Notification, GraphError } from '../state.js';
import type { ShipClient } from '../../lib/ship-client.js';

export function createNotificationSender(shipClient: ShipClient, workspaceId: string) {
  return async function notificationSender(state: FleetGraphState): Promise<Partial<FleetGraphState>> {
    const notifications: Notification[] = [];

    try {
      // Persist each suggestion to the agent_actions table
      for (const suggestion of state.suggestions) {
        // Skip persistence if required IDs are missing
        if (!workspaceId || !suggestion.target_user_id) {
          console.warn(`Skipping suggestion persistence: missing workspace_id or target_user_id`);
          continue;
        }
        try {
          await shipClient.createAgentAction({
            workspace_id: workspaceId,
            target_user_id: suggestion.target_user_id,
            action_type: suggestion.action_type,
            severity_score: suggestion.severity_score,
            context: suggestion.context,
            suggestion: suggestion.suggestion,
            gemini_reasoning: suggestion.gemini_reasoning,
            langsmith_trace_id: state.run_id || null,
          });
        } catch (error) {
          // Log but don't fail the whole node for one suggestion
          console.error(`Failed to persist suggestion: ${error}`);
        }
      }

      // Build notification for the target user
      if (state.gemini_output) {
        notifications.push({
          user_id: state.target_user_id,
          message: state.gemini_output.content,
        });

        // Push real-time notification via WebSocket
        if (state.target_user_id) {
          try {
            await shipClient.notifyUser(state.target_user_id, 'agent:suggestion', {
              suggestion_count: state.suggestions.length,
              mode: state.gemini_output.mode,
              preview: state.gemini_output.content.slice(0, 200),
            });
          } catch {
            // WebSocket push is best-effort — frontend falls back to polling
          }
        }
      }
    } catch (error) {
      const graphError: GraphError = {
        node: 'notificationSender',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      return { errors: [graphError], notifications };
    }

    return { notifications };
  };
}
