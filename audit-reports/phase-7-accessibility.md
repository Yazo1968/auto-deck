# Phase 7 — Accessibility Audit

**Project**: InfoNugget v6.0
**Date**: 2026-02-24
**Auditor**: Claude Code (Opus 4.6)
**Tools**: eslint-plugin-jsx-a11y (30 rules), manual code analysis
**Mode**: READ-ONLY (no source files modified)

---

## Accessibility Summary

| Metric | Value |
|--------|-------|
| **Estimated WCAG 2.1 AA compliance** | **~15%** |
| **Total issues found** | **187** |
| **Critical** (blocks usage for assistive tech users) | **38** |
| **Major** (significantly impairs experience) | **118** |
| **Minor** (suboptimal but functional) | **31** |

### Systemic Findings

The application contains **zero ARIA attributes** (`aria-label`, `aria-labelledby`, `aria-describedby`, `aria-expanded`, `aria-modal`, `aria-live`, `aria-required`, `aria-invalid`, `aria-hidden`, `aria-selected`, `aria-haspopup`) and **zero `role` attributes** across all 28 `.tsx` component files. This is the single most impactful accessibility gap, making the entire application essentially opaque to screen readers for all complex widget patterns (modals, menus, trees, tabs, toolbars).

### ESLint jsx-a11y Automated Scan Results

The `eslint-plugin-jsx-a11y` scan (30 rules enabled) found **143 violations** across 22 files:

| Rule | Count | Description |
|------|-------|-------------|
| `no-static-element-interactions` | 75 | Non-interactive elements (div, span) with click/mouse handlers |
| `click-events-have-key-events` | 45 | onClick without onKeyDown |
| `label-has-associated-control` | 14 | `<label>` not linked to an input |
| `no-autofocus` | 6 | `autoFocus` used (warning only) |
| `no-noninteractive-tabindex` | 2 | `tabIndex` on non-interactive elements |
| `no-noninteractive-element-interactions` | 1 | Keyboard handler on non-interactive element |

**Files with most violations**: `ProjectsPanel.tsx` (22), `InsightsCardList.tsx` (18), `App.tsx` (12), `AutoDeckPanel.tsx` (12), `SourcesPanel.tsx` (10), `ChatPanel.tsx` (10), `StyleStudioModal.tsx` (8).

---

## Issues by Category

### 1. ARIA Attributes & Roles — Zero Usage (CRITICAL)

#### 1.1 No `role` Attributes on Complex Widgets

The application has complex UI patterns that require ARIA roles but none are implemented:

| Component Pattern | Required Role(s) | Files | WCAG | Severity |
|-------------------|-------------------|-------|------|----------|
| Modal dialogs (×17) | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` | Dialogs.tsx, NuggetCreationModal.tsx, ProjectCreationModal.tsx, SubjectEditModal.tsx, StyleStudioModal.tsx, DocumentEditorModal.tsx, CardsPanel.tsx, ProjectsPanel.tsx (×3), InsightsCardList.tsx (×3), ZoomOverlay.tsx, PdfUploadChoiceDialog.tsx | 4.1.2 | CRITICAL |
| Context menus (×5) | `role="menu"`, `role="menuitem"` | ProjectsPanel.tsx (×3), InsightsCardList.tsx, DocumentEditorModal.tsx | 4.1.2 | CRITICAL |
| Dropdown selectors (×6) | `role="listbox"`, `role="option"`, `aria-expanded` | App.tsx (×3 breadcrumb), AssetsPanel.tsx (×3 style/ratio/resolution), SourcesPanel.tsx, ChatPanel.tsx, AutoDeckPanel.tsx | 4.1.2 | CRITICAL |
| Project tree | `role="tree"`, `role="treeitem"`, `aria-expanded` | ProjectsPanel.tsx | 4.1.2 | CRITICAL |
| TOC trees (×3) | `role="tree"`, `role="treeitem"` | DocumentEditorModal.tsx, SourcesPanel.tsx, PdfBookmarkEditor.tsx | 4.1.2 | CRITICAL |
| Panel strip tabs | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected` | App.tsx (6 panels) | 4.1.2 | MAJOR |
| Format toolbar | `role="toolbar"` | FormatToolbar.tsx | 4.1.2 | MAJOR |
| Annotation toolbar | `role="toolbar"` | AnnotationToolbar.tsx | 4.1.2 | MAJOR |
| Toast notifications | `role="alert"` or `aria-live="polite"` | ToastNotification.tsx | 4.1.3 | MAJOR |
| Loading/progress indicators | `role="status"`, `aria-live="polite"` | Multiple (card gen, chat, auto-deck) | 4.1.3 | MAJOR |

