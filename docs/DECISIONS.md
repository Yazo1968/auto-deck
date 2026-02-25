# Architectural Decisions

## Decision: Client-Side SPA with No Backend

**What:** The entire application runs in the browser. AI API calls are made directly from client JavaScript. All persistence is to IndexedDB. There is no server, no API routes, and no auth layer.

**Why:** Eliminates infrastructure cost and operational complexity. The target use case is a personal productivity tool for document-to-infographic conversion, not a multi-user platform. A backend would add latency, cost, and deployment surface without enabling any feature that the client-side approach cannot support.

**Alternatives considered:** A Node.js backend to proxy AI API calls (would hide API keys from the bundle) and a backend-as-a-service (e.g., Supabase) for auth and storage.

**Trade-offs:** API keys (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) are exposed in the built JavaScript bundle. Any user who inspects the bundle can extract and use the keys. There is no rate limiting, no per-user quota, and no audit trail. Acceptable for a single-user or small-team internal tool; not acceptable for a public web product.

---

## Decision: React Context vs Redux / Zustand

**What:** All global state is managed by a single React Context (`AppContext` in `context/AppContext.tsx`). No Redux, Zustand, MobX, or any external state library is used.

**Why:** The state shape is relatively flat (`nuggets[]`, `projects[]`, `customStyles[]`, `selectedNuggetId`, `darkMode`, `insightsSession`). React's built-in `useContext` + `useReducer` / `useState` + `useMemo` pattern is sufficient and avoids adding a dependency. The context value is memoized via `useMemo` to minimize unnecessary re-renders.

**Alternatives considered:** Zustand (simpler than Redux, no boilerplate) and Redux Toolkit (predictable state updates, good devtools).

**Trade-offs:** `App.tsx` holds most local state (panel open/close, modal visibility, zoom state, drag state) and passes handlers down as props. As the app grows this creates prop-drilling and makes `App.tsx` very large (~1700 lines). There is no time-travel debugging or action log.

---

## Decision: IndexedDB for Persistence

**What:** All application state (nuggets, projects, cards, images, documents, custom styles) is persisted to IndexedDB via a custom `IndexedDBBackend` class in `utils/storage/IndexedDBBackend.ts`. The database is named `infonugget-db` and is currently at schema version 5.

**Why:** IndexedDB is the only browser API capable of storing large binary data (card images as `Blob`) and structured JSON without size limits that would affect typical usage. `localStorage` has a 5–10 MB limit; `sessionStorage` is not persistent. No external persistence library (e.g., Dexie.js) was added to keep the dependency count low.

**Alternatives considered:** `localStorage` (too small for images), `sessionStorage` (not persistent), a cloud backend with a database (adds infrastructure and auth complexity).

**Trade-offs:** Data is per-browser-per-device with no sync. If the user clears browser storage, all work is lost. The custom IDB wrapper is ~300 lines of low-level IDB boilerplate without the ergonomics of a library like Dexie. Migration logic must be maintained manually.

---

## Decision: Direct Fetch for Claude (No Anthropic SDK)

**What:** All Claude API calls use the browser `fetch` API directly, targeting `https://api.anthropic.com/v1/messages`. The `anthropic` Node.js SDK is not used. The `anthropic-dangerous-direct-browser-access: true` header is sent on every request to satisfy Anthropic's browser-access requirement.

**Why:** The Anthropic Node.js SDK is designed for Node.js and does not support browser environments. Direct `fetch` gives full control over request construction, including custom headers, prompt caching blocks, and multi-turn message arrays. It also avoids bundling a large SDK.

**Alternatives considered:** A thin backend proxy that uses the Anthropic SDK (would hide the API key and remove the need for the `dangerous-direct-browser-access` header).

**Trade-offs:** The API key is exposed in the browser bundle. Prompt-caching logic (`cache_control` injection in `callClaude()`) must be maintained manually. Any breaking changes to the Anthropic REST API require manual updates.

---

## Decision: @google/genai SDK for Gemini

