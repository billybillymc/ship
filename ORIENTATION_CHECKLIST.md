Codebase Orientation Checklist 
Complete this before auditing. Save your notes as a reference document. The goal is to build a mental 
model of the entire system before measuring anything. 
Phase 1: First Contact 
1. Repository Overview 

[ ] Clone the repo and get it running locally. Document every step, including anything that was not in the README. 
- I needed to install pnpm for Windows on my machine to get started. I also needed to update the dev script so that it would be compatible with Powershell to get it working on my local. After that I needed to run pnpm build:shared manually. These are acceptable changes because I will only be running the app locally in order to recommend changes. Beyond those steps, starting the local dockerized app was simple. Start-up is well-documented in README.md. Possible improvement to review later: add a separate set of options and instructions for running dev directly on Windows without having to use WSL. I am going to revert to the WSL version however, as there are multiple other changes needed in order to get the e2e tests to run
- I additionally ran gemini-cli to create EXPLANATION.md files summarizing file contents' functionalities in every dir.

[ ] Read every file in the docs/ folder. Summarize the key architectural decisions in your own words. 
- I told gemini-cli to read these first, and then I quickly verified. The key arch decisions are:
* Programs are long-running initatives, projects are short-term tasks that get scored, weeks (with a planning and retrospective cycle) are tracked for accountability milestones, and issues are the fundamental units of work. All projects are either passed or failed.
* Verified deliverables are clearly explained, with a 5-level performance rating scale. The scientific method applied to all work, to maximize learning: hypothesis (plan), experiment (week), conclusion (retrospective).
* A specific workflow is outlined, including baselines for UX evaluation, current bugs, and planned improvements.
* Emphasis on accountability. Action items get pushed on log-in, there are status banners that persist, managers have an accountability grid, and there are RACI role assignments. The "why" gets explained too: clarity of ownership, asynchronous standups, public commitments.
* The technical architecture is explained. Stack is Node/Express, React/Vite, and Postgres. Caching happens on two-layers with IndexedDB, and real-time collab happens via TipTap and Yjs. Everything is a document, stored in a single table with a JSONB column. Documents have associations instead of direct columns, with four main UI patterns: SelectableList, Tree, Kanban, CardGrid. Also available are entity hierarchy visibility, GitHub-like activity charts, and auto-linking for issue references.
* ship-claude-cli-integration explains how to use Ship with Claude Code. Track story execution, failing verifications, real-time telemetry for AI-assisted dev.
* The PIV card authentication is done via SDK and handles Dynamic Client Registration and AWS Secrets Manager, for storing creds.
* Also includes are docs comparing Ship to Notion (likely used for parity during cloning the app originally) and setting up the shadow env for dev/testing. 

[ ] Read the shared/ package. What types are defined? How are they used across the frontend and backend? 
Types are defined in shared/ for: api, document, user, workspace. These are used for enforcing:
* api -> responses and errors
* document -> the shape and properties of objects like visibility, "belongs to", type (wiki, issue, program, etc.)
* user -> properties every user's profile has, plus distinction between admin and not
* workspace -> who can see it, what the details are, etc.
The api types are used for handling inside endpoint functions. The other types are used inside frontend components to ensure they are working and integrated together as intended.

auth seems to be set but unused but still loaded in through the index in shared/.

[ ] Create a diagram of how the web/, api/, and shared/ packages relate to each other. 

graph TB
        %% Packages
        WEB["@ship/web<br/>(React Frontend)"]:::webStyle
        API["@ship/api<br/>(Express Backend)"]:::apiStyle
        SHARED["@ship/shared<br/>(Shared Types & Utils)"]:::sharedStyle

        %% Shared Content (Sub-node for clarity)
        SHARED_DEETS["<b>Contains:</b><br/>• Document Models<br/>• Workspace/User Types<br/>• API Error Codes<br/>• Shared Constants<br/>• ICE Score Logic"]:::detailStyle

        %% Internal Dependencies
        WEB -- "Imports" --> SHARED
        API -- "Imports" --> SHARED
        SHARED -.-> SHARED_DEETS

    %% External Systems
    DB[(PostgreSQL)]:::dbStyle

    %% Runtime Interactions
    WEB <== "HTTP / WebSockets" ==> API
    API <== "Read/Write" ==> DB

2. Data Model 

[ ] Find the database schema (migrations or seed files). Map out the tables and their relationships. 

Schema contained inside api/src/db/schema.sql

Schema's evolution inside api/src/db/migrations/

  * Workspaces (workspaces)
  The top-level organizational container.
   - Fields: id, name, sprint_start_date (baseline for derived 7-day windows).

  * Users & Auth (users, sessions, workspace_memberships)
   - users: Global identity store. Users can belong to multiple workspaces. Supports PIV (x509_subject_dn) and password authentication.
   - workspace_memberships: Links users to workspaces with roles (admin, member).
   - sessions: Tracks active sessions with 15-minute inactivity timeouts.

  * The Unified Document Table (documents)
  Almost everything in the application (wikis, issues, programs, projects, weeks/sprints, people) is a document.
   - document_type: Enum ('wiki', 'issue', 'program', 'project', 'sprint', 'person', 'weekly_plan', etc.).
   - parent_id: Self-referencing FK for document hierarchy (e.g., nested wiki pages, plan/retro under a week).
   - properties: JSONB column storing type-specific metadata (e.g., issue state/priority, program prefix, person capacity).
   - Content: content (TipTap JSON) and yjs_state (binary CRDT data for real-time collaboration).
   - Ticket Numbers: ticket_number is an auto-incrementing integer per workspace, used with program prefixes (e.g., AUTH-42).

  * Document Associations (document_associations)
  A many-to-many junction table that replaces legacy direct-link columns. This is the source of truth for organizational relationships.
   - document_id: The source document.
   - related_id: The target document.
   - relationship_type: Enum ('program', 'project', 'sprint', 'parent').
   - Common Patterns:
       - Issue → Program: All issues belong to a program.
       - Issue → Project: Optional link to a time-bounded deliverable.
       - Issue $\rightarrow$ Week (Sprint): Link to the specific time window where work is scheduled.

  Support and Audit Tables

   - comments: Threaded, inline document comments. Links to documents.id, users.id, and parent_id (self-referencing for threading).
   - audit_logs: Compliance-grade logs for all system actions. Links to workspaces, users, and specific resource IDs.
   - sprint_iterations & issue_iterations: Tracks progress for Claude Code /work sessions, including iteration attempts and verification failures.
   - document_links: Tracks @mentions and explicit links between documents to power the backlinks feature.
   - files: Metadata for S3-stored attachments. Links to the workspace and the uploader.
   - api_tokens: Hashed tokens for CLI/external tool access (e.g., Claude Code CLI).

  Relationship Summary
   - Workspace is the root container.
   - Users gain access via Memberships.
   - Documents are categorized by document_type and organized via parent_id (strict hierarchy) or document_associations (flexible organizational links).
   - Audit/Activity tables (audit_logs, document_history, iterations) provide an immutable trail of work progress and compliance.

