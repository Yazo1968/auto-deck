# InfoNugget v6.0 — Custom Hook Documentation

---

## Hook: `useCardGeneration`

**File:** `hooks/useCardGeneration.ts`
**Lines:** ~465
**Purpose:** Encapsulates the 3-phase card generation pipeline (content synthesis → layout planning → image generation), per-card status tracking, batch generation, image modification callbacks, and version history management.

### Interface

```ts
export function useCardGeneration(
  menuDraftOptions: StylingOptions,
  referenceImage: ReferenceImage | null = null,
  useReferenceImage: boolean = false,
  recordUsage?: RecordUsageFn,
): {
  genStatus: string;
  activeLogicTab: DetailLevel;
  setActiveLogicTab: (level: DetailLevel) => void;
  manifestCards: Card[] | null;
  setManifestCards: (cards: Card[] | null) => void;
  currentSynthesisContent: string;
  contentDirty: boolean;
  selectedCount: number;
  generateCard: (card: Card, skipReferenceOnce?: boolean) => Promise<void>;
  handleGenerateAll: () => void;
  executeBatchCardGeneration: () => Promise<void>;
  handleImageModified: (cardId: string, newImageUrl: string, history: ImageVersion[]) => void;
}
```

### Internal State

| Variable | Type | Purpose |
|----------|------|---------|
| `genStatusMap` | `Record<string, string>` | Per-card generation status messages |
| `activeLogicTab` | `DetailLevel` | Currently selected detail level for the UI tab |
| `manifestCards` | `Card[] \| null` | Cards queued for batch generation; null when no batch is pending |
| `generateCardRef` | `React.MutableRefObject<(card: Card) => Promise<void>>` | Stable ref to `generateCard` used by error-toast retry closure |

### Key Functions

#### `setCardStatus(cardId, status)`
**Trigger:** Called internally at the start/end of each generation phase.
**Steps:** Merges or removes `cardId` key in `genStatusMap`.
**State modified:** `genStatusMap`.

#### `genStatus` (derived)
**Trigger:** Computed via `useMemo` whenever `genStatusMap` or `activeCardId` changes.
**Steps:** Looks up `genStatusMap[activeCardId]`.
**Side effects:** None.

#### `performSynthesis(card, level)`
**Trigger:** Called from `generateCard` when `card.synthesisMap[level]` is absent.
**Steps:**
1. Resolves enabled documents from `selectedNugget.documents` where `enabled !== false` and `content || fileId` exists.
2. Splits docs into `fileApiDocs` (have `fileId`) and `inlineDocs` (have `content`, no `fileId`).
3. Calls `getSectionContext(card, activeStructure, inlineContent)` to extract the relevant section from inline markdown.
4. If no inline section text and `fileApiDocs` exist, calls `buildNativePdfSectionHint(card.text, enabledDocs)` for a page-boundary hint.
5. Calls `buildCoverContentPrompt` or `buildContentPrompt` depending on `isCoverLevel(level)`.
6. Builds `systemBlocks`: `[systemRole (uncached), inlineContent (cached if present)]`.
7. If `fileApiDocs` exist, builds a `messages` array with document content blocks prepended.
8. Calls `callClaude(prompt, { systemBlocks, messages?, maxTokens })`. `maxTokens` by level: TakeawayCard=350, TitleCard=256, Executive=300, Standard=600, Detailed=1200.
9. Strips any leading `# heading` from the response; prepends `# cardTitle`.
10. Calls `updateNuggetCard` to set `synthesisMap[level]`; clears `isSynthesizingMap[level]`.
**State modified:** `Card.synthesisMap[level]`, `Card.isSynthesizingMap[level]`.
**Side effects:** Claude API call; `recordUsage` invoked with Claude usage.
**Error handling:** Catches any error, clears `isSynthesizingMap[level]`, returns `null`.

#### `generateCard(card, skipReferenceOnce?)`
**Trigger:** User clicks "Generate" on a card, or `executeBatchCardGeneration` iterates over the manifest.
**Steps:**
1. If `aistudio` window object present and no key selected, opens key selection dialog.
2. Copies `menuDraftOptions` to `settings`; reads `currentLevel = settings.levelOfDetail`.
3. Sets `isGeneratingMap[currentLevel]: true` on the card.
4. If `synthesisMap[currentLevel]` is absent, calls `performSynthesis(card, currentLevel)`.
5. Determines if PwC style: `isPwc = settings.style === 'PwC Corporate'`.
6. Calls the appropriate planner function based on `isCover` and `isPwc`. All planners receive `card.visualPlanMap[currentLevel]` as `previousPlan` if present.
7. Calls `callClaude(plannerPrompt, { maxTokens: 4096 })`; records usage.
8. Calls the appropriate visualizer builder (`buildVisualizerPrompt`, `buildPwcVisualizerPrompt`, `buildCoverVisualizerPrompt`, or `buildPwcCoverVisualizerPrompt`).
9. If `shouldUseRef` (reference enabled and not skipped once): prepends `inlineData` part from `referenceImage.url` to the Gemini request.
10. Calls `withGeminiRetry(() => getGeminiAI().models.generateContent(...))` with `PRO_IMAGE_CONFIG` and `imageConfig: { aspectRatio, imageSize: resolution }`.
11. Records Gemini usage via `recordUsage`.
12. Extracts base64 PNG from `imageResponse.candidates[0].content.parts`.
13. Builds version history: if a previous `cardUrlMap[currentLevel]` exists and is not already the last history entry, pushes it; pushes the new image. Caps at 10 entries.
14. Calls `updateNuggetCard` to set `cardUrlMap`, `isGeneratingMap`, `imageHistoryMap`, `lastGeneratedContentMap`, `visualPlanMap`, `lastPromptMap`.
**State modified:** All `Card.*Map[level]` fields.
**Side effects:** Claude API call (planner), Gemini Pro Image API call; `recordUsage` called twice; toast on error.
**Error handling:** Detects overloaded model (503/unavailable/high demand) → warning toast with retry; other errors → error toast with retry. Always clears `isGeneratingMap[currentLevel]` in `finally`.