**What:** All Gemini API calls go through the `@google/genai` SDK v1.41.0 (`GoogleGenAI` class). A lazy singleton pattern is used (`getGeminiAI()` in `utils/ai.ts`), recreated when the API key rotates.

**Why:** Unlike the Anthropic SDK, `@google/genai` supports browser environments. It handles multimodal requests (text + image modalities) and the `Modality` / `ThinkingLevel` enums needed for Gemini 3 configuration. Gemini 3 mandates `temperature=1.0` and the SDK's defaults enforce this correctly.

**Alternatives considered:** Direct `fetch` calls to the Gemini REST API (more control, no dependency, but more boilerplate for multimodal response handling).

**Trade-offs:** SDK version updates may introduce breaking changes. The API key is still exposed in the browser bundle. The `GEMINI_API_KEY_FALLBACK` key-rotation mechanism is implemented manually on top of the SDK's singleton rather than being a built-in SDK feature.

---

## Decision: Vite Build-Time API Key Injection

**What:** API keys are read from `.env.local` at build time and injected into the bundle via Vite's `define` config as `process.env.ANTHROPIC_API_KEY`, `process.env.API_KEY` (Gemini primary), and `process.env.GEMINI_API_KEY_FALLBACK`. A custom `.env.local` parser is used rather than Vite's default dotenv integration to prevent system environment variables from shadowing the file values.

**Why:** There is no server to act as a secrets proxy. Build-time injection is the only way to make API keys available to a purely client-side SPA.

**Alternatives considered:** A runtime `/config.json` endpoint (requires a server to serve it securely), user-provided keys in the browser UI (shifts the key management burden to users), a backend proxy (adds infrastructure).

**Trade-offs:** Keys are visible in the built JavaScript bundle. Anyone with access to the deployed build can extract them. This is an acknowledged and accepted risk for an internal tool (`anthropic-dangerous-direct-browser-access: true` header confirms the deliberate choice).

---

## Decision: Tailwind CSS via CDN

**What:** Tailwind CSS is loaded via a `<script>` CDN tag in `index.html`. It is not installed as an npm package and is not part of the Vite build pipeline. Inline styles and CSS custom properties are used alongside Tailwind utility classes.

**Why:** Avoids configuring a PostCSS pipeline, `tailwind.config.js`, and the `@tailwind` directives. For a project of this size and access model, the CDN approach is simpler and has no practical performance penalty in development. The CDN build includes all Tailwind classes at runtime via the JIT-in-browser engine.

**Alternatives considered:** `tailwindcss` as an npm devDependency with PostCSS integration (standard production approach, produces a smaller CSS bundle via tree-shaking).

**Trade-offs:** The CDN Tailwind script adds ~350 KB of JavaScript that runs in the browser to generate CSS at runtime. The production build cannot tree-shake unused Tailwind classes. The CDN URL pins a specific version that must be manually updated.

---

## Decision: 3-Phase Card Generation Pipeline

**What:** Generating an infographic card from a heading requires three sequential AI calls: (1) Content Synthesis via Claude (produces markdown text at the requested `DetailLevel`), (2) Visual Planning via Claude or Gemini Flash (produces a prose layout brief or JSON design spec), (3) Image Generation via Gemini Pro Image (produces a base64 PNG). Results from each phase are cached in the `Card` object (`synthesisMap`, `visualPlanMap`, `cardUrlMap`, `lastPromptMap`, `lastGeneratedContentMap`).

**Why:** Separating synthesis from layout planning from image generation allows each model to focus on what it does best. Claude produces high-quality analytical content; a planner step translates that content into spatial layout instructions before the image model sees it. Caching each phase independently lets users regenerate only the image without re-running synthesis, or edit synthesized content and regenerate only from Phase 2 onward.

**Alternatives considered:** A single prompt combining all three phases sent to a multimodal model; a two-phase pipeline collapsing synthesis and planning into one Claude call.

**Trade-offs:** Three sequential API calls increase latency per card. The pipeline is harder to debug when failures occur mid-sequence. The prompt anti-leakage transformation must happen between phases (content → tags, hex → color names, font names → descriptors) to prevent internal formatting directives from corrupting image model output.

