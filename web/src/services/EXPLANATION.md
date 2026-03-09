# web/src/services/

Client-side service modules.

## Files

- **upload.ts** -- File upload service handling multipart form data submission to the API with progress tracking and CDN URL resolution.
- **uploadTracker.ts** -- Global upload state tracker using `useSyncExternalStore` pattern, tracking active uploads and providing subscription for UI components.
