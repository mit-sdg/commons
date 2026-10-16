# Vendored sync-engine 1.0.0-beta.18

These four packages are sync-engine 1.0.0-beta.16 plus opt-in concurrent reads
(`concurrentReads`, which Commons turns on with `READ_AHEAD`) and the opt-in
`queryCache: "since-dispatch"` (which Commons turns on with `QUERY_CACHE`). They
are not on npm. They are a stopgap until Commons moves to an npm release of
sync-engine that includes both; that move deletes this folder and points
`package.json` back at the registry.

- Source: `mit-sdg/sync-engine` commit `febe16a99a5d19cb4fd3767337f1e0fb7fc24e6f`
  ("Refresh each ask's reads where refresh always ran, ..."), branch `cache-since-dispatch`, which is
  `v1.0.0-beta.16` plus the read-ahead and query-cache commits. The npm `beta`
  and `latest` tags never carry this version.
- Checksums: [`SHA256SUMS`](SHA256SUMS). `bun.lock` also records each file's
  integrity, so a changed file fails the frozen install.

To rebuild them and check they match, with Bun 1.3.14:

```sh
git -C <sync-engine clone> archive febe16a99a5d19cb4fd3767337f1e0fb7fc24e6f | tar -x -C <empty dir>
cd <empty dir>
bun install --frozen-lockfile && bun run build
for d in . packages/analysis packages/catalog packages/http; do (cd $d && bun pm pack --destination <out dir>); done
cd <out dir> && shasum -a 256 *.tgz   # compare with SHA256SUMS
```
