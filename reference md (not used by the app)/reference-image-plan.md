# Reference Image Style Anchoring — Feature Plan

> **Scope**: Phase 4 (Card Generation) only
> **Files affected**: `imageGeneration.ts`, `promptUtils.ts`, API call site

---

## Overview

Users can optionally select any image as a style reference when generating infographic cards. When a reference image is selected, the system injects a style-anchoring paragraph into the image generation prompt and sends the reference image alongside the prompt in the API call. When no reference is selected, the prompt and API call remain unchanged.

This is a single-prompt design with conditional injection — not two separate prompt templates.

---

## User Flow

```
User generates Card 1 (no reference available yet)
       ↓
Card 1 rendered successfully
       ↓
User reviews Card 1 output
       ↓
  ┌─── User likes the style ───────────────────────┐
  │                                                 │
  │  User selects Card 1 (or any image) as          │
  │  the style reference for subsequent cards        │
  │                                                 │
  └─────────────────┬───────────────────────────────┘
                    │
          ┌─────────▼──────────┐
          │ Reference selected │──── YES ──→ Inject reference paragraph + send image
          └─────────┬──────────┘
                    │
                   NO ──→ Send prompt as-is (no reference paragraph, no image)
```

The user can:
- Select any previously generated card as the reference
- Select any uploaded image as the reference (not limited to generated cards)
- Change the reference at any time
- Clear the reference to go back to no-reference mode

---

## Logic

### Decision Point (in the API call site)

```typescript
// Pseudocode — in the function that calls generateContent()
const referenceImage: string | null = getUserSelectedReferenceImage(); // base64 or null

const prompt = buildVisualizerPrompt(
  headingText,
  contentToMap,
  settings,
  visualPlan,            // optional — from planner
  !!referenceImage       // NEW: boolean flag — reference image provided?
);

// API call
const contents = [];

// If reference image exists, send it first so the model sees it before the text
if (referenceImage) {
  contents.push({
    role: 'user',
    parts: [
      { inlineData: { mimeType: 'image/png', data: referenceImage } },
      { text: prompt }
    ]
  });
} else {
  contents.push({
    role: 'user',
    parts: [
      { text: prompt }
    ]
  });
}

const response = await model.generateContent({
  contents,
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
    imageConfig: {
      aspectRatio: settings.aspectRatio,
      imageSize: settings.resolution,
    }
  }
});
```

### Prompt Assembly (in `promptUtils.ts`)

The assembler receives a boolean flag indicating whether a reference image is present. If true, it injects the reference paragraph at a specific position in the prompt — between the style/palette block and the layout block.

```
Prompt structure WITHOUT reference:
  1. Role
  2. Style & Palette (narrative)
  3. Layout (from planner or auto-inferred)
  4. Content (bracketed tags)

Prompt structure WITH reference:
  1. Role
  2. Style & Palette (narrative)
  3. → REFERENCE PARAGRAPH (injected here)
  4. Layout (from planner or auto-inferred)
  5. Content (bracketed tags)
```

The injection point is strategic:
- **After** style/palette — the model has already been told the color and typography rules, so the reference reinforces rather than conflicts
- **Before** layout — the model hasn't committed to a spatial arrangement yet, and the paragraph explicitly tells it to derive layout from the content, not the reference
- **Before** content — the model reads the reference instruction before encountering the content to render

---

## The Reference Paragraph

This paragraph is the only text difference between reference and no-reference modes. It is written in narrative prose (consistent with the optimization plan — no markdown, no key-value pairs, no negative framing).

```
You will receive a reference infographic image alongside this prompt. Study it
carefully for visual style consistency: match its color application, typography
weight and character, background treatment, shape style, card/container design,
spacing rhythm, and overall level of polish. The goal is that the new infographic
looks like it belongs to the same visual family as the reference. However, determine
the layout and spatial arrangement entirely from the content structure below — the
reference's layout, number of columns, and content grouping should not influence
your composition decisions.
```

---

## Implementation

### Changes to `promptUtils.ts`

Add the `hasReferenceImage` parameter to `assembleRendererPrompt()`:

```typescript
export function assembleRendererPrompt(
  headingText: string,
  synthesisContent: string,
  settings: StylingOptions,
  plannerOutput?: string,
  hasReferenceImage: boolean = false  // NEW parameter, defaults to false
): string {
  const role = 'You are an expert Information Designer creating a high-fidelity, 2D flat infographic.';

  const styleBlock = buildNarrativeStyleBlock(settings);

  // NEW: conditional reference paragraph
  const referenceBlock = hasReferenceImage
    ? 'You will receive a reference infographic image alongside this prompt. Study it ' +
      'carefully for visual style consistency: match its color application, typography ' +
      'weight and character, background treatment, shape style, card/container design, ' +
      'spacing rhythm, and overall level of polish. The goal is that the new infographic ' +
      'looks like it belongs to the same visual family as the reference. However, determine ' +
      'the layout and spatial arrangement entirely from the content structure below — the ' +
      "reference's layout, number of columns, and content grouping should not influence " +
      'your composition decisions.'
    : null;

  let layoutBlock: string;
  if (plannerOutput) {
    const cleanPlan = sanitizePlannerOutput(plannerOutput);
    layoutBlock =
      `${cleanPlan}\n\n` +
      'Transcribe the provided text exactly and completely into this layout. ' +
      'Ensure the hierarchy (title largest, section headers medium, body text readable) ' +
      'matches the visual importance.';
  } else {
    layoutBlock =
      `Use a ${settings.style} aesthetic with sharp, professional shapes and clean composition. ` +
      'Analyze the content below and choose the spatial arrangement that best fits its hierarchy — ' +
      'a grid for parallel comparisons, a top-down flow for sequential processes, or a radial ' +
      'layout for central-concept structures. Ensure all text is rendered legibly with high contrast.';
  }

  const contentBlock = transformContentToTags(synthesisContent, headingText);

  // Assemble in order, filtering out null blocks
  return [role, styleBlock, referenceBlock, layoutBlock, contentBlock]
    .filter(Boolean)
    .join('\n\n');
}
```

### Changes to `imageGeneration.ts`

Pass the flag through from `buildVisualizerPrompt()`:

```typescript
export function buildVisualizerPrompt(
  headingText: string,
  contentToMap: string,
  settings: StylingOptions,
  visualPlan?: string,
  hasReferenceImage: boolean = false  // NEW parameter
): string {
  return assembleRendererPrompt(
    headingText,
    contentToMap,
    settings,
    visualPlan,
    hasReferenceImage
  );
}
```

### Changes to API call site

The calling code needs to:
1. Check if a reference image is selected
2. Pass `true` as the `hasReferenceImage` flag to `buildVisualizerPrompt()`
3. Include the reference image as an `inlineData` part in the API call's `contents` array, before the text prompt

No changes to `contentGeneration.ts` or `documentAnalysis.ts`.

---

## Interaction with Existing Modes

The reference image feature is orthogonal to the direct/planner-guided mode split. All four combinations are valid:

| Mode | Reference? | Behavior |
|------|-----------|----------|
| Direct mode | No reference | Current behavior — model chooses layout from content |
| Direct mode | With reference | Model copies style from reference, chooses layout from content |
| Planner-guided | No reference | Current behavior — model follows planner layout |
| Planner-guided | With reference | Model copies style from reference AND follows planner layout |

The reference paragraph is injected in the same position regardless of mode — between style and layout. In planner-guided mode with reference, the model gets three sources of guidance: narrative style rules, visual reference, and planner layout. These should be reinforcing, not conflicting, since the style rules and reference should describe the same aesthetic (they came from the same settings).

---

## Interaction with Phase 5 (Modifications)

Phase 5b (`buildContentModificationPrompt`) already sends a reference image — it's the original card being updated. That prompt already has its own reference-handling language ("match the reference image's visual family"). No changes needed.

Phase 5a (`buildModificationPrompt`) also already uses a reference image (the original card + redline overlay). No changes needed.

The new feature applies to Phase 4 only.

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Model copies the reference layout instead of adapting to new content | The reference paragraph explicitly states "determine the layout and spatial arrangement entirely from the content structure below." Test in validation phase with structurally different content (e.g., reference has 3 columns, new content has 5 items). |
| Reference image has quality issues that propagate to new cards | User-mitigated — they chose this image because they liked it. They can clear the reference at any time. |
| Reference image conflicts with the narrative style/palette block | Unlikely in normal use — the reference was generated from the same settings. If the user uploads an external image with different colors, the narrative palette block takes precedence (it's explicit hex values). |
| Adding an image to the API call increases latency/cost | Marginal — one additional image input. Gemini supports up to 14 reference images. This is well within normal operating range. |
| The `hasReferenceImage` flag is true but the calling code forgets to attach the image | The prompt will mention a reference that doesn't exist. Add a validation check at the call site: if flag is true, assert that the image data is non-null. |

---

## Testing Plan

| Test | Purpose |
|------|---------|
| Generate 5 cards from the same document — no reference. Assess visual consistency. | Baseline measurement. |
| Generate Card 1, then use it as reference for Cards 2–5. Assess visual consistency. | Measure improvement from reference anchoring. |
| Use a reference with 3 columns, generate content with 5 subsections. Check if layout adapts. | Validate that layout contamination is prevented. |
| Use an externally uploaded image (different aesthetic) as reference with explicit palette settings. | Verify that narrative palette block overrides conflicting reference style. |
| Generate with reference in both direct and planner-guided modes. | Verify all four mode combinations work. |
