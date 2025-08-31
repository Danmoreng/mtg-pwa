# Working with the AI Assistant

This document explains how to work effectively with the AI assistant for the MTG Value Tracker project.

## Relationship to Project Documentation

This document complements the existing project documentation:
- **Project Plan** (`docs/project_plan.md`) - The master plan with all implementation steps
- **Implementation Status** (`docs/project-status.md`) - Current status and progress tracking
- **Implementation Summary** (`docs/implementation-summary.md`) - Technical overview of what's been built
- **Setup Complete** (`docs/setup-complete.md`) - Summary of the foundation work
- **Implementation Checklist** (`docs/implementation-checklist.md`) - Detailed checklist for tracking progress

## AI Collaboration Workflow

1. **Human-Centric Development**: The human developer sets up the environment, runs servers/builds, and performs manual testing.

2. **AI as Assistant**: The AI proposes designs, code changes, and tests; it does **not** execute commands.

3. **Clear Boundaries**: The AI never runs `npm run dev/build/test`. It may suggest commands and code, and provide verification steps.

4. **Traceability**: Every AI-proposed change is logged in the `AI_CHANGELOG.md` file.

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

## Code Contribution Format

When proposing changes, the AI replies with these sections:

1. **Summary** — 1–2 sentences of the goal.
2. **Rationale** — why this approach.
3. **Changeset** — file-by-file patches.
4. **Verification** — exact commands for the human to run, expected outputs, and manual UI checks.
5. **Changelog** — an entry to append to `docs/AI_CHANGELOG.md`.

## Changelog Discipline

Every AI proposal must include a changelog entry in `docs/AI_CHANGELOG.md` with the following format:

```markdown
## YYYY-MM-DD HH:MM — <short title>
- **Author**: AI (Qwen)
- **Scope**: files changed
- **Type**: feat | fix | refactor | chore | docs | test
- **Summary**: one-line description
- **Details**:
  - Bullet points of key changes
- **Impact/Risks**: migrations? data changes? perf?
- **Verification Steps**: commands + manual checks
```

## Commit Message Format

All AI-proposed commits should use the following format:

```
[AI] <type>(<scope>): <description>

<changelog entry>
```

Example:
```
[AI] fix(deck-import): resolve database constraint errors

## 2025-08-31 20:15 — fix: Resolve database constraint errors during deck import
- **Author**: AI (Qwen)
- **Scope**: src/features/decks/views/DeckImportView.vue
- **Type**: fix
- **Summary**: Fixed database constraint errors that occurred during deck import by removing duplicate card additions and using upsert for deck cards.
- **Details**:
  - Removed duplicate call to cardRepository.add(cardRecord)
  - Changed db.deck_cards.add to db.deck_cards.put to handle updates properly
  - This prevents constraint errors when importing the same deck multiple times
- **Impact/Risks**: Low risk changes that fix database constraint errors
- **Verification Steps**: 
  1. Import a deck from Moxfield text format
  2. Verify that no constraint errors occur
  3. Import the same deck again
  4. Verify that no constraint errors occur and the deck is updated properly
```

## Getting Started

1. Review the project structure and existing code
2. Identify the task or issue to be addressed
3. Propose a small, reviewable changeset
4. Specify human-run steps (commands & manual checks)
5. Provide complete code patches and tests
6. Prepare a changelog entry