# InfoNugget v6.0 — Consolidated Code Quality Audit Report

**Project**: InfoNugget v6.0
**Date**: 2026-02-24
**Auditor**: Claude Code (Opus 4.6)
**Mode**: READ-ONLY (Stage A — no source files modified)
**Phases Completed**: 0–8 (Baseline, ESLint, Type Safety, Duplication, Architecture, Performance, Security, Accessibility, Style & Consistency)

---

## Executive Summary

InfoNugget v6.0 is a 27,434-line React + TypeScript client-side SPA with 69 source files, 6 production dependencies, and zero tests. The codebase demonstrates strong naming conventions, clean module dependencies (zero circular imports), disciplined error handling, and minimal technical debt markers. However, it suffers from several compounding structural issues that significantly impact performance, accessibility, type safety, and maintainability.

### Overall Health Score: **4.2 / 10**

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| **Correctness** (type safety, bugs) | 3/10 | 20% | 0.60 |
| **Performance** (bundle, rendering) | 2/10 | 15% | 0.30 |
| **Accessibility** | 1/10 | 15% | 0.15 |
| **Security** | 5/10 | 15% | 0.75 |
| **Architecture** (coupling, complexity) | 4/10 | 15% | 0.60 |
| **Maintainability** (duplication, style) | 6/10 | 10% | 0.60 |
| **Code Quality** (ESLint, dead code) | 5/10 | 10% | 0.50 |
| | | | **3.50** |

*Adjusted to 4.2 to account for the strong fundamentals (zero circular deps, consistent naming, clean error handling, working build) that the weighted formula undervalues.*

### Key Strengths

- ✅ **Zero circular dependencies** — clean acyclic module graph (Phase 4)
- ✅ **Zero orphan files** — every source file is reachable from the entry point (Phase 4)
- ✅ **Near-perfect naming conventions** — 100% PascalCase components, 100% camelCase functions, 100% `{Name}Props` interfaces (Phase 8)
- ✅ **Consistent error handling** — 3-tier system (toast → warn → silent) uniformly applied across 43 try/catch blocks (Phase 8)
- ✅ **Minimal tech debt markers** — 1 TODO, 0 FIXME/HACK/XXX, 0 commented-out code (Phase 8)
- ✅ **No security vulnerabilities in production deps** — all 12 npm audit findings are dev-only (Phase 6)
- ✅ **No eval(), document.write(), or new Function()** usage anywhere (Phase 6)
- ✅ **API keys properly gitignored** — never committed to source control (Phase 6)
- ✅ **Successful build** — Vite produces working output in ~5.7s (Phase 0)

### Critical Weaknesses

- ❌ **Zero tests** — no test framework, no test files, no CI (Phase 0)
- ❌ **Zero TypeScript strict flags** — 411 strict-mode errors hidden, including 9 confirmed bugs and ~140 real null-dereference risks (Phase 2)
- ❌ **Zero code splitting** — 2,002 KB single JavaScript bundle (Phase 5)
- ❌ **Zero React.memo** — every state change triggers full component tree re-render (Phase 5)
- ❌ **Zero ARIA attributes** — entire application opaque to screen readers (~15% WCAG 2.1 AA compliance) (Phase 7)
- ❌ **Zero React Error Boundaries** (Phase 4) — *promoted to Batch 2.12*
- ❌ **7 unsanitized `marked.parse()` → innerHTML/dangerouslySetInnerHTML** locations (XSS risk) (Phase 6)
- ❌ **10 God Components** containing 76.5% of all component code (Phase 4)
- ❌ **Monolithic context** with 58 members causing cascading re-renders (Phase 4/5)

---

## Issue Severity Matrix

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| **Type Safety** | 9 bugs | 3 | 7 | ~60 | **~79** |
| **Null Safety** | — | ~140 | ~50 | — | **~190** |
| **Security** | 0 | 2 | 8 | 12 | **22** |
| **Accessibility** | 38 | — | — | — | **38 critical** |
| **Accessibility** (all) | 38 | 118 | 31 | — | **187** |
| **Performance** | 3 | 4 | 5 | 3 | **15** |
| **Architecture** | 1 | 4 | 5 | 2 | **12** |
| **ESLint Errors** | — | — | — | — | **97** |
| **ESLint Warnings** | — | — | — | — | **1,639** |
| **Duplication** | — | — | — | — | **62 clones** |
| **Style** | — | — | — | — | **~12 deviations** |

### Category Grades

| Category | Grade | Key Finding |
|----------|-------|-------------|
| **Type Safety** | **D** | Zero strict flags. 9 confirmed bugs. 411 strict-mode errors. No runtime validation at API boundaries. |
| **Security** | **C+** | No critical vulns. 7 XSS locations via unsanitized marked output. No CSP. Architecture-inherent key exposure. |
| **Accessibility** | **F** | ~15% WCAG 2.1 AA. Zero ARIA attributes. Zero role attributes. 70+ unlabeled buttons. Zero focus traps. |
| **Performance** | **D+** | 2 MB monolithic bundle. Zero code splitting. Zero React.memo. Tailwind CDN JIT in production. Cascading re-renders. |
| **Architecture** | **C-** | Zero circular deps (excellent). But 10 God Components, monolithic context, ~120 props drilled, 3 layer violations. |
| **Code Quality** | **C+** | 97 ESLint errors (all dead code). 51 complexity violations. 48 stale-closure risks. 46 explicit `any`. |
| **Duplication** | **B+** | 3.04% (good, under 5% threshold). Concentrated in useAutoDeck and PinEditor/RectangleEditor. |
| **Style & Consistency** | **B+** | Near-perfect naming. Self-consistent formatting. No Prettier config. Mixed export style. |

