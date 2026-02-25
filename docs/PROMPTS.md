# InfoNugget v6.0 — Prompt Architecture

---

## Overview

All prompt logic is isolated in `utils/prompts/`. No component or hook constructs raw prompt strings directly; they call builder functions from this directory.

### Directory Structure

```
utils/prompts/
  contentGeneration.ts     — Phase 1 (synthesis) and Phase 2 (planner) for standard cards
  imageGeneration.ts       — Phase 3 (visualizer) for standard cards + modification prompts
  insightsLab.ts           — Chat system prompt + card content mode instruction
  promptUtils.ts           — Shared construction helpers (anti-leakage transforms, style block, assembler)
  autoDeckPlanner.ts       — Auto-Deck Planner prompt + Finalizer prompt
  autoDeckProducer.ts      — Auto-Deck Producer prompt + batchPlan utility
  coverGeneration.ts       — Cover card prompts (TitleCard, TakeawayCard) — all 4 phases
  documentConversion.ts    — Gemini Flash PDF conversion + heading extraction prompts
  pwcGeneration.ts         — PwC Corporate style — dedicated Planner and Visualizer (JSON hybrid)
```

### Separation of Concerns

- `contentGeneration.ts`, `coverGeneration.ts`, `pwcGeneration.ts` produce the prompts used in the 3-phase card pipeline.
- `imageGeneration.ts` produces prompts for the image model (Phase 3 for standard styles) and modification prompts.
- `promptUtils.ts` provides the functions that `imageGeneration.ts`, `coverGeneration.ts`, and `pwcGeneration.ts` all call to compose the final image-model prompt. It also provides `buildExpertPriming`, used by all synthesis and chat prompts.
- `insightsLab.ts` is exclusively for the chat pipeline.
- `autoDeckPlanner.ts` and `autoDeckProducer.ts` serve the Auto-Deck pipeline only.
- `documentConversion.ts` contains the two static string constants used when ingesting PDF files.

### How Prompts Are Composed

For the 3-phase pipeline:
1. **Phase 1** (synthesis): `buildContentPrompt` or `buildCoverContentPrompt` → returned as a string → passed to `callClaude`.
2. **Phase 2** (planner): `buildPlannerPrompt` or `buildCoverPlannerPrompt` (prose output), OR `buildPwcPlannerPrompt` (JSON output) → passed to `callClaude`.
3. **Phase 3** (visualizer): builder functions call `assembleRendererPrompt` from `promptUtils.ts`, which:
   - Calls `buildNarrativeStyleBlock(settings)` for the style/palette/typography block.
   - Calls `sanitizePlannerOutput(plannerOutput)` on Phase 2's result.
   - Calls `transformContentToTags(synthesisContent, cardTitle)` to convert markdown to bracketed tags.
   - Assembles in order: role → style → [reference note] → layout → content.

For Auto-Deck:
1. `buildPlannerPrompt()` returns `{ systemBlocks, messages }` for the Planner agent.
2. `buildFinalizerPrompt()` returns `{ systemBlocks, messages }` for the optional Finalizer agent.
3. `buildProducerPrompt()` returns `{ systemBlocks, messages }` for the Producer agent.

---

## Prompt Files

### `contentGeneration.ts`

**Purpose:** Synthesis and layout planning for standard content cards (non-cover, non-PwC).

---

#### Prompt: `buildContentPrompt`

- **Used by:** `useCardGeneration.ts` → `performSynthesis()` for all non-cover `DetailLevel` values.
- **Model target:** Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- **Input variables:**
  - `cardTitle: string` — heading text for the card being synthesized
  - `level: DetailLevel` — determines word count and formatting rules; throws if called with a cover level
  - `fullDocument: string` — full concatenated inline document content
  - `sectionText: string` — extracted section content for this heading
  - `excludeDocument: boolean = false` — if true, omits `fullDocument` from the prompt (used when docs are in system blocks)
  - `subject?: string` — nugget subject for expert priming (via `buildExpertPriming`)
- **System message structure:** Provided separately via `systemBlocks` in `callClaude`. This function produces only the user-message content.
- **Output format:** Markdown. Leading `# Title` heading is stripped by `performSynthesis` and replaced with `# cardTitle`.
- **Token budget:**
  - Executive: 300 output tokens
  - Standard: 600 output tokens
  - Detailed: 1200 output tokens
- **Word count constraints in prompt:**
  - Executive: 70–100 words (hard limit)
  - Standard: 200–250 words (hard limit)
  - Detailed: 450–500 words (hard limit)
- **Anti-leakage transforms:** None applied at this stage. The output is markdown and is transformed later by `transformContentToTags` before reaching the image model.
- **Level-specific behaviour:**
  - Executive: single most important insight only; max one `##` heading; no tables/blockquotes/`###`.
  - Standard: key points with moderate detail; full markdown range; tables only for 3+ item comparisons.
  - Detailed: comprehensive; full markdown range including tables, blockquotes, `###`.
- **Expert priming:** If `subject` is provided, `buildExpertPriming(subject)` prepends a domain-expert sentence to the prompt.

---

#### Prompt: `buildPlannerPrompt`

