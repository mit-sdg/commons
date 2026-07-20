---
milestone: repository-release
concepts: []
---

# Supply MongoDB configuration when Commons starts

## Resolution at completion

When `MONGODB_URL` is omitted, Commons stores concept state in memory. When it
is set, Commons accepts a `mongodb://` or `mongodb+srv://` URL whose path names
the database. When Commons stops, it closes the Mongo client it opened and
leaves the supplied MongoDB service and database running.

## Decision at completion

One Commons process accepts one application-supplied `mongodb://` or
`mongodb+srv://` URL. The URL path names the database. Invalid URLs, URLs
without a database name, and connection failures do not expose credentials.

## Verification at completion

Tests run Commons with memory and MongoDB, accept `mongodb://` and
`mongodb+srv://` URLs, and use the database named in each URL path. They reject
invalid URLs and MongoDB URLs without a database name without printing
credentials. When Commons stops, it closes the Mongo client it opened, and
the supplied MongoDB service and database remain available.
