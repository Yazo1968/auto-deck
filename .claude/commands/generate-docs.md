---
description: Generate complete app documentation by reading the entire codebase. Adapts to any tech stack — produces only the documents that apply. Uses agent teams for parallel generation.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Task
model: claude-sonnet-4-6
---

# Generate App Documentation

## Objective

Read the entire codebase thoroughly and generate comprehensive, exhaustive documentation that gives a future developer (human or AI) complete understanding of this application. The documentation must be sufficient to develop the app further, audit it, fix bugs, optimize it, or perform any development task without needing to ask clarifying questions.

## Setup

1. If the `docs/` folder does not exist at the project root, create it:
   ```bash
   mkdir -p docs
   ```

2. Read the entire codebase before writing any documentation. Understand:
   - Every file and its purpose
   - Every function, component, route, model, and utility
   - All relationships and dependencies between files
   - All external services and integrations
   - All configuration and environment requirements
   - All patterns, conventions, and architectural decisions

## Execution Strategy

Use the Task tool to dispatch sub-agents for parallel document generation, then perform a final consistency pass.

**Phase 1 — Codebase Analysis (do this first, before dispatching agents):**

Perform the analysis yourself (do NOT delegate Phase 1 to a sub-agent). Scan the full codebase and determine:

- Complete file structure (directory tree)
- Tech stack: language, framework, build tool, styling, package manager
- Architecture type: SPA, SSR, full-stack monolith, microservices, etc.
- State management: how data is stored (database, localStorage, IndexedDB, in-memory, etc.)
- API surface: backend API routes (if any), or client-side calls to external APIs
- Authentication: present or absent, and what mechanism
- External services: every third-party API, SDK, or service the app connects to
- Environment variables: every variable referenced in the code
- AI/LLM prompts: every prompt file, what model it targets, what it produces, how it's constructed (template literals, helper functions, cached blocks)
- Custom hooks: all hooks with significant business logic (>50 lines), their interfaces, and what they orchestrate
- TODO comments, known issues, workarounds

**Critical: Write the Phase 1 analysis to `docs/_ANALYSIS.md`** so that sub-agents can read it. This file is a working artifact — it will be deleted after generation is complete.

**Phase 1b — Determine which documents to generate:**

Based on the analysis, decide which documents from the catalog below apply to this codebase. Use these rules:

| Document | Generate when... | Skip when... |
|----------|-----------------|--------------|
| APP_OVERVIEW.md | Always | Never |
| ARCHITECTURE.md | Always | Never |
| DATA_MODELS.md | App has structured data (types, interfaces, schemas, DB tables) | No data modeling at all |
| API_REFERENCE.md | App has backend API routes OR calls external APIs with non-trivial request/response handling | Pure static site with no API interaction |
| FEATURES.md | Always | Never |
| DATA_FLOW.md | Always | Never |
| FILE_STRUCTURE.md | Always | Never |
| CONVENTIONS.md | Always | Never |
| ENVIRONMENT.md | App has environment variables, build config, or external dependencies | Single static HTML file |
| HOOKS.md | App has custom hooks with significant business logic (>50 lines each) | No custom hooks, or hooks are trivial wrappers |
| PROMPTS.md | App has AI/LLM integration with dedicated prompt files or complex prompt construction | No AI integration, or prompts are simple inline strings |
| DECISIONS.md | Always | Never |

Write the list of documents to generate at the top of `docs/_ANALYSIS.md`.

**Phase 2 — Parallel Document Generation (dispatch sub-agents):**

For each document to generate, use the **Task tool** to dispatch a sub-agent. In each sub-agent's prompt:
1. Tell it to read `docs/_ANALYSIS.md` first for the codebase analysis
2. Tell it which document to generate and paste the relevant template from this file
3. Tell it to read the actual source files as needed to fill in specifics

Dispatch all sub-agents in a single message so they run concurrently.

If generating 8+ documents, group related documents into agent batches (each agent generates 2-3 related docs for better internal consistency):
- Batch 1: APP_OVERVIEW + ARCHITECTURE + DECISIONS (high-level understanding)
- Batch 2: DATA_MODELS + DATA_FLOW + API_REFERENCE (data layer)
- Batch 3: FEATURES + HOOKS + PROMPTS (feature implementation)
- Batch 4: FILE_STRUCTURE + CONVENTIONS + ENVIRONMENT (developer reference)

