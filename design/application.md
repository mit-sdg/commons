# Commons application

Commons passes identities between independent concepts. The concept on the right
creates and owns the identity; the role on the left only stores or uses it. For
example, `Profiling.User is Authenticating.User` means that a profile's user is
an account created by Authenticating. These bindings enumerate relationships
between concept types, not every literal value an application may reserve in an
opaque role.

## Types

This list is exhaustive for external roles used by Commons concepts.

```types
concrete MailKey
  A stable deduplication key supplied by an application workflow.

concrete Lockable
  A post or conversation identity that moderation may lock.
```

## Instances

Commons selects one same-name instance of every concept it registers, and each
instance supplies its external parameters inline.

```instances
instantiate Assigning with
  Author is Authenticating.User
  Assignee is Authenticating.User
  Sections is Rostering.Section

instantiate Authenticating

instantiate Banking with
  Learner is Authenticating.User
  Item is Assigning.Assignment

instantiate Bookmarking with
  User is Authenticating.User
  Item is Posting.Post

instantiate Categorizing with
  Item is Posting.Post

instantiate Conversing with
  Item is Posting.Post

instantiate Flagging with
  User is Authenticating.User
  Target is Posting.Post

instantiate Formatting with
  Target is Posting.Post

instantiate Grading with
  Grader is Authenticating.User
  Learner is Authenticating.User
  Item is Assigning.Assignment
  Criterion is Itemizing.Criterion
  Evidence is Submitting.Submission

instantiate Inviting with
  User is Authenticating.User

instantiate Itemizing with
  Item is Assigning.Assignment

instantiate Linking with
  Source is Posting.Post
  Target is Posting.Post

instantiate Locking with
  Target is Lockable

instantiate Mailing with
  Key is MailKey

instantiate Notifying with
  Person is Authenticating.User
  Subject is Posting.Post
  Link is Posting.Post

instantiate Noting with
  Author is Authenticating.User
  Learner is Authenticating.User

instantiate Pinning with
  Item is Posting.Post
  Scope is Conversing.Conversation

instantiate Posting with
  Author is Authenticating.User

instantiate Profiling with
  User is Authenticating.User

instantiate Reacting with
  Person is Authenticating.User
  Target is Posting.Post

instantiate Resolving with
  User is Authenticating.User
  Question is Posting.Post
  Answer is Posting.Post

instantiate Revising with
  Item is Posting.Post

instantiate Roling with
  User is Authenticating.User
  Context is Conversing.Conversation

instantiate Rostering with
  User is Authenticating.User

instantiate Sessioning with
  User is Authenticating.User
  Moment is Timing.Moment

instantiate Submitting with
  Submitter is Authenticating.User
  Assignment is Assigning.Assignment
  Artifact is Posting.Post

instantiate Subscribing with
  Person is Authenticating.User
  Target is Conversing.Conversation

instantiate Tagging with
  Target is Posting.Post

instantiate Timing

instantiate Tracking with
  User is Authenticating.User
  Item is Posting.Post
  Scope is Conversing.Conversation

instantiate Trashing with
  User is Authenticating.User
  Item is Posting.Post
```

Authenticating owns the application's person identity. Rostering, profiles,
sessions, roles, authored content, course records, and personal forum state all
refer back to that account identity.

Assigning owns assignment identities. Grade items, grades, late-day uses, and
submissions refer to an assignment rather than creating another copy of it.
Rostering owns section identities; an assignment's target list contains those
sections. A grade may cite a Submitting submission as evidence, and a submission
uses a Posting post as its artifact. Invitation and notification workflows supply the concrete `MailKey` used to deduplicate queued email messages.

Posting owns post identities. Forum features attach their own state to a post
without taking ownership of it. Conversing separately owns conversation
identities; subscriptions, unread scopes, pins, role contexts, and locks can use
a conversation. Locking also accepts a post directly, so its target role has two
valid owners. Roling also receives the reserved application-wide context
`forum`; because that value is a Commons constant rather than a concept-owned
identity, it has no second type binding. Role-management endpoints can store
other opaque context strings, but built-in policy interprets only `forum` and
conversation identities. Sessioning uses Timing's current-moment value to decide
expiry.

These bindings record application meaning. They do not copy state, validate an
identity at runtime, or make one concept depend on another.

## Computations

```computations
invitationMailText(invitation: String, credential: String) : String
  Renders the plain-text invitation message.

invitationMailHtml(invitation: String, credential: String) : String
  Renders the HTML invitation message.

notificationMailText(notification: String) : String
  Renders the plain-text notification message.

notificationMailHtml(notification: String) : String
  Renders the HTML notification message.

setupSecretMatches(secret: String) : Bool
  Reports whether the candidate matches the configured setup-secret verifier.
```

These pure computations render Commons-specific email bodies. Compositions pass
the rendered text and HTML to Mailing, which queues the finished message for the
mail worker to transport.
