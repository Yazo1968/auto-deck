# Phase 5 — Performance Audit

**Project**: InfoNugget v6.0
**Date**: 2026-02-24
**Auditor**: Claude Code (Opus 4.6)
**Tools**: rollup-plugin-visualizer, manual code analysis
**Mode**: READ-ONLY (no source files modified)

---

## Bundle Analysis

### Build Output

| Asset | Size | Gzip |
|-------|------|------|
| `assets/index-BZSGYnTO.js` | **2,002.54 KB** | **592.44 KB** |
| `assets/pdf.worker.min-wgc6bjNh.mjs` | 1,078.61 KB | — |
| `index.html` | 14.44 KB | 3.38 KB |

**Total JavaScript**: 3,081 KB raw / ~592 KB gzip (main chunk only)

Vite emits the warning: *"Some chunks are larger than 500 kB after minification."*

### Top Dependencies by Bundle Weight

| Dependency | Estimated Size | % of Main Chunk |
|------------|---------------|-----------------|
| `pdfjs-dist` (viewer core) | ~769 KB | 38.4% |
| `pdf-lib` (PDF generation) | ~711 KB | 35.5% |
| `@google/genai` (Gemini SDK) | ~614 KB | 30.7% |
| `marked` (Markdown parser) | ~42 KB | 2.1% |
| `react` + `react-dom` | ~140 KB | 7.0% |
| App source code | ~326 KB | 16.3% |

**PDF-related packages account for ~43.8%** of the main bundle (pdfjs-dist + pdf-lib = ~1,480 KB raw). These are prime candidates for code splitting since PDF functionality isn't needed on initial load.

### Code Splitting Status

| Metric | Value |
|--------|-------|
| Total JS chunks | **1** (+ 1 worker) |
| Dynamic `import()` statements | **0** (functional) |
| `React.lazy()` usage | **0** |
| Route-based splitting | **None** (SPA, no router) |
| Manual chunks config | **None** |

**Assessment**: CRITICAL — The entire application ships as a single 2 MB JavaScript bundle. No code splitting of any kind is implemented. Every user downloads all code (PDF viewer, Gemini SDK, annotation workbench, etc.) regardless of which features they use.

### External CDN Resources (index.html)

| Resource | Type | Impact |
|----------|------|--------|
| `cdn.tailwindcss.com` | **Render-blocking script** | JIT compiler runs at runtime |
| Google Fonts (3 families) | Stylesheet + fonts | 11 font files (~300 KB total) |
| `esm.sh` importmap | Module map (dev only) | Overridden by Vite in production |

---

## Rendering Issues (Ordered by Impact)

### 1. CRITICAL — Zero React.memo Usage

| Metric | Value |
|--------|-------|
| Components in codebase | ~28 |
| Components wrapped in `React.memo` | **0** |

**Impact**: Every state change in a parent component triggers a full re-render of all child components, regardless of whether their props changed. In a deeply nested 6-panel layout where App.tsx passes ~120 props to child panels, this creates cascading re-render storms.

**Worst offenders** (most props received, re-render on any parent state change):
- `InsightsCardList` — receives card arrays, selection state, generation callbacks
- `CardsPanel` — receives full card editing state
- `SourcesPanel` — receives document state, PDF viewer callbacks, TOC editing state
- `ChatPanel` — receives chat history, message callbacks, document state
- `AutoDeckPanel` — receives deck state, briefing, production callbacks

### 2. CRITICAL — Monolithic Context Defeats useMemo

`context/AppContext.tsx` provides a single context with **58 members** (13 useState + 3 derived values + ~42 functions). The context value is wrapped in `useMemo`, but its dependency array includes frequently-changing state:

```
Dependencies include: projects, cards, selectedProjectId, selectedNuggetId,
selectedDocumentId, activeCardId, uploadedFiles, insightsSession, ...
```

