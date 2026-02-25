# Auto-Deck Panel — Feature Proposal

**Version:** 1.0
**Date:** February 2026
**Status:** Proposal

---

## 1. Executive Summary

Auto-Deck is a two-agent AI pipeline that transforms one or more documents (bundled in a Nugget) into a structured set of presentation cards. The user selects a presentation category and level of detail, then the system plans and produces card content automatically — with a human review step in between.

The feature lives as a dedicated panel/page in the app called the **Auto-Deck Panel**. Its output is a set of named cards with content that populates the existing **Card Panel**.

---

## 2. Core Concepts

### 2.1 Presentation Categories

Every presentation has a primary purpose. The category determines what content is extracted from the source documents and how it is structured.

| Category | Purpose | Coverage Ratio | Typical Card Range |
|---|---|---|---|
| **Informative** | Share knowledge, data, or updates | ~60–70% of source | Medium |
| **Persuasive** | Convince the audience to act or adopt a viewpoint | ~30–40% of source | 5–8 cards |
| **Instructional** | Teach a skill or concept step by step | ~70–80% of source | Higher |
| **Inspirational** | Energize or rally an audience | ~15–25% of source | 4–7 cards |
| **Decision-Making** | Lay out options and trade-offs to guide a choice | ~50–60% of source | Varies by options |
| **Comprehensive** | Faithfully represent full document content | ~100% of source | Highest |

**Category content criteria** (used by both agents):

**Informative**
- Prioritize clarity and logical flow
- Lead with key takeaways, then supporting evidence
- Organize by themes or chronology
- Neutral, objective tone — let the data speak

**Persuasive**
- Build a narrative arc: problem → stakes → solution → call to action
- Select the strongest evidence, not all of it
- Address objections preemptively
- Every card moves the audience closer to "yes"

**Instructional**
- Strict logical progression — sequence matters most
- One concept per card, building on the previous
- Use examples, analogies, and reinforcement
- End with summary or application

**Inspirational**
- Lead with a human story or bold vision
- Emotional resonance over completeness
- Distill source material to its most powerful ideas
- End with a forward-looking, energizing message

**Decision-Making**
- Frame the decision clearly upfront
- Present options with consistent comparison criteria
- Highlight trade-offs honestly, not just pros
- End with a clear recommendation or discussion prompt

**Comprehensive**
- Full fidelity to source — nothing omitted, nothing invented
- Split by logical sections/subsections of the document(s)
- Preserve structure and hierarchy of the original
- Card count is dictated entirely by source material

### 2.2 Level of Detail (LOD)

LOD defines the word count target per card. It affects density per card which in turn affects the total number of cards.

| LOD | Label | Word Count Per Card |
|---|---|---|
| `executive` | Executive | 70–100 words |
| `standard` | Standard | 200–250 words |
| `detailed` | Detailed | 450–500 words |

### 2.3 Card Count Formula

Card allocation is a function of three variables:

```
Relevant Content (words) = Source Total Word Count × Coverage Ratio (from Category)
Card Count = Relevant Content ÷ LOD Word Count (midpoint of range)
```

Midpoints used for calculation:

| LOD | Midpoint |
|---|---|
| Executive | 85 words |
| Standard | 225 words |
| Detailed | 475 words |

The Planner agent performs this calculation but then **adjusts** for:
- Logical breakpoints — never split a cohesive idea across cards
- Category structural requirements — Persuasive needs its narrative arc regardless of math
- Minimum card counts — no category should produce fewer than 3 cards
- Maximum practical limits — flag if card count exceeds 40 (user should consider splitting)

### 2.4 Nugget (Document Input)

A Nugget is the app's existing container for one or more documents. Auto-Deck receives the Nugget as its input. The system must handle:

| Scenario | Handling |
|---|---|
| Single document, small (<2,000 words) | Direct processing, low card count |
| Single document, medium (2,000–10,000 words) | Standard processing |
| Single document, large (10,000+ words) | May produce many cards; Planner should flag |
| Multiple documents, complementary | Documents cover distinct subtopics of the same subject |
| Multiple documents, overlapping | Documents partially cover the same ground — Planner must deduplicate |
| Multiple documents, sequential | Documents form a sequence (e.g., Part 1, Part 2) — preserve order |
| Multiple documents, hierarchical | One primary, others supporting — Planner identifies hierarchy |

