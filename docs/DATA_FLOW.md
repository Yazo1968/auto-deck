# Data Flow

End-to-end data flows for all significant operations in InfoNugget v6.0.

---

## Flow: App Startup / Data Hydration

### Trigger
Browser loads `index.html`. React mounts the component tree starting from `index.tsx`.

### Steps

1. **Entry point mounts** — `index.tsx` renders `<StorageProvider>` wrapping `<ToastProvider>`.

2. **StorageProvider mounts** — `components/StorageProvider.tsx`, `StorageProvider` component runs a `useEffect` that calls `hydrateFromStorage()`.

3. **Loading screen shown** — While `loading === true`, `<LoadingScreen>` is rendered instead of `children`.

4. **`IndexedDBBackend.init()` called** — `utils/storage/IndexedDBBackend.ts`, `IndexedDBBackend.init()`. Opens `infonugget-db` at version 5. If the database version is lower than 5, `onupgradeneeded` fires and runs schema migrations:
   - `createStoresV1()`: creates `appState`, `files`, `headings`, `images`, `insightsSession`, `insightsDocs`, `insightsHeadings`, `insightsImages`
   - `createStoresV2()`: creates `documents`, `nuggets`, `nuggetHeadings`, `nuggetImages`
   - `createStoresV3()`: creates `nuggetDocuments` (composite key `[nuggetId, docId]`)
   - `createStoresV4()`: creates `projects`
   - `migrateV5()`: clears legacy stores (`files`, `headings`, `images`, `documents`)

5. **All stores loaded in parallel** — `hydrateFromStorage()` in `components/StorageProvider.tsx` issues 10 parallel `Promise.all` reads:
   - `storage.loadAppState()` → `AppSessionState | null`
   - `storage.loadFiles()` → `StoredFile[]` (legacy)
   - `storage.loadInsightsSession()` → `StoredInsightsSession | null`
   - `storage.loadInsightsDocs()` → `InsightsDocument[]` (legacy)
   - `storage.loadInsightsHeadings()` → `StoredHeading[]` (legacy)
   - `storage.loadInsightsImages()` → `StoredImage[]` (legacy)
   - `storage.loadNuggets()` → `StoredNugget[]`
   - `storage.loadProjects()` → `StoredProject[]`
   - `storage.loadTokenUsage()` → `Record<string, unknown> | null`
   - `storage.loadCustomStyles()` → `unknown[] | null`

6. **Legacy InsightsSession deserialized** — If `insightsSessionData` is non-null, `deserializeCard()` from `utils/storage/serialize.ts` is called for each stored heading, merging `StoredImage` data back via `blobStorageToImage()`. Blob records are converted to data URLs via `FileReader.readAsDataURL`.

7. **Nuggets deserialized** — For each `StoredNugget`, three parallel loads run: `storage.loadNuggetHeadings(id)`, `storage.loadNuggetImages(id)`, `storage.loadNuggetDocuments(id)`. Then:
   - `deserializeCard(StoredHeading, StoredImage[])` reconstructs each `Card` with its `cardUrlMap` and `imageHistoryMap`
   - `deserializeNuggetDocument(StoredNuggetDocument)` reconstructs each `UploadedFile`
   - `deserializeNugget(StoredNugget, Card[], UploadedFile[])` assembles the full `Nugget`

8. **Runtime migrations run** (if needed):
   - **v2→v3**: If all nuggets have empty `documents[]`, old global documents are loaded via `storage.loadDocuments()` and embedded per-nugget
   - **v1→v3**: If no nuggets exist but `storedFiles` or `insightsSession` do, a migration creates `Nugget` objects from old file-based and session-based data
   - **synthesis→insights**: Any nugget with `type === 'synthesis'` is mutated to `type: 'insights'`
   - **nuggets→project**: If no projects exist but nuggets do, a default `"My Project"` is created containing all nuggets

9. **Orphan cleanup** — `cleanupOrphanedData()` compares `nuggets.map(n => n.id)` against `storage.loadAllNuggetIds()`. Any stored nugget ID not present in the hydrated set is deleted from `nuggets`, `nuggetDocuments`, `nuggetHeadings`, and `nuggetImages`. Then `storage.clearLegacyStores()` clears the `files`/`headings`/`images`/`documents` stores.

10. **Custom styles registered** — `registerCustomStyles(customStyles)` in `utils/ai.ts` injects custom `CustomStyle` objects into the `VISUAL_STYLES`, `STYLE_FONTS`, and `STYLE_IDENTITIES` maps.

11. **`InitialPersistedState` returned** — If data was found, `hydrateFromStorage()` resolves with the full state object. If no data exists, it resolves with `null`.

12. **`AppProvider` initialized** — `StorageProvider` renders `<AppProvider initialState={...}>`. `AppContext.tsx` initializes all global React state from `initialState`. The `PersistenceConnector` (renderless child component) bridges the context to `usePersistence`.

13. **Loading screen removed** — `loading` is set to `false`, `<LoadingScreen>` is replaced with `{children}` (App.tsx).

