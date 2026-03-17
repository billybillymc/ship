/**
 * User Context node — resolves the target user and their role.
 * For MVP, role defaults to 'engineer' since role detection from
 * person documents comes in the seed data step.
 */
import type { FleetGraphState } from '../state.js';

export async function userContext(state: FleetGraphState): Promise<Partial<FleetGraphState>> {
  // The target user is already set by trigger-context or the initial payload.
  // This node validates and enriches it. For MVP, pass through.
  return {
    target_user_id: state.target_user_id,
    user_role: state.user_role ?? 'engineer',
  };
}
