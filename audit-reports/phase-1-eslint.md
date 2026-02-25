# Phase 1 — ESLint Code Quality Scan

**Project**: InfoNugget v6.0
**Date**: 2026-02-24
**Auditor**: Claude Code (Opus 4.6)
**Mode**: READ-ONLY (no auto-fix applied)

---

## Configuration

**ESLint**: 9.39.3 (flat config format)
**TypeScript parser**: typescript-eslint
**Plugins**: react, react-hooks, react-refresh, import, promise, unicorn, sonarjs, jsx-a11y

**Rules enabled**: 68 rules across 7 plugin categories
**Files scanned**: 68

---

## Summary Counts

| Metric | Count |
|--------|-------|
| **Total errors** | **97** |
| **Total warnings** | **1,639** |
| **Total issues** | **1,736** |
| **Files with issues** | **63 / 68** (92.6%) |
| **Clean files** | **5** |

---

## Top 10 Most Frequent Issues

| # | Rule | Count | Sev | What It Means & Why It Matters |
|---|------|-------|-----|-------------------------------|
| 1 | `curly` | 761 | warn | Control flow statements (`if`, `else`, `for`, `while`) lack braces. Single-line bodies without braces are error-prone during future edits — adding a second line to a brace-less `if` silently breaks logic. |
| 2 | `no-magic-numbers` | 410 | warn | Numeric literals (e.g., `300`, `0.85`, `16`) used inline without named constants. Magic numbers obscure intent and make future changes fragile — updating one occurrence but missing another creates bugs. |
| 3 | `@typescript-eslint/no-unused-vars` | 73 | **error** | Variables, imports, or destructured values are declared but never used. Dead code clutters the codebase, misleads readers into thinking something is needed, and slows down comprehension. |
| 4 | `no-console` | 72 | warn | `console.log`, `console.warn`, or `console.error` calls left in code. These are typically debug artifacts that pollute production browser consoles and may leak sensitive information. |
| 5 | `no-nested-ternary` | 55 | warn | Ternary expressions nested inside other ternaries (e.g., `a ? b : c ? d : e`). Hard to read and reason about; if/else blocks or extracted variables are clearer. |
| 6 | `sonarjs/cognitive-complexity` | 51 | warn | Functions exceed the cognitive complexity threshold of 15. High complexity means a function has too many branches, loops, and nesting levels to hold in working memory, increasing bug risk. |
| 7 | `sonarjs/no-duplicate-string` | 48 | warn | The same string literal appears 3+ times in a file. Duplicated strings are a maintenance hazard — changing one but missing another creates inconsistency. Extract to a named constant. |
| 8 | `react-hooks/exhaustive-deps` | 48 | warn | `useEffect`, `useCallback`, or `useMemo` dependency arrays are missing values that the closure references. This causes stale closures — the hook runs with outdated state, leading to subtle bugs. |
| 9 | `@typescript-eslint/no-explicit-any` | 46 | warn | `any` type used explicitly, bypassing TypeScript's type system. Every `any` is a hole in type safety that can propagate through the codebase, masking type errors at compile time. |
| 10 | `unicorn/no-nested-ternary` | 32 | warn | Same as `no-nested-ternary` but from the unicorn plugin. The overlap is intentional — both flag the same readability concern. |

**Distribution**: The top 2 rules (`curly` + `no-magic-numbers`) account for **1,171 of 1,736 issues (67.5%)**. These are stylistic and would require broad but mechanical changes. The more substantive issues (`no-unused-vars`, `cognitive-complexity`, `exhaustive-deps`) are lower in volume but higher in impact.

---

## Critical Issues (Errors) — 97 Total

### Category: Type Safety — 93 errors

#### Unused Variables & Imports (`@typescript-eslint/no-unused-vars`) — 73 errors

