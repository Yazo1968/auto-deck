# Migration Plan: Remove Docling + DOCX, Switch to Gemini

## Overview

Replace Docling microservice and Claude-based document conversion with Gemini Flash.
Drop DOCX support entirely (users convert to PDF themselves).

**Before:** PDF → Docling (or Claude fallback), DOCX → JSZip + Claude, MD → passthrough
**After:** PDF → Gemini Flash, MD → passthrough. That's it.

---

## Phase 1 — Delete Docling Service (folder + env + config)

No code depends on this at runtime once Phase 2 removes the callers.

| Action | Target |
|--------|--------|
| Delete folder | `docling-service/` (server.py, dev_server.py, convert.py, Dockerfile, requirements.txt, .env.example, .dockerignore) |
| Remove env var | `.env.local` — delete `DOCLING_SERVICE_URL=http://localhost:8000` line |
| Remove build injection | `vite.config.ts` — delete `doclingServiceUrl` variable (line 41) and `process.env.DOCLING_SERVICE_URL` injection (line 54) |

---

## Phase 2 — Gut `fileProcessing.ts` (Remove Docling + DOCX + Claude conversion)

This is the biggest phase. Remove all dead conversion code from `utils/fileProcessing.ts`:

| Remove | Lines | What |
|--------|-------|------|
| `DoclingConvertResponse` interface | 9-19 | Response type for Docling service |
| `callDoclingService()` | 56-76 | HTTP call to Docling `/convert` |
| `convertPdfWithClaude()` | 81-90 | Claude PDF→MD fallback |
| `convertDocxWithClaude()` | 95-101 | Claude DOCX→MD fallback |
| `extractTocViaDocling()` | 247-258 | Docling-based TOC extraction |
| `import { extractDocxText }` | line 6 | Import of DOCX parser |
| `import { DOCUMENT_ANALYSIS_PROMPT, DOCX_TEXT_ANALYSIS_PROMPT }` | line 4 | Import of Claude prompts |
| `isDocx` variable + DOCX branch | lines 129, 167-168 | DOCX detection in `processFileToDocument()` |
| `usedDocling` flag + Docling-first branch | lines 138-160 | The try-Docling-then-fallback pattern |
| `ProcessingFallback` type `'docling-to-claude'` | line 105 | Fallback type variant |

**Keep:** `fileToBase64()` (reused by Gemini), `processNativePdf()`, `createPlaceholderDocument()`, `base64ToBlob()`, `parseMarkdownStructure` import.

**Simplify `processFileToDocument()` to:**
```
MD  → file.text() passthrough
PDF → convertPdfWithGemini(file)  [new, Phase 4]
```

---

## Phase 3 — Delete DOCX Support Files

| Action | Target |
|--------|--------|
| Delete file | `utils/docx.ts` (151 lines — JSZip XML parser) |
| Delete prompt | `utils/prompts/documentAnalysis.ts` — remove `DOCX_TEXT_ANALYSIS_PROMPT` export (lines 93-119) and DOCX header comments (lines 1-8). Keep `DOCUMENT_ANALYSIS_PROMPT` only if repurposed for Gemini; otherwise delete entire file. |
| Remove dependency | `package.json` — remove `"jszip": "^3.10.1"`, run `npm install` |

---

## Phase 4 — Remove DOCX from Types, Context, UI

### Types (`types.ts`)
- Line 127: `originalFormat?: 'md' | 'pdf' | 'docx'` → `originalFormat?: 'md' | 'pdf'`
- Line 220: Remove `DOCX` from `FileType` enum
- Line 243: `type: 'md' | 'pdf' | 'docx'` → `type: 'md' | 'pdf'`
- Line 246: Remove `// binary content for PDF/DOCX` comment (update to `// binary content for PDF`)

### Storage (`utils/storage/StorageBackend.ts`)
- Line 95: `originalFormat?: 'md' | 'pdf' | 'docx'` → `originalFormat?: 'md' | 'pdf'`

