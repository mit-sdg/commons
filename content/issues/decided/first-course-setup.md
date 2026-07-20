---
milestone: public-deployment
concepts:
  - Authenticating
  - Roling
  - Rostering
---

# Let a fresh installation establish its first course

## Current behavior

The first account can administer the forum, but the frontend cannot establish
course staff access or link an imported seat. A fresh installation needs
out-of-band endpoint calls before course workflows are usable.

That first account is not a course member yet. Forum posts therefore use the
private-profile fallback, “Someone,” until the account is linked to a seat.

## Desired behavior

Deployment supplies a verifier for a one-time setup secret. An operator enters
the matching secret in the setup workflow, creates or selects the first
account, and establishes that account as the course owner. Successful setup
closes the workflow permanently. Commons stores only the verifier, never the
raw secret.

## Acceptance condition

From a fresh database, an operator uses the deployment-supplied secret to
establish the first course owner in one browser workflow. A restart keeps setup
closed permanently. Invalid and repeated attempts fail, and stored state and
logs contain only the verifier, never the raw secret.