[ ] Understand the unified document model: how does one table serve docs, issues, projects, and sprints? 

One documents table stores everything — wiki pages, issues, projects, sprints, programs, people. The difference between content types is properties, not structure. This follows Notion's paradigm.

  The documents table has shared columns plus a properties JSONB column for type-specific data:

  ┌────────────────────┬────────────────────────────────────────────────────────────────────────┐
  │       Column       │                                Purpose                                 │
  ├────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ document_type      │ Enum: wiki, issue, program, project, sprint, person, weekly_plan, etc. │
  ├────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ title              │ Always defaults to "Untitled" (never "Untitled Issue")                 │
  ├────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ content (JSONB)    │ TipTap rich-text JSON — same format for all types                      │
  ├────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ yjs_state (BYTEA)  │ Yjs CRDT binary state for real-time collaboration                      │
  ├────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ properties (JSONB) │ The key differentiator — type-specific fields                          │
  ├────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ parent_id          │ 1:1 containment hierarchy (wiki nesting, weekly plan under sprint)     │
  ├────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ ticket_number      │ Auto-increment per workspace, only used by issues                      │
  └────────────────────┴────────────────────────────────────────────────────────────────────────┘

  Each document type stores different fields in the JSONB column:

  - Issue: { state: "in_progress", priority: "high", assignee_id: "...", estimate: 4 }
  - Project: { impact: 4, confidence: 3, ease: 5, color: "#ff0000", owner_id: "..." }
  - Sprint (Week): { sprint_number: 12, owner_id: "...", status: "active" }
  - Program: { color: "#6366f1", emoji: "🔐", owner_id: "..." }
  - Person: { email: "...", capacity_hours: 40, reports_to: "..." }

[ ] What is the document_type discriminator? How is it used in queries? 

The document_type is a PostgreSQL ENUM discriminator in the documents table. It implements a Single Table Inheritance (STI) pattern where multiple domain entities (Issues, Wikis, Programs, etc.) share a common table but are differentiated by this column. Values of document_type are wiki, issue, program, project, sprint (Weeks), person (User Profile), weekly_plan, weekly_retro, standup, weekly_review

[ ] How does the application handle document relationships (linking, parent-child, project membership)? 

The application handles document relationships through a unified architecture that combines a flexible data model with structured organizational links. Everything is a document. There is a parent_id in the documents table so that entries are contained by other entries, e.g. a program contains a project which contains a sprint.

3. Request Flow 

[ ] Pick one user action (e.g., creating an issue) and trace it from the React component through the API route to the database query and back. 

