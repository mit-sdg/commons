# Recovery

Anyone can ask for a password reset by email, without a session.
[Access.recovery.RequestPasswordReset](reaction:Access.recovery.RequestPasswordReset) always answers the same
acceptance once the address is well formed, whether or not it belongs to an
account, so the endpoint never confirms which addresses are registered. In a
separate branch it looks up the account holding that address — an address
identifies at most one — and asks Vouching to issue it a voucher that lapses an
hour after the request.

Each issued voucher triggers
[Access.recovery.PasswordResetQueuesMail](reaction:Access.recovery.PasswordResetQueuesMail), which renders a
message naming the account's username and queues it in Mailing under the
voucher identity. The message carries a link holding the voucher and,
separately, the reset code — the voucher's credential, which Vouching derives
from a deployment secret and never stores. Voucher state is durable before this
consequence runs, and once enqueue succeeds an SMTP failure leaves the message
pending for a later attempt.

[Access.recovery.ResetPassword](reaction:Access.recovery.ResetPassword) accepts the voucher, its code, and a
new password. It verifies the voucher first without consuming it, so a refused
password — too short, too long — leaves the voucher usable for another attempt.
Only after Authenticating replaces the verifier does it redeem the voucher,
which also discards any other vouchers outstanding for the account, and end
every session the account holds, so a stolen session does not survive a
recovery. An unknown voucher, a wrong code, and a lapsed voucher all receive
the same refusal.

```endpoints
Access.recovery.RequestPasswordReset at /auth/request-password-reset
Access.recovery.ResetPassword at /auth/reset-password
```
