# Formatting

## Purpose

Keep the rendered HTML for a target's source text and replace it when the source
changes.

## Principle

Ben supplies a paragraph of source text and receives its rendered HTML. Editing
the source replaces that rendering. Clearing the target removes the rendering;
clearing it again still succeeds.

## State

```state
a set of Formattings with
  a target   Target
  a source   String
  a rendered String
```

Each target has at most one formatting.

```computation
(source: String) rendered : String
```

## Actions

```actions
setSource(target: Target, source: String) : return (rendered: String)
  then
    delete any formatting for target
    add a new formatting with target, source, and rendered source rendered
    return rendered

clear(target: Target) : return ()
  then
    delete any formatting for target
    return
```

## Queries

```queries
_getRendered (target: String) : optional (rendered: String)
```

### Notes

- `_getRendered (target)` answers at most one row with the target's rendered
  HTML.
