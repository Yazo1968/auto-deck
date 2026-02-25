# Dark Mode Implementation Plan

## 1. Overview

This document defines the full scope, requirements, and implementation plan for adding dark mode support to InfoNugget. The app currently has zero dark mode infrastructure — all colors are hardcoded light-mode values across ~20+ component files, inline styles in `index.html`, and CSS variables.

**Estimated scope:** ~300+ color-related class instances across the codebase, plus CSS variables and inline styles.

---

## 2. Current State

### Tailwind CSS Setup
- Tailwind is loaded via **CDN** (`<script src="https://cdn.tailwindcss.com"></script>` in `index.html`)
- **No local Tailwind config file** exists — no `tailwind.config.js` or `.ts`
- Dark mode is **not configured**
- No PostCSS pipeline

### Color System
- **No CSS variable-based theme system** for component colors
- Colors are hardcoded Tailwind classes (`bg-white`, `text-zinc-600`, `border-zinc-200`, etc.)
- A few CSS variables exist in `index.html` for document prose styling (`--acid-h1`, `--acid-h2`, `--accent-blue`)
- Inline styles used for gradients and specific hex values in several components

### Existing Dark Surfaces
- `LandingPage.tsx` already uses a dark background (`#0a0a0a`) — this is intentional design, not dark mode
- `LoadingScreen.tsx` also uses dark background (`#0a0a0a`)
- These two components would need **no change** or **minimal adjustment** in dark mode

---

## 3. Requirements

### Functional
1. User can toggle between light and dark mode
2. Preference persists across sessions (localStorage)
3. Optionally respects system preference (`prefers-color-scheme`) on first visit
4. Toggle accessible from the app header/settings area
5. Transition between modes should be smooth (CSS transition on background/color)

### Visual
1. Dark mode uses a dark zinc/slate palette (not pure black)
2. Accent blue (`#2a9fd4`) remains the same in both modes (already works on dark)
3. Semantic colors (error red, warning amber, success green, info blue) adapt to dark backgrounds
4. Shadows shift from black-on-white to lighter/subtler on dark surfaces
5. Borders shift from light gray to dark gray

### Out of Scope
- User-defined custom style palettes (Style Studio) are **not affected** — they represent design intent for generated cards, not UI theming
- Generated card images are **not affected** — they render independently of UI theme
- The document prose viewer may need separate consideration (content readability)

---

## 4. Color Audit Summary

### Usage by Category

| Category | Light Mode Values | Dark Mode Target | Instance Count |
|----------|-------------------|------------------|----------------|
| Primary background | `bg-white` | `bg-zinc-900` | ~40+ |
| Secondary background | `bg-zinc-50`, `bg-zinc-100` | `bg-zinc-800`, `bg-zinc-800/50` | ~25 |
| Primary text | `text-zinc-800`, `text-zinc-900` | `text-zinc-100`, `text-zinc-200` | ~30 |
| Secondary text | `text-zinc-500`, `text-zinc-600` | `text-zinc-400`, `text-zinc-300` | ~50 |
| Muted text | `text-zinc-400` | `text-zinc-500` | ~15 |
| Borders | `border-zinc-100`, `border-zinc-200` | `border-zinc-700`, `border-zinc-700` | ~40 |
| Hover backgrounds | `hover:bg-zinc-100` | `hover:bg-zinc-700` | ~30 |
| Active/selected | `bg-zinc-200` | `bg-zinc-700` | ~15 |
| Modal overlays | `bg-black/20`, `bg-black/50` | `bg-black/40`, `bg-black/60` | ~15 |
| Accent (blue) | `bg-accent-blue` | Same (no change) | ~30 |
| Semantic (error/warn/etc) | `bg-red-50`, `bg-amber-50`, etc. | `bg-red-950`, `bg-amber-950`, etc. | ~25 |

### Components by Change Volume

**High (15+ color instances each):**
- `App.tsx` — main layout, header, gradient background
- `components/AssetsPanel.tsx` — toolbar menus, dropdowns, color pickers
- `components/Dialogs.tsx` — modals, buttons, inputs
- `components/StyleStudioModal.tsx` — editor panels, sidebar, inputs
- `components/ProjectsPanel.tsx` — panels, lists, info cards
- `components/DocumentEditorModal.tsx` — editor chrome, toolbar
- `components/FormatToolbar.tsx` — buttons, active states