### Context (`context/AppContext.tsx`)
- Lines 150-151: Remove DOCX MIME→type mapping branch
- Lines 248-249: Remove same mapping in second location

### StorageProvider (`components/StorageProvider.tsx`)
- Lines 220-221: Remove DOCX type→MIME reverse mapping

### UI Components

| File | Line | Change |
|------|------|--------|
| `FileList.tsx` | 71-74 | Remove `case 'docx'` switch branch (DOCX icon) |
| `ProjectsPanel.tsx` | 54 | Remove `case 'docx': return 'WORD DOC'` |
| `ProjectsPanel.tsx` | 73 | Remove `|| doc.originalFormat === 'docx'` from `wasConverted()` |
| `ProjectsPanel.tsx` | 406 | `accept=".md,.pdf,.docx"` → `accept=".md,.pdf"` |
| `FileUpload.tsx` | 54 | `accept=".md,.pdf,.docx"` → `accept=".md,.pdf"` |
| `NuggetCreationModal.tsx` | 183 | `accept=".md,.pdf,.docx"` → `accept=".md,.pdf"` |
| `LandingPage.tsx` | 95 | `MD / PDF / DOCX` → `MD / PDF` |
| `InsightsDocViewer.tsx` | 14 | Remove DOCX comment |
| `App.tsx` | ~1500 | Remove `// Non-PDF files: existing path (MD, DOCX)` comment, simplify to MD-only |

---

## Phase 5 — Clean Up `App.tsx` Upload Handler

The upload handler (lines 1398-1539) currently has three branches: PDF-native, PDF-markdown, and MD/DOCX. Simplify to:

```
for each file:
  if PDF → askPdfChoice()
    'native-pdf' → processNativePdf + extractHeadingsWithGemini [Phase 6]
    'markdown'   → convertPdfWithGemini [Phase 6] via processFileToDocument
    'cancel'     → skip
  else (MD) → processFileToDocument (passthrough)
```

- Remove `extractTocViaDocling` import (line 26) — replace with new Gemini function
- Remove `ProcessingFallback` import if no longer needed
- Remove `fallbackCallback` if no longer needed (lines 1418-1425)
- Clean up the else branch (was MD + DOCX, now MD only)

---

## Phase 6 — Implement Gemini Conversion Functions

### 6A: `extractHeadingsWithGemini(file: File): Promise<Heading[]>`

**Used by:** "Keep as PDF" path in App.tsx

- Send PDF as `inlineData` to Gemini Flash
- Prompt: extract heading structure with page numbers
- Parse JSON response into `Heading[]`
- Falls back to empty array on failure (user creates bookmarks manually)

```typescript
// New function in fileProcessing.ts
export async function extractHeadingsWithGemini(file: File): Promise<Heading[]> {
  const base64 = await fileToBase64(file);
  const response = await withGeminiRetry(async () => {
    return await getGeminiAI().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [
        { inlineData: { data: base64, mimeType: 'application/pdf' } },
        { text: HEADING_EXTRACTION_PROMPT }
      ]}],
      config: FLASH_TEXT_CONFIG,
    });
  });
  // Parse structured heading response → Heading[]
}
```

### 6B: `convertPdfWithGemini(file: File): Promise<string>`

**Used by:** "Convert to Markdown" path via `processFileToDocument()`

- Send PDF as `inlineData` to Gemini Flash
- Prompt: convert to markdown, images/charts → tables/descriptions with footnotes
- Return markdown string directly

```typescript
// New function in fileProcessing.ts
export async function convertPdfWithGemini(
  file: File,
  onUsage?: (usage: GeminiUsage) => void
): Promise<string> {
  const base64 = await fileToBase64(file);
  const response = await withGeminiRetry(async () => {
    return await getGeminiAI().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [
        { inlineData: { data: base64, mimeType: 'application/pdf' } },
        { text: PDF_CONVERSION_PROMPT }
      ]}],
      config: FLASH_TEXT_CONFIG,
    });
  });
  // Track usage, return text
}
```

