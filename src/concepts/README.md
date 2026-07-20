# Concepts

Each directory here specifies and implements one independent behavior. Its
implementation and helpers import no sync-engine API. Start
with its `spec.md`: the purpose and principle explain the behavior, while the
state, actions, and questions state what it can know, what can happen, and what
callers may ask. Concept code does not name another concept. Relationships
between behaviors belong in
[`../composition/`](../composition/).

## Folder shape

A usual concept directory contains:

- `spec.md` — the four-part specification, plus any standing queries;
- `<name>.ts` — the in-memory implementation;
- `<name>.mongo.ts` — the MongoDB implementation with the same public methods;
- `<name>.test.ts` — one suite run against both implementations;
- `errors.ts` — refusal classes, when an action can refuse;
- `registry.ts` — the one application-integration seat for the class,
  specification, query promises, refusals, public categories, and named floor
  implementations.

[`template.md`](template.md) is the specification template. Copy it into a new
directory as `spec.md`, replace every marked part, then add the implementation
files beside it. The ambient declaration in [`../text.d.ts`](../text.d.ts)
lets each registry import its Markdown specification as text.

Register a finished concept beside its implementation, then add its registry
to the explicit concept set in [`index.ts`](index.ts). That set derives the
vocabulary, implementation types, default instances, MongoDB instances, and
public refusal inventory. The concept's test should use
[`testing.ts`](testing.ts) to exercise the memory and MongoDB implementations
with the same assertions.

The refusal sentence in `spec.md` is the human explanation of why an action can
decline. The registry gives that refusal its stable code and public category for
callers. An implementation may add private context while constructing the
refusal, but any detail exposed to a caller must agree with the specification.

A helper belongs inside one concept's directory when only that behavior needs
it, as `authenticating/password-verifier.ts` does.
