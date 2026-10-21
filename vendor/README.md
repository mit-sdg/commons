# Vendored sync-engine 1.2.0 candidate

These four packages are the sync-engine 1.2.0 release candidate, packed before
1.2.0 is on npm. They let Commons build and test its move to 1.2.0 ahead of
publication. Once 1.2.0 is published, this folder is deleted and
`package.json` points back at the registry.

- Source: `mit-sdg/sync-engine` commit `790a65dc1d8967fd76bf7bd82740d3c8395f1440`,
  branch `batched`.
- Checksums: [`SHA256SUMS`](SHA256SUMS). `bun.lock` also records each file's
  integrity, so a changed file fails the frozen install.

To rebuild them and check they match, with Bun 1.3.14:

```sh
git -C <sync-engine clone> archive 790a65dc1d8967fd76bf7bd82740d3c8395f1440 | tar -x -C <empty dir>
cd <empty dir>
bun install --frozen-lockfile && bun run build
for d in . packages/analysis packages/catalog packages/http; do (cd $d && bun pm pack --destination <out dir>); done
cd <out dir> && shasum -a 256 *.tgz   # compare with SHA256SUMS
```

Bun caches a local tarball by its path, not its contents, so after replacing a
file here with one of the same version, delete the cached copies
(`~/.bun/install/cache/@T@*` holding `@mit-sdg/sync-engine` at that version)
and `node_modules/@mit-sdg/sync-engine` before installing, or the old build
stays installed. A clean install, as in CI and a deploy, checks the file against
`bun.lock` and is not affected.
