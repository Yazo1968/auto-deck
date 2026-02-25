import { AutoDeckBriefing, AutoDeckLod, ParsedPlan, PlanQuestion } from '../../types';
import { AUTO_DECK_LOD_LEVELS } from '../autoDeck/constants';
import { SystemBlock, ClaudeMessage } from '../ai';
import { buildExpertPriming } from './promptUtils';

// ── Planner prompt builder ──

const PLANNER_ROLE = `You are a senior information architect specializing in document decomposition for visual communication. You analyze source documents and produce structured card plans.

CRITICAL CONTEXT: Your plan will be consumed by a separate AI content writer. The writer:
- Cannot see your reasoning, only your plan output
- Must locate exact source sections from your references
- Needs unambiguous guidance to produce correct content
- Has strict word count limits per card

Your plan must be precise enough that the writer can execute it without guessing.

Your plan must reference ONLY content that exists in the provided source documents — do not invent topics, infer data, or suggest content the sources do not contain.

Your output MUST be a single valid JSON object. Do not include any text before or after the JSON.`;

const PLANNER_INSTRUCTIONS = `Follow these steps in order:

1. CONFLICT CHECK (always first):
   Scan all documents for contradictory data, claims, or positions. A conflict is when two sources state incompatible facts about the same topic (e.g., different numbers for the same metric, opposing conclusions about the same subject). Differences in emphasis, perspective, or scope are NOT conflicts.
   If conflicts are found, output ONLY a conflict report (see output format) and stop.

2. DOCUMENT RELATIONSHIP ANALYSIS:
   Identify how the documents relate and choose a document strategy:
   - "dissolve": Sources cover the same broad topic — blend freely across cards.
   - "preserve": Sources are distinct sub-topics — keep document boundaries.
   - "hybrid": Some overlap, some distinct — merge overlapping, preserve distinct.

3. CONTENT INVENTORY (do this mentally before deciding card count):
   - List every major topic and section across all documents.
   - For each topic, note which document(s) cover it.
   - Flag topics covered by MULTIPLE documents — these are MERGE candidates. You must NOT plan separate cards for overlapping content. Consolidate into ONE card.
   - Flag topics that are sub-points of a larger topic — NEST under the parent card.

4. CARD COUNT DETERMINATION:
   Determine the optimal number of cards based on the source content and the user's briefing. Consider:
   - The volume and structure of content in the source documents
   - How the material naturally divides into distinct topics
   - The user's audience, objective, and presentation type
   - The LOD word count range per card
   - Logical breakpoints — never split a cohesive idea across cards
   - Minimum 3 content cards, maximum 40 content cards. Cover, section title, and closing cards do not count toward this limit. If source material would require more than 40, consolidate smaller topics or increase per-card density.

5. CARD PLANNING — for each card produce:
   - title: 5 words max, specific to the card's content (avoid generic titles like "Overview", "Background", "Introduction")
   - description: One sentence summarizing what this card covers
   - wordTarget: A specific word count target within the LOD range, based on the density of source material for this card. Cards with dense data get a higher target; cards with a single focused point get a lower target.
   - sources: Reference the specific location within the source document where the content lives. Use the EXACT heading text from the document's structure. If no clear heading exists, provide a fallbackDescription explaining where the content is located. (Note: source references point to document locations — they are separate from the deck's chapter/section structure defined by section title cards.)
   - keyDataPoints: Extract 2-5 VERBATIM quotes, figures, or statistics from the source that MUST appear in the written card content. Copy these exactly — character for character — from the document text.
   - guidance: Structured instruction for the content writer:
     - emphasis: What aspect from the source to lead with
     - tone: Specific tone for this card (e.g., "analytical", "urgent", "explanatory")
     - exclude: What nearby content should NOT be in this card (because it belongs to another card)
   - crossReferences: How this card relates to other cards in the plan (e.g., "Builds on Card 2's definition of X", "Contrasts with Card 4"). Set to null if standalone.

   NOTE: Cards will be sent to the writing agent in batches of up to 12. Each batch receives the full plan for context but only writes its assigned cards. Write guidance that is self-contained — avoid instructions that depend on the writer seeing specific content from cards in a different batch.

6. DEDUPLICATION CHECK (do this after planning all cards):
   Review your complete plan. For every pair of cards, verify:
   - No two cards cover the same topic, statistic, or argument
   - If overlap exists, consolidate into one card or explicitly split with clear boundaries in the guidance.exclude fields
   - Note any cross-references between cards that help the writer avoid repetition

7. DECISION QUESTIONS (generate 3-8 questions):
   Review your plan and identify critical decision points where the user's choice would meaningfully change the produced content. Generate questions that:
   - Address ambiguities in the briefing (e.g., which framing to use, what to emphasize)
   - Offer scope choices (e.g., include/exclude a borderline topic)
   - Present tone or structure alternatives for key cards
   - Resolve any tensions between briefing fields

   Each question must have:
   - 2-4 mutually exclusive options
   - A recommended option (your best judgment based on the briefing)
   - A producerInstruction for each option — a VERBATIM instruction that will be injected directly into the content writer's prompt. Write these as clear, specific directives (e.g., "Lead Card 3 with the revenue figures from Q2, not the market share data" NOT "focus more on financials").

   Question categories to consider:
   - Content emphasis: Which data or angle to prioritize for a specific card
   - Scope: Whether to include borderline or tangential topics
   - Structure: How to organize content (chronological vs. thematic, etc.)
   - Tone: Which voice to use for specific sections (analytical vs. persuasive)

   Do NOT generate questions about:
   - Whether to include a card (the checkbox handles that)
   - Basic formatting preferences (the LOD handles that)
   - Topics not covered in the source documents`;

