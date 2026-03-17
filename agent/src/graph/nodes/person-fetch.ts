/**
 * Person Fetch node — retrieves issues assigned to the target user.
 * Catches its own errors per Rule 5.
 */
import type { FleetGraphState, EventPayload, GraphError } from '../state.js';
import type { ShipClient } from '../../lib/ship-client.js';

export function createPersonFetch(shipClient: ShipClient) {
  return async function personFetch(state: FleetGraphState): Promise<Partial<FleetGraphState>> {
    try {
      const assigneeId = state.target_user_id;
      if (!assigneeId) {
        return {};
      }

      const issues = await shipClient.getPersonIssues(assigneeId);

      return {
        person_data: {
          person_id: assigneeId,
          person_name: '', // Enriched later or by user context
          issues,
        },
      };
    } catch (error) {
      const graphError: GraphError = {
        node: 'personFetch',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      return { errors: [graphError] };
    }
  };
}
