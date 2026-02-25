# Data Models

All interfaces and types for InfoNugget v6.0. Primary source files: `types.ts` and `utils/storage/StorageBackend.ts`.

---

## Runtime Types (types.ts)

### `Palette`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** Five-color palette specification used as the color system for infographic card generation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `background` | `string` | Yes | Hex color code for card background |
| `primary` | `string` | Yes | Hex color code for primary UI elements and titles |
| `secondary` | `string` | Yes | Hex color code for secondary elements |
| `accent` | `string` | Yes | Hex color code for highlight/accent elements |
| `text` | `string` | Yes | Hex color code for body text |

**Relationships:** Embedded in `StylingOptions`, `CustomStyle`, and the `VISUAL_STYLES` constant in `utils/ai.ts`. Each of the 15 built-in visual styles has a corresponding `Palette`.

---

### `FontPair`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** Title and body font family pair used across card image generation prompts.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `primary` | `string` | Yes | Title font — Google Fonts family name |
| `secondary` | `string` | Yes | Body font — Google Fonts family name |

**Relationships:** Embedded in `StylingOptions` and `CustomStyle`. Each built-in style has a corresponding `FontPair` in `STYLE_FONTS` in `utils/ai.ts`. Font names are converted to visual descriptors by `fontToDescriptor()` in `utils/prompts/promptUtils.ts` before being sent to image generation models.

---

### `CustomStyle`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** User-created visual style that supplements the 15 built-in styles. Stored globally (not per-nugget) in IndexedDB via the `appState` store.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier (random string) |
| `name` | `string` | Yes | Display name; must not duplicate a built-in style name |
| `palette` | `Palette` | Yes | Five-color palette |
| `fonts` | `FontPair` | Yes | Title and body fonts |
| `identity` | `string` | Yes | 40–80 word visual identity description used in image generation prompts |
| `createdAt` | `number` | Yes | Epoch milliseconds |
| `lastModifiedAt` | `number` | Yes | Epoch milliseconds |

**Relationships:** Stored in `InitialPersistedState.customStyles`. Registered at runtime into `VISUAL_STYLES`, `STYLE_FONTS`, and `STYLE_IDENTITIES` maps via `registerCustomStyles()` in `utils/ai.ts`. Referenced by name in `StylingOptions.style`.

---

### `StylingOptions`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** Complete visual style configuration for a card generation request. Stored per-nugget and used as the active generation toolbar state.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `levelOfDetail` | `DetailLevel` | Yes | The card content detail level (Executive, Standard, etc.) |
| `style` | `string` | Yes | Style name — one of 15 built-in names or a custom style name |
| `palette` | `Palette` | Yes | Active color palette (matches the named style or is overridden) |
| `fonts` | `FontPair` | Yes | Active font pair |
| `aspectRatio` | `'1:1' \| '2:3' \| '3:2' \| '3:4' \| '4:3' \| '4:5' \| '5:4' \| '9:16' \| '16:9' \| '21:9'` | Yes | Output image aspect ratio |
| `resolution` | `'1K' \| '2K' \| '4K'` | Yes | Output image resolution |

**Relationships:** Stored in `Nugget.stylingOptions`. Referenced as `settings` on legacy `Card` objects (deprecated). Used to configure all three phases of the card generation pipeline. `detectSettingsMismatch()` in `utils/ai.ts` compares two `StylingOptions` instances for style-anchoring purposes.

---

### `DetailLevel`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** Union type controlling the content verbosity and prompt strategy for card synthesis and image generation.

```ts
type DetailLevel = 'Executive' | 'Standard' | 'Detailed' | 'TitleCard' | 'TakeawayCard' | 'DirectContent';
```

| Value | Category | Max Synthesis Tokens | Word Target | Description |
|-------|----------|---------------------|-------------|-------------|
| `Executive` | Content | 300 | 70–100 words | High-density summary; fewest words, sharpest insights |
| `Standard` | Content | 600 | 200–250 words | Balanced detail level; default for most cards |
| `Detailed` | Content | 1200 | 450–500 words | Full elaboration with supporting data |
| `TitleCard` | Cover | 256 | ~50 words | Cover slide with title, subtitle, and tagline; no narrative |
| `TakeawayCard` | Cover | 350 | ~80 words | Closing card with key conclusions |
| `DirectContent` | Content | — | — | No AI synthesis; raw markdown is passed directly to the image pipeline |

`isCoverLevel(level)` returns `true` for `TitleCard` and `TakeawayCard`.
Cover levels use dedicated prompt builders: `buildCoverContentPrompt()`, `buildCoverPlannerPrompt()`, `buildCoverVisualizerPrompt()` in `utils/prompts/coverGeneration.ts`.

---

### `ReferenceImage`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** A user-uploaded reference image paired with styling configuration, used to style-anchor infographic card generation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | `string` | Yes | Data URL or blob URL of the reference image |
| `settings` | `StylingOptions` | Yes | Styling options that were active when the reference was captured |

