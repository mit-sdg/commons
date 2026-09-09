---
milestone: public-deployment
concepts:
  - Conversing
  - Resolving
---

# Validate an accepted answer against its question

## Current behavior

Commons requires the caller to own the readable question and the answer to be a
separate readable post in the same conversation. Self-acceptance, unknown posts,
and posts in other conversations are refused. Direct replies and deeper
descendants are accepted.

An acceptance is shown only while its answer remains readable and distinct from
the question. Purging either post clears resolution state; trashing hides an
unavailable answer without clearing the stored acceptance.

## Unresolved decision

Define whether an accepted answer must be a direct reply or any descendant in
the question's conversation, and whether trashing or hiding it clears the
acceptance.

## Acceptance condition

Application tests accept only the settled kind of reply in the question's
conversation. They refuse an unknown answer, the question itself, another root, a reply from another
conversation, and every trashed, hidden, or purged case excluded by the policy.
