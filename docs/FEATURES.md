# InfoNugget v6.0 — Feature Documentation

---

## Feature: Project & Nugget Management

### Description
Projects are named containers that hold ordered lists of nugget IDs. Nuggets are the primary document-and-cards units. Users can create, rename, and delete both projects and nuggets, and can move or copy nuggets between projects. Projects can also be duplicated in full.

### User Interaction Flow
1. User opens the Projects panel (left-most strip button; renders via `createPortal` to `document.body`).
2. To create a project: clicks "New Project", enters name in `ProjectCreationModal`, submits.
3. To create a nugget inside a project: clicks the "+" button on the project row in `ProjectsPanel`, opens `NuggetCreationModal`.
4. In `NuggetCreationModal` the user sets a nugget name and optionally uploads files. On confirm, nugget is added to the project's `nuggetIds` array.
5. To rename or delete a nugget: opens `NuggetSettingsModal` via the kebab menu on the nugget row.
6. To move or copy a nugget: uses the kebab menu context actions "Move to" / "Copy to", which present a submenu listing other projects.
7. To duplicate a project: uses the project-level kebab menu "Duplicate project" action.
8. Selecting a nugget in the tree sets `selectedNuggetId` in `AppContext`, which drives the main panel content.

### UI Components Involved
- `components/ProjectsPanel.tsx` — full project/nugget tree, kebab menus, drag-and-drop
- `components/NuggetCreationModal.tsx` — new nugget creation
- `components/NuggetSettingsModal.tsx` — rename, delete
- `components/ProjectCreationModal.tsx` — new project creation
- `App.tsx` — handlers: `handleCreateProject`, `handleCreateNugget`, `handleDeleteNugget`, `handleRenameNugget`, `handleMoveNugget`, `handleCopyNugget`, `handleDuplicateProject`

### Data Operations
- Project creation: `addProject()` in `AppContext` pushes a new `Project` object with `id`, `name`, `nuggetIds: []`, `createdAt`, `lastModifiedAt`.
- Nugget creation: `addNugget()` in `AppContext` creates a `Nugget` and appends its `id` to the target project's `nuggetIds`.
- Move nugget: removes `id` from source project's `nuggetIds`, appends to target project's `nuggetIds`.
- Copy nugget: deep-clones the `Nugget` with a new `id` (cards also get new IDs), appends to target project.
- Duplicate project: deep-clones all nuggets with new IDs, creates a new `Project` whose `nuggetIds` points to the cloned nuggets.
- Rename: updates `name` and `lastModifiedAt`.
- Delete nugget: `deleteNugget()` removes the `Nugget` from state; `usePersistence` cleans up orphaned IndexedDB records.
- Delete project: removes `Project` from state; associated nuggets are deleted only if not referenced elsewhere.

### Business Rules & Validation
- Nugget names within a project are deduplicated using `getUniqueName()` from `utils/naming.ts`, which appends Windows-style `(2)`, `(3)` suffixes.
- Project names use the same deduplication.
- At least one project must exist before a nugget can be created.
- Selecting a deleted nugget clears `selectedNuggetId`.

### Edge Cases
- If the selected nugget is deleted, `selectedNuggetId` is set to `null`, returning the UI to an empty state.
- Copying a nugget with native-PDF documents copies `pdfBase64` and `fileId` references but does NOT re-upload to Files API; the copied nugget shares the same `fileId` values.

### State Management
- `projects: Project[]` and `nuggets: Nugget[]` in `AppContext`.
- `selectedNuggetId: string | null` in `AppContext`.
- `expandedPanel` (local to `App.tsx`) controls whether ProjectsPanel overlay is visible.

### Cross-Component Coordination
- `ProjectsPanel` calls handlers passed down from `App.tsx` via props.
- `usePersistence` reacts to `nuggets` and `projects` identity changes to trigger IndexedDB saves (1500ms debounce).

---

## Feature: Document Upload & Processing

### Description
Users upload documents (PDF or Markdown) into a nugget. PDFs offer a binary choice: convert to Markdown via Gemini Flash, or keep as native PDF with heading extraction. All documents are uploaded to the Anthropic Files API for use by Claude. Background processing status is tracked per document.

### User Interaction Flow
1. User opens `NuggetCreationModal` or the SourcesPanel file upload area in an existing nugget.
2. User drags files or clicks to browse. Multiple files can be dropped.
3. For PDF files: `PdfUploadChoiceDialog` appears, offering "Convert to Markdown" or "Keep as Native PDF".
4. Each file is immediately added to the nugget's `documents` array with `status: 'uploading'`.
5. Background processing runs per file (non-blocking):
   - Markdown: reads UTF-8 content → uploads to Files API → `status: 'ready'`.
   - PDF (converted): sends to Gemini Flash with `PDF_CONVERSION_PROMPT` → markdown string → uploads to Files API → `status: 'ready'`.
   - PDF (native): reads as base64 → extracts headings with Gemini Flash and `HEADING_EXTRACTION_PROMPT` → uploads PDF to Files API → generates MetaTOC → uploads MetaTOC → `status: 'ready'`.
6. The document appears in `FileList` inside `SourcesPanel` once `status: 'ready'`.
7. Documents with `enabled: false` are visually dimmed and excluded from AI context.

