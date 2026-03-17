/**
 * Program Fetch node — retrieves all programs and their projects.
 * Used for Director Overview (cross-program portfolio analysis).
 * Catches its own errors per Rule 5.
 */
import type { FleetGraphState, GraphError, Project } from '../state.js';
import type { ShipClient } from '../../lib/ship-client.js';

export function createProgramFetch(shipClient: ShipClient) {
  return async function programFetch(state: FleetGraphState): Promise<Partial<FleetGraphState>> {
    try {
      const programs = await shipClient.getPrograms();

      if (programs.length === 0) {
        return {};
      }

      // Fetch projects for all programs in parallel (Rule 6: fetch nodes are parallel)
      const projectResults = await Promise.allSettled(
        programs.map(p => shipClient.getProgramProjects(p.id))
      );

      const allProjects: Project[] = [];
      for (const result of projectResults) {
        if (result.status === 'fulfilled') {
          allProjects.push(...result.value);
        }
      }

      return {
        program_data: {
          program_id: 'all',
          program_name: 'Portfolio Overview',
          projects: allProjects,
        },
      };
    } catch (error) {
      const graphError: GraphError = {
        node: 'programFetch',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      return { errors: [graphError] };
    }
  };
}
