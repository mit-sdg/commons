import { activeUser } from "../access/session.ts";
import { each, former, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { mayAdminister, mayModerate, mayNotAdminister, mayNotModerate } from "../access/policy.ts";
import { concepts } from "../../concepts/index.ts";
import { notReadable, readable } from "./posts.ts";

const { Categorizing, Trashing } = concepts;

/** Which categories exist? */
export const theCategories = former(
  "the categories ()",
  (_inputs, { category, name, description }) =>
    each(Categorizing._getAllCategories({}).is({ category, name, description })).form({
      category,
      name,
      description,
    }),
);

/** Which items are in this category? */
export const theItemsIn = former("the items in (category)", ({ category }, { item }) =>
  each(Categorizing._getItems({ category }).is({ item }))
    .where(readable({ post: item }))
    .form({ item }),
);
/** Which category contains this item? */
export const theCategoryOf = former(
  "the category of (item)",
  ({ item }, { category, name, description }) =>
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
    receive({ session, name, description }).then(
      where(activeUser({ session }).is({ user }), mayAdminister({ user }))
        .then(Categorizing.createCategory({ name, description }).responds({ category }))
        .then(respond({ category }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotAdminister({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const DeleteCategory = endpoint(
  "/categories/delete",
  ({ session, category, user, deleted }) =>
    receive({ session, category }).then(
      where(activeUser({ session }).is({ user }), mayAdminister({ user }))
        .then(Categorizing.deleteCategory({ category }).responds({ category: deleted }))
        .then(respond({ category: deleted }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotAdminister({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const AssignCategory = endpoint(
  "/categories/assign",
  ({ session, item, category, user, assigned }) =>
    receive({ session, item, category }).then(
      where(activeUser({ session }).is({ user }), mayModerate({ user }), readable({ post: item }))
        .then(Categorizing.assign({ item, category }).responds({ item: assigned }))
        .then(respond({ item: assigned }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        notReadable({ post: item }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);

export const UnassignCategory = endpoint(
  "/categories/unassign",
  ({ session, item, user, unassigned }) =>
    receive({ session, item }).then(
      where(activeUser({ session }).is({ user }), mayModerate({ user }), readable({ post: item }))
        .then(Categorizing.unassign({ item }).responds({ item: unassigned }))
        .then(respond({ item: unassigned }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotModerate({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(
        activeUser({ session }).is({ user }),
        mayModerate({ user }),
        notReadable({ post: item }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
);

export const ListCategories = endpoint("/categories/list", () =>
  receive({}).then(respond({ categories: theCategories({}) })),
);

export const CategoryItems = endpoint("/categories/items", ({ category }) =>
  receive({ category }).then(respond({ items: theItemsIn({ category }) })),
);

export const CategoryForItem = endpoint("/categories/forItem", ({ item }) =>
  receive({ item }).then(
    where(readable({ post: item }))
      .then(respond({ category: theCategoryOf({ item }) }))
      .named("success"),
    where(notReadable({ post: item }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
  ),
);