### UI Components Involved
- `components/FileUpload.tsx` — drag-and-drop zone
- `components/UploadView.tsx` — styled drop target
- `components/PdfUploadChoiceDialog.tsx` — native vs converted choice dialog
- `components/FileList.tsx` — document list with toggle/rename/delete actions
- `components/SourcesPanel.tsx` — host panel for file list and upload
- `components/NuggetCreationModal.tsx` — initial upload during nugget creation

### Data Operations
- `processFileToDocument(file, id)` in `utils/fileProcessing.ts` for Markdown files.
- `convertPdfWithGemini(file)` in `utils/fileProcessing.ts` for PDF-to-Markdown conversion.
- `processNativePdf(file, id)` in `utils/fileProcessing.ts` for native PDFs.
- `extractHeadingsWithGemini(file)` for heading structure extraction.
- `uploadToFilesAPI(content, filename, mimeType)` in `utils/ai.ts` for Files API upload.
- `uploadMetaToc(structure, name)` in `utils/metaToc.ts` for MetaTOC companion file.

### Business Rules & Validation
- Only `.pdf`, `.md`, `.txt` files are accepted (enforced in `FileUpload` accept attribute).
- Files API uploads are fire-and-forget with no automatic retry for network failures.
- Native PDFs store `pdfBase64` in state (rendered by `PdfViewer`) and `fileId` for Claude.
- If a file fails processing, `status` is set to `'error'` and the document remains in the list with an error indicator.
- Documents with `status !== 'ready'` are excluded from `saveAllNuggets` serialization in `usePersistence`.

### Edge Cases
- Files API files expire after 60 minutes. No re-upload logic exists for expired files; Claude calls with an expired `fileId` will fail silently.
- Very large PDFs may exceed Gemini Flash context limits during conversion.
- If heading extraction returns `[]` (no headings found), the native PDF still uploads but `structure` is empty; TOC editing is disabled.

### State Management
- `documents: UploadedFile[]` on the `Nugget` object.
- `status: 'uploading' | 'ready' | 'error'` tracks per-file processing state.
- `docChangeLog: DocChangeEvent[]` on the `Nugget` tracks add/remove/rename/enable/disable/update events for chat notification.

### Cross-Component Coordination
- `App.tsx` `handleFileAdded` → calls processing functions → updates nugget documents via `updateNugget`.
- `useInsightsLab` reads `documents` to build the document context for Claude; checks `enabled !== false`.
- `useCardGeneration` similarly filters enabled documents when synthesizing card content.
- Doc changes append to `docChangeLog`, which `useInsightsLab.pendingDocChanges` uses to notify the chat.

---

## Feature: Document Editing

### Description
A full-screen contentEditable editor in `DocumentEditorModal` lets users edit any Markdown document. It provides a rich formatting toolbar, custom undo/redo, heading promotion/demotion, section reordering, and find/replace.

### User Interaction Flow
1. User clicks the "Edit" button on a document in `FileList` or `SourcesPanel`.
2. `DocumentEditorModal` opens full-screen.
3. The document's `content` (Markdown) is parsed to HTML via `marked.parse()` and injected into a `contentEditable` `<div>`.
4. User edits text; a `MutationObserver` fires on each change: marks `isDirty`, re-parses headings, schedules undo snapshot (500ms debounce).
5. User can use the `FormatToolbar` for bold/italic/headings/lists/links/tables/blockquote.
6. User can promote (H3 → H2) or demote (H2 → H3) individual headings via buttons in the heading list sidebar.
7. User can drag headings in the sidebar list to reorder entire sections (heading + all sub-content).
8. User opens find/replace via Ctrl+F or the toolbar button; `FindReplaceBar` appears.
9. On save: `htmlToMarkdown()` converts editor HTML back to Markdown; `onSave` callback updates the document's `content`; file is re-uploaded to Files API; a `DocChangeEvent` of type `'updated'` is appended to `docChangeLog`.
10. On discard: editor reverts to initial HTML; `isDirty` is cleared.

### UI Components Involved
- `components/DocumentEditorModal.tsx` — full-screen editor shell
- `components/FormatToolbar.tsx` — formatting toolbar
- `components/FindReplaceBar.tsx` — find/replace UI bar
- `hooks/useDocumentEditing.ts` — all editor logic
- `hooks/useDocumentFindReplace.ts` — find/replace DOM operations
- `utils/markdown.ts` — `parseMarkdownStructure()`, `htmlToMarkdown()`

### Data Operations
- Read: `marked.parse(initialContent)` on mount → injects HTML into `contentEditable`.
- Write: `htmlToMarkdown(editorRef.current.innerHTML)` → updates `UploadedFile.content` → re-uploads to Files API via `uploadToFilesAPI`.
- Heading list: parsed from DOM via `querySelectorAll('h1, h2, h3, h4, h5, h6')`.

### Business Rules & Validation
- Undo/redo stack is capped at 200 entries per session.
- Heading promotion clamps to H1 minimum; demotion clamps to H6 maximum.
- `isDirty` is false on initial mount and after save/discard; true after any DOM mutation not suppressed by `suppressDirtyRef`.
- Ctrl+S triggers save; Ctrl+Z triggers undo; Ctrl+Shift+Z and Ctrl+Y trigger redo; Ctrl+B and Ctrl+I trigger bold/italic.

