# Phase 2 — Type Safety Audit

**Project**: InfoNugget v6.0
**Date**: 2026-02-24
**Auditor**: Claude Code (Opus 4.6)
**Mode**: READ-ONLY (no source files modified)

---

## Project Type Setup

- **Language**: TypeScript 5.8.3
- **Files**: 69 `.ts/.tsx` files, 27,434 lines
- **Current strictness level**: **NONE** — Zero strict flags are enabled

### Strict Flag Status

| Flag | Status | What It Catches |
|------|--------|-----------------|
| `strict` (master switch) | **OFF** | Enables all below |
| `noImplicitAny` | **OFF** | Variables/params without types default to `any` |
| `strictNullChecks` | **OFF** | `null`/`undefined` not checked in types |
| `strictFunctionTypes` | **OFF** | Function parameter types not checked contravariantly |
| `strictBindCallApply` | **OFF** | `bind`/`call`/`apply` not type-checked |
| `strictPropertyInitialization` | **OFF** | Class properties can be uninitialized |
| `noImplicitThis` | **OFF** | `this` can be `any` |
| `alwaysStrict` | **OFF** | Files may not emit `"use strict"` |
| `noUncheckedIndexedAccess` | **OFF** | `arr[i]` returns `T` not `T \| undefined` |
| `noImplicitReturns` | **OFF** | Functions can have missing return paths |
| `noFallthroughCasesInSwitch` | **OFF** | Switch cases can fall through |
| `noUnusedLocals` | **OFF** | Dead variables not flagged |
| `noUnusedParameters` | **OFF** | Dead parameters not flagged |
| `exactOptionalPropertyTypes` | **OFF** | `undefined` treated same as "not present" |
| `noPropertyAccessFromIndexSignature` | **OFF** | Index signatures accessible via dot notation |

**Impact**: With no strict flags, TypeScript acts primarily as a syntax checker. The type system cannot catch null dereferences, implicit `any` propagation, or type mismatches — the three most common sources of runtime errors in TypeScript projects.

---

## Strict Mode Scan Results

A temporary `tsconfig.audit.json` was created with **all 15 strict flags enabled**, the scan was run, and the config was deleted.

**Total strict-mode errors**: **411**
**Files affected**: **52 / 69** (75.4%)

### Error Distribution by Code

| Error Code | Count | Strict Flag | Category | Severity |
|------------|-------|-------------|----------|----------|
| TS2532 | 100 | `strictNullChecks` | Object possibly undefined | RISKY |
| TS18048 | 90 | `strictNullChecks` | Variable possibly undefined | RISKY |
| TS6133 | 75 | `noUnusedLocals/Params` | Unused declarations | WEAK |
| TS2375 | 31 | `exactOptionalPropertyTypes` | Optional property mismatch | WEAK |
| TS2345 | 22 | `strictNullChecks` | Argument type mismatch | RISKY |
| TS2322 | 21 | `strictNullChecks` | Assignment type mismatch | RISKY |
| TS2379 | 19 | `exactOptionalPropertyTypes` | Function arg mismatch | WEAK |
| TS4111 | 18 | `noPropertyAccessFromIndexSignature` | Index signature dot access | WEAK |
| TS7016 | 15 | `noImplicitAny` | Missing declaration files | WEAK |
| TS2339 | 8 | `strict` (union narrowing) | Property doesn't exist on type | **BUGS** |
| TS7030 | 5 | `noImplicitReturns` | Not all paths return value | RISKY |
| TS7053 | 2 | `noImplicitAny` | Implicit `any` from indexing | RISKY |
| TS2412 | 2 | `exactOptionalPropertyTypes` | Undefined in non-optional slot | WEAK |
| TS6196 | 1 | `noUnusedLocals` | Unused type alias | WEAK |
| TS2769 | 1 | `exactOptionalPropertyTypes` | No overload matches | RISKY |
| TS2367 | 1 | `strict` | Impossible comparison | **BUGS** |

### Severity Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **BUGS** (will cause runtime errors) | **9** | Union type access without narrowing, dead-code comparisons |
| **RISKY** (could cause runtime errors) | **220** | Null dereferences, type mismatches, missing returns |
| **WEAK** (type safety improvements, no runtime impact) | **182** | Unused code, optional property semantics, missing `@types` |

---

## Type Safety Issues Found

### BUGS — Will Cause Runtime Errors (9 issues)

