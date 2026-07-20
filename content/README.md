# Commons content

This directory holds Commons' application-owned content, written so Commons
can render it in the application. Product and operational issues live in
[`issues/`](issues/), nested under `open/`, `decided/`, and `done/`. The
directory states where the issue stands, and the filename is its stable
identity.

The `repository-release` milestone covers work required before publishing the
repository. The `public-deployment` milestone covers work required before
people rely on a hosted instance. `later` records improvements that do not gate
either release. The records in each state directory show what remains.

`open` means the desired behavior or acceptance condition still needs design.
`decided` means both are settled but the work may be unfinished. `done`
preserves the resolution, decision, and verification that closed the issue. A
done record is release history, not the current behavioral contract. Concept
specifications and composition state authored behavior. The
[generated-artifact guide](../generated/README.md) names the registered
implementation and provenance inputs for each derived contract.

## Record format

Each issue has only two frontmatter fields:

```yaml
milestone: public-deployment
concepts:
  - Grading
```

An open record states current behavior, the unresolved decision, and its
acceptance condition. A decided record states current behavior, desired
behavior, and its acceptance condition. A done record keeps the resolution at
completion, the decision at completion, and the verification performed.

Run `bun run issues:check` from the repository root to validate the issue
files. The same validation runs as part of `bun run test` and `bun run check`.
