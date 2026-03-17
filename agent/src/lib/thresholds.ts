/**
 * Threshold configuration and deterministic evaluation — no Gemini, pure math.
 */
import type { ProjectSnapshot, PersonSnapshot, Violation, Issue } from '../graph/state.js';

export interface ThresholdConfig {
  highPriorityPerProject: number;
  mediumPriorityPerProject: number;
  inProgressPerProject: number;
  highPriorityPerPerson: number;
  mediumPriorityPerPerson: number;
  staleDaysHigh: number;
  staleDaysMedium: number;
  staleDaysLow: number;
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  highPriorityPerProject: 7,
  mediumPriorityPerProject: 10,
  inProgressPerProject: 5,
  highPriorityPerPerson: 2,
  mediumPriorityPerPerson: 3,
  staleDaysHigh: 2,
  staleDaysMedium: 5,
  staleDaysLow: 30,
};

// Severity base weights per violation type (from PRESEARCH.md)
const SEVERITY_WEIGHTS: Record<string, number> = {
  priority_overload: 6,
  in_progress_overload: 5,
  person_overload: 7,
  stale_issue: 8,
};

function daysSince(dateStr: string, now: Date = new Date()): number {
  const then = new Date(dateStr);
  return (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24);
}

function countByPriority(issues: Issue[], priority: string): number {
  return issues.filter(i => i.priority === priority && i.state !== 'done').length;
}

function countByState(issues: Issue[], state: string): number {
  return issues.filter(i => i.state === state).length;
}

export function evaluateProjectThresholds(
  projectData: ProjectSnapshot,
  config: ThresholdConfig = DEFAULT_THRESHOLDS,
  now: Date = new Date(),
): Violation[] {
  const violations: Violation[] = [];
  const { project, issues } = projectData;

  // High priority overload
  const highCount = countByPriority(issues, 'high');
  if (highCount > config.highPriorityPerProject) {
    const overBy = highCount - config.highPriorityPerProject;
    violations.push({
      type: 'priority_overload',
      severity: SEVERITY_WEIGHTS['priority_overload']! * overBy,
      entity_type: 'project',
      entity_id: project.id,
      entity_name: project.title,
      details: {
        priority: 'high',
        count: highCount,
        threshold: config.highPriorityPerProject,
        affected_issue_ids: issues
          .filter(i => i.priority === 'high' && i.state !== 'done')
          .map(i => i.id),
      },
    });
  }

  // Medium priority overload
  const mediumCount = countByPriority(issues, 'medium');
  if (mediumCount > config.mediumPriorityPerProject) {
    const overBy = mediumCount - config.mediumPriorityPerProject;
    violations.push({
      type: 'priority_overload',
      severity: SEVERITY_WEIGHTS['priority_overload']! * overBy,
      entity_type: 'project',
      entity_id: project.id,
      entity_name: project.title,
      details: {
        priority: 'medium',
        count: mediumCount,
        threshold: config.mediumPriorityPerProject,
        affected_issue_ids: issues
          .filter(i => i.priority === 'medium' && i.state !== 'done')
          .map(i => i.id),
      },
    });
  }

  // In-progress overload
  const inProgressCount = countByState(issues, 'in_progress');
  if (inProgressCount > config.inProgressPerProject) {
    const overBy = inProgressCount - config.inProgressPerProject;
    violations.push({
      type: 'in_progress_overload',
      severity: SEVERITY_WEIGHTS['in_progress_overload']! * overBy,
      entity_type: 'project',
      entity_id: project.id,
      entity_name: project.title,
      details: {
        count: inProgressCount,
        threshold: config.inProgressPerProject,
        affected_issue_ids: issues
          .filter(i => i.state === 'in_progress')
          .map(i => i.id),
      },
    });
  }

  // Stale issues
  for (const issue of issues) {
    if (issue.state === 'done') continue;

    const days = daysSince(issue.updated_at, now);
    let staleThreshold: number | null = null;

    if (issue.priority === 'high') staleThreshold = config.staleDaysHigh;
    else if (issue.priority === 'medium') staleThreshold = config.staleDaysMedium;
    else if (issue.priority === 'low') staleThreshold = config.staleDaysLow;

    if (staleThreshold !== null && days > staleThreshold) {
      violations.push({
        type: 'stale_issue',
        severity: SEVERITY_WEIGHTS['stale_issue']! * Math.ceil(days - staleThreshold),
        entity_type: 'project',
        entity_id: project.id,
        entity_name: project.title,
        details: {
          issue_id: issue.id,
          issue_title: issue.title,
          priority: issue.priority,
          days_since_update: Math.round(days),
          threshold_days: staleThreshold,
        },
      });
    }
  }

  return violations;
}

export function evaluatePersonThresholds(
  personData: PersonSnapshot,
  config: ThresholdConfig = DEFAULT_THRESHOLDS,
): Violation[] {
  const violations: Violation[] = [];
  const { person_id, person_name, issues } = personData;

  const highCount = countByPriority(issues, 'high');
  if (highCount > config.highPriorityPerPerson) {
    const overBy = highCount - config.highPriorityPerPerson;
    violations.push({
      type: 'person_overload',
      severity: SEVERITY_WEIGHTS['person_overload']! * overBy,
      entity_type: 'person',
      entity_id: person_id,
      entity_name: person_name,
      details: {
        priority: 'high',
        count: highCount,
        threshold: config.highPriorityPerPerson,
        affected_issue_ids: issues
          .filter(i => i.priority === 'high' && i.state !== 'done')
          .map(i => i.id),
      },
    });
  }

  const mediumCount = countByPriority(issues, 'medium');
  if (mediumCount > config.mediumPriorityPerPerson) {
    const overBy = mediumCount - config.mediumPriorityPerPerson;
    violations.push({
      type: 'person_overload',
      severity: SEVERITY_WEIGHTS['person_overload']! * overBy,
      entity_type: 'person',
      entity_id: person_id,
      entity_name: person_name,
      details: {
        priority: 'medium',
        count: mediumCount,
        threshold: config.mediumPriorityPerPerson,
        affected_issue_ids: issues
          .filter(i => i.priority === 'medium' && i.state !== 'done')
          .map(i => i.id),
      },
    });
  }

  return violations;
}

export function evaluateThresholds(
  projectData: ProjectSnapshot | null,
  personData: PersonSnapshot | null,
  config: ThresholdConfig = DEFAULT_THRESHOLDS,
  now: Date = new Date(),
): Violation[] {
  const violations: Violation[] = [];

  if (projectData) {
    violations.push(...evaluateProjectThresholds(projectData, config, now));
  }
  if (personData) {
    violations.push(...evaluatePersonThresholds(personData, config));
  }

  return violations;
}
