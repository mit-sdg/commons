import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { inspectAssembly } from "@mit-sdg/sync-engine/tooling";
import { describe, expect, test } from "vite-plus/test";
import generated from "../../generated.config.ts";

const root = join(import.meta.dirname, "../..");
const designConcepts = join(root, "design/concepts");
const conceptsRoot = join(root, "src/concepts");
const compositionsRoot = join(root, "src/compositions");

const lowerFirst = (value: string) => `${value[0]?.toLowerCase()}${value.slice(1)}`;

const compositionDesigns = () => {
  const designRoot = join(root, "design/compositions");
  return readdirSync(designRoot, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".md"))
    .sort();
};

const typedLinks = (source: string) =>
  [
    ...source.matchAll(
      /\]\((reaction|view|former):((?:Access|Course|Forum|Tasks)\.[A-Za-z0-9.]+)\)/g,
    ),
  ].map(([, kind, name]) => ({ kind, name }));

describe("application-owned design integration", () => {
  test("every authored concept is registered through the concept-set module", () => {
    const conceptSet = readFileSync(join(root, "src/concepts.ts"), "utf8");
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
      expect(conceptSet, concept).toContain(`from "./concepts/${directory}/registry.ts"`);
      expect(conceptSet, concept).toMatch(new RegExp(`^  ${concept}: \\w+,$`, "m"));
      expect(existsSync(join(root, `tests/concepts/${directory}.test.ts`)), concept).toBe(true);
      expect(existsSync(join(conceptsRoot, directory, `${directory}.mongo.ts`)), concept).toBe(
        true,
      );
      expect(existsSync(join(conceptsRoot, directory, `${directory}.ts`)), concept).toBe(false);
    }
    expect(conceptSet).not.toContain("@design/application.md");
    expect(conceptSet).toContain("export const learningConcepts = conceptSet(");
    expect(existsSync(join(conceptsRoot, "index.ts"))).toBe(false);
  });

  test("every concept query keeps its contract in the declaration body", () => {
    for (const name of readdirSync(designConcepts).filter((entry) => entry.endsWith(".md"))) {
      const source = readFileSync(join(designConcepts, name), "utf8");
      const queries = source.match(/## Queries\n\n```queries\n([\s\S]*?)\n```/);
      expect(queries, name).not.toBeNull();
      expect(source, name).not.toMatch(/^### Notes$/m);

      for (const declaration of queries![1].split(/\n\n+/)) {
        const [signature, ...body] = declaration.split("\n");
        expect(signature, name).toMatch(/^_[A-Za-z0-9_]+ \(/);
        expect(
          body.some((line) => /^  \S/.test(line)),
          `${name}: ${signature}`,
        ).toBe(true);
      }
    }
  });

  test("the application design records the manually audited external-role bindings", () => {
    const expectedBindings = [
      "Assigning.Author is Authenticating.User",
      "Assigning.Assignee is Authenticating.User",
      "Banking.Learner is Authenticating.User",
      "Bookmarking.User is Authenticating.User",
      "Flagging.User is Authenticating.User",
      "Grading.Grader is Authenticating.User",
      "Grading.Learner is Authenticating.User",
      "Inviting.User is Authenticating.User",
      "Notifying.Person is Authenticating.User",
      "Noting.Author is Authenticating.User",
      "Noting.Learner is Authenticating.User",
      "Posting.Author is Authenticating.User",
      "Profiling.User is Authenticating.User",
      "Reacting.Person is Authenticating.User",
      "Resolving.User is Authenticating.User",
      "Roling.User is Authenticating.User",
      "Rostering.User is Authenticating.User",
      "Sessioning.User is Authenticating.User",
      "Submitting.Submitter is Authenticating.User",
      "Subscribing.Person is Authenticating.User",
      "Tracking.User is Authenticating.User",
      "Trashing.User is Authenticating.User",
      "Assigning.Sections is Rostering.Section",
      "Banking.Item is Assigning.Assignment",
      "Grading.Item is Assigning.Assignment",
      "Itemizing.Item is Assigning.Assignment",
      "Submitting.Assignment is Assigning.Assignment",
      "Grading.Criterion is Itemizing.Criterion",
      "Grading.Evidence is Submitting.Submission",
      "Mailing.Key is MailKey",
      "Submitting.Artifact is Posting.Post",
      "Bookmarking.Item is Posting.Post",
      "Categorizing.Item is Posting.Post",
      "Conversing.Item is Posting.Post",
      "Flagging.Target is Posting.Post",
      "Formatting.Target is Posting.Post",
      "Linking.Source is Posting.Post",
      "Linking.Target is Posting.Post",
      "Locking.Target is Lockable",
      "Notifying.Link is Posting.Post",
      "Notifying.Subject is Posting.Post",
      "Pinning.Item is Posting.Post",
      "Reacting.Target is Posting.Post",
      "Resolving.Answer is Posting.Post",
      "Resolving.Question is Posting.Post",
      "Revising.Item is Posting.Post",
      "Grouping.Person is Authenticating.User",
      "Tagging.Target is Posting.Post",
      "TaskNotifying.Link is TaskSubject",
      "TaskNotifying.Person is Authenticating.User",
      "TaskNotifying.Subject is TaskSubject",
      "Tasking.Assignee is Authenticating.User",
      "Tasking.Scope is Grouping.Group",
      "Tracking.Item is Posting.Post",
      "Trashing.Item is Posting.Post",
      "Pinning.Scope is Conversing.Conversation",
      "Roling.Context is Conversing.Conversation",
      "Subscribing.Target is Conversing.Conversation",
      "Tracking.Scope is Conversing.Conversation",
    ].sort();
    const source = readFileSync(join(root, "design/application.md"), "utf8");
    const inventory = source.match(/^```instances\n([\s\S]*?)^```$/m)?.[1] ?? "";
    const bindings: { external: string; owner: string }[] = [];
    const definitions: Record<string, string> = {};
    let instance = "";
    for (const line of inventory.split("\n")) {
      const declaration = line.match(/^instantiate (\w+)(?: as (\w+))?(?: with)?$/);
      if (declaration) {
        instance = declaration[2] ?? (declaration[1] as string);
        if (declaration[2]) definitions[declaration[2]] = declaration[1] as string;
        continue;
      }
      const binding = line.match(/^ {2}([A-Z]\w*) is ([A-Z]\w*(?:\.[A-Z]\w*)?)$/);
      if (binding)
        bindings.push({ external: `${instance}.${binding[1]}`, owner: binding[2] as string });
    }
    const rendered = bindings.map(({ external, owner }) => `${external} is ${owner}`).sort();

    expect(rendered).toEqual([...new Set(rendered)]);
    expect(rendered).toEqual(expectedBindings);
    expect(bindings.some(({ external }) => external === "Authenticating.User")).toBe(false);
    expect(source).toContain("concrete MailKey");
    expect(source).toContain("concrete Lockable");
    expect(source).toContain("concrete TaskSubject");
    expect(source).toContain("Authenticating owns the application's person identity.");

    const definitionOf = (name: string) => definitions[name] ?? name;
    for (const { external, owner } of bindings) {
      const [concept, type] = external.split(".");
      const conceptSource = readFileSync(
        join(designConcepts, `${definitionOf(concept)}.md`),
        "utf8",
      );
      expect(conceptSource, external).toMatch(new RegExp(`^external ${type}$`, "m"));
      if (!owner.includes(".")) continue;
      const [ownerConcept, ownerType] = owner.split(".");
      const ownerSource = readFileSync(
        join(designConcepts, `${definitionOf(ownerConcept)}.md`),
        "utf8",
      );
      expect(ownerSource, owner).toMatch(new RegExp(`\\b${ownerType}\\b`));
    }
  });

  test("authored composition explanations register only genuine behavior modules", () => {
    const designRoot = join(root, "design/compositions");
    const designs = compositionDesigns();
    const config = readFileSync(join(root, "generated.config.ts"), "utf8");
    const configured = [...config.matchAll(/new URL\("\.\/design\/compositions\/([^"\n]+\.md)"/g)]
      .map(([, name]) => name)
      .sort();

    expect(configured).toEqual(designs);
    for (const design of designs) {
      const sourcePath = join(compositionsRoot, design.replace(/\.md$/, ".ts"));
      const prose = readFileSync(join(designRoot, design), "utf8");
      const behavior = readFileSync(sourcePath, "utf8");
      const [group, module] = design.replace(/\.md$/, "").split("/");
      const namespace = `${group[0]?.toUpperCase()}${group.slice(1)}.${module.replace(
        /-([a-z])/g,
        (_, letter: string) => letter.toUpperCase(),
      )}.`;
      const links = typedLinks(prose);

      expect(existsSync(sourcePath), design).toBe(true);
      expect(behavior, design).not.toMatch(/@design\/compositions/);
      expect(links.length, design).toBeGreaterThan(0);
      expect(
        links.every(({ name }) => name.startsWith(namespace)),
        design,
      ).toBe(true);
      for (const { kind, name } of links) {
        const exportName = name.split(".").at(-1)!;
        const declaration = kind === "reaction" ? "(?:endpoint|reaction)" : kind;
        expect(behavior, `${design}: ${kind}:${name}`).toMatch(
          new RegExp(`export const ${exportName} = ${declaration}\\s*\\(`),
        );
      }
    }

    for (const group of ["Access", "Course", "Forum", "Tasks"]) {
      expect(readFileSync(join(compositionsRoot, "index.ts"), "utf8"), group).toContain(
        `import * as ${group} from "./${group}.ts"`,
      );
      const manifest = readFileSync(join(compositionsRoot, `${group}.ts`), "utf8");
      expect(manifest, group).not.toMatch(/@design\/compositions|@mit-sdg\/sync-engine/);
      expect(manifest, group).not.toMatch(/\b(?:reaction|endpoint)\s*\(/);
    }
    expect(readFileSync(join(compositionsRoot, "Forum.ts"), "utf8")).toContain("  feed,\n");
    expect(existsSync(join(root, "src/composition"))).toBe(false);
  });

  test("composition prose covers every selected declaration exactly once", () => {
    const inspected = inspectAssembly(generated.assemble()).app;
    const selected = [
      ...new Set(
        inspected.reactions
          .map(({ name }) => name.replace(/[:#].*$/, ""))
          .filter((name) => /^(Access|Course|Forum|Tasks)\./.test(name))
          .map((name) => `reaction:${name}`),
      ),
      ...inspected.views.flatMap(({ authored }) =>
        authored === undefined ? [] : [`view:${authored.identity}`],
      ),
      ...inspected.formers.flatMap(({ authored }) =>
        authored === undefined ? [] : [`former:${authored.identity}`],
      ),
    ].sort();
    const designRoot = join(root, "design/compositions");
    const documented = compositionDesigns()
      .flatMap((design) => typedLinks(readFileSync(join(designRoot, design), "utf8")))
      .map(({ kind, name }) => `${kind}:${name}`)
      .sort();

    expect(documented).toEqual([...new Set(documented)]);
    expect(documented).toEqual(selected);
  });

  test("generated artifacts and registration-driven check select src/concepts.ts", () => {
    const config = readFileSync(join(root, "generated.config.ts"), "utf8");
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(config).toContain('module: new URL("./src/concepts.ts"');
    expect(config).toContain('export: "learningConcepts"');
    expect(config).toContain('httpWire({ policy, name: "CommonsWireHttp" })');
    expect(manifest.scripts["source:check"]).toBe("sync-engine check --config generated.config.ts");
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

  test("the assembly joins only the concept set and composition manifest", () => {
    const source = readFileSync(join(root, "src/assembly/application.ts"), "utf8");
    expect(source).toContain('from "../concepts.ts"');
    expect(source).toContain("conceptSet: learningConcepts");
    expect(source).toContain('from "../compositions/index.ts"');
    expect(source).not.toMatch(/compositions\/(?:access|course|forum)\//);
  });
});
