---
milestone: public-deployment
concepts:
  - Assigning
---

# Preserve local wall time in assignment controls

## Current behavior

Assignment form defaults and existing values pass through `toISOString()`
before entering `datetime-local`. The control therefore shifts the displayed
wall time by the browser's UTC offset.

## Desired behavior

The control displays local date and time. Conversion to a UTC instant happens
only when the value crosses the application boundary, and stored instants
convert back to the same local wall time.

## Acceptance condition

Frontend tests run in at least two non-UTC offsets and confirm create and edit
round trips for available, due, and close times.