**Medium (8-15 color instances each):**
- `components/FileList.tsx`
- `components/FileUpload.tsx`
- `components/FindReplaceBar.tsx`
- `components/NuggetCreationModal.tsx`
- `components/NuggetSettingsModal.tsx`
- `components/UploadView.tsx`
- `components/ChatPanel.tsx`
- `components/SourcesPanel.tsx`
- `components/CardsPanel.tsx`
- `components/InsightsCardList.tsx`

**Low (< 8 color instances each):**
- `components/Header.tsx`
- `components/ZoomOverlay.tsx`
- `components/InsightsDocViewer.tsx`
- `components/ToastNotification.tsx`
- `components/PdfViewer.tsx`
- `components/PdfUploadChoiceDialog.tsx`
- `components/ProjectCreationModal.tsx`
- `components/workbench/AnnotationToolbar.tsx`
- `components/workbench/AnnotationWorkbench.tsx`
- `components/workbench/PinEditor.tsx`
- `components/workbench/RectangleEditor.tsx`

**No change needed:**
- `components/LandingPage.tsx` — already dark
- `components/LoadingScreen.tsx` — already dark

---

## 5. Special Considerations

### 5.1 Inline Styles
Several components use inline `style={{}}` with hardcoded colors. These cannot use Tailwind's `dark:` prefix and need alternative handling:

| File | Inline Style | Solution |
|------|-------------|----------|
| `App.tsx` | `linear-gradient(180deg, #f0f4f8 ...)` background | CSS variable or conditional inline style |
| `index.html` | `background-color: #ffffff`, `color: #27272a` | Add `.dark` selector variants |
| `index.html` | Table row colors `#fafafa`, `#fcfcfc` | CSS variable or `.dark` selectors |
| `index.html` | Blockquote `background: #f9fafb` | CSS variable or `.dark` selectors |

### 5.2 CSS Variables in index.html
These need dark-mode counterparts:

```css
/* Current (light) */
:root {
  --acid-h1: #27272a;
  --acid-h2: #3f3f46;
  --acid-h3: #52525b;
  --accent-blue: #2a9fd4;
}

/* Needed (dark) */
:root.dark {
  --acid-h1: #f4f4f5;
  --acid-h2: #e4e4e7;
  --acid-h3: #d4d4d8;
  --accent-blue: #2a9fd4;  /* unchanged */
}
```

### 5.3 SVG Icons
- Most SVGs use `stroke="currentColor"` — these adapt automatically via text color
- A few have hardcoded stroke/fill colors (e.g., `stroke="#3b82f6"`) — need review

### 5.4 Shadows
- Light mode: dark shadows on light backgrounds (`rgba(0,0,0,0.04)`)
- Dark mode: shadows are less visible on dark backgrounds — may need lighter/more subtle shadows or colored shadows

### 5.5 Document Prose Content
- The document viewer renders user content with prose styling defined in `index.html`
- All prose styles (headings, tables, blockquotes, code blocks, lists) need dark variants
- Must maintain readability — this is the most sensitive area

### 5.6 Generated Card Images
- Card images are raster images with their own style/palette — NOT affected by dark mode
- The card preview area should have a **neutral backdrop** that works in both modes (already mostly fine since cards sit in their own container)

---

## 6. Implementation Plan

### Phase 1: Infrastructure Setup

**Step 1.1: Tailwind Dark Mode Configuration**

Since Tailwind is loaded via CDN, configure dark mode via the inline config script in `index.html`:

```html
<script>
  tailwind.config = {
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          'accent-blue': '#2a9fd4',
        }
      }
    }
  }
</script>
```

**Step 1.2: Theme State Management**

Add to `context/AppContext.tsx`:
- `darkMode: boolean` state
- `toggleDarkMode()` callback
- On init: read from `localStorage`, fall back to `prefers-color-scheme`
- On change: toggle `dark` class on `document.documentElement`, persist to `localStorage`

**Step 1.3: Theme Toggle UI**

Add a moon/sun icon toggle button in the header (`components/Header.tsx`), or alongside the existing settings area.

**Step 1.4: Dark Mode CSS Variables**

Add to `index.html` `<style>` block:
- `.dark` selector overrides for all CSS variables (`--acid-h1`, `--acid-h2`, etc.)
- `.dark body` background and text color overrides
- `.dark` variants for all document prose styles (tables, blockquotes, code blocks)
- Smooth transition: `html { transition: background-color 0.2s, color 0.2s; }`

### Phase 2: Core Layout (App Shell)

**Files:** `App.tsx`, `index.html`

- Replace gradient background with CSS variable or conditional class
- Add `dark:` variants to main layout containers
- Update header background and text colors
- Update sidebar/panel backgrounds

### Phase 3: Component Updates (Systematic)

Work through each component file, adding `dark:` prefix variants to all color classes. The mapping is consistent:

```
bg-white           → dark:bg-zinc-900
bg-zinc-50         → dark:bg-zinc-800
bg-zinc-100        → dark:bg-zinc-800/50
bg-zinc-200        → dark:bg-zinc-700
text-zinc-800/900  → dark:text-zinc-100/200
text-zinc-600      → dark:text-zinc-300
text-zinc-500      → dark:text-zinc-400
text-zinc-400      → dark:text-zinc-500
border-zinc-100    → dark:border-zinc-700
border-zinc-200    → dark:border-zinc-700
hover:bg-zinc-100  → dark:hover:bg-zinc-700
shadow-*           → dark:shadow-* (adjust opacity/color)
```

**Order of implementation (by priority):**

1. **Modals & Dialogs** — `Dialogs.tsx`, `NuggetCreationModal.tsx`, `NuggetSettingsModal.tsx`, `ProjectCreationModal.tsx`, `StyleStudioModal.tsx`, `DocumentEditorModal.tsx`, `PdfUploadChoiceDialog.tsx`
2. **Panels** — `AssetsPanel.tsx`, `ProjectsPanel.tsx`, `SourcesPanel.tsx`, `CardsPanel.tsx`, `ChatPanel.tsx`, `InsightsCardList.tsx`
3. **Toolbar & Controls** — `FormatToolbar.tsx`, `FindReplaceBar.tsx`, `Header.tsx`, `workbench/AnnotationToolbar.tsx`
4. **Upload & File** — `FileUpload.tsx`, `FileList.tsx`, `UploadView.tsx`
5. **Viewers** — `InsightsDocViewer.tsx`, `PdfViewer.tsx`, `ZoomOverlay.tsx`
6. **Notifications** — `ToastNotification.tsx`
7. **Workbench** — `workbench/AnnotationWorkbench.tsx`, `workbench/PinEditor.tsx`, `workbench/RectangleEditor.tsx`, `workbench/CanvasRenderer.ts`

### Phase 4: Document Prose Styling

**File:** `index.html` (inline `<style>` block)

Add `.dark` overrides for all prose elements:
- Headings (h1-h6): light text on dark background
- Tables: dark header/stripe colors
- Blockquotes: dark background with accent border
- Code blocks: dark background
- Links: ensure accent-blue is readable
- Lists: adapt bullet/marker colors
- Horizontal rules: lighter on dark

### Phase 5: Polish & Edge Cases

1. **Transition animation** — ensure smooth light/dark switch
2. **Focus rings** — verify focus outlines are visible in both modes
3. **Scrollbar styling** — if custom, needs dark variant
4. **Color picker inputs** — verify they work on dark backgrounds
5. **Loading states / spinners** — check contrast
6. **Empty states** — verify placeholder text/icons are visible
7. **Inline style components** — handle with conditional logic or CSS variables

---

## 7. File Change Summary

| File | Change Type | Effort |
|------|-------------|--------|
| `index.html` | Tailwind config, CSS variable dark overrides, prose dark styles | High |
| `context/AppContext.tsx` | Add darkMode state + toggle + persistence | Low |
| `App.tsx` | dark: variants on layout, conditional gradient | Medium |
| `components/Header.tsx` | Theme toggle button, dark: variants | Low |
| `components/AssetsPanel.tsx` | dark: variants (many classes) | High |
| `components/Dialogs.tsx` | dark: variants | Medium |
| `components/StyleStudioModal.tsx` | dark: variants (many classes) | High |
| `components/ProjectsPanel.tsx` | dark: variants | Medium |
| `components/DocumentEditorModal.tsx` | dark: variants | Medium |
| `components/FormatToolbar.tsx` | dark: variants | Medium |
| `components/FileList.tsx` | dark: variants | Low-Medium |
| `components/FileUpload.tsx` | dark: variants | Low-Medium |
| `components/FindReplaceBar.tsx` | dark: variants | Low |
| `components/NuggetCreationModal.tsx` | dark: variants | Low-Medium |
| `components/NuggetSettingsModal.tsx` | dark: variants | Low-Medium |
| `components/UploadView.tsx` | dark: variants | Low-Medium |
| `components/ChatPanel.tsx` | dark: variants | Low-Medium |
| `components/SourcesPanel.tsx` | dark: variants | Low-Medium |
| `components/CardsPanel.tsx` | dark: variants | Low-Medium |
| `components/InsightsCardList.tsx` | dark: variants | Low |
| `components/ToastNotification.tsx` | dark: semantic color variants | Low |
| `components/ZoomOverlay.tsx` | dark: variants | Low |
| `components/InsightsDocViewer.tsx` | dark: variants | Low |
| `components/PdfViewer.tsx` | dark: variants | Low |
| `components/PdfUploadChoiceDialog.tsx` | dark: variants | Low |
| `components/ProjectCreationModal.tsx` | dark: variants | Low |
| `components/workbench/AnnotationToolbar.tsx` | dark: variants | Low |
| `components/workbench/AnnotationWorkbench.tsx` | dark: variants | Low |
| `components/workbench/PinEditor.tsx` | dark: variants | Low |
| `components/workbench/RectangleEditor.tsx` | dark: variants | Low |
| `components/LandingPage.tsx` | No change (already dark) | None |
| `components/LoadingScreen.tsx` | No change (already dark) | None |

**Total files to modify:** ~30
**Total color instances to update:** ~300+

---

## 8. Dark Mode Color Palette Reference

### Backgrounds
| Purpose | Light | Dark |
|---------|-------|------|
| App background | `#f0f4f8` gradient | `#18181b` (zinc-900) |
| Surface / card | `#ffffff` | `#27272a` (zinc-800) |
| Subtle surface | `#fafafa` (zinc-50) | `#3f3f46` (zinc-700) |
| Hover | `#f4f4f5` (zinc-100) | `#3f3f46` (zinc-700) |
| Active/selected | `#e4e4e7` (zinc-200) | `#52525b` (zinc-600) |

### Text
| Purpose | Light | Dark |
|---------|-------|------|
| Primary | `#27272a` (zinc-800) | `#f4f4f5` (zinc-100) |
| Secondary | `#52525b` (zinc-600) | `#d4d4d8` (zinc-300) |
| Muted | `#a1a1aa` (zinc-400) | `#71717a` (zinc-500) |
| Disabled | `#d4d4d8` (zinc-300) | `#52525b` (zinc-600) |

### Borders
| Purpose | Light | Dark |
|---------|-------|------|
| Default | `#f4f4f5` (zinc-100) | `#3f3f46` (zinc-700) |
| Emphasized | `#e4e4e7` (zinc-200) | `#52525b` (zinc-600) |
| Strong | `#d4d4d8` (zinc-300) | `#71717a` (zinc-500) |

### Accent
| Purpose | Light | Dark |
|---------|-------|------|
| Primary accent | `#2a9fd4` | `#2a9fd4` (unchanged) |
| Accent hover | darken 10% | lighten 10% |

### Semantic
| Type | Light BG | Dark BG | Light Text | Dark Text |
|------|----------|---------|------------|-----------|
| Error | `red-50` | `red-950` | `red-700` | `red-300` |
| Warning | `amber-50` | `amber-950` | `amber-700` | `amber-300` |
| Info | `blue-50` | `blue-950` | `blue-700` | `blue-300` |
| Success | `emerald-50` | `emerald-950` | `emerald-700` | `emerald-300` |

---

## 9. Verification Plan

1. **Visual inspection** — Toggle dark mode and verify every component:
   - All text is legible (sufficient contrast)
   - No white/light backgrounds remain
   - Borders and dividers are visible but subtle
   - Modals and overlays look correct on dark backdrop
   - Toast notifications are readable
   - Accent blue elements have good contrast

2. **Document prose** — Open a document with headings, tables, blockquotes, code blocks, lists and verify readability in both modes

3. **Persistence** — Toggle to dark, refresh page — should remain dark. Toggle to light, refresh — should remain light.

4. **System preference** — Clear localStorage, set system to dark mode — app should default to dark

5. **Generated cards** — Card images should look correct regardless of UI theme (no color contamination)

6. **Style Studio** — Custom style colors should display correctly in both modes (color swatches, previews)

7. **Edge cases** — Color picker inputs, file upload drag states, loading spinners, empty states, disabled buttons
