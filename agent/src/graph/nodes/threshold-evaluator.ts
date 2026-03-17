/**
 * Threshold Evaluator node — deterministic math, no Gemini.
 * Checks all defined thresholds and outputs a violations list.
 */
import type { FleetGraphState } from '../state.js';
import { evaluateThresholds, DEFAULT_THRESHOLDS } from '../../lib/thresholds.js';

export async function thresholdEvaluator(state: FleetGraphState): Promise<Partial<FleetGraphState>> {
  const violations = evaluateThresholds(
    state.project_data,
    state.person_data,
    DEFAULT_THRESHOLDS,
  );

  return { violations };
}