---

## Top 20 Priority Issues

*Ordered by SEVERITY × IMPACT × FIX_SAFETY. Issues that affect the most users, cause the most damage, and can be fixed with the least risk of regression are ranked highest.*

| # | Issue | Phase | Severity | Impact | Fix Safety | Est. Effort |
|---|-------|-------|----------|--------|------------|-------------|
| 1 | **Add DOMPurify sanitization** to 7 `marked.parse()` → innerHTML locations | P6 | HIGH | Prevents XSS on every content render | HIGH — additive, no behavior change | Low (1 library, 1 utility, 7 call sites) |
| 2 | **Enable `strictNullChecks`** in tsconfig | P2 | HIGH | Surfaces ~140 real null-dereference crashes | MEDIUM — requires fixing errors | High (~190 errors to address) |
| 3 | **Code-split PDF libraries** (`pdfjs-dist` 769KB + `pdf-lib` 711KB) via dynamic `import()` | P5 | HIGH | Reduces initial bundle by 1,480 KB (74%) | HIGH — lazy load, no behavior change | Medium |
| 4 | **Add `aria-label` to all ~70 icon-only buttons** | P7 | HIGH | Screen readers can identify every button | HIGH — additive attribute | Low (mechanical) |
| 5 | **Fix 9 confirmed type bugs** (8 in CanvasRenderer.ts union narrowing + 1 impossible comparison) | P2 | CRITICAL | Prevents runtime TypeErrors | HIGH — adding type guards | Low |
| 6 | **Replace Tailwind CDN** with build-time PostCSS | P5 | HIGH | Eliminates ~100 KB download + runtime JIT compiler | MEDIUM — config migration | Medium |
| 7 | **Add `role="dialog"` + `aria-modal` + `aria-labelledby`** to 17 modals | P7 | HIGH | Modals announced to screen readers | HIGH — additive attributes | Medium |
| 8 | **Code-split Gemini SDK** (`@google/genai` 614KB) via dynamic `import()` | P5 | HIGH | Further reduces initial bundle by 614 KB | HIGH — lazy load | Low |
| 9 | **Add Content-Security-Policy** meta tag to `index.html` | P6 | HIGH | Limits XSS blast radius | MEDIUM — must list all CDN sources | Medium |
| 10 | **Guard AI API response access** (23 `response.content[0]` / `candidates[0]` locations) | P2 | HIGH | Prevents crash on empty/blocked API response | HIGH — null guards only | Medium |
| 11 | **Add `role="button"`, `tabIndex={0}`, `onKeyDown`** to project tree + card list rows | P7 | HIGH | Core navigation becomes keyboard-accessible | MEDIUM — behavior addition | Medium |
| 12 | **Implement focus trapping** in 17 modals (shared `useFocusTrap` hook) | P7 | HIGH | Focus stays within modals for keyboard users | MEDIUM — new hook | Medium |
| 13 | **Replace `focus:outline-none`** with visible focus rings (26 locations) | P7 | MEDIUM | Keyboard users can see focus location | HIGH — CSS change only | Low |
| 14 | **Add `React.memo`** to all 6 panel components + InsightsCardList | P5 | MEDIUM | Prevents unnecessary re-renders | HIGH — wrapping only | Low |
| 15 | **Change dev server `host: '0.0.0.0'` to `'localhost'`** | P6 | HIGH | Prevents LAN API key exposure | HIGH — one-line change | Trivial |
| 16 | **Remove 73 unused variables/imports** | P1 | LOW | Reduces dead code, improves clarity | HIGH — mechanical cleanup | Low |
| 17 | **Add AbortController** to `useCardGeneration.ts` 3-phase pipeline | P5 | MEDIUM | Prevents wasted API calls and race conditions | HIGH — additive | Low |
| 18 | **Link 14 `<label>` elements** to inputs via `htmlFor`/`id` + add `aria-label` to 13 unlabeled inputs | P7 | MEDIUM | Form controls announced by screen readers | HIGH — additive attributes | Low |
| 19 | **Fix dark mode contrast ratios** (`#a1a1aa` → `#c0c0c8` on dark backgrounds, 10 pairs) | P7 | MEDIUM | Readable text for low-vision users | HIGH — CSS value change | Low |
| 20 | **Split AppContext** into focused contexts (Project, Document, Card, UI) | P4/P5 | HIGH | Eliminates cascading re-renders across all panels | LOW — high-risk refactor | High |

---

## Recommended Fix Order

### Batch 1 — Zero-Risk Fixes (no behavior changes, additive only)

*These changes only add safety layers or remove dead code. Zero risk of breaking existing functionality.*

| # | Fix | Source | Files Changed | Est. Time |
|---|-----|--------|---------------|-----------|
| 1.1 | Install DOMPurify, create `sanitizeHtml()` utility, pipe all 7 `marked.parse()` outputs through it. **Highest urgency**: 4 locations in `useDocumentEditing.ts` process user-uploaded markdown files (direct XSS vector). 2 locations in `ChatPanel.tsx` render AI responses (lower risk, but document names flow into system notices). 1 in `AssetsPanel.tsx` renders AI prompts. | P6 CS-1–7 | 4 files + 1 new utility | 30 min |
| 1.2 | Add `aria-label` to ~70 icon-only buttons (match existing `title` text) | P7 §2 | ~15 component files | 60 min |
| 1.3 | Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to 17 modals | P7 §1.1 | 9 files | 45 min |
| 1.4 | Replace `focus:outline-none` / `outline: 'none'` with visible focus rings | P7 §4 | 14 files (26 locations) | 30 min |
| 1.5 | Link `<label>` to inputs via `htmlFor`/`id` (14 pairs) + add `aria-label` to 13 unlabeled inputs | P7 §5 | 12 files | 30 min |
| 1.6 | Change `host: '0.0.0.0'` to `host: 'localhost'` in vite.config.ts | P6 S-4 | 1 file | 1 min |
| 1.7 | Remove 73 unused variables/imports (ESLint errors) | P1 | ~35 files | 45 min |
| 1.8 | Add `@types/react-dom` to eliminate 15 implicit-any errors | P2 | package.json + tsconfig | 2 min |
| 1.9 | Remove duplicate imports in App.tsx and AssetsPanel.tsx | P1 | 2 files | 5 min |

