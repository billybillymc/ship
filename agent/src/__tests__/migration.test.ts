import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('039_agent_actions migration', () => {
  const sql = readFileSync(
    join(__dirname, '../../../api/src/db/migrations/039_agent_actions.sql'),
    'utf-8',
  );

  it('creates agent_actions table', () => {
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('agent_actions');
  });

  it('has all required columns', () => {
    const requiredColumns = [
      'id', 'workspace_id', 'target_user_id', 'action_type', 'status',
      'severity_score', 'context', 'suggestion', 'gemini_reasoning',
      'snooze_until', 'resolved_at', 'langsmith_trace_id',
      'created_at', 'updated_at',
    ];
    for (const col of requiredColumns) {
      expect(sql).toContain(col);
    }
  });

  it('defaults status to pending', () => {
    expect(sql).toContain("DEFAULT 'pending'");
  });

  it('creates indexes for user+status and workspace', () => {
    expect(sql).toContain('idx_agent_actions_user_status');
    expect(sql).toContain('idx_agent_actions_workspace');
  });

  it('has foreign keys to workspaces and users', () => {
    expect(sql).toContain('REFERENCES workspaces(id)');
    expect(sql).toContain('REFERENCES users(id)');
  });

  it('uses JSONB for context and suggestion', () => {
    expect(sql).toMatch(/context\s+JSONB/);
    expect(sql).toMatch(/suggestion\s+JSONB/);
  });
});
