# CLAUDE.md

## Project Overview

InfoNugget v6.0 is a client-side React SPA (no backend) for AI-powered content card generation. Users organize work into Projects > Nuggets > Documents, then use AI to synthesize content cards with generated imagery.

- **Stack**: React 19 + TypeScript 5.8 + Vite 6, no backend server
- **AI**: Claude Sonnet 4.6 (text/chat via direct browser fetch) + Gemini Flash/Pro Image (via `@google/genai` SDK)
- **Persistence**: IndexedDB (`infonugget-db`), auto-save with debounce
- **State**: React Context (split into focused contexts under `context/`), no Redux/Zustand
- **Styling**: Inline styles + CSS custom properties + Tailwind-style utility classes, dark mode via `dark` class toggle
- **Entry point**: `index.tsx` → `StorageProvider` → `ToastProvider` → `App`

## Build & Run

```bash
npm run dev       # Start dev server on port 3000
npm run build     # Production build
npx tsc --noEmit  # Type-check only
```

**Known pre-existing TS errors to ignore** (do not attempt to fix unless specifically asked):
- `components/AutoDeckPanel.tsx` — `.length` on union type, boolean assignability
- `reference files (unused)/contentGeneration.backup.ts` — missing module

**Dev server proxy**: Vite proxies `/api/anthropic-files` → `https://api.anthropic.com/v1/files` (CORS workaround for the Files API beta).

## Environment Variables

Defined in `.env.local`, injected at build time via `vite.config.ts`:

- `GEMINI_API_KEY` (required) — primary Gemini key
- `GEMINI_API_KEY_FALLBACK` (optional) — fallback Gemini key
- `ANTHROPIC_API_KEY` (required) — Claude API key

Never commit `.env.local`. Never log or expose API keys in UI code.

## File Organization

```
index.tsx                  # App entry point
App.tsx                    # Main orchestrator (~1260 lines), panel layout, modal coordination
types.ts                   # All shared interfaces
context/                   # React Context providers (split architecture)
  AppContext.tsx            # Composition hook (useAppContext) + CRUD helpers
  NuggetContext.tsx         # Nugget state + operations
  ProjectContext.tsx        # Project state + operations
  SelectionContext.tsx      # Selection state (project/nugget/doc IDs)
  StyleContext.tsx          # Styling options + dark mode
  ThemeContext.tsx          # Theme provider
components/                # React components (PascalCase, default export)
  workbench/               # Annotation/canvas sub-components
hooks/                     # Custom hooks (camelCase with `use` prefix)
utils/                     # Pure utility functions
  ai.ts                    # AI clients, key rotation, retry, Files API helpers
  prompts/                 # Prompt builders for each AI pipeline
  storage/                 # IndexedDB backend + serialization
  autoDeck/                # Auto-Deck constants + parsers
```

## Conventions

- **Semicolons**: yes
- **Quotes**: single
- **Indent**: 2 spaces
- **Components**: PascalCase filename, default export, props interface named `ComponentNameProps`
- **Hooks**: camelCase with `use` prefix
- **Constants**: SCREAMING_SNAKE_CASE
- **State updates**: always immutable (spread operators)
- **Error handling**: try/catch + toast notifications
- **Import order**: React → types → utils → components
- **Tests**: Vitest (81 tests across 7 test files)

## Key Architecture Patterns

### 3-Phase Card Pipeline
Content Synthesis (Claude) → Layout Planning (Claude) → Image Generation (Gemini Pro Image). See `hooks/useCardGeneration.ts`.

### Document Ownership
Documents belong to individual nuggets (not a shared library). Each has a `sourceType`: `'markdown'` or `'native-pdf'`.

### MetaTOC System
Native PDFs get a companion MetaTOC markdown file uploaded to the Anthropic Files API. Edits are transactional: draft → save/discard with a hard lock overlay. See `utils/metaToc.ts` (if present) and `components/SourcesPanel.tsx`.

### 6-Panel Layout
Flex row: Projects | Sources | Chat | Auto-Deck | Cards | Assets. The first 4 side panels use strip buttons in flow + portal overlays (`createPortal` to `document.body`). Strips overlap via `-ml-2.5`. Shared overlay logic is in `hooks/usePanelOverlay.ts`.

### Z-Index Stacking (highest → lowest)
- Modals/Dialogs: `z-[120]`
- Main Header: `z-[110]`
- Projects panel: `z-[108]` (strip `z-20`)
- Sources panel: `z-[107]` (strip `z-10`)
- Hard lock overlay: `z-[106]`
- Chat panel: `z-[105]` (strip `z-[2]`)
- Auto-Deck panel: `z-[104]` (strip `z-[1]`)
- Cards/Assets: `z-[103]`
- Footer: `z-[102]`

### CSS Custom Properties for Tree Highlight
The project tree sidebar uses `--tree-active`, `--tree-text`, `--tree-icon`, `--tree-text-dim`, `--tree-icon-dim` tokens defined in `index.html` with light/dark variants. Always use these tokens for sidebar item colors — never hardcode rgba values.

### Prompt Anti-Leakage
Markdown content is converted to bracketed tags via `transformContentToTags()`, font names to descriptors, hex colors to color names — all to prevent prompt content from leaking into AI-generated outputs. See `utils/prompts/promptUtils.ts`.

## Code Modification Safety

* Never delete, remove, or modify any code without first searching the entire project for all references, including dynamic imports, string-based lookups, configuration files, callback registrations, and computed property access.
* Before removing any function, method, or exported member, confirm zero references exist across all files including configs, tests, scripts, and markup.
* Before deleting any file, verify it is not an entry point, not referenced in any config, not dynamically imported, and not a public asset.
* Never remove a dependency without checking config files, build tool plugins, peer dependency requirements, and CLI script usage.
* When making changes across multiple files, work in small batches. After each batch, run the build and start the app to confirm nothing is broken.
* If a build or run fails after a change, immediately revert that specific change before continuing.
* For work outside of approved remediation batches, report what you plan to change and wait for approval before modifying functions, exports, files, or dependencies. Imports and unused variables can be cleaned without approval.
* When in doubt, leave it. A few lines of unused code cost nothing. A broken app costs everything.

## Code Quality Remediation (Completed)

Batches 1–5 from `audit-reports/CONSOLIDATED-AUDIT-REPORT.md` have been executed. Key outcomes:
- Context split: monolithic `AppContext` → 5 focused contexts + composition hook
- Prop drilling: ~60 redundant props removed across 7 components
- Duplication: shared `usePanelOverlay` hook (4 panels), `callClaudeWithFileApiDocs` utility (3 call sites)
- Lint: `exhaustive-deps` warnings reduced from 40 → 0 (bugs fixed, intentional omissions documented)
- App.tsx reduced from ~1700 → ~1260 lines
- Error boundary added (`components/ErrorBoundary.tsx`)
