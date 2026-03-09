# api/src/utils/

Shared utility functions used across the API.

## Files

- **allocation.ts** -- Determines a person's project allocations for a sprint by combining explicit assignee_ids with issue-based inference.
- **business-days.ts** -- Business day calculations (checking, adding, counting) excluding weekends and US federal holidays for 2025-2026.
- **document-content.ts** -- Helpers to extract text from TipTap JSON and determine if a document has meaningful content beyond template headings.
- **document-crud.ts** -- Shared document operations: change history logging, state-transition timestamps, association CRUD, batch queries, and field history retrieval.
- **extractHypothesis.ts** -- Extracts structured sections (Hypothesis, Success Criteria, Vision, Goals) from TipTap JSON by locating H2 headings.
- **transformIssueLinks.ts** -- Transforms issue reference patterns (#123, ISS-123) in TipTap JSON into clickable link marks by looking up ticket numbers.
- **yjsConverter.ts** -- Bidirectional converter between Yjs XmlFragment format and TipTap/ProseMirror JSON format for collaboration ↔ REST API interop.

## Directories

- **__tests__/** -- Unit tests for utility functions.
