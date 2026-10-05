import { afterAll, describe, expect, test } from "vite-plus/test";
import { ConnectionNotFound } from "../../src/concepts/connecting/errors.ts";
import { MongoConnectingConcept } from "../../src/concepts/connecting/connecting.mongo.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";

const floors: [string, () => Promise<MongoConnectingConcept>][] = [
  ["on MongoDB", async () => new MongoConnectingConcept(await testDb())],
];

afterAll(stopTestDb);

const portal = "https://mit-sdg.dev";
const teamApp = "https://team-7.mit-sdg.dev";
const at1 = new Date("2026-10-01T09:00:00Z");
const at2 = new Date("2026-10-02T09:00:00Z");
const at3 = new Date("2026-10-03T09:00:00Z");

for (const [floor, make] of floors) {
  describe(`Connecting ${floor}`, () => {
    test("approving remembers the connection and approving again answers the same one", async () => {
      const connecting = await make();
      const { connection } = await connecting.approve({ user: "ines", app: portal, at: at1 });
      expect(typeof connection).toBe("string");

      expect(await connecting.approve({ user: "ines", app: portal, at: at2 })).toEqual({
        connection,
      });
      expect(await connecting._getConnection({ connection })).toEqual([
        { user: "ines", app: portal, approvedAt: at1 },
      ]);
      expect(await connecting._getApproval({ user: "ines", app: portal })).toEqual([
        { connection, approvedAt: at1 },
      ]);
    });

    test("approvals racing for one app leave a single connection", async () => {
      const connecting = await make();
      const answers = await Promise.all(
        Array.from({ length: 8 }, () => connecting.approve({ user: "ines", app: portal, at: at1 })),
      );
      expect(new Set(answers.map(({ connection }) => connection)).size).toBe(1);
      expect(await connecting._getConnections({ user: "ines" })).toHaveLength(1);
    });

    test("each person's connections are their own, the most recent approval first", async () => {
      const connecting = await make();
      const first = await connecting.approve({ user: "ines", app: portal, at: at1 });
      const second = await connecting.approve({ user: "ines", app: teamApp, at: at2 });
      const pauls = await connecting.approve({ user: "paul", app: portal, at: at3 });
      expect(pauls.connection).not.toBe(first.connection);

      expect(await connecting._getConnections({ user: "ines" })).toEqual([
        { connection: second.connection, app: teamApp, approvedAt: at2 },
        { connection: first.connection, app: portal, approvedAt: at1 },
      ]);
      expect(await connecting._getConnections({ user: "paul" })).toEqual([
        { connection: pauls.connection, app: portal, approvedAt: at3 },
      ]);
      expect(await connecting._getConnections({ user: "nobody" })).toEqual([]);
      expect(await connecting._getApproval({ user: "paul", app: teamApp })).toEqual([]);
    });

    test("approvals made at one instant are listed in app order", async () => {
      const connecting = await make();
      await connecting.approve({ user: "ines", app: teamApp, at: at1 });
      await connecting.approve({ user: "ines", app: portal, at: at1 });
      expect((await connecting._getConnections({ user: "ines" })).map(({ app }) => app)).toEqual([
        portal,
        teamApp,
      ]);
    });

    test("withdrawing removes the connection once; approving again makes a new one", async () => {
      const connecting = await make();
      const { connection } = await connecting.approve({ user: "ines", app: portal, at: at1 });
      expect(await connecting.withdraw({ connection })).toEqual({ connection });

      expect(await connecting._getConnection({ connection })).toEqual([]);
      expect(await connecting._getApproval({ user: "ines", app: portal })).toEqual([]);
      expect(await connecting._getConnections({ user: "ines" })).toEqual([]);
      expect(await caughtError(() => connecting.withdraw({ connection }))).toBeInstanceOf(
        ConnectionNotFound,
      );

      const again = await connecting.approve({ user: "ines", app: portal, at: at2 });
      expect(again.connection).not.toBe(connection);
      expect(await connecting._getConnection({ connection: again.connection })).toEqual([
        { user: "ines", app: portal, approvedAt: at2 },
      ]);
    });

    test("an unknown connection answers no row and cannot be withdrawn", async () => {
      const connecting = await make();
      expect(await connecting._getConnection({ connection: "missing" })).toEqual([]);
      expect(
        await caughtError(() => connecting.withdraw({ connection: "missing" })),
      ).toBeInstanceOf(ConnectionNotFound);
    });
  });
}
