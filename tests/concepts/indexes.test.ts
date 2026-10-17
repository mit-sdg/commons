import { describe, expect, test } from "vite-plus/test";
import { speedIndexes } from "../../src/concepts/indexes.ts";

describe("speed indexes", () => {
  test("are built once, on the first call", async () => {
    let builds = 0;
    const ready = speedIndexes("Example", async () => {
      builds += 1;
    });
    expect(builds).toBe(0);
    await Promise.all([ready(), ready()]);
    await ready();
    expect(builds).toBe(1);
  });

  test("a failed build is logged once and never fails a call", async () => {
    const lines: string[] = [];
    let builds = 0;
    const ready = speedIndexes(
      "Example",
      async () => {
        builds += 1;
        throw new Error("index build interrupted");
      },
      (line) => lines.push(line),
    );
    await expect(ready()).resolves.toBeUndefined();
    await expect(ready()).resolves.toBeUndefined();
    expect(builds).toBe(1);
    expect(lines).toEqual([
      "commons: Example could not build its indexes and reads without them: index build interrupted",
    ]);
  });
});
