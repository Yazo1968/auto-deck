# Environment & Configuration

## Required Environment Variables

| Variable | Required | Description | Example Format |
|----------|----------|-------------|----------------|
| `ANTHROPIC_API_KEY` | Yes | Authenticates all Claude API calls (`callClaude`, `uploadToFilesAPI`, `deleteFromFilesAPI`). Used in the `x-api-key` header for direct `fetch` calls to `https://api.anthropic.com/v1/messages` and for the proxied Files API endpoint. | `sk-ant-api03-...` |
| `GEMINI_API_KEY` | Yes | Primary Google Gemini API key. Used for both text calls (Gemini 2.5 Flash, `gemini-2.5-flash`) and image generation calls (Gemini Pro Image, `gemini-3-pro-image-preview`). Also exposed as `process.env.API_KEY` for `@google/genai` SDK compatibility. | `AIzaSy...` |
| `GEMINI_API_KEY_FALLBACK` | No | Secondary Gemini API key. Activated automatically by `rotateGeminiKey()` in `utils/ai.ts` when all retries with the primary key are exhausted due to 429 rate-limit errors. | `AIzaSy...` |
| `DOCLING_SERVICE_URL` | No | URL for an external PDF conversion service. Declared in the environment but not currently referenced in active code paths. | `https://docling.example.com` |

All variables are injected into the client JavaScript bundle at build time via Vite's `define` block. They are **not** available at runtime from a server — they are baked into the built JavaScript and are therefore visible in the client bundle.

## Environment Files

`.env.local` — the only environment file used. It must be created manually in the project root before running or building the app. It is not committed to version control.

Format:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
GEMINI_API_KEY=AIzaSy...
GEMINI_API_KEY_FALLBACK=AIzaSy...
```

**Custom parser:** `vite.config.ts` contains a `readDotEnvLocal()` function that reads `.env.local` directly from disk rather than relying solely on Vite's `loadEnv`. This is intentional: Vite's `loadEnv` merges `process.env` on top of file values, so an empty system-level environment variable (e.g., `GEMINI_API_KEY=` set at the OS level) would shadow a valid value in `.env.local`. The custom parser bypasses this by preferring file values over system values.

```ts
// From vite.config.ts
function readDotEnvLocal(): Record<string, string> {
  const filePath = path.resolve(__dirname, '.env.local');
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}
```

The resolved values are injected via Vite's `define` block:

```ts
define: {
  'process.env.API_KEY':                JSON.stringify(geminiKey),
  'process.env.GEMINI_API_KEY':         JSON.stringify(geminiKey),
  'process.env.GEMINI_API_KEY_FALLBACK': JSON.stringify(geminiKeyFallback),
  'process.env.ANTHROPIC_API_KEY':      JSON.stringify(anthropicKey),
},
```

`process.env.API_KEY` and `process.env.GEMINI_API_KEY` both resolve to the same value to maintain compatibility with the `@google/genai` SDK, which reads `process.env.API_KEY`.

## Prerequisites

- **Node.js**: Version supporting ES2022 and native `fetch` in the runtime used during build. Any Node 18+ version is suitable.
- **npm**: Installed with Node.js. Used as the package manager (`package-lock.json` is present).
- **Anthropic API account**: An account at [console.anthropic.com](https://console.anthropic.com) with an active API key that has access to `claude-sonnet-4-6` and the Files API beta (`files-api-2025-04-14`).
- **Google AI Studio account**: An account at [aistudio.google.com](https://aistudio.google.com) with an API key that has access to `gemini-2.5-flash` and `gemini-3-pro-image-preview`.

## Local Development Setup

1. Clone or download the repository.

2. Install dependencies:
   ```
   npm install
   ```

3. Create `.env.local` in the project root with the required API keys:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-...
   GEMINI_API_KEY=AIzaSy...
   GEMINI_API_KEY_FALLBACK=AIzaSy...
   ```

4. Start the development server:
   ```
   npm run dev
   ```
   The server starts on `http://localhost:3000` (host `0.0.0.0`, port `3000` as configured in `vite.config.ts`).

5. The Vite dev server proxies requests to `/api/anthropic-files` → `https://api.anthropic.com/v1/files`. This proxy is required for the Anthropic Files API because the beta endpoint does not support CORS preflight requests from browsers. In production builds, this proxy is not available — the Files API path would need a separate reverse proxy or serverless function if the app were deployed.

## Available Scripts

All scripts are defined in `package.json` and run via npm:

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Starts the Vite development server on port 3000 with HMR and the `/api/anthropic-files` proxy active |
| `build` | `vite build` | Produces a production bundle in the `dist/` directory with API keys baked in at build time |
| `preview` | `vite preview` | Serves the contents of `dist/` locally to verify the production build before deployment |

## Third-Party Accounts Required

**Anthropic** ([console.anthropic.com](https://console.anthropic.com))
- Model used: `claude-sonnet-4-6`
- Features used: Messages API (text generation, multi-turn chat, document processing), Files API beta (`files-api-2025-04-14`) for uploading markdown and PDF documents to be referenced by file ID in subsequent requests
- Prompt caching is used via `cache_control: { type: 'ephemeral' }` on system blocks and the last user message

**Google AI Studio** ([aistudio.google.com](https://aistudio.google.com))
- Text model used: `gemini-2.5-flash` — PDF conversion to markdown, heading extraction, layout planning for Auto-Deck, style generation
- Image model used: `gemini-3-pro-image-preview` — infographic image generation (all card images)
- SDK: `@google/genai` v1.41.0
