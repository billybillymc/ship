/**
 * Retro Fetch node — retrieves completed issues, carryover, and velocity
 * for the Retro Autopilot use case.
 * Catches its own errors per Rule 5.
 */
import type { FleetGraphState, GraphError, Issue } from '../state.js';
import type { ShipClient } from '../../lib/ship-client.js';

export function createRetroFetch(shipClient: ShipClient) {
  return async function retroFetch(state: FleetGraphState): Promise<Partial<FleetGraphState>> {
    try {
      // For retro, we need the project's issues split by completed vs carryover.
      // A "completed" issue was moved to done during the week.
      // A "carryover" issue was assigned to the sprint but not done.
      const projectData = state.project_data;
      if (!projectData) return {};

      const issues = projectData.issues;
      const completed = issues.filter(i => i.state === 'done');
      const carryover = issues.filter(i => i.state !== 'done' && i.state !== 'cancelled');

      // Only produce retro data if there are completed issues
      if (completed.length === 0) {
        return {};
      }

      return {
        retro_data: {
          week_id: '', // Would be filled from sprint context
          completed_issues: completed,
          carryover_issues: carryover,
        },
      };
    } catch (error) {
      const graphError: GraphError = {
        node: 'retroFetch',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      return { errors: [graphError] };
    }
  };
}