- **Used by:** `useCardGeneration.ts` → `generateCard()` for all styles except PwC Corporate.
- **Model target:** Claude Sonnet 4.6 (`claude-sonnet-4-6`) (called via `callClaude` with `maxTokens: 4096`)
- **Input variables:**
  - `cardTitle: string` — heading text
  - `synthesisContent: string` — the output from Phase 1 (synthesis)
  - `aspectRatio: string = '16:9'` — drives canvas description text in the brief
  - `previousPlan?: string` — if set, a diversity clause is inserted instructing the model to propose a fundamentally different visualization approach
  - `subject?: string` — domain context injected as a `DOMAIN CONTEXT` section
- **System message structure:** None (this prompt is sent as a single user message without system blocks).
- **Output format:** Narrative prose (~150–250 words), covering: data relationships, visual concept, content groupings, focal hierarchy. No markdown headers, no bullets (these would leak into the image model), no positions, no font/color/size specifications.
- **Token budget:** 4096 output tokens max.
- **Caching:** Not cached (called without system blocks).
- **Rules enforced in prompt:** No exact positions, no container types, no colors/fonts/pt sizes/pixels, must reference all content items, no paraphrasing of content.

---

#### Prompt: `buildNativePdfSectionHint`

- **Used by:** `useCardGeneration.ts` → `performSynthesis()` when no inline markdown section text exists (native PDF mode).
- **Model target:** Claude Sonnet 4.6 (appended to the synthesis prompt text)
- **Input variables:**
  - `cardTitle: string` — heading text to locate in the document structure
  - `enabledDocs: UploadedFile[]` — all enabled documents, searched for one whose `structure` contains `cardTitle`
- **Output format:** A prompt string fragment (or `''` if no match). Appended to the content synthesis prompt.
- **Content produced:** Describes the section's sub-heading TOC, page start and end boundaries, and references the MetaTOC file if `metaTocFileId` is present.

---

### `imageGeneration.ts`

**Purpose:** Image generation prompts for Phase 3 (standard styles) and modification prompts.

---

#### Prompt: `buildVisualizerPrompt`

- **Used by:** `useCardGeneration.ts` → `generateCard()` for all non-PwC, non-cover card types.
- **Model target:** `gemini-3-pro-image-preview`
- **Input variables:**
  - `cardTitle: string`
  - `contentToMap: string` — synthesis markdown (Phase 1 output)
  - `settings: StylingOptions` — style, palette, fonts, aspectRatio
  - `visualPlan?: string` — planner output (Phase 2 output); if absent, a default layout instruction is used
  - `useReference?: boolean` — if true, adds a reference image instruction paragraph
  - `subject?: string` — domain clause injected via `assembleRendererPrompt`
- **System message structure:** None. Assembled as a single multi-paragraph text prompt.
- **Output format:** Base64-encoded PNG image (via `inlineData` in Gemini response).
- **Prompt construction:** Delegates entirely to `assembleRendererPrompt(cardTitle, contentToMap, settings, visualPlan, referenceNote, subject)`.
- **Anti-leakage transforms applied:** `transformContentToTags` (markdown→tags), `sanitizePlannerOutput` (strips font names, sizes, hex colors from planner output), `hexToColorName` (hex→name), `fontToDescriptor` (font name→descriptor).
- **Prompt order:** role → style block → [reference note] → layout block → content block.

---

#### Prompt: `buildModificationPrompt`

- **Used by:** `utils/modificationEngine.ts` → `executeModification()`.
- **Model target:** `gemini-3-pro-image-preview`
- **Input variables:**
  - `instructions: string` — textual annotation instructions from user-drawn annotations
  - `cardTitle: string | null` — appended to the title suffix
  - `hasRedline: boolean = true` — if true, includes redline map instructions; if false, global-instruction-only mode
- **Output format:** PNG image (Gemini response).
- **System message structure:** Single narrative prose prompt. No markdown, no XML.
- **Two variants:**
  - `hasRedline: true`: instructs the model that both an original image and a redline overlay map are provided; modifications are localized to annotated areas.
  - `hasRedline: false`: global modification mode with no redline map.

---

#### Prompt: `buildContentModificationPrompt`

- **Used by:** `utils/modificationEngine.ts` → `executeContentModification()`.
- **Model target:** `gemini-3-pro-image-preview`
- **Input variables:**
  - `content: string` — updated synthesis content (markdown)
  - `cardTitle: string | null`
  - `style?: string` — visual style name for override clause
  - `palette?: { background, primary, secondary, accent, text }` — hex color palette
- **Output format:** PNG image (Gemini response).
- **Prompt structure (narrative):**
  1. Opening: role + reference image instruction.
  2. Palette block: built using `hexToColorName` for each color; includes style-conflict override clause if `style` provided.
  3. Style block: only if `style` provided and no palette; single aesthetic sentence.
  4. Typography block: descriptive hierarchy (no font names, no sizes).
  5. Render instruction: content completeness requirement.
  6. Content block: `transformContentToTags(content, cardTitle)`.
- **Anti-leakage:** `hexToColorName` converts all hex values to descriptive names. `transformContentToTags` converts markdown to bracketed tags.

---

### `insightsLab.ts`