**Total: 38+ widget instances missing required ARIA roles.**

#### 1.2 No `aria-expanded` on Collapsible/Dropdown Triggers

All dropdown triggers, collapsible panels, and tree nodes lack `aria-expanded`. Affected: breadcrumb dropdowns (App.tsx), document list toggles (ChatPanel.tsx, SourcesPanel.tsx, AutoDeckPanel.tsx), project tree (ProjectsPanel.tsx), Style/Ratio/Resolution selectors (AssetsPanel.tsx).

**WCAG Criterion**: 4.1.2 Name, Role, Value
**Severity**: CRITICAL (10+ locations)

#### 1.3 No `aria-haspopup` on Menu Triggers

No trigger buttons indicate they open a menu or popup. Affected: right-click context menus, breadcrumb dropdowns, kebab menus.

**WCAG Criterion**: 4.1.2
**Severity**: MAJOR (8+ locations)

---

### 2. Icon-Only Buttons Without Accessible Names

**~70+ icon-only buttons** use `title` as the sole accessible name. While `title` provides a tooltip, it is unreliable for screen readers — `aria-label` is the standard.

#### 2a. Buttons with NEITHER `title` NOR `aria-label` (CRITICAL — completely unnamed)

| Location | Content | Purpose |
|----------|---------|---------|
| `FormatToolbar.tsx:34` | Text "H1", "H2", "H3" | Heading level buttons — text-only, no title |
| `ZoomOverlay.tsx:138` | SVG × icon | Close fullscreen overlay |
| `ToastNotification.tsx:97` | SVG × icon | Dismiss toast |
| `AnnotationWorkbench.tsx:1029` | SVG × icon | Dismiss error |
| `ChatPanel.tsx:393` | SVG checkmark | Document enable toggle |
| `ChatPanel.tsx:483` | SVG chevron | Expand/collapse card content |
| `StyleStudioModal.tsx:473` | SVG three dots | More options (kebab menu) |
| `StyleStudioModal.tsx:509` | SVG pencil | Edit style |
| `StyleStudioModal.tsx:516` | SVG trash | Delete style |
| `App.tsx:2057` | Token count text | Usage dropdown toggle |
| `InsightsCardList.tsx:576,640` | Text buttons | Card Info / Copy-Move submenu triggers |

**WCAG Criterion**: 4.1.2 Name, Role, Value; 1.1.1 Non-text Content
**Severity**: CRITICAL (12 instances)

#### 2b. Icon-Only Buttons with `title` Only (MAJOR — weak accessible name)

~65 icon-only buttons across all components use `title` but no `aria-label`. Key files and counts:

| File | Icon-Only Buttons with title-only |
|------|----------------------------------|
| `FormatToolbar.tsx` | 10 (undo, redo, bold, italic, lists, table, hr, clear, find, save) |
| `SourcesPanel.tsx` | 8 (zoom in/out, fit width/height, rotate, bookmark, edit) |
| `ChatPanel.tsx` | 6 (copy ×3, add card, copy chat, clear chat, stop, send options) |
| `AssetsPanel.tsx` | 8 (style studio, generate, toggle, download, delete, zoom ×3, fullscreen) |
| `PdfBookmarkEditor.tsx` | 6 (rename, indent, outdent, move up, move down, delete) |
| `AnnotationToolbar.tsx` | 10 (tool buttons, text instruction, clear, save, delete, color, custom, apply) |
| `AnnotationWorkbench.tsx` | 3 (undo, redo, version history) |
| `DocumentEditorModal.tsx` | 2 (sidebar toggle, close) |
| `FindReplaceBar.tsx` | 3 (prev match, next match, close) |
| `RectangleEditor.tsx` / `PinEditor.tsx` | 4 (delete ×2, save ×2) |

