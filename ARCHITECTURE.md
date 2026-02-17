# Infonugget v4.0 — Complete Architecture Reference

---

## 1. What This App Does

Infonugget is an AI-powered document-to-infographic tool. Users upload documents (Markdown, PDF, DOCX), which are parsed and converted to structured Markdown. The content is then organized into "cards" (headings), where AI synthesizes the content per card, plans a visual layout, and generates a styled infographic image. Users can iteratively modify generated cards using spatial annotations (pins, rectangles, arrows, freehand sketches) that are rendered as a high-contrast redline map and sent alongside text instructions to the image AI for precise edits.

**Target user:** Knowledge workers, analysts, educators, and content creators who need to transform dense documents into visual infographics without design skills.

**Primary workflow:** User uploads documents → AI parses to structured Markdown → user curates card headings → AI synthesizes content per heading → AI plans visual layout → AI generates infographic card image → user annotates and iterates.

---

## 2. Tech Stack

| Category | Technology | Version | Purpose |
|---|---|---|---|
| Framework | React | 19.2.4 | UI framework |
| Language | TypeScript | ~5.8.2 | Type-safe JavaScript |
| Bundler | Vite | ^6.2.0 | Dev server + production build |
| Styling | Tailwind CSS | CDN (runtime) | Utility-first CSS |
| Fonts | Google Fonts | CDN | Inter (UI), Libre Baskerville (document prose), JetBrains Mono (code) |
| Text AI | Anthropic Claude | claude-sonnet-4-5-20250929 | Document parsing, content synthesis, chat |
| Layout Planning AI | Google Gemini Flash | gemini-3-flash-preview | Spatial layout blueprints |
| Image AI | Google Gemini Pro Image | gemini-3-pro-image-preview | Card image generation + modification |
| Markdown Parser | marked | 15.0.7 | MD to HTML rendering |
| DOCX Parser | JSZip | ^3.10.1 | DOCX (ZIP) decompression |
| Persistence | IndexedDB | Browser native | Client-side storage |
| State Management | React Context | Built-in | Global state via AppContext |

### Environment Variables

Configured in `.env.local`, injected at build time via `vite.config.ts` `define`:

| Variable | Injected As | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `process.env.API_KEY` and `process.env.GEMINI_API_KEY` | Google Gemini API access |
| `ANTHROPIC_API_KEY` | `process.env.ANTHROPIC_API_KEY` | Anthropic Claude API access |

**Important:** API keys are exposed client-side via Vite's `define` mechanism. This is a pure client-side SPA with no backend. The `vite.config.ts` includes a custom `readDotEnvLocal()` function that directly parses `.env.local` to avoid system environment variable shadowing issues.

---

## 3. File & Folder Structure

