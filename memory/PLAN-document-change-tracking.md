# PLAN: Document Change Tracking for Insights Nuggets

## Problem
When documents are added, removed, or edited, the AI in insights chat has no awareness of the change. Cards generated before a change may be stale but the user has no indication.

## Design Decisions

### Single Entry Point for Document Changes
**Before:** Three places could modify an insights nugget's documents:
1. Sidebar kebab → Settings → "View/Update Documents" → `DocumentUpdateModal`
2. Sidebar documents section → inline X button (remove)
3. Sidebar documents section → "Manage documents" → `DocumentUpdateModal`

**After:** Only ONE entry point:
- Sidebar documents section → "Manage documents" → `DocumentUpdateModal`

**Remove:**
- Sidebar kebab menu: remove **Settings** option for all nuggets → replace with **Rename** only (rename inline or via simple prompt). Keep **Delete**.
- Sidebar inline X buttons on documents: remove entirely.
- `NuggetSettingsModal`: remove completely (it only provided rename + type badge + document link/count). Rename moves to kebab menu.

### Change Tracking in DocumentUpdateModal
When user clicks **UPDATE** in `DocumentUpdateModal`, compute a diff:
- Which documents were **added** (new IDs not in previous set)
- Which documents were **removed** (old IDs not in new set)
- Store this as a `pendingDocumentChange` on the nugget

For document **content edits**: Out of scope for this plan. Document editing doesn't currently exist in the app — documents are uploaded once and their content is immutable. If document re-upload/replacement is added later, the same mechanism can be extended.

### AI Notification
When `pendingDocumentChange` exists and user sends the next chat message, prepend a system-level change notification to the conversation. The notification:
- Is a **visible system message** in the chat UI (so user sees what the AI was told)
- Describes what changed briefly: "Documents updated: added [X], removed [Y]"
- Instructs the AI to take changes into consideration

A new prompt template `buildDocumentChangeNotification(added, removed)` in `utils/prompts/insightsChat.ts` generates the brief notification text.

**Alternative considered:** Silent injection into system blocks. Rejected because user should see exactly what the AI knows about the change.

### Stale Card Marking
When documents change (add/remove via DocumentUpdateModal), mark ALL existing headings in that nugget with a `staleReason` field:
- `Heading.staleReason?: string` — e.g., "Documents changed: report.pdf removed, analysis.pdf added"
- When `staleReason` is set, show a visual indicator (amber warning dot) in `InsightsHeadingList`
- The stale marker is cleared when the heading's card is regenerated

This applies to **Insights nuggets only** (Synthesis nuggets have a single immutable document snapshot).

---

## Implementation Steps

### Step 1: Simplify Nugget Kebab Menu
**File:** `components/FileSidebar.tsx`

Replace the kebab menu for nuggets:
- Remove "Settings" button
- Add "Rename" button (opens inline rename or uses `window.prompt`)
- Keep "Delete" button

**File:** `App.tsx`
- Remove `nuggetSettingsId` state and all `NuggetSettingsModal` rendering
- Remove `NuggetSettingsModal` import
- Add inline rename handler that calls `updateNugget(id, n => ({...n, name: newName}))`

**File:** `components/NuggetSettingsModal.tsx`
- Delete this file entirely

### Step 2: Remove Inline X Buttons from Sidebar Document List
**File:** `App.tsx` (lines ~1046-1062)

Remove the X button from each document row in the sidebar. Documents can only be managed via "Manage documents" → `DocumentUpdateModal`.

### Step 3: Add `staleReason` to Heading Type
**File:** `types.ts`

Add to `Heading` interface:
```typescript
/** Set when source documents changed after this heading was created/generated. Cleared on regeneration. */
staleReason?: string;
```

### Step 4: Track Changes in DocumentUpdateModal
**File:** `components/DocumentUpdateModal.tsx`

Extend `onUpdate` callback to also pass change info. Two options:
- **Option A**: Compute diff inside modal, pass to a new `onDocumentsChanged` callback
- **Option B**: Compute diff in App.tsx by comparing before/after `documentIds`

**Go with Option B** — keep modal simple, compute diff in App.tsx.

**File:** `App.tsx`

