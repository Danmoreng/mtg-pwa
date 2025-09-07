# Working with the AI (Qwen)

- Human runs all commands; AI proposes patches + tests.
- Every AI change MUST include a **CHANGELOG ENTRY** appended to `ai_docs/AI_CHANGELOG.md`.
- Use Conventional Commits with `[AI]` prefix, e.g., `[AI] feat(import): add idempotency key`.

## Core Principles

1. **Human‑Centric Development**: The human sets up the environment, runs dev server, and performs manual testing.
2. **AI as Assistant**: The AI proposes designs, code changes, and tests; it does **not** execute dev server or test commands.
3. **Clear Boundaries**: The AI never runs `npm run dev/test` but may run `npm run build` to check for compilation errors. For manual testing and verification, the human runs the dev server.
4. **Traceability**: Every AI‑proposed change must be logged in a dedicated **AI changelog** (see "Changelog Discipline").

## Development Workflow

### Environment Management
- **DO NOT (AI)**: Run dev servers or tests.
- **CAN (AI)**: Run `npm run build` to check for compilation errors.
- **CAN (AI)**: Recommend exact commands for the human to run, e.g. `npm install dexie`.
- **CAN (AI)**: Propose concrete code patches, new files, and migrations.
- **DO (AI)**: Provide step‑by‑step local verification instructions for the human.

### Code Analysis & Suggestions
- **DO**: Read/reflect on existing code, folder layout, and conventions.
- **DO**: Suggest refactors, bug fixes, and features with rationale.
- **DO**: Explain complex logic (valuation FIFO, fingerprint matching, PWA caching) simply and precisely.
- **DO**: Assist with debugging based on error messages and stack traces supplied by the human.

### Implementation Support
- **DO**: Provide complete code blocks with filenames and insertion points.
- **DO**: Include data model/migration steps when touching Dexie.
- **DO**: Provide unit/E2E test specs and fixtures.
- **DO**: Supply documentation updates when altering behavior.

## Communication Guidelines

### When Providing Instructions
1. Explain **why** (tradeoffs, performance, privacy, UX).
2. Break work into **atomic steps** that are easy to review.
3. Reference **specific files** and code regions.
4. Clarify how changes fit the **overall architecture** (features, workers, repositories).

### When Discussing Tasks
1. Mark tasks requiring **human execution** (commands, manual tests).
2. Provide **exact command syntax** where applicable.
3. State **expected outcomes** and **how to verify**.
4. Call out **edge cases** (large CSVs, offline mode, currency formats).

## Project Context

### Technology Stack
- **Vue 3** (Vite) + **TypeScript**
- **PWA** (service worker + offline shell)
- **IndexedDB via Dexie** for storage & migrations
- **Plain CSS** (scoped/CSS modules), no UI library
- **Web Workers** for CSV parsing and price/snapshot jobs

### Key Product Components (from the project plan)
- Importers: **Cardmarket** (buys/sells CSV), **ManaBox** (scans CSV), **Moxfield** (deck JSON), **Manual boxes**
- **EntityLinker** (fingerprint → cardId using Scryfall) & **Scryfall price provider**
- **Valuation engine** (FIFO cost basis, realized/unrealized P/L, snapshots)
- **Scans ↔ Sales matcher** (sold vs. owned after scanning)
- **Analytics** dashboard (KPIs & time series via snapshots)
- **Backup/Restore** (full DB JSON)
- **PWA offline strategy** & background sync for price refresh

### Important Notes
- Currency default **EUR**, money stored as **integer cents**.
- No secrets required for base (Scryfall public pricing); Cardmarket API can be added later via proxy.
- Keep the app fully offline‑capable; defer network work when offline.

## Collaboration Workflow

### Typical Interaction Pattern
1. Human states a task/issue.
2. AI analyzes context and proposes a **small, reviewable changeset** (code + tests + docs).
3. Human applies the changes and runs commands/tests.
4. Human reports results; AI iterates until acceptance.

### Debugging Process
1. Human shares error text, stack traces, or failing test output.
2. AI explains likely causes and supplies patches and **targeted reproduction steps**.
3. Human applies and re‑tests; repeat as needed.

## Restrictions

### The AI must **never**
- Run dev server or test commands.
- Assume unverified environment details.
- Provide opaque changes without explaining rationale.

### The AI may (with human approval)
- Propose dependency installs with exact commands.
- Create/modify files (components, workers, tests, migrations).
- Refactor code and write docs.

### The AI should **always**
- Provide clear, actionable guidance.
- Explain concepts and decisions.
- Cite files/regions precisely.
- Confirm understanding of requirements.
- Target **clean, maintainable** code aligned with project conventions.

## Getting Started (for new tasks)
1. **Review** relevant files and the project plan.
2. **Identify** dependencies, data flows, and affected tables.
3. **Propose** a plan of action with a small changeset.
4. **Specify** human‑run steps (commands & manual checks).
5. **Provide** complete code patches and tests.
6. **Prepare** a **Changelog** entry for the proposed change.