const REVISION_INSTRUCTIONS = `This is a REVISION request. You previously produced a plan and the user has provided feedback.

Rules for revision:
- Honor all user feedback (general comment and question answers)
- If question answers are provided, incorporate them into the revised plan's guidance fields where applicable. The answers represent resolved decisions — adjust card guidance to reflect these choices.
- Preserve card numbering for unchanged cards
- If cards were unchecked (excluded), do NOT reintroduce them unless the general comment specifically asks for it
- New cards get new numbers appended at the end
- Generate NEW questions only for decisions introduced by the revision (e.g., if new cards were added or structure changed). Do not re-ask questions that were already answered.
- Include a "revisionNotes" field describing what changed and why`;

function buildOutputSchema(isRevision: boolean): string {
  const revisionField = isRevision
    ? `
    "revisionNotes": "string — describe what changed from the previous plan and why"`
    : '';

  return `Output format — respond with EXACTLY one of these JSON structures:

CONFLICT RESPONSE (if conflicts found):
{
  "status": "conflict",
  "conflicts": [
    {
      "description": "string — what the contradiction is",
      "sourceA": { "document": "string — doc id", "section": "string — section name or range" },
      "sourceB": { "document": "string — doc id", "section": "string — section name or range" },
      "severity": "high | medium | low"
    }
  ]
}

SUCCESSFUL PLAN RESPONSE (if no conflicts):
{
  "status": "ok",
  "metadata": {
    "category": "string — echo back the presentation type from the briefing",
    "lod": "string",
    "sourceWordCount": number,
    "cardCount": number,
    "documentStrategy": "dissolve | preserve | hybrid",
    "documentRelationships": "string — brief description of how documents relate"
  },
  "cards": [
    {
      "number": number,
      "title": "string — 5 words max, specific not generic",
      "description": "string — one sentence",
      "sources": [
        {
          "document": "string — doc id",
          "heading": "string — EXACT heading text from the document",
          "fallbackDescription": "string — only if no clear heading, describe the content location"
        }
      ],
      "wordTarget": "number — target word count for this card (within the LOD range, based on content density)",
      "keyDataPoints": ["string — verbatim quote or figure from source that MUST appear in card content"],
      "guidance": {
        "emphasis": "string — what aspect to lead with",
        "tone": "string — specific tone for this card",
        "exclude": "string — what nearby content should NOT be in this card"
      },
      "crossReferences": "string | null — references to other cards this one relates to"
    }
  ],
  "questions": [
    {
      "id": "string — unique id like q1, q2",
      "question": "string — clear, specific question about a critical decision point",
      "options": [
        {
          "key": "string — a, b, c, or d",
          "label": "string — concise option description",
          "producerInstruction": "string — verbatim directive for the content writer if this option is chosen"
        }
      ],
      "recommendedKey": "string — which option key you recommend",
      "context": "string — optional one-sentence explanation of why this question matters"
    }
  ]${revisionField}
}

Rules:
- Do NOT add extra fields. Do NOT omit required fields.
- keyDataPoints must contain VERBATIM text copied from the source documents — do not paraphrase.
- Every source must have either "heading" or "fallbackDescription", not both.
- guidance must be the structured object format shown above, not a plain string.
- questions array must contain 3-8 questions. Each question must have 2-4 options.
- producerInstruction must be a clear, specific directive — not vague guidance.`;
}

