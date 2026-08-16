# Commons

Commons is a learning-management application composed from independent concepts,
cross-concept reactions, current-state views, and response formers. The HTTP edge,
web frontend, command-line scenario, and generated client contract all run the same
sync-engine assembly.

## Run Commons locally

Commons requires Bun 1.3 and installs the published sync-engine core and HTTP
packages at the versions pinned in [`package.json`](package.json). Install both
application packages, then start the MongoDB-backed stack:

```sh
bun install
bun install --cwd frontend
bun run stack:mongo
```

The application opens at `http://127.0.0.1:3000`. Press Ctrl-C once to stop the
frontend, edge, and temporary MongoDB cleanly. The first run may download the
MongoDB binary. Use `bun run stack` instead when `MONGODB_URL` names an
operator-owned database; [`.env.example`](.env.example) lists runtime settings.
For production, deploy one application image with an operator-managed MongoDB or
run the complete Coolify Compose resource by following the
[deployment guide](DEPLOYMENT.md).

## Read and change the design

Authored behavior and executable behavior have separate application-owned homes:

- [`design/concepts/`](design/concepts/) contains each independent concept
  specification; matching implementations live under [`src/concepts/`](src/concepts/).
- [`design/compositions/`](design/compositions/) gives each registered Access,
  Course, and Forum behavior module one focused explanation; helper-only views
  and constants remain implementation details under [`src/compositions/`](src/compositions/).
- [`design/application.md`](design/application.md) records application types and computations;
  [`src/concepts.ts`](src/concepts.ts) owns executable registrations.
- [`src/assembly/`](src/assembly/) selects implementations and deployment policy.
- [`frontend/`](frontend/) consumes only the generated browser contract.

Start with the [forum thread explanation](design/compositions/forum/threads.md)
and one concept specification such as [Posting](design/concepts/Posting.md).
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

`check` runs the registration-driven
`sync-engine check --config generated.config.ts`, verifies generated artifacts
and issue records, and then
runs root and frontend static checks. Use `bun run artifacts pin` after changing
registered design or composition, and review the resulting files under
[`generated/`](generated/).
