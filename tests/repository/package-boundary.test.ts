import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";

const root = join(import.meta.dirname, "../..");
const sourceRoots = ["src", "frontend/src", "scripts", "tests"];
const standaloneSources = ["frontend/next.config.ts", "generated.config.ts"];
const coreHomes = new Set(["advanced", "assembly", "boundary", "client", "language", "tooling"]);
const httpHomes = new Set(["client", "handler", "policy", "tooling"]);
const vendored = (name: string) => `file:./vendor/mit-sdg-${name}-1.0.0-beta.18.tgz`;
const vendoredPackages = [
  "sync-engine",
  "sync-engine-http",
  "sync-engine-analysis",
  "sync-engine-catalog",
];
const vendoredFiles = new Set(vendoredPackages.map(vendored));

function sourceFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [child] : [];
  });
}

describe("the engine package boundary", () => {
  test("authored imports use declared core and HTTP subpaths", () => {
    for (const file of [
      ...sourceRoots.flatMap((path) => sourceFiles(join(root, path))),
      ...standaloneSources.map((path) => join(root, path)),
    ]) {
      if (file === import.meta.filename) continue;
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/(?:from\s+|import\()\s*["']\.\.?\/[^"']*sync-engine/);
      for (const match of source.matchAll(/@mit-sdg\/sync-engine\/(\w+)/g)) {
        expect(coreHomes.has(match[1] as string), `${file}: ${match[0]}`).toBe(true);
      }
      for (const match of source.matchAll(/@mit-sdg\/sync-engine-http\/(\w+)/g)) {
        expect(httpHomes.has(match[1] as string), `${file}: ${match[0]}`).toBe(true);
      }
    }
  });

  test("the vendored beta.18 packages and public commands are pinned", () => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(manifest.dependencies["@mit-sdg/sync-engine"]).toBe(vendored("sync-engine"));
    expect(manifest.dependencies["@mit-sdg/sync-engine-http"]).toBe(vendored("sync-engine-http"));
    expect(manifest.devDependencies["@mit-sdg/sync-engine-analysis"]).toBe(
      vendored("sync-engine-analysis"),
    );
    expect(manifest.devDependencies["@mit-sdg/sync-engine-catalog"]).toBe(
      vendored("sync-engine-catalog"),
    );
    expect(manifest.scripts.artifacts).toBe("sync-engine artifacts");
    expect(manifest.scripts["design:check"]).toBe(
      "sync-engine check-design design/concepts/*.md design/compositions/*/*.md design/application.md",
    );
    expect(manifest.scripts["source:check"]).toBe("sync-engine check --config generated.config.ts");
    // The only local packages are the vendored engine builds, inside the repository (vendor/README.md).
    expect(
      Object.values({ ...manifest.dependencies, ...manifest.devDependencies }).filter(
        (value) => String(value).startsWith("file:") && !vendoredFiles.has(String(value)),
      ),
    ).toEqual([]);

    const installedCore = JSON.parse(
      readFileSync(join(root, "node_modules/@mit-sdg/sync-engine/package.json"), "utf8"),
    );
    const installedHttp = JSON.parse(
      readFileSync(join(root, "node_modules/@mit-sdg/sync-engine-http/package.json"), "utf8"),
    );
    expect(installedCore.version).toBe("1.0.0-beta.18");
    expect(installedCore.bin["sync-engine"]).toBe("./dist/command/main.js");
    expect(installedHttp.version).toBe("1.0.0-beta.18");

    for (const home of coreHomes)
      expect(import.meta.resolve(`@mit-sdg/sync-engine/${home}`)).toBeTruthy();
    for (const home of httpHomes)
      expect(import.meta.resolve(`@mit-sdg/sync-engine-http/${home}`)).toBeTruthy();
  });

  test("the vendored packages are the recorded builds", () => {
    const recorded = new Map(
      readFileSync(join(root, "vendor/SHA256SUMS"), "utf8")
        .trim()
        .split("\n")
        .map((line) => {
          const [digest, file] = line.split(/\s+/);
          return [file, digest] as const;
        }),
    );
    expect([...recorded.keys()].sort()).toEqual(
      vendoredPackages.map((name) => `mit-sdg-${name}-1.0.0-beta.18.tgz`).sort(),
    );
    expect(
      readdirSync(join(root, "vendor"))
        .filter((file) => file.endsWith(".tgz"))
        .sort(),
    ).toEqual([...recorded.keys()].sort());
    for (const [file, digest] of recorded) {
      const actual = createHash("sha256")
        .update(readFileSync(join(root, "vendor", file)))
        .digest("hex");
      expect(actual, file).toBe(digest);
    }
  });
});
