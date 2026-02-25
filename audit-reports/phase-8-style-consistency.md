# Phase 8 — Code Style & Consistency Audit

**Project**: InfoNugget v6.0
**Date**: 2026-02-24
**Auditor**: Claude Code (Opus 4.6)
**Tools**: Prettier 3.x (check mode), manual code analysis
**Mode**: READ-ONLY (no source files modified, no auto-formatting applied)

---

## Formatting

### Prettier Check Results

| Metric | Value |
|--------|-------|
| **Files with formatting inconsistencies** | **70 out of ~70** (source files) |
| **Total Prettier warnings** | 74 (70 source + 4 audit-report JSON files) |
| **Files that pass Prettier** | **0** |

**Assessment**: **INCONSISTENT** — Every single source file in the project would be reformatted by Prettier. Since 100% of files fail, this indicates the project has never had Prettier configured, not that individual files are inconsistently formatted.

The formatting is actually **internally consistent** — the codebase follows its own patterns (single quotes, semicolons, 2-space indent) reliably. The Prettier failures stem from:
- Line length differences (Prettier defaults to 80 chars; this codebase allows longer lines)
- JSX formatting preferences (multi-line props, trailing commas, parenthesization)
- Object/array formatting choices

**Recommendation**: If Prettier were adopted, configure it with `printWidth: 120`, `singleQuote: true`, `semi: true`, `tabWidth: 2` to match existing conventions and minimize the diff.

### Core Formatting Conventions (Self-Consistent)

| Convention | CLAUDE.md Rule | Actual Practice | Compliance |
|-----------|---------------|-----------------|------------|
| Semicolons | Yes | Yes — every statement ends with `;` | ✅ 100% |
| Quotes | Single | Single quotes used throughout | ✅ 100% |
| Indentation | 2 spaces | 2-space indent everywhere | ✅ 100% |
| Trailing commas | Not specified | Trailing commas in multi-line arrays/objects (ES5 style) | Consistent |
| Line endings | Not specified | LF (Unix-style) | Consistent |

---

## Naming Conventions

### Component Naming

| Metric | Count | Compliance |
|--------|-------|------------|
| Total React components | 33 (primary exports) |
| PascalCase components | **33** | ✅ **100%** |
| Non-PascalCase components | **0** | — |
| Component name matches filename | **28** | 85% |
| Props interface follows `{Name}Props` | **32/32** (with props) | ✅ **100%** |

**Filename-to-component mismatches** (5):

| File | Exported Component(s) | Issue |
|------|----------------------|-------|
| `Dialogs.tsx` | `ManifestModal`, `UnsavedChangesDialog`, `DocumentChangeNotice`, `ReferenceMismatchDialog` | Multi-component barrel file — filename is a category, not a component |
| `ToastNotification.tsx` | `ToastProvider` | Primary export doesn't match filename |
| `AppContext.tsx` | `AppProvider`, `useAppContext` | Primary exports don't match "AppContext" |

### Function Naming

| Metric | Value |
|--------|-------|
| Total functions | ~180 |
| camelCase functions | **~180 (100%)** |
| Non-camelCase functions | **0** |

**Verb prefix inventory** (top 10):

| Prefix | Count | Examples |
|--------|-------|---------|
| `handle` | 166 | `handleSave`, `handleDelete`, `handleDragStart` |
| `build` | 18 | `buildContentPrompt`, `buildPlannerPrompt` |
| `serialize` / `deserialize` | 12 | `serializeCard`, `deserializeNugget` |
| `on` | 14 | `onMove`, `onUp`, `onKeyDown` |
| `parse` | 4 | `parsePlannerResponse`, `parseFinalizerResponse` |
| `extract` | 4 | `extractImages`, `extractBookmarksFromPdf` |
| `render` | 4 | `renderRedlinePin`, `renderRedlineRectangle` |
| `format` | 3 | `formatTokens`, `formatCost` |
| `generate` | 3 | `generateRedlineMap`, `generateSubject` |
| `is` / `has` / `can` | 6 | `isNameTaken`, `hasChanges`, `canModify` |