| File | Line | Unused Symbol |
|------|------|---------------|
| `App.tsx` | 53 | `addCustomStyle` |
| `App.tsx` | 53 | `updateCustomStyle` |
| `App.tsx` | 53 | `deleteCustomStyle` |
| `App.tsx` | 82 | `currentSynthesisContent` |
| `App.tsx` | 84 | `contentDirty` |
| `App.tsx` | 84 | `selectedCount` |
| `App.tsx` | 86 | `handleGenerateAll` |
| `App.tsx` | 902 | `copied` / `setCopied` |
| `components/AssetsPanel.tsx` | 53 | `setActiveLogicTab` |
| `components/AssetsPanel.tsx` | 54 | `genStatus` |
| `components/AssetsPanel.tsx` | 82 | `colorRefs` |
| `components/ChatPanel.tsx` | 229 | `startEditing` |
| `components/DocumentEditorModal.tsx` | 4 | `isCoverLevel` (import) |
| `components/DocumentEditorModal.tsx` | 533 | `handleSaveAndClose` |
| `components/DocumentEditorModal.tsx` | 1183 | `e` (catch param) |
| `components/InsightsCardList.tsx` | 151 | `onSelectExclusive` |
| `components/InsightsCardList.tsx` | 152 | `onSelectRange` |
| `components/InsightsCardList.tsx` | 560 | `hasCard` |
| `components/InsightsCardList.tsx` | 561 | `hasSynthesis` |
| `components/PanelRequirements.tsx` | 47 | `activeCard` |
| `components/PdfBookmarkEditor.tsx` | 34 | `darkMode` |
| `components/ProjectsPanel.tsx` | 353 | `selectedNugget` |
| `components/ProjectsPanel.tsx` | 1220 | `onRename` / `onNewNugget` / `onDelete` |
| `components/ProjectsPanel.tsx` | 1224 | (related destructured props) |
| `components/ProjectsPanel.tsx` | 1388 | `selectedDocId` |
| `components/SourcesPanel.tsx` | 46 | `onUpdateDocumentStructure` |
| `components/SourcesPanel.tsx` | 315 | `handlePdfPromote` |
| `components/SourcesPanel.tsx` | 336 | `handlePdfDemote` |
| `components/SourcesPanel.tsx` | 357 | `handlePdfDelete` |
| `components/SourcesPanel.tsx` | 948 | `canPromote` |
| `components/SourcesPanel.tsx` | 949 | `canDemote` |
| `components/StorageProvider.tsx` | 3 | `Card` (import) |
| `components/workbench/AnnotationToolbar.tsx` | 96–100 | `zoomScale`, `onZoomIn`, `onZoomOut`, `onZoomReset`, `onRequestFullscreen` |
| `context/AppContext.tsx` | 3 | `WorkflowMode` |
| `hooks/useAnnotations.ts` | 2 | `NormalizedPoint` |
| `hooks/useAutoDeck.ts` | 404 | `totalWordCount` |
| `hooks/useCardGeneration.ts` | 4 | `Heading` (import) |
| `hooks/useCardGeneration.ts` | 5 | `DEFAULT_STYLING` (import) |
| `hooks/useCardGeneration.ts` | 65 | `ClaudeUsage` |
| `hooks/useCardGeneration.ts` | 65 | `activeCard` |
| `hooks/useDocumentEditing.ts` | 209 | `_e` |
| `hooks/useInsightsLab.ts` | 4 | `ClaudeMessage` (import) |
| `hooks/useInsightsLab.ts` | 4 | `ClaudeUsage` (import) |
| `hooks/useInsightsLab.ts` | 9 | `estimateTokens` (import) |
| `hooks/usePersistence.ts` | 3 | `Card` (import) |
| `hooks/useVersionHistory.ts` | 46, 56, 95 | `_` (x2), `prev` |
| `types.ts` | 236 | `FileType` |
| `utils/ai.ts` | 101 | `FLASH_TEXT_CONFIG` |
| `utils/ai.ts` | 143 | `resetGeminiKey` |
| `utils/formatTime.ts` | 4 | `formatTimestamp` |
| `utils/pdfBookmarks.ts` | 1 | `PDFDict` (import) |
| `utils/prompts/contentGeneration.ts` | 1 | `Heading` (import) |
| `utils/prompts/coverGeneration.ts` | 6, 7 | `hexToColorName`, `fontToDescriptor` |
| `utils/prompts/coverGeneration.ts` | 327 | `cardTitle` |
| `utils/prompts/insightsLab.ts` | 12 | `INSIGHTS_SYSTEM_PROMPT` |
| `utils/prompts/pwcGeneration.ts` | 5 | `sanitizePlannerOutput` |
| `utils/prompts/pwcGeneration.ts` | 43 | `cardTitle` |
| `utils/storage/StorageBackend.ts` | 2 | `ImageVersion`, `UploadedFile` |
| `utils/storage/serialize.ts` | 3, 16 | `StoredImageVersion`, `serializeFile` |

