import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";

const root = join(import.meta.dirname, "../..");
const sourceRoots = ["src", "frontend/src", "scripts", "tests"];
const standaloneSources = ["frontend/next.config.ts", "generated.config.ts"];
const canonicalHomes = new Set([
  "advanced",
  "assembly",
  "boundary",
  "client",
  "language",
  "tooling",
  "utils",
]);

function sourceFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [child] : [];
  });
}

describe("the engine package boundary", () => {
  test("authored imports use the package's declared locations", () => {
    for (const file of [
      ...sourceRoots.flatMap((path) => sourceFiles(join(root, path))),
      ...standaloneSources.map((path) => join(root, path)),
    ]) {
      if (file === import.meta.filename) continue;
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain(["@sync", "engine"].join("-"));
      expect(source, file).not.toMatch(/(?:from\s+|import\()\s*["']\.\.?\/[^"']*sync-engine/);

      for (const match of source.matchAll(/@mit-sdg\/sync-engine(?:\/([^"']+))?/g)) {
        expect(match[1], file).toBeDefined();
        expect(canonicalHomes.has(match[1] as string), `${file}: ${match[0]}`).toBe(true);
        if (file.startsWith(join(root, "frontend", "src"))) {
          expect(match[1], file).toBe("client");
        }
      }
    }

    for (const file of ["tsconfig.json", "frontend/tsconfig.json"]) {
      expect(readFileSync(join(root, file), "utf8"), file).not.toContain("sync-engine");
    }
  });

  test("the one local dependency resolves through built package exports", () => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const engineDependency = manifest.dependencies["@mit-sdg/sync-engine"];
    expect(typeof engineDependency).toBe("string");
    if (engineDependency.startsWith("file:")) {
      expect(engineDependency).toBe("file:../sync-engine");
    }
    const localDependencies = Object.entries({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    }).filter(([, value]) => String(value).startsWith("file:"));
    expect(localDependencies).toEqual(
      engineDependency.startsWith("file:") ? [["@mit-sdg/sync-engine", "file:../sync-engine"]] : [],
    );
    expect(manifest.scripts.artifacts).toBe(
      "bun node_modules/@mit-sdg/sync-engine/dist/command/artifacts.js artifacts",
    );

    const installedEngine = JSON.parse(
      readFileSync(join(root, "node_modules/@mit-sdg/sync-engine/package.json"), "utf8"),
    );
    expect(installedEngine.bin["sync-engine"]).toBe("./dist/command/artifacts.js");

    const frontendManifest = JSON.parse(readFileSync(join(root, "frontend/package.json"), "utf8"));
    const frontendDependencies = {
      ...frontendManifest.dependencies,
      ...frontendManifest.devDependencies,
    };
    expect(frontendDependencies["@mit-sdg/sync-engine"]).toBeUndefined();
    expect(
      Object.values(frontendDependencies).filter((value) => String(value).startsWith("file:")),
    ).toEqual([]);

    for (const home of canonicalHomes) {
      const resolved = import.meta.resolve(`@mit-sdg/sync-engine/${home}`);
      expect(resolved).toMatch(new RegExp(`/sync-engine/dist/${home}/index\\.js$`));
    }
  });
});