**Relationships:** Passed to `useCardGeneration` hook. When `useReferenceImage` is `true`, the reference image is included as an `inlineData` part in the Gemini image generation request.

---

### `Heading`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** A single heading extracted from a document's markdown structure or from a native PDF via Gemini. Forms the table-of-contents hierarchy for a document.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `level` | `number` | Yes | Heading level 1–6 (matching H1–H6) |
| `text` | `string` | Yes | Heading text content |
| `id` | `string` | Yes | Unique identifier (generated at parse time) |
| `selected` | `boolean` | No | UI selection state for card creation |
| `startIndex` | `number` | No | Character offset in the markdown string where this heading begins |
| `page` | `number` | No | Page number where this heading appears (native PDFs only) |

**Relationships:** Stored in `UploadedFile.structure`. Serialized to `StoredNuggetDocument.structure` in IndexedDB. Used by `buildNativePdfSectionHint()` to tell Claude which pages to focus on. The MetaTOC system (`utils/metaToc.ts`) encodes `Heading[]` as a markdown file uploaded to the Anthropic Files API.

---

### `ImageVersion`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** A single entry in a card's image version history, tracking each generated or modified image for a specific detail level.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `imageUrl` | `string` | Yes | Blob URL or data URL of the image |
| `timestamp` | `number` | Yes | Epoch milliseconds when this version was created |
| `label` | `string` | Yes | Human-readable label: "Original", "Generation 1", "Modification 1", etc. |

**Relationships:** Stored in `Card.imageHistoryMap[DetailLevel]`. Capped at 10 versions per card per level (oldest entries removed). Serialized to `StoredImage.imageHistory` as `StoredImageVersion` (with blob URLs converted to data URLs before IndexedDB storage).

---

### `AnnotationTool`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** Union type for the active tool in the annotation workbench.

```ts
type AnnotationTool = 'select' | 'pin' | 'arrow' | 'rectangle' | 'sketch' | 'text' | 'zoom';
```

| Value | Description |
|-------|-------------|
| `select` | Selection/move tool for existing annotations |
| `pin` | Place a point pin with an instruction label |
| `arrow` | Draw a directed arrow between two points |
| `rectangle` | Draw a bounding rectangle with an instruction label |
| `sketch` | Freehand stroke for area highlighting |
| `text` | Text annotation tool |
| `zoom` | Zoom/pan the image without placing annotations |

**Relationships:** Used as state in `ZoomOverlay` and `AnnotationWorkbench` components. Controls which annotation type is created on mouse interaction.

---

### `PinAnnotation`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** A point annotation with an instruction string, placed at a normalized coordinate on the card image.

Extends `BaseAnnotation` (`{ id: string; type: AnnotationType; color: string; createdAt: number }`).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `type` | `'pin'` | Yes | Discriminant literal |
| `color` | `string` | Yes | Hex color for the pin marker |
| `createdAt` | `number` | Yes | Epoch milliseconds |
| `position` | `NormalizedPoint` | Yes | `{ x: number, y: number }` in 0.0–1.0 normalized coordinates |
| `instruction` | `string` | Yes | User instruction text fed to the image modification engine |

**Relationships:** One of four variants of the `Annotation` union type. Passed to `executeModification()` in `utils/modificationEngine.ts` to regenerate the image with the annotation's instruction applied.

---

### `RectangleAnnotation`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** A bounding rectangle annotation with an instruction string.

Extends `BaseAnnotation`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `type` | `'rectangle'` | Yes | Discriminant literal |
| `color` | `string` | Yes | Hex color for the rectangle stroke |
| `createdAt` | `number` | Yes | Epoch milliseconds |
| `topLeft` | `NormalizedPoint` | Yes | Top-left corner in normalized coordinates |
| `bottomRight` | `NormalizedPoint` | Yes | Bottom-right corner in normalized coordinates |
| `instruction` | `string` | Yes | User instruction for this region |

---

### `ArrowAnnotation`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** A directed arrow annotation indicating a relationship or direction change in the image.

Extends `BaseAnnotation`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `type` | `'arrow'` | Yes | Discriminant literal |
| `color` | `string` | Yes | Hex color for the arrow |
| `createdAt` | `number` | Yes | Epoch milliseconds |
| `start` | `NormalizedPoint` | Yes | Arrow origin in normalized coordinates |
| `end` | `NormalizedPoint` | Yes | Arrow destination in normalized coordinates |
| `instruction` | `string` | Yes | User instruction describing the desired change |

---

### `SketchAnnotation`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** A freehand stroke annotation for highlighting areas on the image.