#### Use-Before-Define (`@typescript-eslint/no-use-before-define`) — 17 errors

| File | Line(s) | Symbol(s) |
|------|---------|-----------|
| `App.tsx` | 183, 192, 198 | `setBreadcrumbDropdown` |
| `components/ProjectsPanel.tsx` | 362, 466, 1308, 1494 | `findDocAcrossNuggets`, `ProjectRow`, `NuggetRow`, `DocRow` |
| `components/workbench/CanvasRenderer.ts` | 188, 191, 202, 205, 207, 209, 373, 458 | `drawArrowhead`, `drawSketchPath`, `drawPin`, `drawRectangle`, `drawArrow`, `drawSketch` |
| `components/workbench/PinEditor.tsx` | 25 | `handleSave` |
| `components/workbench/RectangleEditor.tsx` | 24 | `handleSave` |

#### Unused Expressions (`@typescript-eslint/no-unused-expressions`) — 3 errors

| File | Line |
|------|------|
| `components/AssetsPanel.tsx` | 525 |
| `components/FindReplaceBar.tsx` | 41 |
| `components/SourcesPanel.tsx` | 820 |

### Category: Import Issues — 4 errors

| File | Line | Rule | Detail |
|------|------|------|--------|
| `App.tsx` | 6 | `import/no-duplicates` | `./utils/ai` imported on two separate lines |
| `App.tsx` | 23 | `import/no-duplicates` | (same — second occurrence) |
| `App.tsx` | 23 | `no-duplicate-imports` | (same underlying issue) |
| `components/AssetsPanel.tsx` | 6 | `no-duplicate-imports` | `./workbench/AnnotationWorkbench` imported twice |

### Category: Security — 0 errors
### Category: React Problems — 0 errors
### Category: Hook Violations — 0 errors
### Category: Promise/Async — 0 errors
### Category: Bugs (runtime) — 0 errors

---

## Code Smell Hotspots (Top 10 Files by Warning Count)

### 1. `App.tsx` — 196 warnings
Top warnings: `curly` (96), `no-magic-numbers` (49), `no-console` (16)
**Assessment**: This 1,700+ line orchestrator file has the most warnings by far. The dominance of `curly` warnings indicates inconsistent brace style throughout. The 49 magic numbers suggest many hardcoded UI constants (dimensions, timeouts, thresholds). Needs splitting into smaller modules and extraction of constants.

### 2. `components/workbench/AnnotationWorkbench.tsx` — 102 warnings
Top warnings: `curly` (55), `no-magic-numbers` (17), `sonarjs/cognitive-complexity` (8)
**Assessment**: The annotation workbench has 8 cognitive complexity violations — more than any other file. Combined with 55 brace-style issues, this file has deeply nested control flow throughout. It handles mouse interactions, canvas state, and rendering all in one component. Strong candidate for decomposition.

### 3. `components/SourcesPanel.tsx` — 95 warnings
Top warnings: `curly` (47), `no-magic-numbers` (35), `import/order` (2)
**Assessment**: The Sources panel mixes PDF viewing, TOC editing, markdown rendering, and document management. The 35 magic numbers suggest many hardcoded layout/sizing values. Would benefit from extracting sub-components and defining named constants.

