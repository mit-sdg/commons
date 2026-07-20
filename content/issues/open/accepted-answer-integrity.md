---
milestone: public-deployment
concepts:
  - Conversing
  - Resolving
---

# Validate an accepted answer against its question

## Current behavior

A question author can submit any string as the accepted answer. Commons checks
that the question exists and belongs to that author, but it does not check that
the answer exists, is a reply, belongs to the same conversation, or remains
readable.

## Unresolved decision

Define whether an accepted answer must be a direct reply or any descendant in
the question's conversation, and whether trashing or hiding it clears the
acceptance.

## Acceptance condition

Application tests accept only the settled kind of reply in the question's
conversation. They refuse an unknown answer, another root, a reply from another
conversation, and every trashed, hidden, or purged case excluded by the policy.
