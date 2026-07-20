import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vite-plus/test";

const root = join(import.meta.dirname, "../..");
const conceptsRoot = join(root, "src/concepts");
const compositionRoot = join(root, "src/composition");

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

describe("application integration seats", () => {
  test("every included concept has one colocated registry and one concept-set entry", () => {
    const directories = readdirSync(conceptsRoot, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && existsSync(join(conceptsRoot, entry.name, "spec.md")),
      )
      .map((entry) => entry.name)
      .sort();
    const conceptSet = readFileSync(join(conceptsRoot, "index.ts"), "utf8");

    for (const directory of directories) {
      const registryPath = join(conceptsRoot, directory, "registry.ts");
      expect(existsSync(registryPath), directory).toBe(true);
      expect(readFileSync(registryPath, "utf8"), directory).toMatch(/floors:\s*\{\s*mongo:\s*\(/);
      const registrationImport = conceptSet.match(
        new RegExp(`import \\{ (\\w+) \\} from "\\./${directory}/registry\\.ts";`, "g"),
      );
      expect(registrationImport, directory).toHaveLength(1);
      const registration = registrationImport?.[0]?.match(/import \{ (\w+) \}/)?.[1];
      const conceptName = `${directory[0]?.toUpperCase()}${directory.slice(1)}`;
      expect(
        conceptSet.match(new RegExp(`  ${conceptName}: ${registration},`, "g")),
        directory,
      ).toHaveLength(1);
    }
    expect(conceptSet.match(/from "\.\/[^/]+\/registry\.ts"/g)).toHaveLength(directories.length);
  });

  test("the concept set is the one source of composition references and wire vocabulary", () => {
    expect(existsSync(join(compositionRoot, "vocabulary.ts"))).toBe(false);

    const conceptSetPath = join(conceptsRoot, "index.ts");
    const conceptSet = readFileSync(conceptSetPath, "utf8");
    const conceptNames = [...conceptSet.matchAll(/^  (\w+): \w+,$/gm)].map((match) => match[1]);
    for (const file of filesBelow(join(root, "src"))) {
      if (!file.endsWith(".ts") || file === conceptSetPath) continue;
      const source = readFileSync(file, "utf8");
      const namesPresent = conceptNames.filter((name) => new RegExp(`\\b${name}\\b`).test(source));
      expect(namesPresent, relative(root, file)).not.toHaveLength(conceptNames.length);
    }

    const authored = filesBelow(compositionRoot).filter((file) => {
      if (!file.endsWith(".ts") || file.endsWith("/index.ts")) return false;
      return /\b(?:reaction|endpoint|view|former)\s*\(/.test(readFileSync(file, "utf8"));
    });
    for (const file of authored) {
      const source = readFileSync(file, "utf8");
      expect(source, relative(root, file)).toContain(
        'import { concepts } from "../../concepts/index.ts";',
      );
      expect(source, relative(root, file)).toMatch(/const \{[^;]+\} =\s*concepts;/s);
    }

    const generatedConfig = readFileSync(join(root, "generated.config.ts"), "utf8");
    expect(generatedConfig).toContain(
      'wireVocabulary: { from: "../src/concepts/index.ts", export: "vocabulary" }',
    );
  });

  test("concept implementations and exception classes import no assembly or boundary API", () => {
    const files = filesBelow(conceptsRoot).filter(
      (file) =>
        relative(conceptsRoot, file).includes("/") &&
        /(?:errors|\.mongo|\/[a-z-]+)\.ts$/.test(file) &&
        !file.endsWith("registry.ts") &&
        !file.endsWith(".test.ts"),
    );
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, relative(root, file)).not.toMatch(
        /@mit-sdg\/sync-engine\/(?:assembly|boundary)/,
      );
    }
  });

  test("every composition file that declares behavior has one manifest entry", () => {
    const manifest = readFileSync(join(compositionRoot, "index.ts"), "utf8");
    const authored = filesBelow(compositionRoot).filter((file) => {
      if (!file.endsWith(".ts") || file.endsWith("/index.ts")) {
        return false;
      }
      const source = readFileSync(file, "utf8");
      return /\b(?:reaction|endpoint|view|former)\s*\(/.test(source);
    });
    for (const file of authored) {
      const importPath = `./${relative(compositionRoot, file).replaceAll("\\", "/")}`;
      expect(manifest, importPath).toContain(`from "${importPath}"`);
    }
  });

  test("the application entry remains the stable concept-set and manifest join", () => {
    const source = readFileSync(join(root, "src/assembly/application.ts"), "utf8");
    expect(source).toContain('from "../concepts/index.ts"');
    expect(source).toContain('from "../composition/index.ts"');
    expect(source).not.toMatch(/composition\/(?:access|course|forum)\//);
  });
});