/** Format the user's briefing fields into a prompt-ready block. */
function buildBriefingContext(briefing: AutoDeckBriefing): string {
  const lines = [
    `Audience: ${briefing.audience}`,
    `Presentation type: ${briefing.type}`,
    `Objective: ${briefing.objective}`,
  ];
  if (briefing.tone) lines.push(`Tone: ${briefing.tone}`);
  if (briefing.focus) lines.push(`Focus: ${briefing.focus}`);
  if (briefing.minCards != null && briefing.maxCards != null) {
    lines.push(`Card count: between ${briefing.minCards} and ${briefing.maxCards} cards`);
  } else if (briefing.minCards != null) {
    lines.push(`Card count: at least ${briefing.minCards} cards`);
  } else if (briefing.maxCards != null) {
    lines.push(`Card count: at most ${briefing.maxCards} cards`);
  }
  const deckOptions: string[] = [];
  if (briefing.includeCover) deckOptions.push('Include a cover card (title slide with deck overview)');
  if (briefing.includeSectionTitles) deckOptions.push('Include section title cards (divider cards for main sections)');
  if (briefing.includeClosing) deckOptions.push('Include a closing card (takeaway or conclusion slide)');
  if (deckOptions.length > 0) {
    lines.push(`Deck structure:\n${deckOptions.map((o) => `- ${o}`).join('\n')}`);
  }
  return lines.join('\n');
}

interface PlannerPromptParams {
  briefing: AutoDeckBriefing;
  lod: AutoDeckLod;
  subject?: string;
  documents: { id: string; name: string; wordCount: number; content: string }[];
  totalWordCount: number;
  revision?: {
    previousPlan: ParsedPlan;
    generalComment: string;
    cardComments: Record<number, string>;
    excludedCards: number[];
    questionAnswers?: Record<string, string>;
  };
}

