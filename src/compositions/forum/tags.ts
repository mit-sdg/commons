import { activeUser } from "../access/session.ts";
import { each, former, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts.ts";
import { notReadable, readable } from "./posts.ts";

const { Tagging, Trashing } = concepts;

/** Which tags exist? */
export const theTags = former("the tags ()", (_inputs, { tag, name }) =>
  each(Tagging._getAllTags({}).is({ tag, name })).form({ tag, name }),
);

/** Which tags are on this target? */
export const theTagsOn = former("the tags on (target)", ({ target }, { tag, name }) =>
  each(Tagging._getTags({ target }).is({ tag, name }))
    .where(readable({ post: target }))
    .form({ tag, name }),
);

/** Which targets carry this tag? */
export const theTargetsTagged = former("the targets tagged (tag)", ({ tag }, { target }) =>
  each(Tagging._getTargets({ tag }).is({ target }))
    .where(readable({ post: target }))
    .form({ target }),
);

/** Which targets carry the tag with this name? */
export const theTargetsTaggedWithName = former(
  "the targets tagged with (name)",
  ({ name }, { tag, target }) =>
    each(Tagging._getByName({ name }).is({ tag }))
      .where(Tagging._getTargets({ tag }).is({ target }), readable({ post: target }))
      .form({ target }),
);

export const PurgeClearsTags = reaction(({ item }) =>
  when(Trashing.purge({}).responds({ item })).then(Tagging.clearTarget({ target: item })),
);

export const CreateTag = endpoint(
  "/tags/create",
  ({ session, name, tag }) =>
    receive({ session, name })
      .where(activeUser({ session }))
      .then(Tagging.createTag({ name }).responds({ tag }))
      .then(respond({ tag })),
  { input: { required: ["session", "name"] } },
);

export const AddTag = endpoint("/tags/add", ({ session, target, tag, tagged }) =>
  receive({ session, target, tag }).then(
    where(activeUser({ session }), readable({ post: target }))
      .then(Tagging.addTag({ target, tag }).responds({ target: tagged }))
      .then(respond({ target: tagged }))
      .named("success"),
    where(activeUser({ session }), notReadable({ post: target }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const RemoveTag = endpoint("/tags/remove", ({ session, target, tag, untagged }) =>
  receive({ session, target, tag }).then(
    where(activeUser({ session }), readable({ post: target }))
      .then(Tagging.removeTag({ target, tag }).responds({ target: untagged }))
      .then(respond({ target: untagged }))
      .named("success"),
    where(activeUser({ session }), notReadable({ post: target }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const TagTargets = endpoint("/tags/targets", ({ tag }) =>
  receive({ tag }).then(respond({ targets: theTargetsTagged({ tag }) })),
);

export const TagTargetsByName = endpoint("/tags/targetsByName", ({ name }) =>
  receive({ name }).then(respond({ targets: theTargetsTaggedWithName({ name }) })),
);

export const TagsForTarget = endpoint("/tags/forTarget", ({ target }) =>
  receive({ target }).then(
    where(readable({ post: target }))
      .then(respond({ tags: theTagsOn({ target }) }))
      .named("success"),
    where(notReadable({ post: target }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);

export const ListTags = endpoint("/tags/list", () =>
  receive({}).then(respond({ tags: theTags({}) })),
);
