# Phase 3 — Duplication Audit (jscpd)

**Project**: InfoNugget v6.0
**Date**: 2026-02-24
**Auditor**: Claude Code (Opus 4.6)
**Tool**: jscpd (minLines: 5, minTokens: 50)
**Mode**: READ-ONLY (no source files modified)

---

## Duplication Summary

| Metric | Value |
|--------|-------|
| Files scanned | 88 |
| Total lines scanned | 22,651 |
| Total tokens scanned | 221,847 |
| **Duplicate blocks found** | **62** |
| **Duplicated lines** | **689** |
| **Duplication percentage** | **3.04%** |

### Industry Benchmark

| Range | Rating | This Project |
|-------|--------|-------------|
| < 5% | Good | **3.04%** |
| 5–10% | Acceptable | |
| > 10% | Needs work | |

**Verdict**: The overall duplication rate is **good** (under 5%). However, duplication is concentrated in a few hotspot files, and several high-value extraction opportunities exist.

### By Format

| Format | Files | Lines | Clones | Dup Lines | Dup % |
|--------|-------|-------|--------|-----------|-------|
| TypeScript (.ts) | 38 | 10,734 | 27 | 315 | 2.93% |
| TSX (.tsx) | 25 | 7,732 | 32 | 296 | 3.83% |
| JavaScript (.jsx parsed) | 25 | 4,185 | 3 | 78 | 1.86% |

---

## Duplicate Blocks (Ordered by Size, Largest First)

### 1. useAutoDeck.ts — Claude API call with Files API injection (40 lines, 385 tokens)
- **Location A**: `hooks/useAutoDeck.ts:282–321`
- **Location B**: `hooks/useAutoDeck.ts:135–174`
- **What it does**: Injects Files API document blocks into the first user message, calls Claude with system prompts, and records token usage. This is the `planDeck` vs `reviseDeck` flow — nearly identical API call patterns.
- **Recommended fix**: Extract `callClaudeWithFileApiDocs(systemBlocks, messages, fileApiDocs, recordUsage)` utility in `utils/ai.ts`.
- **Risk level**: MEDIUM — needs careful interface design to handle the slight differences between plan and revise flows.

### 2. NuggetCreationModal ↔ ProjectCreationModal — Modal dialog chrome (36 lines, 444 tokens)
- **Location A**: `components/NuggetCreationModal.tsx:106–141`
- **Location B**: `components/ProjectCreationModal.tsx:47–68`
- **What it does**: Renders modal backdrop, dialog container, styled header with title, name input field, and action buttons — all with consistent dark mode theming.
- **Recommended fix**: Extract `CreationModalBase` component with `title`, `nameLabel`, `onSubmit`, and children props.
- **Risk level**: LOW — straightforward component extraction.

### 3. PinEditor ↔ RectangleEditor — Popover UI with textarea (33 lines, 363 tokens)
- **Location A**: `components/workbench/PinEditor.tsx:68–100`
- **Location B**: `components/workbench/RectangleEditor.tsx:65–97`
- **What it does**: Renders a popover with delete/save icon buttons and a textarea for editing annotation instructions.
- **Recommended fix**: Extract shared `AnnotationEditorPopover` component. PinEditor and RectangleEditor are ~90% identical.
- **Risk level**: LOW — the two components are near-copies.

### 4. PinEditor ↔ RectangleEditor — Click-outside + keyboard handlers (27 lines, 228 tokens)
- **Location A**: `components/workbench/PinEditor.tsx:29–55`
- **Location B**: `components/workbench/RectangleEditor.tsx:27–53`
- **What it does**: Sets up click-outside detection with debounce, Enter to save, Escape to close with stopPropagation.
- **Recommended fix**: Extract `useAnnotationEditorKeyboard(onSave, onDelete, onClose)` hook.
- **Risk level**: LOW.

### 5. PinEditor ↔ RectangleEditor — Action button row (24 lines, 256 tokens)
- **Location A**: `components/workbench/PinEditor.tsx:76–99`
- **Location B**: `components/workbench/RectangleEditor.tsx:73–96`
- **What it does**: Renders delete and save icon buttons with hover state tracking.
- **Recommended fix**: Part of the same `AnnotationEditorPopover` extraction as #3.
- **Risk level**: LOW.

