# web/

React + Vite frontend with TipTap rich text editing and real-time collaboration.

## Files

- **package.json** -- Package config with dependencies (React, TipTap, Yjs, TanStack Query, Tailwind, Radix UI).
- **tsconfig.json** -- TypeScript configuration for the web package.
- **vite.config.ts** -- Vite bundler configuration with proxy setup for API requests.
- **vitest.config.ts** -- Vitest test runner configuration for web unit tests.
- **index.html** -- HTML entry point that loads the React app.
- **tailwind.config.js** -- Tailwind CSS configuration with custom colors and design tokens.
- **postcss.config.js** -- PostCSS configuration (Tailwind + autoprefixer).

## Directories

- **src/** -- All frontend source code.
- **public/** -- Static assets served directly (icons, manifest, robots.txt).
- **scripts/** -- Build-time code generation scripts.
- **dev-dist/** -- Service worker files for PWA support.
