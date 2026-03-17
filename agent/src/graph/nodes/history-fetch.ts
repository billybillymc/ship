/**
 * History Fetch node — retrieves past agent_actions and issue history
 * for the Coach use case (pattern detection over time).
 * Catches its own errors per Rule 5.
 */
import type { FleetGraphState, GraphError } from '../state.js';
import type { ShipClient } from '../../lib/ship-client.js';

export function createHistoryFetch(shipClient: ShipClient) {
  return async function historyFetch(state: FleetGraphState): Promise<Partial<FleetGraphState>> {
    try {
      const userId = state.target_user_id;
      if (!userId) return {};

      const actions = await shipClient.getAgentActions(userId);

      return {
        history_data: { actions },
      };
    } catch (error) {
      const graphError: GraphError = {
        node: 'historyFetch',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      return { errors: [graphError] };
    }
  };
}
