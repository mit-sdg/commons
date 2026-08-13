# Executable concepts

Each directory implements one independent behavior whose authored specification
lives in [`design/concepts/`](../../design/concepts/). Implementations and helpers
do not import sync-engine; only `registry.ts` integrates the class with the
application.

A usual concept has:

- `<name>.ts` and `<name>.mongo.ts` for memory and MongoDB implementations;
- `errors.ts` for refusal classes;
- `registry.ts`, which imports `@design/concepts/Name.md`, registers the class,
  refusal classes, and named implementation floors; and
- a focused matching test at `tests/concepts/<name>.test.ts`.

[`../vocabulary.ts`](../vocabulary.ts) collects every registration in one
`conceptSet(...)` and exports the executable `concepts` and `vocabulary`. Query
cardinalities, action/query signatures, and refusal codes come from the registered
specification. Cross-concept relationships belong in
[`../compositions/`](../compositions/), never in a concept implementation.

Use [`template.md`](template.md) as an authoring aid, but place the completed
specification in `design/concepts/Name.md`. The ambient text declaration in
[`../text.d.ts`](../text.d.ts) supports the registry's design import.
