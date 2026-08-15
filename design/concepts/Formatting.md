# Formatting

## Purpose

Keep the rendered HTML for a target's source text and replace it when the source
changes.

## Principle

Ben supplies a paragraph of source text and receives its rendered HTML. Editing
the source replaces that rendering. Clearing the target removes the rendering;
clearing it again still succeeds.

- `_getRendered (target)` answers at most one row with the target's rendered
  HTML.

## Types

```types
external Target
  The application object affected by the behavior.
```

## State

```state
a set of Formattings with
  a target   Target
  a source   String
  a rendered String
```

Each target has at most one formatting.

The concept uses the following calculations:

- `(source: String) rendered : String`

## Actions

```actions
setSource(target: Target, source: String) : return (target: Target, rendered: String)
  where true
  then
    delete any formatting for target
    add a new formatting with target, source, and rendered source rendered
    return target, rendered

clear(target: Target) : return (target: Target)
  where true
  then
    delete any formatting for target
    return target
```

## Queries

```queries
_getRendered (target: String) : optional (rendered: String)
```