Extends `BaseAnnotation`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `type` | `'sketch'` | Yes | Discriminant literal |
| `color` | `string` | Yes | Hex color for the stroke |
| `createdAt` | `number` | Yes | Epoch milliseconds |
| `points` | `NormalizedPoint[]` | Yes | Ordered array of stroke points in normalized coordinates |
| `strokeWidth` | `number` | Yes | Normalized stroke width; thick brush for area highlighting |
| `instruction` | `string` | Yes | User instruction for the highlighted area |

---

### `Card`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** The primary creative unit. Represents one infographic card within a nugget, keyed to a heading. Holds AI-generated content, generated images, and version history across multiple detail levels.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier (random string) |
| `level` | `number` | Yes | Heading level of this card (1–6, mirrors the source heading) |
| `text` | `string` | Yes | Card title (the heading text) |
| `selected` | `boolean` | No | Whether this card is selected in the UI for batch operations |
| `detailLevel` | `DetailLevel` | No | The detail level currently active for this card |
| `settings` | `StylingOptions` | No | **Deprecated.** Retained for backward-compatible deserialization. Use `detailLevel` instead. |
| `synthesisMap` | `Partial<Record<DetailLevel, string>>` | No | Cached AI-synthesized content per detail level (markdown string) |
| `isSynthesizingMap` | `Partial<Record<DetailLevel, boolean>>` | No | Runtime-only flag tracking in-progress synthesis per level; never persisted |
| `isGeneratingMap` | `Partial<Record<DetailLevel, boolean>>` | No | Runtime-only flag tracking in-progress image generation per level; never persisted |
| `startIndex` | `number` | No | Character offset in source markdown; not persisted |
| `cardUrlMap` | `Partial<Record<DetailLevel, string>>` | No | Generated card image as data URL or blob URL, per detail level |
| `imageHistoryMap` | `Partial<Record<DetailLevel, ImageVersion[]>>` | No | Version history of generated images, per detail level; capped at 10 entries |
| `visualPlanMap` | `Partial<Record<DetailLevel, string>>` | No | Cached visual layout plan (prose or JSON) output by the planner step, per level |
| `lastGeneratedContentMap` | `Partial<Record<DetailLevel, string>>` | No | Snapshot of the synthesis content at the moment the image was generated, per level; used for dirty detection |
| `lastPromptMap` | `Partial<Record<DetailLevel, string>>` | No | Full visualizer prompt used to generate the most recent image, per level |
| `createdAt` | `number` | No | Epoch milliseconds |
| `lastEditedAt` | `number` | No | Epoch milliseconds of the last content edit |
| `sourceDocuments` | `string[]` | No | Names of documents that were enabled when this card was created |
| `autoDeckSessionId` | `string` | No | Links this card to the `AutoDeckSession` that created it |

**Serialization:** `isSynthesizingMap`, `isGeneratingMap`, `startIndex`, `cardUrlMap`, and `imageHistoryMap` are excluded from `StoredHeading`. Images are extracted separately via `extractImages()` and stored in the `nuggetImages` IndexedDB store as Blobs.

**Relationships:** Contained in `Nugget.cards[]`. Keyed to a `Heading` by heading text. `autoDeckSessionId` links back to `AutoDeckSession.id`.

---

### `SourceOrigin`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** Provenance record for how a document arrived in a nugget.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `'uploaded' \| 'copied' \| 'moved'` | Yes | How the document arrived |
| `sourceProjectName` | `string` | No | For `copied`/`moved`: name of the originating project |
| `sourceNuggetName` | `string` | No | For `copied`/`moved`: name of the originating nugget |
| `timestamp` | `number` | Yes | Epoch milliseconds when the origin event occurred |

**Relationships:** Embedded in `UploadedFile.sourceOrigin` and serialized into `StoredNuggetDocument.sourceOrigin`.

---