### Error Handling
- If `IndexedDB.open` fails, the error is caught and logged; the app starts with an empty state.
- If orphan cleanup fails, the error is logged as non-fatal and the app continues.
- Blob-to-data-URL conversion failures in `blobStorageToImage()` propagate up and may result in missing images for affected cards.

### Performance Considerations
- All 10 store reads run in parallel via `Promise.all`.
- Per-nugget reads (headings, images, documents) run in parallel per nugget but nuggets themselves are processed sequentially.
- Large `pdfBase64` strings stored in `nuggetDocuments` increase hydration time proportionally to PDF size.

---

## Flow: Document Upload — Markdown

### Trigger
User drops a `.md` or `.txt` file onto the upload zone, or selects one via the file picker in the `NuggetCreationModal` or `SourcesPanel`.

### Steps

1. **File drop detected** — `FileUpload` component or `UploadView` captures the `File` object from the drag event.

2. **Placeholder document created** — `createPlaceholderDocument(file)` in `utils/fileProcessing.ts` returns an `UploadedFile` with `status: 'processing'` and `progress: 0`. This is immediately added to `selectedNugget.documents` via `updateNugget()` in `AppContext.tsx` to show the document in the UI before processing completes.

3. **File read as text** — `processFileToDocument(file, id)` in `utils/fileProcessing.ts`. For `.md` files, `file.text()` reads the content as a UTF-8 string directly (no API call).

4. **Markdown structure parsed** — `parseMarkdownStructure(markdown)` in `utils/markdown.ts` walks the markdown string and extracts `Heading[]` with level, text, id, and `startIndex`.

5. **`UploadedFile` assembled** — `processFileToDocument()` returns an `UploadedFile` with `status: 'ready'`, `content: markdown`, `structure: Heading[]`, `originalFormat: 'md'`, `sourceOrigin: { type: 'uploaded', timestamp }`.

6. **Files API upload** — The calling handler in `App.tsx` calls `uploadToFilesAPI(content, filename, 'text/plain')` in `utils/ai.ts`. This POSTs the content as `multipart/form-data` to `/api/anthropic-files` (Vite proxy → `https://api.anthropic.com/v1/files`). The response `FilesAPIResponse.id` is stored as `UploadedFile.fileId`.

7. **State updated** — The nugget's document entry is updated with `fileId` and `status: 'ready'` via `updateNugget()`. A `DocChangeEvent` of type `'added'` is appended to `Nugget.docChangeLog`.

8. **Auto-save triggered** — The nugget reference changes, marking it dirty. `usePersistence` detects the change via object identity comparison and schedules a 1500ms debounced save.

### Error Handling
- If Files API upload fails, the document is updated to `status: 'error'` and a toast notification is shown.
- Network errors during upload propagate as thrown exceptions and are caught in the calling handler.

### Performance Considerations
- Markdown files are read entirely into memory as strings. Very large markdown files (>10MB) may impact performance.
- The Files API upload is fire-and-proceed; the document is usable in the UI immediately, but Claude cannot reference it by `fileId` until the upload completes.

---

## Flow: Document Upload — PDF (Convert to Markdown)

### Trigger
User drops a PDF file and selects "Convert to Markdown" in the `PdfUploadChoiceDialog`.

### Steps

1. **User choice captured** — `PdfUploadChoiceDialog` component renders when a PDF is dropped. User selects "Convert to Markdown". The `File` object is passed to the conversion handler in `App.tsx`.

2. **Placeholder document created** — `createPlaceholderDocument(file)` in `utils/fileProcessing.ts` returns an `UploadedFile` with `status: 'processing'`. Added to the nugget immediately.

3. **PDF read as base64** — `fileToBase64(file)` in `utils/fileProcessing.ts` reads the PDF via `FileReader.readAsDataURL` and strips the data URL prefix to get the raw base64 string.

4. **Gemini Flash conversion** — `convertPdfWithGemini(file)` in `utils/fileProcessing.ts` calls `getGeminiAI().models.generateContent()` with:
   - Model: `gemini-2.5-flash`
   - Content: `[{ inlineData: { data: base64, mimeType: 'application/pdf' } }, { text: PDF_CONVERSION_PROMPT }]`
   - Config: `{ httpOptions: { timeout: 300000 } }` (5-minute timeout)
   - Thinking parts (from Gemini 2.5) are filtered out: only parts where `p.text && !p.thought` are joined.
   - Wrapped in `withGeminiRetry()` for automatic retry on 429/500/503 errors with fallback key rotation.

5. **Markdown structure parsed** — Same as markdown upload: `parseMarkdownStructure(markdown)` extracts `Heading[]`.

6. **`UploadedFile` assembled** — `processFileToDocument()` returns the document with `content: markdown`, `originalFormat: 'pdf'`, `status: 'ready'`.

7. **Files API upload** — `uploadToFilesAPI(content, filename, 'text/plain')` uploads the converted markdown to Anthropic Files API. `fileId` stored on the document.

8. **State updated** — Same as markdown flow: nugget document updated with `fileId`, `DocChangeEvent` appended.