**Batch 1 Total**: ~4 hours. **Risk**: None. **Verification**: Build + visual spot-check.

### Batch 2 — Low-Risk Fixes (targeted code changes, minimal blast radius)

*These changes modify behavior in isolated, well-scoped locations.*

| # | Fix | Source | Files Changed | Est. Time |
|---|-----|--------|---------------|-----------|
| 2.1 | Add type guards to CanvasRenderer.ts (fix 8 union narrowing bugs) | P2 | 1 file | 30 min |
| 2.2 | Guard all AI API response access with optional chaining + fallback (23 locations) | P2 | 4 hook files | 45 min |
| 2.3 | Add AbortController to `useCardGeneration.ts` 3-phase pipeline | P5 | 1 file | 30 min |
| 2.4 | Wrap 6 panel components + InsightsCardList in `React.memo` | P5 | 7 files | 20 min |
| 2.5 | Memoize derived arrays (e.g., `insightsSession?.cards || []`) | P5 | App.tsx + 3 files | 20 min |
| 2.6 | Fix NuggetCreationModal impossible comparison | P2 | 1 file | 5 min |
| 2.7 | Add `role="alert"` / `aria-live="polite"` to ToastNotification | P7 | 1 file | 5 min |
| 2.8 | Add `aria-expanded` to all dropdown/collapsible triggers | P7 | 6 files | 30 min |
| 2.9 | Add `aria-describedby` + `aria-invalid` on validated inputs | P7 | 8 files | 30 min |
| 2.10 | Fix dark mode contrast ratios (10 color pairs) | P7 | index.html + 3 files | 20 min |
| 2.11 | Merge PinEditor + RectangleEditor into `AnnotationEditorPopover` | P3 | 2 files → 1 | 1 hour |
| 2.12 | Add React Error Boundaries at panel level — wrap each of the 6 panels + AnnotationWorkbench in an `ErrorBoundary` class component with a fallback UI | P4 | 1 new component + App.tsx | 30 min |

*Note on 2.11: Investigation confirms PinEditor and RectangleEditor have 100% identical logic — the only differences are popover offset coordinates (+20/−40 vs −180/−150), label text ("Pin Instruction" vs "Area Instruction"), and placeholder text. Zero behavioral edge cases unique to either. A single component with `type: 'pin' | 'area'` parameter replaces both. Moved from Batch 4 to Batch 2 because this is genuinely low-risk mechanical work, not an architectural refactor.*

*Note on 2.12: Promoted from Batch 5.4 per stakeholder review. With 9 confirmed type bugs, ~140 null-dereference risks, and zero error boundaries, any uncaught exception currently kills the entire application. Panel-level error boundaries are purely additive — they catch rendering errors in a panel and show a fallback instead of white-screening the app. This is the runtime safety net while type safety is addressed incrementally across Batches 2–4.*

**Batch 2 Total**: ~5.5 hours. **Risk**: Low. **Verification**: Build + type-check + manual test of affected features.

### Batch 3 — Moderate-Risk Fixes (build tooling changes, code splitting)

*These changes alter the build pipeline or loading behavior. Require thorough testing.*

| # | Fix | Source | Files Changed | Est. Time |
|---|-----|--------|---------------|-----------|
| 3.1 | Replace Tailwind CDN with build-time PostCSS + Tailwind (**see migration risks below**) | P5 | index.html, vite.config.ts, new tailwind.config.ts, postcss.config.js | 3–5 hours |
| 3.2 | Code-split PDF libraries (`pdfjs-dist`, `pdf-lib`) via dynamic `import()` with loading states | P5 | SourcesPanel.tsx, PdfViewer.tsx, fileProcessing.ts | 2 hours |
| 3.3 | Code-split Gemini SDK (`@google/genai`) via dynamic `import()` | P5 | utils/ai.ts | 1 hour |
| 3.4 | Add CSP meta tag to index.html | P6 | index.html | 1 hour |
| 3.5 | Implement focus trapping in modals (shared `useFocusTrap` hook) | P7 | 9 files + 1 new hook | 2 hours |
| 3.6 | Add `role="button"` + `tabIndex={0}` + `onKeyDown` to project tree/card list rows | P7 | ProjectsPanel.tsx, InsightsCardList.tsx | 2 hours |
| 3.7 | Add semantic landmarks (`<header>`, `<nav>`, `<main>`) | P7 | App.tsx | 30 min |
| 3.8 | Add `role="tree"` / `role="treeitem"` to tree structures | P7 | ProjectsPanel.tsx, DocumentEditorModal.tsx, PdfBookmarkEditor.tsx | 2 hours |
| 3.9 | Adopt Prettier with project-specific config | P8 | All 70 source files + .prettierrc | 1 hour |

**Batch 3 Total**: ~16 hours. **Risk**: Moderate. **Verification**: Full build + full manual QA pass.

