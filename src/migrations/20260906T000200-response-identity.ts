import type { Migration } from "./migration.ts";

interface Answer {
  item: string;
  value: string;
}

function validAnswers(value: unknown): value is Answer[] {
  if (!Array.isArray(value)) return false;
  const items = new Set<string>();
  return value.every((answer: unknown) => {
    if (
      typeof answer !== "object" ||
      answer === null ||
      !("item" in answer) ||
      typeof answer.item !== "string" ||
      !("value" in answer) ||
      typeof answer.value !== "string" ||
      answer.value.trim() === "" ||
      items.has(answer.item)
    )
      return false;
    items.add(answer.item);
    return true;
  });
}

/**
 * Response identity and its fixed answers are one atomic unit. Startup runs
 * this before serving. Retain the old answer collection as recovery evidence;
 * copied responses are never overwritten on a retry or later reapplication.
 */
export const responseIdentity: Migration = {
  id: "20260906T000200-response-identity",
  description: "Enforce one response per participant and keep answers with their hand-in.",
  async up(database) {
    const responses = database.collection<{ _id: string; answers?: unknown }>(
      "responding.responses",
    );
    const collisions = await responses
      .aggregate<{ responses: string[]; count: number }>([
        {
          $group: {
            _id: { subject: "$subject", participant: "$participant" },
            responses: { $push: "$_id" },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $project: { _id: 0, responses: 1, count: 1 } },
      ])
      .toArray();
    if (collisions.length > 0) {
      return {
        summary: "blocked",
        blocked:
          `${collisions.length} subject/participant pair(s) have multiple responses. ` +
          "Commons will not discard answers or submitted hand-ins to choose a winner. " +
          "Review and repair the duplicate response identities, including their answer and " +
          "downstream references, then restart. Response IDs: " +
          collisions.map((collision) => collision.responses.join(", ")).join("; "),
      };
    }
    const legacy = database.collection<{
      response: string;
      item: unknown;
      value: unknown;
      seq: unknown;
    }>("responding.answers");
    const pending: { response: string; answers: Answer[] }[] = [];
    const invalid: string[] = [];
    for (const response of await responses.find().toArray()) {
      if (response.answers !== undefined) {
        if (!validAnswers(response.answers)) invalid.push(response._id);
        continue;
      }
      const rows = await legacy.find({ response: response._id }).sort({ seq: 1 }).toArray();
      const answers = rows.map(({ item, value }) => ({ item, value }));
      const ordered =
        rows.every((row) => typeof row.seq === "number" && Number.isFinite(row.seq)) &&
        new Set(rows.map((row) => row.seq)).size === rows.length;
      if (!ordered || !validAnswers(answers)) invalid.push(response._id);
      else pending.push({ response: response._id, answers });
    }
    // Validate the complete copy before writing anything. Repeated items or
    // malformed/orderless answers cannot be silently interpreted as a winner.
    if (invalid.length > 0)
      return {
        summary: "blocked",
        blocked:
          "Some responses have repeated items, malformed answers, or ambiguous answer order. " +
          "No answers were changed. Repair their stored answers, then restart. Response IDs: " +
          invalid.join(", "),
      };
    await responses.createIndex({ subject: 1, participant: 1 }, { unique: true });
    for (const entry of pending) {
      await responses.updateOne(
        { _id: entry.response, answers: { $exists: false } },
        { $set: { answers: entry.answers } },
      );
    }
    return {
      summary: `one response per subject and participant enforced; copied answers for ${pending.length} response(s); legacy answers retained`,
    };
  },
};