### `UploadedFile`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** A document owned by a nugget. Can be a markdown file (with `content`), a PDF converted to markdown, or a native PDF (with `pdfBase64`). Files uploaded to the Anthropic Files API are referenced by `fileId`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `name` | `string` | Yes | Display name (may be renamed from `originalName`) |
| `size` | `number` | Yes | File size in bytes |
| `type` | `string` | Yes | MIME type (`text/markdown`, `application/pdf`, `text/plain`) |
| `lastModified` | `number` | Yes | File system last-modified timestamp (epoch ms) |
| `content` | `string` | No | Markdown text content; present for markdown and converted-PDF documents |
| `structure` | `Heading[]` | No | Parsed heading hierarchy; present for markdown docs and native PDFs with extracted TOC |
| `status` | `'uploading' \| 'processing' \| 'ready' \| 'error'` | Yes | Current lifecycle state |
| `progress` | `number` | Yes | Upload/processing progress 0–100 |
| `enabled` | `boolean` | No | Whether this document is included in AI chat context; defaults to `true` when `undefined`; not persisted to IndexedDB |
| `fileId` | `string` | No | Anthropic Files API file ID; used to reference the document in Claude calls without re-uploading |
| `metaTocFileId` | `string` | No | Anthropic Files API file ID for the companion MetaTOC file (native PDFs only) |
| `sourceType` | `'markdown' \| 'native-pdf'` | No | Storage and rendering mode; `undefined` is treated as `'markdown'` for backward compatibility |
| `pdfBase64` | `string` | No | Raw PDF encoded as base64; only present for `sourceType: 'native-pdf'` documents |
| `tocSource` | `'toc_page' \| 'visual_scan'` | No | How the heading structure was extracted: from an explicit TOC page or by visual scanning |
| `originalFormat` | `'md' \| 'pdf'` | No | Original file format before any conversion |
| `createdAt` | `number` | No | Epoch milliseconds when this document was added to the nugget |
| `lastEditedAt` | `number` | No | Epoch milliseconds when the document content was last saved via the editor |
| `lastRenamedAt` | `number` | No | Epoch milliseconds of the last rename |
| `originalName` | `string` | No | File name at upload time; never changes |
| `sourceOrigin` | `SourceOrigin` | No | Provenance record |
| `version` | `number` | No | Version counter; increments on rename or content edit |
| `lastEnabledAt` | `number` | No | Epoch milliseconds when this document was last enabled in chat context |
| `lastDisabledAt` | `number` | No | Epoch milliseconds when this document was last disabled from chat context |

**Relationships:** Contained in `Nugget.documents[]`. Serialized to `StoredNuggetDocument` for IndexedDB. The `fileId` is used in `callClaude()` via `document` content blocks of `type: 'file'`. When `metaTocFileId` is present, it is also sent as a companion `document` block in chat calls.

---

### `ChatMessage`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** A single message in a nugget's chat conversation with Claude.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier (random string) |
| `role` | `'user' \| 'assistant' \| 'system'` | Yes | Message author role |
| `content` | `string` | Yes | Message text (markdown for assistant messages) |
| `timestamp` | `number` | Yes | Epoch milliseconds |
| `isCardContent` | `boolean` | No | `true` if this assistant message was a card generation response |
| `detailLevel` | `DetailLevel` | No | The detail level that was requested when generating card content |
| `savedAsCardId` | `string` | No | If the user saved this message as a card, the card's `id` |

**Relationships:** Stored in `Nugget.messages[]` and `StoredNugget.messages`. System-role messages are injected by `handleDocChangeContinue()` in `useInsightsLab.ts` to notify Claude of document set changes; they are not sent to the Claude API (the doc change summary is injected as a user-message prefix instead). The full message array is sent to Claude as multi-turn `ClaudeMessage[]` via `pruneMessages()`.

---

### `DocChangeEvent`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** A record of a single document mutation for change-notification purposes in the chat interface.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `DocChangeEventType` | Yes | One of: `'added'`, `'removed'`, `'renamed'`, `'enabled'`, `'disabled'`, `'updated'`, `'toc_updated'` |
| `docId` | `string` | Yes | The document's `id` |
| `docName` | `string` | Yes | The document's name at the time of the event (post-rename for rename events) |
| `oldName` | `string` | No | Previous name; only present for `'renamed'` events |
| `timestamp` | `number` | Yes | Epoch milliseconds |

**Relationships:** Stored in `Nugget.docChangeLog[]`. `Nugget.lastDocChangeSyncIndex` marks how many events have been acknowledged by the chat agent. Events past the sync index are "pending" and trigger the document change notification UI in `ChatPanel`.

---

### `Nugget`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** The central container. Each nugget owns its documents, cards, and chat conversation. All AI operations run in the context of a specific nugget.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `name` | `string` | Yes | Display name |
| `type` | `NuggetType` (`'insights'`) | Yes | Currently only `'insights'`; value `'synthesis'` is migrated to `'insights'` on load |
| `documents` | `UploadedFile[]` | Yes | Per-nugget document collection |
| `cards` | `Card[]` | Yes | Infographic cards; ordered list |
| `messages` | `ChatMessage[]` | No | Chat conversation history |
| `lastDocHash` | `string` | No | djb2 hash of active documents at the time of the last API call; used for change detection in `useInsightsLab` |
| `docChangeLog` | `DocChangeEvent[]` | No | Ordered log of document mutations for change notification |
| `lastDocChangeSyncIndex` | `number` | No | Index into `docChangeLog` marking the last event acknowledged by the chat agent |
| `subject` | `string` | No | AI-generated 15–30 word expert priming sentence; user-editable; injected into all prompts for expert framing |
| `stylingOptions` | `StylingOptions` | No | Per-nugget styling preferences for the generation toolbar; persisted to IndexedDB |
| `createdAt` | `number` | Yes | Epoch milliseconds |
| `lastModifiedAt` | `number` | Yes | Epoch milliseconds |