**Tailwind CDN → Build-Time Migration Risks (3.1)**: Investigation found 123 dynamic ternary className patterns, 785 `dark:` variant usages, and 50+ arbitrary bracket values (e.g., `text-[13px]`, `z-[120]`, `shadow-[5px_0_6px_rgba(…)]`). All of these are supported by build-time Tailwind with proper `content` path configuration, but the migration requires: (a) creating `tailwind.config.js` with explicit `darkMode: 'class'`, (b) extracting ~20 custom CSS rules from `index.html` into a `globals.css`, (c) thorough light+dark mode testing of all components. The time estimate is raised from 2–3 to 3–5 hours to account for this. No dynamic string concatenation of class names (e.g., `` `text-${color}-500` ``) was found — all classes are statically analyzable.

### Batch 4 — High-Risk Refactors (architecture changes)

*These changes restructure core application architecture. Require careful incremental execution with build verification after each step.*

**PREREQUISITE**: Before starting Batch 4, install a test framework (Vitest) and add targeted integration tests covering critical flows: card generation pipeline, chat message send/receive, project/nugget CRUD, document upload, and persistence round-trips. Even 20–30 tests on these flows provides a safety net that "build + run + visual check" cannot. Without tests, architectural refactors rely entirely on manual QA to catch regressions.

**Internal execution order matters.** The items below are numbered in the recommended execution sequence:

| # | Fix | Source | Files Changed | Est. Time |
|---|-----|--------|---------------|-----------|
| 4.0 | **(Prerequisite)** Add Vitest + targeted integration tests for critical flows | P0 | New test files, vitest.config.ts | 6–8 hours |
| 4.1 | Remove insightsSession legacy shim — **must come first** to simplify the context before splitting it. The shim drives 8 of 14 cross-domain functions in AppContext via dual-write patterns. | P4 | App.tsx, AppContext.tsx, ~5 consumers | 4–6 hours |
| 4.2 | Extract domain hooks from App.tsx (`useDocumentOperations`, `useCardOperations`, etc.) — reduces App.tsx complexity before the context split | P4 | App.tsx → 4 new hook files | 4–6 hours |
| 4.3 | Enable `strictNullChecks` and fix ~190 errors. Note: Batch 2.2 (API response guards) pre-fixes ~23 of these errors, reducing the remaining count to ~167. | P2 | ~52 files | 6–10 hours |
| 4.4 | Split AppContext into focused contexts (Project, Nugget, Selection, Style) — **see caveat below** | P4/P5 | context/ + all consumers | 6–8 hours |
| 4.5 | Eliminate redundant prop drilling (remove ~60 props already available via context) | P4 | App.tsx + 5 panel components | 3–4 hours |
| 4.6 | Extract shared `usePanelOverlay` hook from 4 panel components | P3/P4 | 4 panel files + 1 new hook | 2–3 hours |
| 4.7 | Extract `callClaudeWithFileApiDocs()` from useAutoDeck (3 duplicate call sites) | P3 | useAutoDeck.ts + utils/ai.ts | 1–2 hours |

**Batch 4 Total**: ~40 hours (including test prerequisite). **Risk**: High. **Verification**: Run test suite after every commit. Full manual QA after each major refactor.

**AppContext Split Caveat (4.4)**: Investigation of AppContext found that 14 of 42 exposed functions (33%) are cross-domain — they read or write across multiple proposed context boundaries. Three operations genuinely span 3 domains: `selectEntity()` (reads Projects + Nuggets, writes Selection), `deleteNugget()` (writes Nuggets + Projects + Selection), and `deleteProject()` (writes Projects + Nuggets + Selection). Eight functions are cross-domain solely because of the insightsSession dual-write shim — these become single-domain once 4.1 is completed. After shim removal, the remaining cross-domain operations reduce to ~6, primarily the cascading delete functions and `selectEntity()`. These can be handled via a thin orchestration layer or by having the Selection context subscribe to Nugget/Project changes. The split is feasible but requires 4.1 (shim removal) to be completed first.

### Batch 5 — Deferred / Long-Term

*Items that provide value but should not block other work.*

| # | Fix | Source | Notes |
|---|-----|--------|-------|
| 5.1 | Enable remaining strict flags (`noImplicitAny`, `strict` master switch) | P2 | After strictNullChecks is stable |
| 5.2 | Add list virtualization (`react-window` or `@tanstack/virtual`) | P5 | Needed when card lists exceed ~50 items |
| 5.3 | ~~Add test framework~~ — **Promoted to Batch 4.0 prerequisite** | P0 | — |
| 5.4 | ~~Add React Error Boundaries~~ — **Promoted to Batch 2.12** | P4 | — |
| 5.5 | Reduce font weights (trim Inter 300, 800 if unused) | P5 | ~50 KB savings |
| 5.6 | Add request deduplication for AI API calls | P5 | Prevents double-click waste |
| 5.7 | Split types.ts into domain modules | P4 | Reduces recompilation surface (48 importers) |
| 5.8 | Standardize export style to `export default` per CLAUDE.md | P8 | 14 files |
| 5.9 | Add skip-to-main-content link + keyboard shortcut help | P7 | Accessibility polish |
| 5.10 | Resolve 48 `react-hooks/exhaustive-deps` warnings | P1 | **Not all are bugs** — sample analysis found ~2 genuine bugs, ~2 intentional omissions with `eslint-disable`, and ~9 correct instances per 13 sampled. Requires per-instance review. See Appendix B. |

### Cross-Batch Dependencies

The batches are designed to be sequential (1 → 2 → 3 → 4 → 5), but most items within each batch are independent. Key dependencies across batches:

