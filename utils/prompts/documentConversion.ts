// ─────────────────────────────────────────────────────────────────
// Document Conversion Prompts (Gemini Flash)
// - PDF → Markdown (full conversion with image interpretation)
// - PDF → Heading extraction (TOC/bookmark structure)
// ─────────────────────────────────────────────────────────────────

export const PDF_CONVERSION_PROMPT = `Convert the PDF to markdown.

Any images that are charts or diagrams should be converted to tables or description with a footnote indicating that this was originally an image.

Put all those footnotes at the end of the markdown.

**CRITICAL: Reproduce the ENTIRE document content faithfully and completely. Do NOT summarize, paraphrase, condense, or omit ANY content.**

Return ONLY the markdown content, nothing else.`;

export const HEADING_EXTRACTION_PROMPT = `Extract the heading/bookmark structure from this PDF document.

STEP 1: Look for a Table of Contents, Contents, or Index page in the first 10 pages. If found, extract the heading structure from it — preserve every entry exactly as written with its page number.

STEP 2: Only if no TOC page exists, scan every page and identify headings from visual formatting (font size, bold, numbering, spacing). Assign levels based on relative visual hierarchy.

Return ONLY a JSON array. No explanation, no markdown fences, no wrapper object.
[
  {"level": 1, "title": "exact heading text", "page": 1},
  {"level": 2, "title": "exact heading text", "page": 3}
]

If no headings are found, return: []`;