### 6. modificationEngine.ts — Gemini usage recording (21 lines, 139 tokens)
- **Location A**: `utils/modificationEngine.ts:165–185`
- **Location B**: `utils/modificationEngine.ts:84–104`
- **What it does**: Extracts Gemini image generation token counts from API response metadata and records usage.
- **Recommended fix**: Extract `recordGeminiImageUsage(response, recordUsage)` function.
- **Risk level**: LOW — pure utility extraction.

### 7. useAutoDeck.ts — Files API injection (third copy) (21 lines, 236 tokens)
- **Location A**: `hooks/useAutoDeck.ts:514–534`
- **Location B**: `hooks/useAutoDeck.ts:135–155`
- **What it does**: Third instance of the Files API document block injection pattern (used in the `produce` flow).
- **Recommended fix**: Same extraction as #1 — this is the same pattern appearing a third time.
- **Risk level**: MEDIUM.

### 8. useDocumentEditing.ts — Heading parsing from DOM (20 lines, 257 tokens)
- **Location A**: `hooks/useDocumentEditing.ts:135–154`
- **Location B**: `hooks/useDocumentEditing.ts:81–100`
- **What it does**: Parses heading elements from the contenteditable editor, assigns unique IDs if missing, and preserves previous selection state.
- **Recommended fix**: Extract `parseHeadingsFromEditor(editorRef, previousHeadings)` utility.
- **Risk level**: LOW.

### 9. InsightsCardList.tsx — Delete confirmation dialogs (18 lines, 218 tokens)
- **Location A**: `components/InsightsCardList.tsx:873–890`
- **Location B**: `components/InsightsCardList.tsx:830–847`
- **What it does**: Renders confirmation dialog with trash icon for single vs. multi-card deletion.
- **Recommended fix**: Extract `ConfirmDeleteDialog` component or parameterize the existing dialog.
- **Risk level**: LOW.

### 10. contentGeneration ↔ pwcGeneration — Aspect ratio descriptions (16 lines, 197 tokens)
- **Location A**: `utils/prompts/contentGeneration.ts:104–119`
- **Location B**: `utils/prompts/pwcGeneration.ts:124–139`
- **What it does**: Converts aspect ratio code to human-readable canvas description (landscape 16:9, portrait, square, etc.).
- **Recommended fix**: Extract `getCanvasDescription(aspectRatio)` into `utils/prompts/promptUtils.ts`.
- **Risk level**: LOW — pure function extraction.

### 11. ChatPanel.tsx — Copy button with checkmark toggle (15 lines, 225 tokens)
- **Location A**: `components/ChatPanel.tsx:512–526`
- **Location B**: `components/ChatPanel.tsx:456–470`
- **What it does**: Renders a clipboard icon button that toggles to a checkmark on click (copy-to-clipboard feedback).
- **Recommended fix**: Extract `CopyButton` component with `onCopy` prop.
- **Risk level**: LOW.

### 12. autoDeckPlanner ↔ autoDeckProducer — Document context builder (13 lines, 101 tokens)
- **Location A**: `utils/prompts/autoDeckPlanner.ts:242–254`
- **Location B**: `utils/prompts/autoDeckProducer.ts:180–192`
- **What it does**: Filters documents by inline content and wraps them in XML-style `<document>` tags for Claude context.
- **Recommended fix**: Extract `buildDocumentContext(documents)` into `utils/prompts/promptUtils.ts`.
- **Risk level**: LOW.

### 13. ChatPanel.tsx — Second copy button variant (13 lines, 215 tokens)
- **Location A**: `components/ChatPanel.tsx:544–556`
- **Location B**: `components/ChatPanel.tsx:456–468`
- **What it does**: Third instance of the copy-to-clipboard button pattern (for different message types).
- **Recommended fix**: Same `CopyButton` extraction as #11.
- **Risk level**: LOW.