| Dependency | Why |
|-----------|-----|
| **3.4 (CSP) should follow 3.1 (Tailwind migration)** | A CSP policy is much simpler when `cdn.tailwindcss.com` is no longer a `script-src` dependency. If 3.1 is deferred, the CSP must include an `unsafe-eval` directive for the Tailwind JIT compiler, weakening its value. |
| **3.5 (focus trapping) benefits from 1.3 (modal roles)** | Focus trapping implementation is cleaner when modals already have `role="dialog"` and `aria-modal`. Not a hard dependency, but doing 1.3 first provides the semantic foundation. |
| **4.4 (context split) requires 4.1 (shim removal)** | Hard dependency. 8 of 14 cross-domain functions in AppContext exist solely because of the insightsSession shim. Splitting before removing the shim means splitting a messier context. |
| **4.5 (prop drilling removal) requires 4.4 (context split)** | Hard dependency. Cannot safely remove props until context boundaries are defined. After the split, it becomes clear which props are genuinely redundant vs. which served as performance shortcuts. |
| **4.3 (strictNullChecks) overlaps with 2.2 (API response guards)** | Batch 2.2 pre-fixes ~23 of the ~190 strictNullChecks errors. These are the highest-risk subset. The remaining ~167 errors are addressed in 4.3. Doing 2.2 first provides immediate crash prevention; doing 4.3 later is the comprehensive cleanup pass. An alternative approach is to enable `strictNullChecks` earlier and fix all errors in one pass — this is more efficient but requires a larger time commitment upfront. |
| **No Batch 2 fix depends on any Batch 1 fix** | All Batch 2 items can run independently of Batch 1. |
| **2.4 (React.memo) pairs well with 1.7 (unused var cleanup)** | Not a dependency, but removing unused vars first makes the memo wrappers cleaner. |

---

## Files Ranked by Technical Debt (Top 20)

*Composite score based on: lines of code, ESLint issues, strict-mode errors, complexity violations, duplication clones, accessibility issues, security findings, and coupling metrics.*

| # | File | Lines | Debt Score | Top Issues |
|---|------|-------|------------|------------|
| 1 | **App.tsx** | 2,422 | **98** | 196 ESLint warnings, 11 useState + 52 callbacks (God Component), 7 strict null errors, ~120 props drilled, 12 a11y issues, 2 complexity violations |
| 2 | **ProjectsPanel.tsx** | 1,561 | **82** | 77 ESLint warnings, 36-prop interface, 28 a11y issues (worst a11y file), keyboard-inaccessible tree, 12 unused vars, God Component |
| 3 | **SourcesPanel.tsx** | 1,241 | **76** | 95 ESLint warnings, 15 useState (most of any component), 24 strict null errors, 14 a11y issues, 10 jsx-a11y violations, God Component |
| 4 | **AnnotationWorkbench.tsx** | 1,142 | **72** | 102 ESLint warnings (2nd most), 8 complexity violations (most of any file), 6 a11y issues, God Component |
| 5 | **DocumentEditorModal.tsx** | 1,271 | **70** | 93 ESLint warnings, complexity 78 (2nd highest), 22 strict null errors, 10 a11y issues, God Component |
| 6 | **AutoDeckPanel.tsx** | 1,240 | **68** | 72 ESLint warnings, 19 duplication clones (most of any file), 16 a11y issues, 13 strict null errors, outline:none on all inputs |
| 7 | **InsightsCardList.tsx** | 997 | **64** | 10 duplication clones, 20 a11y issues, keyboard-inaccessible card rows, 18 jsx-a11y violations, God Component |
| 8 | **ChatPanel.tsx** | 808 | **56** | 12 useState, 12 a11y issues, 6 duplication clones (CopyButton ×3), XSS: 2 unsanitized marked.parse() |
| 9 | **hooks/useAutoDeck.ts** | 722 | **54** | 19 duplication clones (worst duplication file), 13 strict null errors, fan-out 11, layer violation (→ Toast) |
| 10 | **StyleStudioModal.tsx** | 765 | **52** | 12 useState for 3 props, 14 strict null errors, 14 a11y issues, 8 jsx-a11y violations, God Component |
| 11 | **workbench/CanvasRenderer.ts** | ~400 | **50** | 8 confirmed type BUGS (union narrowing), 71 ESLint warnings, 57 magic numbers, 7 single-letter vars |
| 12 | **context/AppContext.tsx** | ~350 | **48** | 58-member monolithic context, fan-in 13, legacy insightsSession shim causes ~10 dual-write callbacks |
| 13 | **hooks/useCardGeneration.ts** | 465 | **46** | 8 explicit `any`, 6 strict null errors, complexity 51, fan-out 11, layer violation, no AbortController |
| 14 | **CardsPanel.tsx** | 377 | **40** | Fabricated `UploadedFile` (HIGH type safety risk), dialog without role, 4 a11y issues |
| 15 | **AssetsPanel.tsx** | 843 | **38** | Complexity 80 (highest in codebase), 33-prop relay, XSS: unsanitized marked.parse(), 10 a11y issues |
| 16 | **hooks/useDocumentEditing.ts** | 541 | **36** | 63 ESLint warnings, 9 responsibilities (too many), 4 complexity violations, 7 strict null errors, 2 heading-parse duplicates |
| 17 | **utils/pdfBookmarks.ts** | ~200 | **34** | 28 strict null errors (most of any file), bookmark tree traversal without bounds checking |
| 18 | **hooks/useInsightsLab.ts** | 364 | **32** | Complexity 42, 4 strict null errors, stale JSDoc references to deprecated constant |
| 19 | **Dialogs.tsx** | ~300 | **30** | 4 components in 1 file, 8 a11y issues (no dialog roles, no focus traps, no Escape handling) |
| 20 | **utils/ai.ts** | ~600 | **28** | Fan-in 13, 3 `anthropic-dangerous-direct-browser-access` headers, raw API error bodies shown to users, unvalidated JSON.parse |

