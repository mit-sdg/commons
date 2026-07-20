---
milestone: later
concepts:
  - Profiling
---

# Decide validation for profile fields

## Current behavior

Profiling accepts any display name, bio, or avatar string. An empty display name
is valid and can leave the visible profile name blank.

## Unresolved decision

Choose the useful limits and refusal messages for display name, bio, and avatar
without treating an intentionally empty bio or avatar as missing input.

## Acceptance condition

The specification states each limit. Concept and boundary tests cover the
minimum, maximum, and refused values.
