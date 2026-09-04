# Commons

Commons is a learning-management application composed from independent concepts,
cross-concept reactions, current-state views, and response formers. The HTTP edge,
web frontend, command-line scenario, and generated client contract all run the same
sync-engine assembly.

## Run Commons locally

Commons requires Bun 1.3. Install dependencies and start the full local stack with a single command:

```sh
bun install && bun install --cwd frontend
bun dev
```

`bun dev` automatically boots a local MongoDB database, the backend edge server at `http://127.0.0.1:4000`, and the Next.js web frontend at `http://127.0.0.1:3000` with live reload. Press Ctrl-C once to stop the frontend, edge, and database cleanly.

Local development is served over plain `http://`, and the session cookie is a `__Host-` cookie marked `Secure`. Chromium-family browsers (Chrome, Edge, Arc, Brave) treat `127.0.0.1` as a secure origin and hold the session; Safari follows the cookie specification and drops it, so signing in against `bun dev` from Safari, or from a phone on the same network, does not hold a session. Use a Chromium browser for local development; a deployment, which is served over `https://`, holds a session in every browser.

If `MONGODB_URL` is set in your environment or `.env`, `bun dev` connects to your external database instead of creating a temporary one. For production, deploy using [`platform.yaml`](platform.yaml) or refer to the [deployment guide](DEPLOYMENT.md).

## Read and change the design

Authored behavior and executable behavior have separate application-owned homes:

- [`design/concepts/`](design/concepts/) contains each independent concept
  specification; matching implementations live under [`src/concepts/`](src/concepts/).
- [`design/compositions/`](design/compositions/) gives each registered Access,
  Course, and Forum behavior module one focused explanation; helper-only views
  and constants remain implementation details under [`src/compositions/`](src/compositions/).
- [`design/application.md`](design/application.md) records application types, the
  concept instance inventory with its external bindings, and computations;
  [`src/concepts.ts`](src/concepts.ts) owns executable registrations.
- [`src/assembly/`](src/assembly/) selects implementations and deployment policy.
- [`frontend/`](frontend/) consumes only the generated browser contract.

Start with the [forum thread explanation](design/compositions/forum/threads.md)
and one concept specification such as [Posting](design/concepts/Posting.md).
The [task-list explanation](design/compositions/tasks/lists.md) shows how a
behavior reuses an existing concept under a second registered instance.
Composition pages use typed links such as
`[CreateThread](reaction:Forum.threads.CreateThread)` to identify exact
registered declarations. The [generated artifact guide](generated/README.md) explains the
derived read-back and wire contract.

## Verify changes

```sh
bun run check
bun run test
bun run build
```

`check` validates the authored Markdown with `sync-engine check-design`, runs the
registration-driven `sync-engine check --config generated.config.ts`, verifies
generated artifacts and issue records, and then runs root and frontend static
checks. Use `bun run artifacts pin` after changing
registered design or composition, and review the resulting files under
[`generated/`](generated/).
