# Deploy Commons

Commons is deployed via [`platform.yaml`](platform.yaml) connected to a managed
MongoDB instance. The platform deployment runs exactly one Commons backend
process alongside the Next.js frontend.

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

| Variable                  | Requirement                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `MONGODB_URI`             | Required scoped MongoDB connection, including a database name and any required TLS options |
| `PUBLIC_ORIGIN`           | Required exact browser origin, without a trailing slash                                    |
| `INVITATION_SECRET`       | Required stable secret of at least 32 characters; startup refuses a shorter one            |
| `VOUCHER_SECRET`          | Required stable secret of at least 32 characters, distinct from `INVITATION_SECRET`        |
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