**Deviation**: `handle` vs `on` prefix split — 166 `handle*` vs 14 `on*` for event handlers. Both serve the same purpose. The `on*` usage is concentrated in resize drag handlers (`onMove`, `onUp`) and a few `onKeyDown`/`onClick` instances in `App.tsx`.

**Deviation**: Two naming patterns for conversions: `xToY` (`dataUrlToBlob`, `blobToDataUrl`) vs `convertX` (`convertPdfWithGemini`).

### Variable Naming

#### Single-Letter Variables Outside Loops

**46 instances** found across 15 files:

| Letter | Count | Typical Meaning | Worst Offenders |
|--------|-------|-----------------|-----------------|
| `r` | 11 | rect, ratio, radius | `CanvasRenderer.ts` (4), `AnnotationWorkbench.tsx` (3) |
| `s` | 7 | scale, start | `CanvasRenderer.ts` (3), `AnnotationWorkbench.tsx` (3) |
| `t` | 5 | setTimeout handle | `AutoDeckPanel.tsx`, `ChatPanel.tsx`, `SourcesPanel.tsx`, `LandingPage.tsx` |
| `v` | 5 | input value | `AutoDeckPanel.tsx` (3), `StyleStudioModal.tsx` (2) |
| `n` | 4 | number, nugget | `AutoDeckPanel.tsx` (2), `App.tsx`, `pdfBookmarks.ts` |
| `a` | 3 | anchor, annotation | `App.tsx`, `ProjectsPanel.tsx`, `CanvasRenderer.ts` |
| `d` | 2 | Date object | `formatTime.ts`, `ChatPanel.tsx` |
| `p`, `e` | 2 each | point, end | `redline.ts` |
| `q`, `h`, `c`, `g`, `b` | 1 each | query, heading, clamp, green, blue | Various |

**Most concentrated files**: `CanvasRenderer.ts` (7), `AnnotationWorkbench.tsx` (5), `AutoDeckPanel.tsx` (5).

Note: `r`, `g`, `b` in `promptUtils.ts:339-341` for RGB color channels is an acceptable domain convention.

#### Boolean Variable Prefixes

| Pattern | Count | Examples |
|---------|-------|---------|
| `is*` prefixed | ~75 | `isActive`, `isSelected`, `isDragging`, `isGenerating` |
| `has*` prefixed | ~18 | `hasImage`, `hasChildren`, `hasChanges` |
| `can*` prefixed | ~10 | `canModify`, `canPromote`, `canCreate` |
| `should*` prefixed | ~3 | In logic expressions |
| **Total prefixed** | **~111** | |
| **Unprefixed** | **1** | `disabled` in `FormatToolbar.tsx:21` |

**Compliance**: ~99% — Only 1 unprefixed boolean (`disabled`, should be `isDisabled`).

#### Unclear Abbreviations

| Abbreviation | File | Acceptable? |
|-------------|------|-------------|
| `fmt` | `redline.ts:241` | **NO** — should be `formatNumber` |
| `cel` | `InsightsCardList.tsx`, `DocumentEditorModal.tsx` | **NO** — unclear, means "cell element" |
| `ns` | `ZoomOverlay.tsx`, `AnnotationWorkbench.tsx` | **NO** — unclear, means "new scale" |
| `ke` | `AnnotationWorkbench.tsx:191` | **NO** — unclear, means "keyboard event" |
| `doc`, `idx`, `el`, `msg`, `ctx`, `ref`, `prev`, `ev` | Various | YES — standard JS/React conventions |

#### UPPER_SNAKE_CASE Constants

| Scope | Count | Compliance |
|-------|-------|------------|
| Module-level constants | **~84** | ✅ All correctly UPPER_SNAKE_CASE |
| Function-scoped constants | **~14** | Mixed — some could be hoisted to module scope |
| Constants that should be UPPER_SNAKE_CASE but aren't | **0** | ✅ Clean |

### File Naming

| Convention | Count | Purpose |
|-----------|-------|---------|
| PascalCase | 33 files | React components, context, class/interface files |
| camelCase | 33 files | Hooks, utilities, prompts, root files |
| kebab-case | 0 files | None (config files follow tool conventions) |

**Inconsistencies** (3):

