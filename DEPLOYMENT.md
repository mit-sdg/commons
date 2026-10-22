# Deploy Commons

Commons is deployed via [`platform.yaml`](platform.yaml) connected to a managed
MongoDB instance. The platform deployment runs exactly one Commons backend
process alongside the Next.js frontend.

Guiding, Pinning, Publishing, and Categorizing serialize mutations within their single concept
instance. Do not run a second backend or other application writers against
the same database. These queues order concurrent actions; they do not provide
multi-document crash recovery or distributed transactions.

## Deploy on the platform

[`platform.yaml`](platform.yaml) is the complete application-owned deployment
contract. The platform installs the locked root and `frontend` Bun packages,
runs the root `build` script to assemble the standalone frontend, and starts the
root `platform:start` script from a platform-owned, digest-pinned recipe.

The supervisor publishes the frontend on the platform-provided `PORT` (port 3000
in the contract) and keeps the backend reachable only on container loopback at
fixed port 4000. The supervisor forces `NODE_ENV=production` for both child
processes, regardless of any inherited value, so Commons rejects missing
production secrets rather than using development defaults. If either process
exits, the supervisor stops the other process and exits so the scheduler can
replace the complete workload.

Supply these runtime variables through the platform's secret and configuration
facilities:

| Variable                  | Requirement                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`             | Required scoped MongoDB connection, including a database name and any required TLS options                                   |
| `PUBLIC_ORIGIN`           | Required exact browser origin: `https://` and the host the room's phones reach, no trailing slash                            |
| `CONNECT_APP_DOMAIN`      | Optional domain whose apps may sign people in with Commons; `mit-sdg.dev` in production. Unset accepts only `localhost` apps |
| `INVITATION_SECRET`       | Required stable secret of at least 32 characters; startup refuses a shorter one                                              |
| `VOUCHER_SECRET`          | Required stable secret of at least 32 characters, distinct from `INVITATION_SECRET`                                          |
| `ADMIN_SETUP_SECRET_HASH` | Optional one-time initial-administrator verifier; remove it after setup                                                      |
| `GEMINI_API_KEY`          | Required for the reasoner: sorting piles, summaries, drafting, and model seats in live runs. Without it the reasoner is off  |
| `GEMINI_MODEL`            | Optional model name; `gemini-3.7-flash` when unset                                                                           |
| `REASONER`                | Optional; `gemini` is the default with a key. `scripted` is refused in production                                            |
| `SMTP_*`                  | Optional existing SMTP configuration described below                                                                         |
| `SLOW_REQUEST_MS`         | Optional; a request this many milliseconds or longer is logged. `1000` when unset; `0`, `off`, or a non-number logs none     |
| `READ_AHEAD`              | Optional; rows of one list read from MongoDB at once. `32` when unset; `0`, `1`, `off`, or a non-number read one at a time   |
| `QUERY_CACHE`             | Optional; `since-dispatch` when unset keeps running requests' answers; `memoize` or any other value clears them per request  |
| `BATCHED_QUERIES`         | Optional; `on` when unset reads the rows a batched query is asked for together; `off` or any other value asks one at a time  |

Each slow request is logged as one backend line with the endpoint path, the
time taken, the number of MongoDB commands issued while serving it, and how
long it waited for a MongoDB connection, such as
`commons: slow request /threads/index took 1840 ms and 296 MongoDB commands, 420 ms of it waiting for a connection.`
The line never carries a query string, request body, session, or user. Startup
logs the threshold in use beside the time of one MongoDB round trip, the number
to read a slow request against. A value of `SLOW_REQUEST_MS` that is not a whole
number turns the log off and prints one warning line at startup, such as
`commons: SLOW_REQUEST_MS "abc" is not a number of milliseconds; slow requests are not logged.`
To measure requests, the backend listens to the MongoDB driver's connection pool
events, a small cost on each MongoDB operation; `off` removes it.

The waiting time counts the milliseconds of the request during which at least
one of its commands was waiting for a connection from the driver's pool, either
queued behind other commands or while a new connection opened. Overlapping waits
count once, so the figure is never more than the request's time. A large wait
means the pool was full: every connection was busy with other commands. When
the wait is small, the time went to MongoDB round trips or to the backend's CPU.

