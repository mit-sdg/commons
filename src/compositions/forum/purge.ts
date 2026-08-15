import { no, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts.ts";

const { Conversing, Flagging, Formatting, Linking, Locking, Posting, Tracking, Trashing } =
  concepts;

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
    where(
      no(Posting._getPost({ post: item })),
      Conversing._getNodeByItem({ item }).is({ node }),
      Conversing._hasChildren({ node }).is({ present: false }),
    )
      .then(Conversing.remove({ node }))
      .named("leaf-node"),
  ),
);
