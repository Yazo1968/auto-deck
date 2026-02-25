# API Reference

## Overview

InfoNugget v6.0 is a client-side SPA with no backend. All external API calls are made directly from the browser. Two external services are used:

1. **Anthropic API** — Claude `claude-sonnet-4-6` for all text intelligence (synthesis, planning, chat, style generation). Also the Anthropic Files API (beta) for persistent document storage that Claude can reference by file ID.
2. **Google Gemini API** — `gemini-2.5-flash` for PDF conversion and heading extraction. `gemini-3-pro-image-preview` for infographic image generation.

There are no backend routes, no authentication endpoints, and no REST API surface owned by this application.

---

## External API Integrations

### Anthropic (Claude) API

**Client initialization:** No SDK. Direct `fetch` calls to `https://api.anthropic.com/v1/messages`. API key is injected at build time by Vite as `process.env.ANTHROPIC_API_KEY` from `.env.local`.

**Required headers on every request:**
```
Content-Type: application/json
x-api-key: {ANTHROPIC_API_KEY}
anthropic-version: 2023-06-01
anthropic-beta: files-api-2025-04-14
anthropic-dangerous-direct-browser-access: true
```

The `anthropic-dangerous-direct-browser-access: true` header is required because Anthropic's API is called directly from a browser (no backend proxy), which is not the standard deployment pattern. The `files-api-2025-04-14` beta header enables Files API document blocks in messages.

---

#### `callClaude()`

**File:** `C:\Users\archd\Downloads\infonugget-v6.0\utils\ai.ts`
**Endpoint:** `POST https://api.anthropic.com/v1/messages`
**Streaming:** No

**Signature:**
```ts
callClaude(
  prompt: string,
  options?: CallClaudeOptions | { base64: string; mediaType: string }
): Promise<{ text: string; usage: ClaudeUsage }>
```

**`CallClaudeOptions` fields:**

| Field | Type | Description |
|-------|------|-------------|
| `document` | `{ base64: string; mediaType: string }` | Inline document (base64-encoded PDF or other binary) to include as a `document` content block |
| `system` | `string` | Plain string system prompt; auto-wrapped with `cache_control` if `>= 4000` chars |
| `maxTokens` | `number` | Maximum output tokens; defaults to `CLAUDE_MAX_TOKENS` (64000) |
| `temperature` | `number` | Sampling temperature 0–1; omitted from the request body when undefined (API default applies) |
| `systemBlocks` | `SystemBlock[]` | Structured system blocks with per-block `cache` flag; overrides `system` string |
| `messages` | `ClaudeMessage[]` | Multi-turn messages array; overrides single-prompt behavior; last user message is auto-marked with `cache_control` |
| `signal` | `AbortSignal` | Cancellation signal; passed directly to `fetch()` |

**`SystemBlock` type:**
```ts
interface SystemBlock {
  text: string;
  cache?: boolean;  // if true and text.length >= 4000, adds cache_control: { type: 'ephemeral' }
}
```

**`ClaudeMessage` type:**
```ts
interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}
```

**`ClaudeContentBlock` type:**
```ts
interface ClaudeContentBlock {
  type: string;            // 'text', 'document', etc.
  text?: string;
  source?: {
    type: string;          // 'base64' or 'file'
    media_type?: string;
    data?: string;         // base64 data (for type: 'base64')
    file_id?: string;      // Anthropic Files API ID (for type: 'file')
  };
  title?: string;
  cache_control?: { type: 'ephemeral' };
}
```

**Request body shape:**
```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 64000,
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "document", "source": { "type": "file", "file_id": "file-abc123" }, "title": "My Doc" },
        { "type": "text", "text": "...", "cache_control": { "type": "ephemeral" } }
      ]
    }
  ],
  "system": [
    { "type": "text", "text": "...", "cache_control": { "type": "ephemeral" } }
  ],
  "temperature": 0.1
}
```

**Response shape:**
```json
{
  "content": [{ "type": "text", "text": "..." }],
  "usage": {
    "input_tokens": 1234,
    "output_tokens": 567,
    "cache_creation_input_tokens": 890,
    "cache_read_input_tokens": 100
  }
}
```