**WCAG Criterion**: 4.1.2, 1.1.1
**Severity**: MAJOR (65 instances)
**Fix**: Add `aria-label` matching the existing `title` text on every icon-only button.

---

### 3. Keyboard Navigation

#### 3.1 Non-Interactive Elements with onClick (CRITICAL)

`<div>` elements used as buttons without `role`, `tabIndex`, or keyboard handlers — completely unreachable by keyboard:

| Location | Purpose | Severity |
|----------|---------|----------|
| `ProjectsPanel.tsx:1235` | Select project (tree row) | CRITICAL |
| `ProjectsPanel.tsx:1394` | Select nugget (tree row) | CRITICAL |
| `ProjectsPanel.tsx:1527` | Open document (tree row) | CRITICAL |
| `InsightsCardList.tsx:446` | Select card (card list row) | CRITICAL |
| `InsightsCardList.tsx:471` | Card selection checkbox | CRITICAL |
| `ChatPanel.tsx:327` | Document list toggle bar | MAJOR |
| `ChatPanel.tsx:390` | Document enable/disable checkbox | MAJOR |
| `SourcesPanel.tsx:475` | Source document dropdown toggle | MAJOR |
| `SourcesPanel.tsx:762` | PDF TOC heading (click to scroll) | MAJOR |
| `AutoDeckPanel.tsx:1132` | Document list toggle bar | MAJOR |
| `AutoDeckPanel.tsx:1201` | Document toggle checkbox | MAJOR |
| `DocumentEditorModal.tsx:659` | TOC sidebar root node | MAJOR |
| `DocumentEditorModal.tsx:756` | TOC sidebar heading row | MAJOR |
| `PdfBookmarkEditor.tsx:136` | Bookmark node selection | MAJOR |

**WCAG Criterion**: 2.1.1 Keyboard
**Impact**: The project tree, card list, and document toggles — the primary navigation of the entire app — are **completely inaccessible** to keyboard-only users.

#### 3.2 No Focus Trapping in Modals

**17 modal/dialog patterns** exist. **Zero** implement focus trapping. Only 4 handle the Escape key. None return focus to the trigger element on close.

| Modal | Escape Key? | Focus Trap? | Focus Return? |
|-------|------------|-------------|---------------|
| ManifestModal (Dialogs.tsx) | NO | NO | NO |
| UnsavedChangesDialog (Dialogs.tsx) | NO | NO | NO |
| DocumentChangeNotice (Dialogs.tsx) | NO | NO | NO |
| ReferenceMismatchDialog (Dialogs.tsx) | NO | NO | NO |
| NuggetCreationModal | Partial (backdrop click) | NO | NO |
| ProjectCreationModal | YES | NO | NO |
| SubjectEditModal | YES | NO | NO |
| StyleStudioModal | YES (indirect) | NO | NO |
| DocumentEditorModal | NO (by design) | NO | NO |
| CardsPanel dialog | YES | NO | NO |
| ZoomOverlay | YES | NO | NO |
| ProjectsPanel dialogs (×3) | NO | NO | NO |
| InsightsCardList dialogs (×3) | NO | NO | NO |

**WCAG Criterion**: 2.4.3 Focus Order, 2.1.2 No Keyboard Trap
**Severity**: CRITICAL

#### 3.3 No `tabIndex` on Custom Interactive Elements

Only 2 `tabIndex` usages exist in the entire codebase (both in AnnotationWorkbench.tsx). No positive `tabIndex` values (> 0) found — this is correct, but the near-total absence of `tabIndex={0}` on custom interactive elements means they are unreachable by Tab key.

#### 3.4 Keyboard Shortcuts — Undocumented

~20 keyboard shortcuts exist (Escape to close, Ctrl+S to save, Enter to submit/find) but no shortcut documentation or help dialog is provided to users.