**Purpose:** Chat system prompt and card content mode instruction for the Insights Lab chat pipeline.

---

#### Prompt: `buildInsightsSystemPrompt`

- **Used by:** `useInsightsLab.ts` → `sendMessage()` as system block 0 (uncached).
- **Model target:** Claude Sonnet 4.6
- **Input variables:**
  - `subject?: string` — if provided, `buildExpertPriming(subject)` is prepended to the role statement
- **Output format:** Markdown (free-form chat response).
- **System message structure:** Contains: role statement (with expert priming if subject set), role description, conversation style rules, document context rules, card suggestion block format.
- **Caching:** This block is marked `cache: false` in `systemBlocks`.
- **Card suggestions:** Instructs Claude to append a ` ```card-suggestions ``` ` fenced block at the end of every regular (non-card) response, containing 2–4 actionable card generation prompts.

---

#### Prompt: `buildCardContentInstruction`

- **Used by:** `useInsightsLab.ts` → `sendMessage()` as system block 2 when `isCardRequest: true` and level is not a cover type.
- **Model target:** Claude Sonnet 4.6
- **Input variables:**
  - `detailLevel: DetailLevel` — throws if called with a cover level
- **Output format:** Markdown, starting with a `# Title` heading (mandatory).
- **System message structure:** Injected as an additional system block marked `cache: false`; overrides normal conversation behavior.
- **Token budget:**
  - Executive: 300; Standard: 600; Detailed: 1200 (set in `sendMessage`)
- **Word count constraints in prompt:**
  - Executive: 70–100 words; Standard: 200–250 words; Detailed: 450–500 words

---

### `promptUtils.ts`

**Purpose:** Shared construction helpers for all image-model prompts. All output is narrative prose with no markdown, XML, or key-value pairs to prevent leakage.

---

#### Function: `buildExpertPriming`

- **Used by:** Every synthesis prompt builder and `buildInsightsSystemPrompt`.
- **Input:** `subject?: string`
- **Output:** Empty string if `subject` is falsy. Otherwise: `"You are a domain expert on the following subject: ${subject}. Use accurate terminology and professional judgment to organize and present the source material. Do NOT add facts, claims, data, or context from your own knowledge — work exclusively with what the source documents provide."`

---

#### Function: `transformContentToTags`

- **Used by:** `assembleRendererPrompt`, `buildContentModificationPrompt`, `buildPwcVisualizerPrompt`.
- **Input:** `synthesisContent: string`, `cardTitle: string`
- **Output:** A delimited block:
  ```
  [BEGIN TEXT CONTENT]
  [TITLE] cardTitle

  [SECTION] heading text      ← from ## markdown headings
  [SUBSECTION] text           ← from ### markdown headings
  [DETAIL] text               ← from #### markdown headings
  body text with bold/italic stripped
  [END TEXT CONTENT]
  ```
- **Transforms applied:**
  - `---` horizontal rules removed.
  - `####` → `[DETAIL]`, `###` → `[SUBSECTION]`, `##` → `[SECTION]`, `#` → stripped entirely.
  - `**...**` and `*...*` bold/italic markers stripped.
  - Leading `- ` or `* ` list markers stripped (text preserved).
  - 3+ blank lines collapsed to 1.

---

#### Function: `sanitizePlannerOutput`

- **Used by:** `assembleRendererPrompt`, `buildCoverVisualizerPrompt`.
- **Input:** `plannerText: string` — raw prose output from the planner.
- **Output:** Sanitized prose with all markdown formatting and toxic payload patterns removed.
- **Transforms applied:**
  - All markdown removed: `#` heading markers, `**bold**`, `*italic*`, `---` rules, numbered list prefixes, bullet dashes.
  - Font specification lines removed (regex matches `FontName Bold, 42pt,...` patterns).
  - Standalone point sizes removed (e.g., `36pt`, `22-28pt`).
  - Hex color codes removed (`#RRGGBB`, `#RGB`).
  - Known font names removed (from a list of ~35 fonts including all fonts in `STYLE_FONTS`).
  - Font weight + size combos removed.
  - Pixel values removed.
  - Orphaned punctuation (commas, colons, dashes) cleaned up.

---

#### Function: `hexToColorName`

- **Used by:** `buildNarrativeStyleBlock`, `buildPwcDesignSpec`, `buildContentModificationPrompt`.
- **Input:** `hex: string` — a hex color string (with or without `#` prefix).
- **Output:** A human-readable color name string (e.g., `'deep navy'`, `'burnt orange'`).
- **Lookup table:** ~120 hardcoded entries covering whites, grays, blues, reds, greens, oranges, yellows, purples, teals, pinks.
- **Fallback:** Parses RGB values; determines hue (red-orange, green, blue, purple, yellow, orange, gray, neutral) and lightness (light/dark/medium/empty prefix); returns `"${lightness}${hue}"`.

---

#### Function: `fontToDescriptor`

