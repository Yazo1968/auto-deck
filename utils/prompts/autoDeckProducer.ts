import { AutoDeckBriefing, AutoDeckLod, PlannedCard } from '../../types';
import { AUTO_DECK_LOD_LEVELS } from '../autoDeck/constants';
import { SystemBlock, ClaudeMessage } from '../ai';
import { buildExpertPriming } from './promptUtils';

// ── Producer prompt builder ──

const PRODUCER_ROLE = `You are a presentation content writer. You receive a card plan with source references and key data points, and you write content for each card.

CRITICAL RULES:
- You write ONLY what the plan specifies — do not reorganize, skip, or add cards.
- Every sentence you write must be directly traceable to the source documents.
- Do NOT infer, extrapolate, assume, or add ANY information beyond what the source documents contain. This includes: background context, industry norms, definitions, implications, predictions, comparisons to external data, or commentary of any kind.
- If the source documents do not say something, you do not write it. Period.
- If a keyDataPoints list is provided for a card, those exact figures/quotes MUST appear in your output.
- If the plan's source reference doesn't match any content you can find, write "[SOURCE NOT FOUND]" for that reference and move on — do NOT fabricate or substitute content.
- Do NOT use your general knowledge to fill gaps. If source material is insufficient for the planned word count, write what you can from the sources and note "[INSUFFICIENT SOURCE MATERIAL]".

Your output MUST be a single valid JSON object. Do not include any text before or after the JSON.`;

const PRODUCER_INSTRUCTIONS_BEFORE_FORMAT = `Follow this process for each card in the plan, in order:

1. LOCATE SOURCES:
   Find the sections referenced in the card's sources by matching the heading text or fallback description.
   If a source heading doesn't match exactly, look for the closest match.
   If no match exists, note this in your output.

2. EXTRACT KEY DATA:
   Before writing, identify the relevant passages from the source documents.
   Anchor your content to these passages. If keyDataPoints are listed in the plan, ensure every one appears verbatim in your output.

3. WRITE CONTENT:
   Using ONLY the located sources and the plan's guidance:
   - Follow the emphasis specified — lead with what the guidance says to lead with
   - Match the tone specified for this card
   - Respect the exclusions — do NOT include content the plan says belongs in another card
   - Stay within the word count range — count your words and self-check
   - Make explicit any relationships that are implied in the original (cause-effect, sequence, hierarchy, comparison, part-to-whole)
   - Use concise, direct phrasing — no filler, no repetition
   - Every sentence must restate, paraphrase, or directly quote from source documents — never add external context, background knowledge, definitions not in the source, or your own analysis

4. CROSS-CARD DEDUPLICATION:
   Before finalizing each card, check:
   - Does this card repeat any statistic, fact, or argument you already wrote in a previous card?
   - If yes: remove the duplicate. Either replace with a brief reference (e.g., "As noted above,...") or find different supporting evidence from the same source documents. Do NOT invent alternative evidence.
   - If the plan includes crossReferences, use them to guide how cards relate without repeating content.`;

const PRODUCER_INSTRUCTIONS_AFTER_FORMAT = `6. OUTPUT in the exact JSON format specified.`;

/** Build LOD-specific formatting rules (aligned with contentGeneration.ts). */
function buildFormattingRules(lod: AutoDeckLod): string {
  const headingRules = `
   Heading hierarchy (strict):
   - Do NOT include a # Card Title heading — just write the body content
   - Use ## for main sections within the content
   - Use ### for subsections under those (if word count permits)
   - Never skip heading levels (e.g., no jumping from ## to ####)
   - Never use # (H1) — that level is reserved for the card title
   - Only number headings when the content has inherent sequential order (steps, phases, stages, ranked items). For thematic, categorical, or parallel content use descriptive headings without numbers`;

  if (lod === 'executive') {
    return `5. FORMAT each card (strict rules for Executive level):
   - Use bold for 1-2 key metrics or terms only
   - Maximum one ## heading below the title
   - No tables, no ###, no blockquotes
   - Prefer a tight paragraph or 2-3 bullets — nothing more
   - ABSOLUTE RULE: Do NOT invent, infer, extrapolate, or add ANY data, facts, context, or claims beyond what is explicitly stated in the source documents
${headingRules}`;
  }

  if (lod === 'detailed') {
    return `5. FORMAT each card (use full markdown range for Detailed level):
   - Use bullet points for lists of features, attributes, or non-sequential items
   - Use numbered lists for sequential steps, ranked items, or ordered processes
   - Use tables when comparing items across multiple dimensions or presenting structured data
   - Use bold for key terms, metrics, and important phrases
   - Use blockquotes for notable quotes or callout statements
   - Choose the format that best represents the data — do NOT flatten everything into plain paragraphs
   - ABSOLUTE RULE: Do NOT invent, infer, extrapolate, or add ANY data, facts, context, or claims beyond what is explicitly stated in the source documents
${headingRules}`;
  }

  // Standard (default)
  return `5. FORMAT each card (use full markdown range for Standard level):
   - Use bullet points for lists of features, attributes, or non-sequential items
   - Use numbered lists for sequential steps, ranked items, or ordered processes
   - Use tables only when comparing 3+ items across multiple dimensions
   - Use bold for key terms, metrics, and important phrases
   - Choose the format that best represents the data — do NOT flatten everything into plain paragraphs
   - ABSOLUTE RULE: Do NOT invent, infer, extrapolate, or add ANY data, facts, context, or claims beyond what is explicitly stated in the source documents
${headingRules}`;
}

function buildOutputSchema(): string {
  return `Output format — respond with EXACTLY this JSON structure:

{
  "status": "ok",
  "cards": [
    {
      "number": number,
      "title": "string — same title from the plan",
      "content": "string — the written card content in markdown (without the # heading — just the body)",
      "wordCount": number
    }
  ]
}

Do NOT add extra fields. Do NOT omit cards. Do NOT change card titles.
Every card's wordCount MUST be within the specified range.`;
}

/** Format the plan as readable narrative instead of raw JSON for better comprehension. */
function formatPlanForProducer(plan: PlannedCard[]): string {
  return plan
    .map((card) => {
      const sources = card.sources
        .map((s) => {
          const ref = s.heading || s.fallbackDescription || s.section || 'unspecified section';
          return `    - ${ref} (from document: ${s.document})`;
        })
        .join('\n');

      const keyData = (card.keyDataPoints || []).map((d) => `    - "${d}"`).join('\n');

      let guidanceText: string;
      if (typeof card.guidance === 'object' && card.guidance !== null) {
        guidanceText = `    Emphasis: ${card.guidance.emphasis}\n    Tone: ${card.guidance.tone}\n    Exclude: ${card.guidance.exclude}`;
      } else {
        guidanceText = `    ${card.guidance}`;
      }

      const wordTargetLine = card.wordTarget ? `\n  Word target: ~${card.wordTarget} words` : '';

      return `Card ${card.number}: ${card.title}
  Description: ${card.description}${wordTargetLine}
  Sources:
${sources}
  Key data points to include:
${keyData || '    (none specified)'}
  Guidance:
${guidanceText}
  Cross-references: ${card.crossReferences || 'none'}`;
    })
    .join('\n\n');
}

interface ProducerPromptParams {
  briefing: AutoDeckBriefing;
  lod: AutoDeckLod;
  subject?: string;
  plan: PlannedCard[];
  documents: { id: string; name: string; content: string }[];
  /** Optional context about other cards in the full deck (for batched calls). */
  batchContext?: string;
}

export function buildProducerPrompt(params: ProducerPromptParams): {
  systemBlocks: SystemBlock[];
  messages: ClaudeMessage[];
} {
  const { briefing, lod, subject, plan, documents, batchContext } = params;
  const lodConfig = AUTO_DECK_LOD_LEVELS[lod];
  const expertPriming = buildExpertPriming(subject);

  // ── System blocks ──
  // Compose instructions with LOD-specific formatting rules
  const fullInstructions = [
    PRODUCER_INSTRUCTIONS_BEFORE_FORMAT,
    '',
    buildFormattingRules(lod),
    '',
    PRODUCER_INSTRUCTIONS_AFTER_FORMAT,
  ].join('\n');

  const systemBlocks: SystemBlock[] = [
    {
      text: [
        expertPriming ? `${expertPriming}\n\n${PRODUCER_ROLE}` : PRODUCER_ROLE,
        '',
        fullInstructions,
        '',
        buildOutputSchema(),
      ].join('\n'),
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
      inlineDocuments.map((d) => `<document id="${d.id}" name="${d.name}">\n${d.content}\n</document>`).join('\n\n');
    systemBlocks.push({ text: docContext, cache: true });
  }

  // ── User message ──
  const briefingLines = [
    `Audience: ${briefing.audience}`,
    `Presentation type: ${briefing.type}`,
    `Objective: ${briefing.objective}`,
  ];
  if (briefing.tone) briefingLines.push(`Tone: ${briefing.tone}`);
  if (briefing.focus) briefingLines.push(`Focus: ${briefing.focus}`);
  const briefingContext = briefingLines.join('\n');

  const planText = formatPlanForProducer(plan);

  const userMessage = `${briefingContext}

Level of Detail: ${lodConfig.label}
Word count range per card: ${lodConfig.wordCountMin}–${lodConfig.wordCountMax} words (STRICT — every card must fall within this range)
${batchContext ? `\n${batchContext}\n` : ''}
Card plan to execute:

${planText}

ABSOLUTE CONSTRAINT: All content must originate exclusively from the provided source documents. Do not infer, extrapolate, assume, or add any information, context, examples, definitions, or claims that are not explicitly present in the sources.

Write the content for each card now.`;

  const messages: ClaudeMessage[] = [{ role: 'user', content: userMessage }];

  return { systemBlocks, messages };
}

/**
 * Split a large card plan into batches for separate API calls.
 * Returns arrays of PlannedCard[], each batch up to `batchSize` cards.
 */
export function batchPlan(plan: PlannedCard[], batchSize: number = 12): PlannedCard[][] {
  const batches: PlannedCard[][] = [];
  for (let i = 0; i < plan.length; i += batchSize) {
    batches.push(plan.slice(i, i + batchSize));
  }
  return batches;
}