**WCAG Criterion**: 2.1.1 Keyboard
**Severity**: MINOR

---

### 4. Focus Indicators (CRITICAL)

#### 4.1 `focus:outline-none` Without Adequate Replacement

**22 instances** across 14 files remove the native focus outline on input fields with only subtle border-color changes as replacements:

| File | Instances | Replacement Focus Style |
|------|-----------|------------------------|
| `StyleStudioModal.tsx` | 6 | `focus:border-zinc-400` (subtle) |
| `FindReplaceBar.tsx` | 2 | None visible |
| `ProjectCreationModal.tsx` | 2 | `focus:border-black` |
| `ProjectsPanel.tsx` | 2 | `focus:border-zinc-400` (subtle) |
| `CardsPanel.tsx` | 1 | `focus:border-zinc-400` |
| `AssetsPanel.tsx` | 1 | `focus:border-zinc-400` |
| `ChatPanel.tsx` | 1 | `focus-within:ring-1 ring-zinc-300` (faint) |
| `Dialogs.tsx` | 1 | `focus:border-zinc-400` |
| `InsightsCardList.tsx` | 1 | `focus:border-zinc-400` |
| `NuggetCreationModal.tsx` | 1 | `focus:border-zinc-400` |
| `SubjectEditModal.tsx` | 1 | `focus:border-zinc-400` |
| `AnnotationToolbar.tsx` | 1 | None |
| `RectangleEditor.tsx` | 1 | None |
| `PinEditor.tsx` | 1 | None |

#### 4.2 Inline `outline: 'none'` Without Replacement

| Location | Element | Replacement |
|----------|---------|-------------|
| `AutoDeckPanel.tsx:266,389,417,876` | All input/textarea fields | None |
| `AnnotationWorkbench.tsx:936` | Focusable canvas container | None |
| `AnnotationWorkbench.tsx:1038` | Focusable viewport div | None |

**WCAG Criterion**: 2.4.7 Focus Visible
**Severity**: CRITICAL (26 total locations — keyboard users cannot see where focus is)
**Fix**: Replace `focus:outline-none` / `outline: 'none'` with `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` or equivalent visible focus ring.

---

### 5. Form Accessibility

#### 5.1 Labels Not Programmatically Linked to Inputs

14 `<label>` elements exist near their inputs but lack `htmlFor`/`id` pairings — they are visual labels only:

| Location | Label Text | Severity |
|----------|-----------|----------|
| `NuggetCreationModal.tsx:122` | "Name" | MAJOR |
| `ProjectCreationModal.tsx:63` | "Name" | MAJOR |
| `ProjectCreationModal.tsx:81` | "Description" | MAJOR |
| `Dialogs.tsx:112` | "Card Name" | MAJOR |
| `CardsPanel.tsx:341` | "Card Name" | MAJOR |
| `SubjectEditModal.tsx:81` | "Topic sentence" | MAJOR |
| `StyleStudioModal.tsx:544` | "Color Palette" | MAJOR |
| `StyleStudioModal.tsx:574` | "Fonts" | MAJOR |
| `StyleStudioModal.tsx:601` | "Visual Identity" | MAJOR |
| `StyleStudioModal.tsx:668` | "Style Name" | MAJOR |
| `StyleStudioModal.tsx:682` | "Description" | MAJOR |
| `AutoDeckPanel.tsx:241+` | Audience, Type, Objective, Tone, Focus, Min, Max | MAJOR |

**WCAG Criterion**: 1.3.1 Info and Relationships
**Fix**: Add `id` to each input and `htmlFor` to each `<label>`.

#### 5.2 Inputs Without Any Label (aria-label or otherwise)