### Edge Cases
- `document.execCommand` is used for rich text operations and is deprecated in modern browsers; behavior may differ across browsers.
- `removeFormat` command uses a custom implementation that extracts plain text nodes, preserving `<br>` elements, to avoid execCommand quirks.
- If the editor `ref` is not ready on mount, `populateEditor` retries via `requestAnimationFrame`.
- The `MutationObserver` is paused during find/replace DOM operations (mark injection/removal) via `withObserverPaused` to prevent undo snapshot pollution.

### State Management
- `isDirty: boolean` — whether unsaved changes exist.
- `activeFormats: Set<string>` — currently active formatting at cursor position.
- `headings: EditorHeading[]` — parsed heading list for the sidebar.
- `undoStack` / `redoStack`: `useRef<string[]>` arrays of serialized `innerHTML` snapshots.

### Pipeline / Multi-Stage Process
1. **Mount**: `useLayoutEffect` → `populateEditor()` → `marked.parse()` → inject HTML → snapshot baseline.
2. **Typing**: `MutationObserver` fires → `setIsDirty(true)` → `parseHeadings()` → debounced `pushUndo()` after 500ms.
3. **Programmatic change** (promote/demote/reorder): `snapshotBeforeChange()` → DOM mutation → `lastSnapshotRef` update → `parseHeadings()`.
4. **Save**: `clearFindHighlights()` → `closeFindBar()` → `htmlToMarkdown()` → `onSave(markdown)` → `setIsDirty(false)`.

---

## Feature: TOC Editing (Native PDFs)

### Description
Native PDF documents have an editable Table of Contents (TOC) derived from the document's heading structure. Editing the TOC replaces the MetaTOC companion file on the Anthropic Files API. A "draft mode" with a hard lock overlay prevents accidental navigation while editing.

### User Interaction Flow
1. In `SourcesPanel`, user selects a native PDF document.
2. The PDF is rendered by `PdfViewer`; the heading structure appears as an editable list alongside.
3. User clicks "Edit TOC" to enter draft mode.
4. A hard lock overlay (`z-[106]`) covers the entire app except the TOC editor panel, preventing panel switches.
5. User edits heading names, promotes/demotes levels, or reorders entries.
6. User clicks "Save": `handleSaveToc` in `App.tsx` calls `replaceMetaToc(oldMetaTocFileId, docName, newStructure)`, which deletes the old file and uploads a new one. A `DocChangeEvent` of type `'toc_updated'` is appended to `docChangeLog`.
7. User clicks "Discard": draft is reset to the saved structure; draft mode exits.

### UI Components Involved
- `components/SourcesPanel.tsx` — TOC list, edit/save/discard controls, hard lock overlay
- `App.tsx` — `handleSaveToc` handler
- `utils/metaToc.ts` — `replaceMetaToc()`, `generateMetaTocMarkdown()`, `uploadMetaToc()`

### Data Operations
- `replaceMetaToc(oldFileId, name, newStructure)`: calls `deleteFromFilesAPI(oldFileId)`, then `uploadMetaToc(newStructure, name)` which calls `generateMetaTocMarkdown(structure)` and `uploadToFilesAPI(content, filename, 'text/plain')`. Updates `metaTocFileId` on the `UploadedFile`.
- MetaTOC format: headings as `# title (page N)` with indentation representing hierarchy level.

### Business Rules & Validation
- Hard lock overlay (`z-[106]`) intercepts clicks on all other app areas during draft mode, preventing navigation while unsaved TOC changes exist.
- The `appGatedAction` function in `App.tsx` checks `isTocDraftMode` before allowing panel or nugget switches; if in draft mode, it shows a confirmation dialog.
- If `replaceMetaToc` fails, the old `metaTocFileId` is preserved; the error is shown as a toast.

### Edge Cases
- If the PDF has no headings (`structure: []`), TOC editing is still available but starts empty.
- Files API 60-minute expiry means `deleteFromFilesAPI` may receive a 404 for the old file; this is treated as a non-fatal error.

### State Management
- `isTocDraftMode: boolean` in `App.tsx`.
- `tocDraft: Heading[] | null` in `App.tsx` — working copy of structure being edited.
- `UploadedFile.structure: Heading[]` — saved heading structure.
- `UploadedFile.metaTocFileId: string` — Files API ID of the companion MetaTOC.

---

## Feature: Insights Chat (Insights Lab)

### Description
A conversational chat interface backed by Claude lets users ask questions about uploaded documents. The chat maintains a multi-turn history per nugget, uses prompt caching for document context, and detects document changes to notify the AI agent.

### User Interaction Flow
1. User opens the Chat panel (third strip button).
2. User selects a document focus from the document dropdown (optional; all enabled docs are always in context).
3. User types a message and submits.
4. If pending document changes exist (`pendingDocChanges.length > 0`) and the chat has a history, a notification banner appears offering "Continue with updates" or "Start fresh".
   - "Continue with updates": calls `handleDocChangeContinue`, which injects a system message summarizing changes, then sends the user message.
   - "Start fresh": calls `handleDocChangeStartFresh` (alias for `clearMessages`), then sends normally.
