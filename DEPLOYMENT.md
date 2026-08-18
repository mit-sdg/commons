# Deploy Commons

Commons supports two production layouts: the SDG managed platform connected to
an operator-managed MongoDB, or a Coolify Compose resource that includes its own
MongoDB container. Both layouts run exactly one Commons backend process.

## Deploy on the SDG managed platform

[`platform.yaml`](platform.yaml) is the complete application-owned deployment
contract. The platform installs the locked root and `frontend` Bun packages,
runs the root `build` script to assemble the standalone frontend, and starts the
root `platform:start` script from a platform-owned, digest-pinned recipe.
Repository Dockerfiles are not inputs to this deployment.

The supervisor publishes the frontend on the platform-provided `PORT` (port 3000
in the contract) and keeps the backend reachable only on container loopback at
fixed port 4000. The supervisor forces `NODE_ENV=production` for both child
processes, regardless of any inherited value, so Commons rejects missing
production secrets rather than using development defaults. If either process
exits, the supervisor stops the other process and exits so the scheduler can
replace the complete workload.

Supply these runtime variables through the platform's secret and configuration
facilities:

| Variable                  | Requirement                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `MONGODB_URI`             | Required scoped MongoDB connection, including a database name and any required TLS options |
| `PUBLIC_ORIGIN`           | Required exact browser origin, without a trailing slash                                    |
| `INVITATION_SECRET`       | Required stable secret of at least 32 random bytes                                         |
| `ADMIN_SETUP_SECRET_HASH` | Optional one-time initial-administrator verifier; remove it after setup                    |
| `SMTP_*`                  | Optional existing SMTP configuration described below                                       |

`MONGODB_URL` remains a supported legacy alias. If both MongoDB variables are
nonempty, they must contain the same value. Commons refuses conflicting values
without logging either connection string.

The generated runtime does not include MongoDB and writes no durable application
state to its local filesystem. It runs as a non-root user with a read-only root
filesystem; MongoDB data, credential rotation, and backups remain platform
responsibilities. Route public traffic only to the declared application port.
The backend loopback port is internal and must not be published.

The public health endpoint checks backend readiness on every request, and backend
readiness includes a MongoDB operation:

```sh
curl --fail https://commons.example.edu/health
```

A `200` response with `{"status":"ok"}` confirms the frontend, backend, and
MongoDB path are ready. An unreachable backend or failed MongoDB check returns
`503` with a generic response.

## Deploy with Coolify

This procedure deploys the Commons frontend, backend, and a private MongoDB
service as one Coolify Docker Compose resource. MongoDB stores its database in a
named volume that Coolify can back up.

### Prerequisites

Before deploying, provide:

- a URL-safe random MongoDB password;
- a public HTTPS hostname whose DNS points to the Coolify server;
- inbound HTTP and HTTPS access to Coolify's reverse proxy; and
- one backend replica. Commons does not currently support multiple processes
  sharing one database.

Do not assign a public domain to the backend or MongoDB. Browsers use the
frontend's same-origin `/api/*` path, the frontend reaches `backend`, and the
backend reaches `mongodb` over the private Compose network. The Compose file
publishes none of these container ports on the host.

### Configure the Compose resource

Create a Docker Compose resource from [`compose.yaml`](compose.yaml). Set these
Coolify environment variables before the first build:

| Variable                | Value                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `MONGODB_PASSWORD`      | Required URL-safe random password; `openssl rand -hex 32` produces a suitable value    |
| `MONGODB_USERNAME`      | Optional MongoDB root username; defaults to `commons`                                  |
| `MONGODB_DATABASE`      | Optional database name; defaults to `commons`                                          |
| `MONGODB_IMAGE`         | Optional MongoDB image override; defaults to `mongo:8.0`                               |
| `PUBLIC_ORIGIN`         | Exact frontend origin, such as `https://commons.example.edu`, without a trailing slash |
| `INVITATION_SECRET`     | At least 32 random bytes; keep it stable across deployments                            |
| `COMMONS_FRONTEND_PORT` | Optional frontend container port; defaults to `3000`                                   |
| `COMMONS_BACKEND_PORT`  | Optional backend container port; defaults to `4000`                                    |

The Compose resource deliberately publishes no host ports, so it will not
compete with other services on the Coolify host. In Coolify, route the public
hostname to the `frontend` service and its configured container port. Coolify's
reverse proxy should terminate TLS.

MongoDB data lives in the `mongodb_data` named volume. Configure that volume in
Coolify's backup UI before putting course data into Commons. MongoDB initialization
uses `MONGODB_USERNAME`, `MONGODB_PASSWORD`, and `MONGODB_DATABASE` only when the
volume is empty. Changing those values later does not rotate credentials in an
existing database.

`COMMONS_BACKEND_PORT` is also supplied to the frontend image as a build
argument. Rebuild the frontend after changing it. `BACKEND_ORIGIN` is already
set to the private Compose service address and normally should not be changed.

SMTP is disabled when its variables are absent or blank. To send invitation
mail, configure `SMTP_HOST` and `SMTP_FROM`; optionally set `SMTP_PORT`,
`SMTP_SECURE`, and both `SMTP_USERNAME` and `SMTP_PASSWORD`.

### Register the initial administrator

The setup endpoint compares a raw secret with the configured verifier and stores
neither value in MongoDB. Coolify receives only the scrypt verifier. The endpoint
creates an account only while the database has none; a missing
`ADMIN_SETUP_SECRET_HASH` disables it.

Generate a secret locally, retain the raw value temporarily, and put only the
printed verifier in Coolify:

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
`ADMIN_SETUP_SECRET_HASH` from Coolify and redeploy after success. Rate-limit the
setup path at the reverse proxy.

This creates the initial forum administrator. Establishing that account as a
course owner and linking it to a roster seat still requires the existing course
configuration operations; the browser does not perform course setup.

### Verify the Coolify deployment

Check both public frontend health and backend readiness:

```sh
curl --fail https://commons.example.edu/health
```

In Coolify, the `frontend`, `backend`, and `mongodb` containers should all report
healthy. The backend does not download, install, or start MongoDB; it attempts the
configured connection and exits if MongoDB is unavailable during startup. Its
image checks `/health/ready`, which returns `503` when a later MongoDB read fails.
The lighter `/health/live` route confirms only that the HTTP process is serving
requests.

Finally, sign in at `/login` and confirm that a protected page loads. If the
login response succeeds but the browser does not retain its session, verify
that `PUBLIC_ORIGIN` exactly matches the browser's HTTPS origin and that all
traffic reaches Commons through TLS.
