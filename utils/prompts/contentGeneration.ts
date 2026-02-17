import { DetailLevel } from '../../types';

// ─────────────────────────────────────────────────────────────────
// Card Content Generation
// ─────────────────────────────────────────────────────────────────
// Consumed by Claude (text LLM). Output is standard markdown,
// which the Prompt Assembler transforms to bracketed tags before
// it reaches the image model.
// ─────────────────────────────────────────────────────────────────

export function buildContentPrompt(
  headingText: string,
  level: DetailLevel,
  fullDocument: string,
  sectionText: string,
  excludeDocument = false
): string {
  let wordCountRange = '200-250';
  if (level === 'Executive') wordCountRange = '70-100';
  if (level === 'Detailed') wordCountRange = '450-500';

  const instructions = `
Content Generation — [${headingText}]
Read the provided document in full for context. Then focus on [${headingText}] including all its sub-sections and nested content.

**Task:**
Extract and restructure the section's content into infographic-ready text that is ${wordCountRange} WORDS. The text must preserves all key data, arguments, and relationships between parts. The output should make the section's hierarchy, logic, and connections between its parts immediately clear without referring back to the source.

**Requirements:**
- Reproduce all meaningful content — no omissions, no invented information
- Make explicit any relationships that are implied in the original (cause-effect, sequence, hierarchy, comparison, part-to-whole)
- Use concise, direct phrasing — no filler, no repetition
- Preserve all data points, statistics, and specific terms exactly as written
- Only number headings when the content has inherent sequential order (steps, phases, stages, ranked items). For thematic, categorical, or parallel content use descriptive headings without numbers

**Formatting (use full markdown range):**
- Use bullet points for lists of features, attributes, or non-sequential items
- Use numbered lists for sequential steps, ranked items, or ordered processes
- Use tables when comparing items across multiple dimensions or presenting structured data
- Use bold for key terms, metrics, and important phrases
- Use blockquotes for notable quotes or callout statements
- Choose the format that best represents the data — do NOT flatten everything into plain paragraphs

**Heading Hierarchy (strict):**
- Do NOT include the section title as a heading — it will be added separately
- Use ## for main sections within the content
- Use ### for subsections under those
- Never skip heading levels (e.g., no jumping from ## to ####)
- Never use # (H1) — that level is reserved for the section title
`.trim();

  if (excludeDocument) {
    return `${instructions}\n\nFOCUS SECTION DATA:\n${sectionText}`;
  }
  return `${instructions}\n\nFULL DOCUMENT CONTEXT:\n${fullDocument}\n\nFOCUS SECTION DATA:\n${sectionText}`;
}

// ─────────────────────────────────────────────────────────────────
// Planner (Visual Layout Description)
// ─────────────────────────────────────────────────────────────────
// Phase 3 — consumed by Gemini Flash (text LLM).
//
// This prompt uses XML+MD structure (optimal for text LLMs).
// What changed from the original (per S4):
//   - Added canvas constraints (aspect ratio + content word count)
//   - Section 5: narrative description, no color mentions
//   - Section 6: tier labels only, narrative format (no font names,
//     no point sizes) — because this output gets injected into
//     the image model's prompt downstream
//   - Added FORBIDDEN rule to prevent toxic payload generation
//   - Removed fonts parameter (no longer needed)
// ─────────────────────────────────────────────────────────────────