**Relationships:** Contained in `Project.nuggetIds[]` (by ID). Cards are serialized to `StoredHeading[]` in `nuggetHeadings` store. Documents are serialized to `StoredNuggetDocument[]` in `nuggetDocuments` store. Messages are serialized inline in `StoredNugget`.

---

### `Project`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** An organizational container that groups nuggets. Projects appear in the Projects panel and are created/renamed/deleted by the user.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `name` | `string` | Yes | Display name |
| `description` | `string` | No | Optional text description |
| `nuggetIds` | `string[]` | Yes | Ordered list of nugget IDs belonging to this project |
| `isCollapsed` | `boolean` | No | UI collapse state in the Projects panel |
| `createdAt` | `number` | Yes | Epoch milliseconds |
| `lastModifiedAt` | `number` | Yes | Epoch milliseconds |

**Relationships:** Each `Project` holds references to `Nugget` objects by ID. Serialized to `StoredProject` in the `projects` IndexedDB store.

---

### `AutoDeckBriefing`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** The user's configuration input for an Auto-Deck run. Defines audience, presentation type, objective, and optional card count constraints.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audience` | `string` | Yes | Who will view the deck (max 100 chars) |
| `type` | `string` | Yes | Presentation type (educational, pitch, etc.) (max 80 chars) |
| `objective` | `string` | Yes | What the audience should take away (max 150 chars) |
| `tone` | `string` | No | How the deck should sound (max 80 chars) |
| `focus` | `string` | No | What to prioritize from the documents (max 120 chars) |
| `minCards` | `number` | No | Minimum card count constraint |
| `maxCards` | `number` | No | Maximum card count constraint |
| `includeCover` | `boolean` | No | Whether to add a cover/title card |
| `includeSectionTitles` | `boolean` | No | Whether to add title cards for main sections |
| `includeClosing` | `boolean` | No | Whether to add a closing takeaway/conclusion card |

**Relationships:** Stored in `AutoDeckSession.briefing`. Passed to `buildPlannerPrompt()` in `utils/prompts/autoDeckPlanner.ts`.

---

### `AutoDeckLod`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** Level-of-detail configuration for Auto-Deck card content.

```ts
type AutoDeckLod = 'executive' | 'standard' | 'detailed';
```

| Value | Corresponding `DetailLevel` | Word Count Range | Description |
|-------|----------------------------|-----------------|-------------|
| `executive` | `Executive` | 70–100 words | High-density summary cards |
| `standard` | `Standard` | 200–250 words | Balanced detail; default |
| `detailed` | `Detailed` | 450–500 words | Full elaboration cards |

LOD configurations (word count ranges, max tokens, `detailLevel` mapping) are defined in `utils/autoDeck/constants.ts` as `AUTO_DECK_LOD_LEVELS`.

---

### `AutoDeckStatus`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** State machine values for an `AutoDeckSession`.

```ts
type AutoDeckStatus = 'configuring' | 'planning' | 'conflict' | 'reviewing' | 'revising' | 'finalizing' | 'producing' | 'complete' | 'error';
```

| Value | Description |
|-------|-------------|
| `configuring` | User is filling out the briefing form |
| `planning` | Claude Planner is processing documents to generate a card plan |
| `conflict` | Planner detected conflicting information across documents; user must resolve |
| `reviewing` | Planner returned a plan; user is reviewing card list and MCQ answers |
| `revising` | User requested changes; Claude Planner is re-running with feedback |
| `finalizing` | Claude Finalizer is incorporating MCQ answers into the plan |
| `producing` | Claude Producer is writing content for each card |
| `complete` | All cards have been created and added to the nugget |
| `error` | A fatal error occurred; `AutoDeckSession.error` holds the message |

---

### `PlannedCard`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** A single card as planned by the Auto-Deck Planner agent. Includes source attribution, word targets, key data points, and writing guidance for the Producer.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `number` | `number` | Yes | Card number within the plan (1-based) |
| `title` | `string` | Yes | Proposed card title |
| `description` | `string` | Yes | Brief description of card content |
| `sources` | `object[]` | Yes | Source attribution entries; each has `document: string`, optional `heading: string` (exact heading text), optional `fallbackDescription: string`, and legacy `section?: string` |
| `wordTarget` | `number` | No | Target word count within the LOD range, assigned by the planner |
| `keyDataPoints` | `string[]` | No | Verbatim quotes or figures from sources that must appear in the card |
| `guidance` | `string \| { emphasis: string; tone: string; exclude: string }` | Yes | Content writer instructions; either a legacy string or a structured object |
| `crossReferences` | `string \| null` | No | References to other cards this card relates to |

**Relationships:** Contained in `ParsedPlan.cards[]`, which is stored in `AutoDeckSession.parsedPlan`. Passed to `buildProducerPrompt()` for content generation.

---