---

## 3. Architecture

### 3.1 Two-Agent Pipeline

The system uses two distinct Claude API calls with different roles:

```
┌─────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────┐     ┌────────────┐
│  Nugget  │────▶│  PLANNER    │────▶│  USER REVIEW │────▶│ PRODUCER │────▶│ Card Panel │
│  + LOD   │     │  (Agent 1)  │     │  (approve/   │     │ (Agent 2)│     │  (output)  │
│  + Cat.  │     │             │     │   comment)   │     │          │     │            │
└─────────┘     └─────────────┘     └──────────────┘     └──────────┘     └────────────┘
                       │                    │
                       ▼                    ▼
                 Conflict Flag        Revised Plan
                 (hard stop)         (if comments)
```

### 3.2 Agent 1 — Planner

**Role:** Analyze documents, detect conflicts, and produce a structured card plan.

**Receives:**
- All documents from the Nugget (full text)
- Selected category
- Selected LOD
- Total source word count (calculated by the app)
- General comment from user (if this is a revision cycle)
- Per-card comments from user (if this is a revision cycle)

**Does:**
1. **Conflict check** (always first) — scans all documents for contradictory data, claims, or positions. If conflicts are found, returns a conflict report and halts. The app must present this to the user before allowing the pipeline to continue.
2. **Document relationship analysis** — identifies overlaps, complements, sequence, hierarchy across documents.
3. **Coverage calculation** — applies category coverage ratio to total word count, divides by LOD midpoint to estimate card count.
4. **Content mapping** — decides what content from which document(s) maps to each card.
5. **Plan output** — produces the structured card plan (see schema below).

**System prompt structure (XML):**

```xml
<role>
You are a presentation planner. Your job is to analyze source documents
and produce a structured card plan. You do NOT write card content.
You only plan.
</role>

<category>
  <name>{selected_category}</name>
  <criteria>{category_criteria_text}</criteria>
  <coverage_ratio>{ratio}</coverage_ratio>
</category>

<lod>
  <level>{selected_lod}</level>
  <word_count_range>{min}–{max}</word_count_range>
  <midpoint>{midpoint}</midpoint>
</lod>

<source_metadata>
  <total_word_count>{count}</total_word_count>
  <document_count>{count}</document_count>
  <documents>
    <document id="doc1" word_count="{count}">{filename}</document>
    <document id="doc2" word_count="{count}">{filename}</document>
  </documents>
</source_metadata>

<user_feedback type="{none|revision}">
  <general_comment>{comment or empty}</general_comment>
  <card_comments>
    <card number="{n}">{comment}</card>
  </card_comments>
</user_feedback>

<instructions>
  1. FIRST: Check all documents for conflicting information.
     If conflicts exist, output ONLY a <conflicts> block and stop.
  2. Analyze document relationships.
  3. Calculate target card count.
  4. Produce the card plan in the exact XML schema specified.
  5. Each card gets a title (5 words max) and a one-sentence description.
  6. Each card must reference its source sections.
  7. Each card must include guidance for the Producer.
  8. If this is a revision: honor user comments, preserve card numbering
     for unchanged cards, and note what changed.
</instructions>

<output_format>
  {the exact XML schema from Section 4.1 below}
</output_format>

<documents>
  <document id="doc1" filename="{name}">
    {full document text}
  </document>
  <document id="doc2" filename="{name}">
    {full document text}
  </document>
</documents>
```

### 3.3 Agent 2 — Producer

**Role:** Write card content strictly following the Planner's approved plan.

**Receives:**
- The approved card plan (only checked/included cards)
- Source documents (full text or relevant chunks)
- Category criteria
- LOD word count target
- Per-card comments from user (if any)

**Does:**
1. Writes each card's content following the plan's guidance
2. Respects LOD word count range strictly
3. Follows category content criteria
4. Incorporates any per-card user comments
5. Returns structured card content

**System prompt structure (XML):**

