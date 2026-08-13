# Tests

Focused concept tests live under `tests/concepts/`, matching the executable
concepts under `src/concepts/`, and exercise the production implementations
against temporary MongoDB. The application-wide suites also live here:

- `app/` exercises assembled behavior through the application or its edge,
  including both floor constructions and the Commons scenario.
- `edge/` exercises HTTP transport policy and the failures allowed across that
  boundary.
- `repository/` checks source structure, issue records, package imports, and
  generated-design invariants.
- `wire/` replays complete request and response transcripts. Its shared
  runner is `support/wire.ts`.

New tests go in the narrowest of these homes that can state the question
without duplicating a concept's own suite.

Assembled read-backs, wire contracts, and transcripts are test evidence.
Change their authored concept or composition source and regenerate them; do not
edit a generated fixture to change behavior.