For the "Create Issue" action ->

    # 1 React Component
  The flow starts in web/src/pages/Issues.tsx. The IssuesPage renders an IssuesList component with a showCreateButton prop. When a user clicks "New Issue":
   - The component calls onCreateIssue, which is mapped to the createIssue function from the useIssues hook.
   - This hook (defined in web/src/hooks/useIssuesQuery.ts) uses a React Query mutation (useCreateIssue).

    # 2 API Client
  The mutation executes createIssueApi, which performs a POST request using the project's API utility:


   1 // web/src/hooks/useIssuesQuery.ts
   2 async function createIssueApi(data: CreateIssueData): Promise<Issue> {
   3   const res = await apiPost('/api/issues', apiData);
   4   const apiIssue = await res.json();
   5   return transformIssue(apiIssue);
   6 }
  Note: The frontend immediately performs an optimistic update, adding a temporary "PENDING" issue to the UI while the request is in flight.

    # 3 API Route
  The request is received by api/src/routes/issues.ts at the router.post('/') endpoint:
   - Middleware: authMiddleware validates the session and attaches workspaceId and userId to the request.
   - Validation: The body is validated against a Zod schema (createIssueSchema).
   - Concurrency Control: It starts a transaction and acquires a PostgreSQL advisory lock (pg_advisory_xact_lock) based on the workspaceId to ensure ticket_number generation is thread-safe.

    # 4 Database Layer (Long-Term Persistence)
  The backend executes several SQL queries within the transaction:
    1) Generate Ticket Number:
     SELECT COALESCE(MAX(ticket_number), 0) + 1 FROM documents WHERE workspace_id = $1 AND document_type = 'issue'
    2) Insert Document: Core data is stored in the documents table, with issue-specific metadata (state, priority, etc.) stored in a properties JSONB column:


   1    INSERT INTO documents (workspace_id, document_type, title, properties, ticket_number, created_by)
   2    VALUES ($1, 'issue', $2, $3, $4, $5) RETURNING *
    3) Handle Associations: If the issue "belongs to" a project or program, entries are created in the document_associations junction table.

    # 5 Response and UI Update
   - Backend: The transaction is committed, and the newly created row is returned as JSON with a 201 Created status.
   - Frontend: React Query's onSuccess callback receives the real data:
     - It replaces the optimistic "temp" issue in the local cache with the real issue (now having a permanent ID and ticket number like #101).
     - The UI reactively updates to show the finalized issue in the list.

[ ] Identify the middleware chain: what runs before every API request? 

  Global Middleware Chain (Runs for every /api/ request)
  These are executed in the order they are defined in api/src/app.ts:

   1. CloudFront Proxy Trust: In production, it overrides x-forwarded-proto to https for requests coming through CloudFront to ensure secure cookie handling.
   2. Helmet: Applies standard security headers, including a strict Content Security Policy (CSP) and HSTS.
   3. API Rate Limiter: Limits requests to 100/min in production (higher in dev/test) to prevent DoS attacks.
   4. CORS: Configured with dynamic origins and credentials: true.
   5. Body Parsers: express.json() and express.urlencoded() with a 10MB limit to accommodate large documents.
   6. Cookie Parser: Parses cookies using the SESSION_SECRET.
   7. Session Middleware: express-session is used primarily for managing CSRF token storage.

  Most API routes then pass through additional layers before reaching their logic:

   1. Conditional CSRF (conditionalCsrf):
       * Skips CSRF checks for requests using Authorization: Bearer (API tokens).
       * Enforces csrfSynchronisedProtection for session-based browser requests.
   2. Authentication Middleware (authMiddleware):
       * Located in api/src/middleware/auth.ts.
       * Attempts Bearer Token authentication first.
       * Falls back to Session Cookie (session_id) authentication.
       * Validates session inactivity (15 mins) and absolute timeout (12 hours).
       * Attaches userId, workspaceId, and isSuperAdmin to the request object.
   3. Login Limiter: A stricter rate limiter (5 failed attempts / 15 mins) applied specifically to /api/auth/login.

  Exceptions
   * Public Endpoints: /health, /api/csrf-token, and /api/feedback (public parts) bypass authentication and CSRF.
   * Read-Only Routes: Routes like /api/search, /api/activity, and /api/dashboard typically bypass CSRF as they only handle GET requests.

[ ] How does authentication work? What happens to an unauthenticated request?

  Session-Based Auth

  Login flow: POST /api/auth/login validates email/password (bcrypt), creates a session with a 256-bit cryptographic random ID stored in the sessions table, and sets an httpOnly, sameSite: strict, secure
  cookie.

  On every authenticated request, the authMiddleware (api/src/middleware/auth.ts):
  1. Reads the session ID from the cookie (or Bearer token from Authorization header)
  2. Looks up the session in PostgreSQL
  3. Checks inactivity timeout (15 minutes since last activity)
  4. Checks absolute timeout (12 hours since creation — NIST SP 800-63B-4 compliance)
  5. Verifies the user still has workspace membership
  6. Updates last_activity and refreshes the cookie (throttled to 60s intervals)
  7. Attaches req.userId, req.workspaceId, req.isSuperAdmin for downstream handlers

  What Happens to Unauthenticated Requests

  Server side: The auth middleware returns 401 Unauthorized with an error code — either SESSION_EXPIRED (if a session existed but timed out) or UNAUTHORIZED (no valid session at all). The expired session is
  deleted from the DB.

  Client side (web/src/lib/api.ts): On receiving a 401:
  - SESSION_EXPIRED → redirects to /login?expired=true (shows "session expired" message)
  - UNAUTHORIZED → the ProtectedRoute component (web/src/components/ProtectedRoute.tsx) catches the unauthenticated state and redirects to /login with a returnTo parameter preserving the original URL

  Additional Security Layers

  - CSRF protection: State-changing requests require an X-CSRF-Token header (skipped for Bearer token auth)
  - Rate limiting: 5 login attempts per 15 minutes in production
  - Session fixation prevention: Old sessions are deleted on login
  - Client-side timeout warnings: useSessionTimeout hook warns 60s before inactivity timeout (with a "Stay Logged In" button) and 5min before absolute timeout (cannot be extended)

Phase 2: Deep Dive 

4. Real-time Collaboration

[ ] How does the WebSocket connection get established? 

The WebSocket connection in Ship is established through a coordinated process between the client-side editor and the server-side collaboration service.

  Client-Side: Establishing the Link
   1. Initialization: When the Editor component mounts, it creates a new Y.Doc and initializes IndexeddbPersistence to instantly load any cached content from the browser, ensuring a zero-latency start.
   2. Provider Setup: It constructs a WebSocket URL (e.g., wss://ship.example.com/collaboration/doc:uuid) and initializes a WebsocketProvider from y-websocket.
   3. Custom Handshake: The client hooks into the connection process to add a raw message listener. It specifically looks for a CLEAR_CACHE signal from the server, which forces the client to wipe its local
      IndexedDB if the server detects that the document was updated via the REST API (preventing stale content merges).
   4. State Sync: Once connected, the provider synchronizes the Yjs CRDT state and shares Awareness data (user cursors, names, and colors).


  Server-Side: Validation and Sync
   1. Upgrade & Security: The Express server intercepts the HTTP upgrade request. It performs IP-based rate limiting, validates the user's Session ID from cookies, and verifies that the user has Visibility
      Permissions for that specific document.
   2. Document Loading: The server retrieves the document's binary yjs_state from PostgreSQL. If no binary state exists (e.g., a new document created via API), it fallbacks to converting the JSON content
      column into a Yjs document.
   3. Real-Time Persistence: As clients edit, the server receives CRDT updates, broadcasts them to other collaborators, and debounces a background save (every 2 seconds) to the database. During this save, it
      also converts the content back to JSON to keep the content and properties columns (like hypotheses and goals) in sync for the REST API.

  This architecture ensures that while editing feels "local-first" and instantaneous, the server remains the authoritative source of truth for security, persistence, and cross-application state.

[ ] How does Yjs sync document state between users? 

    WebSocket -> CRDT sync -> awareness & presence (y-protocols) -> persistence & hybrid ( Y.Doc, JSON fallback, JSONB colum sync)

   1. Real-Time WebSocket Communication: Users connect to the /collaboration/{type}:{id} endpoint. The server uses y-websocket and y-protocols to manage these connections, while the setupCollaboration function
      in api/src/collaboration/index.ts handles the WebSocket upgrade and session validation.

   2. CRDT Sync Protocol: Synchronization follows the Yjs binary protocol, starting with a "sync step 1" where the server sends its state vector. The client responds with missing updates, and the server then
      broadcasts any changes to other connected clients in the same "room," with Yjs's CRDT properties ensuring conflict-free merging.

   3. Awareness & Presence: User presence (cursors, selections) is managed through the y-protocols/awareness protocol. The server tracks awarenessClientId for each connection and broadcasts awareness updates
      (added, updated, or removed) to all clients in the room.

   4. Persistence & Hybrid Sync:
       * Binary State: The server periodically persists the Y.Doc as a binary yjs_state in the PostgreSQL documents table.
       * JSON Fallback: It also converts the document to TipTap JSON and stores it in the content column for API-level access and as a fallback.
       * Extracted Properties: Key fields like hypotheses or goals are extracted from the rich text and synced to the properties JSONB column.

   5. Offline Tolerance: The frontend uses y-indexeddb to cache the Y.Doc locally, allowing instant document loading even before the WebSocket connection is established.

   6. Security & DDoS Protection: The system includes IP-based connection rate limiting, message rate limiting per connection, and session validation (cookie-based) for all WebSocket upgrades. It also handles
      visibility changes by disconnecting users if a document is made private.

[ ] What happens when two users edit the same document at the same time? 

The system uses Yjs to manage CRDT (Conflict-free replicated data type) real-time collab.

  1. Real-time Synchronization (Yjs)
  The system does not use "last-write-wins" for document content. Instead, it maintains a shared state using Yjs:
   - Automatic Merging: Yjs ensures that all concurrent changes (insertions, deletions, formatting) are merged deterministically across all clients without manual conflict resolution.
   - WebSocket Protocol: Edits are broadcasted as binary updates over a WebSocket connection (/collaboration/:docName).
   - Awareness Protocol: The system tracks and displays "awareness" data, such as cursor positions and user presence, so users can see each other's activity in real-time.

  2. Backend Orchestration
  The api/src/collaboration/index.ts server manages the shared state:
   - In-Memory Cache: The server keeps an active Y.Doc in memory for any document being edited.
   - Persistence: Changes are debounced and saved to the PostgreSQL database every 2 seconds after activity ceases.
   - Unified Table: All document types (Issues, Projects, Wikis) are stored in a single documents table, using a yjs_state (binary) column for the CRDT state and a content (JSONB) column for a human-readable
     fallback.

  3. Conflict Handling for Metadata (REST API)
  While document content is handled via Yjs, document metadata (like status, priority, or assignee) is typically updated via standard REST PATCH requests. For these fields:
   - Last-Write-Wins: Metadata updates generally follow a last-write-wins pattern.
   - Cache Invalidation: If metadata is updated via the REST API, the collaboration server receives an invalidation signal (invalidateDocumentCache). It then disconnects active WebSocket users with a custom
     code (4101), forcing them to reconnect and sync with the latest state from the database.

  4. Edge Case: Simultaneous Status Changes
  The system includes specific logic for closing issues. If two users try to close the same issue at once:
   - The database transaction and advisory locks (used during creation) ensure data integrity.
   - If a user tries to close an issue that has "incomplete children," the API returns a 409 Conflict (Cascade Warning) to prevent accidental data inconsistency, requiring the user to confirm the action.

[ ] How does the server persist Yjs state? 

The server persists Yjs state using a binary format in a PostgreSQL database, complemented by a JSON fallback and specialized metadata extraction

  1. Storage Mechanism
   * Primary State: The complete Yjs document is encoded as a binary update using Y.encodeStateAsUpdate(doc) and stored in the yjs_state column (type BYTEA) of the documents table.
   * JSON Fallback: The Yjs XML fragment is converted to TipTap-compatible JSON via yjsToJson and stored in the content column. This allows REST API consumers to read the document without needing the Yjs
     library.
   * Metadata Extraction: During persistence, the server extracts specific fields (Hypothesis/Plan, Success Criteria, Vision, Goals) from the document content and saves them into a properties JSONB column.

  2. Persistence Lifecycle
   * Debounced Saving: To avoid overwhelming the database, the server uses a 2-second debounce (schedulePersist). Every change (doc.on('update')) resets this timer.
   * Loading Flow:
       1. When a client connects, the server checks its in-memory docs Map.
       2. If not present, it queries the database.
       3. It prefers the yjs_state binary. If missing (e.g., for a new document created via API), it falls back to converting the content JSON into a Yjs document using jsonToYjs.
   * Cleanup: When the last user disconnects from a room, the server performs a final "emergency" save of any pending changes and removes the document from memory after a 30-second grace period.

  3. Synchronization & Conflict Resolution
   * Server-as-Authority: The server maintains a single Y.Doc instance per room in memory.
   * Update Propagation: When an update is received from a client, it is applied to the server's document and immediately broadcast to all other connected clients in that room.
   * Cache Invalidation: If a document is updated via the REST API (bypassing the WebSocket), invalidateDocumentCache(docId) is called. This disconnects active collaborators (with code 4101) and clears the
     server's in-memory state to force a fresh reload from the database on the next connection.

  4. Audit Trail
   * For specific document types (weekly_plan, weekly_retro), the server logs content changes to a document_history table (at most once per minute) to provide a versioned audit trail for accountability.

5. TypeScript Patterns 

[ ] What TypeScript version is the project using? 

TypeScript version ^5.7.2, as specified in the devDependencies of both the @ship/api and @ship/web packages

[ ] What are the tsconfig.json settings? Is strict mode on? 

  Key Settings:
   - Strict Mode: "strict": true (Root, API, Shared, and Web)
   - Target/Lib: ES2022 (Modern JavaScript features)
   - Module Resolution: NodeNext for backend (API) and bundler for frontend (Web)
   - Additional Safety:
     - "noUncheckedIndexedAccess": true (Prevents common undefined errors when accessing arrays/objects)
     - "noImplicitReturns": true
     - "noFallthroughCasesInSwitch": true
     - "forceConsistentCasingInFileNames": true

    Yes, strict mode is on

[ ] How are types shared between frontend and backend (the shared/ package)? 

Types and utilities are shared between the frontend (web/) and backend (api/) via a dedicated shared package, managed as a pnpm workspace.

  1. The @ship/shared Package
  The structure of the shared package is:
   - Location: C:\gauntlet\ship\shared
   - Source: shared/src/types/ contains category-specific TypeScript definitions:
       - document.ts: Core models for Issues, Projects, and Wikis.
       - user.ts & auth.ts: User and session types.
       - workspace.ts: Workspace and membership types.
   - Entry Point: shared/src/index.ts exports everything from the subdirectories, making it available under a single namespace.


  2. Workspace Integration
  The project uses pnpm workspaces to link this package locally without publishing it:
   - Frontend: web/package.json includes "@ship/shared": "workspace:*" in its dependencies.
   - Backend: api/package.json includes "@ship/shared": "workspace:*" in its dependencies.


  3. Usage in Code
  Because it is a workspace package, both sides import types directly using the package name:
   - Backend Example: api/src/routes/issues.ts imports types like BelongsTo to ensure API responses match the expected schema.
   - Frontend Example: web/src/hooks/useIssuesQuery.ts imports the same BelongsTo type to provide type safety for React Query hooks.


  4. Build Process
   - The shared package has its own tsconfig.json and a build script (tsc).
   - When the shared package is updated, running the build generates type definitions (.d.ts) and compiled JavaScript in shared/dist/, which are then consumed by the other packages.

[ ] Find examples of: generics, discriminated unions, utility types (Partial, Pick, Omit), and type guards in the codebase. 

  Generics

  Generic API response with default type — shared/src/types/api.ts:
  export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
  }

  Generic request function — web/src/lib/api.ts:
  async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>>

  Constrained generic with Zod — api/src/openapi/schemas/common.ts:
  export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
      items: z.array(itemSchema),
      total: z.number().int(),
      page: z.number().int(),
      limit: z.number().int(),
      hasMore: z.boolean(),
    });

  Constrained generic React component — web/src/components/SelectableList.tsx:
  export function SelectableList<T extends { id: string }>({ items, ... }: SelectableListProps<T>)

  Generic hook — web/src/hooks/useSelection.ts:
  export function useSelection<T>({ items, getItemId, ... }: UseSelectionOptions<T>): UseSelectionReturn

  Discriminated Unions

  The core document model — shared/src/types/document.ts — is itself a discriminated union on document_type:

  export interface IssueDocument extends Document {
    document_type: 'issue';
    properties: IssueProperties;
    ticket_number: number;
  }
  export interface ProjectDocument extends Document {
    document_type: 'project';
    properties: ProjectProperties;
  }
  export interface WeekDocument extends Document {
    document_type: 'sprint';
    properties: WeekProperties;
  }
  // ... WikiDocument, ProgramDocument, PersonDocument, etc.

  Utility Types

  Partial<T> — shared/src/types/document.ts:
  export const DEFAULT_PROJECT_PROPERTIES: Partial<ProjectProperties> = {
    impact: null, confidence: null, ease: null,
  };

  Record<K, V> — used heavily for JSONB flexibility:
  // shared/src/types/document.ts
  properties: Record<string, unknown>;
  content: Record<string, unknown>;

  // api/src/db/seed.ts
  const reportingHierarchy: Record<string, string[]> = { ... };

  ReturnType<typeof fn> — for timer refs throughout the frontend:
  // web/src/hooks/useAutoSave.ts
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // web/src/hooks/useSessionTimeout.ts
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // api/src/routes/ai.ts
  type RouterType = ReturnType<typeof Router>;

  const assertions to derive union types — api/src/routes/associations.ts:
  const validTypes = ['parent', 'project', 'sprint', 'program'] as const;
  type RelationshipType = typeof validTypes[number];
  // RelationshipType = 'parent' | 'project' | 'sprint' | 'program'

  Icon name validation — web/src/components/icons/uswds/types.ts:
  export function isValidIconName(name: string): name is IconName {
    return ICON_NAMES.includes(name as IconName);
  }

  Relationship type guard — api/src/routes/associations.ts:
  function isValidRelationshipType(value: unknown): value is RelationshipType {
    return typeof value === 'string' && validTypes.includes(value as RelationshipType);
  }

  in operator narrowing — web/src/hooks/useIssuesQuery.ts:
  if ('project_id' in updates) {
    newBelongsTo = newBelongsTo.filter(a => a.type !== 'project');
    if (updates.project_id) {
      newBelongsTo.push({ id: updates.project_id, type: 'project' });
    }
  }

  typeof narrowing — api/src/collaboration/index.ts:
  if (typeof jsonContent === 'string') {
    if (jsonContent.trim().startsWith('<')) { /* handle XML */ }
  }

