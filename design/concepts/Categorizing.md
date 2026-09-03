# Categorizing

## Purpose

Sort items into named categories within a scope. Each item belongs to at most
one category, so its home and each category's contents can be read directly,
and two scopes may each have a category of the same name without confusion.

## Principle

Priya creates a Homework category in the course forum and assigns a quiz to
it. Assigning the quiz to Exams moves it there. Unassigning it leaves it with
no category, and a second unassignment is refused. A second category named
Homework in the forum is also refused, and asking again for the category named
Homework reaches the one that already exists rather than making another — while
a Homework category in a different scope is simply another category. Renaming
Exams to Homework is refused for the same reason. She describes Exams in a
sentence so its contents are explained on sight. Finding that Tests and Exams
hold the same kind of thing, she merges Tests into Exams: every item of Tests
now lives in Exams and Tests is gone; merging a category into itself is
refused. Deleting Exams leaves every item in it uncategorized.

## Types

```types
external Scope
  An application-owned identity for the space a category's name is unique within.

external Item
  An application-owned identity used in the item role.
```

## State

```state
a set of Categories with
  a scope       Scope
  a name        String
  a description String

a set of Categorized with
  an item Item
  a home Category

Rule: at most one categorized entry has each item, so an item belongs to at most one category.
Rule: a category's name is unique within its scope; the same name in another scope names another category.
Rule: a category's scope is fixed when it is created.
Rule: items and scopes are opaque identities; Categorizing neither creates nor validates them.
```

## Actions

```actions
createCategory(scope: Scope, name: String, description: String) : return (category: Category)
  where no category in scope has this name
  then
    add a new category with scope, name, and description
    return category
  where some category in scope has this name
  then
    refuse CATEGORY_ALREADY_EXISTS "A category with this name already exists."

ensureCategory(scope: Scope, name: String, description: String) : return (category: Category)
  where some category in scope has this name
  then
    return category
  where no category in scope has this name
  then
    add a new category with scope, name, and description
    return category

renameCategory(category: Category, name: String) : return (category: Category)
  where category in categories and no other category in its scope has this name
  then
    set category's name to name
    return category
  where category not in categories
  then
    refuse CATEGORY_NOT_FOUND "There is no such category."
  where category in categories and another category in its scope has this name
  then
    refuse CATEGORY_ALREADY_EXISTS "A category with this name already exists."

describeCategory(category: Category, description: String) : return (category: Category)
  where category in categories
  then
    set category's description to description
    return category
  where category not in categories
  then
    refuse CATEGORY_NOT_FOUND "There is no such category."

mergeCategory(category: Category, into: Category) : return (into: Category)
  where category and into are in categories, differ, and share a scope
  then
    set the home of every item whose home is category to into
    delete category
    return into
  where category not in categories or into not in categories
  then
    refuse CATEGORY_NOT_FOUND "There is no such category."
  where category is into
  then
    refuse SAME_CATEGORY "A category cannot be merged into itself."
  where category and into do not share a scope
  then
    refuse DIFFERENT_SCOPES "These categories are not in the same scope."

assign(item: Item, category: Category) : return (item: Item)
  where category in categories
  then
    set item's home to category, replacing any prior home
    return item
  where category not in categories
  then
    refuse CATEGORY_NOT_FOUND "There is no such category."
unassign(item: Item) : return (item: Item)
  where item in categorized
  then
    remove item from categorized
    return item
  where item not in categorized
  then
    refuse ITEM_NOT_CATEGORIZED "This item is not in any category."
deleteCategory(category: Category) : return (category: Category)
  where category in categories
  then
    remove every item whose home is category from categorized
    delete category
    return category
  where category not in categories
  then
    refuse CATEGORY_NOT_FOUND "There is no such category."
```

## Queries

```queries
_getCategory (item: String) : optional (category: String, name: String, description: String)
  answers the Category containing the Item with its name and description
  answers no row when the Item is uncategorized

_getCategoryDetail (category: String) : optional (scope: String, name: String, description: String)
  answers the Category's own scope, name, and description
  answers no row when the Category does not exist

_getHome (item: String) : optional (home: Category)
  answers the Category containing the Item under home
  answers no row when the Item is uncategorized

_getItems (category: String) : many (item: String)
  answers its items in assignment order
  answers no rows when none match

_categoriesIn (scope: String) : many (category: String, name: String, description: String)
  answers the scope's categories in creation order
  answers no rows when none match

_categoriesWithItems (scope: String) : one (categories: Seq)
  answers the scope's categories back as one value: an ordered sequence of
  `{ category, name, description, items }` entries in creation order, each
  items entry the category's items in assignment order
  answers an empty sequence when the scope has no categories
```
