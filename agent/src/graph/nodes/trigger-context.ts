/**
 * Trigger Context node — determines what kicked off this run and
 * populates trigger metadata in state.
 */
import type { FleetGraphState, OnDemandPayload, EventPayload } from '../state.js';

export async function triggerContext(state: FleetGraphState): Promise<Partial<FleetGraphState>> {
  const payload = state.trigger_payload;

  if (state.trigger_type === 'on_demand' && payload) {
    const odPayload = payload as OnDemandPayload;
    return {
      user_question: odPayload.user_question,
      current_view_context: odPayload.view_context,
    };
  }

  if (state.trigger_type === 'event' && payload) {
    const evPayload = payload as EventPayload;
    // Event trigger — project_id and assignee_ids are used by fetch nodes
    return {
      target_user_id: evPayload.assignee_ids[0] ?? state.target_user_id,
    };
  }

  // Scheduled — no additional context to extract
  return {};
}