- **Used by:** `buildNarrativeStyleBlock`, `buildPwcDesignSpec`, `buildPwcCoverVisualizerPrompt`.
- **Input:** `fontName: string`
- **Output:** A visual descriptor string (e.g., `'clean, geometric sans-serif'`, `'elegant, high-contrast serif'`).
- **Lookup table:** ~40 exact font name mappings.
- **Fallbacks (in order):**
  - Partial match on known font names.
  - Pattern matching: `serif` (not `sans`) → `'professional serif'`; `sans` → `'clean sans-serif'`; `mono`/`code` → `'clean monospace'`; `slab` → `'bold, slab-serif'`; `display`/`headline` → `'expressive display typeface'`.
  - Default: `'clean, professional typeface'`.

---

#### Function: `buildNarrativeStyleBlock`

- **Used by:** `assembleRendererPrompt`, `buildCoverVisualizerPrompt`.
- **Input:** `settings: StylingOptions`
- **Output:** Three-paragraph narrative prose string: style paragraph + palette paragraph + typography paragraph.
- **Style paragraph:** Uses `STYLE_IDENTITIES[settings.style]` from `utils/ai.ts` for the style's prose descriptor. If the style is unknown, generates a generic aesthetic instruction.
- **Palette paragraph:** Converts all 5 hex colors via `hexToColorName`; includes their hex values in parentheses. Calls `detectPaletteStyleConflict(settings.style, settings.palette)`:
  - Compares `hexToColorName` of primary/secondary/accent against `STYLE_COLOR_FAMILIES[normalizedStyle]`.
  - If conflict detected: appends `"Use this custom palette instead of the typical ${style} colors."` override clause.
- **Typography paragraph:** Converts both fonts via `fontToDescriptor`. If both fonts describe the same family, uses a single-font sentence; otherwise uses a paired primary/secondary sentence.

---

#### Function: `assembleRendererPrompt`

- **Used by:** `buildVisualizerPrompt`.
- **Input:**
  - `cardTitle: string`
  - `synthesisContent: string`
  - `settings: StylingOptions`
  - `plannerOutput?: string`
  - `referenceNote?: string`
  - `subject?: string`
- **Output:** Complete image-model prompt as narrative prose.
- **Assembly order:**
  1. **Role**: `"You are an expert Information Designer. Create a visually striking infographic."` + optional domain clause from `subject`.
  2. **Style block**: `buildNarrativeStyleBlock(settings)`.
  3. **[Reference note]**: inserted between style and layout if `referenceNote` is provided.
  4. **Layout block**: If `plannerOutput` provided: `sanitizePlannerOutput(plannerOutput)` wrapped with style-enforcement framing and content-completeness requirement. If no planner output: a default spatial freedom instruction with content-completeness requirement.
  5. **Content block**: `transformContentToTags(synthesisContent, cardTitle)`.

---

### `autoDeckPlanner.ts`

**Purpose:** Planner and Finalizer prompts for the Auto-Deck pipeline.

---

#### Prompt: `buildPlannerPrompt`

- **Used by:** `useAutoDeck.ts` → `startPlanning()` and `revisePlan()`.
- **Model target:** Claude Sonnet 4.6
- **Input variables** (via `PlannerPromptParams`):
  - `briefing: AutoDeckBriefing` — audience, type, objective, tone, focus, minCards, maxCards, deck structure options
  - `lod: AutoDeckLod` — `'executive'` | `'standard'` | `'detailed'`
  - `subject?: string` — expert priming
  - `documents: { id, name, wordCount, content }[]` — inline documents (Files API docs sent separately as document content blocks)
  - `totalWordCount: number`
  - `revision?: { previousPlan, generalComment, cardComments, excludedCards, questionAnswers }` — if set, generates a revision prompt
- **Output:** `{ systemBlocks: SystemBlock[], messages: ClaudeMessage[] }`
- **System message structure:**
  - Block 0 (uncached): `PLANNER_ROLE` + `PLANNER_INSTRUCTIONS` + (if revision) `REVISION_INSTRUCTIONS` + `buildOutputSchema(isRevision)`. Expert priming prepended if `subject` set.
  - Block 1 (cached): inline document context wrapped in `<document id="..." name="..." wordCount="...">` XML tags.
- **Output format:** Exactly one JSON object — either `{ status: 'conflict', conflicts: [...] }` or `{ status: 'ok', metadata, cards: [...], questions: [...] }`.
- **Token budget:** 16384 output tokens. Temperature: 0.1.
- **Caching:** Block 1 (document context) marked `cache: true`.
- **Revision mode:** When `revision` is set, the user message contains the previous plan as JSON, user feedback, excluded cards, and question answers. The output schema adds a `revisionNotes` field.
- **Planner instructions** (7 steps):
  1. Conflict check — if any, return conflict JSON and stop.
  2. Document relationship analysis — classify as `dissolve` | `preserve` | `hybrid`.
  3. Content inventory — identify merge candidates and nesting opportunities.
  4. Card count determination — min 3, max 40 content cards.
  5. Card planning — title (5 words max), description, wordTarget, sources (verbatim heading refs), keyDataPoints (verbatim quotes), guidance (emphasis/tone/exclude object), crossReferences.
  6. Deduplication check.
  7. Decision questions (3–8) — each with 2–4 options, recommendedKey, and verbatim `producerInstruction` per option.

---

#### Prompt: `buildFinalizerPrompt`