```xml
<role>
You are a presentation content writer. You receive a card plan and
source documents. You write the content for each card exactly as
planned. You do NOT reorganize, skip, or add cards.
</role>

<category>
  <name>{selected_category}</name>
  <criteria>{category_criteria_text}</criteria>
</category>

<lod>
  <level>{selected_lod}</level>
  <word_count_range>{min}–{max}</word_count_range>
  <strict>true — every card MUST fall within this range</strict>
</lod>

<plan>
  {the approved card plan XML — only included cards}
</plan>

<user_card_comments>
  <card number="{n}">{comment}</card>
</user_card_comments>

<instructions>
  1. Write content for each card in the plan, in order.
  2. Follow the guidance field for each card precisely.
  3. Draw ONLY from the source sections referenced in each card.
  4. Stay within the word count range for every card.
  5. Apply the category criteria to tone and structure.
  6. If a user comment exists for a card, incorporate that feedback.
  7. Output in the exact XML schema specified.
</instructions>

<output_format>
  {the exact XML schema from Section 4.2 below}
</output_format>

<documents>
  <document id="doc1" filename="{name}">
    {full document text}
  </document>
</documents>
```

---

## 4. Schemas

### 4.1 Planner Output Schema

The Planner returns XML. The app parses this to drive the review UI and the Producer input.

**Conflict response (hard stop):**

```xml
<autodeck_plan status="conflict">
  <conflicts>
    <conflict>
      <description>Document A states Q3 revenue was $4.2M while
        Document B states it was $3.8M</description>
      <source_a document="doc1" section="Financial Summary"/>
      <source_b document="doc2" section="Revenue Table"/>
      <severity>high</severity>
    </conflict>
    <!-- additional conflicts -->
  </conflicts>
</autodeck_plan>
```

**Successful plan response:**

```xml
<autodeck_plan status="ok">
  <metadata>
    <category>{category}</category>
    <lod>{lod}</lod>
    <source_word_count>{total}</source_word_count>
    <coverage_ratio>{ratio}</coverage_ratio>
    <relevant_word_count>{calculated}</relevant_word_count>
    <card_count>{number}</card_count>
    <document_strategy>dissolve | preserve | hybrid</document_strategy>
    <document_relationships>
      <relationship type="complementary | overlapping | sequential | hierarchical">
        {brief description of how documents relate}
      </relationship>
    </document_relationships>
  </metadata>

  <cards>
    <card number="1">
      <title>{5 words max}</title>
      <description>{one sentence}</description>
      <sources>
        <source document="doc1" section="{section name or range}"/>
        <source document="doc2" section="{section name or range}"/>
      </sources>
      <guidance>{instructions for the Producer — what to emphasize,
        what framing to use, what to lead with}</guidance>
    </card>

    <card number="2">
      <title>{5 words max}</title>
      <description>{one sentence}</description>
      <sources>
        <source document="doc1" section="{section name or range}"/>
      </sources>
      <guidance>{instructions for the Producer}</guidance>
    </card>

    <!-- remaining cards -->
  </cards>
</autodeck_plan>
```

### 4.2 Producer Output Schema

The Producer returns XML that the app parses into Card Panel entries.

```xml
<autodeck_cards>
  <card number="1">
    <title>{same title from plan}</title>
    <content>{written content, within LOD word count range}</content>
    <word_count>{actual word count}</word_count>
  </card>

  <card number="2">
    <title>{same title from plan}</title>
    <content>{written content}</content>
    <word_count>{actual word count}</word_count>
  </card>

  <!-- remaining cards -->
</autodeck_cards>
```

### 4.3 Internal App Data Model

These are the data structures the app maintains internally (not sent to Claude).

**AutoDeck Session:**

```
AutoDeckSession {
  id: string (unique session identifier)
  nuggetId: string (reference to source Nugget)
  category: "informative" | "persuasive" | "instructional" |
            "inspirational" | "decision-making" | "comprehensive"
  lod: "executive" | "standard" | "detailed"
  status: "configuring" | "planning" | "conflict" | "reviewing" |
          "revising" | "producing" | "complete" | "error"
  planXml: string (raw Planner output)
  parsedPlan: ParsedPlan object
  reviewState: ReviewState object
  producerXml: string (raw Producer output)
  cards: Card[] (final parsed cards)
  revisionCount: number (how many review cycles)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**ParsedPlan (from Planner XML):**

```
ParsedPlan {
  metadata: {
    category: string
    lod: string
    sourceWordCount: number
    coverageRatio: number
    relevantWordCount: number
    cardCount: number
    documentStrategy: "dissolve" | "preserve" | "hybrid"
    documentRelationships: string
  }
  cards: PlannedCard[]
}