1. **`utils/storage/IndexedDBBackend.ts`** — PascalCase in `utils/` directory (contains a class export)
2. **`utils/storage/StorageBackend.ts`** — PascalCase in `utils/` directory (contains only interfaces, should be camelCase)
3. **`components/workbench/CanvasRenderer.ts`** — `.ts` non-component file in `components/` directory (contains pure canvas rendering functions, should be in `utils/`)

### CSS / Tailwind Naming

| Convention | Count | Compliance |
|-----------|-------|------------|
| Application CSS classes (kebab-case) | 17 | ✅ **100%** |
| CSS custom properties (`--kebab-case`) | 14 | ✅ **100%** |
| Library CSS classes (camelCase, PDF.js) | 3 | N/A (library-mandated) |

**Inconsistency**: 1 dead CSS class — `.glass-toolbar` defined in `index.html:271-278` but never referenced in any source file.

---

## Structural Consistency

### Component Structure Pattern

**Expected**: Imports → Types/Interfaces → Component → Export

| Metric | Value |
|--------|-------|
| Files following the pattern | **~25 of 33** |
| Files with deviations | **8** |

**Deviations**:

| File | Issue |
|------|-------|
| `Dialogs.tsx` | Multi-component barrel file (4 components in one file) |
| `ToastNotification.tsx` | Mixes hook + 2 components in one file |
| `StyleStudioModal.tsx` | 5 helper functions + 3 constants defined above the props interface |
| `CardsPanel.tsx` | `ensureH1()` utility + 3 constants above props interface |
| `ProjectsPanel.tsx` | `formatFileSize()` helper between imports and props interface |
| `InsightsCardList.tsx` | Secondary `InfoContent` component inline within the file |
| `StorageProvider.tsx` | Exported singleton `storage` between imports and component |
| `AssetsPanel.tsx` | `marked` imported before types (minor ordering) |

### Export Style

| Style | Count | Components |
|-------|-------|------------|
| `export default` at EOF | **19** | App, CardsPanel, ChatPanel, SourcesPanel, AssetsPanel, AutoDeckPanel, ProjectsPanel, InsightsCardList, PdfViewer, PdfUploadChoiceDialog, PdfBookmarkEditor, ZoomOverlay, StyleStudioModal, PanelRequirements, DocumentEditorModal, AnnotationWorkbench, AnnotationToolbar, PinEditor, RectangleEditor |
| Named `export const` | **14** | LoadingScreen, LandingPage, FormatToolbar, FindReplaceBar, ProjectCreationModal, SubjectEditModal, NuggetCreationModal, StorageProvider, AppProvider, ToastProvider, + 4 Dialogs exports |

**Assessment**: Mixed — CLAUDE.md specifies "default export" but only 58% comply. There's an informal pattern where larger/panel components use `export default` and smaller/utility components use named exports.

### Import Ordering

**Documented convention** (CLAUDE.md): React → types → utils → components

**Actual pattern**: Generally followed. No blank lines between import groups (internally consistent across all files).

**Deviations** (4):

| File | Issue |
|------|-------|
| `StorageProvider.tsx` | Context imported before utils (reverses expected order) |
| `AnnotationWorkbench.tsx` | Hooks and utils interleaved rather than grouped |
| `subjectGeneration.ts` | Utils file imports a type from a hook file (inverted dependency direction) |
| `AssetsPanel.tsx` | `marked` (library) imported before types |

### Error Handling Patterns

**Total try/catch blocks**: **43** across 16 files

| File | Count | Pattern Used |
|------|-------|-------------|
| `App.tsx` | 16 | Tier 1: toast notification + console.error |
| `hooks/useCardGeneration.ts` | 3 | Tier 1 + graceful degradation (planner fallback) |
| `hooks/useAutoDeck.ts` | 3 | Tier 1: sets session error status |
| `utils/ai.ts` | 3 | Retry system with exponential backoff |
| `utils/pdfBookmarks.ts` | 3 | Tier 3: silent fallback |
| `utils/fileProcessing.ts` | 2 | Tier 1: toast |
| `hooks/useVersionHistory.ts` | 2 | Tier 3: silent (blob URL cleanup) |
| `utils/autoDeck/parsers.ts` | 2 | Tier 2: console.warn fallback |
| `components/PdfViewer.tsx` | 2 | Tier 2: console.warn |
| All others (7 files) | 1 each | Various |

