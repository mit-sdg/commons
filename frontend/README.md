# Commons frontend

This Next.js application is Commons' web surface. It calls Commons' HTTP
edge through the generated application contract, so page code and application
declarations share endpoint inputs and outputs.
[`AGENTS.md`](AGENTS.md) records the checks for anyone changing it.

The frontend uses Next.js 16 App Router, React 19, Tailwind v4, Radix UI, and
shadcn-style components.

## Layout

- **`src/app/`** contains one route per surface: discussions, profiles,
  moderation, assignments, grades, calendars, rosters, notes, and account
  settings.
- **`src/components/`** contains shared application components at its root,
  forum and course components in their named directories, and reusable
  primitives under `ui/`.
- **`src/lib/` and `src/hooks/`** contain the application client, loaders,
  projections from endpoint outputs, and query hooks.

## Application contract

`src/lib/api.ts` is the UI's one Commons client boundary. Its `Input<P>` and
`Output<P>` types project each endpoint's request and success types directly
from `CommonsBrowserWire`. Calls return the declared success body or an
`{ error: string }` envelope.

Page code may use grouped calls such as `api.threads.latest(input)` or an indexed
path such as `api["/threads/latest"](input)`. View-model types in
`src/lib/models.ts` project directly from endpoint outputs, so the frontend
typecheck points to the page that misuses a response.

Only the root application client imports `@mit-sdg/sync-engine-http/client`;
its shared client type comes from `@mit-sdg/sync-engine/client`.
`next.config.ts` admits that client and the generated contract from the
repository root and rewrites `/api/*` to the edge.

## Running

Start the frontend with the rest of Commons from the repository root as
described in the root [README](../README.md). The browser always calls a
same-origin `/api/*` path, which Next rewrites to the edge. If the edge runs at
a different origin, configure the rewrite through [`.env.example`](../.env.example).

The frontend scripts use Next's webpack builder so local Bun `file:` package
links resolve in development and production builds.

## Contract boundaries

The generated module is the frontend's TypeScript contract. Page code does not
invent parallel request, response, or error types. Returned dates arrive as
JSON strings, as the generated types show.

Failures have four homes. A concept specification gives each refusal its human
meaning. The concept registry assigns the stable code and public category. The
generated browser wire lists the route-specific union a caller handles.
`src/lib/api.ts` maps those public categories to reader-facing messages.

The sync engine's [semantics documentation](https://github.com/mit-sdg/sync-engine/blob/HEAD/docs/semantics.md)
owns runtime validation, serialization, gateway, and HTTP guarantees. The
generated artifact guide at
[`../generated/README.md`](../generated/README.md) explains how Commons derives
and regenerates its browser wire.