**Phase 3 — Consistency Verification (after all agents complete):**

Read all generated documents and cross-reference:
- Type names, interface names, and field names are identical across DATA_MODELS.md, API_REFERENCE.md, DATA_FLOW.md, FEATURES.md, HOOKS.md, and PROMPTS.md
- File paths referenced in FILE_STRUCTURE.md match those mentioned in ARCHITECTURE.md and CONVENTIONS.md
- Environment variables listed in ENVIRONMENT.md match those referenced in ARCHITECTURE.md and DATA_FLOW.md
- Component and function names are consistent everywhere they appear
- No document contradicts another
- Fix any inconsistencies found

Then delete `docs/_ANALYSIS.md`.

---

## Document Specifications

Every template below uses conditional sections marked with `[IF ...]` / `[END IF]`. If the condition is false for this codebase, omit that entire section — do not leave empty headings or "N/A" placeholders.

### 1. `docs/APP_OVERVIEW.md`

```markdown
# App Overview

## Purpose
<!-- One clear paragraph: what the app does and the problem it solves -->

## Target Users
<!-- Who uses this app and why -->

## Core Concepts & Glossary
<!-- Define every domain-specific term used in the app.
     For each term, provide:
     - Name
     - Definition (what it means in this app's context)
     - How it relates to other concepts
     Be thorough — include terms from types, UI labels, variable names,
     and any jargon a new developer would need to look up. -->

## Tech Stack
<!-- List every technology with its version and role.
     Include ONLY what actually exists in the codebase:
     - Language & runtime
     - Frontend framework & version
     - Build tool
     - Styling approach
     - State management approach
     - Persistence mechanism (database, IndexedDB, localStorage, etc.)
     - AI/LLM providers and models used
     - Testing frameworks (or "None")
     - Package manager
     - Any other significant libraries (list each with its purpose)

     [IF backend exists]
     - Backend framework
     - ORM / database client
     [END IF]

     [IF auth exists]
     - Authentication provider / mechanism
     [END IF]

     [IF deployment is configured]
     - Deployment platform
     [END IF]
-->

## High-Level Architecture
<!-- Describe the system in one paragraph: how the pieces connect.
     Include a text-based diagram showing the actual architecture.
     Adapt the diagram to reality — examples:

     Client-side SPA:
     User → React SPA → External APIs (Claude, Gemini, etc.)
                      → Browser Storage (IndexedDB)

     Full-stack app:
     User → Frontend (Next.js) → API Routes → Database
                                             → External APIs

     Use whatever shape matches this codebase. -->
```

### 2. `docs/ARCHITECTURE.md`

```markdown
# Architecture

## System Design
<!-- Overall architecture pattern:
     - Client-side SPA, SSR, full-stack monolith, microservices, etc.
     - How the pieces connect end-to-end
     - Text diagram of the full system -->

## Frontend Architecture
<!-- Framework and version
     Routing approach:
       - File-based routing (Next.js, Remix)
       - Client-side router (React Router, etc.)
       - Conditional rendering (no router — state-driven view switching)
       - Other
     State management:
       - What mechanism (React Context, Zustand, Redux, useState, etc.)
       - What is global vs local state
       - How state is structured (single store, multiple contexts, etc.)
     View/page structure — list every view/page/route with:
       - Route path (or state condition that shows it)
       - What it displays
       - Key components it uses
     Component organization:
       - How components are structured in the file system
       - Shared/reusable vs feature-specific components
       - Layout components (if any)
     Styling approach
     How data is fetched or loaded on the client -->

[IF backend exists]
## Backend Architecture
<!-- Framework and version
     API layer design (REST, GraphQL, tRPC, server actions, etc.)
     Route/endpoint organization
     Middleware pipeline
     Business logic layer
     Data access layer
     Error handling strategy
     [IF auth exists]
     Authentication & authorization flow
     [END IF]
-->
[END IF]

## Persistence / Storage
<!-- How and where data is persisted. Adapt to what actually exists:

     [IF server database exists]
     Database type and provider
     Connection method
     Migration strategy
     [END IF]

     [IF client-side storage is used]
     Storage mechanism (IndexedDB, localStorage, sessionStorage, etc.)
     What data is stored and in what shape
     How data is loaded on app startup
     How data is saved (auto-save, explicit save, on state change, etc.)
     Storage limits and overflow handling

     [IF IndexedDB or complex client storage exists]
     ### Storage Schema
     Database name, version, all object stores with key paths

     ### Migrations
     Version history: what each schema version changed

     ### Serialization
     How in-memory models map to stored format.
     Document any transformations (e.g., Card → StoredHeading,
     images extracted to separate store, Blob optimization)

     ### Save Strategy
     Trigger mechanism (auto-save, debounce intervals, explicit)
     Dirty detection method
     Atomic transaction scope
     Orphan/stale data cleanup

     ### Performance Optimizations
     Blob vs base64, lazy loading, batch operations
     [END IF]
     [END IF]

     [IF no persistence]
     State is ephemeral — describe what is lost on page refresh
     [END IF]
-->

## External Services & Integrations
<!-- For EACH external service the app connects to:
     - Service name and what it's used for
     - Connection method (SDK, REST API, fetch, etc.)
     - Authentication method (API key, OAuth, etc.)
     - Which parts of the app call it
     - Key request/response patterns
     - Rate limits or quotas to be aware of
     - Error/fallback behavior -->

[IF deployment is configured]
## Deployment
<!-- Build process, platform, CI/CD, environment tiers -->
[END IF]

## Security Considerations
<!-- Adapt to what exists:
     [IF auth exists]
     Authentication mechanism, session management, protected routes
     [END IF]

     [IF API keys are in client code]
     How API keys are handled (build-time injection, env vars, etc.)
     Exposure risks and mitigations
     [END IF]

     Input validation approach
     Any CORS configuration
     Sensitive data handling -->
```