```
infonugget-v4.0/                           Root (flat — no src/ directory)
├── .env.local                              API keys (GEMINI_API_KEY, ANTHROPIC_API_KEY)
├── index.html                         ~241 Entry HTML: Tailwind CDN, Google Fonts, CSS vars, importmap
├── index.tsx                           ~20 React root: StrictMode → StorageProvider → App
├── App.tsx                           ~1246 Main orchestrator: wires hooks to components
├── types.ts                           ~241 All TypeScript interfaces, types, enums
├── package.json                        ~24 Dependencies + scripts
├── tsconfig.json                       ~32 TS config (ES2022, bundler module resolution)
├── vite.config.ts                      ~58 Vite config: port 3000, env injection, path aliases
│
├── context/
│   └── AppContext.tsx                  ~405 Global state: nuggets, projects, sessions, mutation helpers
│
├── hooks/
│   ├── useCardGeneration.ts           ~316 Card generation pipeline: synthesis → plan → image → batch
│   ├── useInsightsLab.ts              ~281 Chat state + Claude API for insights workflow
│   ├── useDocumentEditing.ts          ~401 contentEditable editing with MutationObserver
│   ├── useDocumentFindReplace.ts      ~291 DOM-based find/replace with mark injection
│   ├── useAnnotations.ts              ~78  CRUD for pin/rect/arrow/sketch annotations
│   ├── useVersionHistory.ts           ~173 Undo/redo stack for image modifications
│   └── usePersistence.ts             ~190  Debounced auto-save to IndexedDB
│
├── components/
│   ├── StorageProvider.tsx            ~285 Hydrates from IndexedDB on mount, wraps AppProvider
│   ├── LoadingScreen.tsx               ~50 Branded loading screen during hydration
│   ├── LandingPage.tsx                ~122 Empty state when no project/nugget selected
│   ├── Header.tsx                      ~50 Top bar (minimal)
│   ├── FileSidebar.tsx                ~774 Left sidebar: project tree, nugget list, creation modals
│   ├── InsightsLabPanel.tsx          ~1288 Chat panel + document tabs + sources view + kebab menus
│   ├── InsightsHeadingList.tsx        ~819 Card heading list with kebab menu, copy/move, selection
│   ├── InsightsDocViewer.tsx           ~79 Read-only document viewer
│   ├── AssetLab.tsx                   ~696 CardLab: Generate/Inpaint modes, style toolbar, card display
│   ├── DocumentEditorModal.tsx        ~676 Inline/modal document editor with contentEditable
│   ├── Dialogs.tsx                    ~271 Reusable dialog components (unsaved changes, etc.)
│   ├── NuggetCreationModal.tsx        ~211 Modal for creating new nuggets with file upload
│   ├── NuggetSettingsModal.tsx        ~164 Modal for editing nugget settings
│   ├── FileList.tsx                   ~172 Legacy file list component
│   ├── FileUpload.tsx                  ~92 Drag-and-drop file upload
│   ├── FindReplaceBar.tsx              ~92 Search bar for document editor
│   ├── FormatToolbar.tsx               ~91 Bold/italic/heading formatting toolbar
│   ├── UploadView.tsx                  ~50 Upload prompt view
│   ├── ZoomOverlay.tsx                ~158 Fullscreen image zoom overlay
│   └── workbench/
│       ├── AnnotationWorkbench.tsx   ~1026 Canvas-based annotation system (draw/edit/select)
│       ├── AnnotationToolbar.tsx      ~449 Toolbar for annotation tools, colors, zoom
│       ├── CanvasRenderer.ts          ~507 Canvas rendering engine for annotations
│       ├── PinEditor.tsx              ~106 Pin instruction popover editor
│       └── RectangleEditor.tsx        ~103 Rectangle instruction popover editor
│
├── utils/
│   ├── ai.ts                          ~301 Style palettes, API configs, retry logic, Claude fetch wrapper
│   ├── markdown.ts                    ~132 parseMarkdownStructure, htmlToMarkdown
│   ├── fileProcessing.ts              ~81  processFileToDocument for MD/PDF/DOCX
│   ├── modificationEngine.ts         ~196  Gemini image modification (annotation-based + content-based)
│   ├── redline.ts                     ~243 Canvas-render annotations as high-contrast redline map
│   ├── geometry.ts                    ~118 RDP path simplification, bounding boxes, hit testing
│   ├── docx.ts                        ~150 JSZip DOCX text extraction with formatting
│   ├── documentHash.ts                ~25  djb2 hash for document change detection
│   ├── naming.ts                       ~67 Name uniqueness: getUniqueName, isNameTaken
│   ├── prompts/
│   │   ├── documentAnalysis.ts        ~119 PDF/DOCX → Markdown prompts (Claude)
│   │   ├── contentGeneration.ts       ~161 Card content synthesis + planner prompts (Claude + Gemini Flash)
│   │   ├── imageGeneration.ts         ~172 Visualizer + modification prompts (Gemini Pro Image)
│   │   ├── insightsLab.ts            ~110  Insights chat system prompt + card instructions (Claude)
│   │   └── promptUtils.ts            ~586  Prompt assembler: content → bracketed tags, palette → narrative
│   └── storage/
│       ├── StorageBackend.ts          ~168 Async storage interface (swappable for REST API)
│       ├── IndexedDBBackend.ts        ~560 IndexedDB implementation
│       └── serialize.ts              ~223  Serialization between React state and stored types
```

---

