# Architecture

## System Design

InfoNugget v6.0 is a client-side SPA with no backend. All computation, AI API calls, and persistence occur in the browser. There is no server, no backend routes, and no authentication layer. The application is built with Vite 6.2.0 and served as a static bundle; the only server-side component is the Vite dev server proxy rule that forwards `/api/anthropic-files` to `https://api.anthropic.com/v1/files` to work around CORS restrictions on the Anthropic Files API beta endpoint.

**Entry chain:**
```
index.tsx
  → StorageProvider (components/StorageProvider.tsx)
      Hydrates state from IndexedDB before rendering the app.
      Runs migration logic on schema version mismatch.
    → ToastProvider
        Global toast notification context.
      → AppProvider (context/AppContext.tsx)
          All global React state and CRUD helpers.
        → PersistenceConnector
            Bridges AppContext state changes to usePersistence.
          → App.tsx
              Main orchestrator (~1700 lines).
              All event handlers, panel composition, and modal coordination.
```

**View routing:** Conditional rendering only — no React Router. The boolean `showLanding` determines whether `LandingPage.tsx` or the main 6-panel layout is shown. Within the main layout, panel visibility is controlled by the `expandedPanel` state in `App.tsx`.

## Frontend Architecture

### State Management

All global state lives in a single React Context defined in `context/AppContext.tsx`. The context value (`AppContextValue` interface) includes:

- `nuggets: Nugget[]` — all nuggets in memory
- `projects: Project[]` — all projects in memory
- `selectedNuggetId: string | null` — currently active nugget
- `customStyles: CustomStyle[]` — user-created styles (global, not per-nugget)
- `darkMode: boolean` — dark mode toggle (also persisted to `localStorage`)
- `insightsSession: InsightsSession | null` — backward-compat shim populated from the selected nugget's data

Derived values computed with `useMemo`:
- `selectedNugget: Nugget | undefined` — resolved from `nuggets` by `selectedNuggetId`
- `activeCard: Card | null` — resolved from `selectedNugget.cards` by `activeCardId`

CRUD helpers exposed on the context: `addNugget`, `deleteNugget`, `updateNugget`, `updateNuggetCard`, `updateNuggetCards`, `addNuggetDocument`, `updateNuggetDocument`, `removeNuggetDocument`, `renameNuggetDocument`, `toggleNuggetDocument`, `addProject`, `deleteProject`, `updateProject`, `addNuggetToProject`, `removeNuggetFromProject`, `addCustomStyle`, `updateCustomStyle`, `deleteCustomStyle`, `replaceCustomStyles`.

Local state (panel open/close, modal visibility, zoom state, drag state, batch generation progress, etc.) lives in `App.tsx` and is not shared via context.

### 6-Panel Layout

The main app renders a flex-row of six panels:

| Panel | Component | File | z-index |
|---|---|---|---|
| Projects | `ProjectsPanel` | `components/ProjectsPanel.tsx` | overlay `z-[108]`, strip `z-20` |
| Sources | `SourcesPanel` | `components/SourcesPanel.tsx` | overlay `z-[107]`, strip `z-10` |
| Chat | `ChatPanel` | `components/ChatPanel.tsx` | overlay `z-[105]`, strip `z-[2]` |
| Auto-Deck | `AutoDeckPanel` | `components/AutoDeckPanel.tsx` | overlay `z-[104]`, strip `z-[1]` |
| Cards | `CardsPanel` | `components/CardsPanel.tsx` | `z-[103]`, `flex-1` |
| Assets | `AssetsPanel` | `components/AssetsPanel.tsx` | `z-[103]` |

The first four panels render their strip buttons inline in the flex row and their panel bodies as portals to `document.body` (`createPortal` from `react-dom`). Strip buttons use `-ml-2.5` negative margin to overlap. Only one panel can be open at a time (accordion behavior via `expandedPanel: string | null` state in `App.tsx`). Click-outside closes the open panel; unsaved changes are gated through `appGatedAction`.

**Full z-index stack (highest to lowest):**

| Layer | z-index |
|---|---|
| Modals / Dialogs | `z-[120]` |
| Main Header | `z-[110]` |
| Projects panel overlay | `z-[108]` |
| Sources panel overlay | `z-[107]` |
| Hard lock overlay (TOC draft mode) | `z-[106]` |
| Chat panel overlay | `z-[105]` |
| Auto-Deck panel overlay | `z-[104]` |
| Cards / Assets panels | `z-[103]` |
| Footer | `z-[102]` |

### Component Categories

**Panel components:** `ProjectsPanel`, `SourcesPanel`, `ChatPanel`, `AutoDeckPanel`, `CardsPanel`, `AssetsPanel`

**Modal components:** `NuggetCreationModal`, `NuggetSettingsModal`, `ProjectCreationModal`, `StyleStudioModal`, `SubjectEditModal`, `DocumentEditorModal`