### `PlanQuestion`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** A multiple-choice question generated by the Planner agent for the user to answer before content production. Each option carries a `producerInstruction` injected verbatim into the Producer prompt.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Question identifier (e.g., `"q1"`, `"q2"`) |
| `question` | `string` | Yes | Question text displayed to the user |
| `options` | `PlanQuestionOption[]` | Yes | Available answers; each has `key: string`, `label: string`, `producerInstruction: string` |
| `recommendedKey` | `string` | Yes | The option key the Planner recommends |
| `context` | `string` | No | Brief context explaining why this question matters |

**Relationships:** Contained in `ParsedPlan.questions[]`. User answers are stored in `ReviewState.questionAnswers` (map of `questionId → optionKey`). Answers are passed to `buildFinalizerPrompt()` in `utils/prompts/autoDeckPlanner.ts`.

---

### `ConflictItem`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** A detected contradiction between two documents, surfaced by the Planner before review.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | Yes | Human-readable description of the conflict |
| `sourceA` | `{ document: string; section: string }` | Yes | First conflicting source location |
| `sourceB` | `{ document: string; section: string }` | Yes | Second conflicting source location |
| `severity` | `'high' \| 'medium' \| 'low'` | Yes | Conflict severity |

**Relationships:** Stored in `AutoDeckSession.conflicts[]`. When `parsePlannerResponse()` detects `status === 'conflict'`, the session transitions to `'conflict'` status and the `ConflictItem[]` is displayed to the user.

---

### `ReviewCardState`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** Per-card review inclusion state during the Auto-Deck review phase.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `included` | `boolean` | Yes | Whether this card is included in production; user can toggle |

**Relationships:** Values stored in `ReviewState.cardStates` (keyed by card number). Cards with `included: false` are filtered out before the finalizer and producer steps.

---

### `ReviewState`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** The complete user review state for an Auto-Deck session.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `generalComment` | `string` | Yes | Free-text feedback from the user passed to the Planner on revision |
| `cardStates` | `Record<number, ReviewCardState>` | Yes | Per-card inclusion states, keyed by card number |
| `questionAnswers` | `Record<string, string>` | Yes | MCQ answers, maps `questionId → selectedOptionKey` |
| `decision` | `'pending' \| 'approved' \| 'revise'` | Yes | User's final decision on the plan |

**Relationships:** Stored in `AutoDeckSession.reviewState`. Populated by `toggleCardIncluded()`, `setQuestionAnswer()`, `setGeneralComment()`, and `setAllRecommended()` helpers in `useAutoDeck.ts`.

---

### `AutoDeckSession`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** The complete state of one Auto-Deck run, from briefing through card creation. Held in `useAutoDeck` hook local state (not persisted to IndexedDB).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique session identifier (format: `autodeck-{timestamp}-{random}`) |
| `nuggetId` | `string` | Yes | ID of the nugget this session operates on |
| `briefing` | `AutoDeckBriefing` | Yes | User's briefing configuration |
| `lod` | `AutoDeckLod` | Yes | Chosen level of detail |
| `orderedDocIds` | `string[]` | Yes | User-ordered document IDs selected for this run; preserved across revisions |
| `status` | `AutoDeckStatus` | Yes | Current state machine position |
| `parsedPlan` | `ParsedPlan \| null` | Yes | Planner output after a successful plan; `null` until planning completes |
| `conflicts` | `ConflictItem[] \| null` | Yes | Conflicts detected by the Planner; `null` if none |
| `reviewState` | `ReviewState \| null` | Yes | User's review decisions; `null` until planning completes |
| `producedCards` | `{ number: number; title: string; content: string; wordCount: number }[]` | Yes | Cards as returned by the Producer, before `Card` object creation |
| `revisionCount` | `number` | Yes | Number of revision cycles completed |
| `error` | `string \| null` | Yes | Error message when `status === 'error'`; `null` otherwise |
| `createdAt` | `number` | Yes | Epoch milliseconds |

**Relationships:** Created and managed by `useAutoDeck.ts`. `orderedDocIds` references `UploadedFile.id` values within `selectedNugget.documents`. Completed cards are created as `Card` objects and appended to `Nugget.cards` via `updateNugget()`.

---

### `ParsedPlan`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** Structured output of the Auto-Deck Planner agent, parsed from Claude's JSON response by `parsePlannerResponse()` in `utils/autoDeck/parsers.ts`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `metadata.category` | `string` | Yes | Content category label |
| `metadata.lod` | `AutoDeckLod` | Yes | LOD as echoed by the planner |
| `metadata.sourceWordCount` | `number` | Yes | Total word count of input documents |
| `metadata.cardCount` | `number` | Yes | Number of planned cards |
| `metadata.documentStrategy` | `'dissolve' \| 'preserve' \| 'hybrid'` | Yes | How the planner handled multiple documents |
| `metadata.documentRelationships` | `string` | Yes | Prose description of how documents relate |
| `cards` | `PlannedCard[]` | Yes | Ordered list of planned cards |
| `questions` | `PlanQuestion[]` | No | Decision-point MCQs for user review |