## 4. Application Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Header.tsx                                   │
├──────────────┬──────────────────────┬───────────────────────────────┤
│              │                      │                               │
│  FileSidebar │   InsightsLabPanel   │         AssetLab              │
│     .tsx     │       .tsx           │          .tsx                  │
│              │                      │                               │
│  ┌─────────┐│  ┌────────────────┐  │  ┌─────────────────────────┐  │
│  │Projects ││  │ Chat/Sources   │  │  │  cardlab title + hint   │  │
│  │  Tree   ││  │   Toggle       │  │  │  Generate/Inpaint toggle│  │
│  │         ││  ├────────────────┤  │  │  Style Toolbar / Annot. │  │
│  │ Nuggets ││  │ Document Tabs  │  │  ├─────────────────────────┤  │
│  │  List   ││  ├────────────────┤  │  │                         │  │
│  │         ││  │                │  │  │   Card Image Display    │  │
│  └─────────┘│  │  Chat Messages │  │  │   (AnnotationWorkbench) │  │
│              │  │  or Source     │  │  │                         │  │
│  ┌─────────┐│  │  Editor        │  │  ├─────────────────────────┤  │
│  │Insights ││  │                │  │  │  Card Properties Footer │  │
│  │Heading  ││  ├────────────────┤  │  └─────────────────────────┘  │
│  │ List    ││  │ Chat Input Bar │  │                               │
│  └─────────┘│  └────────────────┘  │                               │
├──────────────┴──────────────────────┴───────────────────────────────┤
```

**Panel layout:** Three-column layout with resizable proportions.

| Area | Component | Contains |
|---|---|---|
| Left sidebar | `FileSidebar` | Project tree, nugget list, + New Project/Nugget buttons, settings modals |
| Left sub-panel | `InsightsHeadingList` | Card headings with kebab menus, multi-select, copy/move |
| Center panel | `InsightsLabPanel` | Chat/Sources toggle, document tabs, chat messages, inline document editor, chat input |
| Right panel | `AssetLab` | CardLab title, Generate/Inpaint toggle, style toolbar (generate mode) or annotation toolbar (inpaint mode), card image with AnnotationWorkbench, Card Properties footer |

---

## 5. State Management Architecture

### Global State (AppContext)

| State Variable | Type | Controls | Read By | Written By |
|---|---|---|---|---|
| `nuggets` | `Nugget[]` | All nuggets in the app | FileSidebar, InsightsLabPanel, InsightsHeadingList, AssetLab | App.tsx handlers, context mutation helpers |
| `projects` | `Project[]` | All projects (contain nuggetIds) | FileSidebar | App.tsx handlers, context helpers |
| `selectedNuggetId` | `string \| null` | Currently active nugget | All panels | FileSidebar click handlers |
| `activeHeadingId` | `string \| null` | Currently active card heading | AssetLab, InsightsHeadingList | InsightsHeadingList click, App.tsx |
| `insightsSession` | `InsightsSession \| null` | Synthetic session (shim from selected nugget) | InsightsLabPanel, useInsightsLab | Compatibility shim in AppContext |
| `isFileSidebarOpen` | `boolean` | Sidebar visibility toggle | App layout | Header toggle button |

### Derived State

| Derived | Computed From | Description |
|---|---|---|
| `selectedNugget` | `nuggets.find(n => n.id === selectedNuggetId)` | The currently selected nugget object |
| `activeHeading` | `selectedNugget.headings.find(h => h.id === activeHeadingId)` | The currently active heading for card display |

### Compatibility Shim (Nugget ↔ InsightsSession)

The app uses a bi-directional sync between `selectedNugget` and `insightsSession`:

1. **Forward sync:** When `selectedNuggetId` changes, a `useEffect` builds a synthetic `InsightsSession` from the nugget's documents, messages, and headings
2. **Reverse sync:** When `insightsSession` changes (e.g., new chat message), a `useEffect` propagates changes back to the nugget in `nuggets[]`
3. **Timing guard:** A `shimReady` ref with 100ms delay prevents the initial hydrated state from triggering reverse sync

### Data Flow

```
User Action → Component Handler → Context Mutation Helper → setNuggets/setInsightsSession
                                                           ↓
                                                    usePersistence (debounced)
                                                           ↓
                                                    IndexedDB
```

---

## 6. Data Models & TypeScript Interfaces

### Core Entities

**`Nugget`** — The primary organizational unit. Each nugget owns its documents, headings, and chat messages.

```typescript
interface Nugget {
  id: string;
  name: string;
  type: NuggetType;               // Always 'insights'
  documents: UploadedFile[];       // Owned documents (per-nugget, not shared)
  headings: Heading[];             // Card headings with per-level data maps
  messages?: ChatMessage[];        // Chat conversation history
  lastDocHash?: string;            // Hash of active docs at last API call
  docChangeLog?: DocChangeEvent[]; // Ordered log of document mutations
  lastDocChangeSyncIndex?: number; // Index marking last sync to chat agent
  createdAt: number;
  lastModifiedAt: number;
}
```

**`Project`** — A folder of nuggets. Contains references (IDs), not owned data.

```typescript
interface Project {
  id: string;
  name: string;
  nuggetIds: string[];
  isCollapsed?: boolean;
  createdAt: number;
  lastModifiedAt: number;
}
```

**`Heading`** — A card heading with per-detail-level maps for synthesis, images, history, and plans.

```typescript
interface Heading {
  level: number;                    // Heading level (1-6)
  text: string;                     // Card title
  id: string;
  selected?: boolean;               // Multi-select state
  settings?: StylingOptions;        // Style, palette, ratio, resolution
  synthesisMap?: Partial<Record<DetailLevel, string>>;      // Synthesized content per level
  isSynthesizingMap?: Partial<Record<DetailLevel, boolean>>; // Loading state (transient)
  cardUrlMap?: Partial<Record<DetailLevel, string>>;         // Card image URLs per level
  isGeneratingMap?: Partial<Record<DetailLevel, boolean>>;   // Loading state (transient)
  imageHistoryMap?: Partial<Record<DetailLevel, ImageVersion[]>>; // Undo/redo per level
  visualPlanMap?: Partial<Record<DetailLevel, string>>;      // Layout plan per level
  lastGeneratedContentMap?: Partial<Record<DetailLevel, string>>; // Content at generation time
  lastPromptMap?: Partial<Record<DetailLevel, string>>;       // Full prompt used
  createdAt?: number;
  lastEditedAt?: number;
  sourceDocuments?: string[];
}
```

**`DetailLevel`** — Controls content density: `'Executive'` (70-100 words), `'Standard'` (200-250 words), `'Detailed'` (450-500 words).

**`StylingOptions`** — Visual configuration for card generation:

```typescript
interface StylingOptions {
  levelOfDetail: DetailLevel;
  style: string;                  // Visual style name (e.g., "Flat Design", "Neon / Dark Mode")
  palette: Palette;               // 5-color palette: background, primary, secondary, accent, text
  fonts: FontPair;                // primary (heading) + secondary (body) font
  aspectRatio: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
  resolution: '1K' | '2K' | '4K';
}
```

**`UploadedFile`** — A document owned by a nugget:

```typescript
interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;                   // MIME type
  lastModified: number;
  content?: string;               // Markdown content (after parsing)
  structure?: Heading[];           // Parsed heading structure
  status: 'uploading' | 'processing' | 'ready' | 'error';
  progress: number;
  enabled?: boolean;              // Whether included in chat context (transient, not persisted)
}
```

### Annotation Types

```typescript
type AnnotationTool = 'select' | 'pin' | 'arrow' | 'rectangle' | 'sketch' | 'text' | 'zoom';
type AnnotationType = 'pin' | 'arrow' | 'rectangle' | 'sketch';

