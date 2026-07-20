---
milestone: later
concepts:
  - Noting
  - Profiling
---

# Stop using an empty string for absence

## Current behavior

Some frontend inputs use `""` when no value is present, and the application
boundary translates selected placeholders before they reach concepts. Profile
fields also use empty strings as standing values for unset text.

## Desired behavior

Wire contracts state absence directly. Concepts retain an empty string only
when the user actually supplied empty text, and the application boundary needs
no placeholder translation.

## Acceptance condition

Generated contracts distinguish absent and empty values, frontend forms send
the intended one, and the application boundary contains no empty-string
absence guard.