### 3. `docs/DATA_MODELS.md`

> **Replaces the old DATABASE_SCHEMA.md.** This document covers all structured data — whether it lives in a database, in TypeScript interfaces, in IndexedDB, or in React state. Generate this whenever the app has meaningful data structures.

```markdown
# Data Models

## Overview
<!-- Where data lives (server DB, IndexedDB, in-memory state, etc.)
     How models are defined (TypeScript interfaces, Prisma schema, SQL, etc.)
     How models relate to each other at a high level -->

## Models

<!-- For EVERY significant data type/interface/table in the codebase: -->

### `ModelName`

**Defined in:** <!-- exact file path -->

**Purpose:** <!-- What this model represents -->

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | string | Yes | generated | Unique identifier |
| ... | ... | ... | ... | ... |

**Relationships:**
<!-- How this model connects to others:
     - Contains: Card[] (embedded array)
     - Referenced by: Project.nuggetIds (ID array)
     - Belongs to: Project (via Project.nuggetIds)
-->

[IF the model has nested sub-types or maps]
**Nested Structures:**
<!-- Document significant nested types (e.g., per-level maps, embedded objects) -->

[IF model has Map or Record fields]
**Map Fields:**
<!-- For each Map/Record field:
     | Field | Key Type | Value Type | Purpose |
     |-------|----------|------------|---------|
     | synthesisMap | DetailLevel | string | Cached synthesis text per detail level |
-->
[END IF]
[END IF]

---

[IF server database exists]
## Database Tables
<!-- For each table, provide the full schema with columns, types,
     constraints, indexes, foreign keys, and any RLS policies. -->
[END IF]

## Enums & Union Types
<!-- For every enum, union type, or constrained set of values:
     | Value | Description |
     |-------|-------------|
     | ... | ... |
-->

## Entity Relationship Summary
<!-- Text-based diagram showing how all models connect:
     Project 1——N Nugget (via nuggetIds)
     Nugget 1——N Card (embedded)
     Nugget 1——N UploadedFile (embedded)
-->
```

### 4. `docs/API_REFERENCE.md`

> Generate this document if the app has backend API routes OR if the app makes significant client-side calls to external APIs with structured request/response handling. Adapt the format to what exists.

