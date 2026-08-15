import { activeUser } from "../access/session.ts";
import { each, form, former, no, view, where, whether } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { FORUM } from "../access/capabilities.ts";
import { isActiveCourseMember, mayManageRoster, mayNotManageRoster } from "../access/policy.ts";
import { concepts } from "../../concepts.ts";
import { thePostSummaryOf, thePrivateProfileOf, theProfileFaceOf } from "./fragments.ts";
import { intact } from "./threads.ts";

const { Authenticating, Conversing, Posting, Profiling, Roling } = concepts;
/** What is this user's profile? */
export const theProfileOf = view("the profile of (user)", ({ user }, { profile }, _bindings) =>
  where(Profiling._getProfile({ user }).is({ profile })),
).optional();
/** Which users match this search? */
export const theUserSearch = former("the user search (query)", ({ query }, { user, username }) =>
  each(Authenticating._search({ query }).is({ user, username })).form({
    user,
    username,
    profile: theProfileFaceOf({ user }),
  }),
);
/** What belongs on this user's page? */
export const theUserPage = former(
  "the user page of (user)",
  ({ user }, { role, name, post, node, conversation }) =>
    form({
      profile: whether(theProfileFaceOf({ user })),
      roles: each(Roling._getRoles({ user, context: FORUM }).is({ role }))
        .where(Roling._getRoleDetail({ role }).is({ name }))
        .form({ role, name }),
      posts: each(Posting._getByAuthor({ author: user }).is({ post }))
        .where(
          intact({ item: post }),
          whether(Conversing._getNodeByItem({ item: post }).is({ node })),
          whether(Conversing._getConversation({ node }).is({ conversation })),
        )
        .form({
          item: post,
          conversation,
          post: whether(thePostSummaryOf({ item: post })),
        }),
    }),
);

export const GetProfile = endpoint(
  "/profiles/get",
  ({ session, user, reader }) =>
    receive({ session, user }).then(
      where(
        activeUser({ session }).is({ user }),
        isActiveCourseMember({ user }),
        theProfileOf({ user }),
      )
        .then(respond({ profile: thePrivateProfileOf({ user }) }))
        .named("success"),
      where(
        activeUser({ session }).is({ user: reader }).is.not({ user }),
        mayManageRoster({ user: reader }),
        theProfileOf({ user }),
      )
        .then(respond({ profile: thePrivateProfileOf({ user }) }))
        .named("staff"),
      where(
        activeUser({ session }).is({ user: reader }).is.not({ user }),
        isActiveCourseMember({ user: reader }),
        mayNotManageRoster({ user: reader }),
        theProfileOf({ user }),
      )
        .then(respond({ profile: theProfileFaceOf({ user }) }))
        .named("member"),
      where(activeUser({ session }), no(theProfileOf({ user })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(
        activeUser({ session }).is({ user: reader }),
        no(isActiveCourseMember({ user: reader })),
        mayNotManageRoster({ user: reader }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "user"] } },
);

export const SetDisplayName = endpoint(
  "/profiles/setDisplayName",
  ({ session, displayName, user }) =>
    receive({ session, displayName })
      .where(activeUser({ session }).is({ user }))
      .then(Profiling.setDisplayName({ user, displayName }))
      .then(respond({ user })),
  { input: { required: ["session", "displayName"] } },
);

export const SetBio = endpoint(
  "/profiles/setBio",
  ({ session, bio, user }) =>
    receive({ session, bio })
      .where(activeUser({ session }).is({ user }))
      .then(Profiling.setBio({ user, bio }))
      .then(respond({ user })),
  { input: { required: ["session", "bio"] } },
);

export const SetAvatar = endpoint(
  "/profiles/setAvatar",
  ({ session, avatar, user }) =>
    receive({ session, avatar })
      .where(activeUser({ session }).is({ user }))
      .then(Profiling.setAvatar({ user, avatar }))
      .then(respond({ user })),
  { input: { required: ["session", "avatar"] } },
);
export const SearchUsers = endpoint(
  "/users/search",
  ({ session, query, queryUser, user }) =>
    receive({ session, query }).then(
      where(
        activeUser({ session }).is({ user: queryUser }),
        isActiveCourseMember({ user: queryUser }),
      )
        .then(respond({ users: theUserSearch({ query }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), no(isActiveCourseMember({ user })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "query"] } },
);

export const ResolvePublicUser = endpoint("/users/resolve", ({ ref, user, username }) =>
  receive({ ref })
    .where(Authenticating._resolveIdentity({ ref }).is({ user, username }))
    .then(respond({ user, username })),
);
