# PDF to Markdown Conversion Pipeline

## What This Does

Converts uploaded PDF documents into clean, structured markdown that preserves all content — text, headings, tables, charts, and diagrams — ready for use in AI chat and analysis.

---

## Input

A PDF file uploaded by the user. Can contain any combination of:

- Text and paragraphs
- Headings and subheadings
- Tables (simple and complex)
- Charts (bar, line, pie, area, etc.)
- Diagrams (flowcharts, architecture, process maps)
- Images (photos, logos, decorative elements)

---

## Process

### Step 1: Structural Extraction

**Tool:** Docling (IBM, MIT license, `pip install docling`)

Docling reads the entire PDF and converts it to markdown in a single pass. It handles text, headings, lists, and tables with 97.9% accuracy on complex tables. No API keys or external services required. Runs on CPU at approximately 4 seconds per page.

```python
from docling.document_converter import DocumentConverter

converter = DocumentConverter()
result = converter.convert("document.pdf")
markdown = result.document.export_to_markdown()
images = result.document.images  # extracted image references
```

After this step, all text-based content is converted. Charts and diagrams exist in the markdown as image placeholders.

If the PDF contains no charts or diagrams, the process stops here. The markdown is complete.

### Step 2: Chart and Diagram Interpretation

**When:** Only when the PDF contains charts, diagrams, or other visual content that carries data or meaning. Docling cannot interpret these — it only knows an image exists, not what it represents.

**Tool:** Claude Sonnet 4.5 API (`claude-sonnet-4-5-20250929`, $3/$15 per million tokens)

For each image placeholder left by Docling, send the image to Claude with the following prompt:

```
Classify this image from a PDF document. 
Reply with exactly one word: chart, diagram, or decorative.

- "chart" = contains data (bar chart, line graph, pie chart, etc.)
- "diagram" = shows a process, structure, or relationship (flowchart, 
  architecture diagram, org chart, etc.)
- "decorative" = logo, photo, icon, or other non-data visual
```

If the response is **decorative**, skip it — leave it as an image reference or discard.

If the response is **chart**, send the image again with:

```
This image is a data chart from a PDF document. Convert it to markdown:
1. A heading with the chart title
2. A markdown table containing all data points
3. A one-sentence summary of the trend or key takeaway
Output only the markdown, nothing else.
```

If the response is **diagram**, send the image again with:

```
This image is a diagram from a PDF document. Convert it to markdown:
1. A heading with the diagram title or purpose
2. A structured description using nested lists or a table 
   showing all elements and their relationships
Output only the markdown, nothing else.
```

Replace the image placeholder in the markdown with the interpreted content.

### Step 3: Assembly

Combine the Docling markdown with any interpreted chart/diagram content. Add page references so content is traceable back to the original PDF.

---

## Output

A single markdown string representing the complete document.

**Example:**

```markdown
# Annual Report 2024

## Executive Summary

The company achieved record revenue of $67.2M in fiscal year 2024, 
representing a 23% increase over the prior year...

## Financial Highlights

| Metric          | FY 2023  | FY 2024  | Change |
|-----------------|----------|----------|--------|
| Revenue         | $54.6M   | $67.2M   | +23%   |
| Operating Income| $12.1M   | $16.8M   | +39%   |
| Net Income      | $8.4M    | $11.2M   | +33%   |

## Revenue by Quarter (Page 5)

| Quarter | Revenue ($M) |
|---------|-------------|
| Q1      | 14.2        |
| Q2      | 16.8        |
| Q3      | 15.9        |
| Q4      | 20.3        |

Revenue grew steadily through the year with a strong Q4 driven 
by holiday season demand.

## Organizational Structure (Page 8)

The company operates through three divisions:
- **Consumer Products**: Direct-to-consumer sales and retail partnerships
  - Reports to: Chief Commercial Officer
  - Teams: Marketing, Sales, E-commerce
- **Enterprise Solutions**: B2B software and services
  - Reports to: Chief Technology Officer
  - Teams: Engineering, Solutions Architecture, Support
- **International**: All operations outside North America
  - Reports to: Chief Operating Officer
  - Teams: Regional offices in London, Tokyo, São Paulo

## Market Outlook

Management expects continued growth in 2025, targeting 
revenue between $78M and $82M...
```

**What each content type becomes:**