---

## Appendix: Raw Numbers

### Phase 0 — Baseline

| Metric | Value |
|--------|-------|
| Build status | ✅ SUCCESS (5.68s) |
| Dev server | ✅ SUCCESS |
| Tests | ❌ None (no test framework) |
| TypeScript errors (`tsc --noEmit`) | 2 (known, pre-existing) |
| Source files | 69 |
| Lines of code | 27,434 |
| Production dependencies | 6 |
| Dev dependencies | 5 (+ audit tools added during audit) |
| Node.js | 22.16.0 |
| TypeScript | 5.8.3 |
| Vite | 6.4.1 |
| Main bundle size | 2,002.54 KB (592.44 KB gzip) |

### Phase 1 — ESLint

| Metric | Value |
|--------|-------|
| Rules enabled | 68 (across 7 plugins) |
| Files scanned | 68 |
| Total errors | 97 |
| Total warnings | 1,639 |
| Total issues | 1,736 |
| Files with issues | 63 / 68 (92.6%) |
| Clean files | 5 |
| Top rule: `curly` | 761 warnings |
| Top rule: `no-magic-numbers` | 410 warnings |
| Unused vars/imports | 73 errors |
| Cognitive complexity violations | 51 |
| Hook dependency issues | 48 warnings |
| Explicit `any` usage | 46 warnings |
| Console statements | 72 warnings |
| Circular dependencies | 0 |

### Phase 2 — Type Safety

| Metric | Value |
|--------|-------|
| Strict flags enabled | 0 of 15 |
| Strict-mode errors (all flags on) | 411 |
| Files affected | 52 / 69 (75.4%) |
| Confirmed BUGS | 9 (8 union narrowing + 1 impossible comparison) |
| RISKY errors (null deref, type mismatch) | 220 |
| WEAK errors (cleanup, semantics) | 182 |
| Null dereference risks | ~190 (~140 real) |
| API boundary issues (HIGH) | 3 |
| API boundary issues (MEDIUM) | 7 |
| Dangerous type assertions | 5 |

### Phase 3 — Duplication

| Metric | Value |
|--------|-------|
| Files scanned | 88 |
| Total lines scanned | 22,651 |
| Duplicate blocks found | 62 |
| Duplicated lines | 689 |
| Duplication percentage | 3.04% |
| Industry rating | ✅ Good (< 5%) |
| Component JSX clones | 32 (296 lines) |
| Logic clones | 27 (315 lines) |
| API call clones | 3 (69 lines) |
| Worst file: useAutoDeck.ts | 19 clone appearances |
| Top extraction target | PinEditor ↔ RectangleEditor (~90% identical) |

### Phase 4 — Architecture

| Metric | Value |
|--------|-------|
| Circular dependencies | 0 |
| Orphan files | 0 |
| God Components (>300 lines, mixed concerns) | 10 (76.5% of component code) |
| Largest component: App.tsx | 2,422 lines, 52 callbacks |
| Layer violations | 3 (hooks→components ×2, utils→hooks ×1) |
| Context members | 58 (13 state + 3 derived + ~42 functions) |
| Props drilled from App.tsx | ~120 |
| Redundant context + props | 5 of 6 panels |
| Highest fan-in: types.ts | 48 importers |
| Highest fan-out: App.tsx | 30 imports |

### Phase 5 — Performance

| Metric | Value |
|--------|-------|
| Main JS bundle | 2,002.54 KB (592.44 KB gzip) |
| JS chunks (total) | 1 (+ 1 worker) |
| Dynamic imports | 0 |
| React.lazy usage | 0 |
| React.memo usage | 0 |
| useMemo instances | 23 |
| useCallback instances | 179 |
| Tailwind CDN | Yes (render-blocking JIT) |
| Font variants loaded | 11 (~300 KB) |
| Inline style attributes | ~231 |
| Virtualized lists | 0 |
| AbortController coverage | 3/4 major hooks |
| Performance grade | D+ |

### Phase 6 — Security

| Metric | Value |
|--------|-------|
| npm audit: Critical | 0 |
| npm audit: High | 12 (all dev deps — ESLint minimatch) |
| npm audit: Production vulnerabilities | 0 |
| Total security findings | 22 |
| Finding severity: Critical | 0 |
| Finding severity: High | 2 (no CSP, dev server 0.0.0.0) |
| Finding severity: Medium | 8 |
| Finding severity: Low | 12 |
| XSS locations (unsanitized markdown) | 7 |
| CSP present | No |
| SRI on CDN scripts | No |
| eval/document.write usage | 0 |
| Exposed secrets in source | 0 |

### Phase 7 — Accessibility

| Metric | Value |
|--------|-------|
| Estimated WCAG 2.1 AA compliance | ~15% |
| Total accessibility issues | 187 |
| Critical issues | 38 |
| Major issues | 118 |
| Minor issues | 31 |
| ARIA attributes in codebase | 0 |
| `role` attributes in codebase | 0 |
| Icon-only buttons without aria-label | ~70 |
| Modals without focus trapping | 17 |
| Modals with Escape key handling | 4 of 17 |
| Labels not linked to inputs | 14 |
| Inputs without any label | 13 |
| Focus indicators removed | 26 locations |
| Failing contrast pairs | 10 |
| jsx-a11y violations (automated scan) | 143 across 22 files |

