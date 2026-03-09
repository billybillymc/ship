# shared/src/types/

TypeScript interface definitions shared across the monorepo.

## Files

- **index.ts** -- Barrel export re-exporting all type modules.
- **api.ts** -- Shared API response interfaces (`ApiResponse<T>`, `ApiError`).
- **document.ts** -- Core document types: `DocumentVisibility`, `BelongsTo` associations, and `CascadeWarning` for incomplete child handling.
- **user.ts** -- `User` interface with id, email, name, super-admin flag, and timestamps.
- **workspace.ts** -- `Workspace`, `WorkspaceMembership`, and `WorkspaceInvite` interfaces with roles and invite lifecycle.
- **auth.ts** -- Auth type placeholder (auth types are defined locally in API and web packages).
