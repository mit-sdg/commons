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

Backend Vitest runs start one temporary MongoDB in `support/mongo-global.ts`.
`testDb()` gives each caller a unique database; `stopTestDb()` drops the file's
databases and closes its client, and global teardown stops the server. Keep the
`afterAll(stopTestDb)` hook in database suites. Deployment tests own a separate
server to exercise process and service lifecycles.

Temporary servers use `/dev/shm` when it is writable with at least 1 GiB free,
otherwise the ordinary temporary directory. Their cache is capped at 256 MiB.

Four thread workers reuse imported modules between files. Keep mutable
application state in fixtures and give destructive scenarios fresh databases.
Vitest restores spies and environment/global stubs between tests; restore
direct changes to process globals in `finally` blocks. Reuse `beforeAll`
fixtures for probes that preserve their shared accounts and policy.

Assembled read-backs, wire contracts, and transcripts are test evidence.
Change their authored concept or composition source and regenerate them; do not
edit a generated fixture to change behavior.

Keep experimental prompt runners, candidate prompts, raw model replies, traces,
and dated rehearsal reports outside the tracked tree. Local outputs belong in
`test-results/`. Retain focused regression tests for shipped behavior; fixtures
used by those tests belong beside the tests, independent of experiment archives.
