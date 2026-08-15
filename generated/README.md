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

The generated descriptor names `src/concepts.ts`; the wire generator emits a
type-only import of that module to reach the registered concept signatures. `CommonsWire` keeps the logical application contract
for local clients. `CommonsWireHttp` applies the HTTP floor for browser calls,
omitting its cookie-bound session input. Both project values through JSON, so a
`Date` leaf is emitted as `string`. Strict leaf checking stops generation when
any input or output leaf has no known source. The generated module is a
compile-time contract; it does not validate response values at runtime.

Change the authored sources, not these files. Files under
[`design/concepts/`](../design/concepts/) own concept contracts, including query
cardinalities and refusal explanations. Files under
[`design/compositions/`](../design/compositions/) correspond to registered
behavior modules in [`src/compositions/`](../src/compositions/) and explain each
executable reaction in causal prose. Helper-only source modules have no separate
design page.

The read-back omits each concept's full State, Actions, and Queries prose. Those
sections remain in its design specification; the read-back shows what the
running registered assembly can derive.

Reaction headings sometimes carry a stable path label and a generated step
suffix. `Name:found` is the sibling path labeled `found`. `Name:found#2` is its
second consequence step after the engine lowers the chain into executable
reactions. The path label survives source reordering; the step suffix records
temporal position within that path. The trigger, conditions, and consequence
printed beneath the heading state its behavior.