**Return value:**
```ts
{ text: string; usage: ClaudeUsage }
```
where `ClaudeUsage` is:
```ts
interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}
```
Text is extracted by filtering response content blocks for `type === 'text'` and joining with `\n`.

**Prompt caching behavior:**
- System blocks with `cache: true` get `cache_control: { type: 'ephemeral' }` if their text length is `>= 4000` characters (the `CACHE_MIN_CHARS` constant).
- A plain `system` string `>= 4000` chars is also wrapped with `cache_control`.
- The last `user`-role message in a multi-turn conversation automatically gets `cache_control: { type: 'ephemeral' }` injected by `callClaude()`.

**Error handling:**
- If the HTTP response is not `ok`, the response body is read as text and thrown as `Error("Claude API error {status}: {body}")`.
- The entire `fetch` call is wrapped in `withRetry(fn, 5)` from `utils/ai.ts`. Retryable conditions: HTTP status 429, 500, 503, or error message text containing "overloaded", "unavailable", "resource_exhausted", "rate limit", "too many requests", "internal server error", "high demand".
- Retry delay: exponential backoff `Math.min(2^attempt * 1000 + jitter(0-1000ms), 32000ms)`.

**Callers:**
- `hooks/useCardGeneration.ts` — `performSynthesis()` (Phase 1: content synthesis)
- `hooks/useCardGeneration.ts` — `generateCard()` (Phase 2: layout planning)
- `hooks/useInsightsLab.ts` — `sendMessage()` (chat messages)
- `hooks/useAutoDeck.ts` — `startPlanning()`, `revisePlan()`, `approvePlan()` (planner, finalizer, producer)
- `utils/ai.ts` — `generateStyleWithAI()` (custom style generation)

---

### Anthropic Files API

**Base URL (via Vite proxy):** `/api/anthropic-files` → proxied to `https://api.anthropic.com/v1/files`

**Reason for proxy:** The Anthropic Files API beta endpoint lacks CORS preflight support for browser-originated requests. The Vite dev server proxies the requests to work around this.

**Headers on every Files API request:**
```
x-api-key: {ANTHROPIC_API_KEY}
anthropic-version: 2023-06-01
anthropic-beta: files-api-2025-04-14
anthropic-dangerous-direct-browser-access: true
```

---

#### `uploadToFilesAPI()`

**File:** `C:\Users\archd\Downloads\infonugget-v6.0\utils\ai.ts`
**Endpoint:** `POST /api/anthropic-files`
**Streaming:** No

**Signature:**
```ts
uploadToFilesAPI(
  content: string | Blob | File,
  filename: string,
  mimeType: string = 'text/plain',
): Promise<string>
```

**Request format:**
- `Content-Type: multipart/form-data` (browser handles boundary automatically)
- Body: `FormData` with a single field `file`, containing the content as a `Blob` with the specified filename

**Response format (`FilesAPIResponse`):**
```json
{
  "id": "file-abc123xyz",
  "type": "file",
  "filename": "document.md",
  "mime_type": "text/plain",
  "size_bytes": 4567,
  "created_at": "2026-02-24T10:00:00Z"
}
```

**Return value:** `string` — the `id` field from the response (used as `fileId` on `UploadedFile` and as `file_id` in Claude `document` content blocks).

**Error handling:** If the response is not `ok`, throws `Error("Files API upload error {status}: {body}")`. Not wrapped in `withRetry()`.

**File lifecycle:**
- Files expire approximately 60 minutes after upload.
- Each upload generates a new `file_id`. When a document is edited or the MetaTOC is updated, the old file is deleted and a new one is uploaded.
- There is no re-upload logic for expired files. If a file's expiry is reached, Claude calls referencing it will fail.

**Callers:**
- `App.tsx` — after markdown or PDF conversion, to upload document content
- `utils/metaToc.ts` — `uploadMetaToc()` to upload MetaTOC companion files

---

#### `deleteFromFilesAPI()`