**UI components:** `LandingPage`, `LoadingScreen`, `ToastNotification`, `ZoomOverlay`, `InsightsCardList`, `InsightsDocViewer`, `PdfViewer`, `PdfUploadChoiceDialog`, `FileList`, `FileUpload`, `Header`, `FormatToolbar`, `FindReplaceBar`, `Dialogs`, `UploadView`, `StorageProvider`

**Workbench components:** `AnnotationWorkbench`, `AnnotationToolbar`, `PinEditor`, `RectangleEditor`, `CanvasRenderer` (all in `components/workbench/`)

### Custom Hooks

| Hook | File | Purpose |
|---|---|---|
| `useCardGeneration` | `hooks/useCardGeneration.ts` | 3-phase card pipeline, batch generation, version history |
| `useInsightsLab` | `hooks/useInsightsLab.ts` | Chat with Claude, save-as-card, document change detection |
| `useAutoDeck` | `hooks/useAutoDeck.ts` | Auto-Deck state machine: Planner → Review → Finalizer → Producer |
| `usePersistence` | `hooks/usePersistence.ts` | IndexedDB auto-save, dirty detection, atomic transactions |
| `useDocumentEditing` | `hooks/useDocumentEditing.ts` | `contentEditable` editor, undo/redo stack, heading promotion/demotion |
| `useDocumentFindReplace` | `hooks/useDocumentFindReplace.ts` | Find/replace in `contentEditable` via DOM mark injection |
| `useTokenUsage` | `hooks/useTokenUsage.ts` | Token and cost tracking (Claude + Gemini), 500ms debounced persist |

## Persistence / Storage

### Database

**Database name:** `infonugget-db`
**Schema version:** 5
**Implementation:** `utils/storage/IndexedDBBackend.ts` — a custom class wrapping the IndexedDB API directly (no third-party library).

### Object Stores

| Store | Key Path | Content |
|---|---|---|
| `appState` | `id` | App-wide settings: `darkMode`, `selectedNuggetId`, `customStyles` |
| `nuggets` | `id` | Nugget metadata: name, type, subject, stylingOptions, timestamps |
| `nuggetHeadings` | `id` | Card data serialized as `StoredHeading` (synthesisMap as JSON string) |
| `nuggetImages` | `id` | Card image data as Blob (binary, separate from heading metadata) |
| `nuggetDocuments` | `id` | Document metadata per nugget |
| `projects` | `id` | Project data |
| `insightsSession` | `id` | Legacy session data (backward-compat shim) |
| `insightsDocs` | `id` | Legacy per-document store (v4 → v5 migration) |
| `insightsHeadings` | `id` | Legacy per-card store (v4 → v5 migration) |
| `insightsImages` | `id` | Legacy per-image store (v4 → v5 migration) |
| `files` | `id` | Old v1–v3 legacy store (kept for migration, cleared in v5) |
| `headings` | `id` | Old v1–v3 legacy store (kept for migration, cleared in v5) |
| `images` | `id` | Old v1–v3 legacy store (kept for migration, cleared in v5) |
| `documents` | `id` | Old v1–v3 legacy store (kept for migration, cleared in v5) |

### Serialization

Serialization logic lives in `utils/storage/serialize.ts`.

- `Card` → `StoredHeading`: `synthesisMap` is JSON-stringified; image data URLs extracted and stored as `Blob` in `nuggetImages` for storage efficiency.
- `deserializeCard(StoredHeading, images)` → `Card`: Blob objects become object URLs via `URL.createObjectURL()`; base64 strings pass through unchanged.
- `migrateLevelMap()`: renames deprecated `DetailLevel` keys (`TitleCover` → `TitleCard`, `TakeawayCover` → `TakeawayCard`) during deserialization.
- Separate serializers: `serializeNugget` / `deserializeNugget`, `serializeNuggetDocument` / `deserializeNuggetDocument`, `serializeProject` / `deserializeProject`.

### Save Strategy

- **300ms debounce** for `appState` changes (dark mode, selected nugget ID, custom styles).
- **1500ms debounce** for nugget data changes; dirty detection via object identity comparison.
- **Atomic transactions:** `saveNuggetDataAtomic()` in `IndexedDBBackend` spans the `nuggets`, `nuggetHeadings`, `nuggetImages`, and `nuggetDocuments` stores in a single IDB transaction.
- **Orphan cleanup:** on startup, `nuggetImages` and `nuggetHeadings` records for deleted nuggets are removed.
- **Blob optimization:** card images stored as `Blob` in `nuggetImages` rather than as inline base64 strings, reducing overall storage footprint.

### Migration Paths

| Version transition | Action |
|---|---|
| v1 → v3 | Legacy session data migrated |
| v2 → v3 | Old per-nugget schema migrated |
| v3 → v4 | `synthesis` type renamed to `insights` |
| v4 → v5 | Projects schema introduced; legacy stores cleared |

## External Services & Integrations

### Claude (Anthropic)