```markdown
# API Reference

## Overview
<!-- Describe the API surface:
     [IF backend API routes exist]
     - Base URL, API style (REST, GraphQL, etc.)
     - Authentication method
     - Common headers
     [END IF]

     [IF client-side external API calls exist]
     - Which external APIs are called directly from the client
     - How API clients are initialized
     - How authentication is handled (API keys, tokens, etc.)
     [END IF]
-->

[IF backend API routes exist]
## Backend Endpoints

<!-- For EVERY endpoint: -->

### `METHOD /path/to/endpoint`
**Purpose:** <!-- what it does -->
**Authentication:** Required / Optional / None
**Request:** <!-- params, query, body -->
**Response:** <!-- shape and status codes -->
**Error Responses:** <!-- error cases -->
**Side Effects:** <!-- anything triggered -->

[END IF]

[IF client-side external API calls exist]
## External API Integrations

<!-- For EACH external API the app calls: -->

### [Service Name] API

**Client initialization:** <!-- how the client is created, which file -->

**Calls made:**

#### [Call Name / Purpose]
- **Function:** <!-- function name and file -->
- **Endpoint:** <!-- URL or SDK method -->
- **Request format:** <!-- what is sent -->
- **Response format:** <!-- what comes back -->
- **Streaming:** <!-- yes/no, and how it's handled -->
- **Error handling:** <!-- what happens on failure -->

[END IF]

[IF multiple AI/LLM providers exist]
## AI Provider Orchestration
<!-- How providers are selected per task:
     - Which provider handles which capability (e.g., text vs. image generation)
     - Fallback chains (primary → secondary provider)
     - Key rotation / retry logic
     - Rate limiting and error recovery
     - Token budgeting per provider -->
[END IF]

[IF Files API or document management API exists]
## Document Management API
<!-- How documents are uploaded, cached, and referenced in API calls:
     - File lifecycle: upload → fileId → reference in messages → expiry
     - Token budget implications (inline content vs. file reference)
     - Caching and reuse strategy -->
[END IF]
```

### 5. `docs/FEATURES.md`

```markdown
# Features

<!-- For EVERY user-facing feature in the app: -->

## Feature: [Feature Name]

### Description
<!-- What this feature does from the user's perspective -->

### User Interaction Flow
<!-- Step-by-step how the user interacts:
     1. User does X
     2. System responds with Y
     3. ...
-->

### UI Components Involved
<!-- List components with exact file paths -->

### Data Operations
<!-- What data is read, created, updated, or deleted.
     Adapt to the app's storage mechanism:
     [IF database] Which tables and queries
     [IF client-side] Which state/storage is modified
     [IF external API] Which API calls are made
-->

### Business Rules & Validation
<!-- All rules that govern this feature -->

### Edge Cases
<!-- Known edge cases and how they're handled -->

### State Management
<!-- How this feature's state flows:
     - Where state lives (local component, context, global store)
     - How state changes propagate to the UI
     - Any derived/computed state -->

[IF this feature involves a multi-step pipeline]
### Pipeline / Multi-Stage Process
<!-- Stage 1: [Name] — what happens, which function, what's produced
     Stage 2: [Name] — input from stage 1, transformation, output
     ...
     Include: retry behavior, partial failure handling,
     cancellation support, progress tracking -->
[END IF]

[IF this feature spans multiple panels/components]
### Cross-Component Coordination
<!-- Which components participate and what role each plays.
     How they communicate (shared state, callbacks, events).
     What triggers transitions between components. -->
[END IF]
```

### 6. `docs/DATA_FLOW.md`

```markdown
# Data Flow

<!-- Document every significant data flow in the app end-to-end.
     Trace data from its origin to its final destination. -->

## Flow: [Flow Name]

### Trigger
<!-- What initiates this flow:
     - User action (clicks button, submits form, drags file)
     - System event (timer, app startup, state change)
     - External event (API callback, message received)
-->

### Steps
<!-- Number every step. For each step:
     - What happens
     - Which file/function handles it
     - What data is transformed and how
     - What is passed to the next step

Example format (adapt to match the actual flow):

Step 1: User drops a file onto the upload zone
  → SourcesPanel.tsx onDrop handler
  → Reads file bytes, determines type

Step 2: File is parsed into text content
  → parseDocument() in utils/docParser.ts
  → DOCX: extracts text via JSZip
  → MD: reads as UTF-8 string
  → PDF: sends to Claude API as document block

Step 3: Parsed content is stored in state
  → updateNugget() adds UploadedFile to nugget.documents
  → Triggers re-render of document list
  → Auto-persisted to IndexedDB via useEffect
-->

### Error Handling
<!-- What happens when each step fails -->

### Performance Considerations
<!-- Caching, streaming, debouncing, batching, etc. -->

---

<!-- Include flows for at minimum:
     - App startup / data loading
     - Every major user workflow (document upload, content generation, etc.)
     - Every AI/LLM call chain
     - Data persistence (save/load cycle)
     [IF auth exists] Authentication flows [END IF]
     [IF real-time features exist] Real-time/websocket flows [END IF]
     [IF payments exist] Payment/billing flows [END IF]
-->
```

