import { compute, is, view, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts, computations as c } from "../../concepts.ts";
import { STAFF_CAPABILITIES } from "../../computations/audiences.ts";
import { mayAdminister } from "../access/policy.ts";
const {
  Accessing,
  Authenticating,
  Archiving,
  Conversing,
  Grouping,
  Posting,
  Roling,
  Rostering,
  Sessioning,
  Trashing,
} = concepts;

export const usableUser = view("(user) is an available audience account", ({ user }, _out, _vars) =>
  where(
    Authenticating._getById({ user }),
    Archiving._isTrashed({ item: user }).is({ trashed: false }),
  ),
).holds();
export const forumReader = view(
  "the audience reader of (session)",
  ({ session }, { user }, _vars) =>
    where(Sessioning._getUser({ session }).is({ user }), usableUser({ user })),
).optional();
export const staff = view(
  "(user) belongs to Staff",
  ({ user }, _out, { role, capabilities, allowed }) =>
    where(
      Roling._getRole({ user, context: "commons" }).is({ role }),
      Roling._getRoleDetail({ role }).is({ capabilities }),
      compute(c.staffCapabilities, { capabilities }, allowed),
      is.among(allowed, [true]),
    ),
).holds();
export const community = view(
  "(user) is in the current course community",
  ({ user }, _out, _vars) => [
    where(Rostering._getSeatByUser({ user }).is({ status: "ACTIVE" })),
    where(staff({ user })),
  ],
).holds();
export const audienceMember = view(
  "(holders) admit (user)",
  (
    { holders, user },
    _out,
    {
      groups,
      groupMember,
      section,
      sections,
      activeSections,
      seatStatus,
      activeStudent,
      role,
      capabilities,
      allowed,
    },
  ) =>
    where(
      compute(c.selectedIdentities, { holders, kind: "group" }, groups),
      Grouping._anyMembership({ member: user, groups }).is({ included: groupMember }),
      whether(Rostering._getSeatByUser({ user }).is({ section, status: seatStatus })),
      compute(c.selectedSection, { section }, sections),
      Rostering._activeSections({ sections }).is({ active: activeSections }),
      Rostering._isActiveStudent({ user }).is({ active: activeStudent }),
      whether(Roling._getRole({ user, context: "commons" }).is({ role })),
      whether(Roling._getRoleDetail({ role }).is({ capabilities })),
      compute(
        c.currentAudienceMembership,
        {
          user,
          holders,
          groupMember,
          activeSections,
          section,
          seatStatus,
          activeStudent,
          capabilities,
        },
        allowed,
      ),
      is.among(allowed, [true]),
    ),
).holds();
/** Administration grants discussion access, not membership or new addressing choices. */
export const discussionAudienceReader = view(
  "(user) may read discussions addressed to (holders)",
  ({ user, holders }, _out, _vars) => [
    where(mayAdminister({ user })),
    where(audienceMember({ user, holders })),
  ],
).holds();
export const establishedConversationReader = view(
  "(user) may read established conversation (conversation)",
  ({ user, conversation }, _out, { holders }) =>
    where(
      usableUser({ user }),
      Accessing._holders({ resource: conversation }).is({ holders }),
      discussionAudienceReader({ user, holders }),
      Conversing._exists({ conversation }).is({ exists: true }),
    ),
).holds();
export const conversationPosts = view(
  "the stored posts in (conversation) for (user)",
  ({ user, conversation }, { nodes, posts }, { items }) =>
    where(
      establishedConversationReader({ user, conversation }),
      Conversing._threadNodes({ conversation }).is({ nodes }),
      compute(c.threadPostIds, { nodes }, items),
      Posting._postMetadata({ posts: items }).is({ posts }),
    ),
).optional();
export const conversationReader = view(
  "(user) may read audience conversation (conversation)",
  ({ user, conversation }, _out, { posts, present }) =>
    where(
      conversationPosts({ user, conversation }).is({ posts }),
      compute(c.hasStoredPosts, { posts }, present),
      is.among(present, [true]),
    ),
).holds();

