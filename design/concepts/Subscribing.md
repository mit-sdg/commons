# Subscribing

## Purpose

Record the targets a person follows so later events on those targets can reach
them.

## Principle

Mara follows two threads, and her subscriptions list the newer one first.
Following the first thread again is refused. Unfollowing it succeeds once and
is refused the second time. Asking whether she follows a target always answers
yes or no.

## Types

```types
external Person
  An application-owned identity used in the person role.

external Target
  An application-owned identity used in the target role.
opaque Seq
  An ordered list of the values its argument names.
```

## State

```state
a set of Subscriptions with
  a user         Person
  a target       Target
  a subscribedAt Date

Rule: a person has at most one subscription to a given target.
Rule: subscribe records the supplied at as the moment the subscription began.
Rule: targets are opaque identities; Subscribing neither creates nor validates them.
```

## Actions

```actions
subscribe(user: Person, target: Target, at: Date) : returns (subscription: Subscription)
  where no subscription has this user and target
  then
    add a new subscription with user, target, and subscribedAt at
    returns subscription
  where some subscription has this user and target
  then
    refuses ALREADY_SUBSCRIBED "This person already follows the target."

unsubscribe(user: Person, target: Target) : returns (subscription: Subscription)
  where some subscription has this user and target
  then
    delete that subscription
    returns subscription
  where no subscription has this user and target
  then
    refuses NOT_SUBSCRIBED "There is no such subscription to drop."

clearTarget(target: Target) : returns (target: Target)
  where true
  then
    delete every subscription to target
    returns target
```

## Queries

```queries
_getSubscribers (target: String) : many (user: String)
  answers its subscribers in subscription order
  answers no rows when none match

_subscribersOf (target: String) : one (users: Seq<String>)
  answers the same subscribers as one value: an ordered sequence of user
  identities in subscription order
  answers an empty sequence when none match

_getSubscriptions (user: String) : many (target: String, subscribedAt: Date)
  answers the person's targets newest first
  answers no rows when none match

_isSubscribed (user: String, target: String) : one (subscribed: Flag)
  answers whether the Person follows the Target
```