The pool's size is `maxPoolSize` in the MongoDB connection string; the driver's
default is 100. On the platform the storage binding writes the connection
string: it sets `maxPoolSize` to the database's connection limit and
`maxIdleTimeMS=60000`, and the database accepts ten connections beyond that
limit. To change the pool, change the database's connection limit on the
platform. Startup logs the pool in use, such as
`commons: the MongoDB pool opens up to 64 connections and closes those idle for 60 s.`
A pool of 100 that keeps idle connections open means the connection string sets
no pool size. Two numbers decide whether the pool is large enough:

- **The database's connection limit.** A request fails when the database
  refuses a connection the pool asks for, but only waits when the pool is full.
  Each backend has its own pool, and ten spare connections do not cover a second
  backend under load. An ordinary platform deploy starts the new version
  alongside the old one, so deploy Commons by replacing the running app in one
  step, between classes.
- **The round trip.** The connections busy at once are about the commands
  issued per second times the round trip. A class arriving together issued
  2,000 to 3,000 commands a second in testing: about 12 busy connections at a
  4 ms round trip, about 60 at 20 ms. A pool smaller than that makes requests
  wait; a larger one helps only if the database accepts it.

### Reading ahead and reusing answers

`READ_AHEAD` reads the rows of a list together, so a page that lists threads,
notifications, or grades waits on a few MongoDB round trips rather than one per
row. Answers are the same as reading one row at a time.

- **Is it on?** Startup logs either `commons: reading up to 32 rows of a list
at once.` or `commons: reading the rows of a list one at a time.`
- **Turning it off.** Set `READ_AHEAD=off` in the owner portal. Saving a
  variable restarts the backend, and a restart during a live class loses the
  class ([CLASS-DAY.md](CLASS-DAY.md)), so change it between classes. A value
  that is not a whole number also reads one row at a time and logs a warning;
  it never stops the server.
- **MongoDB load.** However many requests are under way, the backend keeps at
  most 64 rows read ahead at once, plus one row for each request being served.
  A row stuck longer than the 30-second request deadline gives up its place
  when every place is taken, but keeps its connection until MongoDB answers.
  A batched query reads many rows with one command on one connection.
  Each read in flight holds one of the driver's pooled connections, so while
  pages are being read the backend holds up to 64 connections, or the whole
  pool if it is smaller, where the previous release held about 7. Connections
  idle longer than the connection string's `maxIdleTimeMS` close; with no such
  setting they stay open. When every pooled connection is busy, commands wait
  for one rather than fail; the slow-request line shows the wait. At class
  start that wait is expected, and the front page still shows sooner than with
  `READ_AHEAD=off`, with a pool of 48 as with 100. Size the pool by the
  database's connection limit, as described for slow requests above. Set
  `READ_AHEAD=off` if MongoDB refuses connections.
- **Reusing answers.** Every request reads only MongoDB answers fetched since
  it arrived, so it sees every change made before it. With `QUERY_CACHE` unset
  (`since-dispatch`), requests already running keep the answers they fetched
  when another request arrives, instead of fetching them again. Startup then
  logs a line beginning `commons: each request reuses answers`. Set
  `QUERY_CACHE=memoize` to clear every answer when a request arrives, as before;
  like `READ_AHEAD`, it restarts the backend. Set it only together with
  `READ_AHEAD=off`: reading ahead while clearing answers issues about twice the
  MongoDB commands of the previous release when a class arrives at once. A
  mistyped value also clears answers and leaves `READ_AHEAD` as it is.
- **Batched queries.** The queries a page asks for many rows, such as whether
  each post is trashed or each node's conversation, answer all the rows a page
  asks for together in one MongoDB command. Startup logs either
  `commons: batched queries read the rows asked together in one call.` or
  `commons: batched queries read one row at a time.` Set `BATCHED_QUERIES=off`
  to ask one row at a time; like `READ_AHEAD`, it restarts the backend, so
  change it between classes. `READ_AHEAD=off` also asks one row at a time. A
  value that is neither `on` nor `off` asks one row at a time and logs a
  warning. Either way each query reads through the same code, so these
  settings are for MongoDB load, not for wrong answers. A thread page loads its
  posts' controls in batches; adding `?postControls=single` to its address
  loads them one post at a time.