export const postConversation = view(
  "the structural conversation containing post (post)",
  ({ post }, { conversation }, { node }) =>
    where(
      Conversing._getNodeByItem({ item: post }).is({ node }),
      Conversing._getConversation({ node }).is({ conversation }),
    ),
).optional();
export const storedPostReader = view(
  "(user) may inspect stored forum post (post)",
  ({ user, post }, _out, { conversation }) =>
    where(
      postConversation({ post }).is({ conversation }),
      establishedConversationReader({ user, conversation }),
      Posting._getPost({ post }),
    ),
).holds();
export const postReader = view(
  "(user) may read forum post (post)",
  ({ user, post }, _out, { conversation }) =>
    where(
      postConversation({ post }).is({ conversation }),
      establishedConversationReader({ user, conversation }),
      Posting._getPost({ post }),
      Trashing._isTrashed({ item: post }).is({ trashed: false }),
    ),
).holds();
export const targetReader = view(
  "(user) may read forum target (target)",
  ({ user, target }, _out, _vars) => [
    where(postReader({ user, post: target })),
    where(conversationReader({ user, conversation: target })),
  ],
).holds();
export const addressableAccount = view(
  "(user) may address account (recipient)",
  ({ user, recipient }, _out, _vars) =>
    where(
      usableUser({ user }),
      community({ user }),
      usableUser({ user: recipient }),
      community({ user: recipient }),
    ),
).holds();
export const addressableSection = view(
  "(user) may address section (section)",
  ({ user, section }, _out, _vars) => [
    where(Rostering._getSections({}).is({ section, status: "ACTIVE" }), staff({ user })),
    where(
      Rostering._getSections({}).is({ section, status: "ACTIVE" }),
      Rostering._getSeatByUser({ user }).is({ status: "ACTIVE", section }),
    ),
  ],
).holds();

export const addressableHolder = view(
  "the addressable holders for (user)",
  ({ user }, { holder }, { recipient, group, section }) => [
    where(
      Authenticating._getUsers({}).is({ user: recipient }),
      addressableAccount({ user, recipient }),
      compute(c.holderCode, { kind: "account", identity: recipient }, holder),
    ),
    where(
      usableUser({ user }),
      community({ user }),
      Grouping._getGroupsOf({ member: user }).is({ group }),
      compute(c.holderCode, { kind: "group", identity: group }, holder),
    ),
    where(
      usableUser({ user }),
      community({ user }),
      Rostering._getSections({}).is({ section, status: "ACTIVE" }),
      addressableSection({ user, section }),
      compute(c.holderCode, { kind: "section", identity: section }, holder),
    ),
    where(
      usableUser({ user }),
      community({ user }),
      compute(c.holderCode, { kind: "standing", identity: "everyone" }, holder),
    ),
    where(
      usableUser({ user }),
      community({ user }),
      compute(c.holderCode, { kind: "standing", identity: "staff" }, holder),
    ),
    where(
      usableUser({ user }),
      staff({ user }),
      compute(c.holderCode, { kind: "standing", identity: "students" }, holder),
    ),
  ],
).many();
export const addressedAudience = view(
  "(user) may currently address the complete audience (holders)",
  (
    { user, holders },
    _out,
    {
      people,
      groupIds,
      sectionIds,
      known,
      activePeople,
      staffPeople,
      trashed,
      groups,
      sections,
      ownSection,
      valid,
    },
  ) =>
    where(
      usableUser({ user }),
      community({ user }),
      compute(c.addressingPeople, { user, holders }, people),
      compute(c.selectedIdentities, { holders, kind: "group" }, groupIds),
      compute(c.selectedIdentities, { holders, kind: "section" }, sectionIds),
      Authenticating._knownUsers({ users: people }).is({ known }),
      Rostering._activeUsers({ users: people }).is({ active: activePeople }),
      Roling._capableUsers({
        users: people,
        context: "commons",
        capabilities: [...STAFF_CAPABILITIES],
      }).is({ capable: staffPeople }),
      Archiving._anyTrashed({ items: people }).is({ trashed }),
      Grouping._allMemberships({ member: user, groups: groupIds }).is({ included: groups }),
      Rostering._activeSections({ sections: sectionIds }).is({ active: sections }),
      whether(Rostering._getSeatByUser({ user }).is({ status: "ACTIVE", section: ownSection })),
      compute(
        c.currentAddressing,
        { user, holders, known, activePeople, staffPeople, trashed, groups, sections, ownSection },
        valid,
      ),
      is.among(valid, [true]),
      audienceMember({ user, holders }),
    ),
).holds();
