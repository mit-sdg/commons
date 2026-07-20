---
milestone: public-deployment
concepts:
  - Posting
  - Trashing
---

# Make moderation trash recoverable

## Current behavior

The trash and flag pages ask the ordinary post reader for content. A trashed
post becomes an unavailable placeholder, so its restore and purge controls are
not rendered even though both actions exist.

## Desired behavior

Authorized moderators can identify trashed content and reach restore or purge
without exposing that content through the public post read.

## Acceptance condition

A browser test trashes a post, restores it from the trash page, trashes it
again, purges it, and verifies the public and moderator pages at each step.