**Impact**: Any state change in any of the 13 useState hooks invalidates the entire context `useMemo`, causing **every consumer** of `AppContext` to re-render. Since all major components consume this context, a single `setSelectedCardId()` call triggers re-renders across all 6 panels.

### 3. HIGH — Cascading Re-render Chains

A single user action (e.g., selecting a nugget) triggers a cascade of state updates:

1. `setSelectedNuggetId()` → context re-render
2. `useEffect` derives `selectedNugget` → may trigger `setSelectedDocumentId()`
3. Document change → `useEffect` in `usePersistence` triggers save
4. `insightsSession` shim `useEffect` dual-writes cards/files → more state updates
5. Each state update invalidates context `useMemo` → full tree re-render

**Estimated re-render waves per nugget selection**: 4–7 consecutive renders before settling.

### 4. HIGH — Inline Arrow Functions in JSX

| Location | useCallback count | Inline arrows in JSX |
|----------|------------------|---------------------|
| `App.tsx` | 53 | **12+** remaining |
| Other components | 126 | Varies |

Despite extensive `useCallback` usage (179 total across 25 files), App.tsx still has **12+ inline arrow functions** in JSX event handlers (e.g., `onClick={() => setBreadcrumbDropdown(...)}`). These create new function references on every render, defeating any memoization on child components (though since no `React.memo` is used, this is currently moot).

### 5. MEDIUM — useMemo Coverage Gaps

| File | useMemo Count | Assessment |
|------|--------------|------------|
| `App.tsx` | 8 | Good for computed values, but some derived arrays unmemoized |
| `context/AppContext.tsx` | 5 | Context value memoized but defeated by broad deps |
| `hooks/useCardGeneration.ts` | 5 | Good coverage for generation state |
| `hooks/useInsightsLab.ts` | 1 | Minimal — `pendingDocChanges` only |
| Other (4 files) | 4 | Spotty |
| **Total** | **23** | |

Notable unmemoized derived values:
- `insightsSession?.cards || []` in App.tsx — creates a new empty array on every render when no session exists, triggering unnecessary child updates
- Multiple `.filter()` and `.map()` chains in component render bodies

### 6. MEDIUM — No List Virtualization

| Metric | Value |
|--------|-------|
| Virtualization libraries installed | **0** |
| Lists that could grow large | Cards list, document list, chat history, project tree, bookmark tree |

**Impact**: With 50+ cards or 100+ chat messages, the DOM will contain hundreds or thousands of nodes. Without virtualization (`react-window`, `react-virtual`, etc.), all items are rendered to the DOM regardless of visibility, causing:
- Slow initial render
- Laggy scrolling
- Excessive memory consumption

---

## Data Fetching Issues

### 1. HIGH — Tailwind CDN JIT Compiler in Production

```html
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config = { darkMode: 'class' }</script>
```

The Tailwind CSS CDN is loaded as a **synchronous, render-blocking `<script>`** in `index.html`. This means:
- Browser must download the full Tailwind JIT compiler (~100 KB)
- JIT compiler runs on every DOM mutation to generate utility classes
- Blocks first paint until the script is loaded and executed
- In production, this adds measurable latency to every page load
- The JIT compiler observes the DOM for class name changes and generates CSS on-the-fly

**Recommended**: Replace with build-time Tailwind (PostCSS plugin) or extract only the used utility classes at build time.

### 2. MEDIUM — AbortController Coverage

| Hook/Component | AbortController | Assessment |
|---------------|----------------|------------|
| `useAutoDeck.ts` | Yes (3 flows) | Good |
| `useInsightsLab.ts` | Yes (sendMessage) | Good |
| `StyleStudioModal.tsx` | Yes (style gen) | Good |
| `useCardGeneration.ts` | **No** | **Gap** — 3-phase pipeline (content + layout + image) has no cancellation |

**Impact**: The card generation pipeline makes 3 sequential AI API calls. If the user navigates away or starts a new generation, the old requests continue to completion, wasting API tokens and potentially causing race conditions when results arrive.