### 7. `docs/FILE_STRUCTURE.md`

```markdown
# File Structure

## Directory Tree

<!-- Show the ACTUAL directory tree of this project.
     Exclude: node_modules, .git, dist, build, .next, and generated directories.

     For EVERY folder: one-line description of what it contains.
     For EVERY file: one-line description of what it does.

     Go as deep as needed to cover every source file.
     Do NOT use example paths from other projects — read the real file system. -->

## Key Files
<!-- For the 5-10 most important files in the codebase, provide a 2-3 sentence
     description of what they do and why they're central to the app. -->

## Naming Conventions
<!-- Document the actual naming patterns found in this codebase:
     - Files: PascalCase, camelCase, kebab-case, etc.
     - Components: naming convention
     - Functions: naming convention
     - Types/Interfaces: naming convention
     - Constants: naming convention
     - CSS classes: convention used
     [IF database exists] Table/collection naming [END IF]
-->
```

### 8. `docs/CONVENTIONS.md`

```markdown
# Conventions & Patterns

## Code Style
<!-- Formatting tools used (Prettier, ESLint, Biome, etc.) and config.
     If none are configured, describe the implicit style:
     - Semicolons or not
     - Single vs double quotes
     - Indentation (tabs/spaces, width)
     - Import ordering -->

## Component Pattern
<!-- Show the ACTUAL pattern used in this codebase with a REAL example
     copied from a source file. Include:
     - How props are typed
     - How state is managed within components
     - How side effects are handled
     - How loading/error states are displayed
     - How components are exported (default vs named) -->

[IF backend API routes exist]
## API Route Pattern
<!-- Show the actual pattern with a real example -->
[END IF]

## Data Fetching / External API Pattern
<!-- How external data is fetched or APIs are called:
     - Direct fetch, SDK, SWR, React Query, server components, etc.
     - How loading states are handled
     - How errors are handled
     - How responses are processed
     Show actual code examples -->

## State Management Pattern
<!-- How global and local state is managed:
     - What mechanism (Context, Zustand, Redux, useState, etc.)
     - What state is global vs local
     - How state updates propagate
     - How state is persisted (if at all)
     Show actual code examples -->

## Error Handling Pattern
<!-- How errors are handled at each layer:
     - UI: try/catch, error boundaries, toast notifications, inline messages
     - External API calls: timeout, retry, fallback
     [IF backend exists] API routes: error format, status codes [END IF]
     [IF database exists] Database: constraint violations, connection errors [END IF]
     Show actual code examples -->

[IF auth exists]
## Authentication Pattern
<!-- How auth is implemented with actual code examples -->
[END IF]

[IF database exists]
## Database Access Pattern
<!-- How the database is queried with actual code examples -->
[END IF]

[IF AI/LLM integration exists]
## AI Integration Pattern
<!-- How AI APIs are called:
     - Client initialization
     - Prompt/system message construction
     - Message formatting
     - Streaming implementation (if any)
     - Error handling for AI calls
     - Any prompt caching or optimization
     Show actual code examples -->
[END IF]

[IF multi-panel/layout system exists]
## Layout & Panel System
<!-- How panels are structured:
     - Panel components and their strip/toggle mechanism
     - Resize handling (drag, min/max constraints)
     - Panel state management (open/closed, width)
     - Panel coordination (mutual exclusion, linked behavior)
     Show actual code examples -->
[END IF]

## Testing Pattern
<!-- If tests exist: framework, organization, mocking, how to run.
     If no tests: state "No tests currently implemented." -->

## Git Conventions
<!-- If discernible from config, hooks, or commit history:
     branch naming, commit message format, PR process, git hooks.
     If not discernible: omit this section. -->
```

### 9. `docs/ENVIRONMENT.md`

