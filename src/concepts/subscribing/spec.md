# Subscribing

## Purpose

Record the targets a person follows so later events on those targets can reach
them.

## Principle

Mara follows two threads, and her subscriptions list the newer one first.
Following the first thread again is refused. Unfollowing it succeeds once and
is refused the second time. Asking whether she follows a target always answers
yes or no.

## State

```state
a set of Subscriptions with
  a user         Person
  a target       Target
  a subscribedAt Date
```

A person has at most one subscription to a given target.

## Actions

```actions
subscribe (user: Person, target: Target, at: Date) : return (subscription: Subscription), refuse (message: String)
  where no subscription has this user and target
  then
    add a new subscription with user, target, and subscribedAt at
    return subscription
  where some subscription has this user and target
  then
    refuse "This person already follows the target."

unsubscribe (user: Person, target: Target) : return (subscription: Subscription), refuse (message: String)
  where some subscription has this user and target
  then
    delete that subscription
    return subscription
  where no subscription has this user and target
  then
    refuse "There is no such subscription to drop."

clearTarget (target: Target) : return (target: Target)
  then
    delete every subscription to target
    return target
```

`subscribe` records the supplied `at` as the moment the subscription began.
Targets are opaque identities: Subscribing neither creates nor validates them.

## Questions

- `_getSubscribers (target)` answers its subscribers in subscription order.
- `_getSubscriptions (user)` answers the person's targets newest first.
- `_isSubscribed (user, target)` answers exactly one row with `subscribed`.
