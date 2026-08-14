# Deploy Commons with Coolify

This procedure deploys the Commons frontend, backend, and a private MongoDB
service as one Coolify Docker Compose resource. MongoDB stores its database in a
named volume that Coolify can back up.

## Prerequisites

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

## Configure the Compose resource

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

## Register the initial administrator

The setup endpoint accepts a raw secret only over an authenticated request and
stores neither that secret nor its verifier in MongoDB. Coolify receives only a
scrypt verifier. The endpoint works only while the database contains no
accounts and is disabled when `ADMIN_SETUP_SECRET_HASH` is absent.

Generate a secret locally, retain the raw value temporarily, and put only the
printed verifier in Coolify:

```sh
secret="$(openssl rand -base64 36)"
printf %s "$secret" | bun run setup:hash
```

Set the output as `ADMIN_SETUP_SECRET_HASH`, deploy the stack, and register the
first administrator:

```sh
curl --fail-with-body \
  --request POST \
  --header "Authorization: Bearer $secret" \
  --header "Content-Type: application/json" \
  --data '{
    "username": "operator",
    "password": "replace-with-the-account-password",
    "displayName": "Course Operator",
    "email": "operator@example.edu"
  }' \
  https://commons.example.edu/api/setup/register-admin
```

A successful request returns HTTP `201` and the new user identifier. Repeated
requests return HTTP `409`. Remove `ADMIN_SETUP_SECRET_HASH` from Coolify and
redeploy after success; the endpoint will then return HTTP `404`. The operator
can sign in through `/login` with the account password.

This creates the initial forum administrator. Establishing that account as a
course owner and linking it to a roster seat still requires the existing course
configuration operations; the one-browser course setup workflow is not yet
implemented.

## Verify the deployment

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
