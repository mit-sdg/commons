---
milestone: later
concepts:
  - Publishing
---

# The projector's scale is a stylesheet keyed on the wall's utility class names

## Current behavior

The projector must hold twelve piles and the join code at 1920×1080,
1280×720, and 1024×768 with nothing scrolled. Every size the wall draws lives
in `wall.tsx` and `pile.tsx` as literal utility classes, so the projector
scales them from `projector-fit.tsx`: one sheet, scoped to the projector's
own class, that re-states each size as a clamp on the viewport height. It
works, and it is keyed on class names — a size renamed in the wall silently
stops scaling on the projector.

## Unresolved decision

Whether the wall's sizes become custom properties the projector sets once
(the wall's own file, one place), or the wall takes a `scale` prop.

## Acceptance condition

The projector holds twelve piles and the code at the three geometries with
no selector in the projector's code naming a class of the wall's.