5. User message appears immediately; `isLoading` is true while Claude responds.
6. Assistant response appears; `card-suggestions` fenced code block is parsed out and rendered as clickable suggestion chips.
7. User can stop the response mid-stream by clicking "Stop".
8. Chat history persists per nugget in `Nugget.messages`.

### UI Components Involved
- `components/ChatPanel.tsx` — chat UI, message list, input, doc dropdown
- `hooks/useInsightsLab.ts` — all AI logic, message state, doc change detection
- `App.tsx` — passes `recordUsage` and nugget context

### Data Operations
- `sendMessage(text, isCardRequest, detailLevel, messagesOverride?)` in `useInsightsLab`:
  - Resolves enabled documents for the selected nugget.
  - Splits into `fileApiDocs` (have `fileId`) and `inlineDocs` (no `fileId`).
  - Inline docs → system block (cached). Files API docs → document content blocks prepended to first user message.
  - Calls `pruneMessages(history, text, messageBudget)` to fit within context window.
  - Calls `callClaude()` with multi-turn messages.
  - Appends user + assistant messages to `Nugget.messages` via `appendNuggetMessage`.
  - Updates `Nugget.lastDocHash` to current document hash.

### Business Rules & Validation
- `computeMessageBudget(systemBlocks, maxTokens)` ensures the conversation fits in the 200K context window with a 2K safety margin. If budget is zero or negative, an error message is shown without calling Claude.
- `pruneMessages` drops oldest messages (beyond budget) in pairs (user+assistant) to maintain conversation coherence.
- Token budget is scaled per detail level when `isCardRequest` is true: TitleCard=150, TakeawayCard=350, Executive=300, Standard=600, Detailed=1200.
- Aborted requests (`AbortError`) are silently ignored.
- Token overflow errors produce a user-visible message with actionable suggestions.

### Edge Cases
- `messagesOverride` parameter bypasses the stale-closure issue when a system message is injected synchronously before React re-renders (used in `handleDocChangeContinue`).
- If `fileApiDocs` exist but `claudeMessages` is empty after pruning, a fallback document reference message is prepended.

### State Management
- `isLoading: boolean` — per-send loading state.
- `abortRef: React.MutableRefObject<AbortController | null>` — allows `stopResponse` to cancel the in-flight request.
- `Nugget.messages: ChatMessage[]` — full multi-turn history.
- `Nugget.lastDocHash: string` — hash of document state at last sync, for change detection.
- `Nugget.docChangeLog: DocChangeEvent[]` and `Nugget.lastDocChangeSyncIndex: number` — change log and read pointer.

---

## Feature: Save Chat Response as Card

### Description
Any assistant message in the chat panel can be saved as a `Card` in the nugget's card list. Claude's response becomes the card's `synthesisMap` content. The card title is extracted from the first `#` heading in the response, or a truncated version of the response text.

### User Interaction Flow
1. User clicks the "Save as Card" button on an assistant message in `ChatPanel`.
2. `App.tsx` handler extracts the title: looks for `^#\s+(.+)` regex match; falls back to first 60 characters of content.
3. A new `Card` object is created with the message content stored in `synthesisMap[detailLevel]`, where `detailLevel` comes from `ChatMessage.detailLevel` (set when the message was a card content request) or defaults to `'Standard'`.
4. The card is appended to `selectedNugget.cards`.
5. The saved message has `savedAsCardId` set to the new card's ID; the "Save as Card" button changes to "Saved".
6. `ChatMessage.isCardContent` is set to `true` for messages generated via the "Generate Card" flow (distinct from regular chat).

### UI Components Involved
- `components/ChatPanel.tsx` — "Save as Card" button per assistant message
- `App.tsx` — `handleSaveMessageAsCard` handler

### Data Operations
- Creates a `Card` with: `id`, `text` (extracted title), `level: 1`, `selected: false`, `synthesisMap: { [detailLevel]: content }`, `createdAt`, `sourceDocuments` (enabled doc names at time of save).
- Updates `ChatMessage.savedAsCardId` on the source message.
- Calls `updateNugget` to append the card.

### Business Rules & Validation
- Only assistant messages with non-empty content can be saved.
- If a message has already been saved (`savedAsCardId` set), the button is disabled.
- Title extraction caps at 60 characters with ellipsis for long titles.

### State Management
- `Nugget.cards: Card[]` — the card is appended.
- `ChatMessage.savedAsCardId: string | undefined` — set after save.

---

## Feature: Card Content Generation (3-Phase Pipeline)

### Description
Right-clicking a heading in the card list, or selecting a heading in the SourcesPanel document structure, triggers the 3-phase card generation pipeline: (1) content synthesis via Claude, (2) visual layout planning via Claude (or Gemini Flash for PwC), (3) image generation via Gemini Pro Image. Results are cached per `DetailLevel` and version history is maintained.

### User Interaction Flow
1. User right-clicks a card heading or clicks "Generate" in the card panel.
2. User selects a `DetailLevel` (Executive, Standard, Detailed, TitleCard, TakeawayCard) from `activeLogicTab`.
3. Phase 1 starts: status shows "Synthesizing Standard Mapping for [Title]..."; Claude generates synthesis content. If synthesis is already cached in `synthesisMap[level]`, this phase is skipped.
4. Phase 2 starts: status shows "Planning layout for [Title]..."; Claude generates a visual brief (or Gemini Flash for PwC Corporate style). If planner fails, generation continues without a plan (fallback).
5. Phase 3 starts: status shows "Rendering [Style] Visual [Level] for [Title]..."; Gemini Pro Image generates the image.
6. Image appears in the card's image display area. Version history entry is appended to `imageHistoryMap[level]`.
7. For "Generate All": `handleGenerateAll` collects all selected cards → confirmation dialog shows manifest → `executeBatchCardGeneration` runs each card in sequence via `Promise.allSettled`.