[ ] Are there any patterns you do not recognize? Research them. 

I hadn't previously encountered typing via registry as in the types used for the UI tabs.  In this case, document types can map to different tab sets based on their current states (e.g. sprint:planning vs sprint:active)

6. Testing Infrastructure 

[ ] How are the Playwright tests structured? What fixtures are used? 

  The E2E tests are designed for maximum isolation and speed, using a per-worker infrastructure pattern.

  Structure:
   * Location: All tests reside in the e2e/ directory.
   * Parallelization: Tests run in full parallel. The playwright.config.ts dynamically calculates the number of workers based on the system's available RAM (~500MB per worker).
   * Lifecycle: global-setup.ts builds the API and Web packages once. Then, each worker spins up its own isolated environment.

  Key Fixtures (e2e/fixtures/isolated-env.ts):
  The test object is extended with several worker-scoped fixtures:

   1. dbContainer:
       * Uses Testcontainers to spin up a fresh PostgreSQL instance for every worker.
       * Automatically runs schema.sql and seeds minimal test data (users, workspace, programs, issues) so every test starts with a known, valid state.
   2. apiServer:
       * Starts a dedicated Node.js API process on a dynamic port for each worker.
       * Points to the worker's specific dbContainer.
   3. webServer:
       * Starts a Vite Preview server (much lighter than vite dev).
       * Configures a proxy to the worker's specific apiServer.
   4. context Override:
       * Automatically injects an initScript to set localStorage.setItem('ship:disableActionItemsModal', 'true'). This prevents "Action Items" popups from interfering with UI tests.
   5. baseURL:
       * Automatically set to the dynamic URL of the worker's webServer.

  Test Helpers (e2e/fixtures/test-helpers.ts):
  Provides high-level actions to reduce boilerplate:
   * login(page, email, password): Handles the authentication flow.
   * createDocument(page, type, title): Automates document creation via the UI.
   * gotoWorkspace(page): Navigates to the default workspace.

