---
milestone: later
concepts:
  - Bookmarking
  - Conversing
  - Pinning
---

# A deleted discussion keeps its pin and stars

## Current behavior

When an author deletes an opening post that has no replies, `Conversing.remove` removes the conversation with its last node. A discussion pin and any stars on that conversation stay stored. Nobody sees them, because the pinned and starred lists answer only conversations that exist and admit the reader, but Staff cannot unpin a conversation that no longer exists (`NOT_FOUND`), and each list request checks the leftover rows again. Purging a discussion from the trash does clear its pin and stars.

## Unresolved decision

Whether deleting the last post of a discussion should clear the pin and stars on its conversation, as purge does, or whether an opening post should leave only through trash and purge.

## Acceptance condition

After a discussion is deleted by any path, no pin or star on its conversation remains stored.