- **Used by:** `useAutoDeck.ts` → `approvePlan()` when MCQ answers or general comment exist.
- **Model target:** Claude Sonnet 4.6
- **Input variables** (via `FinalizerPromptParams`):
  - `briefing: AutoDeckBriefing`
  - `lod: AutoDeckLod`
  - `subject?: string`
  - `plan: ParsedPlan` — the filtered plan (included cards only)
  - `questions: PlanQuestion[]` — original MCQ questions
  - `questionAnswers: Record<string, string>` — user's selected option keys
  - `generalComment?: string`
- **Output:** `{ systemBlocks: SystemBlock[], messages: ClaudeMessage[] }`
- **System message structure:**
  - Block 0 (uncached): `FINALIZER_INSTRUCTIONS` + `buildFinalizerSchema()`. Expert priming prepended if `subject` set.
  - No document context block — the Finalizer does not see source documents.
- **Output format:** Same `status: 'ok'` JSON structure as Planner, but without a `questions` array.
- **Token budget:** 16384 output tokens. Temperature: 0.1.
- **Purpose:** Merges resolved MCQ decisions into card `guidance` fields. Produces a self-contained plan that the Producer can execute without seeing the original questions.

---

### `autoDeckProducer.ts`

**Purpose:** Producer prompt for the Auto-Deck pipeline and the `batchPlan` utility.

---

#### Prompt: `buildProducerPrompt`

- **Used by:** `useAutoDeck.ts` → `approvePlan()` (Phase 2 — Produce), for each batch.
- **Model target:** Claude Sonnet 4.6
- **Input variables** (via `ProducerPromptParams`):
  - `briefing: AutoDeckBriefing`
  - `lod: AutoDeckLod`
  - `subject?: string`
  - `plan: PlannedCard[]` — the cards to write (one batch)
  - `documents: { id, name, content }[]` — inline documents
  - `batchContext?: string` — describes other cards in the full deck (for batches of large decks)
- **Output:** `{ systemBlocks: SystemBlock[], messages: ClaudeMessage[] }`
- **System message structure:**
  - Block 0 (uncached): `PRODUCER_ROLE` + process instructions (4 steps: locate sources, extract key data, write content, cross-card deduplication) + LOD-specific formatting rules + output schema. Expert priming prepended.
  - Block 1 (cached): inline document context in `<document>` XML tags.
- **Output format:** JSON: `{ status: 'ok', cards: [{ number, title, content, wordCount }] }`. Content is markdown body text without a `#` title heading.
- **Token budget:** `Math.min(64000, batch.length * tokensPerCard + 500)` where `tokensPerCard = Math.ceil(lodConfig.wordCountMax * 1.5 * 1.3)`.
- **Caching:** Block 1 (document context) marked `cache: true`.
- **LOD-specific formatting rules (in prompt):**
  - Executive: max one `##` heading, no tables/blockquotes/`###`, 1-2 bullets max.
  - Standard: full markdown range, tables only for 3+ dimension comparisons.
  - Detailed: full markdown range including tables and blockquotes.
- **Document format:** Plan sent to Producer as human-readable narrative (via `formatPlanForProducer`) rather than raw JSON, for better model comprehension.
- **Anti-hallucination rules:** Four occurrences of `ABSOLUTE RULE` / `CRITICAL RULES` forbidding inference, extrapolation, or content beyond source documents. Includes `[SOURCE NOT FOUND]` and `[INSUFFICIENT SOURCE MATERIAL]` placeholder instructions.

---

#### Function: `batchPlan`

- **Used by:** `useAutoDeck.ts` → `approvePlan()`.
- **Input:** `plan: PlannedCard[]`, `batchSize: number = 12`
- **Output:** `PlannedCard[][]` — array of batches, each containing up to `batchSize` cards.
- **Trigger:** When `finalCards.length > 15`.

---

### `coverGeneration.ts`

**Purpose:** All prompts for TitleCard and TakeawayCard cover slide generation — Phase 1 (chat mode), Phase 1 (synthesis), Phase 2 (planner), Phase 3 (visualizer).

---

#### Prompt: `buildCoverContentInstruction`

- **Used by:** `useInsightsLab.ts` → `sendMessage()` as system block 2 when `isCardRequest: true` and `isCoverLevel(detailLevel)` is true.
- **Model target:** Claude Sonnet 4.6
- **Input variables:** `coverType: DetailLevel` — `'TitleCard'` or `'TakeawayCard'`
- **Output format:**
  - TitleCard: `# Title\n## Subtitle\nTagline` — 15–25 words total.
  - TakeawayCard: `# Title\n- bullet\n- bullet...` — 40–60 words total.
- **Token budget:** TitleCard=150, TakeawayCard=350 (set in `sendMessage`).

---

#### Prompt: `buildCoverContentPrompt`

- **Used by:** `useCardGeneration.ts` → `performSynthesis()` when `isCoverLevel(level)` is true.
- **Model target:** Claude Sonnet 4.6
- **Input variables:**
  - `cardTitle: string`
  - `coverType: DetailLevel` — `'TitleCard'` or `'TakeawayCard'`
  - `fullDocument: string`
  - `sectionText: string`
  - `excludeDocument: boolean = false`
  - `subject?: string`
