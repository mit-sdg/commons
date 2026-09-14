import { no, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts.ts";

const {
  Accessing,
  Conversing,
  Flagging,
  Formatting,
  Linking,
  Locking,
  Posting,
  Tracking,
  Trashing,
} = concepts;

export const PurgeClearsCoreForumState = reaction(({ item, node, conversation }) =>
  when(Trashing.purge({ item }).responds()).then(
    where(Posting._getPost({ post: item }))
      .then(Posting.delete({ post: item }))
      .named("post"),
    Formatting.clear({ target: item }).named("formatting"),
    Linking.clearLinks({ source: item }).named("links"),
    Linking.clearBacklinks({ target: item }).named("backlinks"),
    Flagging.clearTarget({ target: item }).named("flags"),
    where(Locking._isLocked({ target: item }).is({ locked: true }))
      .then(Locking.unlock({ target: item }))
      .named("item-lock"),
    where(
      Conversing._getNodeByItem({ item }).is({ node }),
      no(Conversing._parentOf({ node })),
      Conversing._getConversation({ node }).is({ conversation }),
      Locking._isLocked({ target: conversation }).is({ locked: true }),
    )
      .then(Locking.unlock({ target: conversation }))
      .named("conversation-lock"),
    Tracking.unregister({ item }).named("tracking"),
  ),
);

/** Core cleanup handles the lock; a conversation also loses its structure and audience grant. */
export const PurgeDissolvesConversation = reaction(({ item }) =>
  when(Trashing.purge({ item }).responds())
    .where(Conversing._exists({ conversation: item }).is({ exists: true }))
    .then(
      Conversing.dissolve({ conversation: item }).named("structure"),
      Accessing.retire({ resource: item }).named("access"),
    ),
);
