# Authoring the composition

The TypeScript in this directory is the design language's authoring form. This
guide covers Commons' placement, registration, and commentary rules.

## Placement

A concept action or query belongs to the concept that owns the behavior.
A reaction belongs in the composition area whose behavior it joins. Shared
policy questions live in that area's policy page, and shared formers live in
the area that owns the answer. Keep the complete concept promise in `spec.md`;
composition source relies on it without restating it.

## The constructions

The installed sync-engine package's `docs/README.md` routes the guide,
semantics, and API reference. Use the guide to learn constructions, semantics
for their guarantees, and the API reference for callable names and signatures.
This page states only Commons' placement and registration choices.

## Write your first reaction

To add behavior, export a `reaction()` from a composition file. The assembly
registers each tagged export under its dotted name. An existing composition
file needs no additional registration. For a minimal reaction, see
[`forum/reactions.ts`](forum/reactions.ts), which clears a target's emoji
reactions when it is purged:

```ts
export const PurgeClearsReactions = reaction(({ item }) =>
  when(Trashing.purge, {}, { item }).then(request(Reacting.clearTarget, { target: item })),
);
```

Adding an export to a composition file that is already assembled is all it
takes. A brand-new file has one more step: add it to `assembleCommons`'s
explicit manifest in [`index.ts`](index.ts) — one namespace import and one
entry. The manifest keeps the decision to include behavior visible, while
[`../assembly/application.ts`](../assembly/application.ts) stays unchanged.

## Commentary

The language states behavior completely, so comments do not restate what a
reaction does. If a reaction needs an explanation, name the view, split the
reaction, or rename the binding until the reaction can be read directly.

Composition source has one prose seat: a short question immediately above a
view or former. The body answers that question, so the comment never explains
the plan. Reactions, including endpoint specializations, use their exported
names as their explanation. Repository and directory guides orient readers
outside the TypeScript source; concept specifications own behavior and refusal
meaning.

Everything else has a better home. A fact the composition relies on — a query
answering exactly one row, a promised order — belongs to the owning concept's
return type or specification and is relied on without being restated here. A
deliberate absence is designed, not annotated: where a gate is deliberately
open, author the permissive view beside the others, so the choice is visible on
the policy page itself. Record each known limitation in its own file under
[`content/issues/`](../../content/issues/), with a plain acceptance condition.
