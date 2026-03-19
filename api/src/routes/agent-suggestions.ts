/**
 * Agent Suggestions API — CRUD for the agent_actions table.
 * These routes live on the Ship API (not the agent process) because
 * the Ship API owns the database and the frontend calls these directly.
 */
import { Router, Request, Response } from 'express';
import { pool } from '../db/client.js';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { broadcastToUser } from '../collaboration/index.js';

type RouterType = ReturnType<typeof Router>;
const router: RouterType = Router();

// ── Validation schemas ──────────────────────────────────────────────────

const createSuggestionSchema = z.object({
  workspace_id: z.string().uuid(),
  target_user_id: z.string().uuid(),
  action_type: z.string().min(1).max(50),
  severity_score: z.number().nullable().optional(),
  context: z.record(z.unknown()),
  suggestion: z.record(z.unknown()),
  gemini_reasoning: z.string().nullable().optional(),
  langsmith_trace_id: z.string().max(100).nullable().optional(),
});

const updateSuggestionSchema = z.object({
  status: z.enum(['approved', 'dismissed', 'snoozed']),
  snooze_until: z.string().datetime().optional(),
});

// ── POST /api/agent/suggestions — create a new suggestion ───────────────

router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createSuggestionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { message: parsed.error.message } });
      return;
    }

    const { workspace_id, target_user_id, action_type, severity_score, context, suggestion, gemini_reasoning, langsmith_trace_id } = parsed.data;

    const result = await pool.query(
      `INSERT INTO agent_actions (workspace_id, target_user_id, action_type, severity_score, context, suggestion, gemini_reasoning, langsmith_trace_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [workspace_id, target_user_id, action_type, severity_score ?? null, JSON.stringify(context), JSON.stringify(suggestion), gemini_reasoning ?? null, langsmith_trace_id ?? null],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to create agent suggestion:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to create suggestion' } });
  }
});

// ── GET /api/agent/suggestions — list suggestions ───────────────────────

router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query['status'] as string | undefined;
    const userId = req.query['user_id'] as string | undefined;

    const params: (string | undefined)[] = [];
    let paramIndex = 1;

    // Super-admins see all suggestions; regular users see only their own
    // Join user name so frontend can show who the suggestion is for
    let query: string;
    if (req.isSuperAdmin) {
      query = 'SELECT a.*, u.name as target_user_name FROM agent_actions a LEFT JOIN users u ON u.id = a.target_user_id WHERE 1=1';
    } else {
      const targetUserId = userId ?? req.userId;
      query = `SELECT a.*, u.name as target_user_name FROM agent_actions a LEFT JOIN users u ON u.id = a.target_user_id WHERE a.target_user_id = $${paramIndex}`;
      params.push(targetUserId);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ' ORDER BY severity_score DESC NULLS LAST, created_at DESC LIMIT 50';

    const result = await pool.query(query, params);
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Failed to fetch agent suggestions:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch suggestions' } });
  }
});

// ── PATCH /api/agent/suggestions/:id — approve/dismiss/snooze ───────────

router.patch('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const parsed = updateSuggestionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { message: parsed.error.message } });
      return;
    }

    const { status, snooze_until } = parsed.data;

    // Verify the suggestion exists and belongs to this user's workspace
    const existing = await pool.query('SELECT * FROM agent_actions WHERE id = $1', [id]);
    if (!existing.rows[0]) {
      res.status(404).json({ success: false, error: { message: 'Suggestion not found' } });
      return;
    }

    const action = existing.rows[0];

    // Update the suggestion
    const updates: string[] = ['status = $2', 'updated_at = NOW()'];
    const params: (string | null)[] = [id, status];
    let paramIndex = 3;

    if (status === 'approved' || status === 'dismissed') {
      updates.push(`resolved_at = NOW()`);
    }

    if (status === 'snoozed' && snooze_until) {
      updates.push(`snooze_until = $${paramIndex}`);
      params.push(snooze_until);
      paramIndex++;
    }

    const result = await pool.query(
      `UPDATE agent_actions SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    );

    // If approved, execute the suggested mutation
    if (status === 'approved' && action.suggestion) {
      const suggestion = typeof action.suggestion === 'string'
        ? JSON.parse(action.suggestion)
        : action.suggestion;

      if (suggestion.issue_id && suggestion.field) {
        const updateField = suggestion.field === 'state' ? 'state' : suggestion.field;
        await pool.query(
          `UPDATE issues SET ${updateField} = $1, updated_at = NOW() WHERE id = $2`,
          [suggestion.to, suggestion.issue_id],
        );
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update agent suggestion:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update suggestion' } });
  }
});

// ── POST /api/agent/suggestions/notify — push notification via WebSocket ─────

const notifySchema = z.object({
  user_id: z.string().uuid(),
  event_type: z.string().min(1),
  data: z.record(z.unknown()),
});

router.post('/notify', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = notifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { message: parsed.error.message } });
      return;
    }

    const { user_id, event_type, data } = parsed.data;
    broadcastToUser(user_id, event_type, data);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to send agent notification:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to send notification' } });
  }
});

export default router;
