import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";

const root = join(import.meta.dirname, "../..");
const sourceRoots = ["src", "frontend/src", "scripts", "tests"];
const standaloneSources = ["frontend/next.config.ts", "generated.config.ts"];
const coreHomes = new Set(["advanced", "assembly", "boundary", "client", "language", "tooling"]);
const httpHomes = new Set(["client", "handler", "policy", "tooling"]);

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

  test("matching beta.16 packages and public commands are pinned", () => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(manifest.dependencies["@mit-sdg/sync-engine"]).toBe("1.0.0-beta.16");
    expect(manifest.dependencies["@mit-sdg/sync-engine-http"]).toBe("1.0.0-beta.16");
    expect(manifest.scripts.artifacts).toBe("sync-engine artifacts");
    expect(manifest.scripts["design:check"]).toBe(
      "sync-engine check-design design/concepts/*.md design/compositions/*/*.md design/application.md",
    );
    expect(manifest.scripts["source:check"]).toBe("sync-engine check --config generated.config.ts");
    expect(
      Object.values({ ...manifest.dependencies, ...manifest.devDependencies }).filter((value) =>
        String(value).startsWith("file:"),
      ),
    ).toEqual([]);

    const installedCore = JSON.parse(
      readFileSync(join(root, "node_modules/@mit-sdg/sync-engine/package.json"), "utf8"),
    );
    const installedHttp = JSON.parse(
      readFileSync(join(root, "node_modules/@mit-sdg/sync-engine-http/package.json"), "utf8"),
    );
    expect(installedCore.version).toBe("1.0.0-beta.16");
    expect(installedCore.bin["sync-engine"]).toBe("./dist/command/main.js");
    expect(installedHttp.version).toBe("1.0.0-beta.16");

    for (const home of coreHomes)
      expect(import.meta.resolve(`@mit-sdg/sync-engine/${home}`)).toBeTruthy();
    for (const home of httpHomes)
      expect(import.meta.resolve(`@mit-sdg/sync-engine-http/${home}`)).toBeTruthy();
  });
});
