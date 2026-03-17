/**
 * Project Fetch node — retrieves project + issues from Ship API.
 * Catches its own errors per Rule 5: nodes never throw uncaught.
 */
import type { FleetGraphState, EventPayload, OnDemandPayload, GraphError } from '../state.js';
import type { ShipClient } from '../../lib/ship-client.js';

export function createProjectFetch(shipClient: ShipClient) {
  return async function projectFetch(state: FleetGraphState): Promise<Partial<FleetGraphState>> {
    try {
      let projectId: string | undefined;

      if (state.trigger_type === 'event') {
        projectId = (state.trigger_payload as EventPayload)?.project_id;
      } else if (state.trigger_type === 'on_demand') {
        const ctx = (state.trigger_payload as OnDemandPayload)?.view_context;
        if (ctx?.document_type === 'project') {
          projectId = ctx.document_id;
        }
      }

      if (!projectId) {
        return {};
      }

      const [project, issues] = await Promise.all([
        shipClient.getProject(projectId),
        shipClient.getProjectIssues(projectId),
      ]);

      return {
        project_data: { project, issues },
      };
    } catch (error) {
      const graphError: GraphError = {
        node: 'projectFetch',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      return { errors: [graphError] };
    }
  };
}
