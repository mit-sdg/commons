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

concrete TaskSubject
  A task-list group or task identity that a task-domain notification is about and links to.
```

## Instances

Commons selects a same-name instance of every concept it registers, and one
concept also carries a second: `Notifying` is registered twice, once under its
own name for the forum and once as `TaskNotifying` for the task domain. An aliased instance is
written `instantiate Notifying as TaskNotifying`, and the alias, not the
definition name, is the instance every task-domain reaction, former, and
endpoint binds to. Each instance supplies its external parameters inline.

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

instantiate Grouping with
  Person is Authenticating.User

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

instantiate Notifying as TaskNotifying with
  Person is Authenticating.User
  Subject is TaskSubject
  Link is TaskSubject

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

instantiate Submitting with
  Submitter is Authenticating.User
  Assignment is Assigning.Assignment
  Artifact is Posting.Post

instantiate Subscribing with
  Person is Authenticating.User
  Target is Conversing.Conversation

instantiate Tagging with
  Target is Posting.Post

instantiate Tasking with
  Scope is Grouping.Group
  Assignee is Authenticating.User

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
conversation identities. Sessioning evaluates session expiry against the current instant.

Grouping owns task list group identities. A task list is a Grouping group whose
members are Authenticating users. Tasking owns task identities within a list
scope, so a task records its holding list as its Scope. Every member of a group
holds equal power over the group and the tasks scoped to it.

A task-domain notification is about the concrete `TaskSubject`, which has two
valid owners exactly as `Lockable` does: a Grouping group when the event is a
change of task-list membership, and a Tasking task when it is an assignment or
a change to an assigned task. TaskNotifying carries that one identity as both
the subject and the link of an entry, so a membership entry points at its list
and a task entry points at its task. A reader's inbox tells the two apart by
which read resolves the identity, the group read or the task read, never by
parsing the entry's kind, so renaming a kind cannot misroute a row. The
forum's Notifying instance is untouched: its subject and link remain Posting
posts, and neither instance can see the other's entries.

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

taskListMailSubject(kind: String, listTitle: String) : String
  Renders the subject line for a task-list membership notification of that kind.

taskListMailText(kind: String, listTitle: String) : String
  Renders the plain-text membership message naming the list.

taskListMailHtml(kind: String, listTitle: String) : String
  Renders the HTML membership message naming the list.

taskMailSubject(kind: String, taskTitle: String, listTitle: String) : String
  Renders the subject line for a task assignment or task state change of that kind.

taskMailText(kind: String, taskTitle: String, listTitle: String, deadline: String) : String
  Renders the plain-text task message, saying which change occurred and naming the task, its list, and its deadline.

taskMailHtml(kind: String, taskTitle: String, listTitle: String, deadline: String) : String
  Renders the HTML task message, saying which change occurred and naming the task, its list, and its deadline.
```

These pure computations render Commons-specific email bodies. Compositions pass
the rendered text and HTML to Mailing, which queues the finished message for the
mail worker to transport. The task renderers take resolved content rather than
an identity, because a task email is a snapshot: it must still read on its own
after the task or list it names has changed or gone.
