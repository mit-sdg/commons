import { activeUser } from "../access/session.ts";
import { each, former, reaction, when } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { mayAdminister, mayModerate, mayNotAdminister, mayNotModerate } from "../access/policy.ts";
import { concepts } from "../../concepts/index.ts";
import { notReadable, readable } from "./posts.ts";

const { Categorizing, Trashing } = concepts;

/** Which categories exist? */
export const theCategories = former("the categories ()", ({ category, name, description }) =>
  each(Categorizing._getAllCategories({}).is({ category, name, description })).form({
    category,
    name,
    description,
  }),
);

/** Which items are in this category? */
export const theItemsIn = former("the items in (category)", ({ category, item }) =>
  each(Categorizing._getItems({ category }).is({ item }))
    .where(readable({ post: item }))
    .form({ item }),
);
/** Which category contains this item? */
export const theCategoryOf = former(
  "the category of (item)",
  ({ item, category, name, description }) =>
    each(Categorizing._getCategory({ item }).is({ category, name, description })).form({
      category,
      name,
      description,
    }),
);

export const PurgeUnassignsCategory = reaction(({ item }) =>
  when(Trashing.purge({}).responds({ item }))
    .where(Categorizing._getCategory({ item }))
    .then(Categorizing.unassign({ item })),
);

export const CreateCategory = endpoint(
  "/categories/create",
  ({ session, name, description, user, category }) =>
    receive({ session, name, description })
      .where(activeUser({ session }).is({ user }), mayAdminister({ user }))
      .then(Categorizing.createCategory({ name, description }).responds({ category }))
      .then(respond({ category })),
);

export const CreateCategoryForbidden = endpoint(
  "/categories/create",
  ({ session, name, description, user }) =>
    receive({ session, name, description })
      .where(activeUser({ session }).is({ user }), mayNotAdminister({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const DeleteCategory = endpoint(
  "/categories/delete",
  ({ session, category, user, deleted }) =>
    receive({ session, category })
      .where(activeUser({ session }).is({ user }), mayAdminister({ user }))
      .then(Categorizing.deleteCategory({ category }).responds({ category: deleted }))
      .then(respond({ category: deleted })),
);

export const DeleteCategoryForbidden = endpoint(
  "/categories/delete",
  ({ session, category, user }) =>
    receive({ session, category })
      .where(activeUser({ session }).is({ user }), mayNotAdminister({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const AssignCategory = endpoint(
  "/categories/assign",
  ({ session, item, category, user, assigned }) =>
    receive({ session, item, category })
      .where(activeUser({ session }).is({ user }), mayModerate({ user }), readable({ post: item }))
      .then(Categorizing.assign({ item, category }).responds({ item: assigned }))
      .then(respond({ item: assigned })),
);

export const AssignCategoryForbidden = endpoint(
  "/categories/assign",
  ({ session, item, category, user }) =>
    receive({ session, item, category })
      .where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);
export const AssignCategoryHidden = endpoint(
  "/categories/assign",
  ({ session, item, category, user }) =>
    receive({ session, item, category })
      .where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        notReadable({ post: item }),
      )
      .then(respond({ error: "NOT_FOUND" })),
);

export const UnassignCategory = endpoint(
  "/categories/unassign",
  ({ session, item, user, unassigned }) =>
    receive({ session, item })
      .where(activeUser({ session }).is({ user }), mayModerate({ user }), readable({ post: item }))
      .then(Categorizing.unassign({ item }).responds({ item: unassigned }))
      .then(respond({ item: unassigned })),
);

export const UnassignCategoryForbidden = endpoint(
  "/categories/unassign",
  ({ session, item, user }) =>
    receive({ session, item })
      .where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);
export const UnassignCategoryHidden = endpoint("/categories/unassign", ({ session, item, user }) =>
  receive({ session, item })
    .where(activeUser({ session }).is({ user }), mayModerate({ user }), notReadable({ post: item }))
    .then(respond({ error: "NOT_FOUND" })),
);

export const ListCategories = endpoint("/categories/list", () =>
  receive({}).then(respond({ categories: theCategories() })),
);

export const CategoryItems = endpoint("/categories/items", ({ category }) =>
  receive({ category }).then(respond({ items: theItemsIn(category) })),
);

export const CategoryForItem = endpoint("/categories/forItem", ({ item }) =>
  receive({ item })
    .where(readable({ post: item }))
    .then(respond({ category: theCategoryOf(item) })),
);
export const CategoryForItemHidden = endpoint("/categories/forItem", ({ item }) =>
  receive({ item })
    .where(notReadable({ post: item }))
    .then(respond({ error: "NOT_FOUND" })),
);
