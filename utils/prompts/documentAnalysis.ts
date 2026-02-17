// ─────────────────────────────────────────────────────────────────
// Document Analysis (PDF → Markdown via Claude document block,
//                    DOCX → text extraction + Claude formatting)
// ─────────────────────────────────────────────────────────────────
// PDF: sent as binary document block (Claude supports natively)
// DOCX: text extracted client-side via JSZip, then sent as plain
//       text for Claude to structure into proper Markdown
// ─────────────────────────────────────────────────────────────────

export const DOCUMENT_ANALYSIS_PROMPT = `Convert this document to well-structured Markdown format.

**CRITICAL REQUIREMENT: You MUST reproduce the ENTIRE document content faithfully and completely. Do NOT summarize, paraphrase, condense, or omit ANY content. Every single paragraph, sentence, and data point in the original must appear in your output.**

**Document Structure Handling:**

1. **Multi-column layouts (common in PDFs):**
   - Read columns left-to-right within each page before moving to next page
   - Don't mix content from different columns
   - Maintain proper reading order

2. **Headers/Footers:**
   - Identify repeated elements (page numbers, chapter titles, document titles)
   - EXCLUDE these from the main content
   - Don't repeat them for every page

3. **Page breaks:**
   - Don't create artificial paragraph breaks at page boundaries
   - Merge continuous text that spans pages
   - Use --- only for true section dividers, not page breaks

4. **Tables spanning multiple pages:**
   - Merge into a single continuous table

5. **Footnotes/Endnotes:**
   - Place footnotes inline as parenthetical text at the point of reference
   - Do NOT collect them at the end

**Heading Hierarchy:**
- Use # for document title (from title page or header)
- Use ## for main sections
- Use ### for subsections
- Reflect the document's actual hierarchy — don't invent nesting that isn't there
- Never skip heading levels

**Body Text:**
- Reproduce ALL paragraphs completely. Do not skip, merge, or shorten any paragraph. Every word matters.

**Lists:**
- Unordered lists → - item
- Ordered lists → 1. item
- Maintain nested list indentation
- Preserve all list items exactly

**Tables:**
- Convert to Markdown tables with proper | column | alignment |
- Include ALL rows and ALL columns — never truncate table data

**Formatting:**
- Bold → **bold**
- Italic → _italic_
- Links → [text](url)
- Code → \`code\`
- Code blocks → \`\`\`language
- Blockquotes → > quoted material

**Image & Chart Handling:**
For each image:
1. If it's a data chart (bar, line, pie, scatter, column, area, radar, heatmap, etc.):
   - Extract ALL data points into a Markdown table
   - Caption: "**Table X: [description] (Converted from [chart type])**"
   - Include: headers, labels, all values, units (%, $, millions, etc.)

2. If it's a photo, diagram, or illustration:
   - Replace with a descriptive text block: "> **[Figure: description]** — brief summary of what the image shows"

**What to EXCLUDE:**
- Page numbers
- Repeating headers/footers
- Watermarks
- Document metadata (unless relevant to content)
- Empty paragraphs that are conversion artifacts
- Redundant line breaks from rendering

**What NOT to do:**
- Do NOT add any commentary, explanations, or notes
- Do NOT summarize or condense any section
- Do NOT skip content you consider repetitive or unimportant
- Do NOT rearrange the order of content
- Do NOT add content that wasn't in the original

Return ONLY the complete Markdown content, nothing else.`;

// ─────────────────────────────────────────────────────────────────
// DOCX Text → Markdown (pre-extracted text sent as plain text)
// ─────────────────────────────────────────────────────────────────

export const DOCX_TEXT_ANALYSIS_PROMPT = `The following is raw text extracted from a Word document (DOCX). The extraction preserves paragraph breaks, heading markers (#), list markers (-), and inline formatting (**bold**, _italic_).

Convert this extracted text into well-structured Markdown.

**CRITICAL REQUIREMENT: You MUST reproduce the ENTIRE document content faithfully and completely. Do NOT summarize, paraphrase, condense, or omit ANY content.**

**Your task:**
- Clean up and properly structure the heading hierarchy (# for title, ## for sections, ### for subsections)
- Preserve all body text exactly as written
- Format lists properly (- for unordered, 1. for ordered, with nesting)
- Preserve the existing **bold** and _italic_ Markdown formatting from the extraction
- Convert any tabular data into proper Markdown tables
- Remove artifacts from the extraction process (extra whitespace, broken words)
- Maintain the original reading order

**What NOT to do:**
- Do NOT add any commentary, explanations, or notes
- Do NOT summarize or condense any section
- Do NOT skip content you consider repetitive or unimportant
- Do NOT rearrange the order of content
- Do NOT add content that wasn't in the original

Return ONLY the complete Markdown content, nothing else.`;