### Error Handling
- If Gemini returns no text or an empty response, `convertPdfWithGemini()` returns an empty string and the document is saved as an empty markdown file.
- `withGeminiRetry()` retries up to 5 times with exponential backoff (2s, 4s, 8s, 16s, capped at 32s). After exhausting the primary key, rotates to `GEMINI_API_KEY_FALLBACK` if available.
- Timeout is set to 300 seconds for large PDFs.

### Performance Considerations
- Gemini processing time scales with PDF size and complexity. Multi-hundred page PDFs may approach the 5-minute timeout.
- The base64 encoding of the PDF doubles the data size in memory before the API call.

---

## Flow: Document Upload — Native PDF

### Trigger
User drops a PDF file and selects "Keep as PDF" in the `PdfUploadChoiceDialog`.

### Steps

1. **User choice captured** — `PdfUploadChoiceDialog` returns the choice. The native PDF handler in `App.tsx` is invoked.

2. **Placeholder document created** — Added to nugget with `status: 'processing'`.

3. **PDF read as base64** — `processNativePdf(file, id)` in `utils/fileProcessing.ts` reads the PDF via `fileToBase64()`. Returns `UploadedFile` with `sourceType: 'native-pdf'`, `pdfBase64: base64`, `status: 'ready'`. No markdown conversion occurs.

4. **Heading extraction via Gemini** — `extractHeadingsWithGemini(file)` in `utils/fileProcessing.ts` sends the same base64 PDF to Gemini Flash with `HEADING_EXTRACTION_PROMPT`. The response is expected to be a JSON array. Gemini 2.5 thinking parts are filtered out. The raw response is cleaned of markdown fences and a regex `\[[\s\S]*\]` extracts the JSON array. Each entry `{ level, title, page }` is mapped to a `Heading` object with a generated `id`.
   - If extraction fails or returns no array, an empty `Heading[]` is returned (non-fatal; user can add headings manually).

5. **Structure stored** — The `Heading[]` is set on the `UploadedFile.structure` field.

6. **PDF uploaded to Files API** — `base64ToBlob(pdfBase64, 'application/pdf')` converts the base64 back to a `Blob`. `uploadToFilesAPI(blob, filename, 'application/pdf')` uploads the raw PDF to the Anthropic Files API. The `fileId` returned references the native PDF for Claude.

7. **MetaTOC created and uploaded** — `uploadMetaToc(docName, headings)` in `utils/metaToc.ts`:
   - `generateMetaTocMarkdown(headings)` converts `Heading[]` to a markdown string (`# Title (page N)` format)
   - `uploadToFilesAPI(content, filename + 'MetaTOC.md', 'text/markdown')` uploads it
   - Returns the MetaTOC `fileId` stored as `UploadedFile.metaTocFileId`

8. **State updated** — Nugget document updated with `fileId`, `metaTocFileId`, `structure`, `tocSource`, and `status: 'ready'`. `DocChangeEvent` of type `'added'` appended.

### Error Handling
- Heading extraction failure is silently swallowed; the document is usable without a structure.
- PDF Files API upload failure sets `status: 'error'` on the document.
- MetaTOC upload failure is non-fatal if the PDF was uploaded successfully; Claude will still have the raw PDF.

### Performance Considerations
- Two Files API uploads occur sequentially (PDF then MetaTOC). A 100-page PDF may be 5–20MB as base64.
- `pdfBase64` is stored in IndexedDB as a string, which may be large. This is a known concern for storage efficiency.

---

## Flow: Card Content Generation (3-Phase Pipeline)

### Trigger
User clicks "Generate" on a card in the Cards panel, or `handleGenerateAll()` is called for batch generation. `generateCard(card)` in `hooks/useCardGeneration.ts` is invoked.

### Steps

**Phase 1: Content Synthesis (Claude)**

1. **Card status updated** — `updateNuggetCard(card.id, ...)` sets `isGeneratingMap[currentLevel]: true`.

2. **Synthesis check** — If `card.synthesisMap?.[currentLevel]` already exists, synthesis is skipped and the cached content is used.

3. **`performSynthesis(card, level)` called** — `hooks/useCardGeneration.ts`:
   - Enabled documents filtered: `selectedNugget.documents.filter(d => d.enabled !== false && (d.content || d.fileId))`
   - Split into `fileApiDocs` (have `fileId`) and `inlineDocs` (have `content` but no `fileId`)
   - `inlineContent` is all inline documents joined with `\n\n---\n\n`

4. **Section context extracted** — `getSectionContext(card, activeStructure, inlineContent)` finds the markdown section between this card's heading and the next same-or-lower-level heading.

5. **Native PDF section hint built** — If there is no section context (native PDF case), `buildNativePdfSectionHint(card.text, enabledDocs)` in `utils/prompts/contentGeneration.ts` constructs a hint with page boundaries from `Heading.page` fields.