export function buildPlannerPrompt(
  headingText: string,
  synthesisContent: string,
  style: string,
  aspectRatio: string = '16:9'
): string {
  // Compute approximate word count from the synthesis content
  const wordCount = synthesisContent.split(/\s+/).filter(w => w.length > 0).length;

  // Derive canvas orientation description from aspect ratio
  let canvasDescription = 'landscape — wider than tall';
  if (aspectRatio === '9:16') canvasDescription = 'portrait — taller than wide';
  else if (aspectRatio === '1:1') canvasDescription = 'square — equal width and height';
  else if (aspectRatio === '4:5') canvasDescription = 'near-square portrait';

  return `
# VISUAL LAYOUT PLANNING — [${headingText}]

You are an expert information designer. Your job is STRICTLY to decide HOW content should be visually arranged — layout, spacing, hierarchy, and composition. You do NOT decide WHAT content appears. The content is final and complete. You must not rewrite, paraphrase, summarize, abbreviate, or omit any of it.

## CANVAS CONSTRAINTS:
- Aspect ratio: ${aspectRatio} (${canvasDescription})
- Approximate content density: ~${wordCount} words
- Fit your layout to this canvas shape without crowding or wasted space

## CONTENT TO VISUALIZE:
---
${synthesisContent}
---

## YOUR TASK:
Analyze the content's structure (hierarchy, relationships, flow, comparisons, groupings) and produce a spatial layout blueprint. You are writing a construction plan for a graphic designer — not editing the content.

## CRITICAL RULE:
**DO NOT REWRITE THE CONTENT.** Reference content items by their existing headings, labels, or bullet text. Every word, number, statistic, and label from the content above will be passed verbatim to the renderer. Your job is only to say WHERE and HOW each piece is placed visually.

## OUTPUT FORMAT:

Write all descriptions as narrative sentences, not key-value lists.

1. **LAYOUT TYPE**: Choose the most effective spatial arrangement:
   - Top-down flowchart (sequential processes, pipelines, cause-effect)
   - Radial/hub-spoke (central concept with satellites)
   - Grid/matrix (comparisons, feature tables, multi-dimensional data)
   - Left-to-right timeline (chronological or phase-based)
   - Nested hierarchy (part-to-whole, org charts, taxonomies)
   - Split/column layout (before/after, pros/cons, dual perspectives)
   - Layered/stacked (architecture diagrams, protocol stacks)

2. **COMPONENT INVENTORY**: Describe the visual containers and their roles in narrative form:
   - Boxes/cards: which content section each contains, relative size and grouping
   - Connectors/arrows: what connects to what, direction
   - Icons: describe purpose (e.g. "database icon", "user icon") — not specific icon names
   - Section dividers: where the content naturally breaks
   - Callout badges: which existing statistics or key numbers to emphasize

3. **SPATIAL ARRANGEMENT**: Describe precise placement in narrative form:
   - What goes top, center, bottom
   - What groups together vs. separates
   - Flow direction (left→right, top→down, etc.)
   - Relative sizing (which components are visually dominant)

4. **EMPHASIS & HIERARCHY**: Describe what stands out visually:
   - Primary focal point (largest, most prominent)
   - Secondary elements
   - Supporting details (smaller, peripheral)

5. **STYLE NOTES**: Describe how the [${style}] aesthetic applies:
   - Shape character (rounded, sharp, organic, geometric)
   - Line weight and connector style
   - Icon treatment (outlined, filled, decorative)
   - Background treatment (solid, gradient, textured)
   - Write in narrative sentences. The renderer handles all color decisions — do not mention any colors.

6. **TEXT HIERARCHY**: Describe which text elements are most prominent and where they sit visually. Use ONLY these tier labels: TIER-1 (title), TIER-2 (headers), TIER-3 (body), TIER-4 (callouts). Write in narrative sentences, not lists.

   Example: "The title sits in a bold TIER-1 banner across the top. Each column is headed by a TIER-2 label. Bullet details are TIER-3. The $42M figure is a TIER-4 callout badge."

## RULES:
- Write all descriptions as narrative sentences, not key-value lists
- Be EXPLICIT about spatial positions — "top-left", "center row", "bottom strip"
- Reference ALL content items — nothing may be dropped
- Do NOT rewrite, paraphrase, or summarize any content text
- Do NOT invent information not in the content
- Keep layout descriptions concise but unambiguous
- FORBIDDEN in your output: font names, point sizes, hex colors, pixel values, key-value pairs. Use tier labels and spatial descriptions only. The renderer handles all font, color, and size decisions.
`.trim();
}
