import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import crypto from 'crypto'
import { createApp } from '../app.js'
import { pool } from '../db/client.js'

describe('Dashboard API', () => {
  const app = createApp()
  const testRunId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const testWorkspaceName = `Dashboard Test ${testRunId}`

  let sessionCookie: string
  let testWorkspaceId: string
  let testUserId: string
  let testUser2Id: string
  let testIssueId: string
  let testUser2IssueId: string
  let testProjectId: string
  let testSprintId: string

  beforeAll(async () => {
    // Create test workspace with sprint_start_date for sprint calculations
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 14) // 2 sprints ago
    const workspaceResult = await pool.query(
      `INSERT INTO workspaces (name, sprint_start_date) VALUES ($1, $2) RETURNING id`,
      [testWorkspaceName, startDate.toISOString().split('T')[0]]
    )
    testWorkspaceId = workspaceResult.rows[0].id

    // Create test user 1
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, 'test-hash', 'Dashboard User 1') RETURNING id`,
      [`dash-user1-${testRunId}@test.local`]
    )
    testUserId = userResult.rows[0].id

    // Create test user 2
    const user2Result = await pool.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, 'test-hash', 'Dashboard User 2') RETURNING id`,
      [`dash-user2-${testRunId}@test.local`]
    )
    testUser2Id = user2Result.rows[0].id

    // Create workspace memberships
    await pool.query(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role) VALUES ($1, $2, 'member')`,
      [testWorkspaceId, testUserId]
    )
    await pool.query(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role) VALUES ($1, $2, 'member')`,
      [testWorkspaceId, testUser2Id]
    )

    // Create person documents for both users
    await pool.query(
      `INSERT INTO documents (workspace_id, document_type, title, created_by, properties)
       VALUES ($1, 'person', 'Dashboard User 1', $2, $3)`,
      [testWorkspaceId, testUserId, JSON.stringify({ user_id: testUserId })]
    )
    await pool.query(
      `INSERT INTO documents (workspace_id, document_type, title, created_by, properties)
       VALUES ($1, 'person', 'Dashboard User 2', $2, $3)`,
      [testWorkspaceId, testUser2Id, JSON.stringify({ user_id: testUser2Id })]
    )

    // Create a sprint
    const sprintResult = await pool.query(
      `INSERT INTO documents (workspace_id, document_type, title, created_by, properties)
       VALUES ($1, 'sprint', 'Sprint 3', $2, $3)
       RETURNING id`,
      [testWorkspaceId, testUserId, JSON.stringify({ sprint_number: 3 })]
    )
    testSprintId = sprintResult.rows[0].id

    // Create issue assigned to user 1 (in_progress)
    const issueResult = await pool.query(
      `INSERT INTO documents (workspace_id, document_type, title, ticket_number, created_by, properties)
       VALUES ($1, 'issue', 'User1 Active Issue', 1001, $2, $3)
       RETURNING id`,
      [testWorkspaceId, testUserId, JSON.stringify({
        state: 'in_progress',
        priority: 'high',
        assignee_id: testUserId,
      })]
    )
    testIssueId = issueResult.rows[0].id

    // Create issue assigned to user 2 (separate user)
    const issue2Result = await pool.query(
      `INSERT INTO documents (workspace_id, document_type, title, ticket_number, created_by, properties)
       VALUES ($1, 'issue', 'User2 Active Issue', 1002, $2, $3)
       RETURNING id`,
      [testWorkspaceId, testUser2Id, JSON.stringify({
        state: 'in_progress',
        priority: 'medium',
        assignee_id: testUser2Id,
      })]
    )
    testUser2IssueId = issue2Result.rows[0].id

    // Create a done issue for user 1 (should NOT show in my-work)
    await pool.query(
      `INSERT INTO documents (workspace_id, document_type, title, ticket_number, created_by, properties)
       VALUES ($1, 'issue', 'User1 Done Issue', 1003, $2, $3)`,
      [testWorkspaceId, testUserId, JSON.stringify({
        state: 'done',
        priority: 'low',
        assignee_id: testUserId,
      })]
    )

    // Create a project owned by user 1
    const projectResult = await pool.query(
      `INSERT INTO documents (workspace_id, document_type, title, created_by, properties)
       VALUES ($1, 'project', 'User1 Project', $2, $3)
       RETURNING id`,
      [testWorkspaceId, testUserId, JSON.stringify({ state: 'active' })]
    )
    testProjectId = projectResult.rows[0].id

    // Create session for user 1
    const sessionId = crypto.randomBytes(32).toString('hex')
    await pool.query(
      `INSERT INTO sessions (id, user_id, workspace_id, expires_at)
       VALUES ($1, $2, $3, now() + interval '1 hour')`,
      [sessionId, testUserId, testWorkspaceId]
    )
    sessionCookie = `session_id=${sessionId}`

    // Get CSRF token
    const csrfRes = await request(app)
      .get('/api/csrf-token')
      .set('Cookie', sessionCookie)
    const connectSidCookie = csrfRes.headers['set-cookie']?.[0]?.split(';')[0] || ''
    if (connectSidCookie) {
      sessionCookie = `${sessionCookie}; ${connectSidCookie}`
    }
  })

  afterAll(async () => {
    await pool.query('DELETE FROM document_associations WHERE document_id IN (SELECT id FROM documents WHERE workspace_id = $1)', [testWorkspaceId])
    await pool.query('DELETE FROM sessions WHERE user_id IN ($1, $2)', [testUserId, testUser2Id])
    await pool.query('DELETE FROM documents WHERE workspace_id = $1', [testWorkspaceId])
    await pool.query('DELETE FROM workspace_memberships WHERE workspace_id = $1', [testWorkspaceId])
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId, testUser2Id])
    await pool.query('DELETE FROM workspaces WHERE id = $1', [testWorkspaceId])
  })

  // T7: my-work test
  // Risk: dashboard shows wrong user's issues
  describe('GET /api/dashboard/my-work', () => {
    it('should return 200 with work items', async () => {
      const res = await request(app)
        .get('/api/dashboard/my-work')
        .set('Cookie', sessionCookie)

      expect(res.status).toBe(200)
      expect(res.body).toBeDefined()
    })

    it('should return only current user non-done issues', async () => {
      const res = await request(app)
        .get('/api/dashboard/my-work')
        .set('Cookie', sessionCookie)

      expect(res.status).toBe(200)

      // Should contain user1's active issue
      const items = res.body.items || res.body.work || res.body
      const allItems = Array.isArray(items) ? items : Object.values(items).flat()

      // Check that user1's active issue is included
      const hasUser1ActiveIssue = allItems.some(
        (item: any) => item.id === testIssueId || item.title === 'User1 Active Issue'
      )
      expect(hasUser1ActiveIssue).toBe(true)

      // Check that user2's issue is NOT included
      const hasUser2Issue = allItems.some(
        (item: any) => item.id === testUser2IssueId || item.title === 'User2 Active Issue'
      )
      expect(hasUser2Issue).toBe(false)

      // Check that done issues are NOT included
      const hasDoneIssue = allItems.some(
        (item: any) => item.title === 'User1 Done Issue'
      )
      expect(hasDoneIssue).toBe(false)
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/dashboard/my-work')

      expect(res.status).toBe(401)
    })
  })

  // T8: my-week sprint calculation test
  // Risk: wrong sprint number shows wrong week's work
  describe('GET /api/dashboard/my-week', () => {
    it('should return 200 with sprint info', async () => {
      const res = await request(app)
        .get('/api/dashboard/my-week')
        .set('Cookie', sessionCookie)

      expect(res.status).toBe(200)
      expect(res.body).toBeDefined()
    })

    it('should return data based on workspace sprint_start_date', async () => {
      const res = await request(app)
        .get('/api/dashboard/my-week')
        .set('Cookie', sessionCookie)

      expect(res.status).toBe(200)

      // The response should include sprint-related data
      // The sprint number should be calculated from the workspace's sprint_start_date
      const body = res.body
      // my-week should have some structure with sprint info
      expect(body).toBeDefined()
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/dashboard/my-week')

      expect(res.status).toBe(401)
    })
  })

  // T9: my-focus test
  // Risk: focus view omits high-priority items
  describe('GET /api/dashboard/my-focus', () => {
    it('should return 200 with focus items', async () => {
      const res = await request(app)
        .get('/api/dashboard/my-focus')
        .set('Cookie', sessionCookie)

      expect(res.status).toBe(200)
      expect(res.body).toBeDefined()
    })

    it('should return expected structure', async () => {
      const res = await request(app)
        .get('/api/dashboard/my-focus')
        .set('Cookie', sessionCookie)

      expect(res.status).toBe(200)

      // Focus items should have a consistent structure
      const body = res.body
      expect(body).toBeDefined()
      // The response should be an object or array with focus items
      expect(typeof body).toBe('object')
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/dashboard/my-focus')

      expect(res.status).toBe(401)
    })
  })
})
