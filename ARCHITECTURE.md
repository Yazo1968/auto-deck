# Infonugget v4.0 — Complete Architecture Reference

> **Last updated:** 2026-02-16
> **Total codebase:** ~12,200 lines of TypeScript/TSX across 56 source files (excluding `node_modules`, `dist`, reference docs)

---

## Table of Contents

1. [What This App Does](#1-what-this-app-does)
2. [Tech Stack](#2-tech-stack)
3. [File & Folder Structure](#3-file--folder-structure)
4. [Application Layout](#4-application-layout)
5. [State Management Architecture](#5-state-management-architecture)
6. [Data Models & TypeScript Interfaces](#6-data-models--typescript-interfaces)
7. [Component Hierarchy & Responsibilities](#7-component-hierarchy--responsibilities)
8. [Hooks & Custom Logic](#8-hooks--custom-logic)
9. [API & External Service Integration](#9-api--external-service-integration)
10. [Core User Workflows (Step by Step)](#10-core-user-workflows-step-by-step)
11. [File Processing & Parsing](#11-file-processing--parsing)
12. [AI/ML Pipeline](#12-aiml-pipeline)
13. [Routing & Navigation](#13-routing--navigation)
14. [Styling Architecture](#14-styling-architecture)
15. [Settings & Configuration Management](#15-settings--configuration-management)
16. [Error Handling & Resilience](#16-error-handling--resilience)
17. [Performance Considerations](#17-performance-considerations)
18. [Security Considerations](#18-security-considerations)
19. [Testing](#19-testing)
20. [Build, Deploy & Run](#20-build-deploy--run)
21. [Known Constraints, Quirks & Technical Debt](#21-known-constraints-quirks--technical-debt)
22. [Planned / In-Progress Features](#22-planned--in-progress-features)

---

## 1. What This App Does

Infonugget is an AI-powered document-to-infographic tool. Users upload documents (Markdown, PDF, or DOCX), and the app parses them into a heading-based structure, synthesizes the content into card-ready text at configurable detail levels, and then generates visually styled infographic card images using AI. The generated cards can be annotated, modified, and downloaded.

**Target user:** Knowledge workers, content creators, educators, and anyone who needs to transform dense documents into visual, digestible infographic cards.

**Primary workflow in one sentence:** User uploads a document, the app extracts its structure, AI synthesizes content per heading, plans a visual layout, and generates a styled infographic card image for each section.

---

## 2. Tech Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | React | 19.2.4 | UI rendering, component architecture |
| **Language** | TypeScript | ~5.8.2 | Type safety across entire codebase |
| **Bundler** | Vite | ^6.2.0 | Dev server, HMR, production build |
| **Styling** | Tailwind CSS (CDN) | Latest via CDN | Utility-first CSS framework |
| **Fonts** | Google Fonts | N/A | Inter (UI), JetBrains Mono (code) |
| **AI (Text)** | Anthropic Claude | claude-sonnet-4-5-20250929 | Document parsing, content synthesis, insights chat |
| **AI (Layout)** | Google Gemini Flash | gemini-3-flash-preview | Visual layout planning |
| **AI (Images)** | Google Gemini Pro Image | gemini-3-pro-image-preview | Card image generation, image modification |
| **AI SDK** | @google/genai | ^1.41.0 | Gemini API client |
| **Markdown** | marked | 15.0.7 | Markdown to HTML rendering |
| **DOCX** | JSZip | ^3.10.1 | DOCX file extraction (ZIP-based) |
| **Persistence** | IndexedDB | Browser native | Client-side data persistence |
| **Backend** | None | N/A | Pure client-side SPA |

### Environment Variables & API Key Configuration

API keys are stored in `.env.local` at project root and injected at build time via `vite.config.ts`:

| Variable | Injected As | Used By |
|----------|-------------|---------|
| `GEMINI_API_KEY` | `process.env.API_KEY` and `process.env.GEMINI_API_KEY` | Gemini Flash (layout planning) and Gemini Pro Image (card generation, modification) |
| `ANTHROPIC_API_KEY` | `process.env.ANTHROPIC_API_KEY` | Claude (document parsing, content synthesis, insights chat) |

The `vite.config.ts` reads `.env.local` directly (bypassing Vite's `loadEnv`) to prevent empty system environment variables from shadowing file-defined values. Keys are embedded in the client bundle via Vite's `define` option — there is no backend.

---

## 3. File & Folder Structure

```
infonugget-v4.0/
├── index.html                          [236 lines]  HTML shell: Tailwind CDN, Google Fonts, CSS vars, importmap
├── index.tsx                           [ 19 lines]  React entry: mounts StorageProvider > App
├── App.tsx                             [1261 lines]  Main orchestrator: wires hooks, components, modals, state
├── types.ts                            [230 lines]  All TypeScript interfaces, types, enums
├── vite.config.ts                      [ 58 lines]  Vite config: API key injection, path aliases
├── tsconfig.json                       [ 30 lines]  TypeScript config
├── package.json                        [ 24 lines]  Dependencies and scripts
│
├── context/
│   └── AppContext.tsx                   [607 lines]  Global state provider: nuggets, files, editing, workflows
│
├── hooks/
│   ├── useAnnotations.ts               [ 78 lines]  Annotation CRUD for canvas overlays
│   ├── useDocumentEditing.ts           [266 lines]  contentEditable rich-text editing + MutationObserver
│   ├── useDocumentFindReplace.ts       [291 lines]  DOM-based find/replace with mark injection
│   ├── useFileManagement.ts            [218 lines]  File upload, parse, duplicate/DOCX warnings
│   ├── useInsightsLab.ts               [183 lines]  Multi-turn Claude chat for insights workflow
│   ├── usePersistence.ts               [216 lines]  Debounced auto-save to IndexedDB
│   ├── useSynthesis.ts                 [340 lines]  AI content synthesis + card image generation pipeline
│   └── useVersionHistory.ts            [173 lines]  Undo/redo stack for image modifications
│
├── components/
│   ├── AssetLab.tsx                    [620 lines]  Card design workbench: styling, image gen, annotations
│   ├── ContentPanel.tsx                [284 lines]  Synthesized content display and generation controls
│   ├── Dialogs.tsx                     [459 lines]  7 modal dialogs (batch, warnings, confirmations)
│   ├── DocumentEditorModal.tsx         [538 lines]  Full-screen document editor with heading sidebar
│   ├── FileList.tsx                    [172 lines]  Uploaded file list with status indicators
│   ├── FileSidebar.tsx                 [271 lines]  Nugget navigation sidebar (collapsible)
│   ├── FileUpload.tsx                  [ 92 lines]  Drag-and-drop file upload component
│   ├── FindReplaceBar.tsx              [ 92 lines]  Find/replace UI with match navigation
│   ├── FormatToolbar.tsx               [101 lines]  Rich-text formatting toolbar (bold, italic, headings)
│   ├── Header.tsx                      [ 20 lines]  Landing page header with logo
│   ├── InsightsDocViewer.tsx           [ 79 lines]  Read-only document viewer for insights workflow
│   ├── InsightsHeadingList.tsx         [230 lines]  Heading list with context menus for insights
│   ├── InsightsLabPanel.tsx            [508 lines]  Chat interface + card content viewer
│   ├── LandingPage.tsx                 [122 lines]  Animated splash screen
│   ├── LoadingScreen.tsx               [ 29 lines]  Hydration loading screen
│   ├── ManageDocumentsModal.tsx        [564 lines]  Document management (add, remove, rename, toggle)
│   ├── NuggetCreationModal.tsx         [266 lines]  Create new synthesis/insights nugget
│   ├── NuggetSettingsModal.tsx         [191 lines]  Nugget rename, metadata, delete
│   ├── StorageProvider.tsx             [288 lines]  Hydration from IndexedDB, data migration, app wrapping
│   ├── StructureView.tsx              [200 lines]  Document heading tree with collapse/select
│   ├── UploadView.tsx                  [ 43 lines]  Upload screen wrapper (Header + FileUpload + FileList)
│   ├── ZoomOverlay.tsx                 [158 lines]  Full-screen image viewer with pan/zoom
│   └── workbench/
│       ├── AnnotationToolbar.tsx       [399 lines]  Annotation tool buttons, color picker, zoom controls
│       ├── AnnotationWorkbench.tsx     [1020 lines] Canvas annotation system (draw, select, drag, modify)
│       ├── CanvasRenderer.ts           [507 lines]  Canvas rendering + hit testing for annotations
│       ├── PinEditor.tsx               [102 lines]  Pin annotation instruction popover
│       └── RectangleEditor.tsx         [ 99 lines]  Rect/arrow/sketch instruction popover
│
├── utils/
│   ├── ai.ts                           [301 lines]  Style palettes, API configs, Claude client, retry logic
│   ├── documentHash.ts                 [ 25 lines]  djb2 hash for document change detection
│   ├── docx.ts                         [150 lines]  DOCX text extraction (ZIP > XML > Markdown)
│   ├── fileProcessing.ts              [ 81 lines]  Unified file processing pipeline (MD/PDF/DOCX)
│   ├── geometry.ts                     [118 lines]  RDP path simplification, hit testing, distance calc
│   ├── markdown.ts                     [132 lines]  Markdown structure parser + HTML-to-Markdown converter
│   ├── modificationEngine.ts          [196 lines]  Gemini image modification (annotation + content)
│   ├── redline.ts                      [243 lines]  Canvas redline map generator from annotations
│   ├── prompts/
│   │   ├── contentGeneration.ts       [161 lines]  Synthesis + planner prompt builders
│   │   ├── documentAnalysis.ts        [119 lines]  PDF/DOCX analysis prompt constants
│   │   ├── imageGeneration.ts         [172 lines]  Visualizer + modification prompt builders
│   │   ├── insightsLab.ts             [ 81 lines]  Insights system prompt + card instruction builder
│   │   └── promptUtils.ts            [586 lines]  Prompt sanitization, tag transform, color/font mapping
│   └── storage/
│       ├── StorageBackend.ts          [149 lines]  Abstract async storage interface (40 methods)
│       ├── serialize.ts               [191 lines]  React state <-> storage type serialization
│       └── IndexedDBBackend.ts        [527 lines]  IndexedDB implementation (13 stores, v3 migrations)
│
└── reference md (not used by the app)/
    ├── gemini doc.md                              Reference documentation
    ├── nano banan doc.md                          Reference documentation
    ├── PROMPT-SEQUENCE.md                         Prompt engineering reference
    └── reference-image-plan.md                    Image generation planning reference
```

---

## 4. Application Layout

### Screen Flow

1. **Loading Screen** — Shown during IndexedDB hydration (`LoadingScreen.tsx`)
2. **Landing Page** — Animated splash with "Launch App" CTA (`LandingPage.tsx`)
3. **Main Application** — Three-panel workspace

### Main Application ASCII Layout

```
+--------+------------------+--------------------+----------------------------+
| Nugget | Cardlist          | Content /           | Asset Lab                  |
| Sidebar| Sidebar           | Insights Chat       | (Image Gen + Annotations)  |
|        |                   |                     |                            |
| [File  | [Document]        | [Tab Bar]           | [Style Settings]           |
|  Side  | [H1/H2/H3 btns]  | [Exec|Std|Detail]   | [Style|Ratio|Res|Palette]  |
|  bar]  |                   |                     |                            |
|        | - Heading 1  [x]  | Synthesized content  | +----------------------+   |
| Nugget | - Heading 2  [x]  | or Chat messages     | | Generated Card Image |   |
|  List  |   - Sub 2.1 [x]  |                     | |                      |   |
|        | - Heading 3  [ ]  | [Synth] [Batch]     | | [Annotation Canvas]  |   |
| [+New] |                   | [Copy] [Edit]       | +----------------------+   |
|        | [Manage Docs]     |                     | [Generate] [Download]      |
|        | (insights only)   |                     | [Version History Strip]    |
+--------+------------------+--------------------+----------------------------+
|                        Footer: "infonugget is AI powered..."                  |
+-------------------------------------------------------------------------------+
```

| Area | Component | Contents |
|------|-----------|----------|
| **Nugget Sidebar** | `FileSidebar` | Collapsible list of all nuggets (synthesis + insights), create/rename/delete actions |
| **Cardlist Sidebar** | Inline in `App.tsx` | Document name (synthesis) or document list + "Manage Documents" (insights), heading tree with selection checkboxes, H1/H2/H3 level-select toolbar |
| **Content Panel (Synthesis)** | `ContentPanel` | Detail level tabs, synthesized markdown display, synthesis/batch buttons, copy/edit actions |
| **Chat Panel (Insights)** | `InsightsLabPanel` | Multi-turn chat with Claude, Ask/Card mode toggle, message history, card content viewer |
| **Asset Lab** | `AssetLab` | Style/palette/aspect-ratio/resolution settings, generated card image, annotation workbench, reference image management, generate/download actions, version history |
| **Footer** | Inline in `App.tsx` | AI disclaimer |

### Modal Overlays

| Modal | Component | Trigger |
|-------|-----------|---------|
| Zoom viewer | `ZoomOverlay` | Click on card image |
| Document editor | `DocumentEditorModal` | Edit document or card content |
| Nugget creation | `NuggetCreationModal` | "Create Nugget" button |
| Nugget settings | `NuggetSettingsModal` | Nugget kebab menu |
| Manage documents | `ManageDocumentsModal` | "Manage Documents" button (insights) |
| Batch synthesis | `BatchSynthesisModal` | Batch menu in content panel |
| DOCX warning | `DocxWarningModal` | Upload .docx file |
| Duplicate warning | `DuplicateWarningModal` | Upload file with existing name |
| Document changes | `DocumentChangeDialog` | Send message after docs changed |
| Style mismatch | `ReferenceMismatchDialog` | Generate with mismatched reference |

---

## 5. State Management Architecture

### Architecture Overview

State is managed through a single React Context (`AppContext`) with compatibility shims for legacy patterns. There is no external state library (no Redux, Zustand, etc.).

```
StorageProvider (hydration)
  └── AppProvider (initialState)
        ├── Global state via useState hooks
        ├── Derived values via useMemo
        ├── Mutation helpers via useCallback
        └── Compatibility shims via useEffect
              └── App.tsx (orchestrator)
                    ├── useSynthesis (AI pipeline state)
                    ├── useInsightsLab (chat state)
                    ├── useFileManagement (upload state)
                    └── Local component state (UI toggles, menus, forms)
```

### Global State (AppContext)

| State Variable | Type | Controls | Read By | Written By |
|---------------|------|----------|---------|------------|
| `nuggets` | `Nugget[]` | All nuggets (synthesis + insights) with owned documents, headings, messages | App, FileSidebar, all hooks | addNugget, deleteNugget, updateNugget, and 10+ mutation helpers |
| `selectedNuggetId` | `string \| null` | Currently active nugget | App, all hooks, all panels | FileSidebar click, NuggetCreationModal |
| `files` | `UploadedFile[]` | Legacy file list (populated by shim from selected nugget) | ContentPanel, useSynthesis, useFileManagement | Compatibility shim from nugget selection |
| `selectedFileId` | `string \| null` | Legacy selected file (populated by shim) | ContentPanel, useSynthesis | Compatibility shim |
| `draftStructure` | `Heading[]` | Current heading list for active nugget | StructureView, ContentPanel, useSynthesis | Shim, editing, synthesis |
| `activeHeadingId` | `string \| null` | Currently focused heading in cardlist | All panels, AssetLab | Sidebar click, heading navigation |
| `workflowMode` | `'synthesis' \| 'insights'` | Determines which panels render | App (conditional rendering) | Nugget selection shim |
| `insightsSession` | `InsightsSession \| null` | Legacy chat session (populated by shim) | InsightsLabPanel, useInsightsLab | Compatibility shim, reverse sync |
| `isFileSidebarOpen` | `boolean` | Nugget sidebar collapse state | FileSidebar | Toggle button |

### Derived State

| Derived Value | Computation | Used By |
|--------------|-------------|---------|
| `selectedFile` | `files.find(f => f.id === selectedFileId)` | ContentPanel, useSynthesis |
| `displayFile` | Selected file with `draftStructure` overlaid | StructureView, App sidebar |
| `selectedNugget` | `nuggets.find(n => n.id === selectedNuggetId)` | All nugget-aware components |
| `activeHeading` | Found from draftStructure (synthesis) or nugget headings (insights) | ContentPanel, AssetLab, useSynthesis |

### Compatibility Shim Pattern

The app migrated from a file-centric model to a nugget-centric model. To avoid rewriting every consumer:

1. **Forward shim** (`selectedNuggetId` changes): Populates `files[]`, `selectedFileId`, `insightsSession`, `draftStructure`, and `workflowMode` from the selected nugget's data.
2. **Reverse sync** (`draftStructure` or `insightsSession` changes): Propagates changes back to the nugget's headings/messages.
3. **Shim delay**: A 100ms timer (`shimReady` ref) prevents the shim from overwriting hydrated state on initial mount.

### Nugget Mutation Helpers (AppContext)

| Helper | Purpose |
|--------|---------|
| `updateNuggetHeading(id, updater)` | Update one heading across nugget + draftStructure + files + insightsSession |
| `updateNuggetHeadings(updater)` | Update all headings in active nugget (batch) |
| `updateNuggetContent(content)` | Update synthesis nugget's markdown content |
| `updateNuggetContentAndHeadings(content, headings)` | Atomic content + headings update |
| `appendNuggetMessage(message)` | Add chat message to insights nugget |
| `addNuggetDocument(doc)` | Add document to active nugget |
| `removeNuggetDocument(docId)` | Remove document from active nugget |
| `renameNuggetDocument(docId, name)` | Rename a nugget's document |
| `toggleNuggetDocument(docId)` | Enable/disable document in context |
| `applyDocumentChanges(changeSet)` | Batch add/remove/update/rename documents |
| `recordDocChange(nuggetId, desc)` | Log a document change for AI notification |
| `injectDocChangeNotice(nuggetId, notice)` | Inject system message about document changes |

---

## 6. Data Models & TypeScript Interfaces

All types are defined in `types.ts` (230 lines).

### Core Data Types

```typescript
// Visual styling configuration for a card
interface StylingOptions {
  levelOfDetail: DetailLevel;          // 'Executive' | 'Standard' | 'Detailed'
  style: string;                        // e.g., "Flat Design", "Isometric"
  palette: Palette;                     // 5-color palette
  fonts: FontPair;                      // heading + body font names
  aspectRatio: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
  resolution: '1K' | '2K' | '4K';
}

interface Palette {
  background: string;  primary: string;  secondary: string;  accent: string;  text: string;
}

type DetailLevel = 'Executive' | 'Standard' | 'Detailed';

interface FontPair {
  primary: string;    // Heading font
  secondary: string;  // Body font
}
```

### Heading (Central Data Unit)

A Heading represents one section of a document. It is the primary unit that flows through the entire synthesis + image generation pipeline:

```typescript
interface Heading {
  id: string;
  level: number;                        // 0 = doc root, 1-6 = H1-H6
  text: string;                         // Heading display text
  selected?: boolean;                   // Checked for batch operations
  settings?: StylingOptions;            // Per-heading style overrides

  // Per-DetailLevel maps (keyed by 'Executive' | 'Standard' | 'Detailed')
  synthesisMap?: Partial<Record<DetailLevel, string>>;       // Synthesized markdown content
  isSynthesizingMap?: Partial<Record<DetailLevel, boolean>>; // [transient] synthesis in progress
  cardUrlMap?: Partial<Record<DetailLevel, string>>;         // Generated card image data URLs
  isGeneratingMap?: Partial<Record<DetailLevel, boolean>>;   // [transient] image gen in progress
  imageHistoryMap?: Partial<Record<DetailLevel, ImageVersion[]>>; // Undo/redo image versions
  visualPlanMap?: Partial<Record<DetailLevel, string>>;      // Gemini layout plan text
  lastGeneratedContentMap?: Partial<Record<DetailLevel, string>>; // Content snapshot at gen time
  lastPromptMap?: Partial<Record<DetailLevel, string>>;      // Full visualizer prompt used

  startIndex?: number;                  // [transient] parse-time document offset
  createdAt?: number;                   // Timestamp
  lastEditedAt?: number;                // Timestamp
  sourceDocuments?: string[];           // Document names at creation time
}
```

### Document Types

```typescript
interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;                         // MIME type
  lastModified: number;
  content?: string;                     // Markdown text content
  structure?: Heading[];                // Parsed heading hierarchy
  status: 'uploading' | 'processing' | 'ready' | 'error';
  progress: number;
  enabled?: boolean;                    // [transient] included in chat context
}

interface InsightsDocument {
  id: string;
  name: string;
  type: 'md' | 'pdf' | 'docx';
  size: number;
  content?: string;
  base64?: string;                      // Binary content for PDF/DOCX
  mediaType?: string;
}
```

### Nugget (Top-Level Container)

```typescript
type NuggetType = 'synthesis' | 'insights';

interface Nugget {
  id: string;
  name: string;
  type: NuggetType;
  documents: UploadedFile[];            // Owned documents (no shared library)
  headings: Heading[];                  // Card headings
  messages?: ChatMessage[];             // Insights only: chat history
  content?: string;                     // Synthesis only: editable markdown copy
  lastDocHash?: string;                 // Hash of docs at last API call
  pendingDocChanges?: ChangeLogEntry[]; // Queued doc change notifications for AI
  createdAt: number;
  lastModifiedAt: number;
}
```

### Chat & Insights Types

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isCardContent?: boolean;
  detailLevel?: DetailLevel;
  savedAsHeadingId?: string;
}

interface InsightsSession {
  id: string;
  documents: InsightsDocument[];
  messages: ChatMessage[];
  headings: Heading[];
}
```

### Annotation Types

```typescript
type AnnotationTool = 'select' | 'pin' | 'arrow' | 'rectangle' | 'sketch' | 'text' | 'zoom';
type AnnotationType = 'pin' | 'arrow' | 'rectangle' | 'sketch';

interface NormalizedPoint { x: number; y: number; }  // 0.0-1.0 coordinate space

interface PinAnnotation       { type: 'pin';       position: NormalizedPoint;    instruction: string; ... }
interface RectangleAnnotation  { type: 'rectangle'; topLeft, bottomRight: NormalizedPoint; instruction: string; ... }
interface ArrowAnnotation      { type: 'arrow';     start, end: NormalizedPoint;  instruction: string; ... }
interface SketchAnnotation     { type: 'sketch';    points: NormalizedPoint[];     instruction: string; ... }

type Annotation = PinAnnotation | RectangleAnnotation | ArrowAnnotation | SketchAnnotation;

interface ImageVersion { imageUrl: string; timestamp: number; label: string; }
```

### Persistence Types

```typescript
interface InitialPersistedState {
  nuggets: Nugget[];
  selectedNuggetId: string | null;
  activeHeadingId: string | null;
  workflowMode: WorkflowMode;
  files: UploadedFile[];               // Legacy compat
  selectedFileId: string | null;       // Legacy compat
  insightsSession: InsightsSession | null; // Legacy compat
  draftStructure: Heading[];           // Legacy compat
}

enum FileType {
  MD = 'text/markdown',
  PDF = 'application/pdf',
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  PLAIN = 'text/plain'
}
```

### Relationships Diagram

```
Nugget (1)
  ├── documents: UploadedFile[] (1..N)    Owned documents
  ├── headings: Heading[] (0..N)          Card headings
  │     ├── synthesisMap[DetailLevel]      Synthesized text
  │     ├── cardUrlMap[DetailLevel]        Generated card image
  │     ├── imageHistoryMap[DetailLevel]   Version history (ImageVersion[])
  │     └── visualPlanMap[DetailLevel]     Layout plan text
  ├── messages?: ChatMessage[] (insights only)
  └── content?: string (synthesis only)   Editable markdown copy
```

---

## 7. Component Hierarchy & Responsibilities

### Component Tree

```
<React.StrictMode>
  <StorageProvider>                       Hydration + migration + wrapping
    <AppProvider initialState={...}>      Global state context
      <PersistenceConnector>              Auto-save side effect
      <App>                               Main orchestrator
        │
        ├── <LandingPage>                 Splash screen (shown first)
        │
        ├── [Modals — rendered at top level]
        │   ├── <BatchSynthesisModal>
        │   ├── <DocxWarningModal>
        │   ├── <DuplicateWarningModal>
        │   ├── <DocumentChangeDialog>
        │   ├── <NuggetCreationModal>
        │   ├── <ManageDocumentsModal>
        │   ├── <DocumentEditorModal>
        │   │     ├── <FormatToolbar>
        │   │     └── <FindReplaceBar>
        │   └── <ZoomOverlay>
        │
        ├── <FileSidebar>                 Nugget navigation
        │
        ├── [Cardlist Sidebar — inline]
        │   ├── <StructureView>           Heading tree (synthesis)
        │   └── <InsightsHeadingList>     Heading list (insights)
        │
        ├── [Main Content Area]
        │   ├── <ContentPanel>            Synthesis content display
        │   └── <InsightsLabPanel>        Chat interface
        │
        └── <AssetLab>                    Image generation + annotation
              └── <AnnotationWorkbench>
                    ├── <CanvasRenderer>  (utility, not React)
                    ├── <AnnotationToolbar>
                    ├── <PinEditor>
                    └── <RectangleEditor>
```

### Key Components Detail

#### App.tsx (1261 lines) — Main Orchestrator
- **Renders:** All modals, three-panel layout, footer
- **State:** `menuDraftOptions`, `zoomState`, `referenceImage`, `useReferenceImage`, numerous UI toggles
- **Context:** `useAppContext()` (all global state)
- **Hooks:** `useFileManagement()`, `useSynthesis()`, `useInsightsLab()`
- **Patterns:** Resizable panels via drag handles, global keyboard shortcuts (Escape), wrapped API calls with mismatch detection

#### StorageProvider.tsx (288 lines) — Hydration & Migration
- **Renders:** `LoadingScreen` during hydration, then `AppProvider` wrapping children
- **Side effects:** Async IndexedDB load, v1->v3 data migration, document reconstitution
- **Pattern:** Shows loading screen, falls back to empty state on error

#### FileSidebar.tsx (271 lines) — Nugget Navigation
- **Props:** `nuggets`, `selectedNuggetId`, create/rename/delete callbacks
- **Renders:** Collapsible sidebar with nugget list, type badges, kebab menus
- **Pattern:** Collapsed state shows only icon buttons; expanding animates width

#### ContentPanel.tsx (284 lines) — Synthesis Content Display
- **Props:** `activeHeading`, `activeLogicTab`, synthesis controls, display HTML
- **Renders:** Detail level tabs (Executive/Standard/Detailed), synthesized markdown, batch menu, copy/edit buttons
- **Pattern:** Scroll detection with gradient indicator, rotating spinner messages during synthesis

#### InsightsLabPanel.tsx (508 lines) — Chat Interface
- **Props:** `messages`, `isLoading`, send/save/clear callbacks, width
- **Renders:** Message history, Ask/Card mode toggle, detail level buttons, suggestion chips, card content editor
- **Pattern:** `forwardRef` with `useImperativeHandle` for parent control (`switchToCardView`), auto-scroll, auto-resize textarea

#### AssetLab.tsx (620 lines) — Card Generation Workbench
- **Props:** `activeHeading`, settings, generation callbacks, reference image state, manifest for batch
- **Renders:** Style/palette/ratio/resolution dropdowns, generated card image, annotation workbench, reference image viewer, manifest modal
- **Pattern:** Click-outside dropdown detection, rotating fun messages during generation

#### AnnotationWorkbench.tsx (1020 lines) — Canvas Annotation System
- **Props:** `imageUrl`, annotation callbacks, mode ('inline' | 'fullscreen')
- **State:** Tool selection, zoom/pan, drawing-in-progress rubber band, editor popovers
- **Hooks:** `useAnnotations()`, `useVersionHistory()`
- **Pattern:** Dual coordinate systems (canvas px vs. normalized 0-1), `requestAnimationFrame` render loop, hit testing, rubber band preview, keyboard modifiers (Ctrl/Alt)

#### DocumentEditorModal.tsx (538 lines) — Full-Screen Editor
- **Props:** `document`, `onSave`, `onClose`
- **Hooks:** `useDocumentEditing()`, `useDocumentFindReplace()`
- **Renders:** Two-pane layout (heading sidebar + contentEditable editor), format toolbar, find/replace bar
- **Pattern:** Right-click context menu for heading manipulation, unsaved changes confirmation

---

## 8. Hooks & Custom Logic

### useAnnotations (78 lines)

| Aspect | Detail |
|--------|--------|
| **Purpose** | CRUD for canvas annotations (pins, rectangles, arrows, sketches) |
| **Internal state** | `annotations: Annotation[]`, `selectedAnnotationId: string \| null` |
| **Returns** | `add`, `update`, `remove`, `select`, `clearAll`, `moveAnnotation` |
| **Side effects** | None (pure state management) |
| **Consumed by** | `AnnotationWorkbench` |
| **Notes** | `moveAnnotation` clamps all coordinates to [0, 1] normalized space |

### useDocumentEditing (266 lines)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Rich-text editor on contentEditable div with markdown round-tripping |
| **Params** | `editorRef`, `editorObserverRef`, `initialContent`, `onSave`, `closeFindBar`, `clearFindHighlights` |
| **Internal state** | `isDirty`, `activeFormats: Set<string>`, `headings: EditorHeading[]` |
| **Returns** | `isDirty`, `activeFormats`, `headings`, `saveEdits`, `discardEdits`, `executeCommand`, `insertTable`, `handleKeyDown`, `changeHeadingLevel`, `scrollToHeading`, `toggleSelection`, `selectByLevel` |
| **Side effects** | MutationObserver on contentEditable, `document.execCommand()`, `document.selectionchange` listener |
| **Consumed by** | `DocumentEditorModal` |
| **Notes** | Converts markdown to HTML on mount via `marked.parse()`, converts back via `htmlToMarkdown()` on save |

### useDocumentFindReplace (291 lines)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Find/replace with highlighting in contentEditable |
| **Params** | `editorRef`, `scrollContainerRef`, `editorObserverRef` |
| **Internal state** | `showFind`, `findQuery`, `replaceQuery`, `findMatchCount`, `findActiveIndex`, `findMatchCase` |
| **Returns** | All state + `findNext`, `findPrev`, `closeFindBar`, `handleReplace`, `handleReplaceAll`, `clearFindHighlights` |
| **Side effects** | DOM TreeWalker to find text, `<mark>` element injection, MutationObserver pause/resume, scrollIntoView |
| **Consumed by** | `DocumentEditorModal` |
| **Notes** | 80ms debounce on query change; replaceAll processes marks in reverse order to avoid index shifts |

### useFileManagement (218 lines)

| Aspect | Detail |
|--------|--------|
| **Purpose** | File upload, parsing, duplicate/DOCX warning flows |
| **Internal state** | `docxWarning`, `duplicateWarning`, `showSourceReview` |
| **Returns** | Warning state + handlers: `handleFilesSelected`, `handleDocxContinue/Cancel`, `handleDuplicateRename/Replace/Cancel`, `handleSelectFile` |
| **Side effects** | FileReader for PDF base64, `callClaude()` for PDF/DOCX parsing, `parseMarkdownStructure()` |
| **Consumed by** | `App.tsx` |
| **Notes** | Single upload shows warnings; batch upload auto-renames duplicates. PDF/DOCX show 8s source review |

### useInsightsLab (183 lines)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Multi-turn chat with Claude for insights workflow |
| **Internal state** | `isLoading`, `abortRef: AbortController` |
| **Returns** | `messages`, `isLoading`, `sendMessage(text, isCard, detailLevel, messagesOverride?)`, `stopResponse`, `clearMessages` |
| **Side effects** | `callClaude()` with prompt caching (system blocks + cached document context), AbortController for cancellation |
| **Consumed by** | `App.tsx` (wraps with document change interception) |
| **Notes** | Documents resolved from `selectedNugget.documents`; `lastDocHash` updated after each response; `messagesOverride` param bypasses stale closure |

### usePersistence (216 lines)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Debounced auto-save of all app state to IndexedDB |
| **Params** | `StorageBackend`, all state variables to persist |
| **Returns** | None (pure side-effect hook) |
| **Side effects** | 4 debounce timers: appState (300ms), files+headings+images (1500ms), insights (1500ms), nuggets (1500ms). Cleanup of deleted items. |
| **Consumed by** | `PersistenceConnector` (inside `StorageProvider`) |
| **Notes** | 2000ms hydration delay prevents save-back-loop. Transient fields stripped before storage. Blob URLs converted to data URLs. |

### useSynthesis (340 lines)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Core AI pipeline: content synthesis (Claude) + layout planning (Gemini Flash) + image generation (Gemini Pro) |
| **Params** | `menuDraftOptions`, `referenceImage`, `useReferenceImage` |
| **Internal state** | `genStatus`, `activeLogicTab`, `showBatchMenu`, `batchTarget`, `manifestHeadings` |
| **Derived** | `currentSynthesisContent`, `contentDirty`, `selectedCount`, `isSynthesizing` |
| **Returns** | All state + `performSynthesis`, `generateCardForHeading`, `handleGenerateAll`, `executeBatchCardGeneration`, `executeBatchSynthesis`, `handleBatchInitiate`, `handleImageModified` |
| **Side effects** | `callClaude()` for synthesis, `GoogleGenAI` for planning + image gen, lazy SDK singleton, `withRetry()` wrapper |
| **Consumed by** | `App.tsx` |
| **Notes** | Planner step is optional (graceful fallback). Batch operations sequential (rate limit respect). Reference image injected as base64 inline data. |

### useVersionHistory (173 lines)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Undo/redo stack for image modifications (max 10 versions) |
| **Params** | `initialHistory?: ImageVersion[]`, `originalImageUrl?: string` |
| **Internal state** | `versions`, `currentIndex`, `blobUrlsRef: Set<string>` |
| **Returns** | `versions`, `currentIndex`, `currentVersion`, `canUndo`, `canRedo`, `modificationCount`, `pushVersion`, `restorePrevious`, `restoreNext`, `restoreByIndex`, `resetHistory` |
| **Side effects** | Blob URL tracking and `URL.revokeObjectURL()` cleanup on eviction and unmount |
| **Consumed by** | `AnnotationWorkbench` |
| **Notes** | Navigating back then pushing discards "future" versions. Non-blob URLs (data:, http:) not tracked. |

---

## 9. API & External Service Integration

### Claude API (Anthropic)

| Aspect | Detail |
|--------|--------|
| **Client** | Direct HTTP `fetch()` to `https://api.anthropic.com/v1/messages` (in `utils/ai.ts:callClaude`) |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Auth** | `x-api-key` header from `process.env.ANTHROPIC_API_KEY` |
| **Max tokens** | 64,000 |
| **Headers** | `anthropic-version: 2023-06-01`, `anthropic-beta: prompt-caching-2024-07-31,pdfs-2024-09-25` |
| **Prompt caching** | `cache_control: { type: 'ephemeral' }` on system blocks (min 4096 chars) and last user message |
| **Cancellation** | AbortSignal support via `options.signal` |
| **Rate limit handling** | `withRetry()` with exponential backoff (1s, 2s, 4s, 8s, 16s) on 429/500/503 |

**Used for:**
1. **Document parsing** (PDF/DOCX) — `DOCUMENT_ANALYSIS_PROMPT` / `DOCX_TEXT_ANALYSIS_PROMPT` with document content blocks
2. **Content synthesis** — `buildSynthesisPrompt()` with cached full document context
3. **Insights chat** — Multi-turn conversation with cached document context, `INSIGHTS_SYSTEM_PROMPT`
4. **Card content generation** — `buildCardContentInstruction(detailLevel)` appended to user message

### Gemini Flash API (Google)

| Aspect | Detail |
|--------|--------|
| **Client** | `@google/genai` SDK, lazy singleton via `getAI()` in `useSynthesis.ts` |
| **Model** | `gemini-3-flash-preview` |
| **Auth** | API key from `process.env.GEMINI_API_KEY` |
| **Config** | `FLASH_TEXT_CONFIG` with system instruction |
| **Rate limit handling** | `withRetry()` wrapper |

**Used for:**
- **Layout planning** — `buildPlannerPrompt()` generates a spatial blueprint (layout type, component inventory, spatial arrangement, emphasis hierarchy, style notes, text tier system). Output is sanitized by `sanitizePlannerOutput()` to remove font names, hex colors, pixel values.

### Gemini Pro Image API (Google)

| Aspect | Detail |
|--------|--------|
| **Client** | `@google/genai` SDK |
| **Model** | `gemini-3-pro-image-preview` |
| **Auth** | Same API key as Flash |
| **Config** | `PRO_IMAGE_CONFIG` with text + image response modalities, custom `imageConfig` (aspectRatio, imageSize) |
| **Rate limit handling** | `withRetry()` wrapper |

**Used for:**
1. **Card image generation** — `buildVisualizerPrompt()` with optional reference image as inline base64 data
2. **Annotation-based modification** — `executeModification()` sends original image + redline map + instructions
3. **Content-only modification** — `executeContentModification()` sends original image + new content text

---

## 10. Core User Workflows (Step by Step)

### Workflow 1: First-Time App Load

1. `index.tsx` mounts `<StorageProvider>` > `<App>` into `#root`
2. `StorageProvider.tsx` shows `<LoadingScreen>` and calls `IndexedDBBackend.init()`
3. `init()` opens `infonugget-db` v3, runs migrations if needed (v1->v2->v3)
4. `StorageProvider` loads all stored data: appState, nuggets, nugget documents, nugget headings, nugget images
5. Builds `InitialPersistedState` by deserializing stored data and reconstructing nugget objects
6. Renders `<AppProvider initialState={...}>` + `<PersistenceConnector>` + `<App>`
7. `AppProvider` initializes all state from `initialState` prop
8. `App` renders `<LandingPage>` (animated splash)
9. User clicks "Launch App" -> `handleLaunch()` sets `showLanding=false` -> main app renders
10. If no nuggets exist: empty state with "Create Nugget" button. If nuggets exist: "Select a nugget" prompt

### Workflow 2: Synthesis Workflow (Document-Driven)

**2a. Create Synthesis Nugget**
1. User clicks "Create Nugget" -> `setShowNuggetCreation(true)` -> `NuggetCreationModal` renders
2. User selects "Synthesis" tab, uploads one document file
3. `NuggetCreationModal` calls `processFileToDocument(file)` (`fileProcessing.ts`)
   - For MD: `file.text()` + `parseMarkdownStructure()`
   - For PDF: base64 encode + `callClaude(DOCUMENT_ANALYSIS_PROMPT)` + `parseMarkdownStructure()`
   - For DOCX: `extractDocxText(file)` + `callClaude(DOCX_TEXT_ANALYSIS_PROMPT)` + `parseMarkdownStructure()`
4. Returns `UploadedFile` with `content` and `structure` (Heading[])
5. Modal creates `Nugget` object with the document, headings from structure, and editable content copy
6. Calls `onCreateNugget(nugget)` -> `addNugget()` + `setSelectedNuggetId(nugget.id)`
7. Compatibility shim fires: populates `files[]`, `selectedFileId`, `draftStructure`, sets `workflowMode='synthesis'`
8. App renders: StructureView (heading tree), ContentPanel, AssetLab

**2b. Synthesize Content**
1. User clicks a heading in the cardlist sidebar -> `setActiveHeadingId(headingId)`
2. User clicks "Synthesize" button in ContentPanel
3. `performSynthesis(heading, level)` in `useSynthesis`:
   a. Sets `isSynthesizingMap[level] = true` on the heading
   b. Extracts section text from full document using heading offset + next same-level heading
   c. Calls `callClaude(buildSynthesisPrompt(...))` with cached full document as system block
   d. Receives synthesized markdown, strips auto-injected heading, re-injects with target heading text
   e. Updates `heading.synthesisMap[level]` via `updateNuggetHeading()`
   f. Sets `isSynthesizingMap[level] = false`
4. ContentPanel displays synthesized markdown (rendered via `marked.parse()`)

**2c. Generate Card Image**
1. User clicks "Generate" in AssetLab
2. `generateCardForHeading(heading)` in `useSynthesis`:
   a. Sets `isGeneratingMap[level] = true`
   b. Commits current `menuDraftOptions` as heading settings
   c. [Optional] Calls Gemini Flash with `buildPlannerPrompt()` for layout plan -> stores in `visualPlanMap[level]`
   d. Calls Gemini Pro Image with `buildVisualizerPrompt()` (assembled from content + plan + style + optional reference)
   e. Extracts image data URL from response `inlineData`
   f. Updates heading: `cardUrlMap[level]`, `imageHistoryMap[level]` (fresh with "Original"), `lastGeneratedContentMap[level]`, `lastPromptMap[level]`
   g. Sets `isGeneratingMap[level] = false`
3. AssetLab displays the generated card image

**2d. Annotate and Modify Image**
1. User selects annotation tool (Pin/Arrow/Rectangle/Sketch) in `AnnotationToolbar`
2. User draws annotations on canvas in `AnnotationWorkbench`
3. User types instructions for each annotation via `PinEditor`/`RectangleEditor`
4. User clicks "Modify" button:
   a. `generateRedlineMap(annotations, w, h)` creates black canvas with red annotation overlay + text instructions
   b. `executeModification({ originalImageUrl, redlineDataUrl, instructions, ... })` sends both images + instructions to Gemini Pro Image
   c. Receives modified image, pushes to version history via `pushVersion()`
   d. Updates heading's `cardUrlMap[level]` and `imageHistoryMap[level]`
5. User can undo/redo via version history controls

### Workflow 3: Insights Workflow (User-Driven)

**3a. Create Insights Nugget**
1. User creates nugget with "Insights" tab, uploads one or more documents
2. Documents processed in parallel via `processFileToDocument()`
3. Nugget created with multiple documents, empty headings, empty messages

**3b. Chat with Claude**
1. User types question in `InsightsLabPanel` textarea
2. `wrappedSendInsightsMessage()` checks for `pendingDocChanges`:
   - If changes exist: shows `DocumentChangeDialog` -> user chooses "Continue" (inject notice) or "Start Fresh" (clear history)
3. `sendInsightsMessage(text, isCard, detailLevel)` in `useInsightsLab`:
   a. Creates user `ChatMessage`, appends to nugget via `appendNuggetMessage()`
   b. Resolves document context from `selectedNugget.documents` (only enabled docs with content)
   c. Builds Claude request: `INSIGHTS_SYSTEM_PROMPT` (uncached) + document context block (cached) + message history
   d. Calls `callClaude()` with multi-turn messages
   e. Creates assistant `ChatMessage`, appends to nugget
   f. Updates `lastDocHash` on nugget

**3c. Generate Card Content from Chat**
1. User switches to "Card" mode in InsightsLabPanel, selects detail level
2. User types prompt -> `sendInsightsMessage(text, isCardRequest=true, detailLevel)`
3. `buildCardContentInstruction(detailLevel)` appended to user message
4. Claude generates structured card content (markdown with heading + body)
5. Response displayed with "Save as Card" button

**3d. Save as Heading**
1. User clicks "Save as Card" on a card content message
2. `handleSaveAsHeading(message, editedContent)`:
   - Extracts title from first `#` heading line
   - Creates new `Heading` with `synthesisMap[level]` populated
   - Adds to nugget headings + marks message as saved
   - Selects the new heading
3. Heading appears in InsightsHeadingList sidebar
4. From here, the image generation pipeline (2c, 2d) is identical to synthesis

### Workflow 4: Document Editing

1. User opens document editor (kebab menu on document in sidebar, or "Edit" button on card content)
2. `DocumentEditorModal` renders with `useDocumentEditing()` + `useDocumentFindReplace()`
3. Content converted: markdown -> HTML via `marked.parse()` -> rendered in contentEditable div
4. MutationObserver tracks changes, sets `isDirty=true`, re-parses headings
5. User edits content, formats with toolbar (bold, italic, heading levels, lists, tables)
6. User saves -> `htmlToMarkdown()` converts back to markdown -> `onSave(newContent)`
7. For synthesis nuggets: content + headings re-parsed and updated via `updateNuggetContentAndHeadings()`

### Workflow 5: Batch Operations

**Batch Synthesis:**
1. User selects headings via checkboxes (or H1/H2/H3 level buttons)
2. Opens batch menu -> selects detail level -> `handleBatchInitiate(level)`
3. Shows `BatchSynthesisModal` confirmation
4. `executeBatchSynthesis()` processes each selected heading sequentially

**Batch Card Generation:**
1. User clicks "Generate All" -> shows `ManifestModal` with selected headings
2. `executeBatchCardGeneration()` processes each heading sequentially (respects API rate limits)

---

## 11. File Processing & Parsing

### Markdown (.md)

| Stage | Method | Output |
|-------|--------|--------|
| Read | `file.text()` | Raw markdown string |
| Parse | `parseMarkdownStructure(text)` | `Heading[]` with level, text, id |

**Parser:** Regex `^#{1,6}\s+(.+)$` (multiline). Generates unique IDs: `h-${index}-${random}`. Initializes empty maps on each heading.

**Limitations:** None significant. Most faithful to original content.

### PDF (.pdf)

| Stage | Method | Output |
|-------|--------|--------|
| Read | `FileReader.readAsArrayBuffer()` | ArrayBuffer |
| Encode | Base64 conversion | Base64 string |
| Parse | `callClaude(DOCUMENT_ANALYSIS_PROMPT)` with `{ type: 'document', source: { type: 'base64', ... } }` | Clean markdown string |
| Structure | `parseMarkdownStructure(result)` | `Heading[]` |

**Limitations:** Relies on Claude's PDF vision capability. Multi-column layouts, complex tables, and heavily graphical PDFs may lose some structure. Charts are converted to markdown tables (data extraction, not image preservation).

### DOCX (.docx)

| Stage | Method | Output |
|-------|--------|--------|
| Unzip | `JSZip.loadAsync(file)` | ZIP contents |
| Extract | Parse `word/document.xml` via `DOMParser` | Raw text with markdown markers |
| Clean | `callClaude(DOCX_TEXT_ANALYSIS_PROMPT)` | Clean markdown string |
| Structure | `parseMarkdownStructure(result)` | `Heading[]` |

**Extraction details:** Iterates `<w:p>` paragraphs, extracts text from `<w:t>` nodes, detects bold/italic from `<w:rPr>`, detects headings from `<w:pStyle>`, detects lists from `<w:numPr>`.

**Limitations:** No nested list depth tracking. No image extraction. Complex formatting (text boxes, shapes, embedded objects) not preserved. Merges adjacent identical formatting to avoid stuttered markers.

### HTML to Markdown (reverse conversion)

`htmlToMarkdown(html)` in `utils/markdown.ts` recursively walks DOM nodes and converts: headings, lists (with depth tracking), bold/italic, blockquotes, code blocks, links, tables (pipe-delimited), horizontal rules. Collapses 3+ blank lines to 2.

---

## 12. AI/ML Pipeline

### Pipeline Overview

```
Document → [Claude: Parse] → Markdown → [Claude: Synthesize] → Card Content
                                                                      ↓
                                        [Gemini Flash: Plan Layout] ← ┘
                                                    ↓
                                        [Gemini Pro: Generate Image] → Card Image
                                                    ↓
                              [User Annotates] → [Gemini Pro: Modify Image] → Modified Image
```

### Stage 1: Document Parsing (Claude)

| Aspect | Detail |
|--------|--------|
| **Model** | claude-sonnet-4-5-20250929 |
| **Prompt** | `DOCUMENT_ANALYSIS_PROMPT` (PDF) or `DOCX_TEXT_ANALYSIS_PROMPT` (DOCX) |
| **Input** | Full document as base64 content block (PDF) or extracted text (DOCX) |
| **Output** | Clean markdown with heading hierarchy |
| **Post-processing** | `parseMarkdownStructure()` extracts Heading[] |

### Stage 2: Content Synthesis (Claude)

| Aspect | Detail |
|--------|--------|
| **Model** | claude-sonnet-4-5-20250929 |
| **Prompt** | `buildSynthesisPrompt(heading, level, fullDoc, sectionText)` |
| **System blocks** | Full document context (cached, min 4096 chars) |
| **Output** | Restructured markdown at target word count (Executive: 70-100, Standard: 200-250, Detailed: 450-500) |
| **Post-processing** | Strip auto-injected heading, re-inject with target heading text |
| **Prompt engineering** | Strict rules: preserve ALL content, make implicit relationships explicit, use concise phrasing, no H1 (reserved for title), proper heading hierarchy |

### Stage 3: Layout Planning (Gemini Flash) — Optional

| Aspect | Detail |
|--------|--------|
| **Model** | gemini-3-flash-preview |
| **Prompt** | `buildPlannerPrompt(heading, content, style, aspectRatio)` |
| **Output** | Narrative spatial blueprint: layout type, component inventory, spatial arrangement, emphasis hierarchy, style notes, text tier system |
| **Post-processing** | `sanitizePlannerOutput()` removes: font names (137 known), hex colors, pixel values, point sizes, markdown formatting |
| **Fallback** | If planner fails, image generation proceeds without plan (generic layout instruction) |
| **Constraint** | Planner must NOT rewrite content — layout job only (WHERE and HOW, not WHAT) |

### Stage 4: Image Generation (Gemini Pro Image)

| Aspect | Detail |
|--------|--------|
| **Model** | gemini-3-pro-image-preview |
| **Prompt** | `assembleRendererPrompt()` via `buildVisualizerPrompt()` |
| **Prompt structure** | Role intro + narrative style block (colors as names, fonts as descriptors) + optional reference image note + sanitized layout plan + content as bracketed tags |
| **Content transform** | `transformContentToTags()`: `## Heading` -> `[SECTION] Heading`, `### Sub` -> `[SUBSECTION] Sub`, strips markdown formatting |
| **Style block** | `buildNarrativeStyleBlock()`: aesthetic instruction + semantic color bindings (hex->name via `hexToColorName()`) + typography descriptors (font->descriptor via `fontToDescriptor()`) + palette-style conflict override |
| **Reference image** | Optional: injected as inline base64 data with "replicate visual identity" instruction |
| **Output** | PNG image as base64 data URL from response `inlineData` |

### Stage 5: Image Modification (Gemini Pro Image)

**Annotation-based modification:**
1. `generateRedlineMap()` renders annotations on black canvas in bright red
2. `synthesizeInstructions()` generates numbered text descriptions per annotation
3. `executeModification()` sends: original image + redline map + instructions to Gemini Pro
4. Prompt: `buildModificationPrompt(instructions, headingText, hasRedline=true)`

**Content-only modification:**
1. `executeContentModification()` sends: original image + new content
2. Prompt: `buildContentModificationPrompt(content, headingText, style, palette)`
3. Preserves visual style of original, re-renders with new text

### Prompt Engineering Patterns

1. **No markdown in image prompts** — All content transformed to bracketed tags to prevent text leakage
2. **Colors as names, not hex** — `hexToColorName()` converts `#1A365D` to "deep navy" (100+ lookup table + RGB heuristic fallback)
3. **Fonts as descriptors, not names** — `fontToDescriptor()` converts "Montserrat" to "clean, geometric sans-serif" (30+ lookup + pattern matching)
4. **Sanitization safety net** — `sanitizePlannerOutput()` strips 137 known font names, hex colors, pixel values even if the model was instructed not to produce them
5. **Palette-style conflict detection** — `detectPaletteStyleConflict()` checks if user's palette colors match expected color family for the chosen style, injects override language if not
6. **Narrative prose only** — All image model instructions use flowing sentences, never key-value pairs or structured data
7. **Prompt caching** — Full document context cached in system block (Claude); reduces latency and cost for multi-turn and batch operations

---

## 13. Routing & Navigation

There is no router. Infonugget is a single-page application with conditional rendering:

```typescript
// App.tsx render logic (simplified)
if (showLanding) return <LandingPage />

// Main app layout always renders FileSidebar + Cardlist Sidebar
// Content area switches based on:
if (workflowMode === 'synthesis' && selectedFile)
  → <ContentPanel> + <AssetLab>
else if (workflowMode === 'insights' && insightsSession)
  → <InsightsLabPanel> + <AssetLab>
else
  → Empty state ("Create Nugget" or "Select a nugget")
```

Navigation between views is driven by:
1. **`selectedNuggetId`** — Selecting a nugget triggers the compatibility shim which sets `workflowMode` and populates all downstream state
2. **`workflowMode`** — `'synthesis'` vs `'insights'` determines which main panel renders
3. **`activeHeadingId`** — Determines which heading's content/image is displayed in ContentPanel/AssetLab
4. **`showLanding`** — Boolean toggle between landing page and main app

---

## 14. Styling Architecture

### Approach

Infonugget uses a hybrid styling approach:

1. **Tailwind CSS via CDN** — Loaded from `<script src="https://cdn.tailwindcss.com">` in `index.html`. Used for virtually all component styling via utility classes.
2. **Custom CSS in `<style>` block** — `index.html` contains ~215 lines of custom CSS for:
   - CSS custom properties (acid-lime color palette: `--acid-h1` through `--acid-h6`, `--acid-lime`)
   - Document prose styling (`.document-prose` class with heading sizes, lists, tables, blockquotes)
   - Chat prose overrides (`.chat-prose` with tighter spacing)
   - System notice styling (`.system-notice-prose` for document change notifications)
   - Glassmorphism toolbar (`.glass-toolbar` with backdrop-filter)
   - Cursor styles for annotation tools (`.zoom-tool-zoom`, `.zoom-tool-pin`, etc.)
   - Active sidebar indicator (`.sidebar-node-active` with lime accent bar)

### Design Tokens / Theme

| Token | Value | Usage |
|-------|-------|-------|
| `--acid-lime` | `#ccff00` | Primary brand color, selection, accents |
| `--acid-h1` through `--acid-h6` | `#a1cc00` to `#384700` | Heading colors by depth |
| Font: Inter | 300-800 weights | All UI text |
| Font: JetBrains Mono | 400-500 | Code blocks |
| Background | `#ffffff` | App background |
| Text | `#1a1a1a` | Primary text |

### Card Styling (AI-Generated)

Cards have their own visual styling system with 13 predefined styles, each with a 5-color palette and font pair. These are defined in `utils/ai.ts`:

| Style | Palette Theme | Font Pair |
|-------|--------------|-----------|
| Flat Design | Blue/gray/orange | Montserrat / Open Sans |
| Isometric | Blue/green/coral | Poppins / Nunito |
| Line Art | Black/gray/red | Raleway / Source Sans Pro |
| Retro/Mid-Century | Orange/green/cream | Pacifico / Quicksand |
| Risograph/Duotone | Red/navy/cream | Space Grotesk / DM Sans |
| Neon/Dark Mode | Cyan/purple/black | Orbitron / Rajdhani |
| Paper Cutout | Orange/green/sand | Fredoka One / Nunito |
| Pop Art | Red/blue/yellow | Bebas Neue / Archivo |
| Watercolour | Blue/pink/green | Playfair Display / Lora |
| Blueprint | Blue/navy/gold | Share Tech Mono / Fira Code |
| Doodle Art | Black/gray/orange | Caveat / Patrick Hand |
| Geometric Gradient | Purple/teal/pink | Space Grotesk / Inter |
| Corporate Memphis | Blue/orange/navy | DM Sans / Source Sans Pro |

### CSS Quirks

- Scrollbar hidden globally: `::-webkit-scrollbar { display: none; }` and `scrollbar-width: none`
- Selection color overridden to acid-lime: `::selection { background-color: var(--acid-lime); color: #000; }`
- contentEditable caret color: `caret-color: var(--acid-lime)`

---

## 15. Settings & Configuration Management

### User-Controllable Settings (per heading, via AssetLab)

| Setting | Options | Default | Persisted |
|---------|---------|---------|-----------|
| **Detail Level** | Executive, Standard, Detailed | Standard | Yes (per heading in `settings.levelOfDetail`) |
| **Visual Style** | 13 styles (Flat Design, Isometric, etc.) | Flat Design | Yes (per heading in `settings.style`) |
| **Color Palette** | 5-color palette per style (customizable) | Style default | Yes (per heading in `settings.palette`) |
| **Font Pair** | Primary + secondary fonts per style | Style default | Yes (per heading in `settings.fonts`) |
| **Aspect Ratio** | 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 | 16:9 | Yes (per heading in `settings.aspectRatio`) |
| **Resolution** | 1K, 2K, 4K | 1K | Yes (per heading in `settings.resolution`) |
| **Reference Image** | Stamp current card as reference, toggle on/off | None | Not persisted (session state) |

### Settings Flow

```
User changes setting in AssetLab dropdown
  → menuDraftOptions updated (App.tsx local state)
  → When user clicks "Generate", menuDraftOptions committed to heading.settings
  → heading.settings persisted to IndexedDB via usePersistence
  → On next load, heading.settings hydrated and applied
```

Settings are **per-heading** — each card can have its own style, palette, aspect ratio, and resolution. The `menuDraftOptions` in `App.tsx` is the "staging area" that gets committed to a heading when generation is triggered.

---

## 16. Error Handling & Resilience

### API Error Handling

| Layer | Strategy |
|-------|----------|
| **Retry wrapper** | `withRetry(fn, maxRetries=5)` in `utils/ai.ts` — Exponential backoff (1s, 2s, 4s, 8s, 16s). Retries on HTTP 429 (rate limit), 500, 503. |
| **Claude client** | `callClaude()` throws formatted errors with model/API messages. Callers catch and display. |
| **Gemini calls** | Wrapped in `withRetry()`. Missing API key shows `alert()`. |
| **Synthesis hook** | `useSynthesis.ts` catches errors, logs detailed JSON (message, status, code, details, settings), shows `alert()` to user. Resets `isSynthesizingMap` / `isGeneratingMap` flags. |
| **Insights hook** | `useInsightsLab.ts` catches errors (ignores AbortError for cancellation), logs to console, appends error message as assistant ChatMessage. |

### File Processing Errors

| Stage | Handling |
|-------|----------|
| File read failure | Caught in `processFileToDocument()`, returns `UploadedFile` with `status: 'error'` |
| DOCX extraction failure | Caught in `extractDocxText()`, error propagated |
| PDF parsing failure | Claude API error caught, file marked as error |
| Markdown parse failure | Regex-based, unlikely to fail — returns empty heading list |

### Persistence Errors

- All `StorageBackend` calls wrapped in `.catch()` with `console.warn` (non-blocking)
- Hydration failure: `StorageProvider` falls back to empty `InitialPersistedState`
- Missing stores on old database versions: gracefully return empty arrays

### UI Error Feedback

- File status badges show "error" state (red icon)
- Synthesis/generation spinners reset on error (flags cleared)
- `alert()` for critical errors (API key missing, generation failure)
- Console logging for debugging (detailed error objects)

### No Error Boundaries

The app does not use React Error Boundaries. Unhandled rendering errors will crash the app. All known error paths are handled with try-catch in async operations.

---

## 17. Performance Considerations

### Memoization

| Pattern | Location | Purpose |
|---------|----------|---------|
| `useMemo` | `AppContext.tsx` (9 uses) | Derived state: `selectedFile`, `displayFile`, `selectedNugget`, `activeHeading`, context value object |
| `useMemo` | `App.tsx` (5 uses) | `committedSettings`, `nuggetDocs`, `insightsSelectedCount`, `displayHtml` |
| `useMemo` | `useSynthesis.ts` (4 uses) | `currentSynthesisContent`, `contentDirty`, `selectedCount`, `isSynthesizing` |
| `useCallback` | All hooks and context | All event handlers and mutation functions |

### Debouncing

| Timer | Delay | Purpose |
|-------|-------|---------|
| App state save | 300ms | Quick UI state persistence |
| File/heading/image save | 1500ms | Heavier data persistence |
| Insights session save | 1500ms | Chat + heading persistence |
| Nugget save | 1500ms | Nugget data persistence |
| Find/replace rebuild | 80ms | Mark injection debounce |

### Large Data Handling

- **Images stored separately** from headings in IndexedDB (large data isolation)
- **Blob URL conversion**: `blob:` URLs converted to `data:` URLs before storage (via `blobUrlToDataUrl()`)
- **Blob URL cleanup**: `useVersionHistory` tracks and revokes blob URLs on eviction and unmount (max 10 versions)
- **Sequential batch operations**: Card generation processes headings one at a time (not parallel) to respect API rate limits
- **Lazy Gemini SDK singleton**: `getAI()` avoids recreating SDK per call during batch operations

### Known Performance Bottlenecks

1. **No code splitting or lazy loading** — Entire app loaded as single bundle
2. **Tailwind via CDN** — Runtime CSS generation (not pre-compiled)
3. **contentEditable + MutationObserver** — Can be expensive for very large documents
4. **Image data URLs in memory** — Generated card images stored as full base64 data URLs
5. **Full document in Claude system block** — Large documents increase token costs (mitigated by prompt caching)

---

## 18. Security Considerations

### API Key Handling

**Current approach (insecure for production):**
- API keys stored in `.env.local` and injected at build time via Vite's `define` option
- Keys are embedded in the client-side JavaScript bundle
- Keys are visible in browser DevTools (Sources tab)
- No backend proxy — API calls made directly from browser to Anthropic/Google

**Mitigations:**
- `.env.local` is in `.gitignore` (not committed)
- App is intended for local/personal use, not public deployment

### Authentication / Authorization

Not applicable. There is no authentication, authorization, or user system. The app is a single-user client-side tool.

### Input Sanitization

- **Markdown rendering:** `marked.parse()` is used without explicit sanitization. The `marked` library does not sanitize HTML by default — this is acceptable because all content originates from user-uploaded documents or AI responses (no untrusted third-party content).
- **contentEditable:** User input flows through `htmlToMarkdown()` on save, which recursively walks DOM nodes and only outputs recognized markdown constructs (headings, lists, formatting, tables, links).
- **API inputs:** Document content and user messages are sent directly to AI APIs. No SQL or command injection vectors exist (no database queries, no server-side execution).

### CORS / CSP

- No CSP headers configured (served by Vite dev server)
- CORS: Anthropic API allows direct browser calls with the correct headers. Google GenAI SDK handles CORS internally.
- Tailwind loaded from CDN: `https://cdn.tailwindcss.com`
- Fonts loaded from Google Fonts: `https://fonts.googleapis.com`

---

## 19. Testing

Not applicable. The project has no test framework, no test files, and no test scripts. There are no unit tests, integration tests, or end-to-end tests.

---

## 20. Build, Deploy & Run

### Install Dependencies

```bash
npm install
```

### Configure API Keys

Create `.env.local` in project root:

```
GEMINI_API_KEY=your_gemini_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Run Locally (Development)

```bash
npm run dev
```

Starts Vite dev server at `http://localhost:3000` (host: `0.0.0.0` for network access).

### Build for Production

```bash
npm run build
```

Output to `dist/` directory. Produces static HTML/JS/CSS bundle.

### Preview Production Build

```bash
npm run preview
```

### Deployment Target

No specific deployment target configured. The output is a static SPA that can be served from any static file host (Netlify, Vercel, S3, GitHub Pages, etc.). Note: API keys are embedded in the bundle, making public deployment a security concern.

### Environment-Specific Configurations

- `vite.config.ts` reads `.env.local` directly (not via Vite's standard `loadEnv`) to prevent empty system environment variables from shadowing file values
- Dev server configured on port 3000 with `host: 0.0.0.0`
- Path alias: `@` maps to project root

---

## 21. Known Constraints, Quirks & Technical Debt

1. **API keys in client bundle** — No backend proxy; keys exposed in browser. Suitable for local use only, not public deployment.

2. **Tailwind via CDN** — Uses runtime compilation (`<script src="https://cdn.tailwindcss.com">`), not a build-time compiled setup. Adds ~50KB+ to initial load and processes styles at runtime.

3. **No error boundaries** — React rendering errors crash the entire app. All error handling is in async try-catch blocks.

4. **No tests** — Zero test coverage. No test framework installed.

5. **Compatibility shim complexity** — The nugget-based architecture (v3) maintains backward compatibility with the old file-centric model via forward shims + reverse syncs in `AppContext.tsx`. This adds ~100 lines of `useEffect` synchronization logic with `eslint-disable` suppressed dependency warnings.

6. **`shimReady` timing hack** — A 100ms `setTimeout` prevents the compatibility shim from overwriting hydrated state on initial mount. Race conditions are possible in slow environments.

7. **`document.execCommand` deprecation** — `useDocumentEditing.ts` uses the deprecated `document.execCommand()` API for rich-text formatting. Still supported by all browsers but officially deprecated.

8. **Single-threaded batch operations** — Batch synthesis and batch card generation process headings sequentially (not concurrently) to respect API rate limits. Large batches can be slow.

9. **No offline support** — Despite using IndexedDB for persistence, the app requires internet for AI API calls. There is no service worker or offline mode.

10. **Image data URLs in memory** — Generated card images are stored as base64 data URLs (potentially megabytes each). With many headings and detail levels, memory usage can be significant.

11. **DOCX limitations** — No nested list depth tracking, no image extraction, no text box/shape support. Complex DOCX formatting may be lost.

12. **PDF parsing via AI** — PDF content extraction depends on Claude's vision capability. Scanned PDFs, complex layouts, and heavily graphical documents may not parse well.

13. **`package.json` name mismatch** — Package name is `"infonugget-v2.0"` but the app is v4.0.

14. **Legacy `files[]` and `insightsSession` state** — These exist solely for backward compatibility with the pre-nugget architecture. They are populated by shims and could be removed once all consumers are migrated to nugget-based APIs.

15. **`nul` file in project root** — An empty `nul` file exists in the project root (likely an accidental Windows `NUL` device redirect).

16. **Prompt caching minimum** — Claude prompt caching requires minimum 4096 characters in a system block. Short documents may not benefit from caching.

17. **No image compression** — Card images stored as uncompressed PNG data URLs. No optimization or progressive loading.

18. **Global keyboard shortcut conflicts** — Only Escape is registered globally. No systematic keyboard shortcut management or conflict detection.

---

## 22. Planned / In-Progress Features

1. **Document change tracking** — Partially implemented. `pendingDocChanges` on nuggets track document additions/removals/renames. `DocumentChangeDialog` intercepts chat messages to notify Claude about document changes. A `PLAN-document-change-tracking.md` reference file exists in the `memory/` directory.

2. **Content-only image modification** — `executeContentModification()` is implemented in `modificationEngine.ts` but the UI trigger is not clearly exposed (annotation-based modification is the primary path).

3. **Swappable storage backend** — The `StorageBackend` interface is designed to be backend-agnostic. The current implementation is IndexedDB, but the interface supports future migration to a REST API backend without changing app code.

4. **Multi-turn image modification** — TODO comment in `modificationEngine.ts` mentions enabling iterative editing via multi-turn Gemini conversation (currently single-shot).

5. **Reference image style anchoring** — Implemented but session-only (not persisted). Users can stamp a card as a reference and new cards will attempt to replicate its visual identity.
