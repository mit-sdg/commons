# Assembly

This directory selects Commons' concept implementations, HTTP credentials,
and process lifetime. The installed sync-engine package's
[`docs/guide/application-boundary.md`](https://github.com/mit-sdg/sync-engine/blob/HEAD/docs/guide/application-boundary.md)
teaches the framework's application boundary.

The five files have separate jobs:

- `application.ts` joins the concept set to the explicit composition manifest.
  Ordinary feature work does not edit it.
- `concept-floor.ts` selects the memory or MongoDB implementations and owns the
  MongoDB client.
- `http-floor.ts` declares Commons' credential binding.
- `process.ts` starts the edge and closes the selected concept floor.
- this page routes configuration and states the boundary.

## Concept state

The process uses the in-memory implementations unless the environment selects
MongoDB. With MongoDB selected, Commons opens the configured database, closes
the client when the process stops, and never drops the supplied database. The
exact variables and accepted forms live in [`.env.example`](../../.env.example).

Use one Commons process per MongoDB database. If a deployment needs concurrent
processes, follow the work recorded in
[`../../content/issues/open/mongo-multiprocess-integrity.md`](../../content/issues/open/mongo-multiprocess-integrity.md).

Tests may pass an override to `assembleCommons`. An override replaces an
implementation already selected by the application; it is not another
production floor.

## HTTP credential

Commons declares one logical credential named `session`. A successful
`/auth/login` returns the credential and its `expiresAt` value to the HTTP
floor, which consumes both fields when it issues the cookie. Successful
`/auth/logout` and `/auth/changePassword` calls clear it. Any endpoint whose
declared input includes `session` is protected automatically, so adding a
protected endpoint does not change `http-floor.ts`.

The browser contract omits the cookie-bound `session` input and the consumed
login outputs. The transport-independent application interface retains those
fields. Commons also supplies the public browser origin. [`.env.example`](../../.env.example)
contains the exact setting.

The engine's [boundary semantics](https://github.com/mit-sdg/sync-engine/blob/HEAD/docs/semantics.md#boundary-gateway-and-client)
owns the HTTP, cookie, serialization, and transport guarantees. Its
[operations guide](https://github.com/mit-sdg/sync-engine/blob/HEAD/docs/consistency-and-operations.md)
states the deployment limits.

Use the sync-engine package's
[`floorReadBack`](https://github.com/mit-sdg/sync-engine/blob/HEAD/docs/public-surface.md#tooling)
tooling to inspect the selected concept implementations, shared resources, and
credential binding without adding HTTP details to the assembled application
read-back.