interface PinAnnotation { type: 'pin'; position: NormalizedPoint; instruction: string; }
interface RectangleAnnotation { type: 'rectangle'; topLeft: NormalizedPoint; bottomRight: NormalizedPoint; instruction: string; }
interface ArrowAnnotation { type: 'arrow'; start: NormalizedPoint; end: NormalizedPoint; instruction: string; }
interface SketchAnnotation { type: 'sketch'; points: NormalizedPoint[]; strokeWidth: number; instruction: string; }

// All coordinates are normalized 0.0-1.0 (resolution-independent)
interface NormalizedPoint { x: number; y: number; }
```

### Chat & Session Types

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isCardContent?: boolean;        // True if "Generate Card" response
  detailLevel?: DetailLevel;
  savedAsHeadingId?: string;      // If user saved this to heading list
}

interface DocChangeEvent {
  type: 'added' | 'removed' | 'renamed' | 'enabled' | 'disabled' | 'updated';
  docId: string;
  docName: string;
  oldName?: string;
  timestamp: number;
}
```

---

## 7. Component Hierarchy & Responsibilities

```
index.tsx
└── StorageProvider                  Hydrates IndexedDB → initialState
    └── AppProvider(initialState)    Global context provider
        └── App                     Main orchestrator
            ├── Header              Top bar
            ├── FileSidebar         Project/nugget tree
            │   ├── NuggetCreationModal
            │   └── NuggetSettingsModal
            ├── InsightsLabPanel    Chat + document editing
            │   ├── DocumentEditorModal (inline mode)
            │   │   ├── FormatToolbar
            │   │   └── FindReplaceBar
            │   └── InsightsDocViewer
            ├── InsightsHeadingList Card headings with kebab menus
            ├── AssetLab           Card generation + display
            │   ├── AnnotationWorkbench
            │   │   ├── CanvasRenderer
            │   │   ├── PinEditor
            │   │   └── RectangleEditor
            │   └── AnnotationToolbar
            ├── ZoomOverlay        Fullscreen image zoom
            └── Dialogs (portals)  Confirmation dialogs
```

### Key Component Details

**`App.tsx` (1246 lines)** — The main orchestrator. Consumes `useAppContext()`, `useCardGeneration()`, `useInsightsLab()`, `usePersistence()`. Defines all handler functions for file upload, nugget CRUD, heading selection, card generation, and wires them to child components via props. Manages local state for: sidebar widths, active file, zoom state, reference image, editor modal, nugget settings, and various UI toggles.

**`FileSidebar.tsx` (774 lines)** — Renders the project tree and nugget list. Each project is collapsible, contains nugget rows with kebab menus (rename, delete, settings). Includes + New Project button, + New Nugget button, and inline rename editing with `isNameTaken` validation. Handles nugget selection, project CRUD, and nugget drag ordering.

**`InsightsLabPanel.tsx` (1288 lines)** — The largest component. Renders: Chat/Sources mode toggle, document tab strip with kebab menus (rename, copy/move, download, remove), inline document editor (DocumentEditorModal in inline mode), chat message list with markdown rendering, chat input bar with send/generate card menu. Features: unsaved-changes gating, document change detection notice, save-as-heading for card content messages.

**`InsightsHeadingList.tsx` (819 lines)** — Card heading list. Each row shows: heading name, status indicators (synthesis ✓, card image ✓), kebab menu with: Card Info submenu (timestamps, level, source docs), Rename Card, Copy/Move submenu (project-grouped target list), Edit Card Content, Remove Card. Supports: multi-select (Ctrl/Shift+click, Cmd+A), batch delete, active heading highlighting. Fixed hooks bug: all `useEffect` calls before early return.

**`AssetLab.tsx` (696 lines)** — The CardLab panel. Two modes: Generate (style toolbar with style/ratio/resolution/reference/palette/generate/download menus) and Inpaint (AnnotationToolbar). Renders the card image inside AnnotationWorkbench. Shows rotating status messages during generation. Static Card Properties footer showing current settings.

**`AnnotationWorkbench.tsx` (1026 lines)** — Canvas-based annotation editor. Handles: pan/zoom (mouse wheel + Alt+drag), annotation creation (pin click, rectangle/arrow drag, sketch freehand), annotation selection and movement, annotation editing (PinEditor/RectangleEditor popovers), redline generation for AI modification. Uses `CanvasRenderer` for all drawing.