6. **Synthesis prompt built** — Branch on `isCoverLevel(level)`:
   - Cover: `buildCoverContentPrompt(card.text, level, inlineContent, sectionText, true, nuggetSubject)` from `utils/prompts/coverGeneration.ts`
   - Content: `buildContentPrompt(card.text, level, inlineContent, sectionText, true, nuggetSubject)` from `utils/prompts/contentGeneration.ts`

7. **System blocks assembled** — `[{ text: systemRole, cache: false }, { text: 'FULL DOCUMENT CONTEXT:\n' + inlineContent, cache: true }]`. Inline document context is marked `cache: true` for prompt caching.

8. **Files API document blocks prepended** — For each `fileApiDoc`, a content block `{ type: 'document', source: { type: 'file', file_id: d.fileId }, title: d.name }` is added to the first user message.

9. **`callClaude()` called** — `utils/ai.ts`. POST to `https://api.anthropic.com/v1/messages` with model `claude-sonnet-4-6`. `maxTokens` scales by level (256 for TitleCard, 350 for TakeawayCard, 300 for Executive, 600 for Standard, 1200 for Detailed). The document context system block gets `cache_control: { type: 'ephemeral' }` if `>= 4000` chars. The last user message also gets `cache_control`.

10. **Synthesis text stored** — `updateNuggetCard(card.id, c => ({ ...c, synthesisMap: { ...c.synthesisMap, [level]: synthesizedText }, isSynthesizingMap: { ...c.isSynthesizingMap, [level]: false } }))`. For non-cover levels, the first H1 is stripped and replaced with `# {card.text}`.

**Phase 2: Layout Planning (Claude)**

11. **Status updated** — `setCardStatus(card.id, 'Planning layout...')`.

12. **Planner prompt built** — Branch on `isCoverLevel(level)` and `settings.style === 'PwC Corporate'`:
    - PwC cover: `buildPwcCoverPlannerPrompt()` from `utils/prompts/pwcGeneration.ts` → returns JSON spec
    - Generic cover: `buildCoverPlannerPrompt()` from `utils/prompts/coverGeneration.ts`
    - PwC content: `buildPwcPlannerPrompt()` from `utils/prompts/pwcGeneration.ts` → returns JSON spec
    - Generic content: `buildPlannerPrompt(card.text, contentToMap, settings.aspectRatio, card.visualPlanMap?.[currentLevel], nuggetSubject)` from `utils/prompts/contentGeneration.ts`

13. **`callClaude()` called** — `utils/ai.ts`. `maxTokens: 4096`. If the planner step fails (any exception), it is caught and logged as a warning; generation continues without a visual plan (fallback to direct visualization).

14. **Visual plan cached** — `visualPlan` string stored; will be written to `card.visualPlanMap[currentLevel]` in step 17.

**Phase 3: Image Generation (Gemini Pro Image)**

15. **Visualizer prompt assembled** — Branch on `isCoverLevel` and `isPwc`:
    - PwC cover: `buildPwcCoverVisualizerPrompt()`
    - Generic cover: `buildCoverVisualizerPrompt()`
    - PwC content: `buildPwcVisualizerPrompt()`
    - Generic content: `buildVisualizerPrompt(card.text, contentToMap, settings, visualPlan, shouldUseRef, nuggetSubject)` from `utils/prompts/imageGeneration.ts`
    - Inside these builders, `transformContentToTags()` from `utils/prompts/promptUtils.ts` converts markdown syntax to bracketed tags (`[TITLE]`, `[SECTION]`, etc.), `fontToDescriptor()` replaces font names, `hexToColorName()` replaces hex colors.

16. **Reference image included** (optional) — If `referenceImage && useReferenceImage`, an `inlineData` part with the reference image base64 and MIME type is prepended to the Gemini request parts.

17. **`getGeminiAI().models.generateContent()` called** — `hooks/useCardGeneration.ts`:
    - Model: `gemini-3-pro-image-preview`
    - Config: `PRO_IMAGE_CONFIG` (`{ responseModalities: [Modality.TEXT, Modality.IMAGE] }`)
    - `imageConfig: { aspectRatio: settings.aspectRatio, imageSize: settings.resolution }`
    - Wrapped in `withGeminiRetry()` for retry + key rotation.

