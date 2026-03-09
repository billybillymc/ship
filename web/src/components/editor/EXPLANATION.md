# web/src/components/editor/

TipTap editor extensions and node views. These extend the rich text editor with custom block types, marks, and interactive features.

## Extensions (TipTap Plugins)

- **SlashCommands.tsx** -- Slash command menu (`/`) for inserting blocks (headings, lists, code, images, files, tables, toggles, TOC, plan blocks, sub-documents).
- **CommentMark.ts** -- Inline comment annotation mark with Cmd+Shift+M shortcut, supporting overlapping comments.
- **DetailsExtension.ts** -- Collapsible toggle/accordion blocks with editable summary and expandable content.
- **EmojiExtension.ts** -- Emoji insertion via `:shortcode:` syntax with a suggestion popup.
- **MentionExtension.ts** -- `@` mentions for people and documents, fetching suggestions from the API.
- **ImageUpload.tsx** -- Image paste/drag-and-drop with immediate data URL preview, background CDN upload, and URL swap.
- **FileAttachment.tsx** -- Non-image file attachments (PDF, DOCX, etc.) with upload progress and type/size validation.
- **DragHandle.tsx** -- Drag handle (grip dots) for block-level drag-and-drop reordering.
- **ResizableImage.tsx** -- Image node with draggable resize handle for interactive width adjustment.
- **PlanReferenceBlock.ts** -- Non-editable block in retro documents storing the original plan item text.
- **HypothesisBlockExtension.ts** -- Custom block for structured plan/hypothesis content.

## Node View Components (React renderers for extensions)

- **DetailsComponent.tsx** -- Renders toggle blocks with clickable arrow and expand/collapse animation.
- **DocumentEmbed.tsx** -- Renders embedded document links as clickable cards with icons and titles.
- **HypothesisBlockComponent.tsx** -- Renders plan callout blocks with amber border and lightbulb icon.
- **PlanReferenceBlockComponent.tsx** -- Renders plan reference blocks as styled read-only cards.
- **MentionNodeView.tsx** -- Renders inline mentions with archived status detection.
- **MentionList.tsx** -- Dropdown for the `@` mention popup with "People" and "Documents" sections.
- **EmojiList.tsx** -- Dropdown for the emoji picker popup with keyboard navigation.
- **CommentDisplay.tsx** -- Inline comment threads below commented text with reply/resolve support.

## Panels & Displays

- **TableOfContents.tsx** -- Live table of contents scanning headings with clickable links.
- **BacklinksPanel.tsx** -- Displays documents that reference the current document.
- **AIScoringDisplay.tsx** -- Inline AI quality feedback as widget decorations after plan/retro items.

## Test Files

- **DetailsExtension.test.ts**, **DragHandle.test.ts**, **FileAttachment.test.ts**, **ImageUpload.test.ts**, **MentionExtension.test.ts**, **TableOfContents.test.ts** -- Unit tests for editor extensions.