### UI Components Involved
- `components/CardsPanel.tsx` — card list, Generate / Generate All buttons, image display
- `components/AssetsPanel.tsx` — shows current `genStatus`, version history
- `hooks/useCardGeneration.ts` — pipeline logic
- `utils/prompts/contentGeneration.ts` — Phase 1 & 2 prompts
- `utils/prompts/imageGeneration.ts` — Phase 3 prompt (generic)
- `utils/prompts/pwcGeneration.ts` — Phase 2 & 3 prompts (PwC Corporate)
- `utils/prompts/coverGeneration.ts` — Phase 1, 2 & 3 prompts (TitleCard, TakeawayCard)

### Data Operations
- Phase 1: `callClaude(prompt, { systemBlocks, messages?, maxTokens })`. Result stored in `Card.synthesisMap[level]`.
- Phase 2: `callClaude(plannerPrompt, { maxTokens: 4096 })`. Result stored in `Card.visualPlanMap[level]`.
- Phase 3: `getGeminiAI().models.generateContent({ model: 'gemini-3-pro-image-preview', contents, config: PRO_IMAGE_CONFIG })`. Base64 PNG stored in `Card.cardUrlMap[level]`.

### Business Rules & Validation
- If `synthesisMap[level]` already exists, Phase 1 is skipped.
- If the planner (Phase 2) throws, generation continues without a visual plan (the visualizer uses a default layout instruction).
- Version history in `imageHistoryMap[level]` is capped at 10 entries; oldest entries are shifted off.
- `lastGeneratedContentMap[level]` stores the synthesis content used for the most recent generation; `contentDirty` is true if current synthesis differs from it.
- Reference image is included as an `inlineData` part in the Gemini request when `useReferenceImage` is true and `referenceImage` is set.
- For PwC Corporate style: `buildPwcPlannerPrompt` instructs Claude/Gemini Flash to output JSON (not prose); that JSON is embedded inside `buildPwcDesignSpec` for the renderer.

### Edge Cases
- On 503 / model overload errors: toast shows a warning with a retry button that calls `generateCardRef.current(card)`.
- 404 / "Requested entity was not found" errors in AI Studio environment trigger `aistudio.openSelectKey()`.
- Batch generation uses `Promise.allSettled` (not sequential `await`) — all selected cards run concurrently.

### State Management
- `genStatusMap: Record<string, string>` — per-card status message.
- `genStatus: string` — derived status for the currently active card.
- `manifestCards: Card[] | null` — null = no batch in progress; non-null = batch confirmation pending.
- `activeLogicTab: DetailLevel` — currently selected detail level.
- Card fields updated: `synthesisMap`, `isSynthesizingMap`, `cardUrlMap`, `isGeneratingMap`, `imageHistoryMap`, `lastGeneratedContentMap`, `visualPlanMap`, `lastPromptMap`.

### Pipeline / Multi-Stage Process
1. `generateCard(card)` → check `synthesisMap[currentLevel]`; if missing call `performSynthesis(card, level)`.
2. `performSynthesis`: build system blocks, call Claude → update `synthesisMap[level]`.
3. Back in `generateCard`: call planner (Claude) → store `visualPlan`.
4. Call `assembleRendererPrompt()` → call Gemini Pro Image → store `cardUrlMap[level]`.
5. Build `ImageVersion` entry → append to `imageHistoryMap[level]` (cap at 10).

---

## Feature: Auto-Deck

### Description
Auto-Deck is a two-agent AI pipeline that plans and produces an entire deck of infographic cards from one or more documents. The user configures a briefing, reviews the AI-generated card plan (with optional MCQ decisions), and approves production. Cards are created with pre-populated `synthesisMap` content.

### User Interaction Flow
1. User opens the Auto-Deck panel (fourth strip button).
2. User fills in briefing fields: audience, presentation type, objective, tone, focus, card count range, deck structure options (cover, section titles, closing), and LOD.
3. User selects and orders documents from the nugget using the document dropdown/list.
4. User clicks "Generate Plan". Status transitions to `'planning'`.
5. **Planner** (Claude) analyzes documents → outputs JSON plan or conflict report.
   - If conflict: `status` → `'conflict'`; conflict items displayed with severity; user resolves and retries.
   - If ok: `status` → `'reviewing'`; card plan displayed.
6. In review mode:
   - User can toggle individual cards on/off (exclude from deck).
   - User can answer MCQ decision questions (each has 2-4 options with a recommended default).
   - User can enter a general comment.
   - User can click "Revise Plan" to send feedback back to the Planner (increments `revisionCount`; max revisions enforced by `AUTO_DECK_LIMITS.maxRevisions`).