- **A stuck MongoDB command.** A command that gets no reply for 5 seconds
  fails, and the driver retries a read once, so a stuck read fails within
  about 10 seconds instead of holding its page, and every read batched with
  it, forever. The other rows of a batch are then read one at a time and
  answer. If the whole database stays stuck, those reads wait one more
  timeout, so a batched read fails after about 20 seconds, inside the
  30-second request deadline. A single command that is legitimately silent
  for longer, such as a first index build on a large collection, is cut too;
  run heavy maintenance on its own connection. A write cut this way may still
  have been applied.
- **Closest to before.** `READ_AHEAD=off` with `QUERY_CACHE=memoize` reads one
  row at a time and clears answers per request, as the release before engine
  1.2.0 did, though requests that overlap may still interleave differently.
  Marking a thread seen stays one write whatever they are set to; only
  redeploying an older release brings back one write per post.
- **Rolling back the release.** It adds no migration and writes nothing new to
  MongoDB. Redeploying the commit `main` held before the release is safe
  without restoring a backup. If a page shows a wrong answer, redeploy that
  commit at once: the settings above change how much is read together, not
  what is read. As with
  any release, replace the running backend in one step rather than starting
  the other one alongside it.

`MONGODB_URL` remains a supported legacy alias. If both MongoDB variables are
nonempty, they must contain the same value. Commons refuses conflicting values
without logging either connection string.

The generated runtime does not include MongoDB and writes no durable application
state to its local filesystem. It runs as a non-root user with a read-only root
filesystem; MongoDB data, credential rotation, and backups remain platform
responsibilities. Route public traffic only to the declared application port.
The backend loopback port is internal and must not be published.

## Sign in with Commons for course apps

Course apps, the owner portal among them, sign people in with their Commons
account without ever handling a Commons password. For each sign-in, the app's
server makes a new random verifier and keeps it with that sign-in, beside the
`state` it checks later. The verifier is a separate value from `state`, and it
never leaves the server until the server redeems the code. The app sends the
browser to

```text
/connect?app=<its origin>&state=<its own value>&code_challenge=<challenge>&code_challenge_method=S256
```

where `state` is 16 to 256 letters, digits, or `._~-`, and the challenge is the
verifier's SHA-256 hash in base64url without padding, 43 characters. Commons
shows an error and sends the browser nowhere when any of these is missing,
repeated, or invalid. Commons asks the signed-in person, once, whether that
app may learn their name, username, and email, remembers the answer, and sends
the browser to `<app>/auth/commons/callback` with a `code` and the app's
`state`, or with `error=access_denied` and the `state` when the person cancels.
The app checks `state`, and its server then redeems the code with the verifier
it kept for that sign-in:

```sh
curl --request POST \
  --header "Content-Type: application/json" \
  --data '{"code":"<code>","app":"https://team-7.mit-sdg.dev","code_verifier":"<verifier>"}' \
  https://class.mit-sdg.dev/api/connect/redeem
```

In Bun or Node, making a verifier and its challenge takes two lines:

```ts
import { createHash, randomBytes } from "node:crypto";

const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
```

RFC 7636 gives a pair to test against: the verifier
`dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` has the challenge
`E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`. A challenge with `=` at the
end or a hex digest is refused at `/connect`. A challenge that is not the
verifier's hash, such as the verifier itself, passes there, and its code then
fails to redeem with `CONNECT_CODE_INVALID`. Make a new verifier for every
sign-in, never one per app.

A redeemed code returns HTTP `200` with the person's stable `user` ID,
`username`, `displayName`, and `email`. A code works once, lapses sixty seconds
after it was issued, only for the app it was issued to, and only with the
verifier whose challenge it was issued for. It also stops working when its
person withdraws the app's approval or their account is archived. A missing,
wrong, or malformed verifier spends the code. Every one of those refusals
returns HTTP `400` with `{"error":"CONNECT_CODE_INVALID"}`, and
a request of the wrong shape returns `{"error":"INVALID_REQUEST"}`. Redemption
needs no Commons session, and Commons sends no CORS headers, so only an app's
server, not a page in a browser, can redeem a code. Serve the callback page
with `Referrer-Policy: no-referrer`, so the code in its address is not sent on
to other sites. Once an app has started its own session, a Commons password
change or archive does not end it. People see and remove the apps they approved
under **Settings > Connected apps**. The
[Sign in with Commons explanation](design/compositions/access/connect.md)
describes the flow and the reasons for each of these rules.

