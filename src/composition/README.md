# The composition — how to read these files

This directory joins Commons' concepts with reactions, views, and formers.
At the application boundary, an endpoint specializes a reaction with an
outside trigger, path, input contract, correlation, and response. The source is
grouped by behavioral area.

## Follow one piece of behavior

Start with a reaction. When an item is purged, Commons asks Reacting to clear
the responses on that item:

_Source: [`forum/reactions.ts`](forum/reactions.ts)_

```ts
export const PurgeClearsReactions = reaction(({ item }) =>
  when(Trashing.purge({}).responds({ item })).then(Reacting.clearTarget({ target: item })),
);
```

`Trashing` and `Reacting` each describe one independent behavior under
[`../concepts/`](../concepts/). The reaction is the sentence between them: when
purging succeeds, ask Reacting to clear the target. Neither concept needs to
name the other.

A **view** answers a named question about standing state. Commons keeps its
permission views together in [`access/policy.ts`](access/policy.ts), including
the question `user may pin in scope`. A reaction can read that answer without
copying the permission policy.

A **former** shapes a complete answer for a caller. The pins former reads the
standing pins in a scope and produces the band a page displays:

_Read-back of [`forum/pins.ts`](forum/pins.ts)_

```
Form the pins of (scope) as follows:
  each Pinning._getPinned (scope) has (item, priority)
    where item is readable
    form a record of
      item
      priority
```

The former runs when asked. A scope with no pins produces an empty result.

At the application boundary, the pin endpoint uses the same reaction frame. It
receives the endpoint input, finds the session's user, checks permission and
readability, requests `Pinning.pin`, and correlates that outcome with the
response:

_Source: [`forum/pins.ts`](forum/pins.ts)_

```ts
export const PinItem = endpoint(
  "/pins/pin",
  ({ session, item, scope, priority, user, at, pin }) =>
    receive({ session, item, scope, priority })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayPinInScope({ user, scope }),
        readable({ post: item }),
      )
      .then(Pinning.pin({ item, scope, priority, at }).responds({ pin }))
      .then(respond({ pin })),
  { input: { required: ["session", "item", "scope", "priority"] } },
);
```

The concept specification explains a refusal in human terms. Stable refusal
codes and public categories form the caller's machine contract. The engine's
standard boundary funnel carries registered concept refusals. Commons authors
separate endpoint cases for policy and visibility answers such as `FORBIDDEN`
and `NOT_FOUND`.

## Choose an area

- [`access/`](access/) composes identity, sessions, roles, and permission
  policy.
- [`forum/`](forum/) composes discussions, reads, and moderation.
- [`course/`](course/) composes rosters, assignments, submissions, grades, and
  course operations.

Place a reaction beside the behavior it joins. Put a shared policy question in
the area's policy page, and put a shared former in the area that owns its
question. [`index.ts`](index.ts) is the manifest of included composition files;
[`../assembly/application.ts`](../assembly/application.ts) joins that manifest
to the concept set.

To change the composition, continue to [`AUTHORING.md`](AUTHORING.md). For the
framework's full authoring model and execution guarantees, use the sync-engine
guide and semantics documentation linked from the installed package's
`docs/README.md`.

To inspect how these sources read when assembled, use the
[`generated/` guide](../../generated/README.md). The read-back is derived
evidence; changes begin in the concept specifications and composition source.