- **Output format:** Same as `buildCoverContentInstruction` for each cover type.
- **Token budget:** TitleCard=256, TakeawayCard=350 (set in `performSynthesis`).

---

#### Prompt: `buildCoverPlannerPrompt`

- **Used by:** `useCardGeneration.ts` → `generateCard()` for non-PwC cover cards.
- **Model target:** Claude Sonnet 4.6 (via `callClaude`, `maxTokens: 4096`)
- **Input variables:**
  - `cardTitle: string`
  - `coverContent: string` — Phase 1 synthesis output
  - `style: string` — visual style name
  - `aspectRatio: string = '16:9'`
  - `coverType: DetailLevel`
- **Output format:** Narrative prose describing: (1) composition, (2) visual focal point, (3) style application, (4) text hierarchy. No font names, no colors, no pixel values.
- **Cover-specific constraints:** No data visualization elements; title must dominate; canvas must fill with visual composition.
- **TitleCard vs TakeawayCard variation:** Guidance for secondary text differs — TitleCard gets subtitle/tagline layout; TakeawayCard gets bullet list treatment.

---

#### Prompt: `buildCoverVisualizerPrompt`

- **Used by:** `useCardGeneration.ts` → `generateCard()` for non-PwC cover cards.
- **Model target:** `gemini-3-pro-image-preview`
- **Input variables:**
  - `cardTitle: string`, `coverContent: string`, `settings: StylingOptions`, `visualPlan?: string`, `useReference?: boolean`, `coverType?: DetailLevel`
- **Output format:** PNG image.
- **Prompt construction:**
  1. Role: cover slide designer role (no data infographic).
  2. Style block: `buildNarrativeStyleBlock(settings)`.
  3. [Reference note]: if `useReference`.
  4. Layout: `sanitizePlannerOutput(visualPlan)` if present; else default layout based on `coverType`.
  5. Content: `transformCoverContentToTags(coverContent, cardTitle)` — TitleCard uses `[TITLE]`, `[SUBTITLE]`, `[TAGLINE]` tags; TakeawayCard uses `[TITLE]`, `[TAKEAWAY-BULLET]` tags.

---

#### Function: `transformCoverContentToTags` (private)

- **Used by:** `buildCoverVisualizerPrompt`.
- **Input:** `coverContent: string`, `cardTitle: string`
- **Output:** Delimited block:
  ```
  [BEGIN COVER CONTENT]
  [TITLE] title text
  [SUBTITLE] subtitle text     (TitleCard)
  [TAGLINE] tagline text       (TitleCard)
  [TAKEAWAY-BULLET] bullet     (TakeawayCard)
  [END COVER CONTENT]
  ```
- **Transforms:** `#` → `[TITLE]`, `##` → `[SUBTITLE]`, `- ` list items → `[TAKEAWAY-BULLET]`. Remaining non-tagged lines become `[TAGLINE]` (if `[SUBTITLE]` present) or `[TAKEAWAY]`.

---

### `documentConversion.ts`

**Purpose:** Static prompt constants for Gemini Flash PDF ingestion.

---

#### Prompt: `PDF_CONVERSION_PROMPT`

- **Used by:** `utils/fileProcessing.ts` → `convertPdfWithGemini(file)`.
- **Model target:** Gemini 2.5 Flash (`gemini-2.5-flash`)
- **Input variables:** None (static constant). The PDF file is sent as a multi-part request alongside this prompt.
- **Output format:** Markdown string. Charts/diagrams converted to tables or descriptions with footnotes; footnotes collected at end.
- **Token budget:** Not specified; Gemini Flash default.

---

#### Prompt: `HEADING_EXTRACTION_PROMPT`

- **Used by:** `utils/fileProcessing.ts` → `extractHeadingsWithGemini(file)`.
- **Model target:** Gemini 2.5 Flash
- **Input variables:** None (static constant). The PDF file is sent alongside this prompt.
- **Output format:** JSON array: `[{ level: number, title: string, page: number }]`. No markdown fences, no wrapper object. Returns `[]` if no headings found.
- **Two-step extraction logic in prompt:**
  1. Look for a TOC page in the first 10 pages; if found, extract from it.
  2. Only if no TOC: scan every page for headings from visual formatting.

---

### `pwcGeneration.ts`

**Purpose:** PwC Corporate style-specific Planner and Visualizer prompts. When `settings.style === 'PwC Corporate'`, `useCardGeneration` branches to these functions instead of the standard pipeline. The PwC pipeline uses a **JSON hybrid approach**: the Planner outputs structured JSON, and that JSON is embedded verbatim into the renderer's design specification block.

---

#### Prompt: `buildPwcPlannerPrompt`

- **Used by:** `useCardGeneration.ts` → `generateCard()` when `isPwc && !isCover`.
- **Model target:** Claude Sonnet 4.6 (via `callClaude`, `maxTokens: 4096`)
- **Input variables:** Same signature as `buildPlannerPrompt` in `contentGeneration.ts`.
- **Output format:** JSON object (not prose):
  ```json
  {
    "data_pattern": "string",
    "visual_concept": "string",
    "content_groups": [{ "label", "items", "is_hero_stat" }],
    "hero_callouts": ["42%", "$3.2M"],
    "focal_hierarchy": ["first", "second", "third"]
  }
  ```
