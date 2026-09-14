import { expect } from "@playwright/test";
import { authenticate, call, test } from "./support/browser";

interface Posted {
  post: string;
  node: string;
  conversation: string;
}

/**
 * A branching discussion, collapsed a branch at a time and all at once, and
 * the two ways replies come back into view: a deep link that lands inside a
 * collapsed branch, and a reply written to the post that hid them.
 */
test("collapsing a branch hides its replies until a link or a reply reopens it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { cookie, user } = await authenticate(page);
  const reply = (parent: string, content: string) =>
    call<Posted>(page, cookie, "/threads/reply", { parent, content });

  const root = await call<Posted>(page, cookie, "/threads/create", {
    content: "# Collapsing a branching thread\n\nHow far down does this go?",
    holders: [`account:${user}`],
  });
  const branch = await reply(root.node, "The reply that starts the deep branch.");
  const leaf = await reply(branch.node, "The deepest reply in that branch.");
  const sibling = await reply(root.node, "A reply beside the deep branch.");
  const cousin = await reply(sibling.node, "The reply under that sibling.");

  await page.goto(`/t/${root.conversation}`);
  const branchOf = (post: string) =>
    page.locator(".thread-branch-content").filter({ has: page.locator(`#post-${post}`) });
  const toggle = (post: string, name: string) => branchOf(post).getByRole("button", { name });
  await expect(page.locator(`#post-${leaf.post}`)).toBeVisible();

  // The opening post answers for every reply below it, at any depth.
  await toggle(root.post, "Hide 4 replies").click();
  for (const post of [branch, leaf, sibling, cousin]) {
    await expect(page.locator(`#post-${post.post}`)).toBeHidden();
  }
  await expect(toggle(root.post, "Show 4 replies")).toHaveAttribute("aria-expanded", "false");

  await toggle(root.post, "Show 4 replies").click();
  await expect(page.locator(`#post-${leaf.post}`)).toBeVisible();

  // A branch collapses without taking its siblings down with it.
  await toggle(branch.post, "Hide 1 reply").click();
  await expect(page.locator(`#post-${leaf.post}`)).toBeHidden();
  await expect(page.locator(`#post-${cousin.post}`)).toBeVisible();

  await page.getByRole("button", { name: "Collapse all" }).click();
  await expect(page.locator(`#post-${branch.post}`)).toBeHidden();
  await expect(page.getByRole("button", { name: "Expand all" })).toBeVisible();

  // The link a notification or a pinned post follows opens what hides its post,
  // and only that: the sibling branch stays collapsed.
  await page.evaluate(`window.location.hash = "#post-${leaf.post}"`);
  await expect(page.locator(`#post-${leaf.post}`)).toBeVisible();
  await expect(page.locator(`#post-${cousin.post}`)).toBeHidden();

  // Replying to a post that is hiding its replies shows them, and the new one.
  await toggle(branch.post, "Hide 1 reply").click();
  await expect(page.locator(`#post-${leaf.post}`)).toBeHidden();
  await branchOf(branch.post).getByRole("button", { name: "Reply", exact: true }).click();
  await branchOf(branch.post).getByPlaceholder("Write a reply…").fill("Answering from a fold.");
  await branchOf(branch.post).getByRole("button", { name: "Post reply", exact: true }).click();
  await expect(page.getByText("Answering from a fold.")).toBeVisible();
  await expect(page.locator(`#post-${leaf.post}`)).toBeVisible();
  await expect(toggle(branch.post, "Hide 2 replies")).toBeVisible();
});