**Three-tier error handling system** (consistently applied):
1. **Tier 1 — User toast**: `console.error()` + `addToast({ type: 'error', ... })` — for critical user-facing failures
2. **Tier 2 — Console warning**: `console.warn()` — for non-critical/fallback scenarios
3. **Tier 3 — Silent**: Empty catch or `/* ignore */` — for known-flaky cleanup operations

**Empty/silent catch blocks**: **4 instances** — All documented with comments, all defensible:
- `useVersionHistory.ts:46,56` — `URL.revokeObjectURL()` cleanup (failure is harmless)
- `useDocumentEditing.ts:209` — `document.queryCommandState()` throws in some browsers
- `pdfBookmarks.ts:28` — Named destination resolution fallback to page 1

**React Error Boundaries**: **0** — Known tech debt documented in CLAUDE.md.

**API retry system** (in `utils/ai.ts`):
- `withRetry()` — exponential backoff with jitter, retries on 429/500/503
- `withGeminiRetry()` — wraps `withRetry` + Gemini key rotation fallback
- Consistently used by `useCardGeneration`, `useInsightsLab`, `useAutoDeck`

---

## Technical Debt Markers

### TODO Comments: **1**

| # | File | Line | Content |
|---|------|------|---------|
| 1 | `utils/modificationEngine.ts` | 17 | `// TODO: Implement multi-turn chat for iterative image editing.` |

This TODO includes a detailed implementation plan (lines 18-27) describing the multi-turn chat architecture, dependencies on the annotation workbench, and rationale for deferring. Well-documented and intentional.

### FIXME Comments: **0**

### HACK Comments: **0**

### XXX Comments: **0**

### Commented-Out Code: **0**

Every `//` comment in the codebase is explanatory text, section headers, or JSDoc documentation. No commented-out executable code was found.

### Dead Code / Stale References

| # | File | Line | Issue |
|---|------|------|-------|
| 1 | `utils/prompts/insightsLab.ts` | 11-12 | `INSIGHTS_SYSTEM_PROMPT` constant marked `@deprecated` — defined but never imported or used as a variable anywhere. Dead code. |
| 2 | `hooks/useInsightsLab.ts` | 17, 46 | JSDoc comments reference `INSIGHTS_SYSTEM_PROMPT` constant, but the actual code now calls `buildInsightsSystemPrompt(subject)` dynamically. Stale documentation. |
| 3 | `index.html` | 271-278 | `.glass-toolbar` CSS class defined but never referenced in any source file. Dead CSS. |
| 4 | `types.ts` | 78-79 | `settings?: StylingOptions` on `Card` interface — marked `@deprecated`, intentionally retained for backward-compat deserialization. Correctly documented tech debt. |

---

## Style Recommendations

### Top 5 Highest-Impact Improvements (by files affected)

#### 1. Adopt Prettier with Project-Specific Config (70 files)

**Impact**: Every source file. Configure `.prettierrc` with:
```json
{
  "singleQuote": true,
  "semi": true,
  "tabWidth": 2,
  "printWidth": 120,
  "trailingComma": "all",
  "arrowParens": "always"
}
```
This matches the existing code style and would only adjust line wrapping and JSX formatting. Adding Prettier to a pre-commit hook prevents future style drift.

#### 2. Standardize Export Style to `export default` (14 files)

**Impact**: 14 component files currently use named `export const`. CLAUDE.md specifies "default export" for components. Converting these 14 files would achieve 100% compliance with the documented convention. The larger/panel components already follow this pattern — it's the smaller utility components that deviate.

**Files to update**: `LoadingScreen.tsx`, `LandingPage.tsx`, `FormatToolbar.tsx`, `FindReplaceBar.tsx`, `ProjectCreationModal.tsx`, `SubjectEditModal.tsx`, `NuggetCreationModal.tsx`, `StorageProvider.tsx`, `Dialogs.tsx` (split into 4 files), `ToastNotification.tsx`

#### 3. Eliminate Single-Letter Variables Outside Loops (15 files, 46 instances)