### 14. CardsPanel ↔ InsightsCardList — Card selection props (12 lines, 164 tokens)
- **Location A**: `components/CardsPanel.tsx:15–26`
- **Location B**: `components/InsightsCardList.tsx:11–22`
- **What it does**: Defines identical card selection and interaction callback signatures in component props interfaces.
- **Recommended fix**: Extract shared `CardSelectionHandlers` interface into `types.ts`.
- **Risk level**: LOW.

### 15. ai.ts — Retryable error detection (11 lines, 166 tokens)
- **Location A**: `utils/ai.ts:205–215`
- **Location B**: `utils/ai.ts:166–175`
- **What it does**: Checks HTTP status codes (429, 500, 503, 529) and error message patterns to determine if an API error is retryable.
- **Recommended fix**: Extract `isRetryableError(error)` function.
- **Risk level**: LOW.

---

## Duplication Hotspot Files (Top 10)

Files that appear most frequently in duplicate pairs — highest-value refactoring targets:

| # | File | Clone Appearances | Dup Lines | Assessment |
|---|------|------------------|-----------|-----------|
| 1 | **`hooks/useAutoDeck.ts`** | 19 | ~145 intra + 8 cross | The worst offender by far. The plan/revise/produce flows share ~80% identical Claude API call patterns. A single `callClaudeWithDocs()` helper would eliminate most of this. |
| 2 | **`components/InsightsCardList.tsx`** | 10 | ~45 | Repeated dialog patterns, icon buttons, and card action menus. Would benefit from shared dialog and button components. |
| 3 | **`components/workbench/RectangleEditor.tsx`** | 9 | ~111 (cross) | Nearly identical to PinEditor. These should be a single parameterized component. |
| 4 | **`components/workbench/AnnotationToolbar.tsx`** | 7 | ~22 intra + ~16 cross | Repeated tool button patterns. Extract a `ToolButton` component. |
| 5 | **`utils/prompts/pwcGeneration.ts`** | 6 | ~46 cross | Shares prompt-building patterns with contentGeneration, coverGeneration, and promptUtils. Extract shared prompt utilities. |
| 5 | **`components/workbench/PinEditor.tsx`** | 6 | ~111 (cross) | The other half of the PinEditor/RectangleEditor duplication. |
| 5 | **`utils/fileProcessing.ts`** | 6 | ~30 intra | Repeated Gemini response extraction patterns. |
| 5 | **`components/PdfBookmarkEditor.tsx`** | 6 | ~24 intra | Repeated bookmark editing UI patterns. |
| 5 | **`components/ChatPanel.tsx`** | 6 | ~35 intra | Three instances of copy-to-clipboard button. |
| 10 | **`components/StyleStudioModal.tsx`** | 5 | ~22 | Repeated style preview rendering. |

---

## Duplication by Category

### Component JSX Duplication — 32 clones (296 duplicated lines)

| Pattern | Clones | Files | Extraction Target |
|---------|--------|-------|-------------------|
| PinEditor ↔ RectangleEditor (entire component) | 6 | 2 | `AnnotationEditorPopover` component |
| NuggetCreation ↔ ProjectCreation modal chrome | 2 | 2 | `CreationModalBase` component |
| Delete confirmation dialogs | 2 | 1 | `ConfirmDeleteDialog` component |
| Copy-to-clipboard button | 3 | 1 | `CopyButton` component |
| Tool button patterns in toolbar | 3 | 1 | `ToolButton` component |
| Card selection props interface | 1 | 2 | `CardSelectionHandlers` type |
| Style preview rendering | 2 | 2 | Shared style preview component |
| Zoom overlay button patterns | 2 | 1 | Parameterized zoom controls |
| Dialog backdrop/container | 1 | 1 | Already have `Dialogs.tsx`, consolidate |
| SVG icon markup (various) | ~10 | 5 | Icon component library or inline SVG constants |

### Logic Duplication — 27 clones (315 duplicated lines)

