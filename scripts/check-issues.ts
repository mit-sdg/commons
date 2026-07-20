import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const states = ["open", "decided", "done"] as const;
type IssueState = (typeof states)[number];
const stateNames = new Set<string>(states);
const milestones = new Set(["repository-release", "public-deployment", "later"]);
const fields = new Set(["milestone", "concepts"]);

export function validateIssueText(
  name: string,
  source: string,
  knownConcepts: ReadonlySet<string>,
  state: IssueState,
): string[] {
  const errors: string[] = [];
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  if (lines[0] !== "---") return [`${name}: frontmatter must start on the first line`];
  const end = lines.indexOf("---", 1);
  if (end === -1) return [`${name}: frontmatter is not closed`];

  const values = new Map<string, string | string[]>();
  let listField: string | undefined;
  for (let index = 1; index < end; index += 1) {
    const line = lines[index];
    const item = line.match(/^  - (.+)$/);
    if (item) {
      if (listField !== "concepts") {
        errors.push(`${name}:${index + 1}: list items are allowed only under concepts`);
        continue;
      }
      (values.get("concepts") as string[]).push(item[1]);
      continue;
    }

    const pair = line.match(/^([a-z]+):(?: (.*))?$/);
    if (!pair) {
      errors.push(`${name}:${index + 1}: invalid frontmatter line`);
      continue;
    }
    const [, key, raw = ""] = pair;
    listField = undefined;
    if (!fields.has(key)) {
      errors.push(`${name}:${index + 1}: unsupported frontmatter field ${key}`);
      continue;
    }
    if (values.has(key)) {
      errors.push(`${name}:${index + 1}: duplicate frontmatter field ${key}`);
      continue;
    }
    if (key === "concepts") {
      if (raw === "[]") values.set(key, []);
      else if (raw === "") {
        values.set(key, []);
        listField = key;
      } else errors.push(`${name}:${index + 1}: concepts must be a list or []`);
    } else {
      if (raw === "") errors.push(`${name}:${index + 1}: ${key} needs a value`);
      values.set(key, raw);
    }
  }

  for (const field of fields) {
    if (!values.has(field)) errors.push(`${name}: missing frontmatter field ${field}`);
  }
  const milestone = values.get("milestone");
  if (typeof milestone === "string" && !milestones.has(milestone)) {
    errors.push(`${name}: unsupported milestone ${milestone}`);
  }
  const concepts = values.get("concepts");
  if (Array.isArray(concepts)) {
    const seen = new Set<string>();
    for (const concept of concepts) {
      if (!knownConcepts.has(concept)) errors.push(`${name}: unknown concept ${concept}`);
      if (seen.has(concept)) errors.push(`${name}: duplicate concept ${concept}`);
      seen.add(concept);
    }
  }

  const body = lines.slice(end + 1).join("\n");
  if (!/^# .+$/m.test(body)) errors.push(`${name}: missing issue title`);
  const sections: Record<IssueState, readonly string[]> = {
    open: ["Current behavior", "Unresolved decision", "Acceptance condition"],
    decided: ["Current behavior", "Desired behavior", "Acceptance condition"],
    done: ["Resolution at completion", "Decision at completion", "Verification at completion"],
  };
  for (const section of sections[state]) {
    if (!new RegExp(`^## ${section}$`, "m").test(body)) {
      errors.push(`${name}: missing ${section} section`);
    }
  }
  const expectedSections = new Set(sections[state]);
  for (const section of new Set(Object.values(sections).flat())) {
    if (!expectedSections.has(section) && new RegExp(`^## ${section}$`, "m").test(body)) {
      errors.push(`${name}: ${section} section does not belong in ${state}`);
    }
  }
  return errors;
}

export async function validateIssueDirectory(root: string): Promise<string[]> {
  const issues = join(root, "content", "issues");
  const conceptsRoot = join(root, "src", "concepts");
  const conceptEntries = await readdir(conceptsRoot, { withFileTypes: true });
  const knownConcepts = new Set<string>();
  for (const entry of conceptEntries) {
    if (!entry.isDirectory()) continue;
    const spec = await readFile(join(conceptsRoot, entry.name, "spec.md"), "utf8");
    const title = spec.match(/^# (.+)$/m)?.[1];
    if (title) knownConcepts.add(title);
  }

  const rootEntries = (await readdir(issues, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const errors: string[] = [];
  for (const entry of rootEntries) {
    if (!entry.isDirectory() || !stateNames.has(entry.name)) {
      errors.push(
        `${entry.name}: issue root must contain only open, decided, and done directories`,
      );
    }
  }

  const seen = new Map<string, string>();
  let issueCount = 0;
  for (const state of states) {
    const rootEntry = rootEntries.find((entry) => entry.name === state && entry.isDirectory());
    if (rootEntry === undefined) {
      errors.push(`${state}: missing issue state directory`);
      continue;
    }

    const entries = (await readdir(join(issues, state), { withFileTypes: true })).sort(
      (left, right) => left.name.localeCompare(right.name),
    );
    for (const entry of entries) {
      const name = `${state}/${entry.name}`;
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        errors.push(`${name}: issue state directories must contain only Markdown files`);
        continue;
      }
      const previous = seen.get(entry.name);
      if (previous !== undefined) {
        errors.push(`${name}: duplicate issue filename also used by ${previous}`);
        continue;
      }
      seen.set(entry.name, name);
      issueCount += 1;
      const source = await readFile(join(issues, state, entry.name), "utf8");
      errors.push(...validateIssueText(name, source, knownConcepts, state));
    }
  }
  if (issueCount === 0) {
    errors.push("issues: no issue files found");
  }
  return errors;
}

if (import.meta.main) {
  const root = join(import.meta.dir, "..");
  const errors = await validateIssueDirectory(root);
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log("Commons issue records are valid.");
  }
}