---

## 8. Hooks & Custom Logic

### `useCardGeneration(menuDraftOptions, referenceImage, useReferenceImage)`

**Purpose:** Full card generation pipeline from content synthesis to image output.

**Internal state:** `genStatus` (status message), `activeLogicTab` (detail level), `manifestHeadings` (batch queue).

**Pipeline steps:**
1. `performSynthesis()` — Calls Claude to synthesize heading content at specified detail level
2. `generateCardForHeading()` — Full pipeline: settings → synthesis → planner (Gemini Flash) → visualizer (Gemini Pro Image) → update heading
3. `handleGenerateAll()` → `executeBatchCardGeneration()` — Sequential batch generation for selected headings
4. `handleImageModified()` — Updates heading after annotation-based modification

**Consumed by:** `App.tsx`

### `useInsightsLab()`

**Purpose:** Chat state management and Claude API integration.

**Manages:** `isLoading`, `abortRef` for cancellable requests.

**Key functions:**
- `sendMessage(text, isCardRequest, detailLevel)` — Builds cached system blocks (system prompt + document context) + multi-turn messages array, calls Claude API
- `handleDocChangeContinue()` — Injects system message summarizing document changes, then sends user message
- `handleDocChangeStartFresh()` — Clears chat for fresh conversation
- `pendingDocChanges` — Derived: unseen document changes since last sync

**Consumed by:** `App.tsx`

### `useAnnotations()`

**Purpose:** CRUD for spatial annotations on card images.

**State:** `annotations: Annotation[]`, `selectedAnnotationId: string | null`

**Functions:** `add`, `update`, `remove`, `select`, `clearAll`, `moveAnnotation` (with clamped normalized coordinates)

**Consumed by:** `AnnotationWorkbench`

### `useVersionHistory(initialHistory, originalImageUrl)`

**Purpose:** Undo/redo stack for image modifications. Max 10 versions with blob URL cleanup.

**State:** `versions: ImageVersion[]`, `currentIndex: number`

**Functions:** `pushVersion`, `restorePrevious` (undo), `restoreNext` (redo), `restoreByIndex`, `resetHistory`

**Consumed by:** `AnnotationWorkbench`

### `useDocumentEditing(doc, editorRef, observerRef)`

**Purpose:** contentEditable rich text editing. Uses MutationObserver to detect structural changes and sync heading states.

**Consumed by:** `DocumentEditorModal`

### `useDocumentFindReplace(editorRef, scrollContainerRef)`

**Purpose:** DOM-based find/replace with `<mark>` injection for highlighting.

**Consumed by:** `DocumentEditorModal`

### `usePersistence(options)`

**Purpose:** Debounced auto-save to IndexedDB. Separate timers for app state (300ms) and data (1500ms).

**Saves:** App state (selectedNuggetId, activeHeadingId), insights session, all nuggets (with documents, headings, images), all projects. Handles cleanup of deleted entities.

**Consumed by:** `App.tsx`

---

## 9. API & External Service Integration

### Anthropic Claude API

| Aspect | Details |
|---|---|
| **Endpoint** | `https://api.anthropic.com/v1/messages` |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max tokens** | 64,000 (default), scaled per use case |
| **Auth** | `x-api-key` header + `anthropic-dangerous-direct-browser-access: true` |
| **Caching** | Prompt caching via `cache_control: { type: 'ephemeral' }` on system blocks and last user message. Minimum 4,000 chars for caching. |
| **Retry** | Exponential backoff (2^n seconds), max 3 retries on 429/500/503 |
| **Uses** | Document parsing (PDF/DOCX → MD), content synthesis, insights chat, card content generation |

### Google Gemini Flash API

| Aspect | Details |
|---|---|
| **Model** | `gemini-3-flash-preview` |
| **Config** | `ThinkingLevel.LOW`, `responseModalities: [TEXT]` |
| **Purpose** | Layout planning — generates spatial blueprint for card visualization |
| **Retry** | Same `withRetry` wrapper (3 retries, exponential backoff) |

### Google Gemini Pro Image API

| Aspect | Details |
|---|---|
| **Model** | `gemini-3-pro-image-preview` |
| **Config** | `responseModalities: [TEXT, IMAGE]`, `imageConfig: { aspectRatio, imageSize }` |
| **Purpose** | Card image generation and annotation-based modification |
| **Input** | Text prompt + optional reference image (inlineData) + optional redline map (inlineData) |
| **Output** | Image as base64 inline data |
| **Retry** | Same `withRetry` wrapper |

---

## 10. Core User Workflows

### Workflow 1: App Startup & Hydration

1. `index.tsx` renders `<StorageProvider>` which wraps `<App>`
2. `StorageProvider.useEffect` → `IndexedDBBackend.init()` opens database `infonugget-db` v3
3. Loads: app state, nuggets, nugget documents, nugget headings, nugget images, projects
4. Runs migration if needed (v1→v3: files→nuggets, v2→v3: global docs→per-nugget docs)
5. Converts blob URLs to data URLs in image history
6. Passes `initialState` to `AppProvider`, which hydrates all state
7. `usePersistence` starts with hydration guard (skips first save cycle)