- **Model:** `claude-sonnet-4-6`
- **Max tokens:** 64,000 (`CLAUDE_MAX_TOKENS` in `utils/ai.ts`)
- **Transport:** Direct `fetch` to `https://api.anthropic.com/v1/messages` from the browser. No Anthropic Node.js SDK.
- **Required headers:** `anthropic-version: 2023-06-01`, `anthropic-beta: files-api-2025-04-14`, `anthropic-dangerous-direct-browser-access: true`
- **Auth:** `ANTHROPIC_API_KEY` injected at build time via Vite `define`.
- **Function:** `callClaude(prompt, options?: CallClaudeOptions)` in `utils/ai.ts`. Supports `systemBlocks` (array of `SystemBlock` with per-block `cache` flag), multi-turn `messages` arrays, `AbortSignal`, and `temperature` override.
- **Prompt caching:** System blocks flagged `cache: true` receive `cache_control: { type: 'ephemeral' }` if their content exceeds 4,000 characters (`CACHE_MIN_CHARS`). The last user message in every multi-turn call also receives `cache_control` automatically. Cache metrics logged to `console.debug`.
- **Retry logic:** `withRetry()` in `utils/ai.ts` — exponential backoff, up to 5 retries, capped at 32 seconds with jitter. Retries on HTTP 429, 500, 503.

**Files API (Anthropic, beta):**
- **Upload:** `uploadToFilesAPI(content, filename, mimeType)` — sends a multipart `FormData` POST to `/api/anthropic-files` (proxied by Vite to `https://api.anthropic.com/v1/files`). Returns the `file_id` string.
- **Delete:** `deleteFromFilesAPI(fileId)` — fire-and-forget DELETE. Failures are caught and logged as warnings, not thrown.
- **Expiry:** Uploaded files expire after 60 minutes. There is no re-upload logic for expired files.
- **CORS workaround:** The Files API beta endpoint does not support CORS preflight. The Vite dev server proxies `/api/anthropic-files` → `https://api.anthropic.com/v1/files`. The `anthropic-dangerous-direct-browser-access: true` header is still required.

**Use cases for Claude:** content synthesis (Phase 1), layout planning (Phase 2, non-PwC styles), chat / Insights Lab, Auto-Deck planner, Auto-Deck finalizer, Auto-Deck producer, subject generation, custom style generation.

### Gemini (Google)

- **SDK:** `@google/genai` v1.41.0 (`GoogleGenAI` class from `@google/genai`)
- **Auth:** `GEMINI_API_KEY` (primary) + optional `GEMINI_API_KEY_FALLBACK`. Both injected at build time via Vite `define`.
- **Key rotation:** `rotateGeminiKey()` in `utils/ai.ts` — switches to the fallback key and forces recreation of the `GoogleGenAI` singleton when the primary key is exhausted (HTTP 429).
- **Retry logic:** `withGeminiRetry(fn)` — runs `withRetry()` first; on full retry exhaustion with a retryable error, rotates the key and runs `withRetry()` once more.
- **Temperature:** Gemini 3 mandates `temperature=1.0` (the SDK default). No temperature overrides are applied.

**Text model (`FLASH_TEXT_CONFIG`):**
- Model: `gemini-2.5-flash`
- Config: `thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }`, `responseModalities: [Modality.TEXT]`
- Use cases: PDF-to-markdown conversion (`PDF_CONVERSION_PROMPT`), heading extraction (`HEADING_EXTRACTION_PROMPT`), layout planning for non-PwC styles (Phase 2).

**Image model (`PRO_IMAGE_CONFIG`):**
- Model: `gemini-3-pro-image-preview`
- Config: `responseModalities: [Modality.TEXT, Modality.IMAGE]`
- Use case: infographic image generation (Phase 3). Returns a base64-encoded PNG.

## Security Considerations

**API keys in client bundle:** `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, and `GEMINI_API_KEY_FALLBACK` are injected into the JavaScript bundle at build time via Vite's `define` mechanism (`process.env.*` replacement). They are readable by anyone who inspects the built bundle. This is an accepted trade-off for a client-only SPA with no backend to proxy secrets.

**Custom `.env.local` parser:** The app uses a custom parser to read `.env.local` rather than relying on Vite's default `dotenv` integration, to prevent system environment variables from shadowing the `.env.local` values.

**No authentication:** There is no login, session management, or user identity system of any kind.

**CORS proxy:** The Vite dev server proxy at `/api/anthropic-files` is a development-time workaround only. In a production static deployment, a separate reverse proxy or edge function would be required to forward Files API requests.

**`anthropic-dangerous-direct-browser-access: true`:** This header is required by Anthropic to permit direct browser-to-API calls and explicitly acknowledges that the API key is exposed in the browser environment.

**No input sanitization for AI prompts:** Document content is passed into AI prompts after transformation (markdown → bracketed tags, hex → color names, font names → descriptors) but there is no general XSS or injection defense beyond what the AI models themselves provide.
