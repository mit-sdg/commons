import { expect, test } from "bun:test";
import {
  clearDraftIn,
  type DraftStore,
  draftSlot,
  newDiscussionScope,
  readDraftIn,
  replyScope,
  saveDraftIn,
  sweepDraftsIn,
} from "./drafts";

class FakeStore implements DraftStore {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

test("a kept draft comes back to the author who wrote it", () => {
  const store = new FakeStore();
  saveDraftIn(store, "alice", replyScope("c1"), { body: "half a thought" }, 10);
  expect(readDraftIn(store, "alice", replyScope("c1"), 20)?.body).toBe(
    "half a thought",
  );
  expect(readDraftIn(store, "bob", replyScope("c1"), 20)).toBeNull();
  expect(readDraftIn(store, "alice", replyScope("c2"), 20)).toBeNull();
});

test("the composer's body and the page's title and audience merge in one draft", () => {
  const store = new FakeStore();
  const scope = newDiscussionScope("standing:everyone");
  saveDraftIn(store, "alice", scope, { body: "the opening post" }, 10);
  saveDraftIn(
    store,
    "alice",
    scope,
    { title: "Pset 3", holders: ["standing:staff"] },
    20,
  );
  expect(readDraftIn(store, "alice", scope, 30)).toEqual({
    body: "the opening post",
    title: "Pset 3",
    holders: ["standing:staff"],
    savedAt: 20,
  });
});

test("an audience alone is a selection, not a draft to resume", () => {
  const store = new FakeStore();
  const scope = newDiscussionScope("standing:everyone");
  saveDraftIn(store, "alice", scope, { holders: ["standing:staff"] }, 10);
  expect(readDraftIn(store, "alice", scope, 20)).toBeNull();
  expect(store.length).toBe(0);
});

test("emptying a draft drops it rather than keeping an empty one", () => {
  const store = new FakeStore();
  const scope = replyScope("c1", "n1");
  saveDraftIn(store, "alice", scope, { body: "typed" }, 10);
  saveDraftIn(store, "alice", scope, { body: "   " }, 20);
  expect(readDraftIn(store, "alice", scope, 30)).toBeNull();
  expect(store.length).toBe(0);
});

test("clearing a draft leaves the drafts beside it", () => {
  const store = new FakeStore();
  saveDraftIn(store, "alice", replyScope("c1"), { body: "one" }, 10);
  saveDraftIn(store, "alice", replyScope("c2"), { body: "two" }, 10);
  clearDraftIn(store, "alice", replyScope("c1"));
  expect(readDraftIn(store, "alice", replyScope("c1"), 20)).toBeNull();
  expect(readDraftIn(store, "alice", replyScope("c2"), 20)?.body).toBe("two");
});

test("an abandoned draft is not resumed, and is dropped when it is read", () => {
  const store = new FakeStore();
  const scope = replyScope("c1");
  saveDraftIn(store, "alice", scope, { body: "last month" }, 0);
  expect(readDraftIn(store, "alice", scope, 15 * DAY_MS)).toBeNull();
  expect(store.length).toBe(0);
});

test("a sweep drops abandoned and unreadable drafts, whoever wrote them", () => {
  const store = new FakeStore();
  saveDraftIn(store, "alice", replyScope("c1"), { body: "stale" }, 0);
  saveDraftIn(store, "bob", replyScope("c2"), { body: "fresh" }, 15 * DAY_MS);
  store.setItem(draftSlot("alice", replyScope("c3")), "not json");
  store.setItem("commons-live-draft-brief:alice", "another feature's slot");
  sweepDraftsIn(store, 15 * DAY_MS);
  expect(store.length).toBe(2);
  expect(readDraftIn(store, "bob", replyScope("c2"), 15 * DAY_MS)?.body).toBe(
    "fresh",
  );
  expect(store.getItem("commons-live-draft-brief:alice")).toBe(
    "another feature's slot",
  );
});

test("a draft this browser cannot read back is not resumed", () => {
  const store = new FakeStore();
  store.setItem(draftSlot("alice", replyScope("c1")), "{ truncated");
  expect(readDraftIn(store, "alice", replyScope("c1"), 10)).toBeNull();
});

test("replies draft against their post, and the discussion against its own slot", () => {
  expect(replyScope("c1")).not.toBe(replyScope("c1", "n1"));
  expect(newDiscussionScope("group:g1")).not.toBe(
    newDiscussionScope("standing:everyone"),
  );
});
