import { activeUser } from "../access/session.ts";
import {
  compute,
  each,
  form,
  former,
  is,
  no,
  view,
  where,
  whether,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { COMMONS } from "../access/capabilities.ts";
import { isActiveCourseMember, mayManageCourse, mayNotManageCourse } from "../access/policy.ts";
import { theRoleFaceOf, theRoleNameOf } from "../access/roles.ts";
import { concepts, computations } from "../../concepts.ts";
import { thePostSummaryOf, thePrivateProfileOf, theProfileFaceOf } from "./fragments.ts";
import { postReader } from "./audience-policy.ts";

const { Authenticating, Conversing, Posting, Profiling } = concepts;

export const profileDisplayReader = view(
  "(session) may read the display identity of (user)",
  ({ session, user }, _out, { reader }) => [
    where(activeUser({ session }).is({ user })),
    where(activeUser({ session }).is({ user: reader }), mayManageCourse({ user: reader })),
    where(activeUser({ session }).is({ user: reader }), isActiveCourseMember({ user: reader })),
  ],
).holds();

/**
 * Which display identities may this reader see? Each carries the name of the
 * role its person holds in the course, if any, so a forum can mark staff next
 * to their names without a second read per author.
 */
export const theProfileDisplays = former(
  "the display identities of (users) for (session)",
  ({ users, session }, { user, displayName, avatar }) =>
    each(Profiling._getProfilesOf({ users }).is({ user, displayName, avatar }))
      .where(profileDisplayReader({ session, user }))
      .form({
        user,
        displayName,
        avatar,
        role: whether(theRoleNameOf({ user, context: COMMONS })),
      }),
);

export const GetProfileDisplays = endpoint(
  "/profiles/displays",
  ({ session, users, valid }) =>
    receive({ session, users })
      .where(activeUser({ session }), compute(computations.validProfileSelection, { users }, valid))
      .then(
        where(is.among(valid, [true]))
          .then(respond({ profiles: theProfileDisplays({ users, session }) }))
          .named("valid"),
        where(is.among(valid, [false]))
          .then(respond({ error: "INVALID_REQUEST" }))
          .named("invalid"),
      ),
  { input: { required: ["session", "users"] } },
);
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
  "the user page of (user) for (reader)",
  ({ user, reader }, { post, node, conversation }) =>
    form({
      profile: whether(theProfileFaceOf({ user })),
      role: whether(theRoleFaceOf({ user, context: COMMONS })),
      posts: each(Posting._getByAuthor({ author: user }).is({ post }))
        .where(
          postReader({ user: reader, post }),
          whether(Conversing._getNodeByItem({ item: post }).is({ node })),
          whether(Conversing._getConversation({ node }).is({ conversation })),
        )
        .form({
          item: post,
          conversation,
          post: whether(thePostSummaryOf({ item: post, reader })),
        }),
    }),
);

export const GetProfile = endpoint(
  "/profiles/get",
  ({ session, user, reader }) =>
    receive({ session, user }).then(
      where(activeUser({ session }).is({ user }), theProfileOf({ user }))
        .then(respond({ profile: thePrivateProfileOf({ user }) }))
        .named("success"),
      where(
        activeUser({ session }).is({ user: reader }).is.not({ user }),
        mayManageCourse({ user: reader }),
        theProfileOf({ user }),
      )
        .then(respond({ profile: thePrivateProfileOf({ user }) }))
        .named("staff"),
      where(
        activeUser({ session }).is({ user: reader }).is.not({ user }),
        isActiveCourseMember({ user: reader }),
        mayNotManageCourse({ user: reader }),
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
        mayNotManageCourse({ user: reader }),
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
