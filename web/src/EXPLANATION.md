# web/src/

Frontend source code.

## Files

- **main.tsx** -- Application entry point: renders the React app with providers (QueryClient, ToastProvider, TooltipProvider) into the DOM.
- **index.css** -- Global CSS with Tailwind directives and custom utility classes.
- **vite-env.d.ts** -- Vite environment type declarations.

## Directories

- **pages/** -- Top-level route page components.
- **components/** -- Reusable UI components, editor extensions, sidebars, and dialogs.
- **hooks/** -- Custom React hooks for data fetching, auth, selection, and real-time events.
- **contexts/** -- React context providers for global state (auth, workspace, documents).
- **lib/** -- Utility functions, API client, date helpers, and configuration.
- **services/** -- File upload services and tracking.
- **styles/** -- Style-related test files.
- **test/** -- Test setup and configuration.