### Workflow 2: Document Upload

1. User clicks upload button or drops file in `InsightsLabPanel`
2. `createPlaceholderDocument(file)` creates UploadedFile with `status: 'processing'`
3. `addNuggetDocument(placeholder)` adds to nugget immediately (shows spinner in UI)
4. `processFileToDocument(file, id)` runs async:
   - **MD:** Passthrough `file.text()`
   - **DOCX:** `extractDocxText(file)` via JSZip → `callClaude(DOCX_TEXT_ANALYSIS_PROMPT + rawText)`
   - **PDF:** `fileToBase64(file)` → `callClaude(DOCUMENT_ANALYSIS_PROMPT, { document: { base64, mediaType } })`
5. `parseMarkdownStructure(markdown)` extracts heading structure
6. `updateNuggetDocument(id, readyDoc)` updates placeholder → ready doc
7. `DocChangeEvent` with `type: 'added'` is logged to `nugget.docChangeLog`

### Workflow 3: Chat with Documents (Insights)

1. User types message in `InsightsLabPanel` input bar
2. `handleDocChangeContinue(text, isCardRequest, detailLevel)` in `useInsightsLab`:
   a. If pending doc changes → inject system message summarizing changes
   b. `sendMessage()` builds:
      - System blocks: `INSIGHTS_SYSTEM_PROMPT` + document context (cached)
      - Messages array: full conversation history as user/assistant turns
   c. Calls `callClaude('', { systemBlocks, messages, maxTokens, signal })`
   d. Appends assistant response to nugget messages
   e. Updates `lastDocHash`

### Workflow 4: Card Generation Pipeline

1. User clicks Generate in AssetLab or kebab menu
2. `generateCardForHeading(heading)` in `useCardGeneration`:
   a. **Settings:** Apply `menuDraftOptions` to heading
   b. **Synthesis:** If no content at current level → `performSynthesis()` calls Claude
   c. **Planning:** `buildPlannerPrompt()` → Gemini Flash → spatial layout blueprint
   d. **Visualization:** `buildVisualizerPrompt()` (via `assembleRendererPrompt` in promptUtils) → Gemini Pro Image
      - If reference image enabled: sends reference as inlineData
      - `promptUtils.transformContentToTags()` converts markdown to bracketed tags
      - `promptUtils.buildNarrativeStyleBlock()` converts palette to semantic color bindings
   e. **Storage:** Updates heading with `cardUrlMap`, `imageHistoryMap`, `lastGeneratedContentMap`, `visualPlanMap`, `lastPromptMap`

### Workflow 5: Card Annotation & Modification

1. User switches to Inpaint mode in AssetLab
2. AnnotationWorkbench renders card image on canvas
3. User creates annotations (pin, rectangle, arrow, sketch) with instructions
4. User clicks Modify button in AnnotationToolbar
5. `generateRedlineMap(annotations, width, height)` in `redline.ts`:
   - Renders annotations on black canvas in bright red
   - Generates numbered instruction list with spatial coordinates
6. `executeModification({ originalImageUrl, redlineDataUrl, instructions })` in `modificationEngine.ts`:
   - Sends original image + redline map + instructions to Gemini Pro Image
7. `handleImageModified(headingId, newImageUrl, history)` updates heading
8. `useVersionHistory.pushVersion()` adds to undo stack

### Workflow 6: Card Copy/Move Between Nuggets

1. User opens card kebab menu → Copy/Move
2. Hover submenu shows project-grouped nugget list
3. User clicks Copy or Move button on target nugget
4. `onCopyMoveHeading(headingId, targetNuggetId, mode)` in App.tsx:
   - Finds heading, creates copy with `getUniqueName()` for name dedup
   - `updateNugget(targetId, ...)` adds copied heading to target
   - If mode === 'move': `updateNugget(sourceId, ...)` removes from source

---

## 11. File Processing & Parsing

| File Type | Parser | Method | Output |
|---|---|---|---|
| **Markdown (.md)** | Native | `file.text()` passthrough | Raw markdown string |
| **PDF (.pdf)** | Claude API | Base64 encoded → Claude document block with `DOCUMENT_ANALYSIS_PROMPT` | Structured markdown |
| **DOCX (.docx)** | JSZip + Claude | `extractDocxText()`: JSZip decompresses → DOMParser parses XML → extracts paragraphs with bold/italic formatting → Claude structures with `DOCX_TEXT_ANALYSIS_PROMPT` | Structured markdown |

**Post-processing:** All file types go through `parseMarkdownStructure(markdown)` which extracts heading hierarchy using regex `^(#{1,6})\s+(.*)$`.

**Known limitations:**
- DOCX: Only paragraph text with bold/italic preserved; images, charts, embedded objects are lost
- PDF: Relies on Claude's document understanding; complex multi-column layouts may have ordering issues
- No OCR for scanned PDFs
- Large files may hit Claude's context window limits

---

## 12. AI/ML Pipeline

### Pipeline Overview

