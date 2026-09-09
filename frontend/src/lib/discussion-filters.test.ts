import { expect, test } from "bun:test";
import { matchesDiscussionAudience as matches } from "./discussion-filters";

const audience = (...holders: string[]) =>
  holders.map((holder) => ({ holder }));

test("course-wide and private partition accessible discussions", () => {
  for (const holders of [
    audience("standing:everyone"),
    audience("standing:staff"),
    audience("account:mara", "standing:staff"),
    audience("group:faculty"),
    audience("standing:everyone", "standing:staff"),
  ]) {
    expect(matches(holders, "all")).toBe(true);
    expect(matches(holders, "everyone")).toBe(!matches(holders, "private"));
  }
});

test("To Staff includes Staff-only and direct-plus-Staff, but excludes course-wide", () => {
  expect(matches(audience("standing:staff"), "staff")).toBe(true);
  expect(matches(audience("account:mara", "standing:staff"), "staff")).toBe(
    true,
  );
  expect(
    matches(audience("standing:everyone", "standing:staff"), "staff"),
  ).toBe(false);
  expect(matches(audience("group:faculty"), "staff")).toBe(false);
});

test("recipient filtering matches explicit recipients and intersects the selected view", () => {
  const group = audience("group:faculty");
  expect(matches(group, "private", "group:faculty")).toBe(true);
  expect(matches(group, "everyone", "group:faculty")).toBe(false);
  expect(matches(group, "all", "account:mara")).toBe(false);
  expect(matches(group, "all", "")).toBe(true);
});
