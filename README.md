# Commons

Commons is a learning-management application written as concepts, reactions,
views, and formers. Its behavior is data that people can read and the
[sync engine](https://github.com/mit-sdg/sync-engine) can run. The web frontend,
command-line tools, and other clients use the same application contract.

**New here? Start with
[`src/composition/README.md`](src/composition/README.md).** It follows one piece
of behavior from a reaction through a view, a former, and the application
boundary.

- **Concepts** describe independent behaviors such as posting and grading.
- **Reactions** join behaviors by asking for a consequence when something
  happens.
- **Views** answer named questions about how things stand.
- **Formers** shape complete answers for screens and other callers.

## Run Commons locally

Commons depends on a sibling checkout of the sync engine through
`file:../sync-engine`. Build that checkout, install both Commons packages, and
start the stack:

```sh
cd ../sync-engine && bun install && bun run build
cd ../learning && bun install && bun install --cwd frontend
bun run stack:mongo
```

The application opens at `http://127.0.0.1:3000`. Press Ctrl-C once to stop the
stack. The first run may download the temporary MongoDB binary.

For a different state floor or browser origin, use [`.env.example`](.env.example)
and the [`src/assembly/` guide](src/assembly/README.md). [`package.json`](package.json)
lists the repository commands.

## Choose a path

- To understand the application, follow the
  [composition guide](src/composition/README.md), then read one behavior through
  the [concept guide](src/concepts/README.md).
- To run or change its boundaries, use the
  [assembly guide](src/assembly/README.md) and the
  [frontend guide](frontend/README.md).
- To verify a change, use the [test guide](tests/README.md) and inspect the
  [derived assembled read-back](generated/README.md).
- To review product and deployment work, use the [issue source](content/README.md).
