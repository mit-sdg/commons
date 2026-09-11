/**
 * Unfinished posts, kept in this browser.
 *
 * A composer that names a draft slot keeps what its author typed, so leaving a
 * half-written post to read the thread that prompted it does not throw the
 * writing away. A draft is local and stays local: it lives in this browser's
 * local storage and never reaches the server, so it is readable by nobody
 * else and does not follow its author to another machine. Each slot is held
 * under the account that typed it, so two people sharing a machine never read
 * each other's writing.
 */

const PREFIX = "commons-draft";

/** A draft nobody has touched for this long is abandoned, not unfinished. */
const LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

/** How long a composer waits after the last keystroke before it keeps the draft. */
export const DRAFT_SAVE_DELAY_MS = 500;

/**
 * A post being written: its body, the title a new discussion also carries, and
 * the audience that discussion was addressed to.
 */
export interface Draft {
  body: string;
  title: string;
  holders: string[];
  savedAt: number;
}

/** The part of `Storage` drafts use, so a test can stand in for the browser's. */
export interface DraftStore {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The slot one author's draft for one composer lives in. */
export function draftSlot(author: string, scope: string): string {
  return `${PREFIX}:${author}:${scope}`;
}

/** A draft holds writing. An audience alone is a selection, not a post. */
function hasWriting(draft: Draft): boolean {
  return !!draft.body.trim() || !!draft.title.trim();
}

function parse(raw: string | null): Draft | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    const holders = Array.isArray(record.holders)
      ? record.holders.filter(
          (holder): holder is string => typeof holder === "string",
        )
      : [];
    return {
      body: typeof record.body === "string" ? record.body : "",
      title: typeof record.title === "string" ? record.title : "",
      holders,
      savedAt: typeof record.savedAt === "number" ? record.savedAt : 0,
    };
  } catch {
    // Anything this browser cannot read back is not a draft anyone can resume.
    return null;
  }
}

export function readDraftIn(
  store: DraftStore,
  author: string,
  scope: string,
  now: number = Date.now(),
): Draft | null {
  const slot = draftSlot(author, scope);
  const draft = parse(store.getItem(slot));
  if (draft === null) return null;
  if (now - draft.savedAt > LIFETIME_MS) {
    store.removeItem(slot);
    return null;
  }
  return hasWriting(draft) ? draft : null;
}

/**
 * Keeps the named parts of a draft, leaving the rest of it as it stands: the
 * composer keeps a body while the page around it keeps a title and an
 * audience, and neither erases the other. A draft left without writing is
 * dropped rather than kept empty.
 */
export function saveDraftIn(
  store: DraftStore,
  author: string,
  scope: string,
  parts: Partial<Omit<Draft, "savedAt">>,
  now: number = Date.now(),
): Draft | null {
  const slot = draftSlot(author, scope);
  const current = parse(store.getItem(slot));
  const next: Draft = {
    body: parts.body ?? current?.body ?? "",
    title: parts.title ?? current?.title ?? "",
    holders: parts.holders ?? current?.holders ?? [],
    savedAt: now,
  };
  if (!hasWriting(next)) {
    store.removeItem(slot);
    return null;
  }
  store.setItem(slot, JSON.stringify(next));
  return next;
}

export function clearDraftIn(
  store: DraftStore,
  author: string,
  scope: string,
): void {
  store.removeItem(draftSlot(author, scope));
}

/** Drops every abandoned draft, whoever wrote it. */
export function sweepDraftsIn(
  store: DraftStore,
  now: number = Date.now(),
): void {
  const stale: string[] = [];
  for (let index = 0; index < store.length; index++) {
    const slot = store.key(index);
    if (slot === null || !slot.startsWith(`${PREFIX}:`)) continue;
    const draft = parse(store.getItem(slot));
    if (draft === null || now - draft.savedAt > LIFETIME_MS) stale.push(slot);
  }
  for (const slot of stale) store.removeItem(slot);
}

let swept = false;

/**
 * This browser's own store, once it has one. A browser that refuses local
 * storage still composes; only resuming a draft is lost, so every reader and
 * writer below treats a missing store as an empty one.
 */
function browserStore(): DraftStore | null {
  try {
    const store = window.localStorage;
    if (!swept) {
      swept = true;
      sweepDraftsIn(store);
    }
    return store;
  } catch {
    return null;
  }
}

export function readDraft(author: string, scope: string): Draft | null {
  const store = browserStore();
  if (store === null) return null;
  try {
    return readDraftIn(store, author, scope);
  } catch {
    return null;
  }
}

export function saveDraft(
  author: string,
  scope: string,
  parts: Partial<Omit<Draft, "savedAt">>,
): void {
  const store = browserStore();
  if (store === null) return;
  try {
    saveDraftIn(store, author, scope, parts);
  } catch {
    // A full or refused store keeps the composer working; the draft is not kept.
  }
}

/** Whether an unfinished post is waiting in this slot. */
export function hasDraft(author: string, scope: string): boolean {
  return readDraft(author, scope) !== null;
}

export function clearDraft(author: string, scope: string): void {
  const store = browserStore();
  if (store === null) return;
  try {
    clearDraftIn(store, author, scope);
  } catch {
    // Nothing to do: the draft this clears was never kept.
  }
}

/** Names the slot a discussion's replies are drafted under. */
export function replyScope(conversation: string, node?: string): string {
  return node === undefined
    ? `reply:${conversation}`
    : `reply:${conversation}:${node}`;
}

/** Names the slot a new discussion is drafted under, one per audience it opens with. */
export function newDiscussionScope(audience: string): string {
  return `discussion:${audience}`;
}
