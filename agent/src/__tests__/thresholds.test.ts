import { describe, it, expect } from 'vitest';
import {
  evaluateProjectThresholds,
  evaluatePersonThresholds,
  evaluateThresholds,
  DEFAULT_THRESHOLDS,
} from '../lib/thresholds.js';
import type { ProjectSnapshot, PersonSnapshot, Issue } from '../graph/state.js';

// ── Helpers ────────────────────────────────────────────────────────────

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: `issue-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Issue',
    state: 'todo',
    priority: 'medium',
    assignee_id: 'user-1',
    estimate: null,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeProjectSnapshot(issues: Issue[]): ProjectSnapshot {
  return {
    project: { id: 'proj-1', title: 'Test Project', properties: {} },
    issues,
  };
}

function makePersonSnapshot(issues: Issue[]): PersonSnapshot {
  return {
    person_id: 'person-1',
    person_name: 'Alice',
    issues,
  };
}

// ── Project threshold tests ────────────────────────────────────────────

describe('evaluateProjectThresholds', () => {
  it('returns no violations for a healthy project', () => {
    const snapshot = makeProjectSnapshot([
      makeIssue({ priority: 'high' }),
      makeIssue({ priority: 'high' }),
      makeIssue({ priority: 'medium' }),
      makeIssue({ state: 'in_progress' }),
    ]);

    const violations = evaluateProjectThresholds(snapshot);
    expect(violations).toHaveLength(0);
  });

  it('detects high priority overload (>7)', () => {
    const issues = Array.from({ length: 9 }, (_, i) =>
      makeIssue({ id: `hp-${i}`, priority: 'high' })
    );
    const snapshot = makeProjectSnapshot(issues);

    const violations = evaluateProjectThresholds(snapshot);
    const overload = violations.find(v => v.type === 'priority_overload');

    expect(overload).toBeDefined();
    expect(overload!.severity).toBe(6 * 2); // weight 6 × 2 over threshold
    expect(overload!.entity_type).toBe('project');
    expect(overload!.details['count']).toBe(9);
    expect(overload!.details['threshold']).toBe(7);
    expect((overload!.details['affected_issue_ids'] as string[])).toHaveLength(9);
  });

  it('excludes done issues from high priority count', () => {
    const issues = [
      ...Array.from({ length: 7 }, () => makeIssue({ priority: 'high' })),
      makeIssue({ priority: 'high', state: 'done' }),
      makeIssue({ priority: 'high', state: 'done' }),
    ];
    const snapshot = makeProjectSnapshot(issues);

    const violations = evaluateProjectThresholds(snapshot);
    const overload = violations.find(v => v.type === 'priority_overload');
    expect(overload).toBeUndefined(); // 7 active = at threshold, not over
  });

  it('detects medium priority overload (>10)', () => {
    const issues = Array.from({ length: 12 }, () =>
      makeIssue({ priority: 'medium' })
    );
    const snapshot = makeProjectSnapshot(issues);

    const violations = evaluateProjectThresholds(snapshot);
    const overload = violations.find(
      v => v.type === 'priority_overload' && v.details['priority'] === 'medium'
    );

    expect(overload).toBeDefined();
    expect(overload!.details['count']).toBe(12);
    expect(overload!.details['threshold']).toBe(10);
  });

  it('detects in-progress overload (>5)', () => {
    const issues = Array.from({ length: 6 }, () =>
      makeIssue({ state: 'in_progress' })
    );
    const snapshot = makeProjectSnapshot(issues);

    const violations = evaluateProjectThresholds(snapshot);
    const overload = violations.find(v => v.type === 'in_progress_overload');

    expect(overload).toBeDefined();
    expect(overload!.details['count']).toBe(6);
    expect(overload!.details['threshold']).toBe(5);
  });

  it('detects stale high-priority issues (>2 days)', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const issues = [
      makeIssue({ priority: 'high', updated_at: threeDaysAgo.toISOString() }),
    ];
    const snapshot = makeProjectSnapshot(issues);
    const now = new Date();

    const violations = evaluateProjectThresholds(snapshot, DEFAULT_THRESHOLDS, now);
    const stale = violations.find(v => v.type === 'stale_issue');

    expect(stale).toBeDefined();
    expect(stale!.details['priority']).toBe('high');
    expect(stale!.details['threshold_days']).toBe(2);
  });

  it('does not flag recently updated high-priority issues', () => {
    const issues = [
      makeIssue({ priority: 'high', updated_at: new Date().toISOString() }),
    ];
    const snapshot = makeProjectSnapshot(issues);

    const violations = evaluateProjectThresholds(snapshot);
    expect(violations.filter(v => v.type === 'stale_issue')).toHaveLength(0);
  });

  it('does not flag done issues as stale', () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const issues = [
      makeIssue({ priority: 'high', state: 'done', updated_at: tenDaysAgo.toISOString() }),
    ];
    const snapshot = makeProjectSnapshot(issues);

    const violations = evaluateProjectThresholds(snapshot);
    expect(violations).toHaveLength(0);
  });

  it('detects stale medium-priority issues (>5 days)', () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const issues = [
      makeIssue({ priority: 'medium', updated_at: sevenDaysAgo.toISOString() }),
    ];
    const snapshot = makeProjectSnapshot(issues);

    const violations = evaluateProjectThresholds(snapshot);
    const stale = violations.find(v => v.type === 'stale_issue');

    expect(stale).toBeDefined();
    expect(stale!.details['priority']).toBe('medium');
    expect(stale!.details['threshold_days']).toBe(5);
  });

  it('uses custom threshold config', () => {
    const customConfig = { ...DEFAULT_THRESHOLDS, highPriorityPerProject: 3 };
    const issues = Array.from({ length: 4 }, () => makeIssue({ priority: 'high' }));
    const snapshot = makeProjectSnapshot(issues);

    const violations = evaluateProjectThresholds(snapshot, customConfig);
    expect(violations.find(v => v.type === 'priority_overload')).toBeDefined();
  });

  it('calculates correct severity score (weight × over-threshold)', () => {
    // 10 high = 3 over threshold of 7 → severity = 6 * 3 = 18
    const issues = Array.from({ length: 10 }, () => makeIssue({ priority: 'high' }));
    const snapshot = makeProjectSnapshot(issues);

    const violations = evaluateProjectThresholds(snapshot);
    const overload = violations.find(v => v.type === 'priority_overload');
    expect(overload!.severity).toBe(18);
  });
});

// ── Person threshold tests ─────────────────────────────────────────────

describe('evaluatePersonThresholds', () => {
  it('returns no violations for a person under thresholds', () => {
    const snapshot = makePersonSnapshot([
      makeIssue({ priority: 'high' }),
      makeIssue({ priority: 'high' }),
      makeIssue({ priority: 'medium' }),
    ]);

    const violations = evaluatePersonThresholds(snapshot);
    expect(violations).toHaveLength(0);
  });

  it('detects person high-priority overload (>2)', () => {
    const issues = Array.from({ length: 3 }, (_, i) =>
      makeIssue({ id: `ph-${i}`, priority: 'high' })
    );
    const snapshot = makePersonSnapshot(issues);

    const violations = evaluatePersonThresholds(snapshot);
    const overload = violations.find(v => v.type === 'person_overload');

    expect(overload).toBeDefined();
    expect(overload!.entity_type).toBe('person');
    expect(overload!.entity_id).toBe('person-1');
    expect(overload!.details['count']).toBe(3);
    expect(overload!.details['threshold']).toBe(2);
  });

  it('detects person medium-priority overload (>3)', () => {
    const issues = Array.from({ length: 5 }, () =>
      makeIssue({ priority: 'medium' })
    );
    const snapshot = makePersonSnapshot(issues);

    const violations = evaluatePersonThresholds(snapshot);
    const overload = violations.find(
      v => v.type === 'person_overload' && v.details['priority'] === 'medium'
    );

    expect(overload).toBeDefined();
    expect(overload!.details['count']).toBe(5);
    expect(overload!.details['threshold']).toBe(3);
  });

  it('excludes done issues from person counts', () => {
    const issues = [
      makeIssue({ priority: 'high' }),
      makeIssue({ priority: 'high' }),
      makeIssue({ priority: 'high', state: 'done' }),
    ];
    const snapshot = makePersonSnapshot(issues);

    const violations = evaluatePersonThresholds(snapshot);
    expect(violations).toHaveLength(0); // 2 active high = at threshold
  });
});

// ── Combined evaluation ────────────────────────────────────────────────

describe('evaluateThresholds', () => {
  it('combines project and person violations', () => {
    const projectSnapshot = makeProjectSnapshot(
      Array.from({ length: 9 }, () => makeIssue({ priority: 'high' }))
    );
    const personSnapshot = makePersonSnapshot(
      Array.from({ length: 4 }, () => makeIssue({ priority: 'high' }))
    );

    const violations = evaluateThresholds(projectSnapshot, personSnapshot);
    expect(violations.length).toBeGreaterThanOrEqual(2);
    expect(violations.some(v => v.entity_type === 'project')).toBe(true);
    expect(violations.some(v => v.entity_type === 'person')).toBe(true);
  });

  it('handles null project data', () => {
    const personSnapshot = makePersonSnapshot([
      makeIssue({ priority: 'high' }),
      makeIssue({ priority: 'high' }),
      makeIssue({ priority: 'high' }),
    ]);

    const violations = evaluateThresholds(null, personSnapshot);
    expect(violations.length).toBe(1);
    expect(violations[0]!.entity_type).toBe('person');
  });

  it('handles null person data', () => {
    const projectSnapshot = makeProjectSnapshot(
      Array.from({ length: 9 }, () => makeIssue({ priority: 'high' }))
    );

    const violations = evaluateThresholds(projectSnapshot, null);
    expect(violations.length).toBe(1);
    expect(violations[0]!.entity_type).toBe('project');
  });

  it('returns empty for null project and person data', () => {
    const violations = evaluateThresholds(null, null);
    expect(violations).toHaveLength(0);
  });
});