### 4. `components/DocumentEditorModal.tsx` — 93 warnings
Top warnings: `curly` (42), `no-magic-numbers` (18), `no-nested-ternary` (6)
**Assessment**: This modal handles complex editor state with multiple modes (editing, generation, sidebar). The 6 nested ternary warnings indicate render logic that's hard to follow. The cognitive complexity of 78 for the main component function confirms this is one of the most complex files.

### 5. `components/ProjectsPanel.tsx` — 77 warnings
Top warnings: `curly` (36), `no-nested-ternary` (10), `unicorn/no-nested-ternary` (10)
**Assessment**: The project tree component heavily uses nested ternaries for conditional rendering. With 20 total nested-ternary warnings, the JSX return blocks are likely very hard to read. Should extract conditional logic into helper functions or sub-components.

### 6. `components/AutoDeckPanel.tsx` — 72 warnings
Top warnings: `no-nested-ternary` (17), `no-magic-numbers` (15), `curly` (15)
**Assessment**: The Auto-Deck panel has the most nested ternaries of any file (17). Combined with 15 magic numbers, the rendering logic is dense and hard to maintain. The multiple view modes (briefing, review, production) each have complex conditional rendering.

### 7. `components/workbench/CanvasRenderer.ts` — 71 warnings
Top warnings: `no-magic-numbers` (57), `curly` (8), `prefer-template` (3)
**Assessment**: With 57 magic numbers, this is by far the worst offender for hardcoded numeric values. As a canvas drawing utility, it's full of coordinate calculations, pixel offsets, and drawing constants. Extracting these into named constants would dramatically improve readability.

### 8. `hooks/useDocumentEditing.ts` — 63 warnings
Top warnings: `curly` (45), `no-magic-numbers` (9), `sonarjs/cognitive-complexity` (4)
**Assessment**: This hook has 4 functions exceeding the complexity threshold, indicating deeply branching command execution logic. The 45 `curly` warnings suggest many terse single-line conditionals. Needs function decomposition for the command handlers.

### 9. `components/PdfViewer.tsx` — 58 warnings
Top warnings: `curly` (23), `no-magic-numbers` (17), `unicorn/no-array-for-each` (7)
**Assessment**: The PDF viewer uses `.forEach()` on 7 occasions where `for...of` loops would be clearer. The 17 magic numbers relate to PDF rendering coordinates and sizing. Moderate complexity; could benefit from named constants and modern loop syntax.

### 10. `hooks/useCardGeneration.ts` — 51 warnings
Top warnings: `curly` (16), `no-magic-numbers` (9), `@typescript-eslint/no-explicit-any` (8)
**Assessment**: The card generation pipeline uses `any` in 8 places, punching holes in type safety at the AI response boundary. The 3-phase pipeline logic contributes to complexity. The `any` types are the most concerning issue — they mask potential runtime errors from malformed AI responses.

---

## Complexity Hotspots

All functions exceeding the cognitive complexity threshold of 15, sorted by severity:

| Complexity | File | Line | Function | Description | Justified? |
|------------|------|------|----------|-------------|------------|
| **80** | `components/AssetsPanel.tsx` | 80 | `AssetsPanel` | Renders asset cards with image management, styling, and deletion | **Excessive** — 5.3x limit. Needs urgent decomposition into sub-components. |
| **78** | `components/DocumentEditorModal.tsx` | 56 | `DocumentEditorModal` | Full document editor with save, generation, and sidebar features | **Excessive** — 5.2x limit. Should be split into editor, sidebar, and toolbar components. |
| **65** | `components/StorageProvider.tsx` | 89 | `hydrateFromStorage` | Initializes storage and loads all IndexedDB stores in parallel | **High but partly justified** — hydration naturally touches many stores. Could extract per-store loaders. |
| **51** | `hooks/useCardGeneration.ts` | 234 | `generateCard` | 3-phase card generation pipeline (synthesis → layout → image) | **Partly justified** — pipeline has inherent sequential complexity. Could extract phase handlers. |
| **50** | `App.tsx` | 1153 | `handleGenerateCardContent` | Generates card content from Sources panel with document context | **Excessive** — orchestration logic that should be delegated to the hook. |
| **42** | `hooks/useInsightsLab.ts` | 61 | `sendMessage` | Sends chat messages to Claude with document context | **Excessive** — message construction, API call, and response handling should be separated. |
| **41** | `AnnotationWorkbench.tsx` | 655 | `handleMouseMove` | Mouse movement for canvas panning and annotation manipulation | **Partly justified** — mouse events handle many modes. Could use a state machine pattern. |
| **39** | `AnnotationWorkbench.tsx` | 569 | `handleMouseDown` | Mouse down to start annotations, panning, or selection | **Partly justified** — same reasoning as mouse move. Should share a state machine. |
| **39** | `utils/markdown.ts` | 29 | `walk` | Recursive HTML-to-markdown DOM traversal | **Justified** — recursive tree traversal is inherently complex. Low refactoring priority. |
| **37** | `components/SourcesPanel.tsx` | 569 | _(inline render logic)_ | Determines active document tab and renders viewer | **Excessive** — inline render logic should be extracted into a dedicated component. |
| **36** | `components/PdfViewer.tsx` | 71 | `searchAndScroll` | Searches rendered text spans and scrolls to match | **Borderline** — search logic with scoring. Could extract scoring into a helper. |
| **35** | `hooks/useAutoDeck.ts` | 373 | `approvePlan` | Finalizes auto-deck plan through AI planning/production | **Partly justified** — pipeline complexity. Could extract phase handlers. |
| **35** | `hooks/useDocumentEditing.ts` | 256 | `executeCommand` | Executes editor commands including undo/redo and DOM manipulation | **Excessive** — command pattern would reduce complexity significantly. |
| **31** | `AutoDeckPanel.tsx` | 641 | `renderReviewView` | Renders auto-deck review interface with Q&A inputs | **Excessive** — rendering logic should be extracted into sub-components. |
| **31** | `hooks/useCardGeneration.ts` | 120 | `performSynthesis` | Splits documents between Files API and inline processing | **Partly justified** — branching on document types is inherent. Could extract strategies. |
| **30** | `hooks/useDocumentEditing.ts` | 455 | _(function at line 455)_ | Document editing helper | **Excessive** — part of an already-complex hook. |
| **30** | `utils/redline.ts` | 190 | _(function at line 190)_ | Redline comparison utility | **Borderline** — diff logic is inherently branchy. |
| **29** | `utils/subjectGeneration.ts` | 13 | _(function at line 13)_ | Subject/title generation from content | **Borderline** — text parsing logic. |
| **27** | `AnnotationWorkbench.tsx` | 452 | _(function at line 452)_ | Annotation helper | **Excessive** — 8th complexity hit in this file. |
| **25** | `AutoDeckPanel.tsx` | 576 | _(function at line 576)_ | Auto-deck rendering helper | **Excessive** — too many view modes in one component. |
| **25** | `ProjectsPanel.tsx` | 1390 | _(function at line 1390)_ | Project tree rendering | **Excessive** — large tree component. |
| **25** | `AnnotationToolbar.tsx` | 103 | _(function at line 103)_ | Toolbar component | **Borderline** — many tool options. |
| **24** | `AnnotationWorkbench.tsx` | 94 | _(function at line 94)_ | Workbench setup/initialization | **Excessive** — part of the heavily complex workbench. |
| **24** | `useDocumentFindReplace.ts` | 78 | _(function at line 78)_ | Find/replace traversal logic | **Partly justified** — text search is inherently branchy. |
| **24** | `prompts/contentGeneration.ts` | 201 | _(function at line 201)_ | Content generation prompt builder | **Borderline** — prompt construction logic. |
| **23** | `App.tsx` | 36 | `App` (top-level) | Main app component | **Excessive** — confirms App.tsx needs decomposition. |
| **23** | `ProjectsPanel.tsx` | 1228 | _(function at line 1228)_ | Project tree sub-component | **Excessive** — nested rendering. |
| **23** | `CanvasRenderer.ts` | 38 | _(function at line 38)_ | Canvas rendering entry point | **Borderline** — rendering dispatch. |
| **23** | `utils/ai.ts` | 296 | _(function at line 296)_ | AI client/retry logic | **Partly justified** — retry/fallback inherently complex. |
| **23** | `autoDeck/parsers.ts` | 35 | _(function at line 35)_ | Auto-deck response parsing | **Borderline** — parsing structured AI output. |

