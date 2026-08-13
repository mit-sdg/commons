import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";

const root = join(import.meta.dirname, "../..");
const designConcepts = join(root, "design/concepts");
const conceptsRoot = join(root, "src/concepts");
const compositionsRoot = join(root, "src/compositions");

const lowerFirst = (value: string) => `${value[0]?.toLowerCase()}${value.slice(1)}`;

describe("application-owned design integration", () => {
  test("every authored concept is registered through the vocabulary module", () => {
    const vocabulary = readFileSync(join(root, "src/vocabulary.ts"), "utf8");
    const designs = readdirSync(designConcepts)
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.slice(0, -3))
      .sort();

    for (const concept of designs) {
      const directory = lowerFirst(concept);
      const registry = join(conceptsRoot, directory, "registry.ts");
      expect(existsSync(registry), concept).toBe(true);
      expect(readFileSync(registry, "utf8"), concept).toContain(
        `from "@design/concepts/${concept}.md"`,
      );
      expect(vocabulary, concept).toContain(`from "./concepts/${directory}/registry.ts"`);
      expect(vocabulary, concept).toMatch(new RegExp(`^  ${concept}: \\w+,$`, "m"));
      expect(existsSync(join(root, `tests/concepts/${directory}.test.ts`)), concept).toBe(true);
    }
    expect(vocabulary).toContain('from "@design/vocabulary.md"');
    expect(existsSync(join(conceptsRoot, "index.ts"))).toBe(false);
  });

  test("composition explanations have matching executable groups", () => {
    for (const group of ["Access", "Course", "Forum"]) {
      const design = join(root, `design/compositions/${group}.md`);
      const source = join(compositionsRoot, `${group}.ts`);
      expect(existsSync(design), group).toBe(true);
      expect(readFileSync(source, "utf8"), group).toContain(
        `from "@design/compositions/${group}.md"`,
      );
      expect(readFileSync(join(compositionsRoot, "index.ts"), "utf8"), group).toContain(
        `import * as ${group} from "./${group}.ts"`,
      );
    }
    expect(existsSync(join(root, "src/composition"))).toBe(false);
  });

  test("generated artifacts and registration-driven check select src/vocabulary.ts", () => {
    const config = readFileSync(join(root, "generated.config.ts"), "utf8");
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(config).toContain('vocabulary: { module: new URL("./src/vocabulary.ts"');
    expect(config).toContain('httpWire({ policy, name: "CommonsWireHttp" })');
    expect(manifest.scripts["design:check"]).toBe("sync-engine check --config generated.config.ts");
  });

  test("concept implementations and helpers import no engine API", () => {
    for (const entry of readdirSync(conceptsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      for (const name of readdirSync(join(conceptsRoot, entry.name))) {
        if (!name.endsWith(".ts") || name === "registry.ts") continue;
        expect(readFileSync(join(conceptsRoot, entry.name, name), "utf8"), name).not.toMatch(
          /@mit-sdg\/sync-engine/,
        );
      }
    }
  });

  test("the assembly joins only the vocabulary and composition manifest", () => {
    const source = readFileSync(join(root, "src/assembly/application.ts"), "utf8");
    expect(source).toContain('from "../vocabulary.ts"');
    expect(source).toContain('from "../compositions/index.ts"');
    expect(source).not.toMatch(/compositions\/(?:access|course|forum)\//);
  });
});