```markdown
# Environment & Configuration

## Required Environment Variables

<!-- Search the ENTIRE codebase for every environment variable reference
     (process.env, import.meta.env, VITE_, NEXT_PUBLIC_, etc.)
     and list each one: -->

| Variable | Required | Description | Example Format |
|----------|----------|-------------|----------------|
| ... | ... | ... | ... |

**IMPORTANT: Never include actual values. Only show the format/pattern.**

<!-- Also note:
     - Which variables are exposed to the client (VITE_, NEXT_PUBLIC_, etc.)
     - Which are server-only
     - Which are optional with defaults
     - Any variables that differ between environments -->

## Environment Files
<!-- Which .env files exist and their purpose -->

## Prerequisites
<!-- Software required to run the app:
     - Node.js (version from package.json engines or .nvmrc)
     - Package manager and version
     - Any CLI tools
     - Any system dependencies -->

## Local Development Setup
<!-- Step-by-step commands to get the app running locally.
     Base these on the ACTUAL scripts in package.json:
     1. Clone the repository
     2. Install dependencies
     3. Set up environment variables
     [IF database exists] 4. Run migrations / seed data [END IF]
     5. Start dev server
     6. Open the app URL
-->

## Available Scripts
<!-- Every script in package.json:
     | Script | Command | Description |
     |--------|---------|-------------|
     | ... | ... | ... |
-->

[IF deployment is configured]
## Build & Deploy
<!-- Build command, output directory, platform, post-deploy steps -->
[END IF]

## Third-Party Accounts Required
<!-- Every external account needed to run the full app:
     | Service | Purpose | Free Tier | Setup URL |
     |---------|---------|-----------|-----------|
     | ... | ... | ... | ... |
-->
```

### 10. `docs/HOOKS.md`

> Generate this document when the app has custom hooks with significant business logic (>50 lines each). These are hooks that orchestrate complex workflows, manage AI pipelines, handle persistence, or encapsulate multi-step processes — not trivial wrapper hooks.

```markdown
# Custom Hooks

## Overview
<!-- List all custom hooks with one-line purpose and file path.
     Distinguish between:
     - Orchestration hooks (manage multi-step pipelines or complex workflows)
     - Integration hooks (wrap external service calls)
     - State hooks (manage specific domain state)
     - Utility hooks (reusable helpers) -->

<!-- For EVERY custom hook with significant logic: -->

## Hook: `useHookName`

**File:** <!-- exact path -->
**Lines:** <!-- approximate line count -->
**Purpose:** <!-- what this hook encapsulates -->

### Interface
<!-- Parameters accepted (with types and defaults)
     Return value shape (with types)
     Show actual TypeScript signature from the code -->

### Internal State
<!-- All useState/useRef variables:
     | Variable | Type | Purpose |
     |----------|------|---------|
     | ... | ... | ... |
-->

### Key Functions
<!-- For each significant function exposed or used internally:
     - Name and purpose
     - What triggers it (user action, effect, callback)
     - What it does step-by-step
     - What state it modifies
     - What side effects it has (API calls, storage writes, etc.)
     - Error handling within the function -->

### External Dependencies
<!-- What APIs, services, contexts, or other hooks it calls.
     For each dependency:
     - What it's used for
     - How it's invoked (direct call, callback, effect) -->

### Lifecycle
<!-- useEffect triggers and their dependencies
     Cleanup functions
     Mount/unmount behavior
     Any timers, intervals, or debounced operations -->

### Error Handling
<!-- How errors are caught and surfaced:
     - Try/catch boundaries
     - Error state variables
     - Toast notifications or UI feedback
     - Retry logic (if any) -->
```

### 11. `docs/PROMPTS.md`

> Generate this document when the app has AI/LLM integration with dedicated prompt files, complex prompt construction helpers, or multiple prompt templates. Skip if prompts are simple inline strings.