**51 total complexity violations** across **19 files**. The worst offender is `AnnotationWorkbench.tsx` with **8 violations**.

### Complexity Severity Tiers

| Tier | Complexity | Count | Action |
|------|-----------|-------|--------|
| **Critical** (3x+ limit) | 45–80 | 5 | Urgent decomposition needed |
| **High** (2x–3x limit) | 30–44 | 7 | Should be split in next refactoring pass |
| **Moderate** (1.5x–2x limit) | 23–29 | 15 | Monitor; refactor opportunistically |
| **Marginal** (1x–1.5x limit) | 16–22 | 24 | Acceptable; improve if touching the code |

---

## Circular Dependencies

**0 found.** The `import/no-cycle` rule (with maxDepth: 5) detected no circular dependency chains. The module graph is clean.

---

## Additional Notable Findings

### Hook Dependency Warnings (`react-hooks/exhaustive-deps`) — 48 warnings

These are among the most **bug-prone** warnings. Missing dependencies in `useEffect`/`useCallback`/`useMemo` cause stale closures. The 48 instances are spread across hooks and components — each one is a potential source of subtle state bugs.

### `any` Type Usage (`@typescript-eslint/no-explicit-any`) — 46 warnings

The `any` type appears 46 times, primarily at AI response boundaries (`useCardGeneration.ts`: 8, various prompt utilities) and storage serialization. While some `any` at external API boundaries is pragmatic, 46 instances represent significant type safety gaps.

### Console Statements (`no-console`) — 72 warnings

72 `console.*` calls remain in the codebase. These are likely debug artifacts that should be removed or replaced with a proper logging utility before production deployment.

---

## Overall Assessment

| Severity | Category | Count | Priority |
|----------|----------|-------|----------|
| **Error** | Unused variables/imports | 73 | Medium — safe mechanical cleanup |
| **Error** | Use-before-define | 17 | Low — mostly function hoisting (safe at runtime) |
| **Error** | Duplicate imports | 4 | Low — trivial to consolidate |
| **Error** | Unused expressions | 3 | Medium — may indicate logic bugs |
| **Warn** | Missing braces (`curly`) | 761 | Low — stylistic, high volume |
| **Warn** | Magic numbers | 410 | Low — improve incrementally |
| **Warn** | Cognitive complexity | 51 | **High** — top refactoring priority |
| **Warn** | Hook dependency issues | 48 | **High** — potential runtime bugs |
| **Warn** | `any` type usage | 46 | Medium — weakens type safety |
| **Warn** | Console statements | 72 | Medium — remove before production |

### Key Takeaways

1. **No security vulnerabilities, no hook rule violations, no critical React errors** — the codebase is fundamentally sound
2. **97 errors are all dead code** — unused vars/imports that can be mechanically cleaned
3. **Cognitive complexity is the #1 structural concern** — 5 functions exceed 3x the threshold, with `AssetsPanel` (80) and `DocumentEditorModal` (78) being extreme outliers
4. **`AnnotationWorkbench.tsx`** is the single most problematic file: 102 warnings + 8 complexity hotspots
5. **48 stale-closure risks** from missing hook dependencies deserve careful review
6. **No circular dependencies** — the module architecture is clean
7. **67.5% of all warnings** are `curly` + `no-magic-numbers` — high volume but low severity