7. User clicks "Approve & Generate Content". Status transitions to `'finalizing'` (if answers/comments exist) then `'producing'`.
8. **Finalizer** (Claude, only if MCQ answers or general comment exist): merges decisions into card guidance fields → produces clean final plan.
9. **Producer** (Claude): writes synthesis content for each planned card. For >15 cards: batches of 12 with inter-batch context.
10. Cards created and appended to `Nugget.cards`. Status → `'complete'`.
11. User can abort at any stage; `abort()` returns to the last stable state.

### UI Components Involved
- `components/AutoDeckPanel.tsx` — briefing form, plan review, MCQ UI, progress display
- `hooks/useAutoDeck.ts` — state machine, all Claude calls
- `utils/prompts/autoDeckPlanner.ts` — Planner and Finalizer prompts
- `utils/prompts/autoDeckProducer.ts` — Producer prompt, `batchPlan()`
- `utils/autoDeck/constants.ts` — LOD configs, `AUTO_DECK_LIMITS`
- `utils/autoDeck/parsers.ts` — `parsePlannerResponse`, `parseFinalizerResponse`, `parseProducerResponse`

### Data Operations
- Planner call: `callClaude('', { systemBlocks, messages, maxTokens: 16384, temperature: 0.1 })`.
- Finalizer call: same signature, no source documents sent (plan restructuring only).
- Producer call: `callClaude('', { systemBlocks, messages, maxTokens })` where `maxTokens` is scaled by `batch.length * tokensPerCard`.
- Card creation: `Card` objects with `synthesisMap: { [detailLevel]: '# Title\n\nContent' }` appended to `Nugget.cards`.

### Business Rules & Validation
- Pre-flight token check: inline document content estimated at ~4 chars/token; if >180K tokens, session errors immediately.
- Planner operates at `temperature: 0.1` for deterministic output.
- Revision limit: `AUTO_DECK_LIMITS.maxRevisions` (defined in `utils/autoDeck/constants.ts`).
- LOD determines `DetailLevel` for created cards: `executive` → `'Executive'`, `standard` → `'Standard'`, `detailed` → `'Detailed'`.
- Card names are deduplicated using `getUniqueName()`.
- Batching: if `finalCards.length > 15`, `batchPlan(finalCards, 12)` splits into batches; each batch call includes context about other cards to avoid repetition.
- Files API native PDFs are injected as document content blocks into the first user message of each Claude call.

### Edge Cases
- AbortError from `AbortController.abort()` is caught and silently ignored; status reverts.
- If the Producer returns an error-status JSON, the entire production step throws and `status` → `'error'`.
- `retryFromReview()` allows recovery from a production error while preserving the reviewed plan.

### State Management
- `session: AutoDeckSession | null` — full session state including status, plan, review state, produced cards.
- `abortRef: React.MutableRefObject<AbortController | null>` — in-flight abort handle.
- Status machine: `'configuring'` → `'planning'` → `'conflict'` | `'reviewing'` → `'revising'` | `'finalizing'` → `'producing'` → `'complete'` | `'error'`.

---

## Feature: Card Management

### Description
Cards in the `CardsPanel` can be renamed, reordered by drag-and-drop, deleted, and have their synthesis content edited inline. Cards can also be copied or moved to other nuggets.

### User Interaction Flow
1. User sees the card list in `CardsPanel`; each card shows its heading text and (if generated) a thumbnail of its image.
2. Double-click a card title to rename inline (calls `updateNuggetCard` with new `text`).
3. Drag a card row up or down to reorder. `CardsPanel` updates `Nugget.cards` order on drop.
4. Click a card to select it as the active card; its image (if any) shows in the main view.
5. Right-click or use the kebab menu for: Delete, Copy to Nugget, Move to Nugget, Duplicate.
6. Clicking into the synthesis content area (if the card has `synthesisMap` content) allows inline text editing. Changes update `synthesisMap` for the current `detailLevel`.
7. The "Generate" button (or right-click from SourcesPanel heading list) triggers the 3-phase pipeline for the selected card.

### UI Components Involved
- `components/CardsPanel.tsx` — card list, drag handles, inline editing, image thumbnails
- `App.tsx` — `handleRenameCard`, `handleDeleteCard`, `handleMoveCard`, `handleCopyCard`, `handleReorderCards`

### Data Operations
- Rename: `updateNuggetCard(cardId, c => ({ ...c, text: newText, lastEditedAt: Date.now() }))`.
- Delete: removes card from `Nugget.cards` array.
- Reorder: replaces `Nugget.cards` with a reordered copy.
- Copy to nugget: deep-clones `Card` with new `id`, appends to target nugget.
- Move to nugget: removes from source, appends to target.
- Inline synthesis edit: `updateNuggetCard` with updated `synthesisMap[level]`.

### Business Rules & Validation
- Card names within a nugget are not enforced as unique (unlike nugget names).
- Deleting a card with generated images removes `cardUrlMap` entries; `usePersistence` cleans up orphaned IndexedDB images.
- `lastEditedAt` is updated on rename and synthesis edits.

### State Management
- `Nugget.cards: Card[]` — ordered array.
- `activeCardId: string | null` in `AppContext` — the currently focused card.

---

## Feature: Image Modification

### Description
Generated card images can be modified without full regeneration. The annotation workbench allows drawing pins, rectangles, arrows, and sketches on the image. These annotations produce textual instructions that are sent alongside the original image to Gemini Pro Image for targeted redraw. Alternatively, "Content Modification" re-renders the image with updated synthesis text using the original image as a style reference.

