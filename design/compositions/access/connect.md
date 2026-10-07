# Sign in with Commons

A course app can sign a person in as their Commons account without ever asking
for their Commons password. For each sign-in the app's server makes a random
verifier and keeps it. The app sends the browser to Commons' `/connect` page,
naming itself by its origin and carrying a `state` value of its own and the
verifier's challenge, its SHA-256 hash. Commons asks the signed-in person
whether that app may learn who they are, remembers the answer, and sends the
browser back to the app with a sign-in code. The app's server trades the code
and the verifier with Commons for the person's identity and starts a session of
its own. The app makes up the `state` and checks it when the browser returns;
Commons only carries it back. This is Proof Key for Code Exchange (RFC 7636)
with the `S256` method.

An app is its origin. [connectAppAccepted](computation:connectAppAccepted)
accepts `https://` with the domain configured as `CONNECT_APP_DOMAIN` or a name
one DNS label below it, so the platform's owner portal at the domain itself and
each team's app below it qualify, while a name two labels down does not.
`http://localhost` and `http://127.0.0.1` at an explicit port always qualify, so
an app can be built against a Commons running beside it. The origin must be
written exactly the way a browser writes one, in lowercase with no path, query,
fragment, credentials, or trailing slash. Commons' own public origin never
qualifies, so no page Commons serves ever receives a code. A code always goes to
[the app's one callback](computation:connectCallback), `/auth/commons/callback`
on that origin. An app cannot name another address, so a code can only reach
the origin the person was shown.

Every app sends a challenge with each sign-in: 43 base64url characters and
`code_challenge_method=S256`. A challenge with no method is
[not accepted](computation:connectChallengeAccepted), because RFC 7636 reads a
missing method as `plain`, and neither is any method but `S256`. The one exception is the platform's owner portal at the configured
domain itself, which signed people in before challenges existed. It may still
ask without one until it sends one too.

The consent page first reads [Access.connect.DescribeApp](reaction:Access.connect.DescribeApp).
It answers an accepted app with [the host it is shown by](computation:connectAppHost),
its callback, and whether the caller has already approved it. Any other origin
is refused with `CONNECT_APP_INVALID`, and an accepted app's request without an
acceptable challenge with `CONNECT_CHALLENGE_INVALID`, so the page shows an
error instead of sending the browser anywhere. It takes the caller from the session, as
approving, listing, and withdrawing do below; only redeeming takes none.

[Access.connect.ApproveApp](reaction:Access.connect.ApproveApp) checks the app
and its challenge again. An origin that does not qualify, or a challenge that
doesn't, is [refused](reaction:Access.connect.ApproveAppRefused) before anything
is remembered. For an accepted app it has Connecting remember the caller's
approval or answer the one already standing, and asks ConnectVouching to issue
a voucher for that connection with the challenge as its counterpart. The
voucher lapses [sixty seconds after approval](computation:connectCodeExpiry). It answers
[the code](computation:connectCode), which is the voucher and its credential, and
the callback. ConnectVouching derives the credential from `VOUCHER_SECRET` and
never stores it. The page then sends the browser to the callback with the code
and the app's `state`. An app the person approved before is approved again in
the same way, without a prompt, which is what lets a returning person through
in one redirect.

Approving turns a person's session into an answer another site can use, so it
must be the person's own act. The session cookie is `SameSite=Strict`, but a
student's app on the platform domain is the same site as Commons, and a browser
sends the cookie with that app's requests to Commons. The HTTP package refuses a
request to any session path that carries an `Origin` other than Commons' own, so
a page on a course app cannot approve itself on somebody's behalf. Commons sends no CORS
headers either, so such a page could not read a code even if it got one issued.
The consent page cannot be framed, so it cannot be dressed up inside another
page.

[Access.connect.RedeemCode](reaction:Access.connect.RedeemCode) is where the
app's server, holding no Commons session, presents the code, its own origin,
and the verifier. It [reads the voucher](computation:connectCodeVoucher) and
[its credential](computation:connectCodeCredential) out of the code,
[hashes the verifier](computation:connectVerifierChallenge) into the challenge
it answers, and redeems the voucher with that counterpart before checking
anything else, so a code is spent the first time anybody presents it, whatever
then fails. ConnectVouching honors it only when the counterpart agrees: a code
issued with a challenge needs the verifier that hashes to it, and a code issued
without one, for the owner portal, is refused when any verifier comes with it. It answers only when the connection
the voucher was issued for still stands, belongs to the app presenting the code,
and names an account that is not archived. The answer is the account's stable
`user`, its `username` and `email`, and [the name to show](computation:connectDisplayName):
the profile's display name, or the username when there is no profile or its
name is blank. An
unknown, used, lapsed, or superseded code, a missing, wrong, or malformed
verifier, a code issued to another app, an approval withdrawn since, and an
archived account all receive one refusal, `CONNECT_CODE_INVALID`, and the app
learns nothing about which check failed.

A code is short-lived, single-use, bound to one approval, and bound to the
sign-in that asked for it, each for a reason. It travels in a URL, through the
browser's history and perhaps a server's log, so it must be worthless a minute
later and the moment it is used. Binding it to the connection between one
person and one app means a code taken from one app's callback cannot be
redeemed by another app. Binding it to the challenge means a code read from
Sam's callback address cannot be redeemed by Leo, even through the same app:
when Leo brings Sam's code back to the app in a sign-in Leo started, the app's
server presents Leo's verifier, the counterpart doesn't agree, and the code is
spent. The challenge belongs to one sign-in and the connection to a lasting
approval, which is why the challenge is kept on the voucher and not on the
connection. It also makes Vouching's rule
that issuing discards the subject's earlier vouchers apply per approval: a new
code for an app retires that app's unredeemed code for the same person, while
codes issued to two apps stand side by side.

A challenge does not help when Leo starts the sign-in himself. Leo can send Sam
a `/connect` link that carries Leo's own `state` and challenge. Commons approves
the app for Sam without asking him again, because Sam approved it before, and
sends Sam's browser to the callback with a code for Sam. An app that checks
`state` refuses that callback, since Sam's browser does not hold Leo's sign-in,
so the code is not spent. If Leo reads the code from Sam's browser history
within its sixty seconds, he holds the verifier that matches it. Short,
single-use codes are the defense here today.

Redeeming is server to server. `src/edge.ts` lists its path among those its
session gate lets through and answers it with `Cache-Control: no-store`. Every
refusal of a code maps to the HTTP package's `UNAUTHORIZED` category, and the
edge turns that into a 400 naming `CONNECT_CODE_INVALID`, the answer apps are
written against. Commons sends no CORS headers on this path or any other, so a
page in a browser cannot redeem a code and read the answer; an app's server can.
The engine's records redact the `credential` and `code_verifier` fields
(`src/assembly/application.ts`). They keep the `code` field, which contains the
credential, because class codes and live-room codes share that name. A code
issued with a challenge is useless without its verifier, so only the owner
portal's codes stay redeemable from the records, for their sixty seconds.

[Access.connect.ListConnections](reaction:Access.connect.ListConnections) shows
the caller [the apps they have approved](former:Access.connect.theConnectionsOf),
the most recent first, with when each was approved.
[Access.connect.WithdrawConnection](reaction:Access.connect.WithdrawConnection)
removes one of the caller's own connections. Another person's connection and one
already gone both answer `NOT_FOUND`, so a caller learns nothing about
connections that are not theirs. Withdrawing makes the app's unredeemed code
useless, because redeeming requires the connection to stand, and the app's next
sign-in asks the person again.

What Commons hands an app is an answer at one moment, not a lasting tie. An app
that has redeemed a code keeps its own session for as long as it chooses: a
later password change, an archive, or a withdrawn connection does not end a
session the app has already started. Ending those sessions is the app's
responsibility; Commons only stops the next sign-in.

```endpoints
Access.connect.ApproveApp at /connect/approve
Access.connect.ApproveAppRefused at /connect/approve
Access.connect.DescribeApp at /connect/describe
Access.connect.ListConnections at /connect/list
Access.connect.RedeemCode at /connect/redeem
Access.connect.WithdrawConnection at /connect/withdraw
```