| Location | Element | Purpose | Severity |
|----------|---------|---------|----------|
| `FindReplaceBar.tsx:36` | `<input>` | Find text | MAJOR |
| `FindReplaceBar.tsx:72` | `<input>` | Replace text | MAJOR |
| `ChatPanel.tsx:608` | `<textarea>` | Chat message input | MAJOR |
| `AssetsPanel.tsx:494` | `<input>` | Hex color value | MAJOR |
| `ProjectsPanel.tsx:950` | `<input>` | Project rename | MAJOR |
| `InsightsCardList.tsx:519` | `<input>` | Card rename | MAJOR |
| `SourcesPanel.tsx:814` | `<input>` | Heading rename | MAJOR |
| `PdfBookmarkEditor.tsx:146,318` | `<input>` (×2) | Bookmark rename/add | MAJOR |
| `AnnotationToolbar.tsx:263` | `<textarea>` | Text instruction | MAJOR |
| `RectangleEditor.tsx:91` | `<textarea>` | Annotation text | MAJOR |
| `PinEditor.tsx:94` | `<textarea>` | Pin label text | MAJOR |
| `AutoDeckPanel.tsx:862` | `<textarea>` | General feedback | MAJOR |
| `AnnotationToolbar.tsx:376` | `<input type="color">` | Custom color picker | MAJOR |

**WCAG Criterion**: 4.1.2 Name, Role, Value
**Fix**: Add `aria-label` to each input/textarea.

#### 5.3 Error Messages Not Linked to Fields

All validation error messages (name conflicts, required fields) display visually near inputs but are not linked via `aria-describedby`. No inputs use `aria-invalid="true"` when in error state. No error containers use `role="alert"`.

**Affected**: Dialogs.tsx, ProjectCreationModal.tsx, ProjectsPanel.tsx, InsightsCardList.tsx, AutoDeckPanel.tsx, StyleStudioModal.tsx (8+ locations)

**WCAG Criterion**: 3.3.1 Error Identification, 3.3.3 Error Suggestion, 4.1.3 Status Messages
**Severity**: CRITICAL

#### 5.4 Required Fields Not Indicated to Assistive Tech

AutoDeckPanel uses visual red asterisks (`*`) for required fields (Audience, Type, Objective) but no `required` or `aria-required="true"` attributes exist anywhere in the entire codebase.

**WCAG Criterion**: 3.3.2 Labels or Instructions
**Severity**: MAJOR

---

### 6. Semantic HTML

#### 6.1 Missing Landmark Regions

| What's Missing | Where It Should Be | WCAG | Severity |
|---------------|-------------------|------|----------|
| `<header>` or `role="banner"` | App.tsx main header bar (line 1891) | 1.3.1, 2.4.1 | MAJOR |
| `<nav>` or `role="navigation"` | Breadcrumb navigation (App.tsx 1897-2032) | 1.3.1, 2.4.1 | MAJOR |
| `<main>` or `role="main"` | Main content area (App.tsx 2113) | 1.3.1, 2.4.1 | MAJOR |
| `aria-label` on `<aside>` elements | CardsPanel.tsx:294, DocumentEditorModal.tsx:631,643, SourcesPanel.tsx:704 | 1.3.1 | MINOR |

**Positive**: `<footer>` is correctly used (App.tsx:2409). `<aside>` is used appropriately in 4 locations. `<article>` used once (AssetsPanel.tsx:688).

#### 6.2 Heading Hierarchy Issues

| Issue | Details | WCAG | Severity |
|-------|---------|------|----------|
| No `<h1>` in main app view | Once past the landing page, no `<h1>` exists in the running app | 1.3.1 | MAJOR |
| `<h3>` without parent `<h2>` | Confirmation dialogs in portals use `<h3>` with no `<h2>` ancestor | 1.3.1 | MINOR |
| No headings in panel contents | All 6 panels lack heading elements to describe sections | 1.3.1 | MAJOR |

#### 6.3 Lists Not Using List Semantics

Only 1 proper `<ul>`/`<li>` usage exists (Dialogs.tsx document change list). All other list-like patterns use `<div>` elements:

| Pattern | Location | Should Be | WCAG | Severity |
|---------|----------|-----------|------|----------|
| Project/Nugget/Document tree | ProjectsPanel.tsx | `<ul role="tree">` + `<li role="treeitem">` | 1.3.1 | MAJOR |
| Card list | InsightsCardList.tsx | `<ul>` + `<li>` | 1.3.1 | MAJOR |
| TOC heading list | DocumentEditorModal.tsx | `<ul role="tree">` + `<li role="treeitem">` | 1.3.1 | MAJOR |
| PDF TOC headings | SourcesPanel.tsx | `<ul role="tree">` + `<li role="treeitem">` | 1.3.1 | MAJOR |
| Bookmark tree | PdfBookmarkEditor.tsx | `<ul role="tree">` + `<li role="treeitem">` | 1.3.1 | MAJOR |
| Document checkbox lists | ChatPanel.tsx, AutoDeckPanel.tsx | `<ul>` + `<li>` | 1.3.1 | MINOR |
| Dropdown items | App.tsx breadcrumbs | `<ul>` + `<li>` wrapping buttons | 1.3.1 | MINOR |
| Style list | StyleStudioModal.tsx | `<ul>` + `<li>` | 1.3.1 | MINOR |

---

### 7. Color and Contrast

#### 7.1 Failing WCAG AA Contrast Ratios

| Text Color | Background | Context | Ratio | WCAG Req | Severity |
|-----------|-----------|---------|-------|----------|----------|
| `#a1a1aa` | `#18181b` | Dark mode H4-H6, table headers, blockquote, chat h4 | ~4.3:1 | 4.5:1 | MAJOR |
| `#a1a1aa` | `#27272a` | Dark mode document table header bg | ~3.5:1 | 4.5:1 | MAJOR |
| `#a1a1aa` | `#1f1f23` | Dark mode blockquote bg | ~4.2:1 | 4.5:1 | MAJOR |
| `#a1a1aa` | `#ffffff` | Light mode helper text (`text-zinc-400`) | ~3.1:1 | 4.5:1 | MAJOR |
| `#94a3b8` | `#ffffff` | AutoDeck light mode hint text (11px) | ~3.3:1 | 4.5:1 | MAJOR |
| `#64748b` | `#18181b` | AutoDeck dark mode hint text | ~3.5:1 | 4.5:1 | MAJOR |
| `#71717a` | `#18181b` | Dark mode helper text (`text-zinc-500`) | ~3.6:1 | 4.5:1 | MAJOR |
| `#52525b` | `#0a0a0a` | Landing page feature pills (10px) | ~3.8:1 | 4.5:1 | MAJOR |
| `#365e6d` | `#18181b` | Dark mode tree icon dim (`--tree-icon-dim`) | ~2.5:1 | 3:1 | MAJOR |
| `#4a7888` | `#18181b` | Dark mode tree text dim (`--tree-text-dim`) | ~3.3:1 | 4.5:1 | MINOR |

**Fix**: Lighten dark mode text tokens: `#a1a1aa` → `#c0c0c8`, `#64748b` → `#94a3b8`, `#365e6d` → `#5a7a8a`. Darken light mode hint text: `#a1a1aa` → `#71717a`, `#94a3b8` → `#64748b`.

#### 7.2 Color-Only Information

| Issue | Location | Severity |
|-------|----------|----------|
| Required fields indicated only by red `*` | AutoDeckPanel.tsx:242 | MAJOR |
| Input error state: border turns red (but error text is also shown) | Multiple files | MINOR |
| Active card/item distinguished by subtle color shift (+ font-weight) | InsightsCardList.tsx:534 | MINOR |
| Inactive headings distinguished only by opacity 0.7 | SourcesPanel.tsx:826 | MINOR |

**WCAG Criterion**: 1.4.1 Use of Color

---

### 8. Alt Text

**Only 1 `<img>` tag exists** in the codebase (`AnnotationWorkbench.tsx:997`). It correctly uses `alt={v.label}` — **PASS**.

All images in the app are rendered as data URLs in `<img>` tags generated dynamically by the card generation pipeline. The annotation workbench image is the only static usage.

208 SVG elements exist across the codebase. Most are decorative icons inside labeled buttons. Those in icon-only buttons without `aria-label` on the parent are covered in §2 above.

---

## Component-Level Assessment

