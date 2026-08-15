---
milestone: repository-release
concepts: []
---

# Keep internal failures and secrets behind the public boundary

## Resolution at completion

The edge maps internal failure detail to the public failure contract. The
engine's ordinary logger records only the exception class and safe correlation
fields. Retained authentication action records and observer events contain
`[redacted]` for password fields. Runtime fault records contain a recognized
framework code or `UNKNOWN_ERROR`, never the thrown message, stack, cause, or
attached fields.

## Decision at completion

The HTTP contract is 400 `{"error":"INVALID_REQUEST"}`, 401
`{"error":"UNAUTHORIZED"}`, 403 `{"error":"FORBIDDEN"}`, 404
`{"error":"NOT_FOUND"}`, 409 `{"error":"CONFLICT"}`, and 500
`{"error":"INTERNAL_ERROR"}`. Bodies contain only `error`. Malformed or
contract-invalid input uses 400; failed identity proof uses 401; a denied
non-secret operation uses 403; missing or protected material uses 404; other
domain refusals use 409; and framework, timeout, transport, and database faults
use 500. Domain and framework details remain in redacted process diagnostics.

## Verification at completion

Mapping tests cover each public status and error. Edge tests confirm exact bodies
for malformed input, absent and invalid sessions, missing resources, and an
internal fault. Fault injection confirms that the response and ordinary logs omit
the thrown connection and password details. Instrumented authentication tests
confirm that retained action and fault records and observer events omit passwords
and thrown messages, with password fields recorded as `[redacted]`.
