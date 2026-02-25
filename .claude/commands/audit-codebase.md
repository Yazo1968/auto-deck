---
description: Run a comprehensive codebase audit. Reads the entire codebase and generates detailed audit reports in /audits folder. Adapts to the actual tech stack — only produces reports that apply. Uses agent teams for parallel analysis.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Task
model: claude-sonnet-4-5-20250929
---

# Comprehensive Codebase Audit

## Objective

Read the entire codebase thoroughly and produce a complete, exhaustive audit that identifies every issue, weakness, vulnerability, inefficiency, inconsistency, and area of technical debt. Each issue must include its exact location (file path and line number where possible), severity rating, and a clear description of the problem and its impact.

## Setup

1. If the `audits/` folder does not exist at the project root, create it:
   ```bash
   mkdir -p audits
   ```

2. If a `docs/` folder exists, read all documentation first for additional context about the app's intended architecture and decisions.

3. Read the entire codebase before writing any audit reports. Build a mental model of:
   - The full file structure and every file's purpose
   - All dependencies and their versions
   - All data flows from user action to storage and back
   - All external service integrations
   - All patterns (and pattern violations)
   - All configuration and environment setup

## Execution Strategy

Use the Task tool to dispatch sub-agents for parallel audit generation, then compile findings into a summary.

**Phase 1 — Full Codebase Analysis (do this first, before dispatching agents):**

Perform the analysis yourself (do NOT delegate Phase 1 to a sub-agent). Scan the full codebase and determine:

- Complete file structure (directory tree)
- Tech stack: language, framework, build tool, styling, package manager
- Architecture type: SPA, SSR, full-stack monolith, microservices, etc.
- Persistence: how data is stored (database, localStorage, IndexedDB, in-memory, etc.)
- API surface: backend API routes (if any), or client-side calls to external APIs
- Authentication: present or absent, and what mechanism
- External services: every third-party API, SDK, or service the app connects to
- Environment variables: every variable referenced in the code
- All patterns used (and where they're violated)
- All TODO, FIXME, HACK, WORKAROUND, and XXX comments in the code
- Read package.json / lock file for dependency information
- Read any existing lint, TypeScript, or build configuration

**Critical: Write the Phase 1 analysis to `audits/_ANALYSIS.md`** so that sub-agents can read it. This file is a working artifact — it will be deleted after the audit is complete.

**Phase 1b — Determine which audit reports to generate:**

Based on the analysis, decide which reports from the catalog below apply to this codebase. Use these rules:

| Report | Generate when... | Skip when... |
|--------|-----------------|--------------|
| SECURITY_AUDIT.md | Always | Never |
| CODE_QUALITY_AUDIT.md | Always | Never |
| ARCHITECTURE_AUDIT.md | Always | Never |
| PERFORMANCE_AUDIT.md | Always | Never |
| DATABASE_AUDIT.md | App has a server-side database (PostgreSQL, MySQL, MongoDB, SQLite on server, Supabase, etc.) | Client-only storage (IndexedDB, localStorage) or no persistence |
| API_AUDIT.md | App has backend API routes (REST, GraphQL, tRPC, server actions) | Client-only SPA with no backend routes |
| STATE_MANAGEMENT_AUDIT.md | App has frontend with state management (React, Vue, Angular, Svelte, etc.) | No frontend, or purely server-rendered without client state |
| RELIABILITY_AUDIT.md | Always | Never |
| TYPE_SAFETY_AUDIT.md | App uses TypeScript or a typed language with a type system to audit | Plain JavaScript, Python, or dynamically typed language without type annotations |
| DEPENDENCY_AUDIT.md | App has a package manager and dependency manifest | No external dependencies |

Write the list of reports to generate at the top of `audits/_ANALYSIS.md`.

**Phase 2 — Parallel Audit Execution (dispatch sub-agents):**

For each report to generate, use the **Task tool** to dispatch a sub-agent. In each sub-agent's prompt:
1. Tell it to read `audits/_ANALYSIS.md` first for the codebase analysis
2. Tell it which audit report to generate and paste the relevant template from this file
3. Tell it to read the actual source files as needed to fill in specifics
4. Tell it which checklist items to skip based on the tech stack (see conditional items in templates below)

Dispatch all sub-agents in a single message so they run concurrently.

**Phase 3 — Summary Compilation (after all agents complete):**

- Read all generated audit reports
- Compile `audits/AUDIT_SUMMARY.md` from all individual findings
- Count total issues per severity per category
- Identify the top 10 most critical issues across all categories
- Calculate an overall health score
- Verify no duplicate issues across reports
- Verify every issue has a file path, severity, and clear description
- Delete `audits/_ANALYSIS.md`

---

## Severity Definitions

Use these consistently across ALL audit reports:

| Severity | Definition | Examples |
|----------|-----------|---------|
| **CRITICAL** | Immediate risk. Security vulnerability, data loss potential, or app-breaking bug. Must fix before any new feature work. | Exposed API keys, injection vulnerabilities, no auth on sensitive endpoints, cascade delete without confirmation |
| **HIGH** | Significant problem that affects reliability, correctness, or maintainability. Should fix soon. | Missing error handling on API calls, N+1 queries, no input validation, broken access control |
| **MEDIUM** | Code smell or inefficiency that makes the codebase harder to work with but doesn't break functionality. Fix during normal development. | Duplicated code, inconsistent naming, large files, prop drilling, missing types |
| **LOW** | Minor improvement opportunity. Nice to fix but low impact. | Unused imports, debug statements, minor style inconsistencies, missing comments on complex logic |

---

## Audit Report Specifications

Every template below uses conditional sections marked with `[IF ...]` / `[END IF]`. If the condition is false for this codebase, omit that entire section — do not leave empty headings or "N/A" placeholders.

### 1. `audits/SECURITY_AUDIT.md`

```markdown
# Security Audit

## Severity Summary
| Severity | Count |
|----------|-------|
| CRITICAL | X |
| HIGH | X |
| MEDIUM | X |
| LOW | X |

## Checks Performed

[IF auth exists]
### Authentication & Authorization
- [ ] Are all sensitive endpoints/operations protected by authentication?
- [ ] Is authorization checked (does user own the resource they're accessing)?
- [ ] Can a user access another user's data by changing IDs in URLs or request bodies?
- [ ] Are auth tokens stored securely (httpOnly cookies vs localStorage)?
- [ ] Is there session expiration and token refresh?
- [ ] Is there rate limiting on login/signup endpoints?
- [ ] Are passwords hashed (if applicable)?
- [ ] Is there brute force protection?
[END IF]

### Secrets & Configuration
- [ ] Are any API keys, tokens, or passwords hardcoded in the code?
- [ ] Are any secrets committed to the repository (check git history if accessible)?
- [ ] Are environment variables properly separated (server-only vs client-exposed)?
- [ ] Are client-exposed env vars truly safe to expose? (Adapt check to the framework: VITE_ for Vite, NEXT_PUBLIC_ for Next.js, REACT_APP_ for CRA, EXPO_PUBLIC_ for Expo, etc.)
- [ ] Is .env or equivalent in .gitignore?

### Input Validation & Injection
- [ ] Is user input validated (on server side if a backend exists, on client if client-only)?
- [ ] Are database queries parameterized (no string concatenation)?
- [ ] Is user-generated content sanitized before rendering (XSS prevention)?
- [ ] Are file uploads validated (type, size, content)?
- [ ] Is there protection against path traversal in file operations?

[IF backend exists]
### API Security
- [ ] Is CORS configured correctly (not wildcard in production)?
- [ ] Are security headers set (CSP, X-Frame-Options, etc.)?
- [ ] Is HTTPS enforced?
- [ ] Are API responses free of sensitive data leaks (stack traces, internal IDs, etc.)?
- [ ] Is there rate limiting on API endpoints?
[END IF]

[IF server database exists]
### Data Protection
- [ ] Is sensitive data encrypted at rest?
- [ ] Is sensitive data encrypted in transit?
- [ ] Are database connections using SSL?
- [ ] Is PII handled according to data minimization principles?
- [ ] Are there data retention or deletion mechanisms?
[END IF]

### Dependency Security
- [ ] Are there known vulnerabilities in dependencies (run audit command for the package manager)?
- [ ] Are dependencies pinned to specific versions?

## Findings

<!-- For each finding: -->

### [SEC-001] Title of the issue

**Severity:** CRITICAL / HIGH / MEDIUM / LOW
**Location:** `path/to/file.ts` lines 23-45
**Category:** <!-- Which checklist section -->

**Problem:**
<!-- Clear description of what's wrong -->

**Impact:**
<!-- What could happen if this is exploited or left unfixed -->

**Evidence:**
```
<!-- The actual problematic code snippet -->
```

**Recommendation:**
<!-- Brief description of the fix approach -->
```

### 2. `audits/CODE_QUALITY_AUDIT.md`

```markdown
# Code Quality Audit

## Severity Summary
| Severity | Count |
|----------|-------|
| CRITICAL | X |
| HIGH | X |
| MEDIUM | X |
| LOW | X |

## Checks Performed

### Dead Code
- [ ] Unused functions (defined but never called from anywhere)
- [ ] Unused variables and constants
- [ ] Unused imports
- [ ] Unused components/modules (defined but never used)
- [ ] Unused files (not imported by anything)
- [ ] Commented-out code blocks
- [ ] Unused styles (CSS classes, styled-components, Tailwind classes applied to nothing)
- [ ] Unused type definitions
- [ ] Unused environment variables (defined but never read)
- [ ] Unreachable code (after return statements, impossible conditions)

### Duplicated Code
- [ ] Functions or logic blocks that are copy-pasted across files
- [ ] Similar components/modules that could be consolidated
- [ ] Repeated validation logic
- [ ] Repeated error handling patterns
- [ ] Repeated API call patterns
- [ ] Repeated string literals that should be constants

### Complexity
- [ ] Functions longer than 50 lines
- [ ] Files longer than 300 lines
- [ ] Functions with more than 4 parameters
- [ ] Nesting deeper than 3 levels (if/else, loops, callbacks)
- [ ] Functions with more than 3 responsibilities (should be split)
- [ ] Complex conditional expressions that need simplification

### Naming
- [ ] Inconsistent naming conventions (camelCase mixed with snake_case)
- [ ] Same concept named differently in different files
- [ ] Vague names (data, info, item, stuff, temp, result, val)
- [ ] Misleading names (function named getUser that also creates a user)
- [ ] Single-letter variable names outside of loop counters
- [ ] Boolean variables not prefixed with is/has/can/should

### Code Smells
- [ ] Magic numbers (unexplained numeric literals)
- [ ] Hardcoded strings that should be constants or config
- [ ] Debug statements left in production code (console.log, print, etc.)
- [ ] Empty catch blocks that swallow errors silently
- [ ] Mutating function parameters instead of returning new values
- [ ] Nested ternary operators
- [ ] Callback hell (deeply nested callbacks instead of async/await)

## Findings

<!-- Same format as SECURITY_AUDIT: ID, title, severity, location, problem, impact, evidence, recommendation -->
```

### 3. `audits/ARCHITECTURE_AUDIT.md`

```markdown
# Architecture Audit

## Severity Summary
| Severity | Count |
|----------|-------|
| CRITICAL | X |
| HIGH | X |
| MEDIUM | X |
| LOW | X |

## Checks Performed

### Separation of Concerns
- [ ] Is business logic separated from UI/presentation?
- [ ] Is data access separated from business logic?
- [ ] Is validation logic centralized or scattered?
- [ ] Is error handling centralized or reimplemented everywhere?
- [ ] Are utility functions properly organized?

### Pattern Consistency
- [ ] Do all similar modules follow the same structure?
- [ ] Is data fetching/loading done the same way everywhere?
- [ ] Is error handling done the same way everywhere?
- [ ] Are file and folder naming conventions followed consistently?

### Dependency Management
- [ ] Are there circular dependencies between modules?
- [ ] Are import paths consistent (relative vs absolute)?
- [ ] Is there a clear dependency direction (UI → Logic → Data)?
- [ ] Are there any modules that depend on too many other modules?

### Abstraction Quality
- [ ] Are there missing abstractions (same operation repeated in multiple places)?
- [ ] Are there unnecessary abstractions (wrapper that just calls the inner function)?
- [ ] Are there leaky abstractions (callers need internal knowledge)?
- [ ] Are there God objects/modules (one file that does everything)?

### File Organization
- [ ] Does the folder structure match the architecture?
- [ ] Are related files grouped together?
- [ ] Is there a predictable location for every type of file?
- [ ] Are there files in the wrong directory?

### Configuration Management
- [ ] Is configuration centralized?
- [ ] Are environment-specific settings properly separated?
- [ ] Are defaults defined for optional configuration?

## Findings

<!-- Same format: ID, title, severity, location, problem, impact, evidence, recommendation -->
```

### 4. `audits/PERFORMANCE_AUDIT.md`

```markdown
# Performance Audit

## Severity Summary
| Severity | Count |
|----------|-------|
| CRITICAL | X |
| HIGH | X |
| MEDIUM | X |
| LOW | X |

## Checks Performed

Adapt to the actual tech stack. Only check the sections that apply.

[IF frontend exists]
### Frontend Performance
- [ ] Components that re-render unnecessarily (missing memoization)
- [ ] Large component trees that re-render on every state change
- [ ] Missing key props on list items (or using index as key)
- [ ] Large images without optimization (no lazy loading, no sizing)
- [ ] No code splitting (entire app loaded on first page)
- [ ] Large bundle size from unnecessary imports
- [ ] Multiple libraries serving the same purpose
- [ ] No debouncing on frequent events (search inputs, resize, scroll)
- [ ] Heavy computations on the main thread without Web Workers
- [ ] Animations causing layout thrashing
[END IF]

### General Performance
- [ ] Synchronous operations that should be async
- [ ] Missing caching on expensive operations
- [ ] Inefficient algorithms (O(n²) where O(n) is possible)
- [ ] API calls made sequentially that could be parallel
- [ ] Large payloads where smaller ones would suffice

[IF server database exists]
### Database Performance
- [ ] N+1 query problems (loading related data in a loop)
- [ ] Missing indexes on frequently queried columns
- [ ] SELECT * instead of selecting specific columns
- [ ] No pagination on list queries
- [ ] Queries inside loops
- [ ] No connection pooling
- [ ] Missing query timeouts
[END IF]

### Memory
- [ ] Event listeners not cleaned up on unmount/destroy
- [ ] Intervals/timeouts not cleared
- [ ] Subscriptions not unsubscribed
- [ ] Large data structures held in memory unnecessarily
- [ ] Growing arrays or maps that are never pruned

[IF AI/LLM integration exists]
### AI/LLM Performance
- [ ] Prompt caching not utilized or implemented incorrectly
- [ ] Unnecessarily large system prompts
- [ ] Sending inactive or irrelevant documents in context
- [ ] No streaming of AI responses
- [ ] No token counting or context window management
- [ ] Redundant API calls (same prompt sent twice)
[END IF]

## Findings

<!-- Same format: ID, title, severity, location, problem, impact, evidence, recommendation -->
```

### 5. `audits/DATABASE_AUDIT.md`

> **Only generate this report if the app has a server-side database.** Skip for client-only storage (IndexedDB, localStorage).

```markdown
# Database Audit

## Severity Summary
| Severity | Count |
|----------|-------|
| CRITICAL | X |
| HIGH | X |
| MEDIUM | X |
| LOW | X |

## Checks Performed

### Schema Design
- [ ] Are all relationships properly defined with foreign keys?
- [ ] Are CASCADE rules appropriate (not deleting too much or too little)?
- [ ] Are column types appropriate (not storing numbers as text, etc.)?
- [ ] Are there unnecessary nullable columns?
- [ ] Are there missing NOT NULL constraints?
- [ ] Are default values set where appropriate?
- [ ] Are there missing unique constraints?
- [ ] Are there missing check constraints?
- [ ] Is there proper use of enums vs free text?
- [ ] Are timestamps (created_at, updated_at) present on all tables?

### Data Integrity
- [ ] Can orphaned records be created (child without parent)?
- [ ] Is there referential integrity between all related tables?
- [ ] Are there any tables without a primary key?

[IF RLS-capable database (e.g. Supabase, PostgreSQL with RLS)]
### Row-Level Security
- [ ] Are RLS policies in place on all user-facing tables?
- [ ] Are RLS policies correct (not too permissive)?
- [ ] Can users access data they shouldn't?
- [ ] Is the service role key used only where absolutely necessary?
[END IF]

### Migrations
- [ ] Are there migration files for all schema changes?
- [ ] Are migrations reversible?
- [ ] Does the current schema match the migrations?

### Queries
- [ ] Are all queries parameterized?
- [ ] Are there raw SQL queries that bypass the ORM?
- [ ] Are transactions used where multiple operations must succeed together?
- [ ] Are error cases handled for constraint violations?

## Findings

<!-- Same format: ID, title, severity, location, problem, impact, evidence, recommendation -->
```

### 6. `audits/API_AUDIT.md`

> **Only generate this report if the app has backend API routes.** Skip for client-only SPAs that only call external APIs (those are covered in the Security and Performance audits).

```markdown
# API Audit

## Severity Summary
| Severity | Count |
|----------|-------|
| CRITICAL | X |
| HIGH | X |
| MEDIUM | X |
| LOW | X |

## Checks Performed

### Endpoint Design
- [ ] Are all endpoints using appropriate HTTP methods?
- [ ] Are URL paths consistent and following conventions?
- [ ] Are there endpoints that do too many things (should be split)?
- [ ] Are there redundant endpoints (two endpoints doing the same thing)?

### Request Handling
- [ ] Is every request body validated (types, required fields, length limits)?
- [ ] Are query parameters validated?
- [ ] Are path parameters validated?
- [ ] Are file uploads validated (type, size)?
- [ ] Are unknown/extra fields rejected or ignored consistently?

### Response Handling
- [ ] Is the response format consistent across all endpoints?
- [ ] Are appropriate HTTP status codes used?
- [ ] Are error responses informative but not leaking internal details?
- [ ] Is pagination implemented for list endpoints?

### Error Handling
- [ ] Does every endpoint have try/catch or error middleware?
- [ ] Are all possible error scenarios handled (not just the happy path)?
- [ ] Are external service failures handled gracefully?
- [ ] Are validation errors returned with field-specific messages?
- [ ] Is there a global error handler for unhandled exceptions?

### External API Calls
- [ ] Do all external API calls have timeouts?
- [ ] Is there retry logic for transient failures?
- [ ] Are external API errors handled and translated?

## Findings

<!-- Same format: ID, title, severity, location, problem, impact, evidence, recommendation -->
```

### 7. `audits/STATE_MANAGEMENT_AUDIT.md`

> **Only generate this report if the app has frontend state management.**

```markdown
# State Management Audit

## Severity Summary
| Severity | Count |
|----------|-------|
| CRITICAL | X |
| HIGH | X |
| MEDIUM | X |
| LOW | X |

## Checks Performed

### State Organization
- [ ] Is global state used only for truly global data?
- [ ] Is local state kept local (not elevated unnecessarily)?
- [ ] Is there a single source of truth for each piece of data?
- [ ] Are there state duplications (same data in multiple places)?

### Async State
- [ ] Are loading states handled for every async operation?
- [ ] Are error states handled for every async operation?
- [ ] Is there a consistent data fetching pattern?
- [ ] Are there race conditions in data fetching (older request overwriting newer)?

### Component State
- [ ] Is there prop drilling (data passed through many levels)?
- [ ] Are there components with too many props (>7)?
- [ ] Are there derived states that should be computed (not stored)?
- [ ] Are effect dependencies correct (no missing or extra dependencies)?
- [ ] Are there infinite re-render loops?
- [ ] Are there effects that should be event handlers instead?

### Form State
- [ ] Is form validation consistent?
- [ ] Are form errors displayed appropriately?
- [ ] Is form state reset after submission?
- [ ] Is form data validated before submission?

## Findings

<!-- Same format: ID, title, severity, location, problem, impact, evidence, recommendation -->
```

### 8. `audits/RELIABILITY_AUDIT.md`

```markdown
# Reliability Audit

## Severity Summary
| Severity | Count |
|----------|-------|
| CRITICAL | X |
| HIGH | X |
| MEDIUM | X |
| LOW | X |

## Checks Performed

### Error Recovery
- [ ] Does a single component/module crash bring down the entire app?
- [ ] Can the user recover from errors without refreshing?
- [ ] Are there retry mechanisms for failed operations?
- [ ] Are there fallback UIs for failed components?

### Edge Cases
- [ ] What happens with empty states (no data, no results)?
- [ ] What happens with very long text or very large numbers?
- [ ] What happens with special characters in user input?
- [ ] What happens with concurrent operations (two tabs, rapid clicks)?
- [ ] What happens when external services are down?
- [ ] What happens when the network is slow or offline?
- [ ] What happens when storage is full or unavailable?

### Race Conditions
- [ ] Can double-clicking a submit button create duplicate records?
- [ ] Can rapid navigation cause stale data to display?
- [ ] Can two simultaneous operations produce inconsistent state?
- [ ] Is there optimistic UI that can get out of sync?

### Data Consistency
- [ ] Can the UI show data that doesn't match the persisted state?
- [ ] Are there operations that partially complete on failure?
- [ ] Are there caches that can become stale?

### Logging & Observability
- [ ] Are errors logged (not just caught silently)?
- [ ] Are sensitive data excluded from logs?

## Findings

<!-- Same format: ID, title, severity, location, problem, impact, evidence, recommendation -->
```

### 9. `audits/TYPE_SAFETY_AUDIT.md`

> **Only generate this report if the app uses TypeScript or another statically typed language.**

```markdown
# Type Safety Audit

## Severity Summary
| Severity | Count |
|----------|-------|
| CRITICAL | X |
| HIGH | X |
| MEDIUM | X |
| LOW | X |

## Checks Performed

### Compiler Configuration
- [ ] Is strict mode enabled in the type config (tsconfig.json, etc.)?
- [ ] Is noImplicitAny enabled?
- [ ] Is strictNullChecks enabled?
- [ ] Are there overly permissive compiler options?

### Type Coverage
- [ ] Are there any `any` types (explicit or implicit)?
- [ ] Are function parameters fully typed?
- [ ] Are function return types specified (not just inferred)?
- [ ] Are all API response types defined?
- [ ] Are component props fully typed?
- [ ] Are event handlers properly typed?
- [ ] Are there type assertions (as Type) that could be avoided?
- [ ] Are there non-null assertions (!) that could be avoided?

### Type Quality
- [ ] Are types too broad (string where a union type would be safer)?
- [ ] Are there types that don't match the actual runtime data?
- [ ] Are shared types defined in a central location?
- [ ] Are there duplicate type definitions?
- [ ] Are utility types used instead of manual retyping?
- [ ] Are enum values used instead of magic strings?

### Type Safety Gaps
- [ ] Are external API responses validated at runtime (not just typed)?
- [ ] Are environment variables typed and validated?
- [ ] Are JSON.parse results typed and validated?

## Findings

<!-- Same format: ID, title, severity, location, problem, impact, evidence, recommendation -->
```

### 10. `audits/DEPENDENCY_AUDIT.md`

```markdown
# Dependency Audit

## Severity Summary
| Severity | Count |
|----------|-------|
| CRITICAL | X |
| HIGH | X |
| MEDIUM | X |
| LOW | X |

## Checks Performed

### Security
- [ ] Run the package manager's audit command and report all vulnerabilities
- [ ] Are there dependencies with known CVEs?
- [ ] Are there dependencies that are no longer maintained?
- [ ] Are dependency versions pinned (exact versions vs ranges)?

### Bloat
- [ ] Are there dependencies that are not used in the code?
- [ ] Are there dependencies that duplicate functionality?
- [ ] Are there dependencies imported for a single function that could be replaced with a few lines of code?
- [ ] Are devDependencies correctly separated from production dependencies?

### Currency
- [ ] Are major version updates available for key dependencies?
- [ ] Are there deprecated dependencies?
- [ ] Is the runtime version (Node.js, Python, etc.) current and supported?
- [ ] Is the package manager version current?

### Lock File
- [ ] Does a lock file exist?
- [ ] Is the lock file committed to version control?
- [ ] Is the lock file in sync with the dependency manifest?

## Dependency List

<!-- List EVERY dependency with: -->
| Package | Version | Used In | Purpose | Issues |
|---------|---------|---------|---------|--------|
| ... | ... | ... | ... | None / Outdated / Vulnerable / Unused |

## Findings

<!-- Same format: ID, title, severity, location, problem, impact, evidence, recommendation -->
```

### Summary Report: `audits/AUDIT_SUMMARY.md`

This is always generated last, after all individual reports are complete.

```markdown
# Codebase Audit Summary

**Audit Date:** <!-- Current date -->
**Codebase:** <!-- App name / repo -->
**Tech Stack:** <!-- Brief tech stack -->
**Reports Generated:** <!-- List which reports were produced and which were skipped (with reason) -->

## Overall Health Score

<!-- Calculate based on findings:
     Start at 100, deduct:
     - CRITICAL: -15 each (cap deduction at -60)
     - HIGH: -5 each (cap deduction at -30)
     - MEDIUM: -1 each (cap deduction at -20)
     - LOW: -0.25 each (cap deduction at -10)
     Minimum score: 0

     The caps prevent a single category from zeroing out the score.

     Display as: XX / 100

     Rating:
     90-100: Excellent
     75-89: Good
     60-74: Fair — needs attention
     40-59: Poor — significant issues
     0-39: Critical — urgent remediation needed
-->

## Issues by Severity

| Severity | Count | Categories |
|----------|-------|------------|
| CRITICAL | X | Security (X), ... |
| HIGH | X | Code Quality (X), ... |
| MEDIUM | X | Architecture (X), ... |
| LOW | X | Type Safety (X), ... |
| **Total** | **X** | |

## Issues by Category

<!-- Only include rows for reports that were generated -->
| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| ... | X | X | X | X | X |
| **Total** | **X** | **X** | **X** | **X** | **X** |

## Top 10 Most Critical Issues

<!-- List the 10 most important issues to fix first, across all categories.
     For each:
     - Issue ID (e.g., SEC-001)
     - Title
     - Category
     - Severity
     - File location
     - One-line description
     - Which audit report has the full details
-->

| Priority | Issue ID | Title | Severity | Location | Report |
|----------|----------|-------|----------|----------|--------|
| 1 | ... | ... | ... | ... | ... |

## Recommended Fix Order

### Phase 1: Critical Security & Data Integrity (fix immediately)
<!-- List all CRITICAL issues -->

### Phase 2: High-Impact Reliability & Performance (fix this week)
<!-- List all HIGH issues -->

### Phase 3: Code Quality & Architecture (fix during normal development)
<!-- List all MEDIUM issues grouped by related area -->

### Phase 4: Polish & Optimization (fix when time allows)
<!-- List all LOW issues -->

## Positive Findings

<!-- Note what's done WELL in the codebase:
     - Good patterns that should be maintained
     - Well-structured areas
     - Good security practices in place
     - Effective use of frameworks/libraries
     This balances the audit and helps preserve good patterns during fixes
-->
```

---

## Global Audit Rules

Apply these rules across ALL audit reports:

1. **Evidence required** — Every finding must include the actual problematic code snippet. Never report an issue without showing the code.

2. **Exact locations** — Every finding must include the file path. Include line numbers where possible. If the issue spans a range, specify the range.

3. **No false positives** — Only report actual issues confirmed by reading the code. Do not report hypothetical problems or things that "might" be wrong. If you're uncertain, state the uncertainty.

4. **No duplicates across reports** — Each issue appears in exactly one report (the most relevant category). Do not repeat the same issue in multiple reports. Cross-reference if needed: "See also SEC-003 in SECURITY_AUDIT.md."

5. **Severity must be justified** — The severity rating must match the impact described. A CRITICAL issue must have a serious, concrete impact. Do not inflate severity.

6. **Be specific, not generic** — "Error handling is inconsistent" is not a finding. "The processFile function in utils/fileProcessing.ts:45 has no try/catch — a parse error will crash the calling component" is a finding.

7. **Count everything** — The summary totals must match the actual number of findings in the individual reports. Verify the counts.

8. **Positive findings matter** — The audit summary must include what's working well. This prevents good patterns from being accidentally destroyed during fixes.

9. **Completeness check** — After generating all reports, verify that every source file in the codebase was examined. If any files were skipped, go back and audit them.

10. **Actionable** — Every finding's recommendation must be concrete enough that a developer (or AI) can implement the fix without further research.

11. **Stack-agnostic** — Use the actual technologies found in the codebase. Do not reference framework-specific patterns (Next.js, Supabase, etc.) unless they are actually present. Adapt all checks to the real tech stack.

12. **Conditional sections** — If a template section is wrapped in `[IF ...]` / `[END IF]` and the condition is false, omit it entirely. Do not leave empty headings or "N/A" placeholders.
