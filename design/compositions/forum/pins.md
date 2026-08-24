# Pins

Pinning is part of moderating a forum rather than a power of its own, so a
caller holding `moderate` adds a readable post through [Forum.pins.PinItem](reaction:Forum.pins.PinItem). [Forum.pins.UnpinItem](reaction:Forum.pins.UnpinItem) removes that readable post's pin under the same policy.
[Forum.pins.SetPinPriority](reaction:Forum.pins.SetPinPriority) changes the numeric priority of an existing pin. Pinning owns duplicate, missing-pin, and ordering refusals; higher
priority appears first.

[Forum.pins.PinsForScope](reaction:Forum.pins.PinsForScope) forms
[the priority-ordered readable pins](former:Forum.pins.thePinsOf) in one scope.
[Forum.pins.IsPinned](reaction:Forum.pins.IsPinned) reports one readable post's status in that scope. The
scope is treated as an opaque conversation identity used to group pins;
authority does not vary by scope, and pinning does not separately verify that
the conversation exists.

Trash hides a pin without removing it, so restore makes it visible again.
After permanent post purge, [Forum.pins.PurgeClearsPins](reaction:Forum.pins.PurgeClearsPins) removes its pins from
every scope.
Ordinary Posting deletion requests the same idempotent clear through post
cleanup.

```endpoints
Forum.pins.IsPinned at /pins/isPinned
Forum.pins.PinItem at /pins/pin
Forum.pins.PinsForScope at /pins/forScope
Forum.pins.SetPinPriority at /pins/setPriority
Forum.pins.UnpinItem at /pins/unpin
```