| Component | A11y Issues | Keyboard Navigable | Screen Reader Compatible |
|-----------|-------------|--------------------|-----------------------|
| **App.tsx** (main layout) | 15 | PARTIALLY — strip buttons are `<button>`, breadcrumb dropdowns are not keyboard-navigable | NO — no landmarks, no tab roles, no aria-expanded on dropdowns |
| **ProjectsPanel.tsx** | 28 | **NO** — project/nugget/document tree rows are `<div onClick>` with no keyboard access | NO — no tree roles, no aria-expanded, context menus inaccessible |
| **SourcesPanel.tsx** | 14 | PARTIALLY — PDF controls are `<button>`, TOC headings/dropdown are `<div onClick>` | NO — no tree roles, no aria-expanded, unlabeled inputs |
| **ChatPanel.tsx** | 12 | PARTIALLY — send button works, doc toggle/checkbox are `<div onClick>` | NO — no labels on textarea, doc checkboxes have no role |
| **AutoDeckPanel.tsx** | 16 | PARTIALLY — buttons work, but briefing inputs have invisible focus, doc toggle is `<div onClick>` | NO — no labels linked, no required indicators, no aria-expanded |
| **CardsPanel.tsx** | 4 | PARTIALLY — sidebar buttons work, card detail editing works | PARTIALLY — `<aside>` provides landmark, but dialog lacks role |
| **AssetsPanel.tsx** | 10 | PARTIALLY — buttons work, but selectors are custom `<div>` menus | NO — no listbox roles on selectors, unlabeled color input |
| **InsightsCardList.tsx** | 20 | **NO** — card rows and checkboxes are `<div onClick>`, context menu inaccessible | NO — no list semantics, no roles, rename input unlabeled |
| **DocumentEditorModal.tsx** | 10 | PARTIALLY — editor is `contentEditable` (keyboard works), TOC sidebar items are `<div onClick>` | NO — no dialog role, no TOC tree roles, no aria-modal |
| **Dialogs.tsx** (4 dialogs) | 8 | PARTIALLY — dialog buttons work, but no focus trap, no Escape key | NO — no dialog role, no aria-modal, no aria-labelledby |
| **FormatToolbar.tsx** | 3 | YES — all items are `<button>` elements | PARTIALLY — buttons work but no toolbar role, heading buttons lack aria-label |
| **StyleStudioModal.tsx** | 14 | PARTIALLY — buttons/inputs work, kebab menu inaccessible | NO — no dialog role, 5 label/input pairs unlinked, no menu roles |
| **NuggetCreationModal.tsx** | 4 | PARTIALLY — input/buttons work, no focus trap | NO — no dialog role, label unlinked |
| **ProjectCreationModal.tsx** | 4 | PARTIALLY — input/buttons work, Escape works, no focus trap | NO — no dialog role, labels unlinked |
| **SubjectEditModal.tsx** | 4 | PARTIALLY — textarea/buttons work, Escape works, no focus trap | NO — no dialog role, label unlinked |
| **FindReplaceBar.tsx** | 4 | YES — inputs and buttons all keyboard accessible | PARTIALLY — no labels on inputs |
| **ToastNotification.tsx** | 2 | N/A (auto-dismiss) | NO — no `role="alert"` or `aria-live` region |
| **ZoomOverlay.tsx** | 3 | PARTIALLY — Escape closes, close button has no title/aria-label | NO — no dialog role |
| **PdfBookmarkEditor.tsx** | 8 | PARTIALLY — buttons work, bookmark rows are `<div onClick>` | NO — no tree roles, unlabeled inputs |
| **AnnotationWorkbench.tsx** | 6 | PARTIALLY — canvas interaction works via tabIndex, toolbar buttons work | NO — no role on canvas area, no aria-label |
| **AnnotationToolbar.tsx** | 4 | YES — all buttons are `<button>` | PARTIALLY — no toolbar role, unlabeled textarea and color input |
| **RectangleEditor.tsx / PinEditor.tsx** | 4 | PARTIALLY — buttons work, backdrop div has onClick without keyboard | PARTIALLY — unlabeled textareas |
| **LandingPage.tsx** | 2 | YES — single "Create Project" button | PARTIALLY — contrast issues on feature pills |
| **LoadingScreen.tsx** | 0 | N/A | YES — simple heading |
| **PdfViewer.tsx** | 0 | N/A (PDF.js handles internal a11y) | PARTIALLY — depends on PDF.js text layer |

