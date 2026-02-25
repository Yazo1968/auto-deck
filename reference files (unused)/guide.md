# Setting Up the App Documentation Generator for Claude Code

## What This Does

Creates a custom slash command `/project:generate-docs` that you can run anytime inside Claude Code. When triggered, Claude Code reads your entire codebase and generates a complete set of documentation files in a `/docs` folder. It adapts to your tech stack automatically — a client-side SPA gets different documents than a full-stack app with a database and auth. It uses agent teams to parallelize the work across multiple sub-agents for speed.

---

## Step-by-Step Setup

### Step 1: Create the Commands Directory

In your terminal, navigate to your project root folder (where your `package.json` or main project files live) and run:

```bash
mkdir -p .claude/commands
```

This creates the `.claude/commands/` directory inside your project. Claude Code automatically detects any `.md` files placed here and makes them available as slash commands.

### Step 2: Create the Slash Command File

Copy the file `generate-docs.md` (included alongside this guide) into your project's commands directory:

```bash
cp generate-docs.md .claude/commands/generate-docs.md
```

The file contains frontmatter configuration and the full set of document templates. Claude Code reads it as a slash command definition.

### Step 3: Verify It Works

Open Claude Code in your project directory:

```bash
claude
```

Type `/` and you should see `project:generate-docs` in the autocomplete list. If not, make sure:
- You're in the correct project directory
- The file is at `.claude/commands/generate-docs.md` (not nested deeper)
- The file has the `.md` extension

### Step 4: Run It

Simply type:

```
/project:generate-docs
```

Claude Code will:
1. Read your entire codebase
2. Determine which documents apply to your stack
3. Dispatch parallel sub-agents to generate each document
4. Cross-reference all documents for consistency
5. Write everything to the `/docs` folder

### Step 5: After Generation

- Review each file for accuracy
- Commit the `/docs` folder to your repo
- Re-run `/project:generate-docs` anytime after significant code changes to keep docs in sync

---

## File Structure After Running

The exact documents generated depend on your codebase. A full-stack app gets all 10; a client-side SPA may get 7-8. Here's the maximum set:

```
your-project/
├── .claude/
│   └── commands/
│       └── generate-docs.md       ← the slash command
├── docs/
│   ├── APP_OVERVIEW.md            ← always generated
│   ├── ARCHITECTURE.md            ← always generated
│   ├── DATA_MODELS.md             ← if app has structured data types
│   ├── API_REFERENCE.md           ← if app has API routes or external API calls
│   ├── FEATURES.md                ← always generated
│   ├── DATA_FLOW.md               ← always generated
│   ├── FILE_STRUCTURE.md          ← always generated
│   ├── CONVENTIONS.md             ← always generated
│   ├── ENVIRONMENT.md             ← if app has env vars or build config
│   └── DECISIONS.md               ← always generated
├── src/
├── package.json
└── ...
```

---

## How It Adapts

The command detects your tech stack and adjusts automatically:

- **No database?** DATA_MODELS.md documents your TypeScript interfaces and client-side storage instead of SQL tables. No empty "Database" sections.
- **No backend API routes?** API_REFERENCE.md documents your external API integrations (Claude, Gemini, etc.) instead of REST endpoints. Skipped entirely if there's no API interaction.
- **No authentication?** Auth sections are omitted from ARCHITECTURE.md and CONVENTIONS.md — no "N/A" stubs.
- **Client-side SPA?** ARCHITECTURE.md focuses on component structure, state management, and browser storage rather than server middleware and deployment pipelines.

Every template uses conditional sections. If a section doesn't apply to your codebase, it's omitted entirely.

---

## Tips

- **Re-running**: The command handles both first-time creation and updates. It preserves any sections you've wrapped in `<!-- MANUAL -->` tags and only updates sections where the code has changed. Free-form edits outside of `<!-- MANUAL -->` tags will be overwritten.
- **Version control**: Commit both `.claude/commands/generate-docs.md` and the `/docs` folder so your team can use and benefit from them.
- **Consistency checks**: The command includes a final cross-referencing phase where Claude verifies all documents reference the same names, types, and paths consistently.
- **Cost awareness**: The command dispatches parallel sub-agents that each read source files. For large codebases (100+ files), this can consume significant tokens. For smaller projects, it's fast and economical.
- **Model selection**: The command defaults to `claude-sonnet-4-5-20250929`. You can change the `model` field in the frontmatter to use a different model.
- **Customizing**: You can edit the document templates in `generate-docs.md` to add project-specific sections or remove ones you don't need.
