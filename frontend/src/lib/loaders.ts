import { api, CommonsError, unwrap } from "@/lib/api";
import { FORUM_CONTEXT } from "@/lib/auth";
import type {
  Category,
  ConversationSummary,
  Profile,
  RoleOfUser,
  Tag,
  ThreadNode,
} from "@/lib/models";

export async function loadFeed(
  sort: "latest" | "activity" = "latest",
): Promise<ConversationSummary[]> {
  const result =
    sort === "activity"
      ? await api.threads.activity({})
      : await api.threads.latest({});
  const { conversations } = unwrap(result);
  return conversations;
}

export async function loadUserOverview(user: string): Promise<{
  profile: Profile;
  postIds: string[];
}> {
  const [profileRes, postsRes] = await Promise.all([
    api.profiles.get({ user }),
    api.posts.byAuthor({ author: user }),
  ]);
  const { profile } = unwrap(profileRes);
  const { posts } = unwrap(postsRes);
  return { profile, postIds: posts.map((p) => String(p.post)) };
}

export interface ThreadPage {
  nodes: ThreadNode[];
  root: ThreadNode;
  questionId: string;
  category: Category | null;
  tags: Tag[];
  locked: boolean;
  acceptedAnswer: string | null;
  replyCount: number;
}

export async function loadThreadPage(
  conversation: string,
): Promise<ThreadPage> {
  const { thread: nodes, context } = unwrap(
    await api.threads.get({ conversation }),
  );
  const root = nodes[0];
  const details = context[0];
  if (!root || !details) throw new CommonsError("Conversation not found");
  return {
    nodes,
    root,
    questionId: String(details.item),
    category: details.category,
    tags: details.tags,
    locked: details.locked,
    acceptedAnswer: details.acceptedAnswer,
    replyCount: details.replyCount,
  };
}

export async function loadPostConversationIndex(
  items: string[],
): Promise<Record<string, string>> {
  const uniqueItems = [...new Set(items)];
  const entries = await Promise.all(
    uniqueItems.map(async (item) => {
      const { conversation } = unwrap(await api.threads.forItem({ item }));
      return [item, conversation ? String(conversation) : null] as const;
    }),
  );

  const index: Record<string, string> = {};
  for (const [item, conversation] of entries) {
    if (conversation) index[item] = conversation;
  }
  return index;
}

/** One request answers the role and its capabilities; there is no follow-up fetch. */
export async function loadUserRole(user: string): Promise<RoleOfUser> {
  return unwrap(await api.roles.forUser({ user, context: FORUM_CONTEXT }));
}
