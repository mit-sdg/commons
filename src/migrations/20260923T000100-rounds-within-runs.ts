import { EDITION_INDEXES } from "../concepts/publishing/publishing.mongo.ts";
import type { Migration } from "./migration.ts";

interface EditionDoc {
  _id: string;
  material: string;
  whole?: string;
  open: boolean;
  closedAt: Date | null;
}

const EDITIONS = "publishing.editions";

const quoted = (ids: readonly string[]) => ids.map((id) => JSON.stringify(id)).join(", ");

const inspect = (filter: string) => `db.getCollection("${EDITIONS}").find(${filter})`;

function groupsOf<Row>(rows: readonly Row[], key: (row: Row) => string | undefined) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const name = key(row);
    if (name === undefined) continue;
    const group = groups.get(name);
    if (group === undefined) groups.set(name, [row]);
    else group.push(row);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

/**
 * A relay run's rounds used to belong to it only through a Linking link from
 * the round's edition to the run's. Publishing now records the run as each
 * round's whole and holds, by index, one open edition per material, one open
 * round per run, and one round per material in each run.
 *
 * An opening interrupted between publishing a round and linking it left an
 * open edition no run can reach; it holds its questionnaire open forever, so
 * it closes here. A round still open in a run that has closed would, in the
 * same way, keep any later run from opening that leg, so it closes too. Links
 * and any lock on a run stay where they are: nothing reads them for rounds any
 * more.
 */