- **PwC-specific visualization vocabulary:** Modular card blocks, comparison grids, KPI tiles, hero statistics, column/bar/waterfall/donut charts, timeline bars, data tables. Explicitly avoids flowcharts, mind maps, Venn diagrams, radial layouts, organic shapes.
- **Diversity clause:** Same as generic planner — if `previousPlan` is set, instructs a fundamentally different approach.

---

#### Prompt: `buildPwcVisualizerPrompt`

- **Used by:** `useCardGeneration.ts` → `generateCard()` when `isPwc && !isCover`.
- **Model target:** `gemini-3-pro-image-preview`
- **Input variables:** Same signature as `buildVisualizerPrompt`.
- **Output format:** PNG image.
- **Hybrid JSON prompt structure (differs from generic):**
  1. Role: short narrative sentence — `"Create a clean, authoritative PwC corporate consulting infographic."`.
  2. [Reference note]: if `useReference`.
  3. Design specification: `buildPwcDesignSpec(settings)` as a serialized JSON object with `style`, `aesthetic`, `palette`, `typography`, and `rendering_rules` fields.
  4. Visual brief: the raw JSON output from `buildPwcPlannerPrompt`, embedded directly (after stripping markdown code fences if present). If no planner output, a default JSON brief is constructed.
  5. Content block: `transformContentToTags(contentToMap, cardTitle)`.

#### Private: `buildPwcDesignSpec`

- **Input:** `settings: StylingOptions`
- **Output:** JSON string with PwC-specific rendering rules. Palette colors are converted via `hexToColorName` (with hex values in parentheses). Fonts converted via `fontToDescriptor`. Rendering rules encode 8 PwC design signatures (orange left-border callout boxes, hero statistics, three-zone structure, flat charts, grey data elements, section dividers, modular layout, no decorative patterns).

---

#### Prompt: `buildPwcCoverPlannerPrompt`

- **Used by:** `useCardGeneration.ts` → `generateCard()` when `isPwc && isCover`.
- **Model target:** Claude Sonnet 4.6 (via `callClaude`, `maxTokens: 4096`)
- **Input variables:** Same signature as `buildCoverPlannerPrompt`.
- **Output format:** JSON object:
  ```json
  {
    "title_position": "string",
    "orange_accent": { "shape", "position", "scale" },
    "supporting_text": "string",
    "whitespace": "string"
  }
  ```
- **PwC cover principles in prompt:** Left-aligned title, ONE geometric orange accent element only, whitespace-driven canvas, no gradients/textures/illustrations.

---

#### Prompt: `buildPwcCoverVisualizerPrompt`

- **Used by:** `useCardGeneration.ts` → `generateCard()` when `isPwc && isCover`.
- **Model target:** `gemini-3-pro-image-preview`
- **Input variables:** Same signature as `buildCoverVisualizerPrompt`.
- **Output format:** PNG image.
- **Hybrid JSON prompt structure:**
  1. Role.
  2. [Reference note].
  3. Cover design specification as JSON: palette (all colors via `hexToColorName`), typography (fonts via `fontToDescriptor`), rendering rules.
  4. Visual brief: PwC planner JSON output (or default layout JSON).
  5. Legibility requirement line.
  6. Content: `transformCoverContentToTags(coverContent, cardTitle)`.

---

## Prompt Construction Helpers

### `transformContentToTags(synthesisContent, cardTitle)`

Converts Phase 1 synthesis markdown to a bracketed-tag format safe for the image model. Strips all markdown syntax (headings, bold, italic, bullets, rules). Wraps output in `[BEGIN TEXT CONTENT]` / `[END TEXT CONTENT]` delimiters with `[TITLE]` at the top. Applied to all image-model prompts for non-PwC standard cards and the content-modification prompt.

### `sanitizePlannerOutput(plannerText)`

Safety net that strips residual toxic patterns from Phase 2 prose output before it reaches the image model. Removes markdown heading markers, bold/italic, horizontal rules, numbered/bullet list prefixes, font name strings (from a list of ~35 known fonts), point size values (e.g., `36pt`), hex color codes, pixel values, and orphaned punctuation.

### `hexToColorName(hex)`

Maps a hex color string to a human-readable name. Uses a ~120-entry lookup table first; falls back to RGB-based hue + lightness description. Prevents literal hex codes from appearing in image-model prompts, which can cause the model to render them as visible text.

### `fontToDescriptor(fontName)`

Maps a font family name to a visual descriptor. Uses a ~40-entry table; falls back to pattern matching on common naming conventions. Prevents font names from appearing in image-model prompts.

### `buildNarrativeStyleBlock(settings)`

Composes a three-paragraph narrative prose block from `StylingOptions`: (1) style identity/aesthetic from `STYLE_IDENTITIES`, (2) palette as named color-to-semantic-role bindings with optional conflict override clause, (3) typography as paired visual descriptors. Used by both generic and cover visualizer prompts.

### `assembleRendererPrompt(cardTitle, synthesisContent, settings, plannerOutput?, referenceNote?, subject?)`

