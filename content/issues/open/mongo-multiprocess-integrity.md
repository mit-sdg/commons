---
milestone: public-deployment
concepts: []
---

# Define MongoDB schema and multi-process integrity

## Current behavior

Commons creates collections on first writes. One process serializes concept actions.

Publishing and Attending hold their rules across processes with unique indexes, which each builds when first used, and tests race instances of each on one database. Publishing's indexes keep one open edition per material, one open part per whole (one open round per run), and one part per material in each whole; Attending's keeps one attendance per attendee at a gathering. The migration `20260923T000100-rounds-within-runs` builds Publishing's indexes and stops startup with a diagnostic when the database already breaks one of those rules.

Commons as a whole still declares no database guarantees for concurrent processes, and its composition assumes one process.

## Unresolved decision

Choose the required indexes, schema version, validation, and atomic rules before
more than one application process shares a database.

## Acceptance condition

When Commons starts, it verifies the declared schema and indexes. Tests with
concurrent processes confirm every uniqueness and integrity promise. Commons
rejects an incompatible database with a clear message that does not expose
credentials.
