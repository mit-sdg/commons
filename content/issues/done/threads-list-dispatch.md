---
milestone: repository-release
concepts:
  - Conversing
---

# Give thread listing one explicit dispatch contract

## Resolution at completion

`/threads/latest` orders conversations by creation. `/threads/activity` orders
them by their most recent activity. Both routes accept an empty body.
`/threads/list` is not declared and answers not found at the HTTP boundary.

## Decision at completion

The generated contract, frontend, and tests use the two named routes. Neither
route accepts a sort discriminator or aliases the other ordering.

## Verification at completion

The route declaration, generated contract, frontend choice, and tests agree on
the two paths and their ordering. An undeclared path answers not found.
