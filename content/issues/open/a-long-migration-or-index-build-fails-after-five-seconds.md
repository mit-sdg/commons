---
milestone: later
concepts: []
---

# A long migration or index build fails after five seconds

## Current behavior

`connectMongo` in `src/assembly/concept-floor.ts` sets `socketTimeoutMS:
5_000` on the one MongoDB client every concept reads through. A request read
on a stuck database then fails inside the request deadline, and the reads
batched with it are retried one at a time.

Two kinds of slow command share that client.

- **Migrations.** `src/assembly/process.ts` passes `floor.database` to
  `runMigrations`. A migration step that runs longer than 5 s, such as an
  `updateMany` over a large collection or an index build, fails with a socket
  timeout, and the process exits before it serves.
- **Index builds.** Most concepts build their indexes on first use, through the
  same client. A build wrapped in `speedIndexes` (`src/concepts/indexes.ts`)
  logs a warning when it fails, and reads continue without the index. Several
  unique-index builds are not wrapped: the build's promise is stored in a field
  with `??=`, and `Authenticating.register`, for one, awaits `this.index`. If that
  build times out, the rejected promise stays in the field, and every later
  `register` call throws until the process restarts.

Neither case occurs while no migration is pending and every index already
exists. A release that adds a migration, or a new index on a large collection,
will hit the timeout.

## Unresolved decision

How slow administrative commands escape the request timeout:

- A second client with no socket timeout, used for `runMigrations` and handed
  to every concept for its index builds. This changes about twenty concept
  constructors.
- The driver's per-operation `timeoutMS` in place of `socketTimeoutMS`, set
  for request reads and turned off for migrations and index builds. This
  changes how a request read times out, and some of the driver's `timeoutMS`
  options are still marked experimental.

Whether a unique index whose build fails should be retried on the next call,
rather than failing that call until restart, is part of the same decision.

## Acceptance condition

A migration step and an index build that each run longer than 5 s complete,
and startup continues. A request read with no reply still fails within 5 s.
