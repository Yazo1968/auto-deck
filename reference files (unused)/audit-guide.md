# Setting Up the Codebase Audit Generator for Claude Code

## What This Does

Creates a custom slash command `/project:audit-codebase` that you can run anytime inside Claude Code. When triggered, Claude Code reads your entire codebase and generates a comprehensive set of audit reports in an `/audits` folder. It uses agent teams to parallelize the analysis across multiple sub-agents for speed and thoroughness.

The audit adapts to your tech stack — it only generates the reports that are relevant. A client-only SPA won't get a Database or API audit; a plain JavaScript project won't get a Type Safety audit.

The audit reports identify every issue in your codebase — from security vulnerabilities to dead code to performance problems — organized by category and prioritized by severity.

---

## Step-by-Step Setup

### Step 1: Create the Commands Directory (if not already done)

In your terminal, navigate to your project root folder and run:

```bash
mkdir -p .claude/commands
```

### Step 2: Copy the Slash Command File

Copy the `audit-codebase.md` file into your project's `.claude/commands/` directory:

```bash
cp audit-codebase.md .claude/commands/audit-codebase.md
```

Or if you downloaded it elsewhere, just make sure the file ends up at `.claude/commands/audit-codebase.md` in your project root.

### Step 3: Run It

Open Claude Code in your project directory and type:

```
/project:audit-codebase
```

Claude Code will read the entire codebase and generate all applicable audit reports.

> **Cost & time warning:** This command reads your entire codebase and dispatches multiple sub-agents in parallel. For a medium-sized project (~50-100 files), expect it to take 3-8 minutes and use roughly $1-3 of API credits (Sonnet model). Larger codebases will cost more. You can re-run it anytime — each run overwrites the previous results.

### Step 4: Review the Output

The command generates the following structure. Reports marked with *(conditional)* are only produced when relevant to your tech stack:

```
your-project/
├── audits/
│   ├── AUDIT_SUMMARY.md              ← Start here — overview + priority matrix
│   ├── SECURITY_AUDIT.md             ← Security vulnerabilities
│   ├── CODE_QUALITY_AUDIT.md         ← Dead code, duplication, naming, complexity
│   ├── ARCHITECTURE_AUDIT.md         ← Structural and design problems
│   ├── PERFORMANCE_AUDIT.md          ← Speed, memory, rendering, caching
│   ├── DATABASE_AUDIT.md             ← Schema, queries, indexes (conditional)
│   ├── API_AUDIT.md                  ← Endpoints, validation, errors (conditional)
│   ├── STATE_MANAGEMENT_AUDIT.md     ← Frontend state issues (conditional)
│   ├── RELIABILITY_AUDIT.md          ← Error handling, edge cases, race conditions
│   ├── TYPE_SAFETY_AUDIT.md          ← TypeScript strictness, type coverage (conditional)
│   └── DEPENDENCY_AUDIT.md           ← Package health, duplicates, vulnerabilities
│
├── .claude/
│   └── commands/
│       └── audit-codebase.md
└── ...
```

### Step 5: After the Audit

- Read `AUDIT_SUMMARY.md` first — it gives you the big picture and a prioritized fix order
- Each issue has a severity (CRITICAL / HIGH / MEDIUM / LOW) and exact file locations
- You can ask Claude Code to fix specific issues: `Fix SEC-001 from the security audit`
- Re-run the audit after fixes to verify improvements

---

## Tips

- **Re-running**: Safe to run multiple times. Each run overwrites the previous audit with fresh results.
- **Before major changes**: Run an audit before and after major refactoring to measure improvement.
- **Version control**: You can commit the `/audits` folder to track code health over time, or add it to `.gitignore` if you prefer not to.
- **Pair with docs**: Run `/project:generate-docs` first, then `/project:audit-codebase`. The audit can reference the documentation for context.
