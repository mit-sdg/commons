# Commons vocabulary

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

Assigning.Author is Authenticating.User
Assigning.Assignee is Authenticating.User
Banking.Learner is Authenticating.User
Bookmarking.User is Authenticating.User
Flagging.User is Authenticating.User
Grading.Grader is Authenticating.User
Grading.Learner is Authenticating.User
Inviting.User is Authenticating.User
Notifying.Person is Authenticating.User
Noting.Author is Authenticating.User
Noting.Learner is Authenticating.User
Posting.Author is Authenticating.User
Profiling.User is Authenticating.User
Reacting.Person is Authenticating.User
Resolving.User is Authenticating.User
Roling.User is Authenticating.User
Rostering.User is Authenticating.User
Sessioning.User is Authenticating.User
Submitting.Submitter is Authenticating.User
Subscribing.Person is Authenticating.User
Tracking.User is Authenticating.User
Trashing.User is Authenticating.User
Assigning.Sections is Rostering.Section
Banking.Item is Assigning.Assignment
Grading.Item is Assigning.Assignment
Itemizing.Item is Assigning.Assignment
Submitting.Assignment is Assigning.Assignment
Grading.Criterion is Itemizing.Criterion
Grading.Evidence is Submitting.Submission
Mailing.Key is MailKey
Submitting.Artifact is Posting.Post
Bookmarking.Item is Posting.Post
Categorizing.Item is Posting.Post
Conversing.Item is Posting.Post
Flagging.Target is Posting.Post
Formatting.Target is Posting.Post
Linking.Source is Posting.Post
Linking.Target is Posting.Post
Locking.Target is Lockable
Notifying.Link is Posting.Post
Notifying.Subject is Posting.Post
Pinning.Item is Posting.Post
Reacting.Target is Posting.Post
Resolving.Answer is Posting.Post
Resolving.Question is Posting.Post
Revising.Item is Posting.Post
Tagging.Target is Posting.Post
Tracking.Item is Posting.Post
Trashing.Item is Posting.Post
Pinning.Scope is Conversing.Conversation
Roling.Context is Conversing.Conversation
Subscribing.Target is Conversing.Conversation
Tracking.Scope is Conversing.Conversation
Sessioning.Moment is Timing.Moment
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