`CONNECT_APP_DOMAIN` names the domain whose apps may ask. Production sets
`CONNECT_APP_DOMAIN=mit-sdg.dev`, so Commons accepts `https://mit-sdg.dev`,
where the owner portal runs, and `https://<name>.mit-sdg.dev` for each team's
app. It refuses names two labels down, `http://`, explicit ports, any path or
trailing slash, uppercase letters, and Commons' own origin. An app is always
written as its exact origin, and its code always goes to that origin's
`/auth/commons/callback`. `http://localhost:<port>` and
`http://127.0.0.1:<port>` are accepted with or without the variable, so an app
can be built against a local Commons; while the variable is unset they are the
only apps accepted. Sign-in codes are derived from `VOUCHER_SECRET`, so
rotating it voids the codes outstanding at that moment.

## Email delivery and invitation copy

Set `SMTP_HOST` and `SMTP_FROM` together to enable delivery. `SMTP_PORT` defaults
to `587`; port `465` or `SMTP_SECURE=true` selects implicit TLS. Other ports use
STARTTLS. Supply `SMTP_USERNAME` and `SMTP_PASSWORD` together when the server
requires authentication.

The login and visible sender are independent. The SMTP provider must authorize
the address or domain in `SMTP_FROM`; a different login alone does not grant
permission to send from any address.

```env
SMTP_HOST=smtp.example.edu
SMTP_PORT=587
SMTP_USERNAME=your-smtp-login
SMTP_PASSWORD=your-smtp-password
SMTP_FROM="Course Team <course@example.edu>"
SMTP_REPLY_TO="Teaching Staff <help@example.edu>"
```

`SMTP_REPLY_TO` is optional and accepts an address with an optional display name.
Without it, replies go to `SMTP_FROM`. Restart the backend after changing SMTP
environment variables; credentials are not exposed in the admin console.

Under **Administration > Email**, edit and preview the invitation subject and
plain-text body. Registration links, temporary passwords, and the lifetime notice
are appended automatically. Preview uses sample credentials and sends no email.
Saving affects subsequent invitations, including resends and roster imports;
existing queued messages keep their rendered copy. **Reset to default** removes
the saved override. Templates persist in MongoDB.

The same admin tab shows delivery outcomes and on-demand plain-text message
previews. Invitation passwords, password-reset codes, and their link tokens are
hidden in those previews. Forum email includes the event and discussion title,
not post text; recipients must sign in to read the discussion.

## Migrations on first start

Startup runs the pending migrations under `src/migrations/` against the
database before the edge accepts traffic, and records each one it applied.
Earlier migrations give forum categories a scope and move drafting-brief links
into AdoptLinking's own store. This release also preserves existing activities'
background-document selections and moves each response's answers into its
response document, with a unique identity per subject and participant. The
answer move prevents a delayed save from changing an already submitted response.

Stop the old workload and all other writers before taking a database backup
and starting this release. Keep the backup until the deployment is verified.
Do not overlap old and new backends during a rolling update: the old backend
writes to the separate answer collection, and those writes are invisible to
the new backend after migration.

If response identities collide or stored answers are ambiguous, startup stops
and lists the affected response IDs without choosing a winner. Review the
reported records and their downstream references before repairing them, then
restart; do not delete the migration ledger to bypass the check.

These migrations are forward-only. Rolling back application code alone does
not roll back stored data. To return to the previous build, stop all writers
and restore its pre-upgrade database backup as well. Preserve a backup of the
current database first if new work has been recorded, because restoring the
older backup excludes that work. The retained legacy answer collection is
recovery evidence, not a rollback copy: new saves no longer update it. A later
redeploy also does not recopy migrated responses or revisit migrations already
recorded as applied.

The public health endpoint checks backend readiness on every request, and backend
readiness includes a MongoDB operation:

```sh
curl --fail https://commons.example.edu/health
```

A `200` response with `{"status":"ok"}` confirms the frontend, backend, and
MongoDB path are ready. An unreachable backend or failed MongoDB check returns
`503` with a generic response.

## When a start fails

The supervisor passes both processes' output through unchanged, so the
platform's log for the workload holds the reason. Lines from the backend begin
with `commons:`. Startup refuses, with a one-line message, on: a missing
`MONGODB_URI`; conflicting `MONGODB_URI` and `MONGODB_URL`; a missing
`PUBLIC_ORIGIN` or one with a trailing slash; a `CONNECT_APP_DOMAIN` that is
not a bare hostname; an `INVITATION_SECRET` or `VOUCHER_SECRET` under 32
characters, or the two equal; and `REASONER=scripted` in production. A start that reaches the migrations and
stops there names the migration and its reason; follow that diagnostic and the
migration guidance above before restarting or restoring a backup. A running
stack whose `/health` answers `503` has a frontend up and a backend or
MongoDB down: read the backend's `commons:` lines. Terminate TLS at the reverse proxy and
forward to the declared application port; every other combination fails the
session check at the end of this guide.

## Register the initial administrator

The setup endpoint compares a raw secret with the configured verifier and stores
neither value in MongoDB. The platform receives only the scrypt verifier. The endpoint
creates an account only while the database has none; a missing
`ADMIN_SETUP_SECRET_HASH` disables it.

Generate a secret locally, retain the raw value temporarily, and put only the
printed verifier into the platform environment:

```sh
secret="$(openssl rand -base64 36)"
printf %s "$secret" | bun run setup:hash
```

Set the output as `ADMIN_SETUP_SECRET_HASH`, deploy the stack, and open
`https://commons.example.edu/setup`. Enter the raw setup secret and the initial
account details. The unlinked setup page calls the generated application
endpoint, creates the administrator, and signs in with the new account password.
Commons exposes no general account-registration endpoint;
the ordinary `/register` page still requires an administrator-issued invitation.

The equivalent command-line request is:

```sh
curl --fail-with-body \
  --request POST \
  --header "Content-Type: application/json" \
  --data @- \
  https://commons.example.edu/api/setup/register-admin <<JSON
{
  "setupSecret": "$secret",
  "username": "operator",
  "password": "replace-with-the-account-password",
  "displayName": "Course Operator",
  "email": "operator@example.edu"
}
JSON
```

A new account returns HTTP `200`. A wrong or disabled setup secret returns HTTP
`401`, and an initialized installation returns HTTP `409`. Remove
`ADMIN_SETUP_SECRET_HASH` from the platform environment and redeploy after success. Rate-limit the
setup path at the reverse proxy.

This creates the initial forum administrator. Establishing that account as a
course owner and linking it to a roster seat still requires the existing course
configuration operations; the browser does not perform course setup.

## Grant live hosting

Every live screen — the shelf, the relay editor, the run dashboard, and the
projector — requires the `live:host` capability, and every live endpoint
enforces it. It is held through a role, and a role is deployment-wide: a holder
can host any live run and read any wall in this Commons. Give it to the people
who run the room and to nobody else: the course owner and each TA, never a
student.

An administrator grants it from the admin console at `/admin`. Under **Create
a role**, name a role such as `lecturer` and tick `live:host` (a role may carry
other capabilities beside it). Under **Assign a role**, name each account by
username or email address and assign the role. An account holds one role at a
time, so a TA who already holds a grading role needs one role that carries both
capabilities. The administrator's own account reaches every live screen through
`administer` without a grant. The same two steps are available over the API as
`/api/roles/define` and `/api/roles/assign`, each requiring a signed-in
administrator.

### Verify the deployment

Check both public frontend health and backend readiness:

```sh
curl --fail https://commons.example.edu/health
```

The health check confirms that the frontend and backend are running and MongoDB
is reachable.

Finally, sign in at `/login` and confirm that a protected page loads. If the
login response succeeds but the browser does not retain its session, verify
that `PUBLIC_ORIGIN` exactly matches the browser's HTTPS origin and that all
traffic reaches Commons through TLS.