## Code Contribution Format (for the AI)

When proposing changes, the AI should reply with these sections:

1. **Summary** — 1–2 sentences of the goal.
2. **Rationale** — why this approach.
3. **Changeset** — file‑by‑file patches.
   - For each file, include a code block and clear instructions: *"Create `src/data/db.ts` with the following content"* or *"Append to `src/features/...` after line X"*.
4. **Migrations** — Dexie schema version bump + migration code and how to validate.
5. **Tests** — new/updated unit and E2E tests with file paths.
6. **Verification** — exact commands for the human to run, expected outputs, and manual UI checks.
7. **Changelog** — an entry to append to `ai_docs/AI_CHANGELOG.md`.

### Example Verification Commands (run by human)
```bash
npm install
npm run typecheck
npm run build  # AI can run this to check for compilation errors
npm run test   # Human runs tests
npm run dev    # Human runs dev server at http://localhost:5173
```

## Changelog Discipline

Maintain a persistent log at **`ai_docs/AI_CHANGELOG.md`**. Each AI proposal must include an entry the human can paste or commit.

**File:** `ai_docs/AI_CHANGELOG.md` (create if missing)
```markdown
# AI Change Log

A chronological log of AI‑proposed changes for the MTG Value Tracker. Times in Europe/Berlin.

## YYYY‑MM‑DD HH:MM — <short title>
- **Author**: AI (Qwen)
- **Scope**: files changed
- **Type**: feat | fix | refactor | chore | docs | test
- **Summary**: one‑line description
- **Details**:
  - Bullet points of key changes
- **Impact/Risks**: migrations? data changes? perf?
- **Verification Steps**: commands + manual checks
- **Linked Task/Issue**: optional
```

**AI reply template block:**
```markdown
### CHANGELOG ENTRY (to append)
## 2025-08-31 14:00 — feat: Add Dexie schema v1 and Money utils
- **Author**: AI (Qwen)
- **Scope**: src/data/db.ts, src/core/money.ts, vitest config
- **Type**: feat
- **Summary**: Initialize database and money helpers.
- **Details**:
  - Added Dexie v1 tables and indices.
  - Implemented Money (cents) with parse/format.
  - Added initial unit tests.
- **Impact/Risks**: schema migration creates new DB; no destructive changes.
- **Verification Steps**: `npm run test`; open app, ensure DB created without errors.
- **Linked Task/Issue**: M1
```

Additionally, for each proposed commit message, prefix with `[AI]` and use Conventional Commits, e.g.:
```
[AI] feat(db): introduce Dexie schema v1 and money helpers
```

## Project Conventions & Quality Gates

- **Money** stored as integer cents, typed helpers used everywhere.
- **Dexie** migrations versioned; any schema change requires migration + tests.
- **Workers** for heavy tasks (CSV parse, price sync, snapshots).
- **Idempotency** on imports via externalRef keys.
- **Accessibility**: keyboard focus, proper labels, high contrast.
- **Performance**: virtualize large tables; avoid main‑thread blocking.
- **Privacy**: local‑first, no secrets in client; optional proxy for Cardmarket later.

## Ready‑Made Templates (the AI may propose these files)

**1) Pull Request Template** — `.github/pull_request_template.md`
```markdown
## Summary

## Why

## Changes
-

## Testing
- Commands run
- Manual steps

## Screenshots (optional)

## Risks & Rollback

## CHANGELOG ENTRY
(Paste the entry for ai_docs/AI_CHANGELOG.md)
```

**2) Changelog file seed** — `ai_docs/AI_CHANGELOG.md`
```markdown
# AI Change Log
(Initialize this file; see format in the main instructions.)
```

## Task Intake Checklist (for the AI)

Before proposing changes, the AI should confirm:
- **Goal & Acceptance** criteria
- **Affected areas** (features, data, worker)
- **Inputs/fixtures** (sample CSVs/URLs)
- **Edge cases** (duplicates, large files, offline)
- **Telemetry** or logs required (dev‑only)

## Example: Small Changeset Proposal (skeleton)

```markdown
### Summary
Implement Dexie v1 schema and Money utilities.

### Rationale
Enables persistence and accurate currency math from the start.

### Changeset
- **Create** `src/data/db.ts` … (code block)
- **Create** `src/core/money.ts` … (code block)
- **Add** `tests/money.test.ts` … (code block)

### Migrations
v1 init; no prior data.

### Tests
- Unit tests for Money add/multiply/format.
- DB smoke test for table creation.

### Verification (run by human)
```bash
npm install
npm run test
npm run dev
```
Open the app; ensure no console errors and DB is created.

### CHANGELOG ENTRY (to append)
… (fill with today's timestamp and details)
```