import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { Client, Log, waitUntilPlaced, wallSettled, type Wall } from "./drive.ts";

const directories: string[] = [];
const initialExitCode = process.exitCode;
afterEach(() => {
  process.exitCode = initialExitCode;
  vi.unstubAllGlobals();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

test("placed cards do not imply completed sorting", () => {
  const wall = {
    cards: [{ pile: "one" }],
    asksOut: 0,
    sortPending: false,
  } as Wall;
  expect(wallSettled(wall)).toBe(true);
  expect(wallSettled({ ...wall, asksOut: 1 })).toBe(false);
  expect(wallSettled({ ...wall, sortPending: true })).toBe(false);
  expect(wallSettled(wall, 2)).toBe(false);
  expect(wallSettled({ ...wall, cards: [] })).toBe(false);
});

test("a timed-out placement wait fails without requesting another sort", async () => {
  const paths: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    paths.push(new URL(url).pathname);
    return Response.json({ wall: null });
  });
  await expect(waitUntilPlaced(new Client("http://localhost"), "round", 1, 0)).rejects.toThrow(
    "did not finish sorting",
  );
  expect(paths).toEqual(["/live/walls/read"]);
});

test.each(["broken", "slow"] as const)("%s findings have an explicit verdict", (kind) => {
  const directory = mkdtempSync(join(tmpdir(), "commons-findings-"));
  directories.push(directory);
  const log = new Log("test", directory);
  log.finding({ kind, title: "Example", steps: "Example" });
  log.write();
  const report = JSON.parse(readFileSync(join(directory, "findings.json"), "utf8"));
  expect(report.verdict).toBe(kind === "broken" ? "failed" : "review");
  expect(process.exitCode).toBe(kind === "broken" ? 1 : initialExitCode);
});
