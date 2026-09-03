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

concrete LiveParticipant
  A live-run participant identity: an Authenticating user when the participant
  was signed in, or the device-minted identifier an anonymous participant
  presents.

concrete LiveReasoner
  The name of the reasoner the floor's worker serves; the deployment configures
  which model answers it.

concrete LiveRunSnapshot
  The complete structured presentation captured for one published live run, or
  for one round of a relay run.

concrete LiveMaterial
  What a live edition releases: a Questioning questionnaire for a quiz, survey,
  or round, or a Relaying relay for a relay run.

concrete LiveItem
  What one live answer addresses: a Questioning question, or one part of it,
  written `question#n` for the part or repetition n counting from one.

concrete LiveSubject
  What a live ask, insistence, or offering is about: a Drafting brief (a
  questionnaire being drafted), a Publishing edition (a round being sorted), a
  Responding response (a model participant answering), or a Relaying relay (a
  relay being drafted). The reactions that read a reply tell them apart by
  which concept answers for the subject.

concrete Subscriber
  Who follows something: a Commons user following a forum conversation, or a
  live participant the dashboard seated in a relay run.

concrete Subscribable
  What is followed: a forum conversation, or a Publishing edition that is a
  relay run, whose every round reaches the seated.

concrete Linkable
  What links or is linked to: a forum post, or a Publishing edition — a round's
  edition links to the run it opened in.

concrete Trashable
  What a person may move to trash: a forum post; a relay whose teaching life has
  ended, which retires it; or a seated live participant the dashboard dismissed,
  whose cards keep their mark because the seat stays.

concrete CategoryScope
  Where a category's name is unique: the forum, under the reserved scope `forum`,
  or a Publishing edition that is a round, whose categories are the piles on its
  wall.

concrete Categorizable
  What is sorted into a category: a forum post, or a card on a round's wall —
  the wall's identity for one handed-in answer, minted from its response and
  item so the card names neither.
```

## Instances

Commons selects a same-name instance of every concept it registers, except
`Notifying`, which is registered twice: under its own name for the forum, and as
`TaskNotifying` for the task domain. Each instance supplies its external
parameters inline.

```instances
instantiate Trashing as Archiving with
  User is Authenticating.User
  Item is Authenticating.User

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
  Scope is CategoryScope
  Item is Categorizable

instantiate Conversing with
  Item is Posting.Post

instantiate Drafting with
  Author is Authenticating.User
  Origin is Questioning.Questionnaire

instantiate Trashing as DraftTrashing with
  User is Authenticating.User
  Item is Drafting.Brief

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

instantiate Insisting with
  Aim is LiveSubject

instantiate Inviting with
  User is Authenticating.User

instantiate Itemizing with
  Item is Assigning.Assignment

instantiate Linking with
  Source is Linkable
  Target is Linkable

instantiate Linking as AdoptLinking with
  Source is Drafting.Brief
  Target is Questioning.Questionnaire

instantiate Linking as PickLinking with
  Source is Publishing.Edition
  Target is Categorizing.Category

instantiate Locking with
  Target is Lockable

instantiate Locating with
  Subject is Publishing.Edition

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

instantiate Publishing with
  Author is Authenticating.User
  Material is LiveMaterial

instantiate Questioning with
  Author is Authenticating.User

instantiate Reacting with
  Person is Authenticating.User
  Target is Posting.Post

instantiate Reasoning with
  Reasoner is LiveReasoner
  Subject is LiveSubject

instantiate Relaying with
  Author is Authenticating.User
  Material is Questioning.Questionnaire

instantiate Responding with
  Subject is Publishing.Edition
  Participant is LiveParticipant
  Item is LiveItem

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

instantiate Scoring with
  Subject is Publishing.Edition
  Item is Questioning.Question
  Submission is Responding.Response

instantiate Snapshotting as RunSnapshotting with
  Subject is Publishing.Edition
  Value is LiveRunSnapshot

instantiate Sessioning with
  User is Authenticating.User

instantiate Sharing with
  Subject is Publishing.Edition

instantiate Suggesting with
  Subject is LiveSubject

instantiate Submitting with
  Submitter is Authenticating.User
  Assignment is Assigning.Assignment
  Artifact is Posting.Post

instantiate Subscribing with
  Person is Subscriber
  Target is Subscribable

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
  Item is Trashable

