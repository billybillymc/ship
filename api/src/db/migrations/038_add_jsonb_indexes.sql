-- Add functional indexes on frequently-queried JSONB properties
-- These support the dashboard routes and other property-based lookups

-- Composite index on (workspace_id, document_type) - used in nearly every query
CREATE INDEX IF NOT EXISTS idx_documents_workspace_type
  ON documents (workspace_id, document_type);

-- Assignee ID - used by my-work issues query
CREATE INDEX IF NOT EXISTS idx_documents_assignee_id
  ON documents (workspace_id, ((properties->>'assignee_id')::uuid))
  WHERE properties->>'assignee_id' IS NOT NULL;

-- Owner ID - used by my-work projects/sprints queries
CREATE INDEX IF NOT EXISTS idx_documents_owner_id
  ON documents (workspace_id, ((properties->>'owner_id')::uuid))
  WHERE properties->>'owner_id' IS NOT NULL;

-- Sprint number - used by sprint filtering in my-work, my-focus, my-week
CREATE INDEX IF NOT EXISTS idx_documents_sprint_number
  ON documents (workspace_id, ((properties->>'sprint_number')::int))
  WHERE properties->>'sprint_number' IS NOT NULL;

-- State - used for filtering out done/cancelled issues
CREATE INDEX IF NOT EXISTS idx_documents_state
  ON documents (workspace_id, (properties->>'state'))
  WHERE properties->>'state' IS NOT NULL;

-- User ID on person documents - used by my-focus/my-week person lookup
CREATE INDEX IF NOT EXISTS idx_documents_user_id
  ON documents (workspace_id, (properties->>'user_id'))
  WHERE document_type = 'person' AND properties->>'user_id' IS NOT NULL;

-- Person ID - used by weekly_plan/weekly_retro lookups
CREATE INDEX IF NOT EXISTS idx_documents_person_id
  ON documents (workspace_id, (properties->>'person_id'))
  WHERE properties->>'person_id' IS NOT NULL;

-- Project ID on sprint documents - used by my-focus/my-week allocation queries
CREATE INDEX IF NOT EXISTS idx_documents_project_id
  ON documents (workspace_id, ((properties->>'project_id')::uuid))
  WHERE properties->>'project_id' IS NOT NULL;

-- Author ID on standup documents - used by my-week standup query
CREATE INDEX IF NOT EXISTS idx_documents_author_id
  ON documents (workspace_id, (properties->>'author_id'))
  WHERE document_type = 'standup' AND properties->>'author_id' IS NOT NULL;

-- Week number for weekly plans/retros
CREATE INDEX IF NOT EXISTS idx_documents_week_number
  ON documents (workspace_id, ((properties->>'week_number')::int))
  WHERE properties->>'week_number' IS NOT NULL;
