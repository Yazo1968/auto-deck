# Conventions & Patterns

## Code Style

- **Quotes**: Single quotes for strings in TypeScript/TSX (`'value'`, not `"value"`). Double quotes used only in JSX attribute values (`className="..."`) and JSON files.
- **Semicolons**: Required at end of every statement.
- **Indentation**: 2 spaces (no tabs).
- **Line endings**: Unix LF.
- **Trailing commas**: Used in multi-line arrays and objects.
- **Component files**: One default export per file; the export name matches the filename.
- **Import order**: React imports → type imports → utility imports → component imports.

Example from `components/Header.tsx`:

```tsx
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="flex flex-col items-center space-y-4">
      <div className="w-12 h-12 bg-accent-blue rounded-full flex items-center justify-center shadow-lg shadow-[rgba(42,159,212,0.2)]">
        <div className="w-4 h-4 bg-white rounded-sm rotate-45"></div>
      </div>
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-light tracking-tight italic">
          info<span className="font-semibold not-italic">nugget</span>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-xs font-light max-w-xs">
          Condense knowledge into digestible insights.
        </p>
      </div>
    </header>
  );
};

export default Header;
```

## Component Pattern

All components are function components with `React.FC` type annotation. Props are defined in a local interface named `ComponentNameProps`. The component is a default export.

Example structure (condensed from `components/Header.tsx` and the broader codebase pattern):

```tsx
import React from 'react';
import { SomeType } from '../types';

interface MyComponentProps {
  value: string;
  onChange: (v: string) => void;
}

const MyComponent: React.FC<MyComponentProps> = ({ value, onChange }) => {
  return <div>{value}</div>;
};

export default MyComponent;
```

Components that need context consume it directly via `useAppContext()`. Components that need toasts call `useToast()`. Neither requires prop drilling for these concerns.

Modals and overlays are rendered via `createPortal(element, document.body)` to escape the flex layout stacking context. This is used in `AutoDeckPanel`, `DocumentEditorModal`, `Dialogs`, `ToastNotification`, and `ZoomOverlay`.

## State Management Pattern

State lives in one of two places: the global `AppContext` (for data that must survive panel switches or is needed by multiple panels) or local `useState` in `App.tsx` (for UI state like modal visibility, `expandedPanel`, drag state).

### Providing state (from `context/AppContext.tsx`)

```tsx
const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{
  children: React.ReactNode;
  initialState?: InitialPersistedState;
}> = ({ children, initialState }) => {
  const [nuggets, setNuggets] = useState<Nugget[]>(initialState?.nuggets ?? []);
  const [selectedNuggetId, setSelectedNuggetId] = useState<string | null>(
    initialState?.selectedNuggetId ?? null
  );

  const selectedNugget = useMemo(
    () => nuggets.find(n => n.id === selectedNuggetId),
    [nuggets, selectedNuggetId],
  );

  const updateNugget = useCallback((nuggetId: string, updater: (n: Nugget) => Nugget) => {
    setNuggets(prev => prev.map(n => n.id === nuggetId ? updater(n) : n));
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    nuggets, setNuggets,
    selectedNuggetId, setSelectedNuggetId,
    selectedNugget,
    updateNugget,
    // ...all other helpers
  }), [nuggets, selectedNuggetId, selectedNugget, updateNugget /* ... */]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
```

### Consuming state

```tsx
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside <AppProvider>');
  return ctx;
}

// In any component:
const { nuggets, selectedNugget, updateNugget } = useAppContext();
```

### State update convention

All state updates use immutable spread operators. Mutation is never used directly on state objects.

```tsx
// Correct:
setNuggets(prev => prev.map(n =>
  n.id === nuggetId ? updater(n) : n
));

// Correct:
updateNugget(id, n => ({ ...n, name: newName, lastModifiedAt: Date.now() }));
```

## Data Fetching / External API Pattern

There is no data fetching from a backend. All external calls go directly to AI provider APIs from the browser. Two patterns are used:

**Claude (direct fetch):** All Claude calls go through `callClaude()` in `utils/ai.ts`. It uses the native `fetch` API targeting `https://api.anthropic.com/v1/messages` with the `anthropic-dangerous-direct-browser-access: true` header. The function wraps the call in `withRetry()` for automatic exponential backoff on 429/500/503 responses.

**Gemini (SDK + retry wrapper):** Gemini calls use the `@google/genai` SDK (`GoogleGenAI` class). All Gemini calls are wrapped in `withGeminiRetry()`, which applies `withRetry()` first, then rotates to the fallback API key if all retries are exhausted on a retryable error.

```ts
// withGeminiRetry from utils/ai.ts
export const withGeminiRetry = async <T,>(
  fn: () => Promise<T>,
  maxRetries = 5,
  onRetry?: (attempt: number, maxAttempts: number, delayMs: number) => void,
): Promise<T> => {
  try {
    return await withRetry(fn, maxRetries, onRetry);
  } catch (err: any) {
    const msg = (err.message || '').toLowerCase();
    const status = err.status || err.httpStatusCode || 0;
    const isRetryable =
      status === 429 || status === 500 || status === 503 ||
      msg.includes('overloaded') || msg.includes('resource_exhausted') ||
      msg.includes('rate limit') || msg.includes('too many requests');

    if (isRetryable && rotateGeminiKey()) {
      console.warn('[withGeminiRetry] Primary key exhausted, retrying with fallback key...');
      return await withRetry(fn, maxRetries, onRetry);
    }
    throw err;
  }
};
```

Backoff is exponential: `delay = min(2^attempt * 1000ms + jitter(0–1000ms), 32000ms)`.

## AI Integration Pattern

### callClaude() — all Claude API calls

`callClaude(prompt, options)` in `utils/ai.ts` supports:
- Single-prompt calls (legacy): `callClaude(prompt, { system: '...' })`
- Structured system blocks with per-block cache control via `systemBlocks: SystemBlock[]`
- Multi-turn messages via `messages: ClaudeMessage[]`
- AbortSignal via `signal: AbortSignal`

System blocks are cached when `cache: true` and the block text is ≥ 4000 characters. The last user message in a multi-turn conversation is automatically wrapped with `cache_control: { type: 'ephemeral' }`.

```ts
// Example from hooks/useCardGeneration.ts (pattern):
const { text: synthesisText, usage } = await callClaude('', {
  systemBlocks: [
    { text: buildSystemPrompt(subject), cache: false },
    { text: buildDocumentContext(docs),  cache: true  },
  ],
  messages: [
    { role: 'user', content: buildContentPrompt(card, detailLevel) },
  ],
  signal: abortController.signal,
});
```

The `CLAUDE_MODEL` constant is `'claude-sonnet-4-6'`. `CLAUDE_MAX_TOKENS` is `64000`.

### Gemini image generation

Gemini Pro Image calls use `PRO_IMAGE_CONFIG = { responseModalities: [Modality.TEXT, Modality.IMAGE] }`. The response is inspected for an image part; its inline data is extracted as a base64 string. All image calls are wrapped in `withGeminiRetry()`.

### Prompt anti-leakage

Before passing document content to the image generation model, all prompts go through sanitization in `utils/prompts/promptUtils.ts`:
- `transformContentToTags()`: converts markdown heading syntax (`#`, `##`, etc.) to bracketed tags (`[TITLE]`, `[SECTION]`, `[SUBSECTION]`, `[DETAIL]`)
- `sanitizePlannerOutput()`: strips font names, hex color codes, point sizes, and pixel values from planner output before it reaches the image model
- `hexToColorName()`: maps hex values to human-readable color names using a 200+ entry lookup table
- `fontToDescriptor()`: maps font family names to visual descriptors (e.g., `"Inter"` → `"clean, geometric sans-serif"`)

## Layout & Panel System

The main app layout is a single flex row containing six panels in order:

```
[ Projects ] [ Sources ] [ Chat ] [ Auto-Deck ] [ Cards (flex-1) ] [ Assets ]
```

The first four panels (Projects, Sources, Chat, Auto-Deck) are collapsible side panels. Each renders a narrow vertical strip button in the flex row. When open, the panel content is rendered via `createPortal` to `document.body`, positioned absolutely over the layout. This allows the panel overlays to use `position: fixed` or `position: absolute` without being clipped by the parent flex container's `overflow: hidden`.

**`expandedPanel` accordion state** (in `App.tsx`):

```tsx
const [expandedPanel, setExpandedPanel] = useState<'projects' | 'sources' | 'chat' | 'auto-deck' | null>(null);
```

Only one panel can be open at a time. Opening any panel sets `expandedPanel` to that panel's name; the previously open panel automatically closes. Setting `expandedPanel` to `null` collapses all panels.

Each panel receives `isOpen={expandedPanel === 'panelName'}` and an `onToggle` callback:

```tsx
<ProjectsPanel
  isOpen={expandedPanel === 'projects'}
  onToggle={() => appGatedAction(() =>
    setExpandedPanel(prev => prev === 'projects' ? null : 'projects')
  )}
  // ...
/>
```

Click-outside is handled in an `App.tsx` `useEffect` that listens to `pointerdown` on `document`. If the click target is outside any `[data-panel-strip]` element and a panel is open, it closes the panel via `appGatedAction`.

**`appGatedAction` — unsaved-changes gating:**

All panel open/close, nugget selection, and navigation actions pass through `appGatedAction`. It checks whether either the cards panel or the sources panel has unsaved edits (`isDirty` via `useImperativeHandle` refs). If dirty, it stores the pending action and shows a confirmation dialog. The action only executes after the user confirms discarding changes or after saving.

```tsx
const appGatedAction = useCallback((action: () => void) => {
  if (cardsPanelRef.current?.isDirty) {
    setAppPendingDirtyPanel('cards');
    setAppPendingAction(() => action);
    return;
  }
  if (sourcesPanelRef.current?.isDirty) {
    setAppPendingDirtyPanel('sources');
    setAppPendingAction(() => action);
    return;
  }
  action();
}, []);
```

**TOC hard lock overlay:** When a native PDF's table of contents is in draft-edit mode, `tocLockActive` is set to `true`. A full-screen overlay at `z-[106]` blocks all UI interaction except the SourcesPanel (which sits at `z-[107]`). The overlay prevents accidental navigation away from an unsaved TOC edit.

## Error Handling Pattern

**Toast notifications** are the primary user-facing error mechanism. Any async handler that can fail wraps its body in `try/catch` and calls `addToast` from `useToast()` on error:

```tsx
const { addToast } = useToast();

try {
  await someAsyncOperation();
} catch (err: any) {
  if (err.name === 'AbortError') return; // user cancelled — no toast
  addToast({ type: 'error', message: `Operation failed: ${err.message}` });
}
```

The `Toast` interface supports four types (`'error' | 'warning' | 'info' | 'success'`), an optional `detail` sub-message, an optional `onRetry` callback that renders a "Retry Now" button, and an optional `duration` in milliseconds (default 6000ms; `0` = manual dismiss only). Toasts are rendered via `createPortal` to `document.body` at `z-[9999]`, centered at the top of the viewport.

**AbortError handling:** All AI calls accept an `AbortSignal`. When a user cancels a generation (e.g., closes a panel mid-generation), the catch block checks `err.name === 'AbortError'` and returns silently without showing a toast.

**Retry progress toasts:** Long-running AI calls with retry logic update a persistent toast (`updateToast(id, { detail: ... })`) to show retry attempt number and delay, giving the user real-time feedback without stacking multiple notifications.

## Testing Pattern

No tests are currently implemented. There is no testing framework configured in `package.json` (no Jest, Vitest, or React Testing Library). No test files exist in the repository.