### 6C: New Prompts

Add to a new or existing prompts file (e.g. `utils/prompts/documentConversion.ts`):

- `HEADING_EXTRACTION_PROMPT` — extract headings + page numbers as JSON
- `PDF_CONVERSION_PROMPT` — the user's tested prompt: convert PDF to markdown, charts/diagrams → tables/descriptions with footnotes at the end

---

## Phase 7 — Update Imports in `utils/ai.ts` (if needed)

Ensure `withGeminiRetry`, `getGeminiAI`, and `FLASH_TEXT_CONFIG` are exported for use in `fileProcessing.ts`. Check current exports:

- `getGeminiAI()` — currently used in `useCardGeneration.ts` and `modificationEngine.ts`
- `withGeminiRetry()` — same
- `FLASH_TEXT_CONFIG` — currently defined but verify it's exported

May need to add a usage type for Gemini document calls if not already covered.

---

## Phase 8 — Remove `DOCUMENT_ANALYSIS_PROMPT`

If the Claude PDF→MD prompt (`DOCUMENT_ANALYSIS_PROMPT` in `documentAnalysis.ts`) is no longer used anywhere:
- Delete the entire `utils/prompts/documentAnalysis.ts` file
- Or keep the file if it contains other exports that are still used

The new Gemini prompts go in a new file (`documentConversion.ts`).

---

## Phase 9 — Build + Test

1. `npx vite build` — must pass with zero errors
2. Manual test: upload a PDF → "Keep as PDF" → verify headings extracted
3. Manual test: upload a PDF → "Convert to Markdown" → verify markdown quality
4. Manual test: upload an MD → verify passthrough works
5. Manual test: verify DOCX is no longer accepted in file picker
6. Verify no `docling`, `docx`, `jszip` references remain in built output

---

## Phase 10 — Update Docs (Optional, Separate Pass)

All files in `docs/` reference Docling and DOCX extensively. These can be regenerated with the `/generate-docs` skill after the code changes are complete. Not blocking.

---

## File Impact Summary

| File | Action |
|------|--------|
| `docling-service/*` | **DELETE entire folder** |
| `utils/docx.ts` | **DELETE** |
| `utils/prompts/documentAnalysis.ts` | **DELETE** (or gut) |
| `utils/fileProcessing.ts` | **MAJOR REWRITE** — remove ~120 lines, add ~50 lines |
| `utils/prompts/documentConversion.ts` | **NEW FILE** — 2 Gemini prompts |
| `App.tsx` | **MODERATE** — update imports, simplify upload handler |
| `vite.config.ts` | **MINOR** — remove 2 lines |
| `.env.local` | **MINOR** — remove 1 line |
| `package.json` | **MINOR** — remove jszip |
| `types.ts` | **MINOR** — remove 'docx' from 3 union types + enum |
| `utils/storage/StorageBackend.ts` | **MINOR** — remove 'docx' from 1 type |
| `context/AppContext.tsx` | **MINOR** — remove DOCX MIME mapping (2 spots) |
| `components/StorageProvider.tsx` | **MINOR** — remove DOCX reverse mapping |
| `components/FileList.tsx` | **MINOR** — remove DOCX icon case |
| `components/ProjectsPanel.tsx` | **MINOR** — remove DOCX label + accept filter |
| `components/FileUpload.tsx` | **MINOR** — remove .docx from accept |
| `components/NuggetCreationModal.tsx` | **MINOR** — remove .docx from accept |
| `components/LandingPage.tsx` | **MINOR** — update text |
| `components/InsightsDocViewer.tsx` | **TRIVIAL** — remove comment |

**Total: 2 files deleted, 1 folder deleted, 1 new file, ~15 files edited**
