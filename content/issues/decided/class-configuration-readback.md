---
milestone: public-deployment
concepts:
  - Rostering
---

# Read class configuration back

## Current behavior

Staff can save a class code, title, term, and timezone. After they reload the
roster page, those fields are blank because no application read returns the
saved configuration.

## Desired behavior

Rostering answers its one class configuration, and the staff surface uses that
answer to populate the form.

## Acceptance condition

A browser test saves class configuration, reloads the application, and sees the
same values on memory and MongoDB floors.
