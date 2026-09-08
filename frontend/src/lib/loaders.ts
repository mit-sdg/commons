import { api, CommonsError, unwrap } from "@/lib/api";
import { COMMONS_CONTEXT } from "@/lib/auth";
import type {
  Category,
  ConversationPreview,
  FeedEntry,
  Profile,
  RoleOfUser,
  Tag,
  ThreadNode,
} from "@/lib/models";

export async function loadFeedIndex(
  order: "latest" | "activity",
): Promise<FeedEntry[]> {
  return unwrap(await api.threads.index({ order })).conversations;
}

export async function loadThreadSummaries(
  conversations: string[],
): Promise<ConversationPreview[]> {
  const rows: ConversationPreview[] = [];
  const unique = [...new Set(conversations)];
  for (let offset = 0; offset < unique.length; offset += 25) {
    rows.push(
      ...unwrap(
        await api.threads.summaries({
          conversations: unique.slice(offset, offset + 25),
        }),
      ).conversations,
    );
  }
  const byId = new Map(rows.map((row) => [String(row.conversation), row]));
  return unique.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
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
  audience: import("@/lib/api").Output<"/audiences/forConversation">["holders"];
  nodes: ThreadNode[];
  root: ThreadNode | null;
  rootNodeId: string;
  structure: import("@/lib/api").Output<"/threads/get">["context"][number]["structure"];
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
  const details = context[0];
  if (!details) throw new CommonsError("Conversation not found");
  return {
    audience: details.audience,
    nodes,
    root: nodes.find((node) => node.node === details.root) ?? null,
    rootNodeId: details.root,
    structure: details.structure,
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
  return unwrap(await api.roles.forUser({ user, context: COMMONS_CONTEXT }));
}