instantiate Vouching as PasswordResetVouching with
  Subject is Authenticating.User
```

Authenticating owns the application's person identity. Rostering, profiles,
sessions, roles, authored content, course records, and personal forum state all
refer back to that account identity.

Assigning owns assignment identities. Grade items, grades, late-day uses, and
submissions refer to an assignment rather than creating another copy of it.
Rostering owns section identities; an assignment's target list contains those
sections. A grade may cite a Submitting submission as evidence, and a submission
uses a Posting post as its artifact. Invitation, notification, and password-reset workflows supply the concrete `MailKey` used to deduplicate queued email messages. PasswordResetVouching is the single registered instance of the generic Vouching concept; it binds its subject to the account identity, so one of its vouchers entitles its bearer to set that one account's password once. Naming the instance for its errand keeps a later second instance — an address confirmation, say — from inheriting the password-reset mail.

Posting owns post identities. Forum features attach their own state to a post
without taking ownership of it. Conversing separately owns conversation
identities; subscriptions, unread scopes, pins, role contexts, and locks can use
a conversation. Locking also accepts a post directly, so its target role has two
valid owners. Roling also receives the reserved application-wide context
`commons`; because that value is a Commons constant rather than a concept-owned
identity, it has no second type binding, and it names the deployment as a whole
rather than any one area of it, so no capability held there belongs to the forum
in particular. Every capability Commons declares is held and enforced in that one
context, and the caller's permissions read answers for it. Role-management
endpoints can store other opaque context strings, but built-in policy interprets
only `commons` and conversation identities. The reserved
`administer` wildcard is a Commons decision in the same way: Roling stores only
the capability names a role was defined with and answers plain containment, so
every enforcing endpoint accepts either the capability it requires or
`administer`, and no concept expands the wildcard. Sessioning evaluates session expiry against the current instant.

Grouping owns task list group identities. A task list is a Grouping group whose
members are Authenticating users. Tasking owns task identities within a list
scope, so a task records its holding list as its Scope. Every member of a group
holds equal power over the group and the tasks scoped to it.

`TaskSubject` has two valid owners, as `Lockable` does: a Grouping group for a
task-list membership event, and a Tasking task for an assignment or a change to
an assigned task. TaskNotifying uses that identity as both the subject and the
link of an entry.

The live domain runs quizzes and surveys during a meeting. Questioning owns
questionnaire and question identities; Publishing fixes an open edition of one
questionnaire, Sharing owns its opaque participation token, and Locating gives
the same edition a durable six-character room code. The code is a convenient,
deliberately guessable locator rather than a credential; participation resolves
it to the existing token and applies the same run state.
Responding and Scoring both use the edition as their subject and Questioning's
questions as their items, so an answer, an expectation, and a result all name
the same question identity. `LiveParticipant` has two valid owners in the same
way `Lockable` does: an Authenticating user for a signed-in participant, and an
opaque device-minted identifier for an anonymous one — the participation
endpoints decide which a caller presents. Drafting owns brief and candidate
identities for the natural-language route into Questioning; Reasoning's asks
are about a Drafting brief, Insisting stands on the same brief when a yield
comes back unusable, and `LiveReasoner` names the mind the floor's worker
serves. Adopting a candidate is what turns drafted material into an ordinary
editable questionnaire; nothing else crosses from the drafting line into the
live domain.

A relay is a Relaying relay whose legs' materials are one-question questionnaires of the survey form, so `LiveMaterial` has two owners the way `Lockable` does: Publishing releases a questionnaire as a quiz, survey, or round, and a relay as the run those rounds belong to. Linking ties each round's edition to its run, PickLinking records which categories — the piles — a closed round carried into the next, and Seating holds the run's model seats: a `LiveParticipant` the dashboard invited follows the run, and every round that opens reaches it. `LiveItem` widens Responding's item: a question with parts is answered one part at a time, each part its own item. Piles are Categorizing categories whose scope is the round's edition, holding `LiveCard` identities the wall computations mint; the forum's categories stand in the `forum` scope beside them. Reasoning, Insisting, and Suggesting share `LiveSubject`; every reaction that reads a reply or a complaint binds the concept that answers for its subject, so a reply about a brief never reaches a wall's reactions and a reply about a round never reaches drafting's. The forum's one Categorizing scope is the reserved constant `forum`, a Commons decision like `commons`.

DraftTrashing marks an author deliberately leaving an unfinished draft line.
The drafting composition applies it to the canonical root brief and uses the
marker to stop later reasoning work; Drafting's own lifecycle and state machine
remain unchanged, and the retained line stays available as read-only history.

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

capabilitiesAreKnown(capabilities: Strings) : Bool
  Reports whether every named capability appears in the application's registry,
  which holds the four granted capabilities and not the administer wildcard.

effectiveCapabilities(capabilities: Strings) : Strings
  Expands a role's stored capabilities for presentation, answering the whole
  registry when the role carries the administer wildcard. Enforcement does not use
  it: an enforcing endpoint checks the capability it requires or the wildcard.

passwordResetCooldownStart(at: Date) : Date
  Answers the instant five minutes before the request. A voucher issued at or after
  it means the account was already sent a reset mail recently, so the request issues
  no second voucher and sends no second message.

passwordResetExpiry(at: Date) : Date
  Answers the instant one hour after the request, when a reset voucher lapses.

passwordResetMailText(voucher: String, credential: String, username: String) : String
  Renders the plain-text password-reset message naming the account.

passwordResetMailHtml(voucher: String, credential: String, username: String) : String
  Renders the HTML password-reset message naming the account.

setupSecretMatches(secret: String) : Bool
  Reports whether the candidate matches the configured setup-secret verifier.

singleImportRow(email: String, kind: String, section: String, displayName: String) : Rows
  Composes the single import row that adding one person by hand carries into the
  roster import. An empty section or display name means the row carries none, the
  way an omitted CSV field does, so a person added by hand reads back exactly as
  the same person imported.

subjectIsAddress(subject: String) : Bool
  Reports whether a role subject holds an `@` and is therefore written as an email
  address rather than as an account identifier or a username.

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

draftTitle(form: String) : String
  Renders a privacy-safe default title for an adopted AI draft from its form,
  without exposing the author's request to participants.

draftingPassage(request: String) : String
  Renders the passage that asks the reasoner to draft a questionnaire from a
  creator's plain-language request.

revisionPassage(request: String, form: String, material: Json) : String
  Renders the passage that asks the reasoner to revise existing material,
  changing only what the correction asks and otherwise preserving its form.

clarifiedPassage(request: String, question: String, answer: String) : String
  Renders the passage that resumes drafting from the original request, the
  clarifying question, and the creator's answer.

repairPassage(request: String, offering: String, account: String) : String
  Renders the passage that stands on a request: the original ask, the exact
  reply that came back, and the account of what was wrong with it.

parseKind(reply: String) : String
  Reads a reasoner's reply and answers `draft`, `question`, or `neither` —
  the three-way partition every drafting reaction branches on.

parsedForm(reply: String) : String
  Answers the drafted form of a `draft` reply, and an empty string otherwise.

parsedMaterial(reply: String) : Json
  Answers the drafted material entries of a `draft` reply, and an empty
  sequence otherwise.

parsedQuestion(reply: String) : String
  Answers the clarifying question of a `question` reply, and an empty string
  otherwise.

parsedReason(reply: String) : String
  Answers the account of why a reply could not be read, and an empty string
  when it could.

soleTarget(target: String) : Strings
  Wraps the one questionnaire a drafting line links — the one it refines or
  composed — as the sequence Linking takes.

positionAfter(position: Number) : Number
  Answers the place one past the given one. Questions stand contiguously,
  counting from one, so appending reckons from the count and moving a question
  later reckons from its own place.

positionBefore(position: Number) : Number
  Answers the place one before the given one, for moving a question earlier
  and for closing ranks after a removal.

receiptKind(choices: Strings, expected: String) : String
  Names a submitted answer's feedback as graded, reference, or ungraded from
  the authored question material, without adding feedback state to a concept.
```

Two of these decide rather than render. `singleImportRow` composes the one row a
single-person add carries, so adding one person and importing one CSV line reach
Rostering through the same import rather than through two seat-creating routes
whose consequences would then have to be kept in step. `subjectIsAddress` answers
whether a role subject was written as an address, which is what lets the role
endpoints refuse an address no account holds while leaving every other unmatched
reference opaque.

The rest render Commons-specific email bodies. Compositions pass
the rendered text and HTML to Mailing, which queues the finished message for the
mail worker to transport. The task renderers take resolved content rather than
an identity, because a task email is a snapshot: it must still read on its own
after the task or list it names has changed or gone.