---

## Decision: Per-Nugget Document Ownership (Not Shared Library)

**What:** Documents (`UploadedFile[]`) are stored directly on the `Nugget` object, not in a global document library. Each nugget owns its documents exclusively. Copying or moving a document between nuggets creates a new `UploadedFile` record with a `sourceOrigin` field tracking provenance.

**Why:** Simplifies the data model. A shared document library would require reference counting, coordinated deletion, and complex UI to show which nuggets use which document. Per-nugget ownership makes it straightforward to delete a nugget without dangling references.

**Alternatives considered:** A global document library with nuggets holding document IDs (shared library pattern, common in document management systems).

**Trade-offs:** Duplicates storage for documents that appear in multiple nuggets (both the IndexedDB record and the Anthropic Files API upload are duplicated). Moving a document between nuggets is a copy-then-delete operation rather than a reference update.

---

## Decision: MetaTOC Companion File System for Native PDFs

**What:** When a PDF is processed in native mode, a companion markdown file is generated containing the PDF's heading hierarchy as `# heading (page N)` lines and uploaded to the Anthropic Files API alongside the PDF. This file is stored as `UploadedFile.metaTocFileId`. When the user edits the TOC in `SourcesPanel`, the companion file is atomically replaced via `replaceMetaToc()` in `utils/metaToc.ts`.

**Why:** Native PDFs sent to Claude via the Files API are opaque binary documents. Without a structural index, Claude cannot efficiently locate sections by heading text. The MetaTOC gives Claude a navigable outline without requiring it to parse PDF structure on every call. Editing the TOC lets users correct Gemini's heading extraction when it makes mistakes.

**Alternatives considered:** Embedding the full extracted text alongside the PDF (doubles token cost); relying entirely on Claude's native PDF parsing (unreliable for complex layouts).

**Trade-offs:** Two Files API uploads per native PDF (the PDF and the MetaTOC). If the MetaTOC replacement fails, the two files can be out of sync. Files API entries expire after 60 minutes with no re-upload logic, so stale `fileId` references accumulate in persisted `UploadedFile` records.

---

## Decision: Prompt Anti-Leakage System (Tags + Color Names + Font Descriptors)

**What:** Before synthesized content or planner output is passed to the image generation model, three transformations are applied: (1) `transformContentToTags()` in `utils/prompts/promptUtils.ts` converts markdown heading syntax to bracketed semantic tags (`[TITLE]`, `[SECTION]`, `[SUBSECTION]`, `[DETAIL]`); (2) `sanitizePlannerOutput()` strips font names, hex color codes, point sizes, and pixel values from planner output; (3) `hexToColorName()` maps hex values to human-readable color names from a 200+ entry lookup table; (4) `fontToDescriptor()` maps font family names to visual descriptions (e.g., `"Inter"` → `"clean, geometric sans-serif"`).

**Why:** Image generation models trained on prompt data can reproduce verbatim text from prompts (prompt leakage). Internal formatting directives, font names, and hex codes in prompts can cause the model to render these strings as visible text in the generated image rather than treating them as style instructions. The transformation layer isolates content semantics from presentation instructions.

**Alternatives considered:** Sending raw markdown and trusting the model to ignore formatting syntax; using a separate pre-processing Claude call to extract clean content.

**Trade-offs:** The tag-based format is a custom convention that must be maintained consistently across all prompt builders. Adding new heading levels or content types requires updating both the transformation and the image model's system prompt. The `hexToColorName()` lookup must be manually extended for any color not already in the table.

---

## Decision: PwC Corporate Dedicated Prompt Pipeline (JSON Hybrid)

**What:** The `PwC Corporate` visual style uses a separate prompt pipeline defined in `utils/prompts/pwcGeneration.ts`: `buildPwcPlannerPrompt()`, `buildPwcVisualizerPrompt()`, `buildPwcCoverPlannerPrompt()`, `buildPwcCoverVisualizerPrompt()`. The planner step outputs a structured JSON design specification instead of a prose brief. The visualizer prompt is constructed differently to enforce the strict PwC aesthetic: white background, orange accent only for focal elements, grey data visualizations, modular card-based layout, no decorative flourishes.

