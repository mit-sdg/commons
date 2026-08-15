# Formatting

## Purpose

Keep the rendered HTML for a target's source text and replace it when the source
changes.

## Principle

Ben supplies a paragraph of source text and receives its rendered HTML. Editing
the source replaces that rendering. Clearing the target removes the rendering;
clearing it again still succeeds.

## Types

```types
external Target
  An application-owned identity used in the target role.
```

## State

```state
a set of Formattings with
  a target   Target
  a source   String
  a rendered String
```

Each target has at most one formatting.

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
  answers the Target's rendered HTML
  answers no row when the Target has no Formatting
```