| Pattern | Clones | Files | Extraction Target |
|---------|--------|-------|-------------------|
| Claude API call with Files API docs | 3 | 1 (useAutoDeck) | `callClaudeWithFileApiDocs()` utility |
| Claude API document block creation | 1 | 2 (useAutoDeck, useCardGeneration) | `createDocumentBlocks()` utility |
| Heading parsing from DOM | 2 | 1 (useDocumentEditing) | `parseHeadingsFromEditor()` utility |
| Retryable error detection | 1 | 1 (ai.ts) | `isRetryableError()` utility |
| Gemini usage metadata recording | 1 | 1 (modificationEngine) | `recordGeminiImageUsage()` utility |
| Token usage recording pattern | 6 | 1 (useAutoDeck) | Unified `recordApiUsage()` helper |
| Plan/revise state updates | 5 | 1 (useAutoDeck) | State machine or reducer pattern |
| Migration code blocks | 1 | 1 (StorageProvider) | Versioned migration runner |

### API Call Duplication — 3 clones (69 lines)

| Pattern | Clones | Files | Extraction Target |
|---------|--------|-------|-------------------|
| Claude call + file injection + usage recording | 3 | useAutoDeck | `callClaudeWithDocs()` in `utils/ai.ts` |
| Gemini response text extraction | 3 | fileProcessing | `extractGeminiText(response)` utility |

### Style Duplication — Minimal

No significant CSS/style duplication detected. Inline styles vary enough to not trigger token thresholds.

### Utility Duplication — 6 clones (83 lines)

| Pattern | Clones | Files | Extraction Target |
|---------|--------|-------|-------------------|
| Aspect ratio → description | 1 | 2 (contentGen, pwcGen) | `getCanvasDescription()` in promptUtils |
| Document context XML wrapping | 1 | 2 (autoDeckPlanner, autoDeckProducer) | `buildDocumentContext()` in promptUtils |
| Bookmark tree operations | 1 | 1 (pdfBookmarks) | Consolidate promote/demote logic |
| IndexedDB transaction pattern | 1 | 2 (pdfBookmarks, IndexedDBBackend) | Shared `withTransaction()` wrapper |

---

## High-Value Refactoring Targets (Priority Order)

| Priority | Target | Clones Eliminated | Lines Saved | Effort |
|----------|--------|-------------------|-------------|--------|
| **1** | Merge PinEditor + RectangleEditor → `AnnotationEditorPopover` | 6 | ~111 | Low |
| **2** | Extract `callClaudeWithFileApiDocs()` from useAutoDeck | 3+ | ~80 | Medium |
| **3** | Extract `CreationModalBase` from Nugget/Project creation modals | 2 | ~50 | Low |
| **4** | Extract `CopyButton` component from ChatPanel | 3 | ~35 | Low |
| **5** | Extract `getCanvasDescription()` + `buildDocumentContext()` | 2 | ~29 | Low |
| **6** | Extract `parseHeadingsFromEditor()` utility | 2 | ~20 | Low |
| **7** | Consolidate useAutoDeck plan/revise/produce state updates | ~8 | ~100+ | High |
| **8** | Extract `ConfirmDeleteDialog` component | 2 | ~18 | Low |
| **9** | Extract `recordGeminiImageUsage()` utility | 1 | ~21 | Low |
| **10** | Extract `isRetryableError()` utility | 1 | ~11 | Low |

---

## Overall Assessment

The codebase has a **healthy overall duplication rate of 3.04%**, which is below the 5% industry threshold for "good." However, duplication is highly concentrated:

- **`hooks/useAutoDeck.ts`** alone accounts for 19 of 62 clones (31%) — the plan, revise, and produce flows are essentially the same Claude API call pattern copied three times.
- **`PinEditor.tsx` and `RectangleEditor.tsx`** are ~90% identical and should be a single component.
- **41 of 62 clones (66%) are intra-file**, suggesting copy-paste within individual files during development rather than missing shared abstractions across modules.

The top 3 extractions (AnnotationEditorPopover, callClaudeWithFileApiDocs, CreationModalBase) would eliminate ~240 duplicated lines and reduce the duplication rate to approximately **1.9%**.
