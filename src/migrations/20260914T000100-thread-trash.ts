import type { Migration } from "./migration.ts";

/** Upgrade the old opening-post marker, without restoring content to ordinary readers. */
export const threadTrash: Migration = {
  id: "20260914T000100-thread-trash",
  description: "Move retained opening-post trash records to their whole conversations",
  async up(database) {
    const conversations = database.collection<{ _id: string; root: string }>(
      "conversing.conversations",
    );
    const nodes = database.collection<{ _id: string; item: string }>("conversing.nodes");
    const posts = database.collection<{ _id: string }>("posting.posts");
    const trash = database.collection<{ _id: string; by: string; at: Date }>("trashing.items");
    const moves: { conversation: string; opening: string; by: string; at: Date }[] = [];
    const missing: string[] = [];
    for (const conversation of await conversations.find({}).toArray()) {
      const root = await nodes.findOne({ _id: conversation.root });
      if (!root || !(await posts.findOne({ _id: root.item }, { projection: { _id: 1 } }))) {
        missing.push(conversation._id);
        continue;
      }
      const marker = await trash.findOne({ _id: root.item });
      if (marker)
        moves.push({
          conversation: conversation._id,
          opening: root.item,
          by: marker.by,
          at: marker.at,
        });
    }
    // Already-destroyed openings cannot be restored by a migration. Never guess or destroy their replies.
    if (missing.length > 0)
      return {
        summary: "No trash records changed.",
        blocked: `These conversations have no retained opening post: ${missing.join(", ")}. Restore their openings from backup, or arrange an operator-reviewed cleanup of the affected conversations and their retained state, then retry startup. The previous release cannot purge a whole conversation by its identity. No surviving replies were deleted.`,
      };
    for (const move of moves) {
      // Establish the new hiding marker first. A restart may safely repeat either write.
      await trash.updateOne(
        { _id: move.conversation },
        { $setOnInsert: { by: move.by, at: move.at } },
        { upsert: true },
      );
      await trash.deleteOne({ _id: move.opening });
    }
    return { summary: `Moved ${moves.length} opening-post trash record(s) to whole threads.` };
  },
};
