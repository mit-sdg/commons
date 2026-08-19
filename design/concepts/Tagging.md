# Tagging

## Purpose

Keep a shared set of named tags and apply or remove them from targets.

## Principle

Ken creates an `urgent` tag and adds it to a report. Applying it again or
applying an unknown tag is refused. Ken removes the tag from the report.
Deleting a tag removes it from every target. Clearing a target removes all its
tags and succeeds when none are present.

## Types

```types
external Target
  An application-owned identity used in the target role.
```

## State

```state
a set of Tags with
  a name String

a set of Tagged with
  a target   Target
  an applied seq of Tags

Rule: at most one tagged entry has each target, and a target's applied tags stand in application order.
Rule: targets are opaque identities; Tagging neither creates nor validates them.
```

## Actions

```actions
createTag(name: String) : return (tag: Tag)
  where no tag has this name
  then
    add a new tag with name
    return tag
  where some tag has this name
  then
    refuse TAG_ALREADY_EXISTS "A tag with this name already exists."

addTag(target: Target, tag: Tag) : return (target: Target)
  where tag in tags and tag not in target's applied
  then
    append tag to target's applied
    return target
  where tag not in tags
  then
    refuse TAG_NOT_FOUND "There is no such tag."
  where tag in target's applied
  then
    refuse TAG_ALREADY_APPLIED "This tag is already applied to the target."
removeTag(target: Target, tag: Tag) : return (target: Target)
  where tag in target's applied
  then
    remove tag from target's applied
    return target
  where tag not in target's applied
  then
    refuse TAG_NOT_APPLIED "This tag is not applied to the target."
deleteTag(tag: Tag) : return (tag: Tag)
  where tag in tags
  then
    remove tag from every target's applied
    delete tag
    return tag
  where tag not in tags
  then
    refuse TAG_NOT_FOUND "There is no such tag."
clearTarget(target: Target) : return (target: Target)
  where true
  then
    remove target from tagged
    return target
```

## Queries

```queries
_getTags (target: String) : many (tag: String, name: String)
  answers the Target's Tags
  orders rows by application to the Target
  answers no rows when none match

_getTargets (tag: String) : many (target: String)
  answers the Tag's Targets
  orders rows by Target creation
  answers no rows when none match

_getByName (name: String) : optional (tag: String)
  answers the Tag with the exact name
  answers no row when no Tag matches

_getAllTags () : many (tag: String, name: String)
  answers every Tag
  orders rows by creation
  answers no rows when none match
```
