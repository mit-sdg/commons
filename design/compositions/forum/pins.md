# Pins

Pinning is part of moderating a forum rather than a power of its own, so a
caller holding `moderate` adds a readable post through [Forum.pins.PinItem](reaction:Forum.pins.PinItem). [Forum.pins.UnpinItem](reaction:Forum.pins.UnpinItem) removes that readable post's pin under the same policy.
[Forum.pins.SetPinPriority](reaction:Forum.pins.SetPinPriority) changes the numeric priority of an existing pin. Pinning owns duplicate, missing-pin, and ordering refusals; higher
priority appears first.

[Forum.pins.PinsForScope](reaction:Forum.pins.PinsForScope) forms
[the priority-ordered readable pins](former:Forum.pins.thePinsOf) in one scope.
[Forum.pins.IsPinned](reaction:Forum.pins.IsPinned) reports one readable post's status in that scope. The
scope must be the post’s actual conversation, and the caller must currently belong to its audience.

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

[pinnable](view:Forum.pins.pinnable) A pin belongs to the post’s actual conversation and requires current reader admission.

## Pinned discussions

A whole discussion can also stand above the discussion list for every reader.
Those pins live in Pinning's reserved `discussions` scope, with the
conversation as the item. Only Staff may change them:
[Forum.pins.PinDiscussion](reaction:Forum.pins.PinDiscussion) pins a
conversation the caller can read, and pinning one that is already pinned
succeeds without a second pin.
[Forum.pins.UnpinDiscussion](reaction:Forum.pins.UnpinDiscussion) removes it,
and removing a pin that is not there also succeeds. A reader outside Staff who
can read the conversation is refused with `FORBIDDEN`; anyone who cannot read
it gets `NOT_FOUND`, so a pin never confirms that a private discussion exists.
Every pin in the scope has the same priority, so the most recently pinned
discussion comes first.

[Forum.pins.PinnedDiscussions](reaction:Forum.pins.PinnedDiscussions) forms
[the pinned discussions a reader may see](former:Forum.pins.thePinnedDiscussionsOf).
Each pin is checked against the reader's current audience admission, so a pin
on a private discussion is invisible to everyone outside its audience, and a
trashed discussion drops out of the list until it is restored. Purging the
conversation removes its pin through the same purge cleanup that clears a
post's pins.

```endpoints
Forum.pins.PinDiscussion at /discussions/pin
Forum.pins.PinnedDiscussions at /discussions/pinned
Forum.pins.UnpinDiscussion at /discussions/unpin
```
