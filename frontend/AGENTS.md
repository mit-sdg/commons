# Working on this frontend

[`README.md`](README.md) explains the frontend's structure and application
boundary. Follow the framework constraint and verification commands below for
every change.

<!-- BEGIN:nextjs-agent-rules -->
# Next.js version constraint

This repository uses Next.js 16. Read the relevant guide in
`node_modules/next/dist/docs/` before changing framework code, and follow its
deprecation notices.
<!-- END:nextjs-agent-rules -->

## Mandatory: all checks green — zero errors, zero warnings

Before pushing or declaring work done, run both commands. No exceptions for
warnings.

```bash
bun run check       # typecheck + lint + format-check (the static gate)
bun run test        # unit tests scoped to src/
```

For a focused diagnosis, run a component command:

```bash
bun run typecheck   # TypeScript type-checking
bun run lint        # Lint (eslint)
biome check src/    # Format check (local @biomejs/biome; add --write to fix in place)
```

### Common mistakes

| Wrong | Right |
|-------|-------|
| `bun test` (tests everything) | `bun run test` (uses scoped npm script) |
| `npx biome …` (pulls an unrelated `biome@0.3.3`) | `biome check src/` (the local `@biomejs/biome` devDependency) |
| `biome lint .` | `bun run lint` (eslint, not biome) |
| Skip warnings | Zero warnings required |