**Relationships:** Stored in `AutoDeckSession.parsedPlan`. Filtered to `includedCards` before being passed to the Finalizer and Producer.

---

### `InitialPersistedState`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\types.ts`
**Purpose:** The full application state as hydrated from IndexedDB on startup. Passed to `AppProvider` as `initialState`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nuggets` | `Nugget[]` | Yes | All nuggets |
| `projects` | `Project[]` | Yes | All projects |
| `selectedNuggetId` | `string \| null` | Yes | Last selected nugget (from `appState` store) |
| `activeCardId` | `string \| null` | Yes | Last active card (from `appState` store) |
| `workflowMode` | `WorkflowMode` (`'insights'`) | Yes | Always `'insights'` (only one mode exists) |
| `insightsSession` | `InsightsSession \| null` | Yes | Legacy insights session data (backward compat shim) |
| `tokenUsageTotals` | `Record<string, number>` | No | Accumulated token usage across all AI providers |
| `customStyles` | `CustomStyle[]` | No | User-created custom styles (global, not per-nugget) |

**Relationships:** Produced by `hydrateFromStorage()` in `components/StorageProvider.tsx`. Consumed by `AppProvider` in `context/AppContext.tsx` to initialize global React state.

---

## Stored Types (utils/storage/StorageBackend.ts)

These types represent the serialized form of runtime data as it is written to IndexedDB. They differ from their runtime counterparts primarily in that transient fields (generating flags, blob URLs) are excluded and images are stored separately.

---

### `StoredHeading`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\utils\storage\StorageBackend.ts`
**Purpose:** Serialized form of a `Card` for the `nuggetHeadings` object store. Images are separated out into `nuggetImages`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fileId` | `string` | Yes | The parent nugget's ID (used as the store key prefix and index value for `byNugget`) |
| `headingId` | `string` | Yes | The card's `id` (used as the store key suffix) |
| `level` | `number` | Yes | Heading level 1–6 |
| `text` | `string` | Yes | Card title |
| `selected` | `boolean` | No | Selection state |
| `detailLevel` | `DetailLevel` | No | Active detail level |
| `settings` | `StylingOptions` | No | Legacy deprecated field |
| `synthesisMap` | `Partial<Record<DetailLevel, string>>` | No | Synthesis content per level |
| `visualPlanMap` | `Partial<Record<DetailLevel, string>>` | No | Visual plans per level |
| `lastGeneratedContentMap` | `Partial<Record<DetailLevel, string>>` | No | Content snapshots at generation time |
| `lastPromptMap` | `Partial<Record<DetailLevel, string>>` | No | Full prompts used at generation time |
| `createdAt` | `number` | No | Epoch milliseconds |
| `lastEditedAt` | `number` | No | Epoch milliseconds |
| `sourceDocuments` | `string[]` | No | Document names active at creation |

**Store:** `nuggetHeadings` (composite key path `[fileId, headingId]`, index `byNugget` on `fileId`).

---

### `StoredNugget`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\utils\storage\StorageBackend.ts`
**Purpose:** Serialized form of a `Nugget` for the `nuggets` object store. Excludes `documents` and `cards` (stored in separate stores).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Nugget ID (key path) |
| `name` | `string` | Yes | Display name |
| `type` | `NuggetType` | Yes | `'insights'` |
| `messages` | `ChatMessage[]` | No | Chat conversation history |
| `docChangeLog` | `DocChangeEvent[]` | No | Document mutation log |
| `lastDocChangeSyncIndex` | `number` | No | Last acknowledged change index |
| `subject` | `string` | No | Expert priming sentence |
| `stylingOptions` | `StylingOptions` | No | Per-nugget styling preferences |
| `createdAt` | `number` | Yes | Epoch milliseconds |
| `lastModifiedAt` | `number` | Yes | Epoch milliseconds |

**Store:** `nuggets` (key path `id`).

---

### `StoredNuggetDocument`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\utils\storage\StorageBackend.ts`
**Purpose:** Serialized form of an `UploadedFile` for the `nuggetDocuments` object store. Excludes `enabled` (runtime-only). The `status` field is normalized to `'ready' | 'error'` (processing/uploading states are not persisted).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nuggetId` | `string` | Yes | Parent nugget ID (composite key prefix, index for `byNugget`) |
| `docId` | `string` | Yes | Document ID (composite key suffix) |
| `name` | `string` | Yes | Display name |
| `size` | `number` | Yes | File size in bytes |
| `type` | `string` | Yes | MIME type |
| `lastModified` | `number` | Yes | File system last-modified epoch ms |
| `content` | `string` | No | Markdown text content |
| `status` | `'ready' \| 'error'` | Yes | Normalized status |
| `progress` | `number` | Yes | 100 for ready, 0 for error |
| `sourceType` | `'markdown' \| 'native-pdf'` | No | Storage and rendering mode |
| `pdfBase64` | `string` | No | Raw PDF as base64 (native PDFs only) |
| `fileId` | `string` | No | Anthropic Files API file ID |
| `structure` | `Array<{ level: number; text: string; id: string; startIndex?: number; page?: number }>` | No | Heading hierarchy |
| `tocSource` | `'toc_page' \| 'visual_scan'` | No | TOC extraction method |
| `originalFormat` | `'md' \| 'pdf'` | No | Original file format |
| `createdAt` | `number` | No | Epoch milliseconds |
| `lastEditedAt` | `number` | No | Epoch milliseconds |
| `lastRenamedAt` | `number` | No | Epoch milliseconds |
| `originalName` | `string` | No | Immutable upload-time file name |
| `sourceOrigin` | `SourceOrigin` | No | Provenance record |
| `version` | `number` | No | Rename/edit version counter |
| `lastEnabledAt` | `number` | No | Epoch milliseconds |
| `lastDisabledAt` | `number` | No | Epoch milliseconds |

**Store:** `nuggetDocuments` (composite key path `[nuggetId, docId]`, index `byNugget` on `nuggetId`).

---

### `StoredProject`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\utils\storage\StorageBackend.ts`
**Purpose:** Serialized form of a `Project` for the `projects` object store. Excludes `description` (not yet persisted).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Project ID (key path) |
| `name` | `string` | Yes | Display name |
| `nuggetIds` | `string[]` | Yes | Ordered nugget ID references |
| `isCollapsed` | `boolean` | No | UI collapse state |
| `createdAt` | `number` | Yes | Epoch milliseconds |
| `lastModifiedAt` | `number` | Yes | Epoch milliseconds |

**Store:** `projects` (key path `id`).

---

### `AppSessionState`

**Defined in:** `C:\Users\archd\Downloads\infonugget-v6.0\utils\storage\StorageBackend.ts`
**Purpose:** Lightweight application session record stored at key `'current'` in the `appState` object store. Preserves the user's last-selected nugget and card across page refreshes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `selectedNuggetId` | `string \| null` | Yes | Last-selected nugget ID |
| `activeCardId` | `string \| null` | Yes | Last-active card ID |
| `selectedFileId` | `string \| null` | No | Legacy field retained for backward-compat reads; ignored on write |
| `workflowMode` | `string` | No | Legacy field retained for backward-compat reads; ignored on write |

**Note:** Token usage totals and custom styles are also stored in the `appState` store at keys `'tokenUsage'` and `'customStyles'` respectively, but are not part of this interface.

---

## Entity Relationship Summary

```
Project (1) ──── (N) Nugget
                       │
                       ├── (N) UploadedFile
                       │         ├── content?: string (markdown)
                       │         ├── pdfBase64?: string (native PDF)
                       │         ├── fileId? → Anthropic Files API
                       │         ├── metaTocFileId? → Anthropic Files API (native PDFs)
                       │         └── structure?: Heading[]
                       │
                       ├── (N) Card
                       │         ├── synthesisMap: Record<DetailLevel, string>
                       │         ├── cardUrlMap: Record<DetailLevel, dataURL>
                       │         ├── imageHistoryMap: Record<DetailLevel, ImageVersion[]>
                       │         ├── visualPlanMap: Record<DetailLevel, string>
                       │         └── autoDeckSessionId? → AutoDeckSession
                       │
                       ├── (N) ChatMessage
                       ├── (N) DocChangeEvent (docChangeLog)
                       └── stylingOptions?: StylingOptions

CustomStyle (global, not per-nugget)
  └── registered into VISUAL_STYLES / STYLE_FONTS / STYLE_IDENTITIES at runtime

AutoDeckSession (useAutoDeck hook state — not persisted)
  ├── briefing: AutoDeckBriefing
  ├── parsedPlan: ParsedPlan
  │     ├── (N) PlannedCard
  │     └── (N) PlanQuestion → (N) PlanQuestionOption
  ├── conflicts: ConflictItem[]
  └── reviewState: ReviewState
        └── cardStates: Record<cardNumber, ReviewCardState>

IndexedDB stores:
  appState        → AppSessionState (key: 'current')
                 → tokenUsageTotals (key: 'tokenUsage')
                 → CustomStyle[]    (key: 'customStyles')
  nuggets         → StoredNugget[]
  nuggetHeadings  → StoredHeading[] (indexed by nuggetId)
  nuggetImages    → StoredImageBlob[] (indexed by nuggetId; Blob storage)
  nuggetDocuments → StoredNuggetDocument[] (indexed by nuggetId)
  projects        → StoredProject[]
  insightsSession → StoredInsightsSession (legacy)
  insightsDocs    → InsightsDocument[] (legacy)
  insightsHeadings → StoredHeading[] (legacy)
  insightsImages  → StoredImage[] (legacy)
```