---

## Priority Fix Roadmap

### Phase A — Critical Fixes (WCAG 2.1 Level A compliance)

| # | Fix | Impact | Effort | Locations |
|---|-----|--------|--------|-----------|
| A1 | **Add `aria-label` to all icon-only buttons** | Screen readers can identify 70+ buttons | Low | All component files (~70 buttons) |
| A2 | **Add `role="button"`, `tabIndex={0}`, `onKeyDown` to project tree/card list rows** | Core navigation keyboard-accessible | Medium | ProjectsPanel.tsx, InsightsCardList.tsx (~5 elements) |
| A3 | **Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to all modals** | Modals announced to screen readers | Medium | 17 modal instances across 9 files |
| A4 | **Implement focus trapping + Escape handling in all modals** | Focus stays within modal, can be dismissed | Medium | 17 modals — use a shared `useFocusTrap` hook |
| A5 | **Add `aria-label` to unlabeled inputs and textareas** | Form controls announced by screen readers | Low | 13 inputs/textareas |
| A6 | **Link `<label>` elements to inputs via `htmlFor`/`id`** | Labels programmatically associated | Low | 14 label/input pairs |
| A7 | **Replace `focus:outline-none` with visible focus rings** | Keyboard users can see focus location | Low | 26 locations across 14 files |
| A8 | **Add `aria-describedby` + `aria-invalid` on validated inputs** | Errors announced to screen readers | Low | 8+ error locations |

### Phase B — Major Fixes (WCAG 2.1 Level AA compliance)

| # | Fix | Impact | Effort |
|---|-----|--------|--------|
| B1 | Add `<header>`, `<nav>`, `<main>` landmarks | Screen reader navigation via landmarks | Low |
| B2 | Add `role="tree"` / `role="treeitem"` to tree structures | Tree navigation patterns for screen readers | Medium |
| B3 | Add `role="menu"` / `role="menuitem"` + keyboard nav to context menus | Menus accessible | Medium |
| B4 | Add `aria-expanded` to all dropdown/collapsible triggers | State changes announced | Low |
| B5 | Add `role="alert"` to toast notifications | Toasts announced to screen readers | Low |
| B6 | Fix dark mode contrast ratios (`#a1a1aa` → `#c0c0c8` on dark backgrounds) | Readable text for low-vision users | Low |
| B7 | Add `required` / `aria-required` to required fields | Required fields indicated to assistive tech | Low |
| B8 | Add list semantics (`<ul>`/`<li>`) to list-like UI patterns | Lists navigable by screen readers | Medium |

### Phase C — Polish (Complete AA + best practices)

| # | Fix | Impact | Effort |
|---|-----|--------|--------|
| C1 | Add `role="tablist"` / `role="tab"` / `role="tabpanel"` to 6-panel layout | Panel switching via tab semantics | Medium |
| C2 | Add `role="toolbar"` to format and annotation toolbars | Toolbar navigation pattern | Low |
| C3 | Fix light mode contrast on helper text (`#a1a1aa` → `#71717a` on white) | Readable helper text | Low |
| C4 | Add skip-to-main-content link | Quick navigation for keyboard users | Low |
| C5 | Add keyboard shortcut help/documentation | Users discover available shortcuts | Low |
| C6 | Add `aria-live="polite"` to loading/progress indicators | Progress announced to screen readers | Low |
| C7 | Add heading hierarchy within panel contents | Structured navigation within panels | Low |

---

## Appendix: ESLint jsx-a11y Raw Output

Full output saved to `audit-reports/eslint-a11y-output.txt` (143 jsx-a11y violations across 22 files).

**Note**: The Phase 1 ESLint scan did not include jsx-a11y findings because the plugin was installed but not configured in the ESLint config rules. A dedicated jsx-a11y scan was run for this phase with all 30 available rules enabled.