### Phase 8 — Style & Consistency

| Metric | Value |
|--------|-------|
| Prettier pass rate | 0% (70/70 files would be reformatted) |
| Internal formatting consistency | ✅ Self-consistent |
| PascalCase components | 100% (33/33) |
| camelCase functions | 100% (~180/~180) |
| `{Name}Props` interfaces | 100% (32/32) |
| Boolean prefix compliance | ~99% (111/112) |
| UPPER_SNAKE_CASE constants | 100% (84/84) |
| Export default vs named | 58% / 42% (CLAUDE.md says default) |
| Single-letter variables outside loops | 46 instances in 15 files |
| TODO comments | 1 (well-documented) |
| FIXME/HACK/XXX comments | 0 |
| Commented-out code | 0 |
| Dead code items | 3 (1 deprecated constant, 1 dead CSS class, 2 stale JSDoc) |
| try/catch blocks | 43 across 16 files |
| Error handling tiers | 3 (toast → warn → silent) — consistently applied |
| React Error Boundaries | 0 |

---

## Appendix B: Reviewer Feedback & Resolutions

*This section addresses all questions raised during stakeholder review of the initial consolidated report. Questions that led to report amendments are noted with "AMENDED." Questions that were investigated but did not change the report are addressed with justification.*

### Batch Ordering Questions

**Q1: strictNullChecks overlap with API response guards — should they be combined?**

AMENDED (see Batch 4.3 note and Cross-Batch Dependencies). Batch 2.2 (API response guards) fixes 23 of the ~190 strictNullChecks errors — specifically the highest-risk ones (AI API response access crashes). The revised report now explicitly notes this overlap and presents the trade-off: doing them separately is less efficient (touches some files twice) but more incremental and lower-risk; doing them together is more efficient but requires committing to the full strictNullChecks effort upfront. The report retains the incremental approach as the default recommendation because the API response guards provide immediate crash prevention at low effort, while strictNullChecks requires significant sustained effort (~167 remaining errors across ~50 files).

**Q2: Should 4.3, 4.4, 4.5 happen before 4.2 (context split)?**

AMENDED. Batch 4 has been reordered. The correct execution order is: (4.1) Remove insightsSession shim → (4.2) Extract domain hooks from App.tsx → (4.3) Enable strictNullChecks → (4.4) Split AppContext → (4.5) Eliminate prop drilling. The shim removal must come first because it converts 8 cross-domain functions into single-domain functions, making the context split dramatically simpler. Hook extraction from App.tsx should precede the context split so that App.tsx is already thinner, and the hooks can be reassigned to the appropriate new context providers. strictNullChecks is placed after hook extraction because the extracted hooks will have cleaner type signatures.

**Q3: Are there hidden cross-batch dependencies?**

AMENDED. A new "Cross-Batch Dependencies" section has been added documenting all inter-batch dependencies. Key findings: no Batch 2 fix depends on any Batch 1 fix; CSP (3.4) should follow Tailwind migration (3.1); focus trapping (3.5) benefits from modal roles (1.3); within Batch 4, items have hard sequential dependencies (4.1 → 4.2 → 4.4 → 4.5).

### Specific Risk Assessment Questions

**Q4: PinEditor vs RectangleEditor behavioral differences?**

AMENDED. Investigation confirmed the two components have 100% identical logic. The only differences are: (a) popover positioning offsets (+20/−40 px vs −180/−150 px), (b) label text ("Pin Instruction" vs "Area Instruction"), (c) placeholder text, (d) delete button title ("Delete Pin" vs "Delete Annotation"). Zero edge cases unique to either component. The merge has been moved from Batch 4 (high risk) to Batch 2.11 (low risk) and reclassified as mechanical work.

**Q5: Tailwind CDN → PostCSS migration risks?**

AMENDED. Investigation found 123 dynamic ternary className patterns, 785 `dark:` variant usages, and 50+ arbitrary bracket values. All are supported by build-time Tailwind, but the migration requires creating `tailwind.config.js` with `darkMode: 'class'`, extracting ~20 custom CSS rules from `index.html`, and comprehensive light+dark mode testing. No dynamic string concatenation of class names was found (e.g., `` `text-${color}-500` ``), which would have been a breaking pattern. Time estimate raised from 2–3 to 3–5 hours. Risk note added to Batch 3.

**Q6: Do AppContext operations span multiple proposed context groupings?**

AMENDED. Investigation found 14 of 42 functions (33%) are cross-domain. Three operations genuinely span 3 domains (selectEntity, deleteNugget, deleteProject). Eight functions are cross-domain solely because of the insightsSession shim — these become single-domain after shim removal. The revised Batch 4 now requires shim removal (4.1) before context split (4.4), and includes a detailed caveat about the remaining 6 cross-domain operations and how to handle them. The split is feasible but not as clean as the original report implied.

**Q7: DOMPurify content sources and urgency?**

AMENDED. The DOMPurify entry (1.1) now details the content sources: 4 locations in `useDocumentEditing.ts` process user-uploaded markdown (highest urgency — users can unknowingly open a malicious .md file), 2 locations in `ChatPanel.tsx` render AI responses and system notices (lower urgency — AI output is unlikely to contain XSS, but document names flow into system notices), 1 in `AssetsPanel.tsx` renders AI-generated prompts. The fix is the same for all 7 (pipe through DOMPurify), but if time-boxed, the 4 `useDocumentEditing.ts` locations should be fixed first.

### Questions About Report Accuracy

