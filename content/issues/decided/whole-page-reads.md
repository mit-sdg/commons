---
milestone: later
concepts:
  - Assigning
  - Banking
  - Conversing
  - Grading
  - Profiling
  - Subscribing
---

# Use the declared whole-page formers

## Current behavior

Commons declares formers for the home feed, user page, gradebook matrix,
watched threads, and late-day uses. Some pages issue several smaller requests
to assemble data already available in one formed answer.

## Desired behavior

Each page asks once for its declared former. It does not reconstruct the formed
answer from separate browser requests or make one request per row.

## Acceptance condition

Each page has one typed request for its formed answer, preserves its visible
behavior, and has no browser-side join or per-row request for that answer.
