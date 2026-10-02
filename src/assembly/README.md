# Assembly

This directory turns Commons' registered design into a running process. Its files
have distinct responsibilities:

- `application.ts` joins supplied production implementations to the concept set
  and the Access, Course, and Forum composition groups;
- `concept-floor.ts` constructs the registered MongoDB implementation set and
  owns the MongoDB client lifecycle;
- `http-policy.ts` defines the `/api` base path, public error categories, and
  session-cookie binding;
- `slow-requests.ts` reports every request the gateway held past two seconds
  as one log line naming the route, its duration, how it ended, and its
  correlation id, so a slow endpoint is named before anything is changed; and
- `process.ts` starts the edge listener and closes its selected resources.

## Concept state

Each registration's canonical class is the implementation used in production.
`mongo` is the complete named floor declared across every registration and
constructed by `src/concepts.ts`. Assembly accepts a complete implementation
map so tests can replace an individual instance deliberately without introducing
another application default.

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
successful `/auth/login` supplies the session value and fixed four-month cap as
its cookie expiry; the HTTP handler
removes both from the browser response and issues the cookie. Successful
`/auth/logout` and `/auth/changePassword` calls clear it. An unauthorized result
on a protected route clears that route's cookie binding.

External clients can check credentials with `POST /api/auth/authenticate`:

```js
const response = await fetch("https://commons.mit-sdg.dev/api/auth/authenticate", {
  method: "POST",
  credentials: "omit",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
});
const result = await response.json();
// On 200, result contains user, username, displayName, and email.
```

Both fields must be strings, with username at most 32 characters and password at
most 128; extra fields are rejected. Credentials are matched exactly as sent.
Invalid credentials return `401 { error: "UNAUTHORIZED" }`; an archived account
with the correct password returns `403 { error: "FORBIDDEN" }`; malformed input
returns `400 { error: "INVALID_REQUEST" }`. This endpoint creates no Commons
session and neither issues nor clears a cookie, even on failure. The external
client creates and manages its own session from the returned identity.

A successful response contains the authenticated account's stable `user` ID,
canonical `username`, account `email`, and current profile `displayName`. If the
account has no profile, `displayName` falls back to its username. For example:

```json
{
  "user": "<stable Commons user ID>",
  "username": "alice",
  "displayName": "Alice Example",
  "email": "alice@example.edu"
}
```

Set `EXTERNAL_AUTH_ALLOWED_DOMAIN=mit-sdg.dev` in the backend environment to
allow browser authentication from that hostname's subdomains. The value must be
a hostname without a scheme, wildcard, port or path. It is read at backend
startup; restart the backend after changing it. Unset or empty disables browser
CORS access. Only this path uses a separate cookie-free HTTP policy allowing
CORS from HTTP or HTTPS origins below the configured hostname, including nested
subdomains and explicit ports. The bare hostname and other domains receive no
CORS access. The edge resolves the suffix to an exact request origin, and the HTTP
package supplies preflight handling, CORS on successes and errors, and `Vary`.
Preflight permits `POST` and `Content-Type`; credentialed CORS is disabled.
Every response on this path has `Cache-Control: no-store`. Calls from a server
need no `Origin`; CORS controls browser access, not server authentication.
Commons password changes and account archiving do not revoke sessions managed
by an external client.

`http-policy.ts` explicitly maps the domain refusal codes that may cross HTTP.
Unmapped refusals and unexpected failures remain opaque `INTERNAL_ERROR`
responses. The same immutable policy is passed to the runtime handler and the
`httpWire(...)` projection in `generated.config.ts`, so cookie-owned fields and
HTTP error unions agree.

[`.env.example`](../../.env.example) defines process and origin settings. The
sync-engine HTTP package documents cookie, origin, and handler guarantees; the
host remains responsible for the listener, proxy, TLS, and shutdown.

After successful protected HTTP requests, the edge refreshes the session's
72-hour idle deadline without rewriting its fixed-cap cookie, at most once per
twelve hours for each session: the edge remembers when it last refreshed a
session, dropping entries past that quantum as it refreshes, and skips the
write while the entry is young, so a polling screen costs one write per
quantum and the effective idle window is 60 to 72 hours. Cookie-clearing
routes do not refresh. A renewal database fault is logged without replacing the
completed operation's response. Direct invocations do not renew sessions.
Renewal uses the supplied Sessioning implementation's atomic update outside the
engine action queue, so unrelated requests and revocation do not wait behind it.
It has no reaction consumers or engine occurrence; the awaited HTTP request owns
completion, failure reporting, and shutdown. New invocations and direct gate reads
already refresh their caches. This is a narrow boundary-maintenance exception,
not a general path for application mutations.
