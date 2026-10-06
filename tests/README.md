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

Up to five thread workers reuse imported modules between files. Keep mutable
application state in fixtures and give destructive scenarios fresh databases.
Vitest restores spies and environment/global stubs between tests; restore
direct changes to process globals in `finally` blocks. Reuse `beforeAll`
fixtures for probes that preserve their shared accounts and policy.

The test setup caches only the Commons transport's immutable route and wire
declarations, once per endpoint surface per run, through a disposable shared
projection directory. Applications, gateways, authorization, and invokers remain real
and independent. Artifact and repository inspections still derive the complete
production design. Occurrence-only checks use `support/occurrences.ts` and the
engine's redacted log sink instead of rebuilding design diagnostics. These test
journals retain all entries in a scenario; they do not model the native
inspector's bounded history. Reset them when restoring an occurrence fixture.

`support/fixtures.ts` can retain an application's compiled declarations and
database indexes while clearing or restoring its stored state between tests.
Wait for `whenIdle()` before restoring a world, reset custom fault gates and
clocks, and keep separate applications for occurrence-history and reassembly tests.
Restoration clears native query caches and attaches fresh transport state to the
fixture edge so captured request closures cannot retain a renewal ledger.

`support/world-pool.ts` explicitly reuses ordinary worlds within a worker, with
a separately owned Mongo client and fresh gateway/HTTP state for every borrower.
Callers must run sequentially; keep multi-app, fault, and custom-clock scenarios
on separate fixtures. Focused HTTP surfaces in `support/domain-world.ts` retain
**every production reaction, view and former**, including reactions belonging
to other domains, while selecting the endpoint domains a suite exercises. A
guard compares every non-endpoint reaction with the full application and every
selected route with native and full bindings. Query-cost guards, cross-domain
boundary evidence and every wire transcript still use the whole application.
Password fixtures opt into scrypt N=16 through the explicit test hook; the
production default remains N=16384, also checked in the real deployment process.

Assembled read-backs, wire contracts, and transcripts are test evidence.
Change their authored concept or composition source and regenerate them; do not
edit a generated fixture to change behavior.

Keep experimental prompt runners, candidate prompts, raw model replies, traces,
and dated rehearsal reports outside the tracked tree. Local outputs belong in
`test-results/`. Retain focused regression tests for shipped behavior; fixtures
used by those tests belong beside the tests, independent of experiment archives.