In the `DocumentUpdateModal` `onUpdate` handler:
1. Capture `previousIds` before the update
2. After update, compute `addedIds` and `removedIds`
3. Resolve names from `documents[]`
4. If any changes: mark all headings in the nugget as stale + store a `pendingDocumentChange` on the nugget
5. Inject a visible system-type message into the chat

### Step 5: Add `pendingDocumentChange` to Nugget Type
**File:** `types.ts`

```typescript
export interface DocumentChange {
  addedNames: string[];
  removedNames: string[];
  timestamp: number;
}

export interface Nugget {
  // ... existing fields ...
  pendingDocumentChange?: DocumentChange;  // set when docs change, cleared after AI is notified
}
```

### Step 6: Create Change Notification Prompt
**File:** `utils/prompts/insightsChat.ts`

```typescript
export function buildDocumentChangeNotification(added: string[], removed: string[]): string {
  const parts: string[] = [];
  if (added.length > 0) parts.push(`Added: ${added.join(', ')}`);
  if (removed.length > 0) parts.push(`Removed: ${removed.join(', ')}`);
  return `[Document Update] ${parts.join(' | ')}. Take these changes into consideration for all subsequent responses. Review your understanding of the available documents.`;
}
```

### Step 7: Inject Change Notification into Chat
**File:** `hooks/useInsightsChat.ts`

When `sendMessage` is called and `selectedNugget.pendingDocumentChange` exists:
1. Before sending, insert a visible "system" message into the chat history (new role: `'system'` on ChatMessage, displayed differently in UI)
2. Include the change text in the messages array sent to Claude
3. Clear `pendingDocumentChange` from the nugget

### Step 8: Show System Messages in Chat UI
**File:** The chat message rendering component (need to find)

Add rendering for `role: 'system'` messages — styled as a centered, muted banner/pill (not a user bubble, not an assistant bubble). Example: gray background, smaller text, centered, with an info icon.

### Step 9: Stale Indicator in InsightsHeadingList
**File:** `components/InsightsHeadingList.tsx`

When `heading.staleReason` is set:
- Show amber/orange warning indicator (replace or augment existing dots)
- Tooltip shows the stale reason
- Visual: ⚠ icon or pulsing amber dot

### Step 10: Clear Stale on Regeneration
**File:** `hooks/useSynthesis.ts`

In `performSynthesis` and `generateCardForHeading`, when writing results back to the heading, also clear `staleReason`:
```typescript
updateNuggetHeading(heading.id, h => ({
  ...h,
  staleReason: undefined,  // clear stale marker
  // ... other updates
}));
```

### Step 11: Strip `staleReason` and `pendingDocumentChange` from Persistence
**File:** `utils/storage/serialize.ts` or `hooks/usePersistence.ts`

These are runtime-only fields that should NOT persist:
- `staleReason` on headings — transient per session
- Actually, on reflection, `staleReason` SHOULD persist. If user changes docs and closes browser, the staleness should survive reload.
- `pendingDocumentChange` SHOULD also persist — if user changes docs, closes browser, reopens, the AI should still be notified on next message.

→ Both fields persist. No stripping needed.

---

## Files Changed Summary
| File | Action |
|------|--------|
| `types.ts` | Add `staleReason` to Heading, `DocumentChange` interface, `pendingDocumentChange` to Nugget |
| `components/FileSidebar.tsx` | Replace Settings with Rename in kebab menu |
| `components/NuggetSettingsModal.tsx` | **Delete** |
| `components/DocumentUpdateModal.tsx` | No changes (diff computed in App.tsx) |
| `App.tsx` | Remove NuggetSettingsModal, remove inline X, add diff computation on doc update, add rename handler |
| `utils/prompts/insightsChat.ts` | Add `buildDocumentChangeNotification` |
| `hooks/useInsightsChat.ts` | Inject change notification, clear pendingDocumentChange |
| `components/InsightsHeadingList.tsx` | Add stale visual indicator |
| `hooks/useSynthesis.ts` | Clear `staleReason` on synthesis/generation |
| Chat UI component | Render system messages differently |
| `types.ts` (ChatMessage) | Add `'system'` to role union |
