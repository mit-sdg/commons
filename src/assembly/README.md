# Assembly

This directory turns Commons' registered design into a running process. Its files
have distinct responsibilities:

- `application.ts` joins `src/vocabulary.ts` to the Access, Course, and Forum
  composition groups and supplies default concept implementations;
- `concept-floor.ts` selects memory or MongoDB implementations and owns the
  MongoDB client lifecycle;
- `http-policy.ts` defines the `/api` base path, public error categories, and
  session-cookie binding; and
- `process.ts` starts the edge listener and closes its selected resources.

## Concept state

The process uses in-memory implementations unless `MONGODB_URL` selects MongoDB.
With MongoDB selected, Commons opens the configured database, closes the client
when the process stops, and never drops an operator-supplied database. Use one
Commons process per database; the open
[`mongo-multiprocess-integrity`](../../content/issues/open/mongo-multiprocess-integrity.md)
work records the remaining multi-process constraint.

Tests may pass implementation overrides to `assembleCommons`. An override
replaces an application default; it does not define another deployment floor.

## HTTP policy

Commons exposes logical endpoint paths below `/api`. The HTTP package binds the
logical `session` input to the secure `__Host-commons-session` cookie. A
successful `/auth/login` supplies the session value and expiry; the HTTP handler
removes both from the browser response and issues the cookie. Successful
`/auth/logout` and `/auth/changePassword` calls clear it. An unauthorized result
on a protected route clears that route's cookie binding.

`http-policy.ts` explicitly maps the domain refusal codes that may cross HTTP.
Unmapped refusals and unexpected failures remain opaque `INTERNAL_ERROR`
responses. The same immutable policy is passed to the runtime handler and the
`httpWire(...)` projection in `generated.config.ts`, so cookie-owned fields and
HTTP error unions agree.

[`.env.example`](../../.env.example) defines process and origin settings. The
sync-engine HTTP package documents cookie, origin, and handler guarantees; the
host remains responsible for the listener, proxy, TLS, and shutdown.