export function buildPlannerPrompt(params: PlannerPromptParams): {
  systemBlocks: SystemBlock[];
  messages: ClaudeMessage[];
} {
  const { briefing, lod, documents, totalWordCount, subject, revision } = params;
  const lodConfig = AUTO_DECK_LOD_LEVELS[lod];
  const isRevision = !!revision;
  const expertPriming = buildExpertPriming(subject);

  // ── System blocks ──
  const systemBlocks: SystemBlock[] = [
    {
      text: [
        expertPriming ? `${expertPriming}\n\n${PLANNER_ROLE}` : PLANNER_ROLE,
        '',
        PLANNER_INSTRUCTIONS,
        '',
        isRevision ? REVISION_INSTRUCTIONS : '',
        '',
        buildOutputSchema(isRevision),
      ]
        .filter(Boolean)
        .join('\n'),
      cache: false,
    },
  ];

  // Document context — cached (large). Only include docs with inline content;
  // Files API documents (native PDFs) are injected as document blocks in the messages array by the hook.
  // Uses XML-style wrapping per Anthropic best practices for clear document boundaries.
  const inlineDocuments = documents.filter((d) => d.content);
  if (inlineDocuments.length > 0) {
    const docContext =
      'Source documents are provided in <document> tags. Reference them by their id attribute.\n\n' +
      inlineDocuments
        .map((d) => `<document id="${d.id}" name="${d.name}" wordCount="${d.wordCount}">\n${d.content}\n</document>`)
        .join('\n\n');
    systemBlocks.push({ text: docContext, cache: true });
  }

  // ── User message ──
  const briefingContext = buildBriefingContext(briefing);

  let userMessage = `${briefingContext}

Level of Detail: ${lodConfig.label}
Word count range per card: ${lodConfig.wordCountMin}–${lodConfig.wordCountMax} words

Source metadata:
- Total word count: ${totalWordCount}
- Document count: ${documents.length}
- Documents (listed in user-specified priority order — respect this sequence):
${documents.map((d, i) => `  ${i + 1}. ${d.name} (${d.id}, ${d.wordCount} words)`).join('\n')}

ABSOLUTE CONSTRAINT: All content must originate exclusively from the provided source documents. Do not infer, extrapolate, assume, or add any information, context, examples, definitions, or claims that are not explicitly present in the sources.

Produce the card plan now.`;

  // Add revision context
  if (revision) {
    const excludedLine =
      revision.excludedCards.length > 0
        ? `\nExcluded cards (do NOT reintroduce): ${revision.excludedCards.join(', ')}`
        : '';

    const questionAnswerLines = revision.questionAnswers
      ? Object.entries(revision.questionAnswers)
          .filter(([, key]) => key)
          .map(([qId, optionKey]) => `  ${qId}: ${optionKey}`)
          .join('\n')
      : '';

    // Legacy per-card comments (kept for backward compat but not actively used)
    const cardCommentLines = Object.entries(revision.cardComments)
      .filter(([, comment]) => comment.trim())
      .map(([num, comment]) => `  Card ${num}: ${comment}`)
      .join('\n');

    userMessage = `This is a REVISION of the previous plan.

Previous plan:
${JSON.stringify(revision.previousPlan, null, 2)}

User feedback:
General comment: ${revision.generalComment || '(none)'}
${questionAnswerLines ? `Question answers (resolved decisions — incorporate into card guidance):\n${questionAnswerLines}` : 'Question answers: (none)'}
${cardCommentLines ? `Per-card comments:\n${cardCommentLines}` : ''}${excludedLine}

${briefingContext}

Level of Detail: ${lodConfig.label}
Word count range per card: ${lodConfig.wordCountMin}–${lodConfig.wordCountMax} words

Revise the plan based on the feedback above.`;
  }

  const messages: ClaudeMessage[] = [{ role: 'user', content: userMessage }];

  return { systemBlocks, messages };
}

// ── Finalizer prompt builder ──

const FINALIZER_INSTRUCTIONS = `You are receiving a card plan that was reviewed by the user. The user has:
1. Toggled cards on/off (excluded cards have been removed — do not reintroduce them)
2. Answered multiple-choice decision questions
3. Optionally provided general feedback

Your job is to produce the FINALIZED version of this plan by:
- Incorporating each resolved decision directive into the relevant card(s)' guidance fields. Merge the directive into emphasis, tone, or exclude as appropriate. If the directive affects card ordering, cross-references, or structure, adjust those fields too.
- Incorporating general feedback if provided.
- Re-running the deduplication check across the finalized plan.
- Outputting the finalized plan with NO questions array.

The output plan must be self-contained — every card's guidance must include all resolved decisions that affect it. The content writer will NOT see the original questions or answers.

IMPORTANT: You are NOT writing content — you are restructuring a plan. Do not invent new topics or cards. Only modify existing card guidance fields to incorporate the resolved decisions and feedback.

Your output MUST be a single valid JSON object. Do not include any text before or after the JSON.`;

