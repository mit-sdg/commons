---
milestone: later
concepts:
  - Grading
  - Itemizing
  - Rostering
---

# Export the gradebook

## Current behavior

`/grades/export` returns a hard-coded empty CSV string. The frontend has no
workflow for downloading grade data.

## Unresolved decision

Define the CSV columns and their order, the row order, how missing and excused
grades appear, the character encoding and line endings, and the downloaded
filename. The export must derive from the authorized staff gradebook read.

## Acceptance condition

Tests confirm the settled columns, row order, missing and excused representations,
encoding, line endings, quoting of commas and line breaks, authorization, and
download filename for empty and populated courses.