**File:** `C:\Users\archd\Downloads\infonugget-v6.0\utils\ai.ts`
**Endpoint:** `DELETE /api/anthropic-files/{fileId}`
**Streaming:** No

**Signature:**
```ts
deleteFromFilesAPI(fileId: string): Promise<void>
```

**Request format:** No body; the `fileId` is in the URL path.

**Response format:** Not parsed. A non-`ok` response is logged as a warning but does not throw.

**Error handling:** All errors are caught internally and logged as `console.warn`. The function never throws. This is a fire-and-forget operation; callers do not await the result in time-critical paths.

**Callers:**
- `App.tsx` (document save handler) — deletes the old file before uploading the edited version
- `utils/metaToc.ts` — `replaceMetaToc()` deletes the old MetaTOC before uploading the replacement

---

### Google Gemini API

**Client initialization:** `@google/genai` SDK v1.41.0. The `GoogleGenAI` class is instantiated lazily as a singleton via `getGeminiAI()` in `utils/ai.ts`.

**API key management:**
- Primary key: `process.env.API_KEY` (injected at build time as `GEMINI_API_KEY` from `.env.local`)
- Fallback key: `process.env.GEMINI_API_KEY_FALLBACK`
- `getGeminiAI()` returns the current singleton. `rotateGeminiKey()` sets `_currentKeyIndex++` and nulls `_aiInstance` to force re-instantiation with the next key. `resetGeminiKey()` resets to the primary key.

**Retry wrapper:** `withGeminiRetry(fn, maxRetries, onRetry)` in `utils/ai.ts`:
1. Calls `withRetry(fn, maxRetries, onRetry)` — exponential backoff with jitter, retries on 429/500/503.
2. If all retries are exhausted with a retryable error, calls `rotateGeminiKey()` and retries once more with `withRetry(fn, maxRetries, onRetry)`.

**Model IDs used:**
- `gemini-2.5-flash` — text-only tasks (PDF conversion, heading extraction)
- `gemini-3-pro-image-preview` — image generation

---

#### `convertPdfWithGemini()` (internal)

**File:** `C:\Users\archd\Downloads\infonugget-v6.0\utils\fileProcessing.ts`
**SDK method:** `getGeminiAI().models.generateContent()`
**Streaming:** No

**Called by:** `processFileToDocument()` when `file` is a PDF and the user chose "Convert to Markdown".

**Request:**
```ts
{
  model: 'gemini-2.5-flash',
  contents: [{
    parts: [
      { inlineData: { data: base64PdfString, mimeType: 'application/pdf' } },
      { text: PDF_CONVERSION_PROMPT }
    ]
  }],
  config: { httpOptions: { timeout: 300000 } }
}
```

`PDF_CONVERSION_PROMPT` is defined in `utils/prompts/documentConversion.ts`. It instructs Gemini to convert the PDF to well-structured Markdown, handling text, tables (→ markdown tables), charts (→ markdown tables), and diagrams (→ descriptions).

**Response processing:**
- `response.candidates[0].content.parts` is filtered to exclude thinking parts (`p.text && !p.thought`).
- All text parts are joined into a single markdown string.

**Return value:** `Promise<string>` — the converted markdown text.

**Error handling:** Wrapped in `withGeminiRetry()`. On repeated failures (after key rotation), the exception propagates to the calling handler.

---

#### `extractHeadingsWithGemini()`

**File:** `C:\Users\archd\Downloads\infonugget-v6.0\utils\fileProcessing.ts`
**SDK method:** `getGeminiAI().models.generateContent()`
**Streaming:** No

**Signature:**
```ts
extractHeadingsWithGemini(file: File): Promise<Heading[]>
```

**Request:**
```ts
{
  model: 'gemini-2.5-flash',
  contents: [{
    parts: [
      { inlineData: { data: base64PdfString, mimeType: 'application/pdf' } },
      { text: HEADING_EXTRACTION_PROMPT }
    ]
  }],
  config: { httpOptions: { timeout: 300000 } }
}
```

`HEADING_EXTRACTION_PROMPT` is defined in `utils/prompts/documentConversion.ts`. It instructs Gemini to extract the heading/bookmark structure of the PDF as a JSON array with `level`, `title`, and `page` fields.