function buildFinalizerSchema(): string {
  return `Output format — respond with EXACTLY this JSON structure:

{
  "status": "ok",
  "metadata": {
    "category": "string — echo back the presentation type from the briefing",
    "lod": "string",
    "sourceWordCount": number,
    "cardCount": number,
    "documentStrategy": "dissolve | preserve | hybrid",
    "documentRelationships": "string — brief description of how documents relate"
  },
  "cards": [
    {
      "number": number,
      "title": "string — 5 words max, specific not generic",
      "description": "string — one sentence",
      "sources": [
        {
          "document": "string — doc id",
          "heading": "string — EXACT heading text from the document",
          "fallbackDescription": "string — only if no clear heading, describe the content location"
        }
      ],
      "wordTarget": "number — target word count for this card",
      "keyDataPoints": ["string — verbatim quote or figure from source that MUST appear in card content"],
      "guidance": {
        "emphasis": "string — what aspect to lead with (incorporate resolved decisions here)",
        "tone": "string — specific tone for this card",
        "exclude": "string — what nearby content should NOT be in this card"
      },
      "crossReferences": "string | null — references to other cards this one relates to"
    }
  ]
}

Rules:
- Do NOT include a questions array.
- Do NOT add extra fields. Do NOT omit required fields.
- keyDataPoints must contain VERBATIM text copied from the source documents — do not paraphrase.
- Every source must have either "heading" or "fallbackDescription", not both.
- guidance must be the structured object format shown above, not a plain string.
- All resolved decisions must be incorporated into the relevant card(s)' guidance fields.`;
}

interface FinalizerPromptParams {
  briefing: AutoDeckBriefing;
  lod: AutoDeckLod;
  subject?: string;
  plan: ParsedPlan;
  questions: PlanQuestion[];
  questionAnswers: Record<string, string>;
  generalComment?: string;
}

export function buildFinalizerPrompt(params: FinalizerPromptParams): {
  systemBlocks: SystemBlock[];
  messages: ClaudeMessage[];
} {
  const { briefing, lod, subject, plan, questions, questionAnswers, generalComment } = params;
  const lodConfig = AUTO_DECK_LOD_LEVELS[lod];
  const expertPriming = buildExpertPriming(subject);

  // ── System blocks ──
  // NOTE: The finalizer does NOT receive source documents — it only restructures
  // the plan by merging decisions into guidance fields. This keeps the call fast & cheap.
  const systemBlocks: SystemBlock[] = [
    {
      text: [
        expertPriming ? `${expertPriming}\n\n${FINALIZER_INSTRUCTIONS}` : FINALIZER_INSTRUCTIONS,
        '',
        buildFinalizerSchema(),
      ].join('\n'),
      cache: false,
    },
  ];

  // ── Resolve question answers into readable directives ──
  const resolvedLines: string[] = [];
  questions.forEach((q) => {
    const selectedKey = questionAnswers[q.id];
    if (selectedKey) {
      const option = q.options.find((o) => o.key === selectedKey);
      if (option) {
        resolvedLines.push(`  ${q.id}: ${selectedKey} → "${option.producerInstruction}"`);
      }
    }
  });

  // ── Briefing context ──
  const briefingContext = buildBriefingContext(briefing);

  // ── User message ──
  const userMessage = `${briefingContext}

Level of Detail: ${lodConfig.label}
Word count range per card: ${lodConfig.wordCountMin}–${lodConfig.wordCountMax} words

Draft plan to finalize:
${JSON.stringify(plan, null, 2)}

${resolvedLines.length > 0 ? `Resolved decisions (incorporate each directive into the relevant card guidance):\n${resolvedLines.join('\n')}` : 'Resolved decisions: (none)'}

General feedback: ${generalComment?.trim() || '(none)'}

Finalize this plan now. Output the same JSON plan structure but with all decisions incorporated into card guidance. Do NOT include a questions array.`;

  const messages: ClaudeMessage[] = [{ role: 'user', content: userMessage }];

  return { systemBlocks, messages };
}
