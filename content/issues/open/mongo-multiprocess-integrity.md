---
milestone: public-deployment
concepts: []
---

# Define MongoDB schema and multi-process integrity

## Current behavior

Commons creates collections on first writes. One process serializes concept
actions. Database guarantees for concurrent Commons processes are undefined.

## Unresolved decision

Choose the required indexes, schema version, validation, and atomic rules before
more than one application process shares a database.

## Acceptance condition

When Commons starts, it verifies the declared schema and indexes. Tests with
concurrent processes confirm every uniqueness and integrity promise. Commons
rejects an incompatible database with a clear message that does not expose
credentials.
