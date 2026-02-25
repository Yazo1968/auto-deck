---
description: Incrementally update existing documentation in /docs by detecting what changed in the codebase since docs were last generated. Only touches affected documents.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Task
model: claude-sonnet-4-5-20250929
---

# Update App Documentation

## Objective

Incrementally update the existing documentation in `/docs` to reflect recent code changes. This command is faster and cheaper than full regeneration — it detects what changed, determines which documents are affected, and surgically updates only those sections.

**Prerequisites:** The `/docs` folder must already exist with generated documentation (from `/project:generate-docs`). If it doesn't exist, tell the user to run `/project:generate-docs` first.

---

## Execution Strategy

### Phase 1 — Detect Changes

1. **Check for git history.** Run:
   ```bash
   git log --oneline -1 2>/dev/null
   ```
   If the project uses git, proceed with git-based diffing. If not, fall back to full scan mode (Phase 1b).

2. **Find the last docs commit.** Look for the most recent commit that touched files in `docs/`:
   ```bash
   git log --oneline -1 -- docs/
   ```
   Use that commit hash as the baseline. If no docs commit exists, use the initial commit.

3. **Get changed files since baseline:**
   ```bash
   git diff --name-status <baseline>..HEAD -- . ':!docs/'
   ```
   This gives you a list of Added (A), Modified (M), Deleted (D), and Renamed (R) source files.

4. **Also check for uncommitted changes:**
   ```bash
   git diff --name-status -- . ':!docs/'
   git diff --name-status --cached -- . ':!docs/'
   ```

5. **Combine all changes** into a single change manifest:
   - **Added files**: new files not in any docs
   - **Modified files**: existing files whose content changed
   - **Deleted files**: files that no longer exist but are still referenced in docs
   - **Renamed files**: files whose paths changed

### Phase 1b — Full Scan Fallback (no git)

If the project doesn't use git:
1. Read every existing doc in `/docs`
2. Extract all file paths, function names, type names, and component names referenced
3. Glob the full source tree
4. Compare: find source files not referenced in docs, and doc references to files that don't exist
5. Read all source files and compare against what the docs describe
6. Build the change manifest from discrepancies

### Phase 2 — Map Changes to Documents

For each changed file, determine which documents it affects using this mapping:

| What changed | Documents to update |
|---|---|
| New/deleted/renamed source files | FILE_STRUCTURE.md |
| TypeScript interfaces or types changed | DATA_MODELS.md |
| Component added/removed/renamed | FEATURES.md, ARCHITECTURE.md, FILE_STRUCTURE.md |
| Component props or behavior changed | FEATURES.md, CONVENTIONS.md (if it's a pattern example) |
| Hook added/modified | HOOKS.md, DATA_FLOW.md, ARCHITECTURE.md |
| External API call changed (Claude, Gemini, etc.) | API_REFERENCE.md, DATA_FLOW.md |
| Prompt file added/modified | PROMPTS.md, API_REFERENCE.md |
| State management changed (Context, stores) | ARCHITECTURE.md, DATA_FLOW.md, CONVENTIONS.md |
| Environment variables added/removed | ENVIRONMENT.md |
| New dependency in package.json | APP_OVERVIEW.md (tech stack), ENVIRONMENT.md |
| Build/config files changed | ENVIRONMENT.md, ARCHITECTURE.md |
| Major architectural shift | ARCHITECTURE.md, DECISIONS.md |
| New workaround or TODO added | DECISIONS.md (technical debt) |
| Persistence/storage logic changed | ARCHITECTURE.md, DATA_FLOW.md |

Write the mapping as a **change plan** before making any edits:

```
## Change Plan

### Changed source files:
- M  hooks/useCardGeneration.ts
- M  components/AssetsPanel.tsx
- A  components/NewFeature.tsx

### Documents to update:
1. FILE_STRUCTURE.md — add NewFeature.tsx
2. DATA_FLOW.md — update card generation flow (useCardGeneration changed)
3. FEATURES.md — update card generation feature, add new feature section
4. ARCHITECTURE.md — no change needed (no structural change)

### Documents unchanged:
- APP_OVERVIEW.md, DATA_MODELS.md, API_REFERENCE.md, CONVENTIONS.md, ENVIRONMENT.md, HOOKS.md, PROMPTS.md, DECISIONS.md
```

Print this change plan for the user before proceeding.

### Phase 3 — Read Affected Docs and Source Files

For each document that needs updating:
1. Read the **current version** of that doc in `/docs`
2. Read the **changed source files** that affect it
3. Also read any **unchanged source files** referenced in the same doc section, to maintain context

### Phase 4 — Apply Targeted Updates

For each affected document, use the **Edit tool** (not Write) to make surgical replacements:

- **New file added**: Insert it into the correct position in FILE_STRUCTURE.md, add it to relevant sections in other docs
- **File modified**: Find every section that references this file and update the description to match current code
- **File deleted**: Remove references from all docs
- **File renamed**: Update all path references across all docs
- **New feature**: Add a new `## Feature:` section in FEATURES.md, add a new `## Flow:` in DATA_FLOW.md if applicable
- **Changed behavior**: Update the description in FEATURES.md, update the flow steps in DATA_FLOW.md
- **New type/interface**: Add to DATA_MODELS.md, update cross-references
- **Changed type fields**: Update the field table in DATA_MODELS.md

**Critical rules for edits:**
- Preserve all `<!-- MANUAL -->` sections untouched
- Preserve the existing document structure and formatting style
- Match the tone and level of detail of surrounding content
- Update cross-references if a section was added or removed
- Do NOT rewrite sections that aren't affected by the changes

### Phase 5 — Consistency Check

After all edits are applied, do a quick cross-reference pass:
- Grep for any file paths in docs that don't exist on disk
- Grep for any type/interface names that appear with different capitalizations
- Check that FILE_STRUCTURE.md includes every source file (glob the tree and compare)
- Fix any issues found

### Phase 6 — Summary

Print a summary of what was updated:

```
## Documentation Update Summary

### Files changed in codebase: 3
### Documents updated: 3 of 10
### Sections modified: 7

Changes:
- FILE_STRUCTURE.md: Added NewFeature.tsx entry
- DATA_FLOW.md: Updated "Card Generation" flow steps 3-5
- FEATURES.md: Updated "Card Generation" feature, added "New Feature" section

### Documents verified unchanged: 7 of 10
- APP_OVERVIEW.md ✓
- DATA_MODELS.md ✓
- ...
```

---

## Edge Cases

**No changes detected:**
If git diff shows no changes since the last docs commit, tell the user: "No source code changes detected since the last documentation update. Docs are up to date."

**Massive changes (>30 files changed):**
If more than 30 source files changed, warn the user: "Large number of changes detected (N files). A full regeneration with `/project:generate-docs` may produce better results than incremental updates. Proceed with incremental update anyway?" Wait for confirmation.

**Docs folder is missing or empty:**
Tell the user: "No existing documentation found in /docs. Run `/project:generate-docs` first to generate the initial documentation."

**New docs needed:**
If the codebase now has something that warrants a new document that doesn't exist yet (e.g., a database was added but DATA_MODELS.md doesn't exist), create that document from scratch using the template in `generate-docs.md`.

---

## Global Rules

1. **Edit, don't rewrite** — Use targeted Edit operations, not full file Write. This preserves manual edits and produces clean git diffs.

2. **Match existing style** — New content must match the tone, formatting, and level of detail of the surrounding document content.

3. **Preserve `<!-- MANUAL -->` sections** — Never modify anything between `<!-- MANUAL -->` markers.

4. **Show your work** — Print the change plan before editing. The user should know what will be touched before it happens.

5. **Be conservative** — If you're unsure whether a doc section needs updating, leave it alone. It's better to under-update than to introduce incorrect information.

6. **Use actual code** — When adding or updating descriptions, read the actual source code. Do not guess based on file names or old documentation.

7. **Cross-reference** — When adding new sections, add cross-references to/from related documents (e.g., "See DATA_MODELS.md for the full Card interface").
