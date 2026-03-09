# api/src/mcp/

Model Context Protocol server for LLM tool integration.

## Files

- **server.ts** -- Implements an MCP server that auto-generates tools from Ship's OpenAPI spec, allowing LLMs (like Claude) to call Ship API endpoints via Bearer token authentication over stdio transport.
