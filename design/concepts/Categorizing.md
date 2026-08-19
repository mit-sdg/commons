# Categorizing

## Purpose

Sort items into named categories. Each item belongs to at most one category, so
its home and each category's contents can be read directly.

## Principle

Priya creates a Homework category and assigns a quiz to it. Assigning the quiz
to Exams moves it there. Unassigning it leaves it with no category, and a
second unassignment is refused. A second category named Homework is also
refused, and asking again for the category named Homework reaches the one that
already exists rather than making another. Renaming Exams to Homework is
refused for the same reason. Deleting Exams leaves every item in it
uncategorized.

## Types

```types
external Item
  An application-owned identity used in the item role.
```

## State

```state
a set of Categories with
  a name        String
  a description String

a set of Categorized with
  an item Item
  a home Category

Rule: at most one categorized entry has each item, so an item belongs to at most one category.
Rule: items are opaque identities; Categorizing neither creates nor validates them.
```

## Actions

```actions
createCategory(name: String, description: String) : return (category: Category)
  where no category has this name
  then
    add a new category with name and description
    return category
  where some category has this name
  then
    refuse CATEGORY_ALREADY_EXISTS "A category with this name already exists."

ensureCategory(name: String, description: String) : return (category: Category)
  where some category has this name
  then
    return category
  where no category has this name
  then
    add a new category with name and description
    return category

renameCategory(category: Category, name: String) : return (category: Category)
  where category in categories and no other category has this name
  then
    set category's name to name
    return category
  where category not in categories
  then
    refuse CATEGORY_NOT_FOUND "There is no such category."
  where category in categories and another category has this name
  then
    refuse CATEGORY_ALREADY_EXISTS "A category with this name already exists."

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

_getCategoryDetail (category: String) : optional (name: String, description: String)
  answers the Category's own name and description
  answers no row when the Category does not exist

_getHome (item: String) : optional (home: Category)
  answers the Category containing the Item under home
  answers no row when the Item is uncategorized

_getItems (category: String) : many (item: String)
  answers its items in assignment order
  answers no rows when none match

_getAllCategories () : many (category: String, name: String, description: String)
  answers every category in creation order
  answers no rows when none match
```
