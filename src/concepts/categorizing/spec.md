# Categorizing

## Purpose

Sort items into named categories. Each item belongs to at most one category, so
its home and each category's contents can be read directly.

## Principle

Priya creates a Homework category and assigns a quiz to it. Assigning the quiz
to Exams moves it there. Unassigning it leaves it with no category, and a
second unassignment is refused. A second category named Homework is also
refused. Deleting Exams leaves every item in it uncategorized.

## State

```state
a set of Categories with
  a name        String
  a description String

a Categorized set of Items with
  a home Category
```

## Actions

```actions
createCategory (name: String, description: String) : return (category: Category), refuse (message: String)
  where no category has this name
  then
    add a new category with name and description
    return category
  where some category has this name
  then
    refuse "A category with this name already exists."

assign (item: Item, category: Category) : return (), refuse (message: String)
  where category in categories
  then
    set item's home to category, replacing any prior home
    return
  where category not in categories
  then
    refuse "There is no such category."

unassign (item: Item) : return (), refuse (message: String)
  where item in categorized
  then
    remove item from categorized
    return
  where item not in categorized
  then
    refuse "This item is not in any category."

deleteCategory (category: Category) : return (), refuse (message: String)
  where category in categories
  then
    remove every item whose home is category from categorized
    delete category
    return
  where category not in categories
  then
    refuse "There is no such category."
```

## Questions

- `_getCategory (item)` answers at most one category with its name and
  description.
- `_getHome (item)` answers the same category nested under `home`, or nothing.
- `_getItems (category)` answers its items in assignment order.
- `_getAllCategories ()` answers every category in creation order.
