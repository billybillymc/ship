# api/src/db/migrations/

Numbered SQL migration files applied sequentially by `migrate.ts`. Each runs in a transaction with automatic rollback on failure. The `schema_migrations` table tracks which have been applied.

## Files (in order)

- **001_properties_jsonb.sql** -- Adds JSONB properties column to documents.
- **002_person_membership_decoupling.sql** -- Decouples person documents from workspace memberships.
- **003_document_history.sql** -- Adds document version history tracking.
- **004_fix_person_user_id_backfill.sql** -- Backfills user_id on person documents.
- **005_create_missing_person_documents.sql** -- Creates person documents for users that lack them.
- **006_document_visibility.sql** -- Adds visibility field (private/workspace) to documents.
- **007_archived_and_deleted_at.sql** -- Adds archived and deleted_at soft-delete columns.
- **007b_remove_prefix_add_emoji.sql** -- Removes document prefix, adds emoji column.
- **008_consolidate_feedback.sql** -- Consolidates feedback into the document model.
- **009_audit_logs_nullable_actor.sql** -- Makes audit log actor nullable for system actions.
- **010_oauth_state.sql** -- Adds OAuth state table for CSRF protection.
- **011_piv_invite_support.sql** -- Adds PIV smartcard invite support fields.
- **012_require_invite_email.sql** -- Makes email required on invites.
- **013_fix_duplicate_users.sql** -- Deduplicates users with same email.
- **014_api_tokens.sql** -- Adds API tokens table with hashed storage.
- **014b_backfill_missing_person_documents.sql** -- Second pass backfilling person documents.
- **015_add_last_auth_provider.sql** -- Tracks which auth provider a user last used.
- **015b_sprint_iterations.sql** -- Adds iteration tracking to sprints.
- **016_document_history_automated_by.sql** -- Tracks automated vs. manual document changes.
- **017_standup_sprint_review_types.sql** -- Adds standup and sprint review document types.
- **018_archive_orphaned_pending_persons.sql** -- Archives orphaned pending person documents.
- **018b_document_conversion.sql** -- Adds document type conversion tracking.
- **019_migrate_ice_333_to_null.sql** -- Converts default ICE 3/3/3 scores to null.
- **020_document_associations.sql** -- Creates the `document_associations` junction table.
- **020b_sprint_assignee_ids.sql** -- Adds assignee IDs array to sprints.
- **021_migrate_associations.sql** -- Migrates legacy FK associations to the junction table.
- **022_sprint_project_associations.sql** -- Adds sprint-project associations.
- **023_document_snapshots.sql** -- Adds document content snapshots.
- **024_renumber_collision_migrations.sql** -- Fixes migration numbering collisions.
- **025_prevent_circular_parent.sql** -- Adds database constraint to prevent circular parent references.
- **026_issue_iterations.sql** -- Adds iteration tracking to issues.
- **027_drop_legacy_association_columns.sql** -- Drops legacy `sprint_id` FK columns after migration to junction table.
- **028_backfill_program_associations.sql** -- Backfills program associations into junction table.
- **029_drop_program_id_column.sql** -- Drops legacy `program_id` FK column.
- **030_deprecate_goal_to_hypothesis.sql** -- Renames "goal" to "hypothesis" terminology.
- **031_cleanup_accountability_issues.sql** -- Cleans up accountability-related data issues.
- **032_rename_hypothesis_to_plan.sql** -- Renames "hypothesis" to "plan" terminology.
- **033_sprint_to_week_rename.sql** -- Renames sprint terminology to "week".
- **034_backfill_past_weekly_docs_submitted.sql** -- Backfills submission status on past weekly documents.
- **035_add_comments.sql** -- Adds comments table for document-scoped threaded comments.