```markdown
# Prompt Architecture

## Overview
<!-- How prompts are organized in the codebase:
     - Directory structure (e.g., utils/prompts/)
     - Separation of concerns (content vs. image vs. analysis prompts)
     - How prompts are composed (static templates, dynamic builders, cached blocks) -->

## Prompt Files

<!-- For EACH prompt file: -->

### `fileName.ts`

**Purpose:** <!-- what category of prompts this file contains -->

#### Prompt: [Function Name / Export Name]
- **Used by:** <!-- which hook, function, or component calls this prompt -->
- **Model target:** <!-- Claude, Gemini, GPT, etc. -->
- **Input variables:** <!-- what data is injected into the prompt (document content, style info, user instructions, etc.) -->
- **System message structure:** <!-- how the system prompt is composed: static blocks, dynamic blocks, cached vs. uncached -->
- **Output format:** <!-- expected response shape: free text, JSON, markdown, image, structured data -->
- **Token budget:** <!-- if applicable: max tokens, context window management -->
- **Caching:** <!-- whether this prompt uses prompt caching (e.g., ephemeral cache_control) and which parts are cached -->

---

## Prompt Construction Helpers
<!-- Document utility functions that build prompt components:
     - Style block builders (palette → prompt text)
     - Color/font descriptors
     - Narrative formatting helpers
     - Context extractors (document sections, heading hierarchies)
     For each helper: function name, file path, what it produces, who calls it -->

[IF visual style system exists]
## Style System Integration
<!-- How visual styles (e.g., Flat Design, Isometric, Neon, Blueprint) are encoded into prompts:
     - How palette colors are described in natural language
     - How font choices are conveyed
     - How visual identity descriptions are structured
     - How style anchoring / reference images are handled -->
[END IF]

[IF prompt caching is used]
## Prompt Caching Strategy
<!-- How prompt caching works:
     - Which blocks are marked as cacheable
     - Cache lifetime / invalidation rules
     - Which parts of the prompt are stable vs. dynamic
     - Token savings from caching -->
[END IF]

[IF multiple detail levels or prompt variants exist]
## Prompt Variants
<!-- How prompts differ by mode, level, or context:
     - Detail levels (e.g., Executive vs. Standard vs. Detailed)
     - Different prompt strategies per variant
     - How variant selection is determined -->
[END IF]
```

### 12. `docs/DECISIONS.md`

```markdown
# Architectural Decisions

<!-- For every significant architectural decision inferrable from the code: -->

## Decision: [Short Title]

**What:** <!-- What was decided -->

**Why:** <!-- Why this choice was made (infer from code context, comments, patterns) -->

**Alternatives considered:**
<!-- What other approaches could have been used -->

**Trade-offs:**
<!-- What was gained and what was sacrificed -->

---

<!-- Include decisions for at minimum:
     - Choice of framework and build tool
     - State management approach
     - Styling approach
     - Data persistence approach
     - File/folder organization approach
     [IF AI exists] Choice of AI provider(s) and model(s) [END IF]
     [IF database exists] Choice of database [END IF]
     [IF auth exists] Authentication approach [END IF]
     - Any unusual or non-standard patterns found in the code
     - Any workarounds or technical debt visible in the code
-->

## Known Technical Debt

<!-- List anything in the code that appears to be:
     - A temporary workaround
     - An incomplete implementation
     - A pattern that doesn't match the rest of the codebase
     - A TODO or FIXME comment
     - A hardcoded value that should be configurable
     - A missing error handler or validation
     Include the file path and line number where possible -->

## Known Limitations

<!-- List any limitations visible in the code:
     - Feature constraints (max file size, max items, etc.)
     - Performance bottlenecks
     - Missing features that are partially scaffolded
     - Browser compatibility issues
     - Mobile responsiveness gaps -->
```

---

## Global Documentation Rules

Apply these rules across ALL generated documents:

1. **State facts only** — Describe what exists in the code. Do not include instructions, tutorials, or how-to guides.

2. **Be exhaustive** — Document every model, every component, every file, every significant function, every pattern. If it exists in the code, it must be in the documentation.

3. **Use actual code** — When showing patterns or examples, copy real code from the codebase. Do not write generic placeholder examples.

4. **Be specific** — Use exact file paths, exact function names, exact type names, exact variable names as they appear in the source.

5. **No instructions** — Do not write "you should," "you can," "to do X, run Y." The documentation describes what IS, not what to DO. (Exception: ENVIRONMENT.md setup steps, which are inherently instructional.)

6. **Consistent naming** — If a type is called `Nugget` in DATA_MODELS.md, it must be `Nugget` everywhere — not `nugget`, `NuggetType`, or `nuggets`.

7. **Cross-reference** — When a document references something detailed in another document, point to it. Example: "See DATA_MODELS.md for the full Nugget interface."

8. **Include the non-obvious** — Document implicit behavior: default values, auto-generated fields, cascade deletes, side effects, conditional rendering logic, state-driven view switching.

9. **Preserve manual edits** — If documentation files already exist, read them first. Keep any sections marked with `<!-- MANUAL -->` unchanged. Update only sections where the code has changed.

10. **Completeness check** — After generating all documents, verify that every source file in the codebase is referenced in at least one document. If any file is missing, add it.

11. **Omit, don't stub** — If a conditional section (`[IF ...]`) does not apply, omit it entirely. Do not leave empty headings, "N/A" sections, or placeholder text. A shorter, accurate document is better than a longer one padded with irrelevant sections.