### 3. MEDIUM — No Request Deduplication

No deduplication or caching layer exists for AI API calls. If a user triggers the same content generation twice (e.g., by double-clicking), two full API call chains execute independently. No `swr`, `react-query`, or custom deduplication logic is present.

### 4. LOW — Blob URL Memory Leak Potential

Several components create Blob URLs via `URL.createObjectURL()` for PDF rendering and image display. While some cleanup exists, there is no systematic `URL.revokeObjectURL()` guarantee on unmount across all components.

---

## CSS / Styling Performance

### 1. HIGH — Tailwind CDN Runtime Overhead

As noted in Data Fetching §1, the Tailwind CDN JIT compiler:
- Adds ~100 KB to initial download
- Runs a MutationObserver on the entire DOM
- Generates CSS rules dynamically on every class name change
- Competes with React's own DOM reconciliation

This is the **single largest quick-win performance improvement** available. Migrating to build-time Tailwind would eliminate the runtime compiler entirely.

### 2. MEDIUM — Inline Styles Prevalence

| Metric | Value |
|--------|-------|
| Files using inline `style={}` | ~25 of 28 components |
| Estimated inline style attributes | **231+** |

The codebase uses a hybrid approach: Tailwind utility classes for layout/spacing and inline `style={}` objects for dynamic values (colors, dimensions, conditional styling). This means:
- React creates new style objects on every render (unless explicitly memoized)
- No CSS class caching benefit for frequently-used patterns
- Inline styles cannot be optimized by the browser's CSSOM caching

### 3. MEDIUM — Font Loading Weight

```html
<link href="https://fonts.googleapis.com/css2?
  family=Inter:wght@300;400;500;600;700;800
  &family=JetBrains+Mono:wght@400;500
  &family=Libre+Baskerville:ital,wght@0,400;0,700;1,400
  &display=swap" rel="stylesheet">
```

| Font Family | Weights/Variants | Estimated Files |
|-------------|-----------------|-----------------|
| Inter | 6 weights (300–800) | 6 files |
| JetBrains Mono | 2 weights (400, 500) | 2 files |
| Libre Baskerville | 3 variants (regular, bold, italic) | 3 files |
| **Total** | **11 variants** | **~11 font files** |

**Impact**: 11 font files (~25–35 KB each) = ~300 KB total. The `display=swap` and `preconnect` hints are correctly applied, but the sheer number of weights could be reduced. Inter weights 300 and 800 may be sparingly used.

### 4. LOW — CSS Custom Properties (Positive)

The codebase correctly uses CSS custom properties (`--acid-h1`, `--tree-active`, etc.) defined in `index.html` with light/dark variants. This is efficient — the browser only recalculates affected elements when custom properties change, rather than re-evaluating all style rules.

### 5. LOW — index.html Inline Styles (~366 lines)

The `<style>` block in `index.html` contains ~353 lines of CSS for document prose, chat prose, PDF text layer, tree highlights, and glassmorphism effects. While this is render-blocking, it's a reasonable size and avoids an extra network request for a separate CSS file.

---

## Optimization Opportunities (Priority Order)

### Tier 1 — Critical (High Impact, Achievable)

| # | Optimization | Impact | Effort | Lines Affected |
|---|-------------|--------|--------|----------------|
| 1 | **Replace Tailwind CDN with build-time** | Eliminates ~100 KB download + runtime JIT compiler. Faster FCP, no MutationObserver overhead. | Medium | `index.html`, `vite.config.ts`, new `tailwind.config.ts`, `postcss.config.js` |
| 2 | **Code-split PDF libraries** | Move `pdfjs-dist` (769 KB) + `pdf-lib` (711 KB) to dynamic `import()`. Reduces initial bundle by ~1,480 KB (74%). | Medium | `components/SourcesPanel.tsx`, `components/PdfViewer.tsx`, `utils/fileProcessing.ts` |
| 3 | **Code-split Gemini SDK** | Move `@google/genai` (614 KB) to dynamic `import()`. Only loaded when AI features are used. | Low | `utils/ai.ts` |

