# Assembly

This directory turns Commons' registered design into a running process. Its files
have distinct responsibilities:

- `application.ts` joins supplied production implementations to the concept set
  and the Access, Course, and Forum composition groups;
- `concept-floor.ts` constructs the registered MongoDB implementation set and
  owns the MongoDB client lifecycle;
- `http-policy.ts` defines the `/api` base path, public error categories, and
  session-cookie binding; and
- `process.ts` starts the edge listener and closes its selected resources.

## Concept state

Each registration's canonical class is the implementation used in production.
`mongo` is the complete named floor declared across every registration and
constructed by `src/concepts.ts`; the stateless Timing concept uses the same
class without a separate storage variant. Assembly accepts a complete
implementation map so tests can replace an individual instance deliberately
without introducing another application default.

`MONGODB_URL` is required. The process opens the configured database, constructs
the `mongo` floor, closes the client when the process stops, and never drops an
operator-supplied database. Use one Commons process per database; the open
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