18. **Image extracted from response** — The first `inlineData` part in `response.candidates[0].content.parts` is converted to a data URL: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`.

19. **Card state updated** — `updateNuggetCard(card.id, c => ({ ...c, cardUrlMap: { ..., [currentLevel]: cardUrl }, isGeneratingMap: { ..., [currentLevel]: false }, imageHistoryMap: { ..., [currentLevel]: updatedHistory }, lastGeneratedContentMap: { ..., [currentLevel]: contentToMap }, visualPlanMap: { ..., [currentLevel]: visualPlan }, lastPromptMap: { ..., [currentLevel]: lastPrompt } }))`. Image history is capped at 10 entries.

20. **Token usage recorded** — `recordUsage()` is called for both Claude calls (phases 1 and 2) and the Gemini call (phase 3).

21. **Auto-save triggered** — Nugget reference changes; `usePersistence` schedules a 1500ms debounced save.

**Batch Generation:**
- `handleGenerateAll()` filters `selectedNugget.cards` for `selected === true` and sets `manifestCards`.
- `executeBatchCardGeneration()` calls `Promise.allSettled(selectedItems.map(item => generateCard(item)))` — all selected cards generate concurrently.

### Error Handling
- If synthesis fails, `isSynthesizingMap[level]` is reset to `false` and `null` is returned; generation is aborted for that card.
- If the planner fails, a warning is logged and generation continues without a visual plan.
- If image generation fails, a toast notification is shown with a "Retry" action. If the error is 503/overload-related, a warning toast is shown instead of an error toast. The retry callback invokes `generateCardRef.current(card)`.
- `withGeminiRetry()` handles 429/500/503 with exponential backoff and key rotation.

### Performance Considerations
- Synthesis uses prompt caching: the document context system block is cached after the first call. Subsequent calls for the same document set hit the cache.
- Batch generation runs concurrently (all cards at once), which may saturate API rate limits.
- Image generation is the slowest phase, typically 15–60 seconds per card.

---

## Flow: Auto-Deck Pipeline

### Trigger
User completes the briefing form in `AutoDeckPanel` and clicks "Generate Plan". `startPlanning(briefing, lod, orderedDocIds)` in `hooks/useAutoDeck.ts` is called.

### Steps

**Phase 1: Planning**

1. **Session created** — A new `AutoDeckSession` object is created with `status: 'planning'`. `setSession(newSession)`.

2. **Documents resolved** — `selectedNugget.documents` filtered and ordered by `orderedDocIds`. Split into `fileApiDocs` (have `fileId` but no inline content) and `inlineDocs` (have `content`).

3. **Token pre-flight** — `estimateTokens()` from `utils/tokenEstimation.ts` estimates input size of inline docs (~4 chars/token). If `> 180,000 tokens`, session is set to `status: 'error'`.

4. **Planner prompt built** — `buildPlannerPrompt({ briefing, lod, subject, documents, totalWordCount })` from `utils/prompts/autoDeckPlanner.ts` returns `{ systemBlocks, messages }`.

5. **Files API document blocks injected** — For each `fileApiDoc`, a `document` content block is prepended to the first user message.

6. **`callClaude()` called** — `utils/ai.ts`. `maxTokens: 16384`, `temperature: 0.1` (low temperature for deterministic planning).

7. **Response parsed** — `parsePlannerResponse(rawResponse)` in `utils/autoDeck/parsers.ts` returns `{ status: 'ok', plan: ParsedPlan }`, `{ status: 'conflict', conflicts: ConflictItem[] }`, or `{ status: 'error', error: string }`.

8. **Session transitioned**:
   - `'ok'` → `status: 'reviewing'`, `parsedPlan` set, `reviewState` initialized with all cards `included: true`
   - `'conflict'` → `status: 'conflict'`, `conflicts` set
   - `'error'` → `status: 'error'`

**Phase 1a: Conflict Resolution (optional)**
- If `status === 'conflict'`, the conflict UI is shown. When the user acknowledges and continues, the session is transitioned to `'reviewing'`.

**Phase 2: User Review**
- User toggles card inclusion via `toggleCardIncluded(cardNumber)`
- User answers MCQs via `setQuestionAnswer(questionId, optionKey)`
- User adds general comments via `setGeneralComment(comment)`
- All state updates via `updateSession()` mutate local `AutoDeckSession` state only.

**Revise (optional):**
- User clicks "Revise". `revisePlan()` in `hooks/useAutoDeck.ts` is called.
- Session set to `status: 'revising'`.
- `buildPlannerPrompt()` called with a `revision` object: `{ previousPlan, generalComment, cardComments: {}, excludedCards, questionAnswers }`.
- `callClaude()` called. Response parsed. Session transitioned back to `'reviewing'` with the new plan.
- `revisionCount` incremented. Max revisions: `AUTO_DECK_LIMITS.maxRevisions`.

**Phase 3: Finalization (conditional)**

9. **Approve triggered** — User clicks "Approve". `approvePlan()` in `hooks/useAutoDeck.ts` is called.

10. **Included cards filtered** — `session.parsedPlan.cards.filter(c => reviewState.cardStates[c.number]?.included !== false)`.

11. **Finalizer decision** — If `hasAnsweredQuestions || hasGeneralComment`:
    - `status: 'finalizing'`
    - `buildFinalizerPrompt({ briefing, lod, subject, plan: filteredPlan, questions, questionAnswers, generalComment })` from `utils/prompts/autoDeckPlanner.ts`
    - `callClaude()` called. `temperature: 0.1`, `maxTokens: 16384`.
    - `parseFinalizerResponse(rawResponse)` from `utils/autoDeck/parsers.ts` returns `{ status: 'ok', plan: ParsedPlan }`.
    - `finalizedPlan` is the AI-restructured plan with decisions baked in.
    - If no MCQ answers and no general comment: `finalizedPlan = filteredPlan` (the filtered plan is used directly).

**Phase 4: Production**

12. **`status: 'producing'`** set.

13. **Batching** — If `finalCards.length > 15`, `batchPlan(finalCards, 12)` from `utils/prompts/autoDeckProducer.ts` splits into batches of 12. Each batch is processed sequentially.

14. **Producer prompt built** — For each batch: `buildProducerPrompt({ briefing, lod, subject, plan: batch, documents: producerDocsMeta, batchContext? })` from `utils/prompts/autoDeckProducer.ts`. For multi-batch runs, `batchContext` lists other cards in the deck to avoid repetition.

15. **Files API document blocks injected** — Same pattern as planner.

16. **`callClaude()` called** — `maxTokens` scaled by batch size and LOD word count max: `Math.min(64000, batch.length * tokensPerCard + 500)`.

17. **Response parsed** — `parseProducerResponse(rawResponse)` from `utils/autoDeck/parsers.ts` returns `{ status: 'ok', cards: ProducedCard[] }` where each `ProducedCard` has `{ number, title, content, wordCount }`.

18. **`Card` objects created** — For each `ProducedCard`:
    - `getUniqueName(pc.title, existingCardNames)` from `utils/naming.ts` ensures no duplicate card names (Windows-style "(2)" suffix)
    - `Card` created: `{ id, level: 1, text: uniqueName, detailLevel, synthesisMap: { [detailLevel]: '# title\n\ncontent' }, createdAt, sourceDocuments, autoDeckSessionId: session.id }`

19. **Cards appended to nugget** — `updateNugget(selectedNugget.id, n => ({ ...n, cards: [...n.cards, ...newCards] }))` in `AppContext.tsx`.

20. **Session set to `'complete'`**. Success toast shown.

### Error Handling
- `AbortError` from `abortController.abort()` is silently ignored; session transitions back to a safe state.
- Planning/revision failures set `status: 'error'`.
- Finalization failure throws; production is not attempted.
- Production failure sets `status: 'error'`; cards produced in completed batches are lost (no partial commit).
- `retryFromReview()` transitions an error session back to `'reviewing'` if a `parsedPlan` exists.

### Performance Considerations
- The pre-flight token check prevents calls that would exceed Claude's 200K context window.
- Batching (batch size 12) prevents oversized producer prompts for large decks.
- All Claude calls use `temperature: 0.1` for the planner/finalizer (deterministic); the producer uses the default temperature.

---

## Flow: Insights Chat Message

### Trigger
User types a message in `ChatPanel` and submits. `sendMessage(text, isCardRequest, detailLevel)` in `hooks/useInsightsLab.ts` is called.

### Steps

1. **Document context resolved** — `resolveDocumentContext()` filters `selectedNugget.documents` for `(doc.content || doc.fileId) && doc.enabled !== false`. Returns `{ name, content, fileId?, metaTocFileId? }[]`.

2. **User message created** — `ChatMessage` with `role: 'user'`, random `id`, current timestamp.

3. **User message appended** — `appendNuggetMessage(userMessage)` in `AppContext.tsx` immediately adds the message to `selectedNugget.messages`.

4. **`isLoading` set to `true`**. `AbortController` created.

5. **Document split** — `fileApiDocs` (have `fileId`) and `inlineDocs` (have `content` but no `fileId`).

6. **System blocks assembled**:
   - Block 1: `buildInsightsSystemPrompt(selectedNugget?.subject)` from `utils/prompts/insightsLab.ts` (not cached)
   - Block 2 (if inline docs): `"Current documents:\n\n{docContext}"` marked `cache: true`
   - Block 3 (if `isCardRequest`): `buildCardContentInstruction(detailLevel)` or `buildCoverContentInstruction(detailLevel)` (not cached)

7. **Token budget computed** — `computeMessageBudget(systemBlocks, maxTokens)` from `utils/tokenEstimation.ts` estimates system block token consumption and subtracts from the 200K window (with 2K safety margin). If budget `<= 0`, an error message is appended and the call is aborted.

8. **Message history pruned** — `pruneMessages(history, text, messageBudget)` from `utils/tokenEstimation.ts` estimates token usage of all messages and drops oldest messages until the total fits in `messageBudget`. Returns `{ claudeMessages: ClaudeMessage[], dropped: number }`.

9. **Files API document blocks injected** — For each `fileApiDoc`, a `document` block `{ type: 'document', source: { type: 'file', file_id }, title: name }` is built. If `metaTocFileId` exists, a companion block `{ title: '{name} - Table of Contents' }` is added. These blocks are prepended to the first user message's content array.

10. **`callClaude()` called** — `utils/ai.ts`. `maxTokens` scales by `isCardRequest` and `detailLevel` (150 for TitleCard, 350 for TakeawayCard, 300 for Executive, 600 for Standard, 1200 for Detailed, 8192 for regular chat). `signal: controller.signal` for cancellation.

11. **Token usage recorded** — `recordUsage()` called with `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`.

12. **Assistant message appended** — `appendNuggetMessage(assistantMessage)`. For card requests, `isCardContent: true` and `detailLevel` are set.

13. **Document hash updated** — `computeDocumentHash(selectedNugget.documents)` from `utils/documentHash.ts` computes a djb2 hash of all enabled document contents. Stored as `Nugget.lastDocHash` via `setNuggets()`.

14. **Auto-save triggered** — Nugget reference changes.

**Document Change Continuation Flow:**
If `pendingDocChanges.length > 0` when the user submits, `handleDocChangeContinue()` is called instead of `sendMessage()` directly:
- A `system`-role `ChatMessage` summarizing the changes (via `buildChangeSummary(changes)`) is appended to the nugget's messages.
- `lastDocChangeSyncIndex` is advanced to `docChangeLog.length`.
- `sendMessage(text, isCardRequest, detailLevel, updatedMessages)` is called with the updated messages array passed explicitly (bypassing the stale React closure).

### Error Handling
- `AbortError` (from `stopResponse()`) is silently ignored.
- Token overflow errors: if the error message includes `'prompt is too long'`, a user-friendly error message with remediation steps is appended as an assistant message.
- All other errors: `err.message` is appended as an error assistant message.

### Performance Considerations
- The document context system block is cached after the first call within a conversation. Cache hits reduce token costs significantly for repeated messages.
- `pruneMessages()` ensures the conversation history stays within the token budget by dropping oldest messages.

---

## Flow: Save Card from Chat

### Trigger
User clicks "Save as Card" on an assistant message in `ChatPanel` that has `isCardContent: true`.

### Steps

1. **Message located** — The `ChatMessage` with `isCardContent: true` is found in `selectedNugget.messages`.

2. **New `Card` created** — In the handler in `App.tsx` (or `ChatPanel`):
   ```ts
   const newCard: Card = {
     id: `card-${Math.random().toString(36).substr(2, 9)}`,
     level: 1,
     text: cardTitle,
     detailLevel: message.detailLevel,
     synthesisMap: { [message.detailLevel]: message.content },
     createdAt: Date.now(),
     sourceDocuments: enabledDocNames,
   };
   ```

3. **Card name de-duplicated** — `getUniqueName(cardTitle, existingCardNames)` from `utils/naming.ts` appends `(2)`, `(3)`, etc. if needed.

4. **Nugget updated** — `updateNugget(nuggetId, n => ({ ...n, cards: [...n.cards, newCard] }))` in `AppContext.tsx`.

5. **Message marked as saved** — The `ChatMessage.savedAsCardId` field is set to `newCard.id` via a second `setNuggets()` call.

6. **Auto-save triggered** — Nugget reference changes.

### Error Handling
- No API calls; purely in-memory operation. No error handling needed beyond null checks.

---

## Flow: Auto-Save Cycle

### Trigger
Any state change to `nuggets`, `projects`, `selectedNuggetId`, `activeCardId`, or `customStyles` in `AppContext`. `usePersistence` in `hooks/usePersistence.ts` responds via `useEffect` dependencies.

### Steps

**App State (lightweight, 300ms debounce):**

1. **`useEffect` fires** — Triggered by changes to `selectedNuggetId` or `activeCardId`.
2. **Debounce timer reset** — Previous timer cleared; new 300ms timer started.
3. **`storage.saveAppState()` called** — `IndexedDBBackend.saveAppState(state)` in `utils/storage/IndexedDBBackend.ts`. Opens a `readwrite` transaction on `appState`. Puts `{ selectedNuggetId, activeCardId }` at key `'current'`.

**Nugget Data (1500ms debounce):**

1. **`useEffect` fires** — Triggered by changes to `nuggets` array reference.
2. **Hydration guard** — If `hydrationDone.current === false` (first 2 seconds after mount), the save is skipped to avoid writing hydrated state back.
3. **Debounce timer reset** — 1500ms timer.
4. **`saveAllNuggets()` called**:
   a. For each nugget, dirty detection via object identity: `prevNuggetsRef.current.get(nugget.id) === nugget`. If same reference, skip.
   b. For dirty nuggets: `serializeNugget(nugget)` → `StoredNugget`. `serializeCard(card, nugget.id)` for each card → `StoredHeading[]`. `extractImages(card, nugget.id)` for each card → `StoredImage[]`. `serializeNuggetDocument(nugget.id, doc)` for ready documents → `StoredNuggetDocument[]`.
   c. **Atomic save**: `storage.saveNuggetDataAtomic(nuggetId, storedNugget, storedCards, allImages, storedDocs)` in `IndexedDBBackend.ts`. Opens a single `readwrite` transaction spanning `nuggets`, `nuggetHeadings`, `nuggetImages`, `nuggetDocuments`.
   d. **Image Blob conversion**: Before the transaction opens, all `StoredImage` objects are converted to `StoredImageBlob` via `imageToBlobStorage()`. Data URLs → Blob via `dataUrlToBlob()`; blob URLs → Blob via `fetch(url).blob()`. This async work completes before the transaction opens (IndexedDB transactions auto-commit if the event loop goes idle during async work).
   e. **Orphan cleanup**: After the atomic save, `storage.loadNuggetDocuments()` is compared against current documents; stale entries are deleted. Same for images via `storage.loadNuggetImages()`.
   f. **Deleted nugget cleanup**: `storage.loadAllNuggetIds()` compared against current nugget IDs; removed nuggets have all four stores deleted.
5. **Snapshot updated** — `prevNuggetsRef.current` updated with the new nugget identity map.

**Custom Styles (300ms debounce):**
- `storage.saveCustomStyles(styles)` puts the `CustomStyle[]` array at key `'customStyles'` in the `appState` store.

### Error Handling
- All save operations are wrapped in `.catch(err => console.warn(...))`. Save failures are logged but do not affect app state.
- Orphan cleanup failures are also non-fatal.

### Performance Considerations
- Object identity comparison (`===`) means only mutated nuggets are serialized and written. If only one nugget is modified, only that nugget's data is written.
- Blob storage in `nuggetImages` provides ~33% storage savings over base64 strings.
- The 1500ms debounce prevents rapid successive saves during generation (which updates card state on every frame).

---

## Flow: Document Save (Edit)

### Trigger
User edits a document in `DocumentEditorModal` and clicks "Save". `saveEdits()` in `hooks/useDocumentEditing.ts` is called, which invokes the `onSave(markdown)` callback.

### Steps

1. **`saveEdits()` called** — `hooks/useDocumentEditing.ts`. `htmlToMarkdown(editorRef.current.innerHTML)` from `utils/markdown.ts` converts the contentEditable DOM back to a markdown string. `onSave(newMarkdown)` callback is invoked.

2. **`onSave` handler in `App.tsx`** receives the new markdown string.

3. **Old Files API file deleted** — If `doc.fileId` exists, `deleteFromFilesAPI(doc.fileId)` from `utils/ai.ts` is called. This is a fire-and-forget DELETE to `/api/anthropic-files/{fileId}`. Errors are logged but not thrown.

4. **New Files API file uploaded** — `uploadToFilesAPI(newMarkdown, doc.name, 'text/plain')` from `utils/ai.ts`. POST to `/api/anthropic-files`. Returns the new `fileId`.

5. **Markdown structure re-parsed** — `parseMarkdownStructure(newMarkdown)` from `utils/markdown.ts` extracts an updated `Heading[]`.

6. **Nugget document updated** — `updateNugget(nuggetId, n => ({ ...n, documents: n.documents.map(d => d.id === doc.id ? { ...d, content: newMarkdown, fileId: newFileId, structure: newStructure, lastEditedAt: Date.now(), version: (d.version ?? 1) + 1 } : d) }))`.

7. **`DocChangeEvent` appended** — Type `'updated'` event appended to `Nugget.docChangeLog`.

8. **Auto-save triggered** — Nugget reference changes.

### Error Handling
- If the new Files API upload fails, the document retains its old `fileId` and the update fails. A toast notification is shown.
- The old file deletion is fire-and-forget; if it fails, the file is orphaned on the Files API (expires in 60 minutes anyway).

### Performance Considerations
- The old file must be deleted before a new one is uploaded to avoid accumulating orphaned files on the Files API.
- Large markdown documents may take several seconds to upload.

---

## Flow: TOC Edit (Native PDF)

### Trigger
User edits the table of contents (heading structure) in `SourcesPanel` for a native PDF document while in draft mode. User clicks "Save TOC". `handleSaveToc(docId, newHeadings)` in `App.tsx` is called.

### Steps

1. **Draft mode entered** — When the user clicks "Edit TOC" in `SourcesPanel`, a hard-lock overlay (`z-[106]`) is applied to the entire UI via state in `App.tsx`. Edits are staged in local component state (`tocDraft`).

2. **`handleSaveToc(docId, newHeadings)` called** — In `App.tsx`.

3. **Old MetaTOC deleted, new uploaded** — `replaceMetaToc(doc.metaTocFileId, doc.name, newHeadings)` from `utils/metaToc.ts`:
   - If `oldFileId` exists: `deleteFromFilesAPI(oldFileId)` (fire-and-forget)
   - `uploadMetaToc(docName, newHeadings)`:
     - `generateMetaTocMarkdown(newHeadings)` produces `# Heading (page N)` markdown
     - `uploadToFilesAPI(content, filename + 'MetaTOC.md', 'text/markdown')` returns the new `metaTocFileId`

4. **Nugget document updated** — `updateNugget()` updates the document with `structure: newHeadings`, `metaTocFileId: newMetaTocFileId`, `version: (d.version ?? 1) + 1`.

5. **`DocChangeEvent` appended** — Type `'toc_updated'` event appended to `Nugget.docChangeLog`.

6. **Hard lock overlay removed** — Draft mode exited.

7. **Auto-save triggered** — Nugget reference changes.

### Error Handling
- If the MetaTOC upload fails, the error is surfaced to the user via toast. The document structure remains unchanged (the old `metaTocFileId` is retained if the delete was fire-and-forget).

### Performance Considerations
- The MetaTOC file is a small markdown file (proportional to the number of headings). Upload is fast.
- The hard lock overlay prevents any other operations while the TOC is in draft mode, ensuring consistency.