**Combined Tier 1 impact**: Initial bundle reduced from 2,002 KB → ~200–400 KB. Time-to-interactive improved by 3–5× on slow connections.

### Tier 2 — High (Significant Impact)

| # | Optimization | Impact | Effort | Notes |
|---|-------------|--------|--------|-------|
| 4 | **Split AppContext into focused contexts** | Eliminates cascading re-renders. Only affected panels re-render on state changes. | High | Split into ProjectContext, DocumentContext, CardContext, UIContext |
| 5 | **Add React.memo to all panel components** | Prevents re-renders when parent state changes don't affect a panel's props. | Low | Wrap all 6 panel components + InsightsCardList in `React.memo` |
| 6 | **Add AbortController to useCardGeneration** | Prevents wasted API calls and race conditions in 3-phase pipeline. | Low | `hooks/useCardGeneration.ts` |
| 7 | **Memoize derived arrays** | Prevent new array creation on every render (e.g., `insightsSession?.cards || []`). | Low | `App.tsx`, various components |

### Tier 3 — Medium (Incremental Improvements)

| # | Optimization | Impact | Effort | Notes |
|---|-------------|--------|--------|-------|
| 8 | **Add list virtualization** | Smooth scrolling with 100+ cards/messages. Reduces DOM node count. | Medium | Add `react-window` or `@tanstack/virtual` |
| 9 | **Reduce font weights** | Reduce font download by ~50 KB if weights 300, 800 are sparingly used. | Low | Audit usage, trim `index.html` font link |
| 10 | **Replace inline style objects with static references** | Prevent new object creation per render for frequently-used static styles. | Medium | Extract `const styles = { ... }` outside components |
| 11 | **Add request deduplication** | Prevent duplicate AI API calls from double-clicks. | Low | Debounce or flag-based guard in generation hooks |
| 12 | **Systematic Blob URL cleanup** | Prevent memory leaks from unreleased object URLs. | Low | Add `useEffect` cleanup in PDF/image components |

### Tier 4 — Low Priority (Nice to Have)

| # | Optimization | Impact | Effort | Notes |
|---|-------------|--------|--------|-------|
| 13 | **Remove esm.sh importmap** | Clean up unused CDN references in index.html (overridden by Vite). | Trivial | `index.html` lines 367–378 |
| 14 | **Preload critical chunks** | Add `<link rel="modulepreload">` for main chunk after code splitting. | Low | `index.html` or Vite config |
| 15 | **Web Worker for markdown parsing** | Move `marked` parsing off main thread for large documents. | Medium | New worker file + message bridge |

---

## Performance Metrics Summary

| Category | Score | Key Finding |
|----------|-------|-------------|
| **Bundle Size** | POOR | 2,002 KB single chunk, no code splitting |
| **Code Splitting** | POOR | 0 dynamic imports, 0 lazy components |
| **React Rendering** | POOR | 0 React.memo, monolithic context, cascading re-renders |
| **Memoization** | FAIR | 23 useMemo + 179 useCallback, but gaps remain |
| **Request Management** | FAIR | AbortController in 3/4 major hooks, no dedup |
| **CSS Strategy** | POOR | Tailwind CDN JIT in production |
| **Font Loading** | FAIR | display=swap + preconnect, but 11 font variants |
| **Virtualization** | POOR | None for any list |

### Overall Performance Grade: **D+**

The application's performance is significantly hampered by three compounding issues: a 2 MB monolithic bundle with zero code splitting, a Tailwind CDN JIT compiler running in production, and a single React context that triggers full-tree re-renders on any state change. The extensive `useCallback` usage (179 instances) shows awareness of memoization but is undermined by the absence of `React.memo` on any component.

**Estimated improvement from Tier 1 + Tier 2 fixes**: Initial load time reduced by **60–75%**, interaction responsiveness improved by **40–60%**.