**Impact**: 15 files. Replace `r` → `rect`/`ratio`/`radius`, `s` → `scale`/`start`, `t` → `timeoutId`, `v` → `inputValue`, `n` → `parsedNumber`, `a` → `anchorElement`. The most concentrated files (`CanvasRenderer.ts` at 7, `AnnotationWorkbench.tsx` at 5) would see the most readability improvement.

#### 4. Unify Event Handler Prefix to `handle*` (5 files, 14 instances)

**Impact**: 5 files. Rename the 14 `on*` event handler functions (concentrated in resize handlers across panel components and `App.tsx`) to `handle*` for consistency with the dominant pattern (166 `handle*` vs 14 `on*`). Example: `onMove` → `handleResizeMove`, `onUp` → `handleResizeEnd`.

#### 5. Add Blank Lines Between Import Groups (all ~60 files)

**Impact**: All files. The current import blocks are single contiguous blocks with no visual separation. Adding blank lines between groups (React → libraries → types → utils → hooks → components) improves scanability at a glance. This could be automated via `eslint-plugin-import`'s `import/order` rule with `newlines-between: 'always'` (currently set to `'never'`).

### Additional Recommendations (Lower Priority)

| # | Recommendation | Files | Impact |
|---|---------------|-------|--------|
| 6 | Rename `ToastNotification.tsx` → `ToastProvider.tsx` | 1 file + importers | Filename-component match |
| 7 | Move `CanvasRenderer.ts` from `components/workbench/` to `utils/workbench/` | 1 file + importers | Correct layer |
| 8 | Rename 4 unclear abbreviations (`fmt`, `cel`, `ns`, `ke`) | 4 files | Readability |
| 9 | Hoist function-scoped constants to module scope where possible | ~5 files | Minor perf + convention |
| 10 | Remove dead code (`INSIGHTS_SYSTEM_PROMPT`, `.glass-toolbar`) | 2 files | Cleanliness |

---

## Overall Assessment

### Scorecard

| Category | Rating | Notes |
|----------|--------|-------|
| **Formatting (self-consistency)** | ✅ Consistent | Single quotes, semicolons, 2-space indent — uniform across all files |
| **Formatting (Prettier)** | ❌ 0% pass | No Prettier config exists — all 70 files would be reformatted |
| **Component naming** | ✅ 100% PascalCase | Zero deviations |
| **Function naming** | ✅ 100% camelCase | Zero deviations |
| **Props interfaces** | ✅ 100% `{Name}Props` | Zero deviations (among components with props) |
| **Boolean prefixes** | ✅ ~99% | 1 unprefixed boolean out of 112 |
| **Constants** | ✅ 100% UPPER_SNAKE_CASE | All 84 module-scope constants comply |
| **File naming** | ✅ 95% | 3 minor deviations (PascalCase utils, non-component in components/) |
| **CSS naming** | ✅ 100% kebab-case | All 17 app classes + 14 custom properties |
| **Export style** | ⚠️ Mixed | 58% `export default` / 42% named — CLAUDE.md says default |
| **Import ordering** | ✅ Mostly consistent | 4 minor deviations from documented order |
| **Error handling** | ✅ Consistent 3-tier | Toast → warn → silent, uniformly applied |
| **Comment quality** | ✅ Excellent | 1 TODO (well-documented), 0 FIXME/HACK/XXX, 0 commented-out code |
| **Single-letter vars** | ⚠️ 46 instances | Concentrated in geometry/canvas code |
| **Dead code** | ⚠️ 3 items | 1 dead constant, 2 stale comments, 1 dead CSS class |

### Summary

The codebase demonstrates **strong internal consistency** in naming conventions, error handling patterns, and structural organization. The naming compliance is near-perfect (100% PascalCase components, 100% camelCase functions, 100% `{Name}Props` interfaces, ~99% boolean prefixes). The primary areas for improvement are:

1. **Adopting Prettier** to standardize formatting (currently self-consistent but no tooling enforces it)
2. **Standardizing export style** to `export default` per CLAUDE.md
3. **Reducing single-letter variables** in geometry/canvas code for better readability
4. **Unifying event handler prefixes** to `handle*` exclusively

The technical debt marker count is remarkably low: just 1 TODO, 0 FIXME/HACK/XXX, and 0 commented-out code — indicating disciplined development practices.
