---
milestone: public-deployment
concepts:
  - Assigning
  - Submitting
---

# Validate assignments before accepting submissions

## Resolution at completion

New submissions require an existing, published assignment that accepts submissions, is assigned to the active learner, matches the current audience, and is within availability and hard close. The server evaluates these conditions before creating content. Due overrides and late-day use do not extend the hard close.

## Decision at completion

Submission eligibility uses server time and current assignment policy. The configured close is a hard boundary independent of due-date adjustments.

## Verification at completion

Course wire tests reject unknown, unavailable, closed, nonaccepting, and audience-excluded assignments and accept an eligible assignment. Concurrent Submitting tests verify distinct attempt numbers across concept instances.
