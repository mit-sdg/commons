# Recovery

Anyone can ask for a password reset by email, without a session.
[Access.recovery.RequestPasswordReset](reaction:Access.recovery.RequestPasswordReset) always answers the same
acceptance once the address is well formed, whether or not it belongs to an
account, so the endpoint never confirms which addresses are registered. In a
separate branch it looks up the account holding that address — an address
identifies at most one — and asks PasswordResetVouching to issue it a voucher
that lapses an hour after the request. That branch also refuses to run twice in
quick succession: when the account already holds a voucher issued within the
last five minutes, no second voucher is issued and no second message is queued,
so an unauthenticated stranger cannot aim the endpoint at somebody's inbox. The
answer is the same acceptance either way. Issuing supersedes any voucher the
account already held, so at most one reset code stands at a time.

Each issued voucher triggers
[Access.recovery.PasswordResetQueuesMail](reaction:Access.recovery.PasswordResetQueuesMail), which renders a
message naming the account's username and queues it in Mailing under the
voucher identity. The message carries a link holding the voucher and,
separately, the reset code — the voucher's credential, which
PasswordResetVouching derives from a deployment secret and never stores.
Splitting the two means a leaked link alone — from a shared URL, a referrer, or
a browser history — cannot reset the account. Voucher state is durable before
this consequence runs, and once enqueue succeeds an SMTP failure leaves the
message pending for a later attempt.

[Access.recovery.ResetPassword](reaction:Access.recovery.ResetPassword) accepts the voucher, its code, and a
new password. It verifies the voucher first without consuming it, so a refused
password — too short, too long — leaves the voucher usable for another attempt.
Only after Authenticating replaces the verifier does it redeem the voucher and
end every session the account holds, so a stolen session does not survive a
recovery. An unknown voucher, a superseded one, a wrong code, and a lapsed
voucher all receive the same refusal.

Both endpoints answer without a session, so `src/edge.ts` lists them among the
paths its session gate lets through, and the frontend lists `/forgot-password`
and `/reset-password` among the pages its own gate serves signed out. A person
who cannot sign in cannot reach either otherwise.

```endpoints
Access.recovery.RequestPasswordReset at /auth/request-password-reset
Access.recovery.ResetPassword at /auth/reset-password
```