### User Interaction Flow
1. User opens the `ZoomOverlay` by clicking the image, or clicks the "Modify" button in `AssetsPanel`.
2. User selects an annotation tool from `AnnotationToolbar` (pin, rectangle, arrow, sketch).
3. User draws annotations on the `AnnotationWorkbench` canvas overlay.
4. Each annotation has a label/instruction field (editable).
5. User clicks "Apply Modifications":
   - `executeModification(annotations, originalImageUrl, cardTitle)` in `utils/modificationEngine.ts` is called.
   - Annotations are rendered onto a black canvas as a "redline map" image.
   - Both the original image and the redline map are sent to Gemini Pro Image alongside `buildModificationPrompt(instructions, cardTitle, hasRedline)`.
   - The result replaces the current `cardUrlMap[level]` and is appended to `imageHistoryMap[level]`.
6. For content-only modification: user edits synthesis text, then clicks "Re-render Content":
   - `executeContentModification(content, cardTitle, style, palette, originalImageUrl)` calls Gemini Pro Image with `buildContentModificationPrompt()`.
   - The original image is included as a style reference.
   - Result replaces `cardUrlMap[level]`.

### UI Components Involved
- `components/AssetsPanel.tsx` — modification trigger, version history display
- `components/ZoomOverlay.tsx` — full-screen image with annotation canvas
- `components/workbench/AnnotationWorkbench.tsx` — canvas drawing layer
- `components/workbench/AnnotationToolbar.tsx` — tool selection
- `components/workbench/PinEditor.tsx` — pin placement/label editing
- `components/workbench/RectangleEditor.tsx` — rectangle placement/label editing
- `components/workbench/CanvasRenderer.ts` — renders annotations to canvas
- `utils/modificationEngine.ts` — `executeModification`, `executeContentModification`
- `hooks/useCardGeneration.ts` — `handleImageModified` (updates card state after modification)

### Data Operations
- `executeModification`: renders annotations to a black canvas → base64 PNG → sends `[original, redline]` parts to Gemini Pro Image.
- `executeContentModification`: sends `[original]` as style reference + content prompt to Gemini Pro Image.
- On success: `handleImageModified(cardId, newImageUrl, history)` updates `cardUrlMap[level]` and `imageHistoryMap[level]`.

### Business Rules & Validation
- Version history is updated after each modification (same cap of 10 entries as generation).
- If no annotations are drawn, `hasRedline: false` is passed; the modification prompt omits redline map instructions.
- Arrow and sketch annotations are supported but may have limited spatial precision.

### State Management
- Annotations are local to `ZoomOverlay` / `AnnotationWorkbench` (not persisted in IndexedDB).
- `Card.imageHistoryMap[level]: ImageVersion[]` — persisted version history.
- `Card.cardUrlMap[level]: string` — current image data URL.

---

## Feature: Style Studio

### Description
The Style Studio modal lets users configure the visual style for card image generation. Users choose from 15 built-in styles or create custom styles. Each configuration includes a color palette, font pair, aspect ratio, and resolution. Custom styles can optionally have AI-generated style prompts created by Gemini Flash.

### User Interaction Flow
1. User opens `StyleStudioModal` from the style settings button in `CardsPanel` or `AssetsPanel`.
2. User selects a built-in style tile (e.g., "Flat Design", "PwC Corporate") or clicks "+ Custom Style".
3. For each built-in style: a default `Palette` and `FontPair` are applied from `VISUAL_STYLES` in `utils/ai.ts`.
4. User can customize:
   - **Palette**: edit any of the 5 hex color fields (background, primary, secondary, accent, text).
   - **Fonts**: select from dropdown lists for primary and secondary fonts.
   - **Aspect Ratio**: select from preset ratios (16:9, 9:16, 1:1, 4:5, etc.).
   - **Resolution**: standard or high.
5. For custom styles: user names the style, configures palette/fonts, optionally enters a visual style description and clicks "Generate Style with AI":
   - `generateStyleWithAI(description, palette, fonts)` in `utils/ai.ts` calls Gemini Flash.
   - The result is stored as `CustomStyle.generatedPromptText`.
6. On confirm: `menuDraftOptions` (the current `StylingOptions` in `App.tsx`) is updated and passed to `useCardGeneration`.

### UI Components Involved
- `components/StyleStudioModal.tsx` — full modal
- `App.tsx` — `menuDraftOptions` state, `handleStyleChange`

### Data Operations
- `VISUAL_STYLES` in `utils/ai.ts`: Record of 15 style names → `{ palette, fonts.primary, fonts.secondary }`.
- `STYLE_IDENTITIES` in `utils/ai.ts`: Record of 15 style names → prose identity descriptor for the image model.
- `CustomStyle` objects stored in `AppContext.customStyles` and persisted to IndexedDB `appState`.
- `generateStyleWithAI(description, palette, fonts)`: Gemini Flash call; result is `generatedPromptText` on the `CustomStyle`.

### Business Rules & Validation
- Built-in style selection resets palette and fonts to the style's defaults.
- Custom styles persist across sessions via `AppContext.customStyles` → IndexedDB.
- `BUILTIN_STYLE_NAMES: Set<string>` in `utils/ai.ts` is the authoritative list of built-in names.

