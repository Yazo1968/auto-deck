# Phase 0 — Baseline Report

**Project**: InfoNugget v6.0
**Date**: 2026-02-24
**Auditor**: Claude Code (Opus 4.6)

---

## 1. Full Build (`npm run build`)

**Result**: SUCCESS (built in 5.68s)

**Build Tool**: Vite 6.4.1

**Output Artifacts**:

| File | Size | Gzip |
|------|------|------|
| `dist/index.html` | 14.44 kB | 3.38 kB |
| `dist/assets/pdf.worker.min-wgc6bjNh.mjs` | 1,078.61 kB | — |
| `dist/assets/index-BZSGYnTO.js` | 2,002.54 kB | 592.44 kB |

**Warnings (1)**:

1. **Chunk size warning**: `assets/index-BZSGYnTO.js` exceeds 500 kB after minification (2,002.54 kB). Vite recommends:
   - Using dynamic `import()` to code-split
   - Using `build.rollupOptions.output.manualChunks`
   - Adjusting `build.chunkSizeWarningLimit`

---

## 2. Dev Server (`npm run dev`)

**Result**: SUCCESS (ready in ~500ms)

The dev server started without errors. No console warnings or errors reported at startup.

Note: Ports 3000–3002 were in use; server bound to port 3003.

---

## 3. Tests (`npm test`)

**Result**: NO TEST FRAMEWORK CONFIGURED

```
npm error Missing script: "test"
```

- No `test` script in `package.json`
- No test framework (Jest, Vitest, etc.) is installed
- **Total tests**: 0
- **Pass/Fail/Skip**: N/A

---

## 4. TypeScript Type-Check (`npx tsc --noEmit`)

**Result**: 2 errors (both known pre-existing, per CLAUDE.md)

| # | File | Line | Error | Description |
|---|------|------|-------|-------------|
| 1 | `components/AutoDeckPanel.tsx` | 235 | TS2339 | `.length` does not exist on type `string \| number \| true` |
| 2 | `components/AutoDeckPanel.tsx` | 254 | TS2322 | Type `boolean` not assignable to `string \| number \| readonly string[]` |

Both errors are documented as known pre-existing issues in CLAUDE.md.

---

## 5. Codebase Metrics

### File Counts

| Category | Count |
|----------|-------|
| Total `.ts/.tsx/.js/.jsx` files (excl. `node_modules`, `dist`, `.bak`) | **69** |
| Component files (`components/` + subdirs) | **29** |
| Hook files (`hooks/useXxx`) | **9** |
| Utility/helper files (`utils/` + subdirs) | **26** |
| Root/context/config files | **5** |

### Total Lines of Code

**27,434 lines** across 69 source files

### Component Files (29)

**`components/` root (26):**
- AssetsPanel.tsx
- AutoDeckPanel.tsx
- CardsPanel.tsx
- ChatPanel.tsx
- Dialogs.tsx
- DocumentEditorModal.tsx
- FindReplaceBar.tsx
- FormatToolbar.tsx
- InsightsCardList.tsx
- LandingPage.tsx
- LoadingScreen.tsx
- NuggetCreationModal.tsx
- PanelRequirements.tsx
- PdfBookmarkEditor.tsx
- PdfUploadChoiceDialog.tsx
- PdfViewer.tsx
- ProjectCreationModal.tsx
- ProjectsPanel.tsx
- SourcesPanel.tsx
- StorageProvider.tsx
- StyleStudioModal.tsx
- SubjectEditModal.tsx
- ToastNotification.tsx
- ZoomOverlay.tsx

**`components/workbench/` (3):**
- AnnotationToolbar.tsx
- AnnotationWorkbench.tsx
- CanvasRenderer.ts
- PinEditor.tsx
- RectangleEditor.tsx

### Hook Files (9)

- useAnnotations.ts
- useAutoDeck.ts
- useCardGeneration.ts
- useDocumentEditing.ts
- useDocumentFindReplace.ts
- useInsightsLab.ts
- usePersistence.ts
- useTokenUsage.ts
- useVersionHistory.ts

### Utility Files (26)

**`utils/` root (12):**
- ai.ts
- documentHash.ts
- fileProcessing.ts
- formatTime.ts
- markdown.ts
- modificationEngine.ts
- pdfBookmarks.ts
- subjectGeneration.ts
- tokenEstimation.ts

**`utils/prompts/` (9):**
- autoDeckPlanner.ts
- autoDeckProducer.ts
- contentGeneration.ts
- coverGeneration.ts
- documentConversion.ts
- imageGeneration.ts
- insightsLab.ts
- promptUtils.ts
- pwcGeneration.ts

**`utils/storage/` (3):**
- IndexedDBBackend.ts
- StorageBackend.ts
- serialize.ts

**`utils/autoDeck/` (2):**
- autoDeckConstants.ts
- autoDeckParser.ts

---

## 6. Dependencies

### Production Dependencies (6)

| Package | package.json | Installed |
|---------|-------------|-----------|
| `@google/genai` | ^1.41.0 | 1.41.0 |
| `marked` | 15.0.7 | 15.0.7 |
| `pdf-lib` | ^1.17.1 | 1.17.1 |
| `pdfjs-dist` | ^5.4.624 | 5.4.624 |
| `react` | ^19.2.4 | 19.2.4 |
| `react-dom` | ^19.2.4 | 19.2.4 |

### Dev Dependencies (5)

| Package | package.json | Installed |
|---------|-------------|-----------|
| `@types/node` | ^22.14.0 | 22.19.10 |
| `@vitejs/plugin-react` | ^5.0.0 | 5.1.3 |
| `knip` | ^5.85.0 | 5.85.0 |
| `typescript` | ~5.8.2 | 5.8.3 |
| `vite` | ^6.2.0 | 6.4.1 |

---

## 7. Environment

| Item | Value |
|------|-------|
| **Node.js** | v22.16.0 |
| **npm** | 10.9.2 |
| **OS** | Windows 11 Home 10.0.26200 |
| **Build tool** | Vite 6.4.1 |
| **TypeScript** | 5.8.3 |

---

## Summary

| Check | Status |
|-------|--------|
| Build (`npm run build`) | PASS (1 warning: chunk size) |
| Dev server (`npm run dev`) | PASS (no errors) |
| Tests (`npm test`) | N/A (no test framework) |
| TypeScript (`tsc --noEmit`) | 2 known pre-existing errors |
| Total source files | 69 |
| Total lines of code | 27,434 |
| Production dependencies | 6 |
| Dev dependencies | 5 |
