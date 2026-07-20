# Generated read-back and wire contract

Two files here are generated from the running application and checked in as
goldens; neither is ever edited by hand.

- **`commons.md`** — the assembled read-back. It combines each concept's
  purpose and principle, the action and query promises exposed by its
  registered implementation, and every registered reaction, view, and former.
  It is derived evidence, not a handbook or the full authored specification.
  Regenerate it with `bun run spec:pin`.
- **`wire.ts`** — the typed wire contract: one `{ input; output; error }`
  per endpoint. Inputs follow concept action parameters; outputs follow action
  results and query rows through formers; error unions follow stable refusal
  codes and boundary categories. Regenerate it with `bun run wire:pin`.

The test and check commands compare both files byte-for-byte with fresh output.
Regenerate a file when its source changes and review the resulting diff.

The wire generator uses a type-only import of `src/concepts/index.ts` to reach
the concept signatures. `CommonsWire` keeps the logical application contract
for local clients. `CommonsWireHttp` applies the HTTP floor for browser calls,
omitting its cookie-bound session input. Both project values through JSON, so a
`Date` leaf is emitted as `string`. Strict leaf checking stops generation when
any input or output leaf has no known source. The generated module is a
compile-time contract; it does not validate response values at runtime.

Change the authored sources, not these files. Each concept's `spec.md` owns its
behavioral contract, including the human explanation for each refusal. The
files under [`src/composition/`](../src/composition/) own Commons' reactions,
views, and formers. Start with the composition guide to learn how those sources
fit together.

The read-back omits each concept's full State, Actions, and Questions sections.
Those sections remain in its `spec.md`; the read-back shows only what the
running assembly can derive and register from the authored sources.

Reaction headings sometimes end with generated positional suffixes. `Name:2`
is the second declaration in one endpoint partition. `Name#2` is the second
step in one reaction's consequence chain after the engine lowers that chain
into executable reactions. A heading such as `Name:2#2` combines both. The
suffix distinguishes registered reactions; the trigger, conditions, and
consequence printed beneath the heading state its behavior.
