---
milestone: later
concepts:
  - Assigning
  - Conversing
  - Posting
  - Revising
---

# Make promised query order checkable

## Current behavior

Several concept specifications promise creation, activity, alphabetical, or
newest-first order. Implementations and tests follow those promises, but the
query declarations do not express an order that the engine can check.

## Unresolved decision

Choose a small declaration for query ordering that preserves the concept's
plain-language promise and works on memory and MongoDB floors.

## Acceptance condition

Every promised order in Commons has one machine-readable declaration, both
floors satisfy it, and a deliberately unordered implementation fails the check.