#### `handleGenerateAll()`
**Trigger:** User clicks "Generate All".
**Steps:** Filters `selectedNugget.cards` for `c.selected === true`; if none, shows info toast; otherwise sets `manifestCards` to the selected array.
**State modified:** `manifestCards`.

#### `executeBatchCardGeneration()`
**Trigger:** Called from `App.tsx` after user confirms the batch manifest dialog.
**Steps:**
1. Copies `manifestCards`, clears it to null.
2. Sets `'Queued for batch generation...'` status on each card.
3. Calls `Promise.allSettled(selectedItems.map(item => generateCard(item)))`.
**State modified:** `genStatusMap` (cleared per card in `generateCard`'s finally block).
**Side effects:** Multiple parallel Claude + Gemini calls.

#### `handleImageModified(cardId, newImageUrl, history)`
**Trigger:** Called by `AssetsPanel` / `ZoomOverlay` after `executeModification` or `executeContentModification` completes.
**Steps:** Updates `cardUrlMap[level]`, `imageHistoryMap[level]`, `lastGeneratedContentMap[level]` via `updateNuggetCard`.
**State modified:** Card fields.

### External Dependencies
- `useAppContext` — `selectedNugget`, `activeCardId`, `updateNuggetCard`
- `useToast` — `addToast` for error/warning toasts
- `callClaude` (utils/ai.ts) — Phase 1 (synthesis) and Phase 2 (planning)
- `withGeminiRetry`, `getGeminiAI`, `PRO_IMAGE_CONFIG` (utils/ai.ts) — Phase 3 (image generation)
- `buildContentPrompt`, `buildPlannerPrompt`, `buildNativePdfSectionHint` (utils/prompts/contentGeneration.ts)
- `buildVisualizerPrompt` (utils/prompts/imageGeneration.ts)
- `buildCoverContentPrompt`, `buildCoverPlannerPrompt`, `buildCoverVisualizerPrompt` (utils/prompts/coverGeneration.ts)
- `buildPwcPlannerPrompt`, `buildPwcVisualizerPrompt`, `buildPwcCoverPlannerPrompt`, `buildPwcCoverVisualizerPrompt` (utils/prompts/pwcGeneration.ts)
- `buildExpertPriming` (utils/prompts/promptUtils.ts)
- `extractBase64`, `extractMime` (utils/modificationEngine.ts)

### Lifecycle
- No `useEffect` triggers. All state is updated reactively through `updateNuggetCard` calls.
- `generateCardRef.current` is reassigned on every render to keep the retry closure current.

### Error Handling
- `performSynthesis`: try/catch logs error, clears synthesizing state, returns null.
- `generateCard`: try/catch classifies errors as overloaded vs other; both show toast with `onRetry` callback calling `generateCardRef.current(card)`. `finally` always clears `isGeneratingMap[currentLevel]` and card status.
- Planner step failure is soft (logs warning, continues without visual plan).

---

## Hook: `useAutoDeck`

**File:** `hooks/useAutoDeck.ts`
**Lines:** ~722
**Purpose:** Implements the full Auto-Deck state machine from briefing configuration through Planner, user review, optional Finalizer, Producer, and card creation. Manages the `AutoDeckSession` object and all Claude API calls.

### Interface

```ts
export function useAutoDeck(recordUsage?: RecordUsageFn): {
  session: AutoDeckSession | null;
  startPlanning: (briefing: AutoDeckBriefing, lod: AutoDeckLod, orderedDocIds: string[]) => Promise<void>;
  revisePlan: () => Promise<void>;
  approvePlan: () => Promise<void>;
  abort: () => void;
  reset: () => void;
  retryFromReview: () => void;
  toggleCardIncluded: (cardNumber: number) => void;
  setQuestionAnswer: (questionId: string, optionKey: string) => void;
  setAllRecommended: () => void;
  setGeneralComment: (comment: string) => void;
}
```

### Internal State

| Variable | Type | Purpose |
|----------|------|---------|
| `session` | `AutoDeckSession \| null` | Full session state including status, plan, review state, produced cards |
| `abortRef` | `React.MutableRefObject<AbortController \| null>` | In-flight abort handle for Claude calls |

### Key Functions

#### `updateSession(updater)`
**Trigger:** All state mutation helpers call this.
**Steps:** Applies the updater function to the current `session` if non-null.
**State modified:** `session`.

#### `setStatus(status)`
**Trigger:** Internal; called at each phase transition.
**Steps:** Calls `updateSession(s => ({ ...s, status }))`.

#### `startPlanning(briefing, lod, orderedDocIds)`
**Trigger:** User clicks "Generate Plan" in `AutoDeckPanel`.
**Steps:**
1. Resolves documents from `selectedNugget.documents` in the user-specified `orderedDocIds` order.
2. Splits into `fileApiDocs` (have `fileId`, no `content`) and `inlineDocs` (have `content`).
3. Computes `totalWordCount` for inline docs via `countWords`.
4. Creates a new `AutoDeckSession` with `status: 'planning'`.
5. Estimates tokens via `estimateTokens(inlineContent)`; if >180K, sets `status: 'error'`.
6. Creates `AbortController`; stores in `abortRef`.
7. Calls `buildPlannerPrompt({ briefing, lod, subject, documents: allDocsMeta, totalWordCount })` to get `{ systemBlocks, messages }`.
8. If `fileApiDocs` exist, prepends document content blocks to `messages[0]`.
9. Calls `callClaude('', { systemBlocks, messages, maxTokens: 16384, temperature: 0.1, signal })`.
10. Records usage.
11. Calls `parsePlannerResponse(rawResponse)`:
    - `status: 'conflict'` → sets session `status: 'conflict'`, stores `conflicts`.
    - `status: 'ok'` → initializes `reviewState.cardStates` with all cards `included: true`; sets session `status: 'reviewing'`, stores `parsedPlan`.
    - `status: 'error'` → sets `status: 'error'`, stores error message.
**State modified:** `session`.
**Side effects:** Claude API call; `recordUsage`.
**Error handling:** `AbortError` silently returns. Other errors set `status: 'error'` with message.

#### `revisePlan()`
**Trigger:** User clicks "Revise Plan" in review mode.
**Steps:**
1. Checks `revisionCount < AUTO_DECK_LIMITS.maxRevisions`.
2. Sets `status: 'revising'`.
3. Resolves documents same as `startPlanning`.
4. Extracts `excludedCards` from `reviewState.cardStates`.
5. Calls `buildPlannerPrompt` with `revision: { previousPlan, generalComment, cardComments: {}, excludedCards, questionAnswers }`.
6. Injects Files API document blocks.
7. Calls `callClaude`. Records usage.
8. Parses response:
    - `status: 'ok'` → resets `reviewState` with new plan's card states; increments `revisionCount`; sets `status: 'reviewing'`.
    - `status: 'conflict'` → sets `status: 'conflict'`; increments `revisionCount`.
    - `status: 'error'` → sets `status: 'error'`.
**State modified:** `session`.

#### `approvePlan()`
**Trigger:** User clicks "Approve & Generate Content".
**Steps:**
1. Resolves documents; splits into fileApiDocs and inlineDocs.
2. Filters `includedCards` from `parsedPlan.cards` where `reviewState.cardStates[n].included !== false`.
3. Validates at least one card included.
4. **Phase 1 — Finalize** (only if MCQ answers or general comment exist):
   - Sets `status: 'finalizing'`.
   - Calls `buildFinalizerPrompt({ briefing, lod, subject, plan: filteredPlan, questions, questionAnswers, generalComment })`.
   - Calls `callClaude('', { systemBlocks, messages, maxTokens: 16384, temperature: 0.1, signal })`.
   - Records usage. Calls `parseFinalizerResponse(rawResponse)`.
   - Updates `session.parsedPlan` with finalized plan.
5. **Phase 2 — Produce**:
   - Sets `status: 'producing'`.
   - If `finalCards.length > 15`: `batchPlan(finalCards, 12)` → multiple batches.
   - For each batch: builds `batchContext` string listing other cards to avoid repetition.
   - Calls `buildProducerPrompt({ briefing, lod, subject, plan: batch, documents: producerDocsMeta, batchContext })`.
   - Injects Files API document blocks.
   - `maxTokens = Math.min(64000, batch.length * tokensPerCard + 500)` where `tokensPerCard = Math.ceil(lodConfig.wordCountMax * 1.5 * 1.3)`.
   - Calls `callClaude`. Records usage. Calls `parseProducerResponse(rawResponse)`.
   - Collects `ProducedCard[]` across all batches.
6. **Card creation**:
   - Maps each `ProducedCard` to a `Card` object: `text` = unique name (via `getUniqueName`), `detailLevel` = LOD level, `synthesisMap: { [detailLevel]: '# title\n\ncontent' }`.
   - Calls `updateNugget(selectedNugget.id, n => ({ ...n, cards: [...n.cards, ...newCards] }))`.
   - Sets `status: 'complete'`.
   - Shows success toast with card count.
**State modified:** `session`, `Nugget.cards`.
**Side effects:** 2-3 Claude API calls; `recordUsage` per call; toast notification.
**Error handling:** `AbortError` returns silently. Producer parse error throws; `status: 'error'`.

#### `toggleCardIncluded(cardNumber)`, `setQuestionAnswer(questionId, optionKey)`, `setGeneralComment(comment)`, `setAllRecommended()`
**Trigger:** User interaction in review UI.
**Steps:** Each calls `updateSession` to update the corresponding field in `reviewState`.

#### `abort()`
**Trigger:** User clicks abort button.
**Steps:** `abortRef.current?.abort()`; if status is `finalizing/producing/revising` → returns to `reviewing` or `configuring`; if `planning` → returns to `configuring`.

#### `reset()`
**Trigger:** User starts a new session.
**Steps:** Aborts in-flight request; sets `session` to `null`.

#### `retryFromReview()`
**Trigger:** User retries from an error state that has a saved plan.
**Steps:** Sets `status: 'reviewing'`, clears `error`.

### External Dependencies
- `useAppContext` — `selectedNugget`, `updateNugget`
- `useToast` — `addToast`
- `callClaude` (utils/ai.ts)
- `buildPlannerPrompt`, `buildFinalizerPrompt` (utils/prompts/autoDeckPlanner.ts)
- `buildProducerPrompt`, `batchPlan` (utils/prompts/autoDeckProducer.ts)
- `parsePlannerResponse`, `parseFinalizerResponse`, `parseProducerResponse` (utils/autoDeck/parsers.ts)
- `AUTO_DECK_LOD_LEVELS`, `AUTO_DECK_LIMITS`, `countWords` (utils/autoDeck/constants.ts)
- `getUniqueName` (utils/naming.ts)
- `estimateTokens` (utils/tokenEstimation.ts)

### Lifecycle
- No `useEffect` triggers. All state is imperative (driven by user actions).
- `abortRef` is cleaned up in `finally` blocks of async functions.

### Error Handling
- All three async functions (`startPlanning`, `revisePlan`, `approvePlan`) catch errors and set `session.status = 'error'` with the error message.
- `AbortError` is caught and returns silently without setting error state.
- `finally` blocks null-out `abortRef.current`.

---

## Hook: `useInsightsLab`

**File:** `hooks/useInsightsLab.ts`
**Lines:** ~366
**Purpose:** Manages the Insights Chat state, sends messages to Claude with multi-turn history and prompt caching, handles card content request mode, tracks document changes, and provides change-notification flow helpers.

### Interface

```ts
export function useInsightsLab(recordUsage?: RecordUsageFn): {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (text: string, isCardRequest?: boolean, detailLevel?: DetailLevel, messagesOverride?: ChatMessage[]) => Promise<void>;
  stopResponse: () => void;
  clearMessages: () => void;
  pendingDocChanges: DocChangeEvent[];
  hasConversation: boolean;
  handleDocChangeContinue: (text: string, isCardRequest?: boolean, detailLevel?: DetailLevel) => Promise<void>;
  handleDocChangeStartFresh: () => void;
}
```

### Internal State

| Variable | Type | Purpose |
|----------|------|---------|
| `isLoading` | `boolean` | True while Claude is processing the current request |
| `abortRef` | `React.MutableRefObject<AbortController \| null>` | In-flight abort handle |

### Key Functions

#### `resolveDocumentContext()`
**Trigger:** Called at the start of every `sendMessage` invocation.
**Steps:** Reads `selectedNugget.documents`; filters where `(content || fileId) && enabled !== false`; maps to `{ name, content, fileId, metaTocFileId }`.
**Returns:** `Array<{ name, content, fileId?, metaTocFileId? }>`.

#### `sendMessage(text, isCardRequest, detailLevel, messagesOverride?)`
**Trigger:** User submits a message in `ChatPanel`.
**Steps:**
1. Validates `selectedNugget` and non-empty `text`.
2. Resolves `resolvedDocs`; uses `messagesOverride` or `selectedNugget.messages` as `history`.
3. Creates `userMessage: ChatMessage` and immediately calls `appendNuggetMessage(userMessage)`.
4. Sets `isLoading: true`; creates `AbortController`.
5. Splits `resolvedDocs` into `fileApiDocs` and `inlineDocs`.
6. Builds `systemBlocks`:
   - Block 0: `buildInsightsSystemPrompt(selectedNugget?.subject)` — uncached.
   - Block 1 (if inlineDocs): inline document context — `cache: true`.
   - Block 2 (if `isCardRequest`): `buildCardContentInstruction(detailLevel)` or `buildCoverContentInstruction(detailLevel)` — uncached.
7. Sets `maxTokens` based on `isCardRequest` and `detailLevel` (TitleCard=150, TakeawayCard=350, Executive=300, Standard=600, Detailed=1200; default 8192).
8. Calls `computeMessageBudget(systemBlocks, maxTokens)`; if ≤0, appends error message and returns.
9. Calls `pruneMessages(history, text.trim(), messageBudget)` to build `claudeMessages` fitting the budget.
10. If `fileApiDocs` exist: builds document content blocks (including MetaTOC companions via `metaTocFileId`); prepends to `claudeMessages[0]`.
11. Calls `callClaude('', { systemBlocks, messages: claudeMessages, maxTokens, signal })`.
12. Records Claude usage via `recordUsage`.
13. Creates `assistantMessage: ChatMessage` with `isCardContent` and `detailLevel` if card request.
14. Calls `appendNuggetMessage(assistantMessage)`.
15. Updates `Nugget.lastDocHash` with `computeDocumentHash(selectedNugget.documents)`.
**State modified:** `isLoading`, `Nugget.messages`, `Nugget.lastDocHash`.
**Side effects:** Claude API call; `recordUsage`.
**Error handling:** `AbortError` silently returns. Token overflow error produces a user-visible markdown message. Other errors produce generic error message. Both appended via `appendNuggetMessage`. `finally` clears `abortRef` and `isLoading`.

#### `stopResponse()`
**Trigger:** User clicks "Stop".
**Steps:** `abortRef.current?.abort()`; sets `isLoading: false`.

#### `clearMessages()`
**Trigger:** User clicks "Clear Chat" or `handleDocChangeStartFresh`.
**Steps:** Updates the selected nugget via `setNuggets`: sets `messages: []`, advances `lastDocChangeSyncIndex` to `docChangeLog.length`.

#### `pendingDocChanges` (derived)
**Trigger:** Computed via `useMemo` whenever `selectedNugget` changes.
**Steps:** Slices `docChangeLog` from `lastDocChangeSyncIndex` to end.
**Returns:** `DocChangeEvent[]`.

#### `handleDocChangeContinue(text, isCardRequest, detailLevel)`
**Trigger:** User clicks "Continue with updates" in the change notification banner.
**Steps:**
1. If no pending changes, calls `sendMessage` directly.
2. Creates `systemMsg: ChatMessage` with `role: 'system'` and `buildChangeSummary(changes)` content.
3. Calls `appendNuggetMessage(systemMsg)`.
4. Advances `lastDocChangeSyncIndex` to `docChangeLog.length`.
5. Builds `updatedMessages = [...(selectedNugget.messages || []), systemMsg]`.
6. Calls `sendMessage(text, isCardRequest, detailLevel, updatedMessages)` — passes override to bypass stale closure.

#### `buildChangeSummary(changes)`
**Trigger:** Called by `handleDocChangeContinue`.
**Steps:** Groups `DocChangeEvent[]` by `docId`; collects event descriptions per doc; formats as a `[Document Update]` system message.

### External Dependencies
- `useAppContext` — `selectedNugget`, `appendNuggetMessage`, `setNuggets`, `selectedNuggetId`
- `callClaude` (utils/ai.ts)
- `buildInsightsSystemPrompt`, `buildCardContentInstruction` (utils/prompts/insightsLab.ts)
- `buildCoverContentInstruction` (utils/prompts/coverGeneration.ts)
- `computeDocumentHash` (utils/documentHash.ts)
- `estimateTokens`, `computeMessageBudget`, `pruneMessages` (utils/tokenEstimation.ts)

### Lifecycle
- No `useEffect` triggers in this hook.
- `abortRef` is created per send and cleaned up in `finally`.
- `pendingDocChanges` recomputes whenever `selectedNugget` reference changes.

### Error Handling
- All errors in `sendMessage` are caught; `AbortError` exits silently; overflow errors produce a specific multi-option message; other errors produce `Error: ${err.message}`. Error messages are appended as assistant messages so they appear in chat history.

---

## Hook: `usePersistence`

**File:** `hooks/usePersistence.ts`
**Lines:** ~235
**Purpose:** Auto-saves all application state to IndexedDB with debouncing, dirty detection via object identity, and atomic transactions for nugget data. Returns `void` — it operates as a side-effect bridge between React state and storage.

### Interface

```ts
export function usePersistence({
  storage,
  activeCardId,
  insightsSession,
  nuggets,
  projects,
  selectedNuggetId,
  customStyles,
}: PersistenceOptions): void
```

### Internal State

| Variable | Type | Purpose |
|----------|------|---------|
| `appStateTimer` | `React.MutableRefObject<ReturnType<typeof setTimeout> \| null>` | Debounce timer for app state |
| `insightsTimer` | `React.MutableRefObject<ReturnType<typeof setTimeout> \| null>` | Debounce timer for legacy insights session |
| `nuggetsTimer` | `React.MutableRefObject<ReturnType<typeof setTimeout> \| null>` | Debounce timer for nuggets |
| `projectsTimer` | `React.MutableRefObject<ReturnType<typeof setTimeout> \| null>` | Debounce timer for projects |
| `customStylesTimer` | `React.MutableRefObject<ReturnType<typeof setTimeout> \| null>` | Debounce timer for custom styles |
| `hydrationDone` | `React.MutableRefObject<boolean>` | Guards against saving the hydrated state immediately on mount |
| `latestRef` | `React.MutableRefObject<{ insightsSession, nuggets, projects, customStyles }>` | Stable reference to latest values for save callbacks |
| `prevNuggetsRef` | `React.MutableRefObject<Map<string, Nugget>>` | Previous nugget object references for dirty detection |

### Key Functions

#### App state `useEffect`
**Trigger:** `selectedNuggetId` or `activeCardId` changes.
**Steps:** Clears previous timer; schedules `storage.saveAppState({ selectedNuggetId, activeCardId })` at 300ms.
**Side effects:** IndexedDB write.

#### `saveInsights()` + `useEffect`
**Trigger:** `insightsSession` changes (150ms debounce).
**Steps:**
1. If no session: deletes session, headings, and images from storage.
2. `serializeInsightsSession(session)` → `{ session, headings, images }`.
3. Saves session metadata, then compares stored docs vs current docs → deletes orphaned docs, saves current docs.
4. Saves headings and images.
**Side effects:** Multiple IndexedDB reads and writes.

#### `saveAllNuggets()` + `useEffect`
**Trigger:** `nuggets` array changes (1500ms debounce).
**Steps:**
1. For each nugget: compares `prevNuggetsRef.current.get(nugget.id) === nugget` — skips unchanged (dirty detection by object identity).
2. For dirty nuggets:
   a. `serializeNugget(nugget)` → stored metadata.
   b. `nugget.cards.map(c => serializeCard(c, nugget.id))` → stored cards.
   c. `extractImages(card, nugget.id)` for all cards → `StoredImage[]`.
   d. `nugget.documents.filter(d => d.status === 'ready').map(d => serializeNuggetDocument(nugget.id, d))`.
   e. `storage.saveNuggetDataAtomic(id, storedNugget, storedCards, allImages, storedDocs)` — single transaction.
   f. Loads current stored docs and images; deletes orphaned entries.
3. Loads all stored nugget IDs; deletes IDs no longer in `currentIds`.
4. Updates `prevNuggetsRef` snapshot.
**Returns:** `savedCount` (number of dirty nuggets).
**Side effects:** Many IndexedDB reads and writes per dirty nugget.

#### `saveAllProjects()` + `useEffect`
**Trigger:** `projects` array changes (1500ms debounce).
**Steps:** Saves all current projects via `storage.saveProject`; loads stored projects; deletes those whose ID is not in current set.

#### Custom styles `useEffect`
**Trigger:** `customStyles` changes (300ms debounce).
**Steps:** `storage.saveCustomStyles(latestRef.current.customStyles)`.

### External Dependencies
- `StorageBackend` (utils/storage/StorageBackend.ts) — all IndexedDB operations
- `serializeCard`, `serializeNugget`, `serializeNuggetDocument`, `serializeProject`, `extractImages`, `serializeInsightsSession` (utils/storage/serialize.ts)

### Lifecycle
- **Mount**: A single `useEffect` fires on mount, setting `hydrationDone.current = true` after `DATA_DEBOUNCE_MS + 500ms` (2000ms). All save effects check `hydrationDone.current` and bail if false, preventing the hydrated state from immediately writing back.
- `latestRef` is updated on every render via a synchronous `useEffect`.
- Each save effect returns a cleanup function that clears its timer.

### Error Handling
- All save calls wrap in `.catch(err => console.warn(...))`. Errors are non-fatal; the UI does not show error states for persistence failures.

---

## Hook: `useDocumentEditing`

**File:** `hooks/useDocumentEditing.ts`
**Lines:** ~541
**Purpose:** Provides all editing logic for the `DocumentEditorModal` contentEditable div: initial population from Markdown, custom undo/redo stack, heading list parsing, formatting command execution, heading promotion/demotion, section reordering, find/replace integration, and save/discard.

### Interface

```ts
export function useDocumentEditing({
  editorRef,
  editorObserverRef,
  initialContent,
  onSave,
  closeFindBar,
  clearFindHighlights,
}: UseDocumentEditingDeps): {
  isDirty: boolean;
  activeFormats: Set<string>;
  headings: EditorHeading[];
  saveEdits: () => void;
  discardEdits: () => void;
  executeCommand: (command: string, value?: string) => void;
  insertTable: (rows?: number, cols?: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  updateActiveFormatStates: () => void;
  changeHeadingLevel: (headingId: string, direction: 'promote' | 'demote') => void;
  scrollToHeading: (headingId: string) => void;
  updateH1: (newTitle: string) => void;
  toggleSelection: (headingId: string) => void;
  deselectAll: () => void;
  selectByLevels: (levels: number[]) => void;
  selectHeadingContent: (headingId: string) => void;
  selectHeadingAndDescendants: (headingId: string) => void;
  reorderHeading: (fromIndex: number, toIndex: number) => void;
}
```

### Internal State

| Variable | Type | Purpose |
|----------|------|---------|
| `isDirty` | `boolean` | True if unsaved changes exist |
| `activeFormats` | `Set<string>` | Formatting tags active at current cursor position |
| `headings` | `EditorHeading[]` | Parsed heading list for the sidebar |
| `suppressDirtyRef` | `React.MutableRefObject<boolean>` | Prevents MutationObserver from marking dirty during programmatic DOM mutations |
| `initialContentRef` | `React.MutableRefObject<string>` | Stable reference to initial markdown content |
| `undoStack` | `React.MutableRefObject<string[]>` | Serialized `innerHTML` snapshots for undo |
| `redoStack` | `React.MutableRefObject<string[]>` | Serialized `innerHTML` snapshots for redo |
| `isUndoRedoing` | `React.MutableRefObject<boolean>` | Guard to prevent observer from firing during undo/redo |
| `lastSnapshotRef` | `React.MutableRefObject<string>` | The innerHTML value at the last snapshot (used to detect changes in `pushUndo`) |
| `snapshotTimerRef` | `React.MutableRefObject<ReturnType<typeof setTimeout> \| null>` | Debounce timer for typing-triggered undo snapshots |
| `contentInitRef` | `React.MutableRefObject<boolean>` | Prevents double-initialization of editor content |

### Key Functions

#### `populateEditor()`
**Trigger:** `useLayoutEffect` on mount (runs before paint).
**Steps:** Guards with `contentInitRef.current`. Sets `suppressDirtyRef: true`; parses `initialContentRef.current` via `marked.parse()`; sets `editorRef.current.innerHTML`; calls `parseHeadings()`; sets `isDirty: false`; snapshots baseline as `lastSnapshotRef.current`; clears undo/redo stacks. Resets `suppressDirtyRef` via `requestAnimationFrame`.

#### `pushUndo()`
**Trigger:** Debounced 500ms after `MutationObserver` fires (typing), or immediately before formatting commands.
**Steps:** Reads current `innerHTML`; if unchanged from `lastSnapshotRef.current`, no-op. Otherwise pushes old snapshot to `undoStack`, clears `redoStack`, updates `lastSnapshotRef`. Caps `undoStack` at 200 entries.

#### `snapshotBeforeChange()`
**Trigger:** Called by `changeHeadingLevel` and `reorderHeading` before any programmatic DOM mutation.
**Steps:** Flushes any pending debounced snapshot; then unconditionally pushes the current `innerHTML` as the undo point for the upcoming change. This ensures programmatic changes are always undoable even when `innerHTML` hasn't changed yet at the time of the call.

#### `undo()`, `redo()`
**Trigger:** Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts, or `executeCommand('undo'/'redo')`.
**Steps:** Sets `isUndoRedoing: true` and `suppressDirtyRef: true`; swaps stack entries; restores `editorRef.current.innerHTML`; updates `lastSnapshotRef`; recomputes `isDirty` by comparing innerHTML to parsed `initialContentRef.current`; calls `parseHeadingsInner()`; resets flags via `requestAnimationFrame`.

#### MutationObserver `useEffect`
**Trigger:** Set up once on mount; fires on any DOM mutation in the editor.
**Steps:** If not `suppressDirtyRef`: sets `isDirty: true`; calls `parseHeadings()`; if not `isUndoRedoing`: schedules `pushUndo()` at 500ms debounce.
**Cleanup:** Disconnects observer; clears snapshot timer.

#### `selectionchange` `useEffect`
**Trigger:** Browser `selectionchange` event on `document`.
**Steps:** Calls `updateActiveFormatStates()` which queries `document.queryCommandState` for bold/italic/list and walks the ancestor chain to detect heading/block element tags.

#### `saveEdits()`
**Trigger:** User clicks Save or presses Ctrl+S.
**Steps:** `clearFindHighlights()`; `closeFindBar()`; `htmlToMarkdown(editorRef.current.innerHTML)` → calls `onSave(newMarkdown)`; sets `isDirty: false`.

#### `discardEdits()`
**Trigger:** User clicks Discard.
**Steps:** `clearFindHighlights()`; `closeFindBar()`; sets `suppressDirtyRef: true`; restores `editorRef.current.innerHTML` from `marked.parse(initialContentRef.current)`; sets `isDirty: false`.

#### `executeCommand(command, value)`
**Trigger:** `FormatToolbar` button clicks, `handleKeyDown`.
**Steps:** Routes `undo`/`redo` to custom functions. For all other commands: calls `pushUndo()`; executes via `document.execCommand` (except `createLink` which prompts for URL, and `removeFormat` which has a custom plain-text extraction implementation). Updates `lastSnapshotRef` and `activeFormats`.

#### `changeHeadingLevel(headingId, direction)`
**Trigger:** Promote/demote buttons in heading sidebar.
**Steps:** Finds heading DOM element by `#id`; computes new level (clamped 1–6); calls `snapshotBeforeChange()`; creates new element with `newTag`, copies `id` and `innerHTML`; `replaceChild` in DOM; updates `lastSnapshotRef`; calls `parseHeadings()`.

#### `reorderHeading(fromIndex, toIndex)`
**Trigger:** Drag-and-drop in heading sidebar.
**Steps:** Finds source heading DOM element; collects the heading element + all following sibling nodes until next heading of same-or-lower level. Calls `snapshotBeforeChange()`. Builds `DocumentFragment` with all nodes; inserts before or after target heading's section depending on direction.

#### `parseHeadings()` / `parseHeadingsInner()`
**Trigger:** On mount, after any MutationObserver fire, after programmatic DOM mutations.
**Steps:** Queries `h1–h6` elements in the editor; preserves previous `selected` state via `prevMap`; assigns `id` if missing; builds `EditorHeading[]` array; calls `setHeadings`.

### External Dependencies
- `htmlToMarkdown` (utils/markdown.ts)
- `marked` — `marked.parse()` for Markdown→HTML
- `document.execCommand` (deprecated API, used for text formatting)

### Lifecycle
- `useLayoutEffect` (mount only) → `populateEditor()`.
- `useEffect` (mount only) → sets up `MutationObserver` on `editorRef.current`.
- `useEffect` (always) → `document.addEventListener('selectionchange', ...)`.
- Cleanup: observer disconnect, timer clears, event listener removal.

### Error Handling
- All DOM operations are guarded by `editorRef.current` null checks.
- `document.queryCommandState` calls in `updateActiveFormatStates` are wrapped in `try/catch` (may throw in some browser contexts).
- No toast notifications; errors are swallowed or cause no-ops.

---

## Hook: `useDocumentFindReplace`

**File:** `hooks/useDocumentFindReplace.ts`
**Lines:** ~292
**Purpose:** Implements find/replace functionality for the `contentEditable` document editor using DOM `<mark>` injection. Pauses the `MutationObserver` during all DOM operations to prevent unintended undo snapshots.

### Interface

```ts
export function useDocumentFindReplace(
  editorRef: React.RefObject<HTMLDivElement | null>,
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  editorObserverRef: React.MutableRefObject<MutationObserver | null>,
): {
  showFind: boolean; setShowFind: (v: boolean) => void;
  findQuery: string; setFindQuery: (v: string) => void;
  replaceQuery: string; setReplaceQuery: (v: string) => void;
  findMatchCount: number;
  findActiveIndex: number; setFindActiveIndex: (v: number) => void;
  findMatchCase: boolean; setFindMatchCase: (v: boolean) => void;
  findInputRef: React.RefObject<HTMLInputElement>;
  findNext: () => void;
  findPrev: () => void;
  closeFindBar: () => void;
  handleReplace: () => void;
  handleReplaceAll: () => void;
  clearFindHighlights: () => void;
}
```

### Internal State

| Variable | Type | Purpose |
|----------|------|---------|
| `showFind` | `boolean` | Whether the find bar is visible |
| `findQuery` | `string` | Current search query |
| `replaceQuery` | `string` | Current replacement text |
| `findMatchCount` | `number` | Total number of matches in the editor |
| `findActiveIndex` | `number` | 0-based index of the currently highlighted match |
| `findMatchCase` | `boolean` | Case-sensitive search toggle |
| `findInputRef` | `React.RefObject<HTMLInputElement>` | Ref to the find input element for focus management |
| `findQueryRef`, `findMatchCaseRef`, `findActiveIndexRef`, `findMatchCountRef` | Refs | Latest values for use in imperative DOM callbacks without stale closures |

### Key Functions

#### `withObserverPaused(fn)`
**Trigger:** Wraps all DOM mutation operations.
**Steps:** Disconnects `editorObserverRef.current`; executes `fn()`; reconnects observer with same options `{ childList, subtree, characterData }`.
**Purpose:** Prevents find/replace DOM mutations from triggering undo snapshots or dirty marking.

#### `clearMarks()`
**Trigger:** On query change, when find bar closes, before replace operations.
**Steps:** Queries all `mark[data-find]` elements; replaces each with its text content; calls `parent.normalize()` to merge adjacent text nodes.

#### `injectMarks(query, activeIdx, matchCase)`
**Trigger:** Called by `rebuild()` inside `withObserverPaused`.
**Steps:**
1. Creates a `TreeWalker` over text nodes in the editor (skips nodes inside `[data-find-bar]`).
2. For each text node: searches for `cmpQuery` (case-adjusted); for each match: creates a `<mark data-find>` element with `MARK_INACTIVE` style; the match at `activeIdx` gets `MARK_ACTIVE` style and `data-find-active` attribute.
3. Replaces each matching text node with a `DocumentFragment` containing prefix text + marks + suffix text.
4. Returns total match count.

#### `rebuild(query?, activeIdx?, matchCase?)`
**Trigger:** `useEffect` when `findQuery` or `findMatchCase` changes (80ms debounced).
**Steps:**
1. `withObserverPaused(() => { clearMarks(); return injectMarks(...); })`.
2. If `activeIdx >= count` and `count > 0`, resets to index 0 and re-injects.
3. Scrolls to the active mark via `scrollToMark`.
**Returns:** Match count.

#### `swapActive(activeIdx)`
**Trigger:** `useEffect` when `findActiveIndex` changes.
**Steps:** Gets all `mark[data-find]` elements; updates `style` attribute on each — active gets `MARK_ACTIVE` + `data-find-active`, others get `MARK_INACTIVE`. Scrolls to active mark.
**Purpose:** Lightweight navigation between existing marks without full DOM rebuild.

#### `findNext()`, `findPrev()`
**Trigger:** Find bar "Next"/"Previous" buttons or keyboard.
**Steps:** Increments/decrements `findActiveIndex` modulo `findMatchCount`.

#### `handleReplace()`
**Trigger:** "Replace" button.
**Steps:** `withObserverPaused`:
1. Finds the active mark by `findActiveIndexRef.current`.
2. Replaces it with `replaceQuery` text; normalizes parent.
3. Clears all marks; re-injects for remaining matches.
Updates `findMatchCount` and `findActiveIndex`.

#### `handleReplaceAll()`
**Trigger:** "Replace All" button.
**Steps:** `withObserverPaused`:
1. Iterates all marks in reverse order (to preserve indices); replaces each with `replaceQuery`.
2. Calls `editor.normalize()`.
Resets `findMatchCount` and `findActiveIndex` to 0.

#### `closeFindBar()`
**Trigger:** Escape key, close button, or editor save/discard.
**Steps:** `withObserverPaused(() => clearMarks())`; resets all find state.

#### `clearFindHighlights()`
**Trigger:** Called by `useDocumentEditing.saveEdits()` and `discardEdits()`.
**Steps:** `withObserverPaused(() => clearMarks())`.

### External Dependencies
- `editorRef` — the `contentEditable` div
- `scrollContainerRef` — the scroll container for smooth scrolling to marks
- `editorObserverRef` — the `MutationObserver` from `useDocumentEditing`

### Lifecycle
- `useEffect` (depends on `findQuery`, `findMatchCase`, `showFind`) → rebuilds marks with 80ms debounce.
- `useEffect` (depends on `findActiveIndex`) → swaps active mark style.

### Error Handling
- All DOM operations are guarded by null checks on `editor` and `mark.parentNode`.
- No error propagation; failed operations are no-ops.

---

## Hook: `useTokenUsage`

**File:** `hooks/useTokenUsage.ts`
**Lines:** ~153
**Purpose:** Tracks token consumption and estimated costs for all Claude and Gemini API calls. Accumulates totals across the session and persists them to IndexedDB with a 500ms debounce.

### Interface

```ts
export function useTokenUsage(storage?: StorageBackend, initialTotals?: TokenUsageTotals): {
  totals: TokenUsageTotals;
  recordUsage: RecordUsageFn;
  resetUsage: () => void;
}

export type RecordUsageFn = (entry: Omit<TokenUsageEntry, 'estimatedCost' | 'timestamp'>) => void;
```

### Internal State

| Variable | Type | Purpose |
|----------|------|---------|
| `entriesRef` | `React.MutableRefObject<TokenUsageEntry[]>` | Append-only log of all individual API call entries (not persisted) |
| `totals` | `TokenUsageTotals` | Accumulated totals as React state (drives UI updates) |
| `saveTimerRef` | `React.MutableRefObject<ReturnType<typeof setTimeout> \| null>` | Debounce timer for IndexedDB persistence |
| `latestTotalsRef` | `React.MutableRefObject<TokenUsageTotals>` | Latest totals value for use in the save callback without stale closure |

### Cost Rates

```ts
const COST_RATES: Record<string, { input: number; output: number; cacheRead?: number; cacheWrite?: number }> = {
  'claude-sonnet-4-6':          { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
  'gemini-3-pro-image-preview': { input: 1.25, output: 5 },
};
const DEFAULT_RATES = { input: 1, output: 5 };
```
Rates are per 1,000,000 tokens in USD.

### Key Functions

#### `recordUsage(raw)`
**Trigger:** Called after every Claude and Gemini API response in all hooks that receive the `RecordUsageFn` parameter.
**Steps:**
1. Calls `calculateCost(model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens)`.
2. Creates `TokenUsageEntry` with computed cost and current timestamp.
3. Appends to `entriesRef.current`.
4. Updates `totals` state by accumulating per-provider and global counters.
5. Calls `scheduleSave()`.
**State modified:** `totals`.
**Side effects:** Schedules IndexedDB write.

#### `scheduleSave()`
**Trigger:** Called by `recordUsage`.
**Steps:** Clears any pending timer; schedules `storage.saveTokenUsage(latestTotalsRef.current)` at 500ms.
**Side effects:** IndexedDB write after debounce.

#### `resetUsage()`
**Trigger:** User clicks "Reset" in the token usage display.
**Steps:** Clears `entriesRef.current`; resets `totals` to `EMPTY_TOTALS`; immediately (not debounced) writes `EMPTY_TOTALS` to `storage.saveTokenUsage`.

### Format Helpers (exported)

- `formatTokens(n: number): string` — formats as `1.2K`, `3.4M`, or raw integer.
- `formatCost(n: number): string` — formats as `$12.34` (≥$10), `$1.234` (≥$0.01), `$0.0001` (>$0), `$0.00` (zero).

### External Dependencies
- `StorageBackend` (optional) — `storage.saveTokenUsage()`, `storage.isReady()`.

### Lifecycle
- `useEffect` (depends on `totals`) → keeps `latestTotalsRef.current` in sync.
- `initialTotals` is the hydrated value from IndexedDB, passed in by `App.tsx` on mount.

### Error Handling
- `scheduleSave` wraps the IndexedDB call in `.catch(err => console.warn(...))`.
- `resetUsage` does the same for the immediate save. No error is surfaced to the user.