**Response processing:**
- Thinking parts are filtered out.
- Markdown fences (` ```json `) are stripped.
- A regex `\[[\s\S]*\]` extracts the JSON array from the response.
- Each `{ level: number, title: string, page?: number }` entry is mapped to a `Heading` object.
- If no array is found or JSON parsing fails, an empty `Heading[]` is returned (non-fatal).

**Return value:** `Promise<Heading[]>` — empty array on failure.

**Error handling:** The entire function body is wrapped in a `try/catch`. Failures are logged as `console.warn` and an empty array is returned. Wrapped in `withGeminiRetry()`.

---

#### `generateStyleWithAI()`

**File:** `C:\Users\archd\Downloads\infonugget-v6.0\utils\ai.ts`
**Underlying call:** `callClaude()` (not Gemini)
**Streaming:** No

**Signature:**
```ts
generateStyleWithAI(
  name: string,
  description: string,
  signal?: AbortSignal
): Promise<{ palette: Palette; fonts: FontPair; identity: string }>
```

**Description:** Generates a complete custom style definition (palette, fonts, identity) from a style name and free-form user description. Calls Claude, not Gemini.

**Request:**
- System prompt: A detailed visual design expert persona with instructions to extract design intent and fill gaps with coherent choices.
- User prompt: `"Style name: {name}\n\nUser description:\n{description}"`
- `maxTokens: 500`
- `signal`: passed through for cancellation

**Expected response:** A valid JSON object (no markdown fencing) with structure:
```json
{
  "palette": {
    "background": "#hex",
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "text": "#hex"
  },
  "fonts": {
    "primary": "Google Font Name",
    "secondary": "Google Font Name"
  },
  "identity": "40-80 word visual identity description"
}
```

**Response processing:** Markdown fences are stripped. `JSON.parse()` is called. All palette values are validated against `/^#[0-9A-Fa-f]{6}$/`. Missing or invalid fields throw a descriptive error.

**Return value:** `{ palette: Palette; fonts: FontPair; identity: string }`.

**Error handling:** Validation errors and `JSON.parse` failures propagate as thrown exceptions. The calling handler in `StyleStudioModal` catches these and shows a toast notification.

---

#### Image Generation in `generateCard()`

**File:** `C:\Users\archd\Downloads\infonugget-v6.0\hooks\useCardGeneration.ts`
**SDK method:** `getGeminiAI().models.generateContent()`
**Streaming:** No

**Request:**
```ts
{
  model: 'gemini-3-pro-image-preview',
  contents: [{
    parts: [
      // Optional: reference image
      { inlineData: { mimeType: extractMime(referenceImage.url), data: extractBase64(referenceImage.url) } },
      // Required: visualizer prompt
      { text: lastPrompt }
    ]
  }],
  config: {
    responseModalities: [Modality.TEXT, Modality.IMAGE],  // PRO_IMAGE_CONFIG
    imageConfig: {
      aspectRatio: settings.aspectRatio,  // '16:9', '1:1', etc.
      imageSize: settings.resolution       // '1K', '2K', '4K'
    }
  }
}
```

The `lastPrompt` is built by one of six prompt builders depending on the style and detail level:
- `buildVisualizerPrompt()` — `utils/prompts/imageGeneration.ts` — generic content cards
- `buildCoverVisualizerPrompt()` — `utils/prompts/coverGeneration.ts` — generic cover cards
- `buildPwcVisualizerPrompt()` — `utils/prompts/pwcGeneration.ts` — PwC Corporate content cards (JSON-based spec)
- `buildPwcCoverVisualizerPrompt()` — `utils/prompts/pwcGeneration.ts` — PwC Corporate cover cards
- `buildCoverVisualizerPrompt()` — for generic cover cards
- `buildPwcCoverVisualizerPrompt()` — for PwC cover cards

**Prompt anti-leakage applied before building the prompt:**
- `transformContentToTags()` in `utils/prompts/promptUtils.ts`: markdown headings (`##`, `###`) → `[TITLE]`, `[SECTION]`, `[SUBSECTION]`, `[DETAIL]` bracketed tags
- `fontToDescriptor()`: font names → visual descriptors (e.g., `"Inter"` → `"clean, geometric sans-serif"`)
- `hexToColorName()`: hex codes → color names from a 200+ entry lookup table

**Response processing:**
- `response.candidates[0].content.parts` is iterated.
- The first part with `inlineData` is extracted: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`.
- This data URL is stored as `card.cardUrlMap[currentLevel]`.

**Token usage recorded:**
- `recordUsage({ provider: 'gemini', model: 'gemini-3-pro-image-preview', inputTokens: usageMetadata.promptTokenCount, outputTokens: usageMetadata.candidatesTokenCount })`.

**Error handling:**
- Wrapped in `withGeminiRetry()` for 429/500/503 with key rotation.
- 404 "entity not found" errors trigger `aistudio.openSelectKey()` if in the AI Studio environment.
- Overload errors show a warning toast; other errors show an error toast, both with a "Retry" button.

---

#### Image Modification Calls (in `utils/modificationEngine.ts`)

**File:** `C:\Users\archd\Downloads\infonugget-v6.0\utils\modificationEngine.ts`
**SDK method:** `getGeminiAI().models.generateContent()`
**Streaming:** No

Two functions handle annotation-driven image modification:

**`executeModification(imageUrl, annotations, settings, lastPrompt?)`**
- Sends the current card image (`inlineData`) and annotation descriptions to Gemini Pro Image
- Uses `buildModificationPrompt()` from `utils/prompts/imageGeneration.ts`
- Model: `gemini-3-pro-image-preview` with `PRO_IMAGE_CONFIG`
- Response: new base64 image returned as a data URL

**`executeContentModification(imageUrl, newContent, settings, lastPrompt?)`**
- Re-renders the card image with updated synthesis content (content-only change, no annotations)
- Uses `buildContentModificationPrompt()` from `utils/prompts/imageGeneration.ts`
- Model: `gemini-3-pro-image-preview` with `PRO_IMAGE_CONFIG`
- Response: new base64 image returned as a data URL

Both functions are wrapped in `withGeminiRetry()`.

---

## AI Provider Orchestration

| Task | Provider | Model | File |
|------|----------|-------|------|
| Content synthesis (all detail levels) | Anthropic Claude | `claude-sonnet-4-6` | `hooks/useCardGeneration.ts` via `callClaude()` |
| Layout planning (visual brief) | Anthropic Claude | `claude-sonnet-4-6` | `hooks/useCardGeneration.ts` via `callClaude()` |
| Infographic image generation | Google Gemini Pro Image | `gemini-3-pro-image-preview` | `hooks/useCardGeneration.ts` via SDK |
| Annotation-driven image modification | Google Gemini Pro Image | `gemini-3-pro-image-preview` | `utils/modificationEngine.ts` via SDK |
| PDF to Markdown conversion | Google Gemini Flash | `gemini-2.5-flash` | `utils/fileProcessing.ts` via SDK |
| Native PDF heading extraction | Google Gemini Flash | `gemini-2.5-flash` | `utils/fileProcessing.ts` via SDK |
| Insights chat messages | Anthropic Claude | `claude-sonnet-4-6` | `hooks/useInsightsLab.ts` via `callClaude()` |
| Auto-Deck Planner | Anthropic Claude | `claude-sonnet-4-6` | `hooks/useAutoDeck.ts` via `callClaude()` |
| Auto-Deck Finalizer | Anthropic Claude | `claude-sonnet-4-6` | `hooks/useAutoDeck.ts` via `callClaude()` |
| Auto-Deck Producer | Anthropic Claude | `claude-sonnet-4-6` | `hooks/useAutoDeck.ts` via `callClaude()` |
| Custom style generation | Anthropic Claude | `claude-sonnet-4-6` | `utils/ai.ts` via `callClaude()` |

**Gemini key fallback chain:**
1. Primary: `process.env.API_KEY` (mapped from `GEMINI_API_KEY` in `.env.local`)
2. Fallback: `process.env.GEMINI_API_KEY_FALLBACK`
- Rotation is triggered by `withGeminiRetry()` after all retries fail on the primary key with a retryable error.
- `rotateGeminiKey()` returns `false` if no fallback is configured; the error propagates.
- `resetGeminiKey()` is called on app initialization to ensure the primary key is always tried first.

**Claude retry policy:**
- `withRetry(fn, 5)` with exponential backoff inside `callClaude()`.
- No key rotation (only one Anthropic API key is configured).

---

## Document Management API (Files API)

### File Lifecycle

```
Upload (uploadToFilesAPI)
  │
  ├── Returns file_id (stored in UploadedFile.fileId or .metaTocFileId)
  │
  ├── Claude calls reference file_id via document content block:
  │     { type: 'document', source: { type: 'file', file_id: '...' } }
  │
  ├── File expires ~60 minutes after upload
  │     (No automatic re-upload for expired files)
  │
  └── Delete (deleteFromFilesAPI)
        Called when document is edited, renamed, or replaced
        Also called when MetaTOC is updated (replaceMetaToc)
```

### File Types Uploaded

| Content | MIME Type | Filename Pattern | Field |
|---------|-----------|-----------------|-------|
| Markdown document (inline or converted PDF) | `text/plain` | `{original filename}` | `UploadedFile.fileId` |
| Native PDF | `application/pdf` | `{original filename}` | `UploadedFile.fileId` |
| MetaTOC (native PDF companion) | `text/markdown` | `{docName without ext}MetaTOC.md` | `UploadedFile.metaTocFileId` |

### Document Reference Pattern in Claude Calls

When `UploadedFile.fileId` is set, Claude calls include the document as a `document` content block rather than inline text:

```ts
{
  type: 'document',
  source: { type: 'file', file_id: doc.fileId },
  title: doc.name,
}
```

For native PDFs with a MetaTOC, two blocks are sent:
```ts
[
  { type: 'document', source: { type: 'file', file_id: doc.fileId }, title: doc.name },
  { type: 'document', source: { type: 'file', file_id: doc.metaTocFileId }, title: `${doc.name} - Table of Contents` }
]
```

These blocks are prepended to the first `user` message in the `messages` array for all calls in `useInsightsLab.ts`, `useCardGeneration.ts`, and `useAutoDeck.ts`.

### Vite Proxy Configuration

The Anthropic Files API beta endpoint does not return CORS preflight headers required for browser requests. The Vite dev server is configured in `vite.config.ts` to proxy `/api/anthropic-files` requests:

```
/api/anthropic-files        → https://api.anthropic.com/v1/files       (POST uploads)
/api/anthropic-files/{id}   → https://api.anthropic.com/v1/files/{id}  (DELETE)
```

Direct `callClaude()` calls go to `https://api.anthropic.com/v1/messages` without a proxy (that endpoint supports CORS with `anthropic-dangerous-direct-browser-access: true`).

### Gemini Flash Configuration (`FLASH_TEXT_CONFIG`)

**Defined in:** `utils/ai.ts`
```ts
export const FLASH_TEXT_CONFIG = {
  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  responseModalities: [Modality.TEXT],
};
```
Used for text-only Gemini Flash calls. Sets `thinkingLevel: LOW` to reduce latency and cost. Restricts output to text modality only.

Note: `FLASH_TEXT_CONFIG` is defined but not actively used for the PDF conversion and heading extraction calls, which pass `{ httpOptions: { timeout: 300000 } }` directly. Gemini 2.5 thinking parts are filtered post-response.

### Gemini Pro Image Configuration (`PRO_IMAGE_CONFIG`)

**Defined in:** `utils/ai.ts`
```ts
export const PRO_IMAGE_CONFIG = {
  responseModalities: [Modality.TEXT, Modality.IMAGE],
};
```
Used for all image generation calls. Both `TEXT` and `IMAGE` modalities must be declared for the model to return image data. Temperature is left at the API default (1.0) per Gemini 3 documentation requirements — values below 1.0 cause degraded performance on image generation tasks.