```
Document → [Claude: Parse] → Markdown → [Claude: Synthesize] → Card Content
                                                                     ↓
                                                        [Gemini Flash: Plan Layout]
                                                                     ↓
                                                        [Gemini Pro: Generate Image]
                                                                     ↓
                                                        [User: Annotate]
                                                                     ↓
                                                        [Gemini Pro: Modify Image]
```

### Step 1: Document Parsing (Claude)
- **Prompt:** `DOCUMENT_ANALYSIS_PROMPT` (PDF) or `DOCX_TEXT_ANALYSIS_PROMPT` (DOCX)
- **Key constraint:** "You MUST reproduce the ENTIRE document content faithfully and completely"
- **Output:** Well-structured Markdown with proper heading hierarchy

### Step 2: Content Synthesis (Claude)
- **Prompt:** `buildContentPrompt()` with word count targets per detail level
- **Caching:** Full document context in system block (cached), section text in user message
- **Output:** Infographic-ready markdown at specified word count

### Step 3: Layout Planning (Gemini Flash)
- **Prompt:** `buildPlannerPrompt()` — spatial blueprint with component inventory, arrangement, emphasis
- **Key constraint:** "DO NOT REWRITE THE CONTENT" — planner only decides WHERE things go
- **Output:** Narrative description of layout (no fonts, no colors, no pixel values)

### Step 4: Image Generation (Gemini Pro Image)
- **Prompt:** `buildVisualizerPrompt()` → `assembleRendererPrompt()` in promptUtils
- **Critical:** All prompts use narrative prose only (no markdown, no XML) to prevent text leakage
- **Content transformation:** `transformContentToTags()` converts markdown to `[TITLE]...[/TITLE]`, `[SECTION]...[/SECTION]` etc.
- **Palette handling:** `buildNarrativeStyleBlock()` converts hex colors to semantic bindings (e.g., "warm red (#E63946) for headers")
- **Style-palette conflict detection:** Adds override language when user palette doesn't match style defaults

### Step 5: Image Modification (Gemini Pro Image)
- **Annotation-based:** `buildModificationPrompt()` + original image + redline map
- **Content-based:** `buildContentModificationPrompt()` + original image as reference

---

## 13. Routing & Navigation

**No router.** This is a single-page application with conditional rendering based on state:

- `selectedNuggetId === null` → `LandingPage` (empty state)
- `selectedNuggetId !== null` → Three-panel layout (FileSidebar + InsightsLabPanel + AssetLab)
- `InsightsLabPanel` switches between `chat` and `sources` view modes via `viewMode` state
- `AssetLab` switches between `generate` and `inpaint` modes via `cardLabMode` state
- Modals (NuggetCreationModal, NuggetSettingsModal, DocumentEditorModal, Dialogs) use `createPortal(el, document.body)`

---

## 14. Styling Architecture

**Tailwind CSS** via CDN (`<script src="https://cdn.tailwindcss.com">`). No build-time purging.

**Custom CSS** in `index.html` `<style>` block:
- CSS custom properties: `--acid-h1` through `--acid-h6`, `--acid-lime` (#ccff00) — brand color system
- `.document-prose` — Libre Baskerville serif styles for document editor
- `.chat-prose` — Tighter spacing variant for chat messages
- `.system-notice-prose` — Green-tinted styles for system messages
- `.sidebar-node-active` — Active item indicator with lime accent bar
- `.glass-toolbar` — Glassmorphism backdrop blur
- `.zoom-tool-*` — Cursor styles for annotation tools

**Design language (ui-refresh branch):**
- Black thin borders (`border border-black`)
- 6px default rounding → animated 14px on hover/selection (`rounded-[6px]` → `rounded-[14px]`)
- Light grey backgrounds for selected states (`bg-zinc-100`)
- No shadows (clean, flat aesthetic)
- Unified spacing and black text for interactive elements
- Transition: `border-radius 200ms ease`

**13 visual styles** defined in `utils/ai.ts` `VISUAL_STYLES` with corresponding font pairs in `STYLE_FONTS`.

---

## 15. Settings & Configuration Management

**Per-Card Settings** (`StylingOptions`):
- Style, palette (5 colors), aspect ratio, resolution, detail level, fonts
- Applied at generation time via `menuDraftOptions` in AssetLab toolbar
- Saved to `heading.settings` after generation
- Displayed in Card Properties footer

**Per-Nugget Settings** (`NuggetSettingsModal`):
- Nugget name (with uniqueness validation)
- Managed via `updateNugget()` in AppContext

**Persistence:** All settings are persisted to IndexedDB via `usePersistence` with debounced auto-save. Settings survive page reload.

**Reference Image:** A "stamp" of a generated card used as style reference for subsequent generations. Stored as `ReferenceImage` with settings snapshot. Controlled via Reference menu in AssetLab toolbar.

---

## 16. Error Handling & Resilience

| Scenario | Handling |
|---|---|
| **API call failure** | `withRetry()`: exponential backoff (2s, 4s, 8s), max 3 retries on 429/500/503 |
| **Claude API error** | Error message appended as assistant message in chat |
| **Gemini image fail** | Alert dialog with error message; heading `isGeneratingMap` reset |
| **File parse failure** | Console error; document stays in 'processing' state |
| **IndexedDB failure** | Console warning; app continues with in-memory state |
| **Hydration failure** | Falls back to empty state (no nuggets, no projects) |
| **Blob URL in storage** | Converted to data URLs before saving (blob URLs are session-specific) |
| **Abort/cancel** | `AbortController` in useInsightsLab; silently ignored `AbortError` |
| **React hooks violation** | Fixed: all `useEffect` calls before any early return in components |

---

## 17. Performance Considerations

| Pattern | Location | Purpose |
|---|---|---|
| **Debounced persistence** | `usePersistence` | 300ms app state, 1500ms data saves |
| **Prompt caching** | `callClaude()` | Caches system blocks + last user message to reduce token costs |
| **Lazy singleton** | `useCardGeneration` | `GoogleGenAI` instance created once |
| **useMemo/useCallback** | AppContext, hooks | Prevent unnecessary re-renders |
| **Separate image storage** | IndexedDB stores | Images (large) separated from heading metadata (small) |
| **RDP simplification** | `geometry.ts` | Reduces freehand sketch points before storage |
| **Transient fields stripped** | `serialize.ts` | `isSynthesizingMap`, `isGeneratingMap`, `startIndex`, `isDirty` removed before persistence |

**Known bottlenecks:**
- Tailwind CDN (runtime JIT) adds ~100ms+ to initial load
- Large base64 card images in state cause re-render overhead
- Sequential batch generation (could be parallelized but risks API rate limits)

---

## 18. Security Considerations

| Concern | Status |
|---|---|
| **API keys** | Exposed client-side via Vite `define`. Not secure for production — keys visible in browser DevTools. |
| **CORS** | Claude API uses `anthropic-dangerous-direct-browser-access: true` header for direct browser calls. |
| **Input sanitization** | Chat messages rendered via `marked` (markdown → HTML) then `dangerouslySetInnerHTML`. No XSS sanitization. |
| **Authentication** | None. No user accounts, no access control. |
| **Data storage** | All data in browser IndexedDB. No server-side storage. |

---

## 19. Testing

Not applicable. No test framework, no tests, no test files exist in the project. The project is verified manually.

---

## 20. Build, Deploy & Run

**Install:**
```bash
npm install
```

**Development:**
```bash
npm run dev
# Starts Vite dev server on http://localhost:3000
```

**Build:**
```bash
npm run build
# Output: dist/ directory
```

**Preview production build:**
```bash
npm run preview
```

**Environment setup:**
1. Create `.env.local` in project root
2. Add: `GEMINI_API_KEY=your_key` and `ANTHROPIC_API_KEY=your_key`
3. Vite injects these at build time

---

## 21. Known Constraints, Quirks & Technical Debt

1. **No backend** — API keys exposed client-side. Not suitable for production deployment without a proxy server.
2. **Tailwind CDN** — Runtime JIT compilation. Should migrate to build-time Tailwind for production.
3. **No XSS sanitization** — Chat messages rendered via `dangerouslySetInnerHTML` with `marked`. Should add DOMPurify.
4. **Sequential batch generation** — Batch card generation runs cards one at a time. Could parallelize with rate limiting.
5. **Blob URL conversion** — Image URLs start as blob URLs, must be converted to data URLs before IndexedDB storage. This conversion happens in `serialize.ts`.
6. **Compatibility shim** — The `insightsSession` ↔ `nuggets[]` bi-directional sync is a legacy pattern from v2. Should be refactored to use nuggets directly.
7. **Shimmy timing guard** — 100ms `setTimeout` in AppContext to prevent hydration state triggering reverse sync. Fragile timing dependency.
8. **Single workflow type** — `NuggetType` is always `'insights'`. The original v1 "synthesis" workflow (single doc) was removed but type infrastructure remains.
9. **No undo for delete** — Deleting a nugget or project is permanent (no trash/recovery).
10. **Large state objects** — Card images stored as data URLs in React state. Could benefit from external blob storage.
11. **No lazy loading** — All components loaded upfront. No React.lazy or code splitting.
12. **No error boundaries** — React error boundaries not implemented. Unhandled errors crash the whole app.
13. **CRLF warnings** — Git line ending warnings on Windows. No `.gitattributes` configured.
14. **Multi-turn image chat not implemented** — TODO in `modificationEngine.ts` for Gemini multi-turn chat sessions per heading.

---

## 22. Planned / In-Progress Features

1. **Multi-turn Gemini chat for image editing** — Documented TODO in `modificationEngine.ts`. Would maintain per-heading chat sessions for iterative image modifications without re-sending full images.
2. **REST API backend** — `StorageBackend` interface is designed for swappable backends. Currently only IndexedDB; planned REST API backend for multi-device sync.
3. **Content-dirty regeneration** — `contentDirty` computed value in `useCardGeneration` detects when synthesis content changed since last image generation. UI indicator exists but auto-regeneration not implemented.