### State Management
- `menuDraftOptions: StylingOptions` in `App.tsx` — working style configuration.
- `nugget.stylingOptions: StylingOptions` — per-nugget saved style.
- `AppContext.customStyles: CustomStyle[]` — persisted custom styles.

---

## Feature: Reference Image

### Description
The current card image can be "stamped" as a reference image. When reference is active, subsequent generations include the reference image as a style guide for the Gemini Pro Image model, ensuring visual consistency across cards.

### User Interaction Flow
1. User generates at least one card image.
2. In `AssetsPanel`, user clicks "Set as Reference" (or equivalent action).
3. The current `cardUrlMap[level]` is stored as `referenceImage: ReferenceImage` in `App.tsx`.
4. `useReferenceImage: boolean` toggle in `App.tsx` enables/disables reference use.
5. When enabled and `menuDraftOptions` (style/palette/aspect) differs from when the reference was created, `App.tsx` detects a mismatch and shows a settings mismatch dialog.
6. The dialog lets the user: use reference with current settings, revert to reference's settings, or disable the reference.

### UI Components Involved
- `components/AssetsPanel.tsx` — "Set as Reference" button, reference image display, toggle
- `App.tsx` — `referenceImage` state, `useReferenceImage` toggle, mismatch detection dialog

### Data Operations
- `ReferenceImage: { url: string; stylingOptions: StylingOptions }` stored in `App.tsx` local state (not persisted).
- In `generateCard()` in `useCardGeneration.ts`: if `shouldUseRef`, the reference image data URL is decoded to base64 and included as an `inlineData` part in the Gemini request.

### Business Rules & Validation
- Reference image is not persisted to IndexedDB; it is lost on page reload.
- The mismatch check compares `referenceImage.stylingOptions` with current `menuDraftOptions` on each generation attempt.
- `skipReferenceOnce` parameter in `generateCard` allows a single generation to bypass the reference (used internally).

### State Management
- `referenceImage: ReferenceImage | null` in `App.tsx`.
- `useReferenceImage: boolean` in `App.tsx`.

---

## Feature: Token Usage Tracking

### Description
Every Claude and Gemini API call's token usage is tracked in real-time. Costs are calculated using hardcoded per-provider rates and displayed in a dropdown in the app header. Usage totals persist to IndexedDB.

### User Interaction Flow
1. Token counters update automatically after each AI call (no user action required).
2. User clicks the token usage indicator in the `Header` to open a dropdown showing: total cost, Claude cost, Gemini cost, input tokens, output tokens, cache read tokens, call count.
3. User can click "Reset" to zero all counters.

### UI Components Involved
- `components/Header.tsx` — usage indicator and dropdown (or `App.tsx` header section)
- `hooks/useTokenUsage.ts` — tracking logic

### Data Operations
- `recordUsage({ provider, model, inputTokens, outputTokens, cacheReadTokens?, cacheWriteTokens? })` appends an entry to `entriesRef` and updates `totals` state.
- Cost calculation: `(tokens / 1_000_000) * rate` per category. Rates in `COST_RATES`:
  - `claude-sonnet-4-6`: input $3, output $15, cacheRead $0.30, cacheWrite $3.75 per 1M tokens.
  - `gemini-3-pro-image-preview`: input $1.25, output $5 per 1M tokens.
- `scheduleSave()` debounces writes to `storage.saveTokenUsage()` at 500ms.

### Business Rules & Validation
- Unknown model names fall back to `DEFAULT_RATES: { input: 1, output: 5 }`.
- `formatTokens(n)` displays as K or M for large values.
- `formatCost(n)` displays 4 decimal places for amounts under $0.01.

### State Management
- `totals: TokenUsageTotals` — React state updated on every `recordUsage` call.
- `entriesRef: React.MutableRefObject<TokenUsageEntry[]>` — raw entries, not persisted.
- Persisted: `TokenUsageTotals` to IndexedDB `appState` store via `storage.saveTokenUsage()`.

---

## Feature: Export

### Description
Users can download the currently displayed card image, or download all card images for selected cards at the current detail level. Images are downloaded as PNG files.

### User Interaction Flow
1. **Single card download**: User clicks the download button in `AssetsPanel` or `CardsPanel`. The current `cardUrlMap[activeLogicTab]` data URL is converted to a Blob and triggered as a download with filename `[cardTitle]-[level].png`.
2. **Download all**: User clicks "Download All" (available when multiple cards have images at the current detail level). Each image is downloaded sequentially with a brief delay to avoid browser popup blocking.

### UI Components Involved
- `components/AssetsPanel.tsx` — single download button
- `components/CardsPanel.tsx` — "Download All" trigger
- `App.tsx` — download handlers

### Data Operations
- Single: `fetch(dataUrl)` → `.blob()` → `URL.createObjectURL(blob)` → programmatic `<a>` click → `URL.revokeObjectURL`.
- All: iterates `selectedNugget.cards` filtering for cards that have `cardUrlMap[activeLogicTab]` set; runs single download per card.

### Business Rules & Validation
- Download only applies to cards with a generated image at the currently active `DetailLevel`.
- If no image exists for a card at the active level, that card is skipped in "Download All".