#### 1. Union type property access without narrowing — `CanvasRenderer.ts` (8 errors)

| Line | Property | Error |
|------|----------|-------|
| 49, 50, 52–55 | `.position` | TS2339: `position` doesn't exist on all `Annotation` variants |
| 61, 63, 65, 67–69, 71, 73 | `.topLeft`, `.bottomRight`, `.start`, `.end`, `.points` | TS2339: variant-specific properties |

**What happens**: The canvas render function accesses annotation properties (`position`, `topLeft`, `start`, etc.) without first checking `annotation.type`. If the annotation array contains a mix of types (pin, rectangle, arrow, sketch), accessing a property that doesn't exist on that variant returns `undefined`, which then gets passed to canvas drawing math, producing `NaN` coordinates or thrown TypeErrors.

**Verdict**: These need type guards (`if (a.type === 'pin')`) before accessing variant-specific properties.

#### 2. Impossible comparison — `NuggetCreationModal.tsx` (1 error)

| Line | Code | Error |
|------|------|-------|
| (comparison line) | `sourceType === 'cancel'` | TS2367: `'cancel'` has no overlap with `'markdown' \| 'native-pdf'` |

**What happens**: This comparison can never be `true`. Either this is dead code, or the `sourceType` was supposed to be a broader union type. The branch after this check never executes.

---

### RISKY — Could Cause Runtime Errors (220 issues)

#### Null Dereference Risks (TS2532 + TS18048 = 190 errors)

**Top 15 files by null-risk errors**:

| File | Count | Primary Pattern | Real Risk? |
|------|-------|-----------------|------------|
| `utils/pdfBookmarks.ts` | 28 | Array index access in bookmark tree traversal | **YES** — malformed PDF trees crash |
| `components/SourcesPanel.tsx` | 24 | Heading promote/demote/delete by index | **YES** — stale index crashes |
| `components/DocumentEditorModal.tsx` | 22 | Heading array manipulation | **YES** — index-based operations |
| `components/workbench/CanvasRenderer.ts` | 15 | Annotation lookup by ID → `.find()` result | **YES** — deleted annotation crashes |
| `components/StyleStudioModal.tsx` | 14 | Style `.find()` in sort comparator | Mostly safe — sort context |
| `hooks/useAutoDeck.ts` | 13 | `response.content[0]` from Claude API | **YES** — empty API response crashes |
| `utils/prompts/contentGeneration.ts` | 10 | Heading lookup by ID | **YES** — stale heading references |
| `hooks/useDocumentFindReplace.ts` | 9 | DOM element queries + mark array access | **YES** — DOM can change |
| `hooks/useDocumentEditing.ts` | 7 | Heading `.find()` results | **YES** — stale data |
| `App.tsx` | 7 | Card/nugget `.find()` + array splice | **YES** for splice pattern |
| `hooks/useCardGeneration.ts` | 6 | `candidates[0].content.parts` from Gemini | **YES** — empty response |
| `utils/subjectGeneration.ts` | 5 | Heading array access | Mostly safe |
| `hooks/useInsightsLab.ts` | 4 | `response.content[0]` from Claude API | **YES** — empty response |
| `components/PdfViewer.tsx` | 4 | PDF page ref access | **YES** — async timing |
| `utils/tokenEstimation.ts` | 3 | Message array access | Moderate risk |

**Assessment**: ~140 of 190 null-risk errors represent real potential crashes. The remaining ~50 are overly cautious (guarded by prior checks, loop bounds, or guaranteed-present data).

**Most dangerous patterns**:

1. **AI API response access** (23 errors across 4 hooks): `response.content[0]` and `candidates[0].content.parts` — 4-level deep property chains with no null guards. A single empty or blocked API response crashes the pipeline.

2. **Bookmark tree manipulation** (28 errors in `pdfBookmarks.ts`): Recursive array splice/promote/demote operations without bounds checking. A malformed PDF bookmark tree would trigger cascading undefined access.

3. **Heading array manipulation** (56 errors across SourcesPanel, DocumentEditorModal, contentGeneration): Index-based heading operations where the index may be stale or out-of-bounds.

#### Argument/Assignment Type Mismatches (TS2345 + TS2322 = 43 errors)

**High-risk mismatches**:

| File | Line | Issue | Risk |
|------|------|-------|------|
| `App.tsx` | 683 | `Card \| undefined` from splice, inserted back into array | State corruption if index OOB |
| `hooks/useCardGeneration.ts` | 110 | `.find()` result passed as `Card` to function | Crash if card deleted mid-generation |
| `components/StorageProvider.tsx` | 219 | `content: string \| undefined` in loaded files | Downstream `.length` on undefined |
| `App.tsx` | 2189 | `string \| null` passed where `string` required | `null` propagation |
| `utils/modificationEngine.ts` | 212 | `string \| undefined` assigned to `string` | Undefined propagation |

**Low-risk mismatches (52 errors)**: The TS2375/TS2379/TS2412 errors (52 total) are all `exactOptionalPropertyTypes` strictness — distinguishing `undefined` from "absent". These have zero runtime impact in JavaScript.

#### Missing Return Paths (TS7030 = 5 errors)

All 5 are the same pattern — `useEffect` conditionally returning cleanup functions:

| File | Line | Pattern |
|------|------|---------|
| `components/AutoDeckPanel.tsx` | 59 | `useEffect` returns cleanup only in `else if` branch |
| `components/ChatPanel.tsx` | 47 | Same pattern |
| `components/ProjectsPanel.tsx` | 195 | Same pattern |
| `components/SourcesPanel.tsx` | 57 | Same pattern |
| `components/ToastNotification.tsx` | 43 | Returns cleanup only when `dur > 0` |

React handles these safely (accepts `void` from `useEffect`), but inconsistent cleanup is a maintenance smell.

---

### WEAK — Type Safety Improvements, No Runtime Impact (182 issues)

| Category | Count | Notes |
|----------|-------|-------|
| Unused locals/parameters (TS6133) | 75 | Dead code cleanup — matches ESLint Phase 1 findings |
| Optional property semantics (TS2375/2379/2412) | 52 | `exactOptionalPropertyTypes` pedantry |
| Index signature dot access (TS4111) | 18 | Bracket notation preferred for `process.env` etc. |
| Missing `@types/react-dom` (TS7016) | 15 | Single `npm i -D @types/react-dom` fixes all 15 |
| Unused type alias (TS6196) | 1 | Dead type cleanup |

---

## API Boundary Issues

Places where external data enters the application without validation.

### HIGH Risk

| # | File | Line | Issue |
|---|------|------|-------|
| 1 | `hooks/useCardGeneration.ts` | 337 | **Gemini response `candidates[0].content.parts`** — 4-level deep access with no null guards. Empty `candidates` array (e.g., safety filter) crashes with `TypeError: Cannot read properties of undefined`. |
| 2 | `components/CardsPanel.tsx` | 283 | **Fabricated `UploadedFile` object** — partial object `{ id, name, content }` cast `as UploadedFile`, missing `size`, `type`, `status`, `progress`, and other required fields. Downstream access to these fields gets `undefined`. |
| 3 | `App.tsx` | 60 | **Double `as unknown as` cast** for token usage data from IndexedDB — completely bypasses type checking. Corrupt storage data flows through as wrong types. |

### MEDIUM Risk

| # | File | Line | Issue |
|---|------|------|-------|
| 4 | `utils/ai.ts` | 423 | `res.json() as ClaudeResponse` — no runtime validation. `.content` assumed to be array. |
| 5 | `utils/ai.ts` | 487 | `res.json() as FilesAPIResponse` — `data.id` could be undefined if shape changes. |
| 6 | `utils/ai.ts` | 557 | `JSON.parse(cleaned)` of AI-generated JSON **not wrapped in try/catch**. Malformed AI output → unhandled SyntaxError. |
| 7 | `components/StorageProvider.tsx` | 302 | Token usage from IndexedDB cast to `Record<string, number>` without validation. Corrupt data → `NaN` in all cost calculations. |
| 8 | `components/StorageProvider.tsx` | 303 | Custom styles from IndexedDB cast to `CustomStyle[]` without validation. Schema changes → crashes in style registration. |
| 9 | `components/AssetsPanel.tsx` | 309, 332 | Fabricated `React.ChangeEvent` with only `target.value` — fragile if handler accesses other event properties. |
| 10 | `hooks/useTokenUsage.ts` | 107, 146 | Double `as unknown as` cast to save token data — type mismatch between storage API and actual data type. |

### LOW Risk (properly handled)

