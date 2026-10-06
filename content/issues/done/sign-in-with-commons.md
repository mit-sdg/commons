---
milestone: public-deployment
concepts:
  - Connecting
  - Vouching
  - Authenticating
  - Profiling
  - Sessioning
---

# Let course apps sign people in with Commons

## Resolution at completion

A course app, such as the owner portal at the platform domain or a team's app
one label below it, signs a person in as their Commons account without ever
receiving a Commons password. The app sends the browser to `/connect` with its
origin and a `state` of its own. Commons asks the signed-in person once whether
that app may learn their name, username, and email, remembers the answer, and
sends the browser to the app's `/auth/commons/callback` with a code and the
`state`, or with `error=access_denied` when the person cancels. The app's server
redeems the code at `/api/connect/redeem` for the person's `user`, `username`,
`displayName`, and `email`. A person sees and removes the apps they approved in
Settings. The external password check at `/api/auth/authenticate`, with its
`EXTERNAL_AUTH_ALLOWED_DOMAIN` CORS policy, is gone, so `/auth/login` is the
only endpoint that checks a Commons password.

## Decision at completion

Remembered approvals are a new concept, Connecting, holding one connection per
person and app; approving again answers the standing connection. Codes are a
second Vouching instance, ConnectVouching, whose subject is the connection, so
issuing a new code retires only that approval's older code and withdrawing the
approval voids its unredeemed code. A code lapses sixty seconds after approval,
is spent the first time it is presented, and every refusal at redemption is the
same `400 {"error":"CONNECT_CODE_INVALID"}`. The HTTP package names a refusal
only by its public category, so the edge turns that path's `UNAUTHORIZED` into
the promised answer and marks every answer there `no-store`.

An app is its exact origin. `CONNECT_APP_DOMAIN` admits that domain and every
name one DNS label below it, over https; `localhost` and `127.0.0.1` at an
explicit port are always admitted for development; Commons' own origin never
is. The callback is fixed, so an app cannot redirect a code anywhere else.
Approval needs the person's session, and the HTTP package's origin check
refuses it from any page but Commons' own, which stops a same-site course app
from approving itself; Commons sends no CORS headers, so redemption is server
to server. As before, a later password change or archive does not end a
session an app has already started.

## Verification at completion

Concept tests cover approval, its idempotence under racing requests, ordering,
and withdrawal. Computation tests cover every accepted and refused origin form,
the code format, and the display-name fallback, and deployment tests cover
`CONNECT_APP_DOMAIN` parsing. Edge tests drive every endpoint through
`edge.fetch`: the session requirement, the origin check on approval, the
redemption shape and `no-store`, single use, expiry at sixty seconds on an
injected clock, another app's code, a withdrawn approval, an archived account,
supersession within one approval beside codes for two apps, malformed codes and
requests, and the absence of CORS. A browser test signs in, allows an app,
follows the redirect to its callback, redeems the code, passes straight through
on a second visit, cancels, refuses invalid requests, returns a signed-out
person after sign-in, and removes the app in Settings.
