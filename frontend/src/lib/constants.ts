export const REACTION_KINDS = [
  "👍",
  "❤️",
  "🎉",
  "😄",
  "😮",
  "🤔",
  "👀",
  "🙏",
] as const;

export type ReactionKind = (typeof REACTION_KINDS)[number];
