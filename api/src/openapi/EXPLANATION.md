# api/src/openapi/

OpenAPI specification generation from Zod schemas using `zod-to-openapi`.

## Files

- **index.ts** -- Entry point that imports all schema registrations and re-exports the registry and document generator.
- **registry.ts** -- Creates the central OpenAPI registry, registers Bearer and cookie security schemes, and generates the complete OpenAPI 3.0 document with API metadata.

## Directories

- **schemas/** -- Per-resource Zod schema definitions that register with the OpenAPI registry.
