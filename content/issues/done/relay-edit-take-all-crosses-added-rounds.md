---
milestone: repository-release
concepts:
  - Questioning
  - Relaying
  - Suggesting
---

# Take every offered line at once without crossing the added rounds

## Resolution at completion

Accepting every line of an offering is one request per line, in the
offering's order. The endpoint that took every pending line in one request is
gone: the asks that add a round read their line back through the request that
took it, so two lines taken in one request read each other's, and three added
rounds became ninety-eight legs. A line refused by a concept stops the panel's
loop and is reported on its own; the lines after it stay pending.

## Decision at completion

A taken line is one flow. Any reaction that applies a line in more than one
ask reads the line back only through its own request; the wall's `open` line
became one ask (`Piling.file`) for the same reason.

## Verification at completion

The relay-editing test takes each add line on its own request and reads back
exactly the drafted rounds, each carrying its title, prompt, parts, choices,
takes, and position; the computation tests cover the lines by number and by
position.