PlannedCard {
  number: number
  title: string
  description: string
  sources: { document: string, section: string }[]
  guidance: string
}
```

**ReviewState (user review layer):**

```
ReviewState {
  generalComment: string (user's overall comment)
  cardStates: {
    [cardNumber: number]: {
      included: boolean (default true, user can uncheck)
      comment: string (user's comment for this card)
    }
  }
  decision: "pending" | "approved" | "revise"
}
```

**Card (final output to Card Panel):**

```
Card {
  id: string
  number: number
  title: string
  content: string
  wordCount: number
  sourceSession: string (reference back to AutoDeckSession)
}
```

---

## 5. User Flow

### 5.1 Step-by-Step

```
1.  User navigates to Auto-Deck Panel
2.  User selects a Nugget (source documents)
3.  App displays: document count, total word count, document names
4.  User selects Category (dropdown or card selector, 6 options)
5.  User selects LOD (3 options: Executive / Standard / Detailed)
6.  App displays estimated card count (live calculation as user changes options)
        Estimate = (total word count × coverage ratio) ÷ LOD midpoint
        Shown as a range: ±20% to account for Planner adjustments
7.  User clicks "Generate Plan"
8.  App shows loading state ("Analyzing documents...")
9.  App sends request to Planner (Agent 1)
10. Planner returns response

    IF status = "conflict":
        10a. App displays conflict report
        10b. User must resolve conflicts externally and re-upload,
             or acknowledge and override (if app allows)
        10c. Flow stops here until resolved

    IF status = "ok":
        10d. App parses plan and displays the Review View

11. REVIEW VIEW displays:
        - Summary bar: category, LOD, card count, document strategy
        - Card list: each card shows checkbox + title + description
        - Per-card comment input (expandable)
        - General comment input at bottom
        - Two buttons: "Approve & Generate" / "Revise Plan"

12. User reviews:
        - Unchecks cards they want to exclude
        - Adds comments to specific cards
        - Adds general comment if needed

13a. If user clicks "Approve & Generate":
        - App sends included cards + any comments to Producer (Agent 2)
        - App shows loading state ("Writing cards...")
        - Producer returns card content
        - App parses and populates Card Panel
        - Flow complete

13b. If user clicks "Revise Plan":
        - App sends original plan + user comments back to Planner
        - Planner produces revised plan honoring the feedback
        - Returns to step 11 with updated plan
        - Revision counter increments (app may cap at 3–5 revisions)
```

### 5.2 State Machine

```
CONFIGURING ──▶ PLANNING ──▶ CONFLICT (hard stop)
                   │              │
                   │              ▼
                   │         User resolves → back to CONFIGURING
                   │
                   ▼
               REVIEWING ◀──────────────┐
                   │                     │
                   ├── Approve ──▶ PRODUCING ──▶ COMPLETE
                   │
                   └── Revise ──▶ REVISING ──┘
```

---

## 6. UI Specifications

All components are custom-built with React 19 + Tailwind CSS utility classes. No component libraries. Inline SVGs for icons. Google Fonts for typography. Pure CSS animations.

### 6.1 Auto-Deck Panel (Main Page)

**Layout:** Single column, max-width container, vertically scrolling.

**Sections:**

**A. Nugget Selector**
- Dropdown or search field to select an existing Nugget
- Once selected, display a summary strip:
  - Nugget name
  - Document count (e.g., "3 documents")
  - Total word count (e.g., "12,450 words")
  - List of document filenames

**B. Configuration Controls**
- **Category selector:** Six options displayed as selectable cards or a dropdown. Each shows the category name and a one-line description. Only one selectable at a time.
- **LOD selector:** Three options displayed as a segmented control or toggle group. Labels: "Executive (70–100 words)", "Standard (200–250 words)", "Detailed (450–500 words)".
- **Estimated card count:** A live-updating badge or label that recalculates whenever category or LOD changes. Format: "~12–18 cards" (showing the ±20% range).

**C. Action Button**
- "Generate Plan" — primary action button
- Disabled until both Nugget and Category and LOD are selected

### 6.2 Planning State

- Replace the action button area with a loading indicator
- Message: "Analyzing documents and building card plan..."
- Subtle animation (CSS only — e.g., pulsing dots or a progress bar)

### 6.3 Conflict View

Shown only when Planner returns `status="conflict"`.

- Alert banner at top (red/warning styling)
- List of conflicts, each showing:
  - Description of the contradiction
  - Source A reference (document + section)
  - Source B reference (document + section)
  - Severity badge
- Action: "Back to Configuration" button (user must resolve externally)

### 6.4 Review View

The core review interface. Shown when Planner returns `status="ok"`.

**Header strip:**
- Category badge
- LOD badge
- Card count
- Document strategy label (dissolve / preserve / hybrid)

**Card list:**
Each card rendered as a row or compact card component:

```
┌─────────────────────────────────────────────────────┐
│ [✓]  1. Card Title Here                             │
│      One sentence description of what this card      │
│      covers.                                         │
│      ┌─────────────────────────────────────────┐    │
│      │ Add comment... (expandable input)        │    │
│      └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

- Checkbox: checked by default, user unchecks to exclude
- Card number + title (bold)
- Description (regular weight, muted color)
- Comment input: collapsed by default, expands on click. Placeholder: "Add feedback for this card..."

**General comment area:**
- Full-width text area at the bottom of the card list
- Label: "General feedback (optional)"
- Placeholder: "Any overall comments about the plan..."

**Action buttons (sticky bottom bar or below the list):**
- "Revise Plan" — secondary/outline style
- "Approve & Generate" — primary style
- If revision count > 0, show: "Revision 2 of 5" indicator

### 6.5 Producing State

- Similar to Planning state but message: "Writing card content..."
- Optionally show a progress indicator: "Card 3 of 14..." if using sequential Producer calls

### 6.6 Complete State

- Success banner: "14 cards generated successfully"
- "View in Card Panel" button — navigates to Card Panel with cards populated
- "Start New Deck" button — resets Auto-Deck Panel

---

## 7. Code Architecture

### 7.1 File Structure

```
src/
├── features/
│   └── auto-deck/
│       ├── AutoDeckPanel.jsx          — Main page component
│       ├── components/
│       │   ├── NuggetSelector.jsx     — Nugget selection + summary
│       │   ├── CategorySelector.jsx   — Six category options
│       │   ├── LodSelector.jsx        — Three LOD options
│       │   ├── CardCountEstimate.jsx  — Live estimate display
│       │   ├── ConflictView.jsx       — Conflict report display
│       │   ├── PlanReview.jsx         — Review view container
│       │   ├── PlanCardRow.jsx        — Single card in review list
│       │   ├── GeneralComment.jsx     — General feedback textarea
│       │   └── StatusIndicator.jsx    — Loading/progress states
│       ├── hooks/
│       │   ├── useAutoDeck.js         — Main orchestration hook
│       │   ├── usePlannerAgent.js     — Planner API call logic
│       │   ├── useProducerAgent.js    — Producer API call logic
│       │   └── useCardEstimate.js     — Live card count calculation
│       ├── utils/
│       │   ├── xmlBuilder.js          — Build XML prompts for agents
│       │   ├── xmlParser.js           — Parse XML responses from agents
│       │   ├── cardCalculator.js      — Coverage ratios + card math
│       │   └── categoryConfig.js      — Category definitions + criteria
│       └── constants/
│           └── autoDeckConstants.js   — LOD values, coverage ratios,
│                                        word count ranges, limits
```

### 7.2 Key Constants File

`autoDeckConstants.js` should contain:

```
CATEGORIES — object with all 6 categories, each containing:
  - name
  - label (display name)
  - description (one sentence)
  - coverageRatio (decimal, e.g., 0.65)
  - criteria (full text of content criteria)
  - minCards (minimum practical card count)
  - maxCards (soft maximum, or null for Comprehensive)

LOD_LEVELS — object with 3 levels, each containing:
  - name
  - label
  - wordCountMin
  - wordCountMax
  - midpoint

LIMITS:
  - maxRevisions: 5
  - maxCardsWarning: 40
  - minCards: 3
```

### 7.3 Coding Directives

These are instructions for the developer (or Claude Code) building this feature.

**General:**
- All components are functional React 19 components using hooks
- No component libraries — everything is native HTML + Tailwind utility classes
- Icons are inline SVGs
- Animations are pure CSS (transitions, keyframes in Tailwind or a small CSS block)
- No TypeScript assumed — use plain JSX with JSDoc comments for type documentation if needed

**State management:**
- Use React `useState` and `useReducer` for local component state
- The main orchestration hook (`useAutoDeck`) should use `useReducer` with the state machine defined in Section 5.2
- If the app has a global state solution (context, zustand, etc.), integrate via a thin adapter — do not couple the feature tightly to a specific state library

**API integration:**
- Agent calls go through the app's existing API layer (or a new utility if none exists)
- Each agent call is a single Claude API `messages` endpoint call
- The system prompt is built dynamically per call using `xmlBuilder.js`
- Responses are parsed from XML using `xmlParser.js`
- Use `AbortController` for cancellation if user navigates away
- Handle API errors gracefully — surface to user with retry option

**XML parsing directive:**
- Do NOT use regex to parse XML responses
- Use `DOMParser` (available in browser) to parse the XML string
- Build a thin utility that extracts the plan/cards structure into plain JS objects
- Handle malformed XML gracefully — if parsing fails, surface as an error with retry

**XML building directive:**
- Use template literals to construct XML prompts
- Escape user-generated content (comments) before embedding in XML
- Build the prompt step by step: role → category → LOD → metadata → documents
- Keep the builder functions pure — input in, XML string out, no side effects

**Card count estimation:**
- This runs entirely client-side — no API call needed
- Recalculates on every category or LOD change
- Formula: `(totalWordCount × coverageRatio) ÷ lodMidpoint`
- Display as a range: `Math.floor(estimate × 0.8)` to `Math.ceil(estimate × 1.2)`

**Review state:**
- Checkboxes default to checked (all cards included)
- Comments default to empty strings
- When user clicks "Revise Plan," collect all card states and comments, re-send to Planner with `type="revision"` in the user_feedback block
- When user clicks "Approve & Generate," filter out unchecked cards, send remaining plan + comments to Producer
- Preserve card numbers across revisions for user continuity (card 5 stays card 5 even if 3 and 4 were unchecked)

**Card Panel integration:**
- Producer output is parsed into the `Card` data structure (Section 4.3)
- Cards are passed to the Card Panel via whatever mechanism the app currently uses to populate it (props, context, store, or direct state injection)
- Each card retains a reference to its `AutoDeckSession` for traceability

**Error handling:**
- Planner timeout or failure: show error with "Retry" button, preserve user selections
- Producer timeout or failure: show error with "Retry" button, preserve approved plan
- Malformed XML: show "Unexpected response" error with "Retry"
- Network errors: standard retry/offline handling
- If Planner returns neither `conflict` nor `ok` status: treat as error

**Performance considerations:**
- For large Nuggets (many documents, high word count), warn the user before calling Planner that this may take longer
- Consider streaming the Producer response if the API supports it, to show cards progressively
- The Planner always receives all documents in full — chunking is not recommended as it needs full context for conflict detection and relationship analysis

---

## 8. Edge Cases and Rules

### 8.1 Card Count Guardrails

| Situation | Action |
|---|---|
| Estimated count < 3 | Warn user: "Source material may be too short for this combination. Consider a higher LOD or adding more content." |
| Estimated count > 40 | Warn user: "This will produce a large deck. Consider Executive LOD or a more selective category." |
| Comprehensive + Executive + large document | Will produce the most cards. Show explicit count estimate and require confirmation. |
| Inspirational + Detailed + small document | May produce fewer than 3 cards. Suggest Standard or Executive LOD. |

### 8.2 Multi-Document Rules

| Rule | Description |
|---|---|
| Conflict is always checked first | Regardless of category, Agent 1 must scan for conflicts before planning. |
| Document boundaries | Comprehensive and Informative tend to preserve document boundaries. Persuasive and Inspirational tend to dissolve them. Decision-Making preserves if docs represent options, dissolves if not. Instructional preserves if docs are sequential steps, dissolves otherwise. |
| Source attribution | Every card in the plan must reference which document(s) and section(s) it draws from. |
| Duplicate content | If two documents cover the same point, the Planner must choose one source or merge — never produce two cards for the same content. |

### 8.3 Revision Cycle Rules

| Rule | Description |
|---|---|
| Max revisions | Cap at 5 revision cycles. After 5, disable "Revise Plan" and show message. |
| Comment persistence | Comments from previous revisions should be visible (read-only) so user tracks history. |
| Card stability | Planner should preserve card numbering for unchanged cards across revisions. New cards get new numbers appended at the end or inserted with sub-numbers (e.g., 4a). |
| Unchecked card handling | If user unchecked cards, the revised plan should NOT reintroduce them unless the general comment specifically asks for it. |

---

## 9. Prompt Engineering Notes

These notes are for whoever is tuning the agent prompts.

### 9.1 Planner Prompt

- The conflict check instruction must be **first and emphatic** — it's the only hard stop in the pipeline
- Include explicit examples of what counts as a conflict vs. a difference in emphasis
- The Planner must output the **exact** XML schema — add a note: "Do not add extra fields, do not omit fields, do not change tag names"
- For revisions: include the previous plan AND the user feedback. Instruct the Planner to describe what it changed and why in a `<revision_notes>` block
- Temperature: use 0 or very low — this is a planning task, not a creative one

### 9.2 Producer Prompt

- Word count adherence is critical — instruct the Producer to count words and self-check
- Include category criteria in the prompt even though the Planner already used them — the Producer needs them for tone and style
- Send the full documents — not summaries — because the Producer needs the actual language and data
- If card count is high (>15), consider batching: send cards 1–8 in one call, 9–15 in another, to manage output quality
- Temperature: low for Informative, Comprehensive, Decision-Making, Instructional. Slightly higher for Persuasive, Inspirational.

### 9.3 Token Budget Awareness

- Planner input can be large (multiple full documents). Ensure the app checks combined document size against Claude's context window limits.
- If documents exceed the context window: surface an error to the user. Do NOT silently truncate.
- Producer input is smaller (plan + documents + one set of cards) but still needs headroom for the full document set.

---

## 10. Testing Checklist

Before shipping, verify these scenarios work correctly:

**Configuration:**
- [ ] Selecting each of the 6 categories shows correct description and updates estimate
- [ ] Selecting each LOD updates estimate correctly
- [ ] Estimate range is mathematically correct (±20%)
- [ ] Cannot proceed without all three selections (Nugget, Category, LOD)

**Planner:**
- [ ] Single small document produces a reasonable plan
- [ ] Single large document produces correct card count
- [ ] Multiple complementary documents are handled (no duplication)
- [ ] Conflicting documents trigger hard stop with clear conflict report
- [ ] Plan XML parses correctly into review UI

**Review:**
- [ ] All cards appear with checkbox, title, description
- [ ] Unchecking a card excludes it from the Producer input
- [ ] Per-card comments are captured and sent on revision/approval
- [ ] General comment is captured and sent on revision/approval
- [ ] "Revise Plan" sends feedback and returns updated plan
- [ ] Revision counter increments and caps at limit
- [ ] "Approve & Generate" sends only included cards

**Producer:**
- [ ] Every card content falls within LOD word count range
- [ ] Card titles match the plan
- [ ] Category tone is correct (e.g., Persuasive reads differently from Informative)
- [ ] Cards appear correctly in Card Panel

**Edge cases:**
- [ ] Very small Nugget (< 500 words) + Comprehensive + Detailed = few cards, handled gracefully
- [ ] Very large Nugget (50,000+ words) + Comprehensive + Executive = many cards, user warned
- [ ] Empty Nugget = blocked with clear message
- [ ] API failure at any step = recoverable error state
- [ ] User navigates away mid-process = no orphaned API calls

---

## 11. Future Considerations

These are not part of the current scope but worth noting for future iterations:

- **Card reordering:** Let users drag-and-drop cards in the review step to change sequence
- **Partial regeneration:** Regenerate a single card without re-running the full Producer
- **Template saving:** Save a Category + LOD + comment preset as a reusable template
- **Tone/style layer:** Add a tone modifier (formal, conversational, technical) orthogonal to category
- **Export formats:** Export the card deck as PPTX, PDF, or Markdown
- **Streaming output:** Show cards appearing one by one as the Producer generates them
- **Multi-language support:** Generate cards in a user-specified language

---

*End of proposal.*
