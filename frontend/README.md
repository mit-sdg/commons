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

## Interface conventions

Two rules every screen follows, so the next screen has one place to read.

- **Copy states invisible state or an input contract, and nothing else.** A
  sentence on a screen says what the reader cannot see (the model is sorting,
  the run is locked, nothing was asked) or what a box takes; it never narrates
  a control the reader can see or explains what a press will do. Show the
  thing instead of saying it.
- **Each kind of fact has one form.** Facts on one line are never joined
  by a middle dot, and a gap alone is not enough either: a line is read by
  the forms of its facts, not by its separators. The `Facts` line in
  `src/components/facts.tsx` is typed, and every child names its kind:
  - `Fact.Kind` — the kind of a thing (essay, quiz, student, a role): a
    quiet tag, small, uppercase, muted, no fill (`Tag` in
    `src/components/tag.tsx`). It qualifies a title; it is never a word
    among metadata.
  - `Fact.Status` — a state (pending, archived, submitted, queued): a
    filled badge, the only filled element in a row (`StatusBadge`). A
    status is never also printed as a word.
  - `Fact.When` — when something came to be (sent, posted, queued,
    flagged): relative, muted, last on its line, the absolute on hover; the
    verb only when it is not obvious. A row that is a record (an attempt, a
    note) takes `form="absolute"`.
  - `Fact.Due` — a due or scheduled time: the absolute in the text colour
    with the class zone, then the countdown muted, a tighter gap.
  - `Fact.Range` — opened to closed: one span with an en dash, the day not
    repeated when it is the same; open-ended reads "since …".
  - `Fact.Count` — number and noun in tabular figures. Like counts keep the
    gap between them, because they are alike.
  - `Fact.Where` — where a thing lives: muted, "in Course Launch Tasks".
  Absolute times drop the year in the current year and the zone everywhere
  but due lines (`dateTime`, `dueTime`, `rangeTime` in `src/lib/format.ts`).
  A fact inside a sentence takes a comma: "Ran 3 times, last on Sep 4". A
  list of like things may take a separator, because it is then the list's
  own form: prose words a comma phrase, things chips, and student answers
  that may hold commas quiet chips. A card's part and its value are a label
  and its text, never one string.

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
repository root and rewrites `/api/*` to the edge. The unlinked `/setup` page
uses the generated `/setup/register-admin` endpoint like every other browser
surface.

Account changes reset cached presentation and local drafts. The initial session
check finishes before form inputs appear, including on public entry pages, so
session initialization cannot erase a draft entered under a provisional identity.

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
