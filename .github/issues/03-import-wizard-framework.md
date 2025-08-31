---
name: "M2: Import Wizard Framework"
about: "Create the framework for importing CSV files"
title: "Implement Import Wizard Framework"
labels: ["milestone-2", "ui", "import"]
assignees: ""
---

## Description

Create the import wizard framework as specified in the project plan:

1. Create `src/features/imports/wizard` components: `FileDrop.vue`, `CsvPreview.vue`, `ColumnMapper.vue`, `Summary.vue`
2. Create CSV worker utilities `workers/csvCommon.ts`
3. Tests: parse sample CSVs, preview mapping

## Acceptance Criteria

- [ ] FileDrop component allows CSV file selection
- [ ] CsvPreview component shows parsed data
- [ ] ColumnMapper component allows field mapping
- [ ] Summary component shows import results
- [ ] CSV worker utilities parse files in background
- [ ] Unit tests pass for CSV parsing