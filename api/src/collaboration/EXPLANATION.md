# api/src/collaboration/

Real-time collaborative editing server using Yjs CRDTs over WebSocket.

## Files

- **index.ts** -- Implements the Yjs collaboration server handling document sync, cursor awareness, persistence to PostgreSQL, visibility/access enforcement, rate limiting, and a separate `/events` WebSocket channel for real-time notifications (document changes, comments, etc.).

## Directories

- **__tests__/** -- Tests for collaboration server behavior.