**Q8: Are any of the 48 exhaustive-deps warnings intentional omissions?**

AMENDED (Batch 5.10 note updated). A sample analysis of 13 representative instances found:
- **2 genuine bugs**: `App.tsx:942-952` — a styling writeback effect missing `selectedNuggetId` and `updateNugget` from its dependency array. This means styling changes could be saved to the wrong nugget if the user switches nuggets while the effect is pending.
- **2 intentional omissions**: `AutoDeckPanel.tsx:138` (has explicit `eslint-disable-line`, deliberately watches only `documents.length`), and `usePersistence.ts:56-58` (intentionally runs on every render to keep a ref in sync — standard React pattern).
- **9 correct instances**: Dependencies were actually properly included despite ESLint flagging the surrounding context.

Extrapolating: of the 48 warnings, a meaningful fraction are likely false positives or intentional. The original report's characterization of all 48 as "potential stale-closure bugs" was overly broad. Each instance requires individual review. The `App.tsx:942-952` bug is confirmed and should be fixed in Batch 2 (added as a recommended addition).

**Q9: Is the cognitive complexity inherent or accidental?**

Not amended — the original report already addresses this. Phase 1 categorizes each of the 51 violations as "Justified," "Partly justified," or "Excessive." Of the 51 violations: 5 are rated "Justified" (recursive tree traversal in `markdown.ts:walk`, retry logic in `ai.ts`), 12 are "Partly justified" (mouse event handlers in AnnotationWorkbench, pipeline orchestration in useCardGeneration, parse logic), and 34 are "Excessive" (accidental complexity from poor structuring). For the justified cases, the complexity is inherent to the problem — a function dispatching on 8 annotation types will naturally have high branching. For the excessive cases, the complexity can be reduced through extraction (sub-components, helper functions, state machines) without just moving it elsewhere. The distinction is already captured in the Phase 1 report's per-function assessments.

**Q10: Are any of the ~60 "redundant" props intentionally drilled for performance?**

Not amended, but clarified here. The concern is valid in principle: a component receiving data as props (rather than subscribing to context) can use `React.memo` to skip re-renders when those specific props don't change. However, this optimization is currently **not being realized** — the codebase has zero `React.memo` usage (Phase 5). Additionally, 5 of 6 panels already subscribe to `useAppContext()` directly AND receive the same values as props, meaning they re-render on every context change regardless. The props provide zero performance benefit in the current architecture.

After Batch 2.4 adds `React.memo` and Batch 4.4 splits the context, the situation changes: panels will only re-render when their specific context slice changes, making the props truly redundant. The recommendation to remove them in 4.5 (after the context split) is deliberate — it ensures the performance question is moot by the time props are removed.

**Q11: How many of the 231 inline styles are genuinely dynamic?**

Not amended (the report did not recommend converting all inline styles to classes). Investigation of 8 major component files found ~155 inline style attributes with the following breakdown:

| Category | Count | Percentage | Action |
|----------|-------|-----------|--------|
| **Static** (hardcoded, never change) | ~70 | 45% | Could convert to Tailwind classes |
| **Conditional** (chosen by boolean) | ~44 | 28% | Could convert to conditional class application |
| **Dynamic** (computed from state/props) | ~41 | 26% | Must remain inline |

The static styles are concentrated in `AutoDeckPanel.tsx` (~45 static flex/typography styles) — this single file represents the bulk of the conversion opportunity. The dynamic styles (canvas transforms, drag positions, resize widths, context menu coordinates) are correctly implemented as inline styles and should not be changed. The original report's mention of 231 inline styles was informational, not a conversion recommendation.

### Questions the Report Didn't Cover

**Q12: Browser compatibility?**

Not covered in the audit — this was an omission. The application targets modern browsers only, based on evidence from the stack:
- React 19 requires Chrome 90+, Firefox 91+, Safari 15+, Edge 90+
- ES module importmap in `index.html` requires Chrome 89+, Firefox 108+, Safari 16.4+, Edge 89+
- `structuredClone` used in storage serialization requires Chrome 98+, Firefox 94+, Safari 15.4+
- No Babel, no polyfills, no browserslist configuration exists

The effective minimum is approximately **Chrome 98+ / Firefox 108+ / Safari 16.4+ / Edge 98+** (constrained by importmap + structuredClone). This is adequate for the app's use case (internal/small-team tool) but should be documented explicitly. If broader browser support were needed, the importmap would need polyfilling and `structuredClone` would need a fallback.

**Q13: Are there planned features that would conflict with proposed refactoring?**

Cannot be determined from static analysis. This is a valid question that requires input from the project's roadmap. If a major feature is planned that would replace or substantially rewrite a component (e.g., replacing the PDF viewer, replacing the document editor, adding a backend), then extensive refactoring of that component should be deferred. The audit cannot predict this — the stakeholder should evaluate each Batch 4 item against the planned feature roadmap before approving.

**Q14: Should we add tests before Batch 4?**

AMENDED. Tests have been promoted from Batch 5.3 (deferred) to Batch 4.0 (prerequisite). The original placement was incorrect — architectural refactoring without any test coverage is dangerous, and "build + run + visual check" cannot catch behavioral regressions in card generation pipelines, chat message handling, persistence round-trips, or document processing. Even 20–30 targeted integration tests on critical flows would provide meaningful safety. The revised Batch 4 estimate includes 6–8 hours for test framework setup and initial test coverage.

---

*Report generated by Claude Code (Opus 4.6) on 2026-02-24. Amended 2026-02-24 following stakeholder review. All findings are based on static analysis — no source files were modified during this audit.*