| PDF Content | Markdown Output |
|---|---|
| Text paragraphs | Paragraphs |
| Headings | `#`, `##`, `###` headings |
| Tables | Markdown tables |
| Bullet/numbered lists | Markdown lists |
| Bar/line/pie charts | Markdown table with data + summary sentence |
| Flowcharts/diagrams | Nested list or table describing elements and relationships |
| Logos/photos/icons | Omitted (or kept as image reference if needed) |

---

## Local Development

During local development, the conversion pipeline can run as a simple Python script on the same machine as the main app. No microservice, no Docker, no hosting — just a script.

**Setup (one time):**

```bash
pip install docling
```

This downloads Docling and its AI models. After this, no internet connection is needed for conversion.

**Usage:**

Create a Python script (e.g., `convert.py`) that takes a PDF path and outputs a markdown file:

```python
import sys
from docling.document_converter import DocumentConverter

pdf_path = sys.argv[1]
output_path = sys.argv[2]

converter = DocumentConverter()
result = converter.convert(pdf_path)
markdown = result.document.export_to_markdown()

with open(output_path, "w") as f:
    f.write(markdown)

print(f"Converted {pdf_path} → {output_path}")
```

The main app calls this script when a user uploads a PDF:

```bash
python convert.py uploads/document.pdf outputs/document.md
```

Or the main app can call it programmatically (e.g., using Node's `child_process.exec` or similar) and read the resulting markdown file.

This is sufficient for local development and testing. When the app is ready for production deployment, replace the script call with an HTTP call to the conversion microservice described below.

---

## Production Deployment

Docling is a Python library. If the main web app is not built in Python (e.g., it's JavaScript/TypeScript with Next.js or Node), Docling cannot be imported directly into the app code. Instead, it runs as a separate small web service — a microservice — deployed alongside the main app.

**What this means in practice:**

The microservice is a small Python application deployed to a hosting service (Railway, Render, Google Cloud Run, AWS, Fly.io, or similar). The hosting service runs it and gives it a URL, just like any web app. Users never see or interact with it — only the main app talks to it.

```
Main app lives at:       yourapp.com
Conversion service at:   convert.yourapp.com  (or any internal URL)
```

When a user uploads a PDF, the main app sends the file to the conversion service via a standard HTTP call, the same way it would call the Claude API or any other external service. The conversion service runs Docling, and returns the markdown.

```
User uploads PDF
       ↓
Main app (yourapp.com) receives the file
       ↓
Main app sends the file to convert.yourapp.com via HTTP
       ↓
Conversion service runs Docling + Claude (if charts present)
       ↓
Returns markdown to the main app
       ↓
Main app stores the markdown for use in chat
```

**The microservice exposes one endpoint:**

```
POST /convert
Input: PDF file
Output: { "markdown": "...", "page_count": 30, "charts_found": 3 }
```

**Infrastructure:**

- Deployed to a hosting service the same way the main app is — just a second small service running alongside it
- Runs in a Docker container
- CPU is sufficient (no GPU required with Docling)
- Needs enough RAM for PDF processing (2–4 GB depending on document size)
- For low volume (under ~50 documents/day), a single instance is enough
- Scales horizontally by adding more instances behind a load balancer if volume grows

---

## Cost Per Document

For a 30-page PDF with 3 charts and 1 diagram:

| Step | Cost |
|---|---|
| Docling extraction (30 pages) | $0 (compute only) |
| Image classification (4 images × ~100 tokens) | < $0.001 |
| Chart/diagram interpretation (4 images × ~1,000 tokens) | ~$0.02 |
| **Total API cost** | **~$0.02** |

For a 30-page PDF with no charts or diagrams:

| Step | Cost |
|---|---|
| Docling extraction (30 pages) | $0 (compute only) |
| **Total API cost** | **$0** |

The only variable cost is the Claude API calls for chart/diagram interpretation. Text-only documents cost nothing beyond compute.

---

## Summary

```
PDF uploaded by user
       ↓
Docling converts text, headings, lists, and tables to markdown
       ↓
Any charts or diagrams? ── NO ──→ Done. Markdown is complete.
       │
      YES
       ↓
Claude Sonnet 4.5 classifies each image (chart / diagram / decorative)
       ↓
Charts → converted to markdown tables with data
Diagrams → converted to structured text descriptions
Decorative → skipped
       ↓
Image placeholders replaced with interpreted content
       ↓
Final markdown ready for storage and use
```
