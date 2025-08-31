# Working with the AI Assistant

This document provides guidelines for collaborating with the AI assistant on this project.

## How to Work with the AI

1. The AI proposes code changes, documentation updates, and implementation suggestions
2. All code changes must be reviewed and applied manually by the human developer
3. The AI never runs build commands, dev servers, or tests - these are always done by the human
4. Every AI-proposed change includes a changelog entry that should be appended to `docs/AI_CHANGELOG.md`

## Change Log Format

Every AI proposal must include a changelog entry with this format:

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
- **Linked Task/Issue**: optional
```

## Commit Message Format

All commits that include AI-proposed changes should use this format:

```
[AI] <type>(<scope>): <description>

<changelog entry>
```

Example:
```
[AI] feat(import): add Moxfield deck import functionality

### CHANGELOG ENTRY (to append)
## 2025-08-31 15:00 — feat: Add Moxfield deck import functionality
- **Author**: AI (Qwen)
- **Scope**: src/features/decks/DeckImportService.ts, src/features/decks/views/DeckImportView.vue
- **Type**: feat
- **Summary**: Implement Moxfield deck import using text format.
- **Details**:
  - Added DeckImportService with importDeckFromText method
  - Created DeckImportView with textarea for pasting decklists
  - Updated router with new import route
- **Impact/Risks**: No schema changes required.
- **Verification Steps**: npm run build; npm run dev; paste Moxfield decklist in import view.
- **Linked Task/Issue**: Milestone 1
```