[ ] How does the test database get set up and torn down? 

 The database is initialized via a migration script and then wiped before every test file to provide a clean slate

  1) Sequential Execution
  The project uses Vitest for integration testing. To prevent race conditions and database deadlocks, the api/vitest.config.ts sets fileParallelism: false. This ensures that each test file runs sequentially
  against the same database instance.

  2) Global Setup (Automatic Truncation)
  Before each test file starts, the api/src/test/setup.ts hook executes a TRUNCATE TABLE ... CASCADE command.
   - Efficiency: Truncating is significantly faster than deleting and avoids triggering certain row-level audit triggers.
   - Dependency Handling: The CASCADE ensures that foreign key relationships are respected, and all linked data (from workspaces down to audit_logs and comments) is wiped clean.
   - Consistency: This ensures every test file starts with a completely empty schema, preventing data leakage between tests.

  3) Schema & Migrations
  The test suite assumes the database schema is already present. This is typically handled by the api/src/db/migrate.ts script, which:
   1. Executes schema.sql to create the base tables and enums.
   2. Runs all numbered SQL files in the migrations/ folder in sequential order.
   3. Tracks applied migrations in a schema_migrations table to avoid duplicates.

  4) Teardown
   - Per-File: No specific per-file teardown is needed since the next test file will truncate the tables anyway.
   - Global: Vitest handles closing the database connection pool at the end of the entire test run via its internal lifecycle management.