export const roundsWithinRuns: Migration = {
  id: "20260923T000100-rounds-within-runs",
  description: "Record each relay round's run as its whole and build Publishing's indexes.",
  async up(database) {
    const at = new Date();
    const editions = database.collection<EditionDoc>(EDITIONS);
    const stored = await editions
      .find({}, { projection: { _id: 1, material: 1, whole: 1, open: 1 } })
      .toArray();
    if (stored.length === 0) return { summary: "no editions stored; nothing to do" };

    const relays = new Set(
      (
        await database
          .collection<{ _id: string }>("relaying.relays")
          .find({}, { projection: { _id: 1 } })
          .toArray()
      ).map((row) => row._id),
    );
    const legMaterials = new Set(
      (
        await database
          .collection<{ _id: string; material: string }>("relaying.legs")
          .find({}, { projection: { material: 1 } })
          .toArray()
      ).map((row) => row.material),
    );
    const known = new Set(stored.map((edition) => edition._id));
    const runs = stored.filter((edition) => relays.has(edition.material)).map((run) => run._id);
    const links = await database
      .collection<{ _id: string; targets: string[] }>("linking.links")
      .find({ targets: { $in: runs } })
      .toArray();
    const runSet = new Set(runs);
    const tiedTo = new Map<string, string[]>();
    for (const link of links) {
      if (!known.has(link._id)) continue;
      tiedTo.set(link._id, [...new Set(link.targets.filter((target) => runSet.has(target)))]);
    }

    const problems: string[] = [];
    const giving = new Map<string, string[]>();
    for (const edition of stored) {
      const ties = tiedTo.get(edition._id);
      if (ties === undefined) continue;
      if (ties.length > 1) {
        problems.push(
          `  round ${edition._id} is tied to ${ties.length} runs: ${ties.join(", ")}\n` +
            `    db.getCollection("linking.links").find({ _id: ${JSON.stringify(edition._id)} })`,
        );
      } else if (edition.whole !== undefined && edition.whole !== ties[0]) {
        problems.push(
          `  round ${edition._id} is tied to run ${ties[0]} but already belongs to ${edition.whole}\n` +
            `    ${inspect(`{ _id: { $in: [${quoted([edition._id, ties[0], edition.whole])}] } }`)}`,
        );
      } else if (edition.whole === undefined) {
        const rounds = giving.get(ties[0]);
        if (rounds === undefined) giving.set(ties[0], [edition._id]);
        else rounds.push(edition._id);
      }
    }
    const wholeOf = (edition: EditionDoc) => edition.whole ?? tiedTo.get(edition._id)?.[0];

    const orphans = stored
      .filter(
        (edition) =>
          edition.open && legMaterials.has(edition.material) && wholeOf(edition) === undefined,
      )
      .map((orphan) => orphan._id);
    const runOpen = new Map(
      stored.filter((edition) => runSet.has(edition._id)).map((run) => [run._id, run.open]),
    );
    const stranded = stored
      .filter((edition) => {
        const whole = wholeOf(edition);
        return edition.open && whole !== undefined && runOpen.get(whole) === false;
      })
      .map((round) => round._id);
    const closing = new Set([...orphans, ...stranded]);
    const staying = stored.filter((edition) => edition.open && !closing.has(edition._id));

    for (const [material, group] of groupsOf(staying, (edition) => edition.material)) {
      const ids = group.map((edition) => edition._id);
      problems.push(
        `  material ${material} has ${group.length} open editions: ${ids.join(", ")}\n` +
          `    ${inspect(`{ material: ${JSON.stringify(material)}, open: true }`)}`,
      );
    }
    for (const [run, group] of groupsOf(staying, wholeOf)) {
      const ids = group.map((edition) => edition._id);
      problems.push(
        `  run ${run} has ${group.length} open rounds: ${ids.join(", ")}\n` +
          `    ${inspect(`{ _id: { $in: [${quoted(ids)}] } }`)}`,
      );
    }
    for (const [, group] of groupsOf(stored, (edition) => {
      const whole = wholeOf(edition);
      return whole === undefined ? undefined : JSON.stringify([whole, edition.material]);
    })) {
      const ids = group.map((edition) => edition._id);
      problems.push(
        `  run ${wholeOf(group[0])} holds material ${group[0].material} ${group.length} times: ${ids.join(", ")}\n` +
          `    ${inspect(`{ _id: { $in: [${quoted(ids)}] } }`)}`,
      );
    }

    if (problems.length > 0) {
      return {
        summary: "blocked",
        blocked:
          `Publishing now holds one open edition per material, one open round per run, and\n` +
          `one round per material in each run. ${problems.length} place(s) in this database break\n` +
          `that, and choosing which edition to close or which run a round belongs to could end\n` +
          `a session in progress, so Commons will not decide on its own.\n\n` +
          `${problems.join("\n")}\n\n` +
          `Close the editions that should not stay open (set open to false and closedAt to\n` +
          `the current time), or remove the extra run from a round's link, then start\n` +
          `Commons again.`,
      };
    }

    let given = 0;
    for (const [run, rounds] of giving) {
      const update = await editions.updateMany(
        { _id: { $in: rounds }, whole: { $exists: false } },
        { $set: { whole: run } },
      );
      given += update.modifiedCount;
    }
    const close = async (ids: string[]) =>
      ids.length === 0
        ? 0
        : (
            await editions.updateMany(
              { _id: { $in: ids }, open: true },
              { $set: { open: false, closedAt: at } },
            )
          ).modifiedCount;
    const closed = await close(orphans);
    const ended = await close(stranded);

    const present = new Set((await editions.indexes()).map((index) => index.name));
    const missing = EDITION_INDEXES.filter((index) => !present.has(index.name ?? ""));
    if (missing.length > 0) await editions.createIndexes(missing);

    const locks = await database
      .collection<{ _id: string }>("locking.locks")
      .countDocuments({ _id: { $in: runs } });
    const locked = locks === 0 ? "" : `; ${locks} lock(s) on runs left in place, read by nothing`;
    if (given === 0 && closed === 0 && ended === 0 && missing.length === 0) {
      return { summary: `rounds already sit within their runs; nothing to do${locked}` };
    }
    return {
      summary:
        `gave ${given} round(s) their run as whole, closed ${closed} round edition(s) no run ` +
        `held, closed ${ended} round(s) left open in closed runs, ` +
        `built ${missing.length} Publishing index(es)${locked}`,
    };
  },
};