| # | File | Line | Issue |
|---|------|------|-------|
| 11 | `utils/fileProcessing.ts` | 221 | `JSON.parse` of Gemini heading output — wrapped in try/catch, returns `[]` on failure. |
| 12 | `utils/autoDeck/parsers.ts` | 37, 166 | `JSON.parse` of AI planner/producer output — wrapped in try/catch with defensive coercion. |
| 13 | `context/AppContext.tsx` | 136 | `localStorage.getItem` — null-checked before use. |
| 14 | `utils/storage/IndexedDBBackend.ts` | 147 | `blobStorageToImage(stored: any)` — uses `any` but has `instanceof Blob` guards. |

---

## Components Without Type Safety

**All 29 component files have properly typed props interfaces.** No components use `any` for props or lack type annotations.

**One callback uses `any[]`**:
- `App.tsx:764` — `handleInsightsImageModified` accepts `history: any[]` instead of `ImageVersion[]`

---

## Type Assertion Audit (`as SomeType`)

### Dangerous Assertions (bypass type system)

| File | Line | Pattern | Risk |
|------|------|---------|------|
| `App.tsx` | 60 | `as unknown as TokenUsageTotals` | HIGH — double cast |
| `useTokenUsage.ts` | 107, 146 | `as unknown as Record<string, unknown>` | MEDIUM — double cast |
| `StorageProvider.tsx` | 160 | `.find(...) as any` | LOW — migration code with `?.` guards |
| `StorageProvider.tsx` | 262 | `(nugget as any).type = 'insights'` | LOW — migration mutation |
| `CardsPanel.tsx` | 283 | `{...} as UploadedFile` | HIGH — partial object |

### Safe Assertions (standard patterns)

| Pattern | Count | Risk |
|---------|-------|------|
| `.filter(Boolean) as T[]` | ~8 | NONE — standard TS narrowing workaround |
| `e.target as Node/HTMLElement` in click-outside handlers | ~30 | NONE — matches runtime types |
| `as DetailLevel` for string literals | ~20 | LOW — known enum values |
| `catch (err: any)` with `err.message \|\| fallback` | ~15 | LOW — fallback handles non-Error throws |

---

## Overall Assessment

### Severity Distribution

| Severity | Count | Description |
|----------|-------|-------------|
| **BUGS** | 9 | Union type access without narrowing (8), impossible comparison (1) |
| **HIGH RISK** | 3 | Unguarded API responses, fabricated objects, double casts |
| **MEDIUM RISK** | 7 | API response casts, unguarded JSON.parse, IndexedDB data validation |
| **RISKY (strict null)** | ~140 | Real null-dereference risks from `.find()`, array index, API responses |
| **LOW RISK** | ~60 | Overly cautious strict checks, migration code |
| **WEAK** | 182 | Unused code, optional property semantics, missing `@types` |

### Top 5 Priorities

1. **Enable `strictNullChecks`** — This single flag would surface 190 null-risk issues. It is the highest-leverage change possible. The 140+ real null risks currently compile silently.

2. **Guard AI API response access** — The `response.content[0]` and `candidates[0].content.parts` patterns appear in 4 hooks (23 errors). A single empty API response crashes the entire card generation or chat pipeline. Add null checks: `response.content?.[0]` with fallback.

3. **Fix `CanvasRenderer.ts` union narrowing** — 8 errors accessing variant-specific properties without type guards. Add `if (a.type === 'pin')` etc. before accessing `.position`, `.topLeft`, etc.

4. **Add `@types/react-dom`** — Eliminates 15 implicit `any` errors with a single `npm i -D @types/react-dom`.

5. **Validate IndexedDB data on load** — The storage hydration path casts raw IndexedDB data to typed interfaces without validation. A single corrupt record (from schema migration, browser bug, or manual tampering) propagates bad types through the entire application state.

### Recommended Strict Flag Adoption Path

| Phase | Flags | Estimated Errors | Effort |
|-------|-------|-----------------|--------|
| **1** | `noUnusedLocals` + `noUnusedParameters` | ~75 | Low — mechanical cleanup |
| **2** | `strictNullChecks` | ~190 | High — most impactful, most work |
| **3** | `noImplicitReturns` + `noFallthroughCasesInSwitch` | ~5 | Low — trivial fixes |
| **4** | `noImplicitAny` | ~17 | Medium — add `@types/react-dom` + fix indexing |
| **5** | `strict` (full) + remaining flags | ~124 | Medium — mostly optional property semantics |