[ ] Run the full test suite. How long does it take? Do all tests pass? 

** pnpm lint

> ship@0.0.0 lint C:\gauntlet\ship
> pnpm --recursive run lint

Scope: 3 of 4 workspace projects
None of the selected packages has a "lint" script

The root package.json defines a lint script that attempts to run pnpm --recursive run lint, but none of the individual workspace packages (api, web, shared) actually have a lint script defined in their
  respective package.json files.

** pnpm type-check

> ship@0.0.0 type-check C:\gauntlet\ship
> pnpm --recursive run type-check

Scope: 3 of 4 workspace projects
shared type-check$ tsc --noEmit
└─ Done in 758ms
api type-check$ tsc --noEmit
└─ Done in 9.1s
web type-check$ tsc --noEmit
└─ Done in 9.6s

** pnpm test

 Test Files  28 passed (28)
      Tests  451 passed (451)
   Start at  13:27:57
   Duration  31.60s (transform 1.15s, setup 1.86s, import 13.66s, tests 11.53s, environment 3ms)

** pnpm test:e2e

These have mostly finished running as of this time.

7. Build and Deploy 

[ ] Read the Dockerfile. What does the build process produce? 

  The build process is specifically optimized for government and restricted network environments, with several key characteristics:

   1. Production Runtime Image: It produces a containerized application running on Node.js 20-slim.
   2. Pre-built Artifact Strategy: Unlike the development Dockerfiles, the production build does not compile from source inside the container. It copies pre-built dist/ directories for both the api and shared
      packages from the host, resulting in a faster and smaller image.
   3. Strict SSL Bypass: It explicitly configures npm and pnpm with strict-ssl false to ensure compatibility with government VPNs and SSL-inspecting proxies.
   4. Production Dependency Minimalization: It installs only production dependencies (pnpm install --prod) and prunes the pnpm store to keep the image lean.
   5. Self-Migrating Startup: The container's entry command automatically executes database migrations (node dist/db/migrate.js) before starting the API server (node dist/index.js) on port 80.

  In contrast, Dockerfile.dev and Dockerfile.web are designed to build from source and run development servers (Node and Vite, respectively).

[ ] Read the docker-compose.yml. What services does it start? 

The docker-compose.yml file defines and starts only one service:

  1. postgres
   - Image: postgres:16
   - Port: 5432
   - Database Name: ship_dev
   - User: ship
   - Volume: postgres_data (for persistent data storage).

  The file includes a header indicating that this is an optional service for local development. The project's documentation (referenced in the header) suggests that most developers use a native PostgreSQL
  installation, but this Docker setup provides a quick way to start a compatible database instance.