**Why:** The generic prose planner output does not reliably produce the disciplined, data-first consulting aesthetic that PwC brand standards require. A JSON spec gives the image model explicit, machine-readable layout instructions (element types, colors, positions) rather than natural-language descriptions that can be interpreted loosely.

**Alternatives considered:** Adding PwC-specific instructions to the generic planner prompt as additional constraints (tried and found insufficient); a post-generation correction step.

**Trade-offs:** Maintains a parallel set of prompt builders that must be kept in sync with the generic pipeline when layout planning logic changes. JSON parsing in `utils/autoDeck/parsers.ts` must handle PwC planner output as a special case.

---

## Known Technical Debt

1. **`App.tsx` too large** (~1700+ lines) — the main orchestrator file has grown to include all event handlers, panel composition, modal coordination, and local state. It should be split into multiple files or feature modules.

2. **Legacy `insightsSession` shim** — backward compatibility for the pre-nugget architecture. Approximately 60% migrated. Many handlers still perform dual state updates: once to `nuggets` via `AppContext` helpers, and once to `insightsSession` to keep the shim in sync. The shim runs in a `useEffect` in `AppContext.tsx` that synthesizes an `InsightsSession` from the selected nugget on every card/document count change.

3. **Hardcoded token cost rates** — cost calculations in `hooks/useTokenUsage.ts` use literal per-token price values that must be manually updated when Anthropic or Google change pricing.

4. **No React Error Boundaries** — unhandled rendering errors in any component will propagate to the root and crash the entire app with a blank screen.

5. **No tests** — no testing framework is configured. There are no unit tests, integration tests, or end-to-end tests.

6. **No undo/redo for card edits** — `useDocumentEditing.ts` implements undo/redo for the markdown document editor, but card content edits (synthesis text) have no undo/redo.

7. **Potential Blob URL memory leaks** — `URL.createObjectURL()` is called in `utils/storage/serialize.ts` when deserializing card images from IndexedDB Blobs. The resulting object URLs are never explicitly revoked via `URL.revokeObjectURL()`, which can accumulate memory over a long session.

8. **API keys in client bundle** — see DECISIONS above. The accepted trade-off for a client-only SPA, but a security risk if the app is deployed publicly.

9. **Files API 60-minute expiry with no re-upload logic** — uploaded file IDs are stored in `UploadedFile.fileId` and `UploadedFile.metaTocFileId`. After 60 minutes the Files API deletes those files, but the stored IDs remain. The next AI call that references an expired `fileId` will receive an API error with no automatic recovery.

10. **`document.execCommand` deprecated** — `hooks/useDocumentEditing.ts` uses `document.execCommand()` for text formatting operations in the `contentEditable` document editor. This API is deprecated in all major browsers and may be removed in a future browser version.

## Known Limitations

- **Single-browser, single-device** — IndexedDB data is not synced. All work is local to the browser and device where it was created.

- **No file export** — there is no feature to export cards as PDF, PowerPoint, or ZIP. Images can only be viewed in the app or saved by right-clicking individual card images.

- **Anthropic Files API expiry** — documents uploaded to the Files API expire after 60 minutes. For long editing sessions, Claude calls may fail with file-not-found errors against previously uploaded documents.

- **Sequential batch generation** — `executeBatchCardGeneration()` in `hooks/useCardGeneration.ts` processes cards one at a time, not in parallel. Generating a full deck of 20+ cards is slow.

- **180K token budget for Auto-Deck** — the Auto-Deck pre-flight check in `hooks/useAutoDeck.ts` enforces a 180,000 token limit on the combined document context. Very large document sets cannot be used with Auto-Deck.

- **No offline support** — there is no service worker. The app requires a network connection for all AI operations. Existing persisted data is accessible offline but no generation features work.

- **No multi-user support** — there is no concept of users, sharing, or collaboration.

- **Image generation is non-deterministic** — Gemini Pro Image does not support a seed parameter for reproducible outputs. Regenerating a card with the same inputs will produce a different image.
