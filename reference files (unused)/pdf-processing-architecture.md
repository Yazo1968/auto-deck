# PDF Processing Architecture

## 1. Overview & Goals

Auto-Deck allows users to upload source documents (Nuggets) and generate AI-powered presentations. PDFs are the most common upload format, yet they present a unique challenge: their internal structure (bookmarks, outlines, heading hierarchy) is stored as metadata — invisible to AI models that process pages as images.

This architecture solves three problems:

- **Structure extraction** — Get a reliable table of contents from any PDF, whether it has bookmarks or not.
- **Structure editing** — Let users modify bookmarks like Adobe Acrobat, with changes reflected across the app.
- **AI awareness** — Make Claude understand the document's organization without re-uploading the file, enabling section-level operations (summarize chapter 3, plan a deck from sections 2–4, answer questions about the appendix).

---

## 2. Architecture — The Big Picture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER UPLOADS PDF                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   pdf.js            │
                │   getOutline()      │
                └────────┬────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
     Bookmarks EXIST        No Bookmarks
     (fast path)            (Gemini path)
              │                     │
              │                     ▼
              │          ┌─────────────────────┐
              │          │  Gemini 2.5 Flash    │
              │          │  Scan pages as       │
              │          │  images → identify   │
              │          │  headings + pages    │
              │          └──────────┬──────────┘
              │                     │
              │                     ▼
              │          ┌─────────────────────┐
              │          │  outline-pdf +       │
              │          │  pdf-lib             │
              │          │  Write bookmarks     │
              │          │  into PDF            │
              │          └──────────┬──────────┘
              │                     │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Bookmark State     │
              │  (source of truth)  │
              └────────┬────────────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
           ▼           ▼           ▼
     ┌──────────┐ ┌──────────┐ ┌──────────────────┐
     │ TOC      │ │ PDF File │ │ AI System Prompt │
     │ (mirror) │ │ (saved)  │ │ (structure map)  │
     └──────────┘ └──────────┘ └──────────────────┘
```

All roads lead to **Bookmark State** — a single JavaScript array that drives the read-only TOC, persists back to the PDF file, and injects structural awareness into every AI call via the system prompt.

---

## 3. Library Stack

Three libraries handle all PDF operations. All are free, open-source, and run client-side in the browser.

### pdf.js (`pdfjs-dist`)

Mozilla's PDF rendering engine. Read-only.

| Capability | Used For |
|---|---|
| `getOutline()` | Extract existing bookmarks |
| Page rendering | PDF viewer in Sources Panel |
| Text layer | Text selection in viewer |

### pdf-lib (`pdf-lib`)

PDF modification library. Cannot render, but can create and edit PDF internals.

| Capability | Used For |
|---|---|
| Load existing PDF | Modify uploaded files |
| Write PDF objects | Backend for outline-pdf |
| Save modified PDF | Export enhanced PDF with bookmarks |

### outline-pdf (`@lillallol/outline-pdf`)

A lightweight wrapper around pdf-lib that provides a high-level API for writing bookmarks. Without it, adding outlines to a PDF requires manually constructing PDF dictionary objects — a brittle, low-level process.

| Capability | Used For |
|---|---|
| `outlinePdfFactory()` | Write a TOC structure as PDF bookmarks |

**Input format:**

```
1||Introduction
3||Market Analysis
3|-|Industry Overview
8|-|Competitors
15||Strategy
```

Each line: `pageNumber|depthMarker|title`. Simple enough for Gemini to output directly.

---

## 4. Upload Pipeline

### Fast Path — Bookmarks Exist

```
PDF uploaded
  │
  ├── pdf.js → getOutline() → bookmarks found
  │
  ├── Parse into Bookmark State:
  │   [
  │     { id, title: "Introduction", page: 1, level: 0, children: [] },
  │     { id, title: "Market Analysis", page: 3, level: 0, children: [
  │       { id, title: "Industry Overview", page: 3, level: 1, children: [] },
  │       { id, title: "Competitors", page: 8, level: 1, children: [] },
  │     ]},
  │   ]
  │
  ├── TOC populated, PDF displayed as-is
  │
  └── Done. Cost: $0. Time: instant.
```

**Code:**

```js
import * as pdfjsLib from 'pdfjs-dist';