The central assembler for Phase 3 image prompts. Calls `buildNarrativeStyleBlock`, `sanitizePlannerOutput`, and `transformContentToTags`; assembles blocks in the order: role → style → [reference] → layout → content.

---

## Style System Integration

Visual style selection drives the image-model prompts through two mechanisms:

1. **`STYLE_IDENTITIES`** (in `utils/ai.ts`): A record mapping each of the 15 built-in style names to a prose identity descriptor. `buildNarrativeStyleBlock` reads this to produce the style paragraph.

2. **`STYLE_COLOR_FAMILIES`** (in `promptUtils.ts`): Maps each style name to its expected color family keywords. Used by `detectPaletteStyleConflict` to determine whether to add an override clause in the palette paragraph when the user's custom palette doesn't match the style's expected colors.

Custom styles can have a `generatedPromptText` field produced by `generateStyleWithAI()`. When present, this text is used as the identity descriptor instead of `STYLE_IDENTITIES`.

For PwC Corporate, a dedicated `buildPwcDesignSpec` function produces a JSON design specification instead of the narrative style block, encoding PwC's specific rendering rules (orange callout boxes, hero statistics, grey data charts, flat layout, no decorative elements).

---

## Prompt Caching Strategy

Claude supports prompt caching via `cache_control: { type: 'ephemeral' }` on message content blocks. InfoNugget uses this in two ways:

### System Block Caching

In `callClaude(prompt, { systemBlocks })`, system blocks with `cache: true` are sent with `cache_control: { type: 'ephemeral' }`. This is applied to:
- **Inline document context** in synthesis, chat, and Auto-Deck prompts — the document content is large and stable within a session.
- The first block (system role prompt) is always `cache: false`.

### Last User Message Auto-Caching

`callClaude` injects `cache_control: { type: 'ephemeral' }` on the last user message's last content block automatically, provided the total system block content exceeds `CACHE_MIN_CHARS = 4000` characters. This supports incremental multi-turn caching in the chat pipeline.

### Cache Usage

- `cacheReadTokens` (from `cache_read_input_tokens` in the Claude response) and `cacheWriteTokens` (from `cache_creation_input_tokens`) are passed to `recordUsage()` and factored into cost calculation at the cache-specific rates.

---

## Prompt Variants

### DetailLevel Variants

All content synthesis and card content instruction prompts branch on `DetailLevel`:

| Level | Word Count | Formatting | Token Budget |
|-------|------------|------------|-------------|
| Executive | 70–100 | Max 1 `##`, no tables/blockquotes/`###`, ≤3 bullets | 300 |
| Standard | 200–250 | Full markdown; tables for 3+ comparisons | 600 |
| Detailed | 450–500 | Full markdown including blockquotes; tables encouraged | 1200 |
| TitleCard | 15–25 total | `# Title ## Subtitle tagline` only | 150/256 |
| TakeawayCard | 40–60 total | `# Title` + 2–4 bullets only | 350 |
| DirectContent | N/A | No synthesis; raw markdown passed directly | — |

### PwC JSON Hybrid vs Generic Prose

The standard pipeline (all 14 non-PwC styles) uses:
- **Planner**: Claude outputs narrative prose (~150–250 words, 4 named sections).
- **Renderer**: `assembleRendererPrompt` wraps the prose in a layout block with style-enforcement framing.

The PwC pipeline uses:
- **Planner**: Claude outputs structured JSON (`data_pattern`, `visual_concept`, `content_groups`, `hero_callouts`, `focal_hierarchy`).
- **Renderer**: The planner JSON is embedded verbatim inside a design specification JSON block in the Gemini prompt. The renderer receives: short narrative role → design spec JSON → visual brief JSON → bracketed content.

This separation tests whether structured JSON specifications produce more faithful PwC styling than narrative prose briefs.

### Cover vs Content

Cover cards (TitleCard, TakeawayCard) use entirely separate prompt functions at every phase:
- Phase 1: `buildCoverContentPrompt` (synthesis) or `buildCoverContentInstruction` (chat mode).
- Phase 2: `buildCoverPlannerPrompt` — produces a spatial composition brief focused on visual impact and title dominance; no data visualization vocabulary.
- Phase 3: `buildCoverVisualizerPrompt` — uses `transformCoverContentToTags` (produces `[TITLE]`, `[SUBTITLE]`, `[TAGLINE]`, `[TAKEAWAY-BULLET]` tags) instead of the standard content tags.

The generic and PwC cover planners produce different output formats (narrative prose vs JSON respectively) but share the same Phase 3 cover content tag format.

### Auto-Deck Three-Agent Separation

The Auto-Deck pipeline separates concerns across three Claude calls:
- **Planner** sees: source documents + briefing. Outputs: card plan JSON or conflict report. Temperature: 0.1.
- **Finalizer** sees: card plan + resolved decisions. Does NOT see source documents. Outputs: finalized plan JSON (no questions array). Only runs if MCQ answers or general comment exist.
- **Producer** sees: finalized plan + source documents. Outputs: written card content JSON. Does NOT see original MCQ questions or answers (they are baked into card guidance by the Finalizer).