[ ] Skim the Terraform configs. What cloud infrastructure does the app expect? 

  User → CloudFront (WAF) → S3 (React SPA)
                          → ALB → EB instances (Docker/Express) → Aurora PostgreSQL
                                        ↕ WebSocket (/collaboration/*)
                                        → SSM Parameter Store
                                        → Bedrock (AI analysis)
                                        → Secrets Manager (OAuth creds)
           CloudFront → Kinesis (real-time logs)

  VPC (vpc.tf) — 10.0.0.0/16 in us-east-1 with:
  - 2 public subnets (for the ALB)
  - 2 private subnets (for EB instances and Aurora)
  - NAT Gateway so private instances can pull Docker images
  - VPC Flow Logs → CloudWatch (government compliance)

  Compute — Elastic Beanstalk

  elastic-beanstalk.tf — Express API server:
  - 64-bit Amazon Linux 2023 running Docker
  - Instance type: t3.small, autoscaling 1–4 instances
  - Instances in private subnets, ALB in public subnets
  - Rolling deployment with additional batch (zero-downtime deploys)
  - Health check on /health, enhanced health reporting
  - IMDSv1 disabled (security hardening)

  Database — Aurora Serverless v2

  database.tf — PostgreSQL 16.8:
  - Aurora Serverless v2, scaling 0.5–4 ACUs
  - Storage encrypted, not publicly accessible
  - In private subnets, only accepts connections from EB security group on port 5432
  - Prod: 7-day backup retention + final snapshot; dev: 1-day, skip final snapshot
  - Slow query logging (>1s)

  Frontend — S3 + CloudFront

  s3-cloudfront.tf — React SPA hosting:
  - S3 bucket (private, versioned, AES256 encrypted) for static assets
  - CloudFront distribution with multiple origins:
    - S3 origin (default) — static files via OAC (no public access)
    - EB origin — API requests via path-based routing
  - Path routing: /api/* → EB, /collaboration/* → EB (WebSocket), /events → EB, /.well-known/* → EB, everything else → S3
  - CloudFront Function for SPA routing (rewrites non-file paths to /index.html)
  - Optional custom domain with ACM certificate + Route53 DNS
  - TLS 1.2 minimum

  Uploads bucket — separate S3 bucket for user file uploads (private, versioned, CORS-enabled for browser direct upload, presigned URL access)

  Security

  WAF (waf.tf) — attached to CloudFront:
  - Rate limiting: 300 requests/5min per IP (429 response)
  - AWS managed rule groups: IP Reputation, Common Rule Set (OWASP Top 10), Known Bad Inputs, SQL Injection
  - Bot Control (common level, count mode for benign categories)
  - Custom IP blocklist

  Security Groups (security-groups.tf):
  - ALB: 80/443 from anywhere
  - EB instances: port 80 from ALB only
  - Aurora: port 5432 from EB instances only

  Secrets & Config

  SSM Parameter Store (ssm.tf):
  - DATABASE_URL, DB_HOST, DB_PASSWORD (SecureString)
  - SESSION_SECRET (64-char random, SecureString)
  - CORS_ORIGIN, CDN_DOMAIN, APP_BASE_URL (derived from CloudFront/domain)
  - EB instances have IAM policy to read SSM params + decrypt via KMS

  Additional IAM policies on EB instances:
  - Bedrock InvokeModel for Anthropic models (AI quality analysis)
  - Secrets Manager for FPKI/OAuth credentials (CAIA PIV auth)

  Logging & Observability

  CloudFront real-time logs (cloudfront-logging.tf) → Kinesis Data Stream (4 shards, 180-day retention, KMS encrypted), capturing all request fields at 100% sampling rate.

[ ] How does the CI/CD pipeline work (if configured)? 

The project uses a script-based deployment pipeline rather than an automated CI/CD service like GitHub Actions. The workflow is managed through a set of shell scripts in the scripts/ directory that interact with AWS and Terraform.

   1. Infrastructure (Terraform):
       * Script: scripts/deploy-infrastructure.sh
       * Function: Provisions AWS resources including VPC, Aurora PostgreSQL, S3, CloudFront, and Elastic Beanstalk.
       * Source of Truth: Infrastructure metadata and environment variables are stored in AWS SSM Parameter Store.

   2. API Deployment:
       * Script: scripts/deploy.sh (or scripts/deploy-api.sh)
       * Workflow:
           1. Sync Config: Pulls environment-specific configuration from SSM.
           2. Build: Compiles shared TypeScript packages and the Express API.
           3. Safety Check: Performs a local Docker build and runs an internal "import test" within the container to ensure the application can start without runtime errors before it is uploaded to AWS.
           4. Bundle: Zips the application code, Dockerfile, and AWS-specific configurations (.ebextensions, .platform).
           5. Deploy: Uploads the bundle to S3 and updates the Elastic Beanstalk environment.

   3. Frontend Deployment:
       * Script: scripts/deploy-frontend.sh
       * Workflow:
           1. Build: Compiles the React application (pnpm build:web).
           2. Sync: Synchronizes the web/dist/ directory to an S3 bucket, applying specific cache-control headers (e.g., long-term caching for assets, short-term for index.html).
           3. Invalidate: Creates a CloudFront invalidation to clear the CDN cache.

Phase 3: Synthesis 

8. Architecture Assessment 

[ ] What are the 3 strongest architectural decisions in this codebase? Why? 

  1. The Unified Document Model

  Storing wiki pages, issues, projects, sprints, and people in a single documents table with a properties JSONB column is the highest-leverage decision in the codebase. It cascades into simplicity everywhere:

  - One editor component serves all content types. The Editor in web/src/components/Editor.tsx doesn't know if it's editing a wiki page or an issue — differentiation is pushed to the container via props. This
  eliminates an entire class of "build a new editor for type X" work.
  - One CRUD layer. Routes, services, and the collaboration server all operate on "documents." Adding a new content type (like weekly_plan, standup) requires no new tables, no new API routes for basic
  operations, and no new editor code.
  - document_associations replacing foreign key columns is the underrated part. The old design had project_id, sprint_id, program_id columns that caused write-read mismatches (writes hit columns, reads joined
  the junction table). Migrating to a single junction table with relationship_type made the data model honest — one path for reads and writes. The migrations that dropped those legacy columns (027, 029) are
  some of the most important in the history.

  The risk of this pattern is query complexity and loss of database-level constraints, but they've mitigated it well: TypeScript interfaces enforce property shapes at compile time, Zod validates at API
  boundaries, and document-crud.ts utilities prevent N+1 queries on associations.

  2. CloudFront as the Single Entry Point

  Routing both the SPA and the API through one CloudFront distribution (s3-cloudfront.tf) is architecturally clean in ways that compound:

  - One domain, one TLS cert, one WAF. The path-based routing (/api/* → EB, /collaboration/* → EB for WebSocket, everything else → S3) means the frontend and API share a single origin from the browser's
  perspective. No CORS complexity for same-origin requests, session cookies work naturally with sameSite: strict, and the WAF protects everything uniformly.
  - Security layers compose. Rate limiting (WAF: 300 req/5min per IP), bot control, OWASP rules, and IP reputation all apply at the edge before traffic ever reaches EB. The app-level rate limiting (5 login
  attempts/15min) is a second line of defense, not the only one.
  - The SPA routing CloudFront Function is a smart detail — it rewrites non-file paths to /index.html at the viewer-request stage for S3, which avoids the custom_error_response trap that would break API 404
  responses.

  This is a textbook "boring technology" choice. No API Gateway, no Lambda@Edge, no separate CDN — just CloudFront doing what CloudFront does well.

  3. Session-Based Auth with Computed (Not Stored) State

  The auth system makes two key sub-decisions that reinforce each other:

  Sessions in PostgreSQL, not JWTs. The sessions table enables immediate revocation (delete the row), workspace membership checks on every request, and server-side timeout enforcement. JWTs would require a
  revocation list that recreates a session store anyway. The sliding inactivity timeout (15 min) + absolute timeout (12 hr, NIST SP 800-63B-4) is cleanly implemented because the server owns the session state —
   last_activity and created_at are just columns to compare against.

  Computed state as a broader pattern. This philosophy extends beyond auth. Week dates are computed from sprint_number + workspace.sprint_start_date, not stored. Week status (active/completed/upcoming) is
  derived from today's date. Roll-ups are computed client-side. This eliminates an entire category of consistency bugs — there's no "start week" button that can get out of sync with reality, no stale status
  that needs a cron job to update.

  The tradeoff is that every request pays the cost of a session lookup + membership check, but with a single Aurora Serverless instance in the same VPC, that's sub-millisecond. The cookie refresh throttle
  (60-second intervals) avoids write amplification on last_activity.

  ---
  What ties all three together: each one reduces the number of moving parts. One table instead of many. One entry point instead of separate frontend/API domains. Computed state instead of stored-and-synced
  state. The codebase is opinionated about doing less, and that compounds into a system that's easier to reason about and harder to break.

[ ] What are the 3 weakest points? Where would you focus improvement? 

  1. Collaboration persistence has race conditions and memory leaks

  Where: api/src/collaboration/index.ts

  Two concurrent persistDocument calls can lose data — both read the same properties, then one overwrites the other. There's no optimistic locking (WHERE version = $N) or advisory locks. Additionally, the
  conns and eventConns Maps accumulate dead WebSocket references on disconnect, leaking memory on long-lived servers.

  Fix focus: Add a version column or SELECT ... FOR UPDATE to persistence. Clean up connection maps in ws.on('close').

  ---
  2. No runtime validation at API boundaries (both directions)

  Where: All route handlers (api/src/routes/*) and all frontend hooks (web/src/hooks/*)

  - Inbound: Query params are cast with as unknown as Type instead of Zod validation. JSONB properties are accessed without type guards (props.state, props.priority could be anything).
  - Outbound: Frontend does return res.json() with no schema validation — if the API shape changes, the UI crashes deep in a component instead of at the fetch layer.
  - Errors: Every catch block returns { error: 'Internal server error' } with no error codes, no request IDs, and inconsistent response shapes.

  Fix focus: Add Zod schemas at API entry points (some routes already have this — standardize it). Add a lightweight response validator or branded types on the frontend. Standardize error response format.

  ---
  3. Database query patterns don't scale

  Where: api/src/routes/projects.ts, api/src/routes/issues.ts, api/src/routes/documents.ts

  - Correlated subqueries in list endpoints: projects.ts runs COUNT(*) subqueries per-project for sprints and issues (~2N queries for N projects). Should be a single GROUP BY join.
  - Duplicated SQL logic: The 31-line inferredStatusSubquery is copy-pasted between list and get endpoints in projects.ts.
  - Hardcoded polling: useActionItemsQuery polls every 60 seconds regardless of user activity — 100 idle users = 6,000 requests/hour for one endpoint.

  Fix focus: Replace correlated subqueries with joins. Extract shared SQL into query-builder functions. Add visibility-based or idle-aware polling (or use WebSocket events to invalidate queries instead of
  polling).

[ ] If you had to onboard a new engineer to this codebase, what would you tell them first? 

  "Everything is a document."

  This is the project's core technical and philosophical foundation. Unlike typical applications that treat wiki pages, tasks, and projects as separate entities, Ship uses a Unified Document Model. This means:

   1. Uniform Data Structure: At the database level, there is no difference between a wiki page, an issue, a project, or a weekly plan. They all live in the documents table with a document_type field.
   2. Rich Content Everywhere: Because everything is a document, every item in the system (even a simple bug report) supports a full-featured rich-text editor (TipTap + Yjs) with real-time collaboration.
   3. Real-Time by Default: The entire application is built around real-time sync. If two people are looking at a sprint plan or an issue description, they see each other's cursors and changes instantly via
      WebSockets.

  ---

  The Three Pillars of the Workspace
  After that, I would explain the three key components they'll be working with:

   * The Monorepo Structure:
       * web/: React + Vite + Tailwind frontend.
       * api/: Express backend with WebSocket support for collaboration.
       * shared/: Common TypeScript types used by both to ensure end-to-end type safety.
   * The "Plan-Driven" Workflow: Ship isn't just a task tracker; it's an accountability tool. We emphasize Weekly Plans (declaring intent) and Weekly Retros (capturing learnings). If a team misses a retro, the
     UI progressively turns "urgent" (yellow to red) to nudge them.
   * The 4-Panel Layout: The UI is strictly standardized. Whether you're in "Docs" or "Issues," you'll always see the Rail (navigation), Sidebar (context list), Main Editor (content), and Properties
     (metadata).

  Quick Start for the First Hour
  I'd point them to these specific files to get their environment running:
   1. ship-welcome-guide.md: For the high-level philosophy and UI overview.
   2. README.md: For the local setup (Docker for PG, pnpm install, pnpm dev).
   3. docs/application-architecture.md: For a deep dive into how the real-time sync and document model actually work.

[ ] What would break first if this app had 10x more users?

  1. Database connection pool exhaustion (breaks first)

  api/src/db/client.ts:20 — Pool is max: 20 in production.

  Every single HTTP request runs 2-3 queries in the auth middleware alone:
  - SELECT ... FROM sessions (line 126-133 of auth.ts)
  - SELECT ... FROM workspace_memberships (line 184-187) — conditional: only runs when session.workspace_id is set AND user is not super-admin
  - UPDATE sessions SET last_activity (line 205-208)

  That's 2-3 pool checkouts before the route handler even runs (the membership check is conditional). A route like projects list adds another 1-2 queries. So each request needs ~3-5 connections sequentially.

  With 20 connections and each request holding a connection for ~50ms per query, you can serve roughly 100 concurrent requests/second. At 10x users, page loads alone (which fire 3-5 parallel API calls) would
  saturate the pool. You'd see connectionTimeoutMillis: 2000 errors cascading across the app — every route fails simultaneously.

  Fix: Increase pool to 50-100, or better: cache sessions in Redis so auth doesn't hit PG on every request.

  ---
  2. WebSocket server becomes a single-process bottleneck

  api/src/collaboration/index.ts — All state is in-process Maps:

  docs        = new Map()     // line 89 — every open document's full Yjs state in RAM
  awareness   = new Map()     // line 90
  conns       = new Map()     // line 91 — linear scan on every update broadcast
  eventConns  = new Map()     // line 95

  At 10x users:
  - Memory: Each Y.Doc holds the full document CRDT. 200 concurrent docs × ~500KB average = 100MB just in Yjs state. Add awareness, buffers, and Node overhead → OOM risk on a small EB instance.
  - Broadcast is O(N): Every keystroke iterates conns.forEach() (line 271-275) to find connections in the same room. With 2000 total connections, each keystroke scans all 2000 even if only 3 are in the room.
  - Can't horizontally scale: All state is in-memory on one process. You can't add a second server without losing sync. No Redis pub/sub or shared state layer exists.
  - Session validation per WebSocket connect (line 356-392) hits the database — a reconnection storm (e.g., deploy) means hundreds of simultaneous DB queries just for auth.

  Fix: Add a Map<docName, Set<WebSocket>> index to make broadcast O(room size). For horizontal scaling, add Redis pub/sub for cross-process sync. Move Yjs persistence to a dedicated worker.

  ---
  3. Polling multiplied by user count

  Every connected browser runs these timers:

  ┌─────────────────────────┬──────────────────────────┬────────────────────────┐
  │          Hook           │         Interval         │      Per user/min      │
  ├─────────────────────────┼──────────────────────────┼────────────────────────┤
  │ useActionItemsQuery     │ 60s poll                 │ 1 req                  │
  ├─────────────────────────┼──────────────────────────┼────────────────────────┤
  │ useStandupStatusQuery   │ 5min poll                │ 0.2 req                │
  ├─────────────────────────┼──────────────────────────┼────────────────────────┤
  │ useDocumentsQuery       │ refetchOnMount: 'always' │ ~3-5 req (navigations) │
  ├─────────────────────────┼──────────────────────────┼────────────────────────┤
  │ useDocumentContextQuery │ refetchOnMount: 'always' │ ~2-3 req               │
  └─────────────────────────┴──────────────────────────┴────────────────────────┘

  At current scale (~50 users): ~300 background requests/min. At 10x (~500 users): ~3,000 background requests/min just from polling — before any intentional user actions.