const extractBookmarks = async (pdfFile) => {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const outline = await pdf.getOutline();

  if (!outline || outline.length === 0) return null;

  const parseOutline = async (items) => {
    const result = [];
    for (const item of items) {
      const dest = await pdf.getDestination(item.dest);
      const pageIndex = await pdf.getPageIndex(dest[0]);
      result.push({
        id: crypto.randomUUID(),
        title: item.title,
        page: pageIndex + 1,
        level: 0, // calculated during tree building
        children: item.items?.length
          ? await parseOutline(item.items)
          : []
      });
    }
    return result;
  };

  return parseOutline(outline);
};
```

### Gemini Path — No Bookmarks

```
PDF uploaded
  │
  ├── pdf.js → getOutline() → null
  │
  ├── Send pages as images to Gemini 2.5 Flash
  │   Prompt: "Identify all headings, sections, sub-sections.
  │            Return each with its page number and nesting level."
  │
  ├── Gemini returns structured TOC
  │
  ├── outline-pdf writes bookmarks into PDF
  │
  ├── Enhanced PDF stored, Bookmark State populated
  │
  └── Done. Cost: ~$0.01–0.03. Time: a few seconds.
```

**Code — Gemini call:**

```js
const generateTOC = async (pdfPages) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            ...pdfPages.map(page => ({
              inlineData: { mimeType: 'image/png', data: page.base64 }
            })),
            {
              text: `Analyze this PDF and identify all headings, sections, and sub-sections.
              
              Return ONLY a structured list in this exact format:
              pageNumber|depthMarker|title
              
              Where depthMarker uses pipes: || for level 0, |-| for level 1, |--| for level 2.
              
              Example:
              1||Introduction
              3||Market Analysis
              3|-|Industry Overview
              8|-|Competitors
              15||Strategy`
            }
          ]
        }]
      })
    }
  );

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
};
```

**Code — Write bookmarks into PDF:**

```js
import { PDFDocument } from 'pdf-lib';
import { outlinePdfFactory } from '@lillallol/outline-pdf';

const writeBookmarks = async (pdfBytes, outlineString) => {
  const outlinePdf = outlinePdfFactory(PDFDocument);

  const base64Pdf = btoa(
    String.fromCharCode(...new Uint8Array(pdfBytes))
  );

  const pdfWithBookmarks = await outlinePdf({
    pdf: base64Pdf,
    outline: outlineString
  });

  return await pdfWithBookmarks.save();
};
```

### Branch Logic

```js
const processPdf = async (pdfFile) => {
  const bookmarks = await extractBookmarks(pdfFile);

  if (bookmarks) {
    // Fast path
    return {
      bookmarkState: bookmarks,
      pdfBytes: await pdfFile.arrayBuffer(),
      source: 'extracted'
    };
  } else {
    // Gemini path
    const pages = await renderPagesToImages(pdfFile);
    const outlineString = await generateTOC(pages);
    const pdfBytes = await writeBookmarks(
      await pdfFile.arrayBuffer(),
      outlineString
    );
    const bookmarkState = parseOutlineString(outlineString);

    return {
      bookmarkState,
      pdfBytes,
      source: 'generated'
    };
  }
};
```

---

## 5. Bookmark Management

### Extraction

Handled by pdf.js `getOutline()`. Returns a nested tree of bookmark objects with titles and page destinations. Parsed into the app's internal Bookmark State format.

### Generation

Handled by Gemini 2.5 Flash. The model receives PDF pages as images and identifies heading structure visually. Returns the outline-pdf string format which is both human-readable and directly writable to PDF.

### Writing to PDF

Handled by outline-pdf wrapping pdf-lib. Takes the outline string format and injects proper PDF bookmark objects into the file. The user ends up with an enhanced PDF that has navigable bookmarks even if the original had none.

### Editing

The PDF Display section of the Sources Panel includes an editable bookmarks sidebar — similar to Adobe Acrobat's bookmark panel. All editing operations modify the Bookmark State, which then syncs everywhere.

**Supported operations:**

| Operation | Interaction |
|---|---|
| Rename | Click title → inline text input |
| Delete | ✕ button per item |
| Add | [+ Add Bookmark] button, inserts new item |
| Reorder | ▲▼ buttons to move within parent |
| Indent/Outdent | ←→ buttons to change nesting level |
| Change page | Editable page number field |

**State update pattern:**

```js
const [bookmarkState, setBookmarkState] = useState(initialBookmarks);

const renameBookmark = (id, newTitle) => {
  setBookmarkState(prev => updateNode(prev, id, node => ({
    ...node, title: newTitle
  })));
};

const deleteBookmark = (id) => {
  setBookmarkState(prev => removeNode(prev, id));
};

const addBookmark = (afterId, level) => {
  setBookmarkState(prev => insertNode(prev, afterId, {
    id: crypto.randomUUID(),
    title: "New Section",
    page: 1,
    level,
    children: []
  }));
};

const indentBookmark = (id) => {
  // Move node into the children of its previous sibling
  setBookmarkState(prev => indentNode(prev, id));
};

const outdentBookmark = (id) => {
  // Move node up to its parent's level
  setBookmarkState(prev => outdentNode(prev, id));
};
```

**Saving edits back to PDF:**

```js
const saveBookmarksToPdf = async (pdfBytes, bookmarkState) => {
  const outlineString = flattenToOutlineString(bookmarkState);

  const outlinePdf = outlinePdfFactory(PDFDocument);
  const updatedPdf = await outlinePdf({
    pdf: btoa(String.fromCharCode(...new Uint8Array(pdfBytes))),
    outline: outlineString
  });

  return await updatedPdf.save();
};

const flattenToOutlineString = (items) => {
  const lines = [];
  const walk = (nodes, depth = 0) => {
    for (const node of nodes) {
      const depthMarker = '|' + '-'.repeat(depth) + '|';
      lines.push(`${node.page}${depthMarker}${node.title}`);
      if (node.children.length) walk(node.children, depth + 1);
    }
  };
  walk(items);
  return lines.join('\n');
};
```

---

## 6. TOC ↔ Bookmark Sync

### Data Flow

```
Bookmarks Sidebar (edit surface)
       │
       │  user edits
       │
       ▼
  Bookmark State ──── single source of truth
       │
       ├──▶ TOC section (auto-mirrors, read-only)
       │      - displays titles, levels, page numbers
       │      - adds checkboxes for focus selection
       │
       ├──▶ PDF file (on save, writes bookmarks back)
       │
       └──▶ AI system prompt (structural map)
```

### TOC as Read-Only Mirror

The TOC component receives Bookmark State as a prop and renders it. It adds no editing capabilities — only checkboxes for selecting which sections to focus on.

```jsx
const TOCPanel = ({ bookmarkState, focusedSections, onToggleFocus }) => {
  const renderItems = (items) => (
    <ul>
      {items.map(item => (
        <li key={item.id}>
          <label>
            <input
              type="checkbox"
              checked={focusedSections.includes(item.id)}
              onChange={() => onToggleFocus(item.id)}
            />
            {item.title}
            <span className="page-number">pg {item.page}</span>
          </label>
          {item.children.length > 0 && renderItems(item.children)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="toc-panel">
      {renderItems(bookmarkState)}
      <div className="toc-actions">
        <button onClick={() => onToggleFocus('all')}>Select All</button>
        <button onClick={() => onToggleFocus('none')}>Deselect All</button>
      </div>
    </div>
  );
};
```

### Checkbox Behavior

- Checking a parent auto-checks all children.
- Unchecking a child sets the parent to an indeterminate state.
- "Select All" / "Deselect All" controls at the bottom.

### Page Range Mapping

Bookmarks only store a starting page. The end of each section is inferred from the start of the next:

```js
const addPageRanges = (bookmarkState, totalPages) => {
  const flat = [];
  const walk = (nodes) => {
    for (const node of nodes) {
      flat.push(node);
      if (node.children.length) walk(node.children);
    }
  };
  walk(bookmarkState);

  return flat.map((item, i) => ({
    ...item,
    pageStart: item.page,
    pageEnd: i < flat.length - 1
      ? flat[i + 1].page - 1
      : totalPages
  }));
};
```

---

## 7. AI Integration

### File API — No Re-upload

The PDF is uploaded once to Claude via the File API and stored with a `file_id`. All subsequent calls reference this ID. The file is never re-sent.

### TOC via System Prompt

The TOC is injected into the **system prompt**, making it available to every API call type (summarize, ask questions, plan deck, generate content) without repeating it in each message.

```js
const buildSystemPrompt = (fileId, bookmarkState, totalPages) => {
  const tocWithRanges = addPageRanges(bookmarkState, totalPages);

  const tocString = tocWithRanges.map(item => {
    const indent = '  '.repeat(item.level);
    return `${indent}${item.title} (pages ${item.pageStart}–${item.pageEnd})`;
  }).join('\n');

  return `
You have access to a PDF document (file_id: ${fileId}).

DOCUMENT STRUCTURE:
${tocString}

When the user references sections by name or number, use this structure
to locate the relevant pages in the document. If the user has selected
specific focus sections, prioritize those sections in your response.
  `.trim();
};
```

**Example output:**

```
You have access to a PDF document (file_id: file_abc123).

DOCUMENT STRUCTURE:
Introduction (pages 1–2)
Market Analysis (pages 3–14)
  Industry Overview (pages 3–7)
  Competitors (pages 8–14)
Strategy (pages 15–30)
Appendix (pages 31–40)

When the user references sections by name or number, use this structure
to locate the relevant pages in the document. If the user has selected
specific focus sections, prioritize those sections in your response.
```

### Focused Sections in User Messages

When the user has checked specific sections, this context is included in the user message:

```js
const buildUserMessage = (userPrompt, focusedSections) => {
  if (focusedSections.length === 0) return userPrompt;

  const focusString = focusedSections
    .map(s => `${s.title} (pages ${s.pageStart}–${s.pageEnd})`)
    .join(', ');

  return `FOCUSED SECTIONS: ${focusString}\n\n${userPrompt}`;
};
```

### API Call Pattern

```js
const callClaude = async ({ fileId, bookmarkState, totalPages, focusedSections, userPrompt }) => {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    system: buildSystemPrompt(fileId, bookmarkState, totalPages),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "file", file_id: fileId }
          },
          {
            type: "text",
            text: buildUserMessage(userPrompt, focusedSections)
          }
        ]
      }
    ]
  });

  return response.content[0].text;
};
```

This pattern works identically for all call types: summarization, Q&A, deck planning, content generation. The system prompt provides structure. The user message provides focus and intent.

---

## 8. Sources Panel Layout

```
┌─ Sources Panel ─────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌─ TOC (read-only) ─────────────┐  ┌─ PDF Display ──────────────────┐ │
│  │                                │  │                                 │ │
│  │  ☐ Introduction         pg 1  │  │  ┌─ Bookmarks ──┐  ┌─ Viewer ┐│ │
│  │  ☑ Market Analysis      pg 3  │  │  │ (editable)   │  │         ││ │
│  │    ☑ Industry Overview  pg 3  │  │  │              │  │         ││ │
│  │    ☑ Competitors        pg 8  │  │  │ ⠿ Intro  ✎✕  │  │  [PDF   ││ │
│  │  ☐ Strategy             pg 15 │  │  │ ⠿ Market ✎✕  │  │  pages] ││ │
│  │  ☐ Appendix             pg 31 │  │  │   ⠿ Ind. ✎✕  │  │         ││ │
│  │                                │  │  │   ⠿ Comp ✎✕  │  │         ││ │
│  │                                │  │  │ ⠿ Strat ✎✕  │  │         ││ │
│  │  [Select All]                  │  │  │ ⠿ Appx  ✎✕  │  │         ││ │
│  │  [Deselect All]                │  │  │              │  │         ││ │
│  │                                │  │  │ [+ Add]      │  │         ││ │
│  └────────────────────────────────┘  │  └──────────────┘  └─────────┘│ │
│                                      └─────────────────────────────────┘ │
│           LEFT                                  RIGHT                    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Left panel — TOC:**
- Read-only reflection of Bookmark State
- Checkboxes for focus selection
- Shows page numbers
- Select All / Deselect All controls
- Clicking an item scrolls the PDF viewer to that page

**Right panel — PDF Display:**
- Bookmarks sidebar: full editing (rename, delete, add, reorder, indent/outdent, page number)
- PDF viewer: rendered pages via pdf.js
- Clicking a bookmark scrolls the viewer to the corresponding page
- All edits in bookmarks sidebar automatically reflect in the left TOC
