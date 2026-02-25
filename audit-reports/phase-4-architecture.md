# Phase 4 — Architecture & Dependency Analysis

**Project**: InfoNugget v6.0
**Date**: 2026-02-24
**Auditor**: Claude Code (Opus 4.6)
**Tools**: madge (circular/orphan detection), manual source analysis
**Mode**: READ-ONLY (no source files modified)

---

## Circular Dependencies

**Result: None found.**

Madge processed 68 files and detected **zero circular dependencies**. The module graph is acyclic. (Confirmed independently by ESLint's `import/no-cycle` rule in Phase 1.)

---

## Orphan Files

Files not imported by any other module:

| File | Status | Assessment |
|------|--------|-----------|
| `index.tsx` | Entry point | **Expected** — Vite entry, imports App |
| `vite.config.ts` | Build config | **Expected** — consumed by Vite CLI |

No orphaned source files. Every non-config file is reachable from the module graph.

---

## God Components (Requires Splitting)

10 components meet the God Component criteria (>300 lines, >5 useState, >3 useEffect, mixed concerns). **They contain 76.5% of all component code.**

| # | Component | Lines | useState | useEffect | useCallback | Props | Fan-Out | Assessment |
|---|-----------|-------|----------|-----------|-------------|-------|---------|-----------|
| 1 | **App.tsx** | 2,422 | 11 | 12 | 52 | 0 (top) | 30 | **CRITICAL** — Orchestrator, API layer, business logic, and layout in one file. 52 callbacks = "callback highway" where every user action funnels through. |
| 2 | **ProjectsPanel** | 1,561 | 12 | 7 | 1 | 36 | 4 | Tree rendering + context menus + rename/copy/move logic. The 36-prop interface is the largest in the codebase. |
| 3 | **DocumentEditorModal** | 1,271 | 7 | 6 | 14 | 15 | 7 | Editor + TOC sidebar with drag-reorder + heading context menus. TOC sidebar alone is ~400 lines. |
| 4 | **SourcesPanel** | 1,241 | 15 | 10 | 16 | 13 | 9 | 15 useState (highest). Manages PDF viewer + TOC draft editing + bookmark editor + doc tabs. Three jobs in one. |
| 5 | **AutoDeckPanel** | 1,240 | 7 | 5 | 4 | 13 | 4 | 5 workflow phases rendered in one component via large conditional blocks. |
| 6 | **AnnotationWorkbench** | 1,142 | 7 | 8 | 18 | 16 | 10 | Canvas interaction engine + AI modification pipeline. Mouse handlers span ~300 lines. |
| 7 | **InsightsCardList** | 997 | 6 | 5 | 3 | 18 | 4 | Drag-reorder + context menus + InfoContent sub-component all inline. |
| 8 | **ChatPanel** | 808 | 12 | 7 | 6 | 14 | 4 | 12 useState managing orthogonal concerns (animation, input, menus, edit mode, document notice). |
| 9 | **StyleStudioModal** | 765 | 12 | 6 | 2 | 3 | 2 | 12 useState for 3 props = too much local state. Mixes list management, style editing, and AI generation. |
| 10 | **AssetsPanel** | 843 | 6 | 4 | 0 | 33 | 7 | Borderline — mostly a "prop relay" (33 props) passing through to AnnotationWorkbench. |

### Recommended Splits

| Component | Extract To | Lines Saved |
|-----------|-----------|-------------|
| App.tsx | `useDocumentOperations`, `useNuggetOperations`, `useCardOperations`, `useContentSynthesis` hooks + `PanelLayout` component | ~1,200 |
| ProjectsPanel | `ProjectTreeItem`, `NuggetTreeItem`, `DocTreeItem` sub-components + `usePanelOverlay` hook | ~800 |
| SourcesPanel | `usePdfTocEditing` hook + `PdfTocSidebar` component + `usePanelOverlay` hook | ~600 |
| DocumentEditorModal | `TocSidebar` + `HeadingContextMenu` sub-components | ~600 |
| AutoDeckPanel | `AutoDeckBriefingForm`, `AutoDeckReviewPanel`, `AutoDeckProgressView` | ~700 |
| AnnotationWorkbench | `useCanvasInteraction` + `usePanZoom` hooks | ~400 |
| ChatPanel | `ChatMessageList` + `ChatInput` + `usePanelOverlay` hook | ~400 |
| StyleStudioModal | `StyleListSidebar` + `StyleEditor` + `AIStyleDialog` | ~400 |

**Shared `usePanelOverlay` hook** — ProjectsPanel, SourcesPanel, ChatPanel, and AutoDeckPanel all have identical open/close animation + drag-resize logic (~40-50 lines each). Extracting this eliminates ~160 lines of duplication.

---

## High Coupling Files (Risky to Change)

| File | Fan-In | Fan-Out | Flag | Risk |
|------|--------|---------|------|------|
| **types.ts** | **48** | 0 | Fan-in > 15 | 70% of files import this. A monolithic type file — any rename/restructure touches 48 files. No domain separation (card, project, AI, storage types all mixed). |
| **App.tsx** | 1 | **30** | Fan-out > 10 | Imports 30 modules (17 components, 5 hooks, 8 utils). Any interface change in any dependency can break it. Impossible to unit-test. |
| **useAutoDeck.ts** | 1 | **11** | Fan-out > 10 | Orchestrates the Auto-Deck pipeline across 11 modules including a layer-violating component import. |
| **useCardGeneration.ts** | 1 | **11** | Fan-out > 10 | Orchestrates the 3-phase pipeline across 11 modules. Same layer violation. |

### Near-Threshold Files

| File | Fan-In | Fan-Out | Note |
|------|--------|---------|------|
| `context/AppContext.tsx` | 13 | 1 | Near fan-in 15. Global state — expected but worth monitoring. |
| `utils/ai.ts` | 13 | 1 | Near fan-in 15. Central AI client used by most hooks and utilities. |
| `utils/prompts/promptUtils.ts` | 8 | 2 | Foundation utility imported by all prompt builders. |
| `AnnotationWorkbench.tsx` | 1 | 10 | Near fan-out 10. Canvas + AI modification. |
| `useInsightsLab.ts` | 1 | 9 | Near fan-out 10. Chat + document context. |
| `SourcesPanel.tsx` | 1 | 9 | Near fan-out 10. PDF + TOC + docs. |

---

## Layer Violations

### Expected Layer Architecture

```
types.ts          ← Foundation (no imports)
    ↑
utils/            ← Pure utilities (import types only)
    ↑
hooks/            ← Business logic (import types + utils)
    ↑
components/       ← UI (import types + utils + hooks)
    ↑
context/          ← State providers (import types)
    ↑
App.tsx           ← Orchestrator (import everything)
    ↑
index.tsx         ← Entry point
```

### Violation 1: Utility imports from a hook (DOWNWARD)

```
utils/subjectGeneration.ts  →  hooks/useTokenUsage.ts
```

A utility reaching upward into the hooks layer. `subjectGeneration.ts` cannot be used independently of the hooks layer. The `RecordUsageFn` type should be defined in `types.ts`, not in a hook.

### Violation 2: Hooks import from a component (DOWNWARD) — 2 instances

```
hooks/useAutoDeck.ts        →  components/ToastNotification.tsx
hooks/useCardGeneration.ts  →  components/ToastNotification.tsx
```

Hooks should not depend on UI components. The toast triggering function/type is exported from the component file and should be extracted to a separate utility or context that both hooks and components can consume.

### Violation 3: SourcesPanel imports from CardsPanel (SIBLING)

```
components/SourcesPanel.tsx  →  components/CardsPanel.tsx
```

Sibling panel importing from another panel creates tight coupling. If CardsPanel exports a shared sub-component or type, it should be extracted to a common location.

---

## State Management Issues

### Architecture

- **Approach**: React Context (`AppContext.tsx`) — single monolithic provider
- **Context size**: 13 state values + 3 derived values + ~42 exposed functions = **~58 members**
- **No external state library** (Redux, Zustand, etc.)

### Issue 1: Massive Prop Drilling (~120 props from App.tsx)

App.tsx passes approximately **120 props** to its 6 child panels:

| Panel | Props Received | Also Uses Context? |
|-------|---------------|-------------------|
| ProjectsPanel | ~30 | Yes |
| AssetsPanel | ~30 | Yes |
| CardsPanel | ~20 | No |
| SourcesPanel | ~15 | Yes |
| ChatPanel | ~12 | Yes |
| AutoDeckPanel | ~13 | Yes |

**5 of 6 panels** access `useAppContext()` directly AND receive context values as props — these are **redundant**. Values like `nuggets`, `projects`, `selectedNuggetId`, `activeCardId` are passed as props even though children can read them from context.

### Issue 2: Derived State Stored as State

| State | Location | Problem |
|-------|----------|---------|
| `insightsSession` | AppContext | Fully derived from `selectedNugget`. A `useEffect` rebuilds it on every nugget change, but it should be a `useMemo`. This causes extra re-renders and requires dual-write callbacks. |
| `activeCard` / `currentSynthesisContent` | useCardGeneration | These `useMemo` values always reference `cards[0]`, ignoring `activeCardId`. Likely stale/incorrect code. |
| `isProjectsPanelOpen` | AppContext | Initial `true` value, but panel visibility is actually controlled by `expandedPanel` in App.tsx. Potentially dead state. |

### Issue 3: Legacy insightsSession Shim

The backward-compat shim `insightsSession` is the root cause of:
- ~10 dual-write wrapper callbacks in App.tsx (e.g., `toggleInsightsCardSelection`, `deleteInsightsCard`)
- Extra re-renders from derived-state-as-state
- Confusion about the source of truth for card/message data
- ~200+ lines of App.tsx that exist solely for shim maintenance

Removing this shim would eliminate ~10 callbacks and simplify the entire data flow.

### Issue 4: Monolithic Context

All application state (13 values, 42 functions) lives in a single context. Every state update triggers a re-render of **every component that calls `useAppContext()`** — which is most of the app. There is no `React.memo` or context splitting to prevent cascading re-renders.

---

## Directory Structure Assessment

### Organization: **By Type** (not by feature)

```
/                          ← Root-level entry + orchestrator
├── components/            ← All React components (26 files)
│   └── workbench/         ← Canvas sub-components (5 files)
├── context/               ← Single context file
├── hooks/                 ← All custom hooks (9 files)
├── utils/                 ← All utilities (12 files)
│   ├── autoDeck/          ← Auto-Deck constants + parsers (2 files)
│   ├── prompts/           ← Prompt builders (9 files)
│   └── storage/           ← IndexedDB backend (3 files)
└── types.ts               ← All types in one file
```

### Issues

| Issue | Location | Impact |
|-------|----------|--------|
| **No feature grouping** | Project-wide | Auto-Deck, Chat, Card Generation, and PDF Editing are all distinct features, but their components, hooks, and utils are spread across separate type-organized directories. |
| **components/ has 26 files** | `components/` | Exceeds the 15-file guideline. Should be organized into feature subdirectories. |
| **Flat utils/ has 12 files** | `utils/` | Borderline. The `prompts/`, `storage/`, and `autoDeck/` subdirectories help, but the root has 12 loose files. |
| **types.ts is monolithic** | Root | 48 files import it. Should be split by domain (card types, project types, AI types, etc.). |
| **Naming is consistent** | All | Components: PascalCase. Hooks: camelCase with `use`. Utils: camelCase. No inconsistencies found. |
| **No deep nesting** | All | Maximum depth is 2 (`utils/prompts/`, `utils/storage/`, `utils/autoDeck/`, `components/workbench/`). Well within the 4-level guideline. |

---

## Custom Hook Issues

| Hook | Lines | Components | Responsibilities | Assessment |
|------|-------|------------|-----------------|-----------|
| **useDocumentEditing** | 541 | 1 | Editor init, dirty tracking, undo/redo, heading parsing, heading selection, heading level changes, heading reorder, format state, keyboard shortcuts | **Too many** — 9 distinct concerns. Extract `useEditorUndoRedo`, `useHeadingManagement`, `useFormatToolbarState`. |
| **useCardGeneration** | 465 | 1 | Content synthesis, layout planning, image gen, batch orchestration, image modification, UI state (`activeLogicTab`, `manifestCards`) | **Too many** — mixes pipeline logic with UI state. Extract `activeLogicTab`/`manifestCards` to the consuming component. |
| **useInsightsLab** | 364 | 1 | Chat messaging, document context resolution, document change detection, card content generation | **Borderline** — doc-change tracking (lines 256-343) is a distinct concern. |
| **useAutoDeck** | 722 | 1 | Plan, revise, produce, review state, card creation | **Cohesive but large** — responsibilities are all part of one workflow. Size is the main concern. |
| **usePersistence** | 240 | 1 | Persists 5 data domains (app state, insights, nuggets, projects, custom styles) | **Borderline** — 7 useEffect calls with separate debounce timers. Could split per domain. |
| useAnnotations | 79 | 1 | Annotation CRUD + selection | Clean, well-scoped. |
| useDocumentFindReplace | 292 | 1 | Find/replace with DOM mark injection | Clean, single concern. |
| useTokenUsage | 153 | 4 | Token/cost tracking + persistence | Clean, well-scoped. |
| useVersionHistory | 174 | 1 | Image version undo/redo | Clean, well-scoped. |

### Hook Usage Pattern

| Pattern | Count | Files |
|---------|-------|-------|
| Hook used by only 1 component | 8 of 9 | All except useTokenUsage |
| Hook used by 2+ components | 1 of 9 | useTokenUsage (4 consumers) |

Most hooks are tightly coupled to a single consumer component. This is not inherently bad (hooks encapsulate complexity), but it means the hook abstraction is serving complexity management rather than reuse.

---

## Architecture Diagram

```
                         ┌─────────────────────────────────────────┐
                         │              index.tsx                   │
                         │  StorageProvider → ToastProvider → App   │
                         └────────────────────┬────────────────────┘
                                              │
                    ┌─────────────────────────┤──── App.tsx ────────────────────────────────────┐
                    │                         │    (2422 lines, 30 imports, 52 callbacks)       │
                    │                         │    *** GOD COMPONENT — CRITICAL ***             │
                    │                         │    Orchestrator + API layer + business logic    │
                    │                         └────────┬───────────────────────────────────────┘
                    │                                  │
        ┌───────────┼──────────────┬──────────────┬────┼──────────────┬──────────────┐
        │           │              │              │    │              │              │
   ┌────▼───┐  ┌───▼────┐   ┌────▼───┐   ┌─────▼──┐│ ┌──▼──────┐  ┌──▼──────┐
   │Projects│  │Sources │   │  Chat  │   │AutoDeck││ │ Cards  │  │ Assets │
   │ Panel  │  │ Panel  │   │ Panel  │   │ Panel  ││ │ Panel  │  │ Panel  │
   │1561 ln │  │1241 ln │   │ 808 ln │   │1240 ln ││ │ 377 ln │  │ 843 ln │
   │36 props│  │13 props│   │14 props│   │13 props││ │22 props│  │33 props│
   └────────┘  └───┬────┘   └────────┘   └────────┘│ └───┬────┘  └───┬────┘
                   │                                │     │           │
              ┌────▼─────┐                          │ ┌───▼─────┐ ┌───▼──────────┐
              │PdfViewer │                          │ │Insights │ │Annotation    │
              │PdfBkmkEd │                          │ │CardList │ │Workbench     │
              │DocEditor │                          │ │ 997 ln  │ │ 1142 ln      │
              └──────────┘                          │ └─────────┘ └──────────────┘
                                                    │
    ┌───────────────────────────────────────────────┘
    │  ~120 PROPS passed from App to panels
    │  (5 of 6 panels also use useAppContext directly — redundant)
    │
    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        context/AppContext.tsx                          │
│   13 useState values + 3 derived + ~42 functions = 58 members         │
│   MONOLITHIC — every state update re-renders every consumer           │
│   includes legacy insightsSession shim (causes ~10 dual-write CBs)   │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
    ┌───────────┬───────────────┼────────────────────────┐
    │           │               │                        │
┌───▼──────┐ ┌─▼───────────┐ ┌▼──────────────┐ ┌───────▼───────┐
│useAuto   │ │useCard      │ │useInsightsLab │ │usePersistence │
│Deck      │ │Generation   │ │  364 lines    │ │  240 lines    │
│722 lines │ │ 465 lines   │ └──────┬────────┘ └───────────────┘
│ FO: 11 ⚠ │ │ FO: 11 ⚠    │        │
└──┬───────┘ └──┬──────────┘        │
   │            │                    │
   │  ┌────────┤                    │
   │  │  LAYER VIOLATIONS:          │
   │  │  hooks → components/ToastNotification.tsx
   │  │  utils/subjectGeneration.ts → hooks/useTokenUsage.ts
   │  │
   ▼  ▼
┌────────────────────────────────────────────────────────────────┐
│                         utils/ layer                           │
│                                                                │
│  ai.ts (FI:13)    fileProcessing.ts    markdown.ts             │
│  modificationEngine.ts    pdfBookmarks.ts    geometry.ts       │
│  subjectGeneration.ts ⚠ (imports from hooks/)                 │
│                                                                │
│  prompts/: contentGen, imageGen, coverGen, pwcGen,             │
│            insightsLab, autoDeckPlanner, autoDeckProducer,     │
│            documentConversion, promptUtils (FI:8)              │
│                                                                │
│  storage/: IndexedDBBackend, StorageBackend, serialize         │
│  autoDeck/: constants, parsers                                 │
└────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                     types.ts (FI: 48)                          │
│     Monolithic: ALL interfaces in one file                     │
│     70% of codebase imports this file                          │
│     Any change triggers 48-file recompilation                  │
└────────────────────────────────────────────────────────────────┘

Legend: FI = Fan-In, FO = Fan-Out, ⚠ = Issue flagged
        GOD = God Component
        Lines shown are approximate
```

---

## Overall Assessment

### Architecture Health Scorecard

| Category | Score | Notes |
|----------|-------|-------|
| Circular Dependencies | **A** | Zero cycles. Clean module graph. |
| Orphan Files | **A** | No orphans. All files reachable. |
| Component Size | **F** | 10 God Components contain 76.5% of code. |
| Coupling | **C** | App.tsx fan-out of 30 is extreme. types.ts fan-in of 48. |
| Layer Discipline | **B** | 3 minor violations (hooks→components, utils→hooks). |
| State Management | **D** | Monolithic context, ~120 props drilled, derived state stored as state, legacy shim. |
| Directory Structure | **C** | By-type organization works at this scale but components/ is overcrowded. |
| Hook Design | **C** | 3 of 9 hooks have too many responsibilities. 8 of 9 used by only 1 component. |
| Naming | **A** | Consistent PascalCase components, camelCase hooks/utils. |

### Top 5 Architecture Priorities

1. **Split App.tsx** — 2,422 lines, 30 imports, 52 callbacks. Extract domain-specific hooks (`useDocumentOperations`, `useCardOperations`, etc.) and reduce it to a thin layout shell. This is the single highest-impact refactoring.

2. **Remove insightsSession shim** — Eliminates ~10 dual-write callbacks in App.tsx, removes derived-state-as-state, and simplifies the entire data flow. The CLAUDE.md notes it's ~60% migrated.

3. **Split monolithic context** — The 58-member `AppContext` causes cascading re-renders. Split into `ProjectContext`, `NuggetContext`, `SelectionContext`, `StyleContext` so state updates only re-render relevant consumers.

4. **Eliminate prop drilling** — Since 5 of 6 panels already access context directly, remove the ~60+ redundant props passed from App.tsx. Let panels consume context values directly.

5. **Extract shared panel overlay pattern** — ProjectsPanel, SourcesPanel, ChatPanel, and AutoDeckPanel all have identical open/close animation + resize logic. A `usePanelOverlay` hook would reduce ~160 lines of duplication and make it trivial to add new panels.
