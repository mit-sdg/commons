<!-- Generated from the Commons assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.0.0-beta.14; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.0.0-beta.14. -->

# Commons — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Assigning

Defined in [Assigning](../design/concepts/Assigning.md), line 1.

#### Actions

- `createDraft(author: Author, title: String, instructions: String, kind: String, availableAt: Date, dueAt: Date, closeAt: Date, acceptsSubmissions: Bool, audience: String, targets: Sections, at: Date) : return (assignment: Assignment)`
  - Refuses `ASSIGNMENT_EVERYONE_NO_TARGETS`: An assignment addressed to everyone cannot list targets.
  - Refuses `ASSIGNMENT_TARGETS_REQUIRED`: A targeted assignment needs at least one target.
  - Refuses `ASSIGNMENT_AUDIENCE_INVALID`: The assignment audience must be EVERYONE or TARGETS.
- `revise(assignment: Assignment, title: String, instructions: String, kind: String, availableAt: Date, dueAt: Date, closeAt: Date, acceptsSubmissions: Bool, audience: String, targets: Sections, at: Date) : return (assignment: Assignment, status: String, audience: String, targets: Sections, acceptsSubmissions: Bool)`
  - Refuses `ASSIGNMENT_NOT_FOUND`: There is no such assignment.
  - Refuses `ASSIGNMENT_NOT_REVISABLE`: An archived assignment can no longer be revised.
  - Refuses `ASSIGNMENT_EVERYONE_NO_TARGETS`: An assignment addressed to everyone cannot list targets.
  - Refuses `ASSIGNMENT_TARGETS_REQUIRED`: A targeted assignment needs at least one target.
  - Refuses `ASSIGNMENT_AUDIENCE_INVALID`: The assignment audience must be EVERYONE or TARGETS.
- `publish(assignment: Assignment, at: Date) : return (assignment: Assignment, audience: String, targets: Sections, acceptsSubmissions: Bool)`
  - Refuses `ASSIGNMENT_NOT_FOUND`: There is no such assignment.
  - Refuses `ASSIGNMENT_NOT_DRAFT`: Only a draft can be published.
- `archive(assignment: Assignment, at: Date) : return (assignment: Assignment)`
  - Refuses `ASSIGNMENT_NOT_FOUND`: There is no such assignment.
- `assign(assignment: Assignment, assignee: Assignee, at: Date) : return (release: Release)`
  - Refuses `ASSIGNMENT_NOT_FOUND`: There is no such assignment.
  - Refuses `ASSIGNMENT_NOT_PUBLISHED`: Only a published assignment can be assigned.
  - Refuses `RELEASE_ALREADY_EXISTS`: This assignee already holds a release of this assignment.
- `setDueOverride(assignment: Assignment, assignee: Assignee, dueAt: Date) : return (release: Release)`
  - Refuses `RELEASE_NOT_FOUND`: This assignee holds no release of this assignment.
- `clearDueOverride(assignment: Assignment, assignee: Assignee) : return (release: Release)`
  - Refuses `RELEASE_NOT_FOUND`: This assignee holds no release of this assignment.

#### Queries

- `_getDetail(assignment: String) : optional (detail: Assignment)`
- `_getAssignments() : many (assignment: String, author: String, title: String, instructions: String, kind: String, availableAt: String, dueAt: String, closeAt: String | Null, acceptsSubmissions: Boolean, audience: Audience, targets: Strings, status: String, createdAt: Date, updatedAt: Date | Null)`
- `_getAssigned(assignee: String) : many (assignment: String, release: String, dueOverride: String | Null, status: ASSIGNED)`
- `_getAssignees(assignment: String) : many (assignee: String)`
- `_isAssigned(assignment: String, assignee: String) : one (assigned: Boolean)`
- `_getPublishedForAudience(audience: String | Null) : many (assignment: String)`
- `_getPublishedInWindow(start: String | Date, end: String | Date) : many (assignment: String)`

#### Instances

- `Assigning` — instance of `Assigning` — [Commons application](../design/application.md), line 28.
  - `Assignee` is `Authenticating.User` — [Commons application](../design/application.md), line 30.
  - `Author` is `Authenticating.User` — [Commons application](../design/application.md), line 29.
  - `Sections` is `Rostering.Section` — [Commons application](../design/application.md), line 31.

### Authenticating

Defined in [Authenticating](../design/concepts/Authenticating.md), line 1.

#### Actions

- `register(username: String, password: String, email: String) : return (user: User)`
  - Refuses `INVALID_BODY`: The email address is not well formed.
  - Refuses `USERNAME_INVALID_LENGTH`: The username must be 3 to 32 characters long.
  - Refuses `USERNAME_INVALID_CHARS`: The username must start with a letter and contain only letters, digits, hyphens, and underscores.
  - Refuses `PASSWORD_INVALID_LENGTH`: The password must be 8 to 128 characters long.
  - Refuses `USERNAME_TAKEN`: That username is already taken.
- `authenticate(username: String, password: String) : return (user: User)`
  - Refuses `INVALID_CREDENTIALS`: Unknown username or wrong password.
- `changePassword(user: User, oldPassword: String, newPassword: String) : return (user: User)`
  - Refuses `INVALID_CREDENTIALS`: The current password is wrong.
  - Refuses `PASSWORD_INVALID_LENGTH`: The password must be 8 to 128 characters long.

#### Queries

- `_getById(user: String) : optional (username: String, email: String)`
- `_getByUsername(username: String) : optional (user: String)`
- `_getUserCount() : one (count: Number)`
- `_search(query: String) : many (user: String, username: String)`
- `_resolveIdentity(ref: String) : one (user: String | Null, username: String | Null)`
- `_denotedUser(ref: String) : one (user: String)`

#### Instances

- `Authenticating` — instance of `Authenticating` — [Commons application](../design/application.md), line 33.

### Banking

Defined in [Banking](../design/concepts/Banking.md), line 1.

#### Actions

- `setTerms(allowance: Number, perItemLimit: Number, unitHours: Number) : return (allowance: Number, perItemLimit: Number, unitHours: Number)`
- `grant(learner: Learner, days: Number, reason: String, at: Date) : return (grant: Grant)`
  - Refuses `LATE_DAYS_MUST_BE_POSITIVE`: A grant must be for a positive number of days.
- `apply(learner: Learner, item: Item, days: Number, at: Date) : return (use: Use)`
  - Refuses `LATE_DAYS_MUST_BE_POSITIVE`: Late days must be a positive number.
  - Refuses `LATE_DAYS_EXCEED_MAX`: That is more late days than any one item may absorb.
  - Refuses `LATE_USE_ALREADY_EXISTS`: Late days already stand applied to this item.
  - Refuses `INSUFFICIENT_BALANCE`: The learner's balance is short of the days requested.
- `change(learner: Learner, item: Item, days: Number) : return (use: Use)`
  - Refuses `LATE_USE_NOT_FOUND`: No late days stand applied to this item.
  - Refuses `LATE_DAYS_NEGATIVE`: Late days cannot be negative.
  - Refuses `LATE_DAYS_EXCEED_MAX`: That is more late days than any one item may absorb.
  - Refuses `INSUFFICIENT_BALANCE`: The learner's balance is short of the increase requested.
- `cancel(learner: Learner, item: Item) : return (use: Use)`
  - Refuses `LATE_USE_NOT_FOUND`: No late days stand applied to this item.

#### Queries

- `_getTerms() : one (allowance: Number, perItemLimit: Number, unitHours: Number)`
- `_getBalance(learner: String) : one (granted: Number, used: Number, remaining: Number)`
- `_getApplied(learner: String, item: String) : optional (use: String, days: Number, appliedAt: Date)`
- `_getUses(learner: String) : many (use: String, item: String, days: Number, status: String, appliedAt: Date)`
- `_getUsesForItem(item: String) : many (learner: String, days: Number)`
- `_getGrants(learner: String) : many (grant: String, days: Number, reason: String, grantedAt: Date)`

#### Instances

- `Banking` — instance of `Banking` — [Commons application](../design/application.md), line 35.
  - `Item` is `Assigning.Assignment` — [Commons application](../design/application.md), line 37.
  - `Learner` is `Authenticating.User` — [Commons application](../design/application.md), line 36.

### Bookmarking

Defined in [Bookmarking](../design/concepts/Bookmarking.md), line 1.

#### Actions

- `save(user: User, item: Item, at: Date) : return (bookmark: Bookmark)`
  - Refuses `BOOKMARK_ALREADY_EXISTS`: This user has already saved this item.
- `unsave(user: User, item: Item) : return (bookmark: Bookmark)`
  - Refuses `BOOKMARK_NOT_FOUND`: There is no such bookmark to remove.
- `clearItem(item: Item) : return (item: Item)`

#### Queries

- `_getSaved(user: String) : many (item: String, savedAt: Date)`
- `_isSaved(user: String, item: String) : one (saved: Boolean)`

#### Instances

- `Bookmarking` — instance of `Bookmarking` — [Commons application](../design/application.md), line 39.
  - `Item` is `Posting.Post` — [Commons application](../design/application.md), line 41.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 40.

### Categorizing

Defined in [Categorizing](../design/concepts/Categorizing.md), line 1.

#### Actions

- `createCategory(name: String, description: String) : return (category: Category)`
  - Refuses `CATEGORY_ALREADY_EXISTS`: A category with this name already exists.
- `assign(item: Item, category: Category) : return (item: Item)`
  - Refuses `CATEGORY_NOT_FOUND`: There is no such category.
- `unassign(item: Item) : return (item: Item)`
  - Refuses `ITEM_NOT_CATEGORIZED`: This item is not in any category.
- `deleteCategory(category: Category) : return (category: Category)`
  - Refuses `CATEGORY_NOT_FOUND`: There is no such category.

#### Queries

- `_getCategory(item: String) : optional (category: String, name: String, description: String)`
- `_getHome(item: String) : optional (home: Category)`
- `_getItems(category: String) : many (item: String)`
- `_getAllCategories() : many (category: String, name: String, description: String)`

#### Instances

- `Categorizing` — instance of `Categorizing` — [Commons application](../design/application.md), line 43.
  - `Item` is `Posting.Post` — [Commons application](../design/application.md), line 44.

### Conversing

Defined in [Conversing](../design/concepts/Conversing.md), line 1.

#### Actions

- `start(item: Item, at: Date) : return (conversation: Conversation, node: Node)`
  - Refuses `ITEM_ALREADY_IN_CONVERSATION`: This item is already in a conversation.
- `reply(item: Item, parent: Node, at: Date) : return (node: Node)`
  - Refuses `PARENT_NODE_NOT_FOUND`: There is no such node to reply to.
  - Refuses `ITEM_ALREADY_IN_CONVERSATION`: This item is already in a conversation.
- `remove(node: Node) : return (node: Node)`
  - Refuses `NODE_NOT_FOUND`: There is no such node.
  - Refuses `NODE_HAS_CHILDREN`: This node has replies beneath it.

#### Queries

- `_getThread(conversation: String) : many (node: String, item: String, parent: String | Null, depth: Number)`
- `_getConversation(node: String) : optional (conversation: String)`
- `_getNodeByItem(item: String) : optional (node: String)`
- `_parentOf(node: String) : optional (parent: String)`
- `_getItem(node: String) : optional (item: String)`
- `_hasChildren(node: String) : one (present: Boolean)`
- `_getConversations() : many (conversation: String, root: String, item: String, createdAt: Date, lastActivityAt: Date)`
- `_getConversationsByLastActivity() : many (conversation: String, root: String, item: String, createdAt: Date, lastActivityAt: Date)`

#### Instances

- `Conversing` — instance of `Conversing` — [Commons application](../design/application.md), line 46.
  - `Item` is `Posting.Post` — [Commons application](../design/application.md), line 47.

### Flagging

Defined in [Flagging](../design/concepts/Flagging.md), line 1.

#### Actions

- `flag(reporter: User, target: Target, reason: String, at: Date) : return (flag: Flag)`
  - Refuses `FLAG_ALREADY_EXISTS`: You already have an open flag on this.
- `resolve(target: Target, outcome: String) : return (target: Target)`
  - Refuses `VALIDATION_FAILED`: An outcome must be upheld or dismissed.
  - Refuses `FLAG_NOT_FOUND`: There are no open flags on this.
- `clearTarget(target: Target) : return (target: Target)`

#### Queries

- `_getOpenTargets() : many (target: String, count: Number)`
- `_getFlags(target: String) : many (flag: String, reporter: String, reason: String, status: String, createdAt: Date)`

#### Instances

- `Flagging` — instance of `Flagging` — [Commons application](../design/application.md), line 49.
  - `Target` is `Posting.Post` — [Commons application](../design/application.md), line 51.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 50.

### Formatting

Defined in [Formatting](../design/concepts/Formatting.md), line 1.

#### Actions

- `setSource(target: Target, source: String) : return (target: Target, rendered: String)`
- `clear(target: Target) : return (target: Target)`

#### Queries

- `_getRendered(target: String) : optional (rendered: String)`

#### Instances

- `Formatting` — instance of `Formatting` — [Commons application](../design/application.md), line 53.
  - `Target` is `Posting.Post` — [Commons application](../design/application.md), line 54.

### Grading

Defined in [Grading](../design/concepts/Grading.md), line 1.

#### Actions

- `record(learner: Learner, item: Item, evidence: Evidence, grader: Grader, score: Number, outOf: Number, feedback: String, at: Date) : return (grade: Grade)`
  - Refuses `SCORE_OUT_OF_RANGE`: The score must be between zero and what the grade is out of.
  - Refuses `GRADE_ALREADY_RELEASED`: This grade has already been released.
  - Refuses `LEARNER_EXCUSED`: This learner has been excused from this item.
- `scoreCriterion(learner: Learner, item: Item, criterion: Criterion, points: Number, outOf: Number, feedback: String) : return (criterionScore: CriterionScore)`
  - Refuses `GRADE_NOT_FOUND`: There is no grade for this learner and item.
  - Refuses `GRADE_ALREADY_RELEASED`: This grade has already been released.
  - Refuses `LEARNER_EXCUSED`: This learner has been excused from this item.
  - Refuses `SCORE_OUT_OF_RANGE`: The points must be between zero and what the criterion is out of.
- `release(learner: Learner, item: Item, at: Date) : return (grade: Grade)`
  - Refuses `GRADE_DRAFT_NOT_FOUND`: There is no draft grade for this learner and item.
- `releaseItem(item: Item, at: Date) : return (released: Grades)`
- `retract(learner: Learner, item: Item, at: Date) : return (grade: Grade)`
  - Refuses `GRADE_RELEASED_NOT_FOUND`: There is no released grade for this learner and item.
- `excuse(learner: Learner, item: Item, grader: Grader, feedback: String, at: Date) : return (grade: Grade)`
  - Refuses `GRADE_NOT_FOUND`: There is no grade for this learner and item.
- `clearCriterionScores(criterion: Criterion) : return (criterion: Criterion)`

#### Queries

- `_getGrade(learner: String, item: String) : optional (grade: String, score: Number, outOf: Number, status: String, feedback: String)`
- `_getGradesForLearner(learner: String) : many (item: String, grade: String, score: Number, outOf: Number, status: String, feedback: String)`
- `_getGradesForItem(item: String) : many (learner: String, grade: String, score: Number, status: String)`
- `_getCriterionScores(learner: String, item: String) : many (criterion: String, points: Number, feedback: String)`

#### Instances

- `Grading` — instance of `Grading` — [Commons application](../design/application.md), line 56.
  - `Criterion` is `Itemizing.Criterion` — [Commons application](../design/application.md), line 60.
  - `Evidence` is `Submitting.Submission` — [Commons application](../design/application.md), line 61.
  - `Grader` is `Authenticating.User` — [Commons application](../design/application.md), line 57.
  - `Item` is `Assigning.Assignment` — [Commons application](../design/application.md), line 59.
  - `Learner` is `Authenticating.User` — [Commons application](../design/application.md), line 58.

### Inviting

Defined in [Inviting](../design/concepts/Inviting.md), line 1.

#### Actions

- `invite(channel: String, address: String, at: Date) : return (invitation: Invitation, channel: String, address: String, credential: String, created: Boolean)`
  - Refuses `INVITATION_ALREADY_CLAIMED`: That invitation has already been used.
- `verify(invitation: Invitation, credential: String, channel: String) : return (invitation: Invitation, address: String)`
  - Refuses `INVITATION_INVALID`: That invitation is not valid.
- `claim(invitation: Invitation, credential: String, user: User) : return (invitation: Invitation, channel: String, address: String)`
  - Refuses `INVITATION_INVALID`: That invitation is not valid.

#### Queries

- `_getAvailable(invitation: String, credential: String) : optional (channel: String, address: String)`
- `_getInvitations() : many (invitation: String, channel: String, address: String, createdAt: Date, lastInvitedAt: Date, inviteCount: Number, user: User | Null)`

#### Instances

- `Inviting` — instance of `Inviting` — [Commons application](../design/application.md), line 63.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 64.

### Itemizing

Defined in [Itemizing](../design/concepts/Itemizing.md), line 1.

#### Actions

- `configureItem(item: Item, label: String, maxPoints: Number) : return (gradeItem: GradeItem)`
  - Refuses `SCORE_OUT_OF_RANGE`: The maximum must be at least zero.
- `ensureItem(item: Item, label: String, maxPoints: Number) : return (gradeItem: GradeItem)`
- `archiveItem(item: Item) : return (gradeItem: GradeItem)`
  - Refuses `GRADE_ITEM_NOT_FOUND`: There is no active grade item for this.
- `addCriterion(item: Item, name: String, maxPoints: Number, position: Number) : return (criterion: Criterion)`
  - Refuses `GRADE_ITEM_NOT_FOUND`: There is no active grade item for this.
- `reviseCriterion(criterion: Criterion, name: String, maxPoints: Number, position: Number) : return (criterion: Criterion)`
  - Refuses `CRITERION_NOT_FOUND`: There is no such criterion.
- `removeCriterion(criterion: Criterion) : return (criterion: Criterion)`
  - Refuses `CRITERION_NOT_FOUND`: There is no such criterion.

#### Queries

- `_getItem(item: String) : optional (item: String, label: String, maxPoints: Number, status: String)`
- `_getItems() : many (item: String, label: String, maxPoints: Number)`
- `_getCriteria(item: String) : many (criterion: String, name: String, maxPoints: Number, position: Number)`
- `_getCriterion(criterion: String) : optional (item: String, name: String, maxPoints: Number)`

#### Instances

- `Itemizing` — instance of `Itemizing` — [Commons application](../design/application.md), line 66.
  - `Item` is `Assigning.Assignment` — [Commons application](../design/application.md), line 67.

### Linking

Defined in [Linking](../design/concepts/Linking.md), line 1.

#### Actions

- `setLinks(source: Source, targets: Targets) : return (source: Source)`
- `setLinksFrom(source: Source, content: String) : return (source: Source)`
- `clearLinks(source: Source) : return (source: Source)`
- `clearBacklinks(target: Target) : return (target: Target)`

#### Queries

- `_getLinks(source: String) : many (target: String)`
- `_getBacklinks(target: String) : many (source: String)`

#### Instances

- `Linking` — instance of `Linking` — [Commons application](../design/application.md), line 69.
  - `Source` is `Posting.Post` — [Commons application](../design/application.md), line 70.
  - `Target` is `Posting.Post` — [Commons application](../design/application.md), line 71.

### Locking

Defined in [Locking](../design/concepts/Locking.md), line 1.

#### Actions

- `lock(target: Target, at: Date) : return (target: Target)`
  - Refuses `TARGET_ALREADY_LOCKED`: This is already locked.
- `unlock(target: Target) : return (target: Target)`
  - Refuses `TARGET_NOT_LOCKED`: This is not locked.

#### Queries

- `_isLocked(target: String) : one (locked: Boolean)`
- `_getLocked() : many (target: String, lockedAt: Date)`

#### Instances

- `Locking` — instance of `Locking` — [Commons application](../design/application.md), line 73.
  - `Target` is `Lockable` — [Commons application](../design/application.md), line 74.

### Mailing

Defined in [Mailing](../design/concepts/Mailing.md), line 1.

#### Actions

- `normalizeRecipient(recipient: String) : return (recipient: String)`
  - Refuses `MAIL_RECIPIENT_INVALID`: The mail recipient is not well formed.
- `enqueue(key: Key, recipient: String, subject: String, text: String, html: String, at: Date) : return (message: Message)`
  - Refuses `MAIL_RECIPIENT_INVALID`: The mail recipient is not well formed.
- `markSent(message: Message, at: Date) : return (message: Message)`
  - Refuses `MAIL_NOT_FOUND`: There is no such mail message.

#### Queries

- `_getPending() : many (message: String, key: Key, recipient: String, subject: String, text: String, html: String, createdAt: Date)`
- `_getStatus(message: String) : optional (sentAt: Date | Null)`

#### Instances

- `Mailing` — instance of `Mailing` — [Commons application](../design/application.md), line 76.
  - `Key` is `MailKey` — [Commons application](../design/application.md), line 77.

### Notifying

Defined in [Notifying](../design/concepts/Notifying.md), line 1.

#### Actions

- `notify(recipient: Person, kind: String, subject: Subject, link: Link, at: Date) : return (notification: Notification)`
- `markRead(notification: Notification, recipient: Person) : return (notification: Notification)`
  - Refuses `NOTIFICATION_NOT_FOUND`: There is no such notification.
- `markAllRead(recipient: Person) : return (recipient: Person)`
- `dismiss(notification: Notification, recipient: Person) : return (notification: Notification)`
  - Refuses `NOTIFICATION_NOT_FOUND`: There is no such notification.
- `clearSubject(subject: Subject) : return (subject: Subject)`

#### Queries

- `_getInbox(recipient: String) : many (notification: String, kind: String, subject: Subject, link: Link | Null, createdAt: Date, read: Boolean)`
- `_hasFor(user: String, subject: Subject) : one (notified: Boolean)`
- `_getUnreadCount(recipient: String) : one (count: Number)`

#### Instances

- `Notifying` — instance of `Notifying` — [Commons application](../design/application.md), line 79.
  - `Link` is `Posting.Post` — [Commons application](../design/application.md), line 82.
  - `Person` is `Authenticating.User` — [Commons application](../design/application.md), line 80.
  - `Subject` is `Posting.Post` — [Commons application](../design/application.md), line 81.

### Noting

Defined in [Noting](../design/concepts/Noting.md), line 1.

#### Actions

- `write(author: Author, learner: Learner, body: String, visibility: String, tags: Strings, followUpAt: Date, at: Date) : return (note: Note)`
  - Refuses `INVALID_VISIBILITY`: Visibility must be staff-only or learner-visible.
- `revise(note: Note, body: String, visibility: String, tags: Strings, followUpAt: Date, at: Date) : return (note: Note)`
  - Refuses `NOTE_NOT_FOUND`: There is no such note.
  - Refuses `NOTE_NOT_OPEN`: This note is no longer open.
  - Refuses `INVALID_VISIBILITY`: Visibility must be staff-only or learner-visible.
- `resolve(note: Note, at: Date) : return (note: Note)`
  - Refuses `NOTE_NOT_FOUND`: There is no such note.
  - Refuses `NOTE_NOT_OPEN`: This note is no longer open.
- `archive(note: Note, at: Date) : return (note: Note)`
  - Refuses `NOTE_NOT_FOUND`: There is no such note.
  - Refuses `NOTE_NOT_RESOLVED`: Only a resolved note can be archived.
- `restore(note: Note, at: Date) : return (note: Note)`
  - Refuses `NOTE_NOT_FOUND`: There is no such note.
  - Refuses `NOTE_NOT_RESTORABLE`: This note cannot be restored.
- `acknowledge(note: Note, learner: Learner, at: Date) : return (note: Note)`
  - Refuses `NOTE_NOT_FOUND`: There is no such note.
  - Refuses `NOTE_NOT_LEARNER_VISIBLE`: This note is not shown to its learner.
  - Refuses `NOTE_NOT_OWNER`: Only the learner a note concerns may acknowledge it.

#### Queries

- `_getNote(note: String) : optional (note: String, author: String, learner: String, body: String, visibility: String, status: String, createdAt: Date, updatedAt: Date | Null, followUpAt: Date | Null, acknowledgedAt: Date | Null, tags: Strings)`
- `_getActiveNotesFor(learner: String) : many (note: String, author: String, learner: String, body: String, visibility: String, status: String, createdAt: Date, updatedAt: Date | Null, followUpAt: Date | Null, acknowledgedAt: Date | Null, tags: Strings)`
- `_getShownTo(learner: String) : many (note: String, author: String, learner: String, body: String, status: String, createdAt: Date, updatedAt: Date | Null, followUpAt: Date | Null, acknowledgedAt: Date | Null, tags: Strings)`
- `_getByAuthor(author: String) : many (note: String, learner: String, status: String, visibility: String, createdAt: Date)`
- `_getOpenFollowUpsBefore(before: Date) : many (note: String, author: String, learner: String, body: String, followUpAt: Date, createdAt: Date)`

#### Instances

- `Noting` — instance of `Noting` — [Commons application](../design/application.md), line 84.
  - `Author` is `Authenticating.User` — [Commons application](../design/application.md), line 85.
  - `Learner` is `Authenticating.User` — [Commons application](../design/application.md), line 86.

### Pinning

Defined in [Pinning](../design/concepts/Pinning.md), line 1.

#### Actions

- `pin(item: Item, scope: Scope, priority: Number, at: Date) : return (pin: Pin)`
  - Refuses `ITEM_ALREADY_PINNED`: This item is already pinned in this scope.
- `unpin(item: Item, scope: Scope) : return (pin: Pin)`
  - Refuses `ITEM_NOT_PINNED`: There is no such pin to remove.
- `setPriority(item: Item, scope: Scope, priority: Number) : return (pin: Pin)`
  - Refuses `ITEM_NOT_PINNED`: There is no such pin to reprioritize.
- `clearItem(item: Item) : return (item: Item)`

#### Queries

- `_getPinned(scope: String) : many (item: String, priority: Number)`
- `_isPinned(item: String, scope: String) : one (pinned: Boolean)`

#### Instances

- `Pinning` — instance of `Pinning` — [Commons application](../design/application.md), line 88.
  - `Item` is `Posting.Post` — [Commons application](../design/application.md), line 89.
  - `Scope` is `Conversing.Conversation` — [Commons application](../design/application.md), line 90.

### Posting

Defined in [Posting](../design/concepts/Posting.md), line 1.

#### Actions

- `create(author: Author, content: String, at: Date) : return (post: Post)`
- `edit(post: Post, content: String, at: Date) : return (post: Post)`
  - Refuses `POST_NOT_FOUND`: There is no such post.
- `delete(post: Post) : return (post: Post)`
  - Refuses `POST_NOT_FOUND`: There is no such post.

#### Queries

- `_getPost(post: String) : optional (author: String, content: String, createdAt: Date, editedAt: Date | Null)`
- `_getByAuthor(author: String) : many (post: String)`
- `_getMentions(post: String) : many (handle: String)`
- `_isMentioned(post: String, handle: String) : one (mentioned: Boolean)`

#### Instances

- `Posting` — instance of `Posting` — [Commons application](../design/application.md), line 92.
  - `Author` is `Authenticating.User` — [Commons application](../design/application.md), line 93.

### Profiling

Defined in [Profiling](../design/concepts/Profiling.md), line 1.

#### Actions

- `createProfile(user: User, displayName: String, email: String) : return (user: User)`
  - Refuses `PROFILE_ALREADY_EXISTS`: This user already has a profile.
- `setDisplayName(user: User, displayName: String) : return (user: User)`
  - Refuses `PROFILE_NOT_FOUND`: There is no profile for this user.
- `setBio(user: User, bio: String) : return (user: User)`
  - Refuses `PROFILE_NOT_FOUND`: There is no profile for this user.
- `setAvatar(user: User, avatar: String) : return (user: User)`
  - Refuses `PROFILE_NOT_FOUND`: There is no profile for this user.

#### Queries

- `_getProfile(user: String) : optional (profile: Profile)`
- `_getProfileFields(user: String) : optional (displayName: String, bio: String, avatar: String, email: String)`

#### Instances

- `Profiling` — instance of `Profiling` — [Commons application](../design/application.md), line 95.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 96.

### Reacting

Defined in [Reacting](../design/concepts/Reacting.md), line 1.

#### Actions

- `react(reactor: Person, target: Target, kind: String, at: Date) : return (reaction: Reaction)`
  - Refuses `REACTION_ALREADY_EXISTS`: This person has already reacted to the target with this kind.
- `unreact(reactor: Person, target: Target, kind: String) : return (reaction: Reaction)`
  - Refuses `REACTION_NOT_FOUND`: There is no such reaction to take back.
- `clearTarget(target: Target) : return (target: Target)`

#### Queries

- `_getReactionsForTarget(target: String) : many (reaction: String, reactor: String, kind: String)`
- `_getReactionsByUser(reactor: String) : many (reaction: String, target: String, kind: String)`
- `_countByKind(target: String) : many (kind: String, count: Number)`
- `_hasReacted(reactor: String, target: String, kind: String) : one (hasReacted: Boolean)`

#### Instances

- `Reacting` — instance of `Reacting` — [Commons application](../design/application.md), line 98.
  - `Person` is `Authenticating.User` — [Commons application](../design/application.md), line 99.
  - `Target` is `Posting.Post` — [Commons application](../design/application.md), line 100.

### Resolving

Defined in [Resolving](../design/concepts/Resolving.md), line 1.

#### Actions

- `accept(question: Question, answer: Answer, by: User, at: Date) : return (resolution: Resolution)`
- `clear(question: Question) : return (question: Question)`
  - Refuses `RESOLUTION_NOT_FOUND`: This question has no accepted answer.

#### Queries

- `_isResolved(question: String) : one (resolved: Boolean)`
- `_getResolution(question: String) : optional (answer: String, resolvedBy: String, resolvedAt: Date)`
- `_getQuestionsAnswered(answer: String) : many (question: String)`

#### Instances

- `Resolving` — instance of `Resolving` — [Commons application](../design/application.md), line 102.
  - `Answer` is `Posting.Post` — [Commons application](../design/application.md), line 105.
  - `Question` is `Posting.Post` — [Commons application](../design/application.md), line 104.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 103.

### Revising

Defined in [Revising](../design/concepts/Revising.md), line 1.

#### Actions

- `record(item: Item, content: String, at: Date) : return (revision: Revision, number: Number)`
- `clearItem(item: Item) : return (item: Item)`

#### Queries

- `_getRevisions(item: String) : many (revision: String, number: Number, content: String, savedAt: Date)`
- `_getRevision(item: String, number: Number) : optional (revision: String, number: Number, content: String, savedAt: Date)`
- `_getLatest(item: String) : optional (revision: String, number: Number, content: String, savedAt: Date)`

#### Instances

- `Revising` — instance of `Revising` — [Commons application](../design/application.md), line 107.
  - `Item` is `Posting.Post` — [Commons application](../design/application.md), line 108.

### Roling

Defined in [Roling](../design/concepts/Roling.md), line 1.

#### Actions

- `defineRole(name: String, capabilities: Strings) : return (role: Role)`
  - Refuses `ROLE_ALREADY_EXISTS`: A role with this name already exists.
- `ensureRole(name: String, capabilities: Strings) : return (role: Role)`
- `grant(user: User, context: Context, role: Role) : return (grant: Grant)`
  - Refuses `ROLE_NOT_FOUND`: No such role exists.
  - Refuses `GRANT_ALREADY_EXISTS`: The user already holds this role in this context.
- `revoke(user: User, context: Context, role: Role) : return (grant: Grant)`
  - Refuses `GRANT_NOT_FOUND`: The user does not hold this role in this context.
- `requireCapability(user: User, context: Context, capability: String) : return (allowed: Boolean)`
  - Refuses `FORBIDDEN`: The user does not hold the required capability in this context.

#### Queries

- `_hasCapability(user: String, context: String, capability: String) : one (allowed: Boolean)`
- `_hasCapabilityHolder(context: String, capability: String) : one (present: Boolean)`
- `_holdsRoleNamed(user: String, context: String, name: String) : one (held: Boolean)`
- `_getRoles(user: String, context: String) : many (role: String)`
- `_getRoleByName(name: String) : optional (role: String)`
- `_getRoleDetail(role: String) : optional (name: String, capabilities: Strings)`
- `_listRoles() : many (role: String, name: String, capabilities: Strings)`
- `_denotedRole(ref: String) : one (role: String)`

#### Instances

- `Roling` — instance of `Roling` — [Commons application](../design/application.md), line 110.
  - `Context` is `Conversing.Conversation` — [Commons application](../design/application.md), line 112.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 111.

### Rostering

Defined in [Rostering](../design/concepts/Rostering.md), line 1.

#### Actions

- `configureClass(code: String, title: String, term: String, timezone: String) : return (class: Class)`
  - Refuses `CLASS_ALREADY_CONFIGURED`: The class has already been configured.
- `createSection(name: String, location: String, meetingPattern: String) : return (section: Section)`
- `updateSection(section: Section, name: String, location: String, meetingPattern: String) : return (section: Section)`
  - Refuses `SECTION_NOT_FOUND`: No such section exists.
- `previewImport(csv: String) : return (rows: Rows)`
- `importSeats(rows: Rows) : return (created: Seats, skipped: Strings)`
- `claimSeat(seat: Seat, user: User) : return (seat: Seat, kind: String, user: User, section: Section)`
  - Refuses `SEAT_NOT_FOUND`: No such seat exists.
  - Refuses `SEAT_NOT_PENDING`: This seat is not open to claim.
  - Refuses `SEAT_ALREADY_ACTIVE`: This user already holds an active seat.
- `dropSeat(seat: Seat) : return (seat: Seat, kind: String, user: User)`
  - Refuses `SEAT_NOT_FOUND`: No such seat exists.
  - Refuses `SEAT_NOT_ACTIVE`: This seat is not active.
- `reinstateSeat(seat: Seat) : return (seat: Seat, kind: String, user: User, section: Section)`
  - Refuses `SEAT_NOT_FOUND`: No such seat exists.
  - Refuses `SEAT_NOT_DROPPED`: This seat is not dropped.
  - Refuses `SEAT_ALREADY_ACTIVE`: This user already holds an active seat.
- `moveSection(seat: Seat, section: Section) : return (seat: Seat)`
  - Refuses `SEAT_NOT_FOUND`: No such seat exists.

#### Queries

- `_getClass() : optional (detail: Class)`
- `_getSections() : many (section: String, name: String, location: String, meetingPattern: String, status: String)`
- `_getSeatByExternalKey(externalKey: String) : optional (seat: String, email: String)`
- `_getSeatByUser(user: String) : optional (seat: String, user: String | Null, externalKey: String, email: String, rosterName: String, kind: String, section: String | Null, status: String)`
- `_getSeatDetail(user: String) : optional (detail: Seat)`
- `_getActiveMembers() : many (user: String | Null, seat: String, kind: String, section: String | Null, rosterName: String, email: String)`
- `_isActiveStudent(user: String) : one (active: Boolean)`
- `_getActiveStudents() : many (user: String, seat: String, section: String | Null, rosterName: String, email: String)`
- `_getUnclaimedSeats() : many (seat: String, externalKey: String, email: String, rosterName: String, kind: String, section: String | Null)`
- `_getDroppedSeats() : many (user: String | Null, seat: String, kind: String, section: String | Null, rosterName: String, email: String)`

#### Instances

- `Rostering` — instance of `Rostering` — [Commons application](../design/application.md), line 114.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 115.

### Sessioning

Defined in [Sessioning](../design/concepts/Sessioning.md), line 1.

#### Actions

- `start(user: User, at?: Moment) : return (session: Session, expiresAt: Moment)`
- `end(session: Session) : return (session: Session)`
  - Refuses `SESSION_NOT_FOUND`: There is no such session.
- `endAllForUser(user: User) : return (user: User)`

#### Queries

- `_getUser(session: String, at?: Date) : optional (user: String)`
- `_isExpired(session: String, at: Date) : one (expired: Boolean)`

#### Instances

- `Sessioning` — instance of `Sessioning` — [Commons application](../design/application.md), line 117.
  - `Moment` is `Timing.Moment` — [Commons application](../design/application.md), line 119.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 118.

### Submitting

Defined in [Submitting](../design/concepts/Submitting.md), line 1.

#### Actions

- `submit(assignment: Assignment, submitter: Submitter, artifact: Artifact, at: Date) : return (submission: Submission)`
- `withdraw(submission: Submission) : return (submission: Submission)`
  - Refuses `SUBMISSION_NOT_FOUND`: There is no such submission.
  - Refuses `SUBMISSION_NOT_SUBMITTED`: Only a submitted attempt can be withdrawn.
- `restore(submission: Submission) : return (submission: Submission)`
  - Refuses `SUBMISSION_NOT_FOUND`: There is no such submission.
  - Refuses `SUBMISSION_NOT_WITHDRAWN`: Only a withdrawn attempt can be restored.

#### Queries

- `_getLatest(assignment: String, submitter: String) : optional (latest: Submission)`
- `_getAttempts(assignment: String, submitter: String) : many (submission: String, artifacts: Strings, submittedAt: Date, number: Number, status: String)`
- `_getSubmissionsForAssignment(assignment: String) : many (submitter: String, submission: String, submittedAt: Date, number: Number, status: String)`
- `_getSubmissionsForSubmitter(submitter: String) : many (assignment: String, submission: String, submittedAt: Date, number: Number, status: String)`

#### Instances

- `Submitting` — instance of `Submitting` — [Commons application](../design/application.md), line 121.
  - `Artifact` is `Posting.Post` — [Commons application](../design/application.md), line 124.
  - `Assignment` is `Assigning.Assignment` — [Commons application](../design/application.md), line 123.
  - `Submitter` is `Authenticating.User` — [Commons application](../design/application.md), line 122.

### Subscribing

Defined in [Subscribing](../design/concepts/Subscribing.md), line 1.

#### Actions

- `subscribe(user: Person, target: Target, at: Date) : return (subscription: Subscription)`
  - Refuses `ALREADY_SUBSCRIBED`: This person already follows the target.
- `unsubscribe(user: Person, target: Target) : return (subscription: Subscription)`
  - Refuses `NOT_SUBSCRIBED`: There is no such subscription to drop.
- `clearTarget(target: Target) : return (target: Target)`

#### Queries

- `_getSubscribers(target: String) : many (user: String)`
- `_getSubscriptions(user: String) : many (target: String, subscribedAt: Date)`
- `_isSubscribed(user: String, target: String) : one (subscribed: Boolean)`

#### Instances

- `Subscribing` — instance of `Subscribing` — [Commons application](../design/application.md), line 126.
  - `Person` is `Authenticating.User` — [Commons application](../design/application.md), line 127.
  - `Target` is `Conversing.Conversation` — [Commons application](../design/application.md), line 128.

### Tagging

Defined in [Tagging](../design/concepts/Tagging.md), line 1.

#### Actions

- `createTag(name: String) : return (tag: Tag)`
  - Refuses `TAG_ALREADY_EXISTS`: A tag with this name already exists.
- `addTag(target: Target, tag: Tag) : return (target: Target)`
  - Refuses `TAG_NOT_FOUND`: There is no such tag.
  - Refuses `TAG_ALREADY_APPLIED`: This tag is already applied to the target.
- `removeTag(target: Target, tag: Tag) : return (target: Target)`
  - Refuses `TAG_NOT_APPLIED`: This tag is not applied to the target.
- `deleteTag(tag: Tag) : return (tag: Tag)`
  - Refuses `TAG_NOT_FOUND`: There is no such tag.
- `clearTarget(target: Target) : return (target: Target)`

#### Queries

- `_getTags(target: String) : many (tag: String, name: String)`
- `_getTargets(tag: String) : many (target: String)`
- `_getByName(name: String) : optional (tag: String)`
- `_getAllTags() : many (tag: String, name: String)`

#### Instances

- `Tagging` — instance of `Tagging` — [Commons application](../design/application.md), line 130.
  - `Target` is `Posting.Post` — [Commons application](../design/application.md), line 131.

### Timing

Defined in [Timing](../design/concepts/Timing.md), line 1.

#### Actions

- `capture() : return (at: Date)`

#### Queries

- `_now() : one (at: Date)`

#### Instances

- `Timing` — instance of `Timing` — [Commons application](../design/application.md), line 133.

### Tracking

Defined in [Tracking](../design/concepts/Tracking.md), line 1.

#### Actions

- `register(item: Item, scope: Scope) : return (item: Item)`
  - Refuses `ITEM_ALREADY_REGISTERED`: This item is already being tracked.
- `unregister(item: Item) : return (item: Item)`
- `markSeen(user: User, item: Item) : return (item: Item)`
  - Refuses `ITEM_NOT_REGISTERED`: This item is not being tracked.
  - Refuses `ITEM_ALREADY_SEEN`: This user has already seen this item.
- `markAllSeen(user: User, scope: Scope) : return (user: User)`

#### Queries

- `_inScope(scope: String) : many (item: String)`
- `_getUnread(user: String, scope: String) : many (item: String)`
- `_getUnreadCount(user: String, scope: String) : one (count: Number)`

#### Instances

- `Tracking` — instance of `Tracking` — [Commons application](../design/application.md), line 135.
  - `Item` is `Posting.Post` — [Commons application](../design/application.md), line 137.
  - `Scope` is `Conversing.Conversation` — [Commons application](../design/application.md), line 138.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 136.

### Trashing

Defined in [Trashing](../design/concepts/Trashing.md), line 1.

#### Actions

- `trash(item: Item, by: User, at: Date) : return (item: Item)`
  - Refuses `ITEM_ALREADY_TRASHED`: This item is already in the trash.
- `restore(item: Item) : return (item: Item)`
  - Refuses `ITEM_NOT_TRASHED`: This item is not in the trash.
- `purge(item: Item) : return (item: Item)`
  - Refuses `ITEM_NOT_TRASHED`: This item is not in the trash.

#### Queries

- `_isTrashed(item: String) : one (trashed: Boolean)`
- `_getTrashed() : many (item: String, trashedBy: String, trashedAt: Date)`

#### Instances

- `Trashing` — instance of `Trashing` — [Commons application](../design/application.md), line 140.
  - `Item` is `Posting.Post` — [Commons application](../design/application.md), line 142.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 141.

## Application types

Concrete types:

- `Lockable` — [Commons application](../design/application.md), line 18.
- `MailKey` — [Commons application](../design/application.md), line 15.

## Computations

- `invitationMailHtml(invitation: String, credential: String) : String` — [Commons application](../design/application.md), line 175.
- `invitationMailText(invitation: String, credential: String) : String` — [Commons application](../design/application.md), line 172.
- `notificationMailHtml(notification: String) : String` — [Commons application](../design/application.md), line 181.
- `notificationMailText(notification: String) : String` — [Commons application](../design/application.md), line 178.
- `setupSecretMatches(secret: String) : Bool` — [Commons application](../design/application.md), line 184.

## Views

_Views name reusable conditions. Multiple `where` blocks are alternatives._

### (item) is intact

Authored path: `Forum.threads.intact`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 28.

```view
(item) is intact — inputs (item); outputs (); bindings ()
  where Trashing._isTrashed (item) has (trashed: false)
```

### (conversation) is readable

Authored path: `Forum.threads.readableConversation`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 7.

```view
(conversation) is readable — inputs (conversation); outputs (); bindings (node, item)
  where
    Conversing._getThread (conversation) has (item, node)
    no Conversing._parentOf (node)
    Posting._getPost (post: item)
    view "(item) is intact" with (item)
```

### (post) is not readable

Authored path: `Forum.posts.notReadable`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 18.

```view
(post) is not readable — inputs (post); outputs (); bindings ()
  where Trashing._isTrashed (item: post) has (trashed: true)
  where no Posting._getPost (post)
```

### (post) is readable

Authored path: `Forum.posts.readable`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 17.

```view
(post) is readable — inputs (post); outputs (); bindings ()
  where
    Posting._getPost (post)
    Trashing._isTrashed (item: post) has (trashed: false)
```

### (target) is public

Authored path: `Forum.threads.publicTarget`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 26.

```view
(target) is public — inputs (target); outputs (); bindings ()
  where
    Posting._getPost (post: target)
    view "(item) is intact" with (item: target)
  where view "(conversation) is readable" with (conversation: target)
```

### (user) authored (post)

```view
(user) authored (post) — inputs (user, post); outputs (); bindings ()
  where Posting._getPost (post) has (author: user)
```

### (user) did not author (post)

```view
(user) did not author (post) — inputs (user, post); outputs (); bindings ()
  where Posting._getPost (post) and not (author: user)
```

### (user) is an active course member

```view
(user) is an active course member — inputs (user); outputs (); bindings ()
  where Rostering._getSeatByUser (user) has (status: "ACTIVE")
```

### (user) is an active student

```view
(user) is an active student — inputs (user); outputs (); bindings ()
  where Rostering._isActiveStudent (user) has (active: true)
```

### (user) is not an active student

```view
(user) is not an active student — inputs (user); outputs (); bindings ()
  where Rostering._isActiveStudent (user) has (active: false)
```

### (user) is not mentioned in (post)

Authored path: `Forum.notifications.isNotMentionedIn`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 15.

```view
(user) is not mentioned in (post) — inputs (user, post); outputs (); bindings (username)
  where
    Authenticating._getById (user) has (username)
    Posting._isMentioned (handle: username, post) has (mentioned: false)
```

### (user) is not yet notified about (subject)

Authored path: `Forum.notifications.isNotYetNotifiedAbout`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 17.

```view
(user) is not yet notified about (subject) — inputs (user, subject); outputs (); bindings ()
  where Notifying._hasFor (subject, user) has (notified: false)
```

### (user) may administer

```view
(user) may administer — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "administer", context: "forum", user) has (allowed: true)
  where Roling._hasCapabilityHolder (capability: "administer", context: "forum") has (present: false)
```

### (user) may edit (post)

```view
(user) may edit (post) — inputs (user, post); outputs (); bindings (node, conversation)
  where
    Posting._getPost (post) has (author: user)
    Trashing._isTrashed (item: post) has (trashed: false)
    Conversing._getNodeByItem (item: post) has (node)
    Conversing._getConversation (node) has (conversation)
    Locking._isLocked (target: conversation) has (locked: false)
```

### (user) may manage assignments

```view
(user) may manage assignments — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "assignments:manage", context: "forum", user) has (allowed: true)
```

### (user) may manage grades

```view
(user) may manage grades — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "grades:manage", context: "forum", user) has (allowed: true)
```

### (user) may manage late days

```view
(user) may manage late days — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "late-days:manage", context: "forum", user) has (allowed: true)
```

### (user) may manage student notes

```view
(user) may manage student notes — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "student-notes:manage", context: "forum", user) has (allowed: true)
```

### (user) may manage the roster

```view
(user) may manage the roster — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "roster:manage", context: "forum", user) has (allowed: true)
```

### (user) may moderate

```view
(user) may moderate — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "moderate", context: "forum", user) has (allowed: true)
  where Roling._hasCapabilityHolder (capability: "administer", context: "forum") has (present: false)
```

### (user) may not administer

```view
(user) may not administer — inputs (user); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "administer", context: "forum", user) has (allowed: false)
    Roling._hasCapabilityHolder (capability: "administer", context: "forum") has (present: true)
```

### (user) may not edit (post)

```view
(user) may not edit (post) — inputs (user, post); outputs (); bindings (node, conversation)
  where
    Posting._getPost (post) and not (author: user)
    Trashing._isTrashed (item: post) has (trashed: false)
  where
    Posting._getPost (post) has (author: user)
    Trashing._isTrashed (item: post) has (trashed: false)
    Conversing._getNodeByItem (item: post) has (node)
    Conversing._getConversation (node) has (conversation)
    Locking._isLocked (target: conversation) has (locked: true)
```

### (user) may not manage assignments

```view
(user) may not manage assignments — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "assignments:manage", context: "forum", user) has (allowed: false)
```

### (user) may not manage grades

```view
(user) may not manage grades — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "grades:manage", context: "forum", user) has (allowed: false)
```

### (user) may not manage late days

```view
(user) may not manage late days — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "late-days:manage", context: "forum", user) has (allowed: false)
```

### (user) may not manage student notes

```view
(user) may not manage student notes — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "student-notes:manage", context: "forum", user) has (allowed: false)
```

### (user) may not manage the roster

```view
(user) may not manage the roster — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "roster:manage", context: "forum", user) has (allowed: false)
```

### (user) may not moderate

```view
(user) may not moderate — inputs (user); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "moderate", context: "forum", user) has (allowed: false)
    Roling._hasCapabilityHolder (capability: "administer", context: "forum") has (present: true)
```

### (user) may not pin in (scope)

```view
(user) may not pin in (scope) — inputs (user, scope); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "pin", context: scope, user) has (allowed: false)
    Roling._hasCapability (capability: "pin", context: "forum", user) has (allowed: false)
```

### (user) may not view all grades

```view
(user) may not view all grades — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "grades:view-all", context: "forum", user) has (allowed: false)
```

### (user) may not view all submissions

```view
(user) may not view all submissions — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "submissions:view-all", context: "forum", user) has (allowed: false)
```

### (user) may not view the staff calendar

```view
(user) may not view the staff calendar — inputs (user); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "calendar:view-staff", context: "forum", user) has (allowed: false)
    Roling._hasCapability (capability: "roster:manage", context: "forum", user) has (allowed: false)
```

### (user) may pin in (scope)

```view
(user) may pin in (scope) — inputs (user, scope); outputs (); bindings ()
  where Roling._hasCapability (capability: "pin", context: scope, user) has (allowed: true)
  where Roling._hasCapability (capability: "pin", context: "forum", user) has (allowed: true)
```

### (user) may view all grades

```view
(user) may view all grades — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "grades:view-all", context: "forum", user) has (allowed: true)
```

### (user) may view all submissions

```view
(user) may view all submissions — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "submissions:view-all", context: "forum", user) has (allowed: true)
```

### (user) may view the staff calendar

```view
(user) may view the staff calendar — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "calendar:view-staff", context: "forum", user) has (allowed: true)
  where Roling._hasCapability (capability: "roster:manage", context: "forum", user) has (allowed: true)
```

### the active user of (session)

Authored path: `Access.session.activeUser`.
- Covered by [Session boundary](../design/compositions/access/session.md), line 13.

```view
the active user of (session) — inputs (session); outputs (user); bindings (at) — answers at most one (user)
  where
    Timing._now () has (at)
    Sessioning._getUser (at, session) has (user)
```

### the assignment (assignment)

Authored path: `Course.assignments.theAssignment`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 36.

```view
the assignment (assignment) — inputs (assignment); outputs (detail); bindings () — answers at most one (detail)
  where Assigning._getDetail (assignment) has (detail)
```

### the class configuration ()

Authored path: `Course.roster.theClassConfiguration`.
- Covered by [Roster](../design/compositions/course/roster.md), line 5.

```view
the class configuration () — inputs (); outputs (detail); bindings () — answers at most one (detail)
  where Rostering._getClass () has (detail)
```

### the conversation placing (item)

Authored path: `Forum.threads.placementOf`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 6.

```view
the conversation placing (item) — inputs (item); outputs (conversation); bindings (node) — answers at most one (conversation)
  where
    Conversing._getNodeByItem (item) has (node)
    Posting._getPost (post: item)
    view "(item) is intact" with (item)
    Conversing._getConversation (node) has (conversation)
```

### the latest submission for (assignment) by (submitter)

Authored path: `Course.submissions.theLatestSubmission`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 3.

```view
the latest submission for (assignment) by (submitter) — inputs (assignment, submitter); outputs (latest); bindings () — answers at most one (latest)
  where Submitting._getLatest (assignment, submitter) has (latest)
```

### the other users mentioned in (post)

Authored path: `Forum.notifications.otherUsersMentionedIn`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 11.

```view
the other users mentioned in (post) — inputs (post); outputs (user); bindings (handle) — answers any number of (user)
  where
    Posting._getMentions (post) has (handle)
    Authenticating._getByUsername (username: handle) has (user)
    Posting._getPost (post) and not (author: user)
```

### the profile of (user)

Authored path: `Forum.profiles.theProfileOf`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 4.

```view
the profile of (user) — inputs (user); outputs (profile); bindings () — answers at most one (profile)
  where Profiling._getProfile (user) has (profile)
```

### the public posts by (author)

Authored path: `Forum.posts.publicPostsBy`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 21.

```view
the public posts by (author) — inputs (author); outputs (post); bindings () — answers any number of (post)
  where
    Posting._getByAuthor (author) has (post)
    view "(item) is intact" with (item: post)
```

### the public posts in (conversation)

```view
the public posts in (conversation) — inputs (conversation); outputs (node, item, author, createdAt); bindings () — answers any number of (node, item, author, createdAt)
  where
    Conversing._getThread (conversation) has (item, node)
    view "(item) is intact" with (item)
    Posting._getPost (post: item) has (author, createdAt)
```

### the readable bookmarks of (user)

Authored path: `Forum.bookmarks.readableBookmarksOf`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 9.

```view
the readable bookmarks of (user) — inputs (user); outputs (item, savedAt); bindings () — answers any number of (item, savedAt)
  where
    Bookmarking._getSaved (user) has (item, savedAt)
    view "(post) is readable" with (post: item)
```

### the seat detail of (user)

Authored path: `Course.notes.theSeatDetailOf`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 12.

```view
the seat detail of (user) — inputs (user); outputs (detail); bindings () — answers at most one (detail)
  where Rostering._getSeatDetail (user) has (detail)
```

### the seat matching (user) and (externalKey)

Authored path: `Course.roster.identityMatchedSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 19.

```view
the seat matching (user) and (externalKey) — inputs (user, externalKey); outputs (seat); bindings (email) — answers at most one (seat)
  where
    Profiling._getProfileFields (user) has (email)
    Rostering._getSeatByExternalKey (externalKey) has (email, seat)
```

### the seat of (user)

Authored path: `Course.roster.theSeatOf`.
- Covered by [Roster](../design/compositions/course/roster.md), line 27.

```view
the seat of (user) — inputs (user); outputs (seat); bindings () — answers at most one (seat)
  where Rostering._getSeatByUser (user) has (seat)
```

### the user named (username)

Authored path: `Access.auth.theUserNamed`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 17.

```view
the user named (username) — inputs (username); outputs (user); bindings () — answers at most one (user)
  where Authenticating._getByUsername (username) has (user)
```

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### the assigned population for (assignment)

Authored path: `Course.submissions.theAssignedPopulationForAssignment`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 15.

```former
Former "the assigned population for (assignment)" — inputs (assignment); bindings (assignee, rosterName, release, dueOverride, releaseStatus); promises exactly one record — forms:
  each Assigning._getAssignees (assignment) has (assignee)
    where Rostering._getSeatByUser (user: assignee) has (rosterName)
    where Assigning._getAssigned (assignee) has (assignment, dueOverride, release, status: releaseStatus)
    form a record of
      assignee
      dueOverride
      release
      rosterName
      status: releaseStatus
```

### the assignments of (student)

Authored path: `Course.assignments.theAssignmentsOf`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 34.

```former
Former "the assignments of (student)" — inputs (student); bindings (assignment, release, dueOverride, releaseStatus); promises exactly one record — forms:
  each Assigning._getAssigned (assignee: student) has (assignment, dueOverride, release, status: releaseStatus)
    where Assigning._getAssignments () has (assignment, status: "PUBLISHED")
    form a record of
      assignment
      dueOverride
      release
      status: releaseStatus
```

### the attempts for (assignment) by (submitter)

Authored path: `Course.submissions.theAttempts`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 7.

```former
Former "the attempts for (assignment) by (submitter)" — inputs (assignment, submitter); bindings (submission, artifacts, submittedAt, number, status); promises exactly one record — forms:
  each Submitting._getAttempts (assignment, submitter) has (artifacts, number, status, submission, submittedAt)
    form a record of
      artifacts
      number
      status
      submission
      submittedAt
```

### the backlinks of (target)

Authored path: `Forum.links.theBacklinksOf`.
- Covered by [Post links](../design/compositions/forum/links.md), line 10.

```former
Former "the backlinks of (target)" — inputs (target); bindings (source); promises exactly one record — forms:
  each Linking._getBacklinks (target) has (source)
    where view "(post) is readable" with (post: source)
    form a record of
      source
```

### the post summary of (item)

```former
Former "the post summary of (item)" — inputs (item); bindings (author, content, createdAt, editedAt); promises at most one record — forms:
  a record of
    where Posting._getPost (post: item) has (author, content, createdAt, editedAt)
    author
    content
    createdAt
    editedAt
```

### the bookmarked posts of (user)

Authored path: `Forum.bookmarks.theBookmarkedPostsOf`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 13.

```former
Former "the bookmarked posts of (user)" — inputs (user); bindings (item, savedAt); promises exactly one record — forms:
  each view "the readable bookmarks of (user)" with (user) has (item, savedAt)
    form a record of
      item
      post: former "the post summary of (item)" with (item)
      savedAt
```

### the bookmarks of (user)

Authored path: `Forum.bookmarks.theBookmarksOf`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 11.

```former
Former "the bookmarks of (user)" — inputs (user); bindings (item, savedAt); promises exactly one record — forms:
  each view "the readable bookmarks of (user)" with (user) has (item, savedAt)
    form a record of
      item
      savedAt
```

### the calendar between (start) and (end)

Authored path: `Course.calendar.theCalendarBetween`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 3.

```former
Former "the calendar between (start) and (end)" — inputs (start, end); bindings (assignment, title, kind, availableAt, dueAt, closeAt, status); promises exactly one record — forms:
  each Assigning._getPublishedInWindow (end, start) has (assignment)
    where Assigning._getAssignments () has (assignment, availableAt, closeAt, dueAt, kind, status, title)
    form a record of
      assignment
      availableAt
      closeAt
      dueAt
      kind
      status
      title
```

### the categories ()

Authored path: `Forum.categories.theCategories`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 12.

```former
Former "the categories ()" — inputs (); bindings (category, name, description); promises exactly one record — forms:
  each Categorizing._getAllCategories () has (category, description, name)
    form a record of
      category
      description
      name
```

### the category of (item)

Authored path: `Forum.categories.theCategoryOf`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 16.

```former
Former "the category of (item)" — inputs (item); bindings (category, name, description); promises exactly one record — forms:
  each Categorizing._getCategory (item) has (category, description, name)
    form a record of
      category
      description
      name
```

### the criteria of (item)

Authored path: `Course.grades.theCriteriaOf`.
- Covered by [Grades](../design/compositions/course/grades.md), line 6.

```former
Former "the criteria of (item)" — inputs (item); bindings (criterion, name, maxPoints, position); promises exactly one record — forms:
  each Itemizing._getCriteria (item) has (criterion, maxPoints, name, position)
    form a record of
      criterion
      maxPoints
      name
      position
```

### the criterion scores of (learner) on (item)

Authored path: `Course.grades.theCriterionScoresOf`.
- Covered by [Grades](../design/compositions/course/grades.md), line 18.

```former
Former "the criterion scores of (learner) on (item)" — inputs (learner, item); bindings (criterion, points, maxPoints, feedback); promises exactly one record — forms:
  each Grading._getCriterionScores (item, learner) has (criterion, feedback, points)
    where Itemizing._getCriterion (criterion) has (maxPoints)
    form a record of
      criterion
      feedback
      maxPoints
      points
```

### the dashboard seat of (user)

Authored path: `Course.calendar.theDashboardSeatOf`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 11.

```former
Former "the dashboard seat of (user)" — inputs (user); bindings (seat, holder, externalKey, email, rosterName, kind, section, status); promises exactly one record — forms:
  each Rostering._getSeatByUser (user) has (email, externalKey, kind, rosterName, seat, section, status, user: holder)
    form a record of
      email
      externalKey
      kind
      rosterName
      seat
      section
      status
      user: holder
```

### the defined roles ()

Authored path: `Access.roles.theDefinedRoles`.
- Covered by [Roles](../design/compositions/access/roles.md), line 25.

```former
Former "the defined roles ()" — inputs (); bindings (role, name, capabilities); promises exactly one record — forms:
  each Roling._listRoles () has (capabilities, name, role)
    form a record of
      capabilities
      name
      role
```

### the dropped roster ()

Authored path: `Course.roster.theDroppedRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 34.

```former
Former "the dropped roster ()" — inputs (); bindings (user, seat, kind, section, rosterName, email); promises exactly one record — forms:
  each Rostering._getDroppedSeats () has (email, kind, rosterName, seat, section, user)
    form a record of
      email
      kind
      rosterName
      seat
      section
      user
```

### the flags on (target)

Authored path: `Forum.moderation.theFlagsOn`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 35.

```former
Former "the flags on (target)" — inputs (target); bindings (flag, reporter, reason, status, createdAt); promises exactly one record — forms:
  each Flagging._getFlags (target) has (createdAt, flag, reason, reporter, status)
    form a record of
      createdAt
      flag
      reason
      reporter
      status
```

### the forward links of (source)

Authored path: `Forum.links.theForwardLinksOf`.
- Covered by [Post links](../design/compositions/forum/links.md), line 8.

```former
Former "the forward links of (source)" — inputs (source); bindings (target); promises exactly one record — forms:
  each Linking._getLinks (source) has (target)
    where view "(post) is readable" with (post: target)
    form a record of
      target
```

### the gradebook ()

Authored path: `Course.grades.theGradebook`.
- Covered by [Grades](../design/compositions/course/grades.md), line 43.

```former
Former "the gradebook ()" — inputs (); bindings (item, label, maxPoints, user, section, rosterName, email, cellItem, grade, score, status); promises exactly one record — forms:
  a record of
    items: each Itemizing._getItems () has (item, label, maxPoints)
      form a record of
        item
        label
        maxPoints
    learners: each Rostering._getActiveStudents () has (email, rosterName, section, user)
      arranged by rosterName
      form a record of
        cells: each Itemizing._getItems () has (item: cellItem)
          where whether Grading._getGrade (item: cellItem, learner: user) has (grade, score, status)
          form a record of
            grade
            item: cellItem
            score
            status
        email
        learner: user
        rosterName
        section
```

### the gradebook learners ()

Authored path: `Course.grades.theGradebookLearners`.
- Covered by [Grades](../design/compositions/course/grades.md), line 45.

```former
Former "the gradebook learners ()" — inputs (); bindings (user, seat, section, rosterName, email); promises exactly one record — forms:
  each Rostering._getActiveStudents () has (email, rosterName, seat, section, user)
    form a record of
      email
      rosterName
      seat
      section
      user
```

### the grades of (learner)

Authored path: `Course.grades.theGradesOf`.
- Covered by [Grades](../design/compositions/course/grades.md), line 39.

```former
Former "the grades of (learner)" — inputs (learner); bindings (item, grade, score, outOf, status, feedback, label); promises exactly one record — forms:
  each Grading._getGradesForLearner (learner) has (feedback, grade, item, outOf, score, status)
    where whether Itemizing._getItem (item) has (label)
    form a record of
      feedback
      grade
      item
      label
      maxPoints: outOf
      score
      status
```

### the grades on (item)

Authored path: `Course.grades.theGradesOn`.
- Covered by [Grades](../design/compositions/course/grades.md), line 41.

```former
Former "the grades on (item)" — inputs (item); bindings (learner, grade, score, status); promises exactly one record — forms:
  each Grading._getGradesForItem (item) has (grade, learner, score, status)
    form a record of
      grade
      learner
      score
      status
```

### the thread stats of (conversation)

```former
Former "the thread stats of (conversation)" — inputs (conversation); bindings (replyNode, replyItem, activityItem, activityAt, partItem, participant); promises exactly one record — forms:
  a record of
    lastActivityAt: the activityAt of the first view "the public posts in (conversation)" with (conversation) has (createdAt: activityAt, item: activityItem)
      arranged by activityAt, descending
    participants: the distinct participant of each view "the public posts in (conversation)" with (conversation) has (author: participant, item: partItem)
    replyCount: the count of view "the public posts in (conversation)" with (conversation) has (item: replyItem, node: replyNode)
      where Conversing._parentOf (node: replyNode)
```

### the home feed by activity ()

Authored path: `Forum.feed.theHomeFeedByActivity`.
- Covered by [Feeds and thread context](../design/compositions/forum/feed.md), line 6.

```former
Former "the home feed by activity ()" — inputs (); bindings (conversation, root, item, createdAt, locked, resolved, home, tag, tagName); promises exactly one record — forms:
  each Conversing._getConversationsByLastActivity () has (conversation, createdAt, item, root)
    where view "(item) is intact" with (item)
    where Locking._isLocked (target: conversation) has (locked)
    where Resolving._isResolved (question: item) has (resolved)
    where whether Categorizing._getHome (item) has (home)
    form a record of
      category: home
      conversation
      createdAt
      item
      locked
      post: former "the post summary of (item)" with (item)
      resolved
      root
      tags: each Tagging._getTags (target: item) has (name: tagName, tag)
        form a record of
          name: tagName
          tag
      … former "the thread stats of (conversation)" with (conversation)
```

### the home feed by creation ()

Authored path: `Forum.feed.theHomeFeedByCreation`.
- Covered by [Feeds and thread context](../design/compositions/forum/feed.md), line 4.

```former
Former "the home feed by creation ()" — inputs (); bindings (conversation, root, item, createdAt, locked, resolved, home, tag, tagName); promises exactly one record — forms:
  each Conversing._getConversations () has (conversation, createdAt, item, root)
    where view "(item) is intact" with (item)
    where Locking._isLocked (target: conversation) has (locked)
    where Resolving._isResolved (question: item) has (resolved)
    where whether Categorizing._getHome (item) has (home)
    form a record of
      category: home
      conversation
      createdAt
      item
      locked
      post: former "the post summary of (item)" with (item)
      resolved
      root
      tags: each Tagging._getTags (target: item) has (name: tagName, tag)
        form a record of
          name: tagName
          tag
      … former "the thread stats of (conversation)" with (conversation)
```

### the notification presentation of (item)

Authored path: `Forum.notifications.theNotificationPresentationOf`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 33.

```former
Former "the notification presentation of (item)" — inputs (item); bindings (author, content, createdAt, editedAt, username, displayName, avatar); promises exactly one record — forms:
  a record of
    where Posting._getPost (post: item) has (author, content, createdAt, editedAt)
    where Authenticating._getById (user: author) has (username)
    where whether Profiling._getProfileFields (user: author) has (avatar, displayName)
    actor: a record of
      avatar
      displayName
      user: author
      username
    post: a record of
      author
      content
      createdAt
      editedAt
```

### the inbox of (user)

Authored path: `Forum.notifications.theInboxOf`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 32.

```former
Former "the inbox of (user)" — inputs (user); bindings (notification, kind, link, createdAt, read); promises exactly one record — forms:
  each Notifying._getInbox (recipient: user) has (createdAt, kind, link, notification, read)
    form a record of
      createdAt
      kind
      link
      notification
      read
      … former "the notification presentation of (item)" with (item: link), with blank leaves if absent
```

### the invitations ()

Authored path: `Access.invitations.theInvitations`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 18.

```former
Former "the invitations ()" — inputs (); bindings (invitation, channel, address, createdAt, lastInvitedAt, inviteCount, user); promises exactly one record — forms:
  each Inviting._getInvitations () has (address, channel, createdAt, invitation, inviteCount, lastInvitedAt, user)
    form a record of
      address
      channel
      createdAt
      invitation
      inviteCount
      lastInvitedAt
      user
```

### the items in (category)

Authored path: `Forum.categories.theItemsIn`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 14.

```former
Former "the items in (category)" — inputs (category); bindings (item); promises exactly one record — forms:
  each Categorizing._getItems (category) has (item)
    where view "(post) is readable" with (post: item)
    form a record of
      item
```

### the late-day balance of (learner)

Authored path: `Course.lateDays.theLateDayBalanceOf`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 15.

```former
Former "the late-day balance of (learner)" — inputs (learner); bindings (granted, used, remaining); promises exactly one record — forms:
  a record of
    where Banking._getBalance (learner) has (granted, remaining, used)
    granted
    remaining
    used
```

### the late-day uses of (learner)

Authored path: `Course.lateDays.theLateDayUsesOf`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 13.

```former
Former "the late-day uses of (learner)" — inputs (learner); bindings (use, item, days, status, appliedAt); promises exactly one record — forms:
  each Banking._getUses (learner) has (appliedAt, days, item, status, use)
    form a record of
      appliedAt
      days
      item
      status
      use
```

### the late-day uses on (assignment)

Authored path: `Course.lateDays.theLateDayUsesOn`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 22.

```former
Former "the late-day uses on (assignment)" — inputs (assignment); bindings (learner, days); promises exactly one record — forms:
  each Banking._getUsesForItem (item: assignment) has (days, learner)
    form a record of
      days
      learner
```

### the latest revision of (item)

Authored path: `Forum.revisions.theLatestRevisionOf`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 16.

```former
Former "the latest revision of (item)" — inputs (item); bindings (revision, number, content, savedAt); promises exactly one record — forms:
  each Revising._getLatest (item) has (content, number, revision, savedAt)
    form a record of
      content
      number
      revision
      savedAt
```

### the locked list ()

Authored path: `Forum.moderation.theLockedList`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 23.

```former
Former "the locked list ()" — inputs (); bindings (target, lockedAt); promises exactly one record — forms:
  each Locking._getLocked () has (lockedAt, target)
    where view "(target) is public" with (target)
    form a record of
      lockedAt
      target
```

### the moderation queue ()

Authored path: `Forum.moderation.theModerationQueue`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 32.

```former
Former "the moderation queue ()" — inputs (); bindings (target, count, node, conversation, author, content, createdAt, editedAt, rendered, flag, reporter, reason, status, flaggedAt); promises exactly one record — forms:
  each Flagging._getOpenTargets () has (count, target)
    where Posting._getPost (post: target) has (author, content, createdAt, editedAt)
    where Formatting._getRendered (target) has (rendered)
    where whether Conversing._getNodeByItem (item: target) has (node)
    where whether Conversing._getConversation (node) has (conversation)
    form a record of
      conversation
      count
      flags: each Flagging._getFlags (target) has (createdAt: flaggedAt, flag, reason, reporter, status)
        where Flagging._getFlags (target) has (flag, status: "open")
        form a record of
          createdAt: flaggedAt
          flag
          reason
          reporter
      post: a record of
        author
        content
        createdAt
        editedAt
      rendered
      target
```

### the notes shown to (learner)

Authored path: `Course.notes.theNotesShownTo`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 17.

```former
Former "the notes shown to (learner)" — inputs (learner); bindings (note, author, body, status, createdAt, updatedAt, followUpAt, acknowledgedAt, tags); promises exactly one record — forms:
  each Noting._getShownTo (learner) has (acknowledgedAt, author, body, createdAt, followUpAt, note, status, tags, updatedAt)
    form a record of
      acknowledgedAt
      author
      body
      createdAt
      followUpAt
      learner
      note
      status
      tags
      updatedAt
```

### the notifications of (user)

Authored path: `Forum.notifications.theNotificationsOf`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 30.

```former
Former "the notifications of (user)" — inputs (user); bindings (notification, kind, subject, link, createdAt, read); promises exactly one record — forms:
  each Notifying._getInbox (recipient: user) has (createdAt, kind, link, notification, read, subject)
    form a record of
      createdAt
      kind
      link
      notification
      read
      subject
```

### the open flags ()

Authored path: `Forum.moderation.theOpenFlags`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 31.

```former
Former "the open flags ()" — inputs (); bindings (target, count); promises exactly one record — forms:
  each Flagging._getOpenTargets () has (count, target)
    where view "(post) is readable" with (post: target)
    form a record of
      count
      target
```

### the pending roster ()

Authored path: `Course.roster.thePendingRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 32.

```former
Former "the pending roster ()" — inputs (); bindings (seat, externalKey, email, rosterName, kind, section); promises exactly one record — forms:
  each Rostering._getUnclaimedSeats () has (email, externalKey, kind, rosterName, seat, section)
    form a record of
      email
      externalKey
      kind
      rosterName
      seat
      section
```

### the pins of (scope)

Authored path: `Forum.pins.thePinsOf`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 9.

```former
Former "the pins of (scope)" — inputs (scope); bindings (item, priority); promises exactly one record — forms:
  each Pinning._getPinned (scope) has (item, priority)
    where view "(post) is readable" with (post: item)
    form a record of
      item
      priority
```

### the post (post)

Authored path: `Forum.posts.thePost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 20.

```former
Former "the post (post)" — inputs (post); bindings (author, content, createdAt, editedAt, rendered); promises exactly one record — forms:
  a record of
    where Posting._getPost (post) has (author, content, createdAt, editedAt)
    where Formatting._getRendered (target: post) has (rendered)
    author
    content
    createdAt
    editedAt
    rendered
```

### the private profile of (user)

```former
Former "the private profile of (user)" — inputs (user); bindings (displayName, bio, avatar, email); promises at most one record — forms:
  a record of
    where Profiling._getProfileFields (user) has (avatar, bio, displayName, email)
    avatar
    bio
    displayName
    email
```

### the profile face of (user)

```former
Former "the profile face of (user)" — inputs (user); bindings (displayName, bio, avatar); promises at most one record — forms:
  a record of
    where Profiling._getProfileFields (user) has (avatar, bio, displayName)
    avatar
    bio
    displayName
```

### the public posts of (author)

Authored path: `Forum.posts.thePublicPostsOf`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 23.

```former
Former "the public posts of (author)" — inputs (author); bindings (post); promises exactly one record — forms:
  each view "the public posts by (author)" with (author) has (post)
    form a record of
      post
```

### the reaction counts on (target)

Authored path: `Forum.reactions.theReactionCountsOn`.
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 11.

```former
Former "the reaction counts on (target)" — inputs (target); bindings (kind, count); promises exactly one record — forms:
  each Reacting._countByKind (target) has (count, kind)
    form a record of
      count
      kind
```

### the reactions on (target)

Authored path: `Forum.reactions.theReactionsOn`.
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 10.

```former
Former "the reactions on (target)" — inputs (target); bindings (reaction, reactor, kind); promises exactly one record — forms:
  each Reacting._getReactionsForTarget (target) has (kind, reaction, reactor)
    form a record of
      kind
      reaction
      user: reactor
```

### the released grades of (learner)

Authored path: `Course.grades.theReleasedGradesOf`.
- Covered by [Grades](../design/compositions/course/grades.md), line 36.

```former
Former "the released grades of (learner)" — inputs (learner); bindings (item, grade, score, outOf, status, feedback, label); promises exactly one record — forms:
  each Grading._getGradesForLearner (learner) has (feedback, grade, item, outOf, score, status)
    where whether Itemizing._getItem (item) has (label)
    where status is among ["RELEASED", "EXCUSED"]
    form a record of
      feedback
      grade
      item
      label
      maxPoints: outOf
      score
      status
```

### the resolution of (question)

Authored path: `Forum.resolutions.theResolutionOf`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 12.

```former
Former "the resolution of (question)" — inputs (question); bindings (answer, resolvedBy, resolvedAt); promises exactly one record — forms:
  each Resolving._getResolution (question) has (answer, resolvedAt, resolvedBy)
    where view "(post) is readable" with (post: answer)
    form a record of
      answer
      resolvedAt
      resolvedBy
```

### the revision history of (item)

Authored path: `Forum.revisions.theRevisionHistoryOf`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 12.

```former
Former "the revision history of (item)" — inputs (item); bindings (revision, number, content, savedAt); promises exactly one record — forms:
  each Revising._getRevisions (item) has (content, number, revision, savedAt)
    form a record of
      content
      number
      revision
      savedAt
```

### the revision numbered (number) of (item)

Authored path: `Forum.revisions.theRevisionNumberedOf`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 14.

```former
Former "the revision numbered (number) of (item)" — inputs (number, item); bindings (content, savedAt); promises exactly one record — forms:
  each Revising._getRevision (item, number) has (content, savedAt)
    form a record of
      content
      savedAt
```

### the roles held by (user) in (context)

Authored path: `Access.roles.theRolesHeldBy`.
- Covered by [Roles](../design/compositions/access/roles.md), line 21.

```former
Former "the roles held by (user) in (context)" — inputs (user, context); bindings (role); promises exactly one record — forms:
  each Roling._getRoles (context, user) has (role)
    form a record of
      role
```

### the roster ()

Authored path: `Course.roster.theRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 30.

```former
Former "the roster ()" — inputs (); bindings (user, seat, kind, section, rosterName, email); promises exactly one record — forms:
  each Rostering._getActiveMembers () has (email, kind, rosterName, seat, section, user)
    form a record of
      email
      kind
      rosterName
      seat
      section
      user
```

### the sections ()

Authored path: `Course.roster.theSections`.
- Covered by [Roster](../design/compositions/course/roster.md), line 8.

```former
Former "the sections ()" — inputs (); bindings (section, name, location, meetingPattern, status); promises exactly one record — forms:
  each Rostering._getSections () has (location, meetingPattern, name, section, status)
    form a record of
      location
      meetingPattern
      name
      section
      status
```

### the staff assignments ()

Authored path: `Course.assignments.theStaffAssignments`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 41.

```former
Former "the staff assignments ()" — inputs (); bindings (assignment, author, title, instructions, kind, availableAt, dueAt, closeAt, acceptsSubmissions, audience, targets, status, createdAt, updatedAt); promises exactly one record — forms:
  each Assigning._getAssignments () has (acceptsSubmissions, assignment, audience, author, availableAt, closeAt, createdAt, dueAt, instructions, kind, status, targets, title, updatedAt)
    form a record of
      acceptsSubmissions
      assignment
      audience
      author
      availableAt
      closeAt
      createdAt
      dueAt
      instructions
      kind
      status
      targets
      title
      updatedAt
```

### the staff dashboard ()

Authored path: `Course.calendar.theStaffDashboard`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 13.

```former
Former "the staff dashboard ()" — inputs (); bindings (user, seat, kind, section, rosterName, email); promises exactly one record — forms:
  each Rostering._getActiveMembers () has (email, kind, rosterName, seat, section, user)
    form a record of
      email
      kind
      rosterName
      seat
      section
      user
```

### the staff dashboard counts ()

Authored path: `Course.calendar.theStaffDashboardCounts`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 14.

```former
Former "the staff dashboard counts ()" — inputs (); bindings (assignment, item, learner, use); promises exactly one record — forms:
  a record of
    assignments: the count of Assigning._getAssignments () has (assignment)
    gradeItems: the count of Itemizing._getItems () has (item)
    lateDayUses: the count of Rostering._getActiveStudents () has (user: learner)
      where Banking._getUses (learner) has (status: "APPLIED", use)
```

### the staff notes on (learner)

Authored path: `Course.notes.theStaffNotesOn`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 11.

```former
Former "the staff notes on (learner)" — inputs (learner); bindings (note, author, body, visibility, status, createdAt, updatedAt, followUpAt, acknowledgedAt, tags); promises exactly one record — forms:
  each Noting._getActiveNotesFor (learner) has (acknowledgedAt, author, body, createdAt, followUpAt, note, status, tags, updatedAt, visibility)
    form a record of
      acknowledgedAt
      author
      body
      createdAt
      followUpAt
      learner
      note
      status
      tags
      updatedAt
      visibility
```

### the submissions by (submitter)

Authored path: `Course.submissions.theSubmissionsBy`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 13.

```former
Former "the submissions by (submitter)" — inputs (submitter); bindings (assignment, submission, submittedAt, number, status); promises exactly one record — forms:
  each Submitting._getSubmissionsForSubmitter (submitter) has (assignment, number, status, submission, submittedAt)
    form a record of
      assignment
      number
      status
      submission
      submittedAt
```

### the submissions for (assignment)

Authored path: `Course.submissions.theSubmissionsForAssignment`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 16.

```former
Former "the submissions for (assignment)" — inputs (assignment); bindings (submitter, submitterName, submission, submittedAt, number, status); promises exactly one record — forms:
  each Submitting._getSubmissionsForAssignment (assignment) has (number, status, submission, submittedAt, submitter)
    where Rostering._getSeatByUser (user: submitter) has (rosterName: submitterName)
    form a record of
      number
      status
      submission
      submittedAt
      submitter
      submitterName
```

### the subscribers of (target)

Authored path: `Forum.subscriptions.theSubscribersOf`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 14.

```former
Former "the subscribers of (target)" — inputs (target); bindings (user); promises exactly one record — forms:
  each Subscribing._getSubscribers (target) has (user)
    where view "(conversation) is readable" with (conversation: target)
    form a record of
      user
```

### the subscriptions of (user)

Authored path: `Forum.subscriptions.theSubscriptionsOf`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 7.

```former
Former "the subscriptions of (user)" — inputs (user); bindings (target, subscribedAt); promises exactly one record — forms:
  each Subscribing._getSubscriptions (user) has (subscribedAt, target)
    where view "(conversation) is readable" with (conversation: target)
    form a record of
      subscribedAt
      target
```

### the tags ()

Authored path: `Forum.tags.theTags`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 11.

```former
Former "the tags ()" — inputs (); bindings (tag, name); promises exactly one record — forms:
  each Tagging._getAllTags () has (name, tag)
    form a record of
      name
      tag
```

### the tags on (target)

Authored path: `Forum.tags.theTagsOn`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 13.

```former
Former "the tags on (target)" — inputs (target); bindings (tag, name); promises exactly one record — forms:
  each Tagging._getTags (target) has (name, tag)
    where view "(post) is readable" with (post: target)
    form a record of
      name
      tag
```

### the targets tagged (tag)

Authored path: `Forum.tags.theTargetsTagged`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 15.

```former
Former "the targets tagged (tag)" — inputs (tag); bindings (target); promises exactly one record — forms:
  each Tagging._getTargets (tag) has (target)
    where view "(post) is readable" with (post: target)
    form a record of
      target
```

### the targets tagged with (name)

Authored path: `Forum.tags.theTargetsTaggedWithName`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 17.

```former
Former "the targets tagged with (name)" — inputs (name); bindings (tag, target); promises exactly one record — forms:
  each Tagging._getByName (name) has (tag)
    where Tagging._getTargets (tag) has (target)
    where view "(post) is readable" with (post: target)
    form a record of
      target
```

### the thread (conversation)

Authored path: `Forum.threads.theThread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 28.

```former
Former "the thread (conversation)" — inputs (conversation); bindings (node, item, parent, depth, author, content, createdAt, editedAt, rendered); promises exactly one record — forms:
  each Conversing._getThread (conversation) has (depth, item, node, parent)
    where view "(item) is intact" with (item)
    where Posting._getPost (post: item) has (author, content, createdAt, editedAt)
    where Formatting._getRendered (target: item) has (rendered)
    form a record of
      depth
      item
      node
      parent
      post: a record of
        author
        content
        createdAt
        editedAt
      rendered
```

### the thread context (conversation)

Authored path: `Forum.feed.theThreadContext`.
- Covered by [Feeds and thread context](../design/compositions/forum/feed.md), line 13.

```former
Former "the thread context (conversation)" — inputs (conversation); bindings (node, item, category, tag, tagName, locked, answer); promises exactly one record — forms:
  each Conversing._getThread (conversation) has (item, node)
    where no Conversing._parentOf (node)
    where view "(item) is intact" with (item)
    where whether Categorizing._getHome (item) has (home: category)
    where Locking._isLocked (target: conversation) has (locked)
    where whether Resolving._getResolution (question: item) has (answer)
    form a record of
      acceptedAnswer: answer
      category
      item
      locked
      tags: each Tagging._getTags (target: item) has (name: tagName, tag)
        form a record of
          name: tagName
          tag
      … former "the thread stats of (conversation)" with (conversation)
```

### the trash bin ()

Authored path: `Forum.moderation.theTrashBin`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 11.

```former
Former "the trash bin ()" — inputs (); bindings (item, trashedBy, trashedAt); promises exactly one record — forms:
  each Trashing._getTrashed () has (item, trashedAt, trashedBy)
    form a record of
      item
      trashedAt
      trashedBy
```

### the unread of (user) in (scope)

Authored path: `Forum.unread.theUnreadOf`.
- Covered by [Unread tracking](../design/compositions/forum/unread.md), line 4.

```former
Former "the unread of (user) in (scope)" — inputs (user, scope); bindings (item); promises exactly one record — forms:
  each Tracking._getUnread (scope, user) has (item)
    form a record of
      item
```

### the user page of (user)

Authored path: `Forum.profiles.theUserPage`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 22.

```former
Former "the user page of (user)" — inputs (user); bindings (role, name, post, node, conversation); promises exactly one record — forms:
  a record of
    posts: each Posting._getByAuthor (author: user) has (post)
      where view "(item) is intact" with (item: post)
      where whether Conversing._getNodeByItem (item: post) has (node)
      where whether Conversing._getConversation (node) has (conversation)
      form a record of
        conversation
        item: post
        post: whether former "the post summary of (item)" with (item: post)
    profile: whether former "the profile face of (user)" with (user)
    roles: each Roling._getRoles (context: "forum", user) has (role)
      where Roling._getRoleDetail (role) has (name)
      form a record of
        name
        role
```

### the user search (query)

Authored path: `Forum.profiles.theUserSearch`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 16.

```former
Former "the user search (query)" — inputs (query); bindings (user, username); promises exactly one record — forms:
  each Authenticating._search (query) has (user, username)
    form a record of
      profile: former "the profile face of (user)" with (user)
      user
      username
```

### the watched threads of (user)

Authored path: `Forum.subscriptions.theWatchedThreadsOf`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 8.

```former
Former "the watched threads of (user)" — inputs (user); bindings (target, subscribedAt, rootItem, rootNode); promises exactly one record — forms:
  each Subscribing._getSubscriptions (user) has (subscribedAt, target)
    where view "(conversation) is readable" with (conversation: target)
    where Conversing._getThread (conversation: target) has (item: rootItem, node: rootNode)
    where no Conversing._parentOf (node: rootNode)
    form a record of
      conversation: target
      post: whether former "the post summary of (item)" with (item: rootItem)
      subscribedAt
      … former "the thread stats of (conversation)" with (conversation: target), with blank leaves if absent
```

## Reactions

### Access.auth.AcceptInvitation

Authored path: `Access.auth.AcceptInvitation`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 7.

```reaction
when RequestBoundary.request (displayName, invitation, password, path: "/auth/accept-invitation", requestId, temporaryPassword, username)
then
  Inviting.verify (channel: "email", credential: temporaryPassword, invitation)
```

### Access.auth.AcceptInvitation#2

Authored path: `Access.auth.AcceptInvitation`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 7.

```reaction
when Inviting.verify (channel: "email", credential: temporaryPassword, invitation, address: email), asked by Access.auth.AcceptInvitation
where
  earlier, RequestBoundary.request (displayName, invitation, password, path: "/auth/accept-invitation", requestId, temporaryPassword, username)
then
  Authenticating.register (email, password, username)
```

### Access.auth.AcceptInvitation#3

Authored path: `Access.auth.AcceptInvitation`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 7.

```reaction
when Authenticating.register (email, password, username, user), asked by Access.auth.AcceptInvitation#2
where
  earlier, RequestBoundary.request (displayName, invitation, password, path: "/auth/accept-invitation", requestId, temporaryPassword, username)
then
  Profiling.createProfile (displayName, email, user)
```

### Access.auth.AcceptInvitation#4

Authored path: `Access.auth.AcceptInvitation`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 7.

```reaction
when Profiling.createProfile (displayName, email, user), asked by Access.auth.AcceptInvitation#3
where
  earlier, Inviting.verify (channel: "email", credential: temporaryPassword, invitation, address: email), asked by Access.auth.AcceptInvitation
then
  Inviting.claim (credential: temporaryPassword, invitation, user)
```

### Access.auth.AcceptInvitation#5

Authored path: `Access.auth.AcceptInvitation`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 7.

```reaction
when Inviting.claim (credential: temporaryPassword, invitation, user), asked by Access.auth.AcceptInvitation#4
where
  earlier, RequestBoundary.request (displayName, invitation, password, path: "/auth/accept-invitation", requestId, temporaryPassword, username)
then
  RequestBoundary.respond (requestId, user)
```

### Access.auth.BootstrapAdminOnLogin

Authored path: `Access.auth.BootstrapAdminOnLogin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 29.

```reaction
when Authenticating.authenticate (user)
where
  Authenticating._getUserCount () has (count: 1)
  Roling._hasCapabilityHolder (capability: "administer", context: "forum") has (present: false)
then
  Roling.ensureRole (capabilities: ["administer", "moderate", "pin", "roster:manage", "late-days:manage", "calendar:view-staff", "student-notes:manage"], name: "administrator")
```

### Access.auth.BootstrapAdminOnLogin#2

Authored path: `Access.auth.BootstrapAdminOnLogin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 29.

```reaction
when Roling.ensureRole (capabilities: ["administer", "moderate", "pin", "roster:manage", "late-days:manage", "calendar:view-staff", "student-notes:manage"], name: "administrator", role), asked by Access.auth.BootstrapAdminOnLogin
where
  earlier, Authenticating.authenticate (user)
then
  Roling.grant (context: "forum", role, user)
```

### Access.auth.BootstrapAdminOnRegister

Authored path: `Access.auth.BootstrapAdminOnRegister`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 27.

```reaction
when Authenticating.register (user)
where
  Authenticating._getUserCount () has (count: 1)
  Roling._hasCapabilityHolder (capability: "administer", context: "forum") has (present: false)
then
  Roling.ensureRole (capabilities: ["administer", "moderate", "pin", "roster:manage", "late-days:manage", "calendar:view-staff", "student-notes:manage"], name: "administrator")
```

### Access.auth.BootstrapAdminOnRegister#2

Authored path: `Access.auth.BootstrapAdminOnRegister`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 27.

```reaction
when Roling.ensureRole (capabilities: ["administer", "moderate", "pin", "roster:manage", "late-days:manage", "calendar:view-staff", "student-notes:manage"], name: "administrator", role), asked by Access.auth.BootstrapAdminOnRegister
where
  earlier, Authenticating.register (user)
then
  Roling.grant (context: "forum", role, user)
```

### Access.auth.ChangePassword

Authored path: `Access.auth.ChangePassword`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 21.

```reaction
when RequestBoundary.request (newPassword, oldPassword, path: "/auth/changePassword", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Authenticating.changePassword (newPassword, oldPassword, user)
```

### Access.auth.ChangePassword#2

Authored path: `Access.auth.ChangePassword`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 21.

```reaction
when Authenticating.changePassword (newPassword, oldPassword, user), asked by Access.auth.ChangePassword
then
  Sessioning.endAllForUser (user)
```

### Access.auth.ChangePassword#3

Authored path: `Access.auth.ChangePassword`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 21.

```reaction
when Sessioning.endAllForUser (user), asked by Access.auth.ChangePassword#2
where
  earlier, RequestBoundary.request (newPassword, oldPassword, path: "/auth/changePassword", requestId, session)
then
  RequestBoundary.respond (requestId, user)
```

### Access.auth.Login

Authored path: `Access.auth.Login`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 12.

```reaction
when RequestBoundary.request (password, path: "/auth/login", requestId, username)
then
  Authenticating.authenticate (password, username)
```

### Access.auth.Login#2

Authored path: `Access.auth.Login`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 12.

```reaction
when Authenticating.authenticate (password, username, user), asked by Access.auth.Login
then
  Timing.capture ()
```

### Access.auth.Login#3

Authored path: `Access.auth.Login`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 12.

```reaction
when Timing.capture (at), asked by Access.auth.Login#2
where
  earlier, Authenticating.authenticate (password, username, user), asked by Access.auth.Login
then
  Sessioning.start (at, user)
```

### Access.auth.Login#4

Authored path: `Access.auth.Login`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 12.

```reaction
when Sessioning.start (at, user, expiresAt, session), asked by Access.auth.Login#3
where
  earlier, RequestBoundary.request (password, path: "/auth/login", requestId, username)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### Access.auth.Logout

Authored path: `Access.auth.Logout`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 13.

```reaction
when RequestBoundary.request (path: "/auth/logout", requestId, session)
where
  view "the active user of (session)" with (session)
then
  Sessioning.end (session)
```

### Access.auth.Logout#2

Authored path: `Access.auth.Logout`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 13.

```reaction
when Sessioning.end (session), asked by Access.auth.Logout
where
  earlier, RequestBoundary.request (path: "/auth/logout", requestId, session)
then
  RequestBoundary.respond (ok: true, requestId)
```

### Access.auth.Me

Authored path: `Access.auth.Me`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 14.

```reaction
when RequestBoundary.request (path: "/auth/me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  Authenticating._getById (user) has (email, username)
  Profiling._getProfile (user) has (profile)
then
  RequestBoundary.respond (email, profile, requestId, user, username)
```

### Access.auth.RegisterInitialAdmin:initialized

Authored path: `Access.auth.RegisterInitialAdmin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 34.

```reaction
when RequestBoundary.request (displayName, email, password, path: "/setup/register-admin", requestId, setupSecret, username)
where
  valid is setupSecretMatches (secret: setupSecret)
  valid is among [true]
  no Authenticating._getUserCount () has (count: 0)
then
  RequestBoundary.respond (error: "CONFLICT", requestId)
```

### Access.auth.RegisterInitialAdmin:success

Authored path: `Access.auth.RegisterInitialAdmin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 34.

```reaction
when RequestBoundary.request (displayName, email, password, path: "/setup/register-admin", requestId, setupSecret, username)
where
  valid is setupSecretMatches (secret: setupSecret)
  valid is among [true]
  Authenticating._getUserCount () has (count: 0)
then
  Authenticating.register (email, password, username)
```

### Access.auth.RegisterInitialAdmin:success#2

Authored path: `Access.auth.RegisterInitialAdmin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 34.

```reaction
when Authenticating.register (email, password, username, user), asked by Access.auth.RegisterInitialAdmin:success
where
  earlier, RequestBoundary.request (displayName, email, password, path: "/setup/register-admin", requestId, setupSecret, username)
then
  Profiling.createProfile (displayName, email, user)
```

### Access.auth.RegisterInitialAdmin:success#3

Authored path: `Access.auth.RegisterInitialAdmin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 34.

```reaction
when Profiling.createProfile (displayName, email, user), asked by Access.auth.RegisterInitialAdmin:success#2
where
  earlier, RequestBoundary.request (displayName, email, password, path: "/setup/register-admin", requestId, setupSecret, username)
then
  RequestBoundary.respond (requestId, user)
```

### Access.auth.RegisterInitialAdmin:unauthorized

Authored path: `Access.auth.RegisterInitialAdmin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 34.

```reaction
when RequestBoundary.request (displayName, email, password, path: "/setup/register-admin", requestId, setupSecret, username)
where
  valid is setupSecretMatches (secret: setupSecret)
  valid is among [false]
then
  RequestBoundary.respond (error: "UNAUTHORIZED", requestId)
```

### Access.auth.RepairInitialAdminRosterBootstrapOnLogin

Authored path: `Access.auth.RepairInitialAdminRosterBootstrapOnLogin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 44.

```reaction
when Authenticating.authenticate (user)
where
  Authenticating._getUserCount () has (count: 1)
  Roling._hasCapability (capability: "administer", context: "forum", user) has (allowed: true)
  Roling._hasCapability (capability: "roster:manage", context: "forum", user) has (allowed: false)
then
  Roling.ensureRole (capabilities: ["roster:manage"], name: "initial-roster-bootstrap")
```

### Access.auth.RepairInitialAdminRosterBootstrapOnLogin#2

Authored path: `Access.auth.RepairInitialAdminRosterBootstrapOnLogin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 44.

```reaction
when Roling.ensureRole (capabilities: ["roster:manage"], name: "initial-roster-bootstrap", role), asked by Access.auth.RepairInitialAdminRosterBootstrapOnLogin
where
  earlier, Authenticating.authenticate (user)
then
  Roling.grant (context: "forum", role, user)
```

### Access.auth.Resolve:absent

Authored path: `Access.auth.Resolve`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 18.

```reaction
when RequestBoundary.request (path: "/auth/resolve", requestId, username)
where
  no view "the user named (username)" with (username)
then
  RequestBoundary.respond (requestId, user: null)
```

### Access.auth.Resolve:found

Authored path: `Access.auth.Resolve`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 18.

```reaction
when RequestBoundary.request (path: "/auth/resolve", requestId, username)
where
  view "the user named (username)" with (username) has (user)
then
  RequestBoundary.respond (requestId, user)
```

### Access.invitations.EmailInvitationQueuesMail

Authored path: `Access.invitations.EmailInvitationQueuesMail`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 11.

```reaction
when Inviting.invite (address, at, channel: "email", created, credential, invitation)
where
  text is invitationMailText (credential, invitation)
  html is invitationMailHtml (credential, invitation)
then
  Mailing.enqueue (at, html, key: invitation, recipient: address, subject: "Your Commons invitation", text)
```

### Access.invitations.Invite:forbidden

Authored path: `Access.invitations.Invite`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 4.

```reaction
when RequestBoundary.request (email, path: "/invitations/invite", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.invitations.Invite:success

Authored path: `Access.invitations.Invite`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 4.

```reaction
when RequestBoundary.request (email, path: "/invitations/invite", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
then
  Mailing.normalizeRecipient (recipient: email)
```

### Access.invitations.Invite:success#2

Authored path: `Access.invitations.Invite`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 4.

```reaction
when Mailing.normalizeRecipient (recipient: email, result.recipient), asked by Access.invitations.Invite:success
then
  Timing.capture ()
```

### Access.invitations.Invite:success#3

Authored path: `Access.invitations.Invite`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 4.

```reaction
when Timing.capture (at), asked by Access.invitations.Invite:success#2
where
  earlier, Mailing.normalizeRecipient (recipient: email, result.recipient), asked by Access.invitations.Invite:success
then
  Inviting.invite (address: recipient, at, channel: "email")
```

### Access.invitations.Invite:success#4

Authored path: `Access.invitations.Invite`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 4.

```reaction
when Inviting.invite (address: recipient, at, channel: "email", created, invitation), asked by Access.invitations.Invite:success#3
where
  earlier, RequestBoundary.request (email, path: "/invitations/invite", requestId, session)
then
  RequestBoundary.respond (created, email: recipient, invitation, requestId)
```

### Access.invitations.List:forbidden

Authored path: `Access.invitations.List`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 17.

```reaction
when RequestBoundary.request (path: "/invitations/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.invitations.List:success

Authored path: `Access.invitations.List`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 17.

```reaction
when RequestBoundary.request (path: "/invitations/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
then
  RequestBoundary.respond (invitations: former "the invitations ()", requestId)
```

### Access.roles.DefineRole:forbidden

Authored path: `Access.roles.DefineRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 6.

```reaction
when RequestBoundary.request (capabilities, name, path: "/roles/define", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not administer" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.roles.DefineRole:success

Authored path: `Access.roles.DefineRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 6.

```reaction
when RequestBoundary.request (capabilities, name, path: "/roles/define", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may administer" with (user)
then
  Roling.defineRole (capabilities, name)
```

### Access.roles.DefineRole:success#2

Authored path: `Access.roles.DefineRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 6.

```reaction
when Roling.defineRole (capabilities, name, role), asked by Access.roles.DefineRole:success
where
  earlier, RequestBoundary.request (capabilities, name, path: "/roles/define", requestId, session)
then
  RequestBoundary.respond (requestId, role)
```

### Access.roles.GrantRole:forbidden

Authored path: `Access.roles.GrantRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 8.

```reaction
when RequestBoundary.request (context, path: "/roles/grant", requestId, role, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.roles.GrantRole:success

Authored path: `Access.roles.GrantRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 8.

```reaction
when RequestBoundary.request (context, path: "/roles/grant", requestId, role, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  Authenticating._denotedUser (ref: user) has (user: subject)
  Roling._denotedRole (ref: role) has (role: resolved)
then
  Roling.grant (context, role: resolved, user: subject)
```

### Access.roles.GrantRole:success#2

Authored path: `Access.roles.GrantRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 8.

```reaction
when Roling.grant (context, role: resolved, user: subject, grant), asked by Access.roles.GrantRole:success
where
  earlier, RequestBoundary.request (context, path: "/roles/grant", requestId, role, session, user)
then
  RequestBoundary.respond (grant, requestId)
```

### Access.roles.RevokeRole:forbidden

Authored path: `Access.roles.RevokeRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 11.

```reaction
when RequestBoundary.request (context, path: "/roles/revoke", requestId, role, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.roles.RevokeRole:success

Authored path: `Access.roles.RevokeRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 11.

```reaction
when RequestBoundary.request (context, path: "/roles/revoke", requestId, role, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  Authenticating._denotedUser (ref: user) has (user: subject)
  Roling._denotedRole (ref: role) has (role: resolved)
then
  Roling.revoke (context, role: resolved, user: subject)
```

### Access.roles.RevokeRole:success#2

Authored path: `Access.roles.RevokeRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 11.

```reaction
when Roling.revoke (context, role: resolved, user: subject, grant), asked by Access.roles.RevokeRole:success
where
  earlier, RequestBoundary.request (context, path: "/roles/revoke", requestId, role, session, user)
then
  RequestBoundary.respond (grant, requestId)
```

### Access.roles.RoleCan

Authored path: `Access.roles.RoleCan`.
- Covered by [Roles](../design/compositions/access/roles.md), line 22.

```reaction
when RequestBoundary.request (capability, context, path: "/roles/can", requestId, user)
where
  Roling._hasCapability (capability, context, user) has (allowed)
then
  RequestBoundary.respond (allowed, requestId)
```

### Access.roles.RoleGet

Authored path: `Access.roles.RoleGet`.
- Covered by [Roles](../design/compositions/access/roles.md), line 23.

```reaction
when RequestBoundary.request (path: "/roles/get", requestId, role)
where
  Roling._getRoleDetail (role) has (capabilities, name)
then
  RequestBoundary.respond (capabilities, name, requestId)
```

### Access.roles.RoleList

Authored path: `Access.roles.RoleList`.
- Covered by [Roles](../design/compositions/access/roles.md), line 24.

```reaction
when RequestBoundary.request (path: "/roles/list", requestId)
then
  RequestBoundary.respond (requestId, roles: former "the defined roles ()")
```

### Access.roles.RolesForUser

Authored path: `Access.roles.RolesForUser`.
- Covered by [Roles](../design/compositions/access/roles.md), line 20.

```reaction
when RequestBoundary.request (context, path: "/roles/forUser", requestId, user)
where
  Authenticating._denotedUser (ref: user) has (user: subject)
then
  RequestBoundary.respond (requestId, roles: former "the roles held by (user) in (context)" with (context, user: subject))
```

### Access.session.InvalidSessionIsRejected:expired-session

Authored path: `Access.session.InvalidSessionIsRejected`.
- Covered by [Session boundary](../design/compositions/access/session.md), line 6.

```reaction
when RequestBoundary.request (requestId, session)
where
  Timing._now () has (at)
  Sessioning._isExpired (at, session) has (expired: true)
then
  Sessioning.end (session)
```

### Access.session.InvalidSessionIsRejected:expired-session#2

Authored path: `Access.session.InvalidSessionIsRejected`.
- Covered by [Session boundary](../design/compositions/access/session.md), line 6.

```reaction
when Sessioning.end (session), asked by Access.session.InvalidSessionIsRejected:expired-session
where
  earlier, RequestBoundary.request (requestId, session)
then
  RequestBoundary.respond (error: "UNAUTHORIZED", requestId)
```

### Access.session.InvalidSessionIsRejected:unknown-session

Authored path: `Access.session.InvalidSessionIsRejected`.
- Covered by [Session boundary](../design/compositions/access/session.md), line 6.

```reaction
when RequestBoundary.request (requestId, session)
where
  Timing._now () has (at)
  Sessioning._isExpired (at, session) has (expired: false)
  no view "the active user of (session)" with (session)
then
  RequestBoundary.respond (error: "UNAUTHORIZED", requestId)
```

### Course.assignments.Archive:forbidden

Authored path: `Course.assignments.Archive`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 7.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/archive", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.Archive:success

Authored path: `Course.assignments.Archive`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 7.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/archive", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage assignments" with (user)
then
  Assigning.archive (assignment, at)
```

### Course.assignments.Archive:success#2

Authored path: `Course.assignments.Archive`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 7.

```reaction
when Assigning.archive (assignment, at, result.assignment: archived), asked by Course.assignments.Archive:success
where
  earlier, RequestBoundary.request (assignment, path: "/assignments/archive", requestId, session)
then
  RequestBoundary.respond (assignment: archived, requestId)
```

### Course.assignments.ClaimedStudentSeatReceivesPublished

Authored path: `Course.assignments.ClaimedStudentSeatReceivesPublished`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 25.

```reaction
when Rostering.claimSeat (kind: "STUDENT", section, user)
where
  Timing._now () has (at)
  Assigning._getPublishedForAudience (audience: section) has (assignment)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: false)
then
  Assigning.assign (assignee: user, assignment, at)
```

### Course.assignments.ClearDueOverride:forbidden

Authored path: `Course.assignments.ClearDueOverride`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 10.

```reaction
when RequestBoundary.request (assignee, assignment, path: "/assignments/clear-due-override", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.ClearDueOverride:success

Authored path: `Course.assignments.ClearDueOverride`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 10.

```reaction
when RequestBoundary.request (assignee, assignment, path: "/assignments/clear-due-override", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage assignments" with (user)
then
  Assigning.clearDueOverride (assignee, assignment)
```

### Course.assignments.ClearDueOverride:success#2

Authored path: `Course.assignments.ClearDueOverride`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 10.

```reaction
when Assigning.clearDueOverride (assignee, assignment, release), asked by Course.assignments.ClearDueOverride:success
where
  earlier, RequestBoundary.request (assignee, assignment, path: "/assignments/clear-due-override", requestId, session)
then
  RequestBoundary.respond (release, requestId)
```

### Course.assignments.CreateDraft:forbidden

Authored path: `Course.assignments.CreateDraft`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 4.

```reaction
when RequestBoundary.request (acceptsSubmissions, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/create-draft", requestId, session, targets, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.CreateDraft:success

Authored path: `Course.assignments.CreateDraft`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 4.

```reaction
when RequestBoundary.request (acceptsSubmissions, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/create-draft", requestId, session, targets, title)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage assignments" with (user)
then
  Assigning.createDraft (acceptsSubmissions, at, audience, author: user, availableAt, closeAt, dueAt, instructions, kind, targets, title)
```

### Course.assignments.CreateDraft:success#2

Authored path: `Course.assignments.CreateDraft`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 4.

```reaction
when Assigning.createDraft (acceptsSubmissions, at, audience, author: user, availableAt, closeAt, dueAt, instructions, kind, targets, title, assignment), asked by Course.assignments.CreateDraft:success
where
  earlier, RequestBoundary.request (acceptsSubmissions, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/create-draft", requestId, session, targets, title)
then
  RequestBoundary.respond (assignment, requestId)
```

### Course.assignments.ForMe:forbidden

Authored path: `Course.assignments.ForMe`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 35.

```reaction
when RequestBoundary.request (path: "/assignments/for-me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.ForMe:success

Authored path: `Course.assignments.ForMe`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 35.

```reaction
when RequestBoundary.request (path: "/assignments/for-me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  RequestBoundary.respond (assignments: former "the assignments of (student)" with (student: user), requestId)
```

### Course.assignments.GetAssignment:forbidden

Authored path: `Course.assignments.GetAssignment`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 37.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.GetAssignment:found

Authored path: `Course.assignments.GetAssignment`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 37.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: true)
  Assigning._getAssignments () has (assignment, status: "PUBLISHED")
  view "the assignment (assignment)" with (assignment) has (detail)
then
  RequestBoundary.respond (assignment: detail, requestId)
```

### Course.assignments.GetAssignment:not-assigned

Authored path: `Course.assignments.GetAssignment`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 37.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: false)
then
  RequestBoundary.respond (assignment: null, requestId)
```

### Course.assignments.GetAssignment:not-published

Authored path: `Course.assignments.GetAssignment`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 37.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: true)
  no Assigning._getAssignments () has (assignment, status: "PUBLISHED")
then
  RequestBoundary.respond (assignment: null, requestId)
```

### Course.assignments.Publish:forbidden

Authored path: `Course.assignments.Publish`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 6.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/publish", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.Publish:success

Authored path: `Course.assignments.Publish`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 6.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/publish", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage assignments" with (user)
then
  Assigning.publish (assignment, at)
```

### Course.assignments.Publish:success#2

Authored path: `Course.assignments.Publish`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 6.

```reaction
when Assigning.publish (assignment, at, result.assignment: published), asked by Course.assignments.Publish:success
where
  earlier, RequestBoundary.request (assignment, path: "/assignments/publish", requestId, session)
then
  RequestBoundary.respond (assignment: published, requestId)
```

### Course.assignments.PublishedAssignmentAssignsAudienceStudents:everyone

Authored path: `Course.assignments.PublishedAssignmentAssignsAudienceStudents`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 16.

```reaction
when Assigning.publish (at, assignment, audience, targets)
where
  audience is among ["EVERYONE"]
  Rostering._getActiveStudents () has (user)
then
  Assigning.assign (assignee: user, assignment, at)
```

### Course.assignments.PublishedAssignmentAssignsAudienceStudents:targets

Authored path: `Course.assignments.PublishedAssignmentAssignsAudienceStudents`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 16.

```reaction
when Assigning.publish (at, assignment, audience, targets)
where
  audience is among ["TARGETS"]
  Rostering._getActiveStudents () has (section, user)
  section is among targets
then
  Assigning.assign (assignee: user, assignment, at)
```

### Course.assignments.ReinstatedStudentSeatReceivesPublished

Authored path: `Course.assignments.ReinstatedStudentSeatReceivesPublished`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 28.

```reaction
when Rostering.reinstateSeat (kind: "STUDENT", section, user)
where
  Timing._now () has (at)
  Assigning._getPublishedForAudience (audience: section) has (assignment)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: false)
then
  Assigning.assign (assignee: user, assignment, at)
```

### Course.assignments.Revise:forbidden

Authored path: `Course.assignments.Revise`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 5.

```reaction
when RequestBoundary.request (acceptsSubmissions, assignment, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/revise", requestId, session, targets, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.Revise:success

Authored path: `Course.assignments.Revise`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 5.

```reaction
when RequestBoundary.request (acceptsSubmissions, assignment, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/revise", requestId, session, targets, title)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage assignments" with (user)
then
  Assigning.revise (acceptsSubmissions, assignment, at, audience, availableAt, closeAt, dueAt, instructions, kind, targets, title)
```

### Course.assignments.Revise:success#2

Authored path: `Course.assignments.Revise`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 5.

```reaction
when Assigning.revise (acceptsSubmissions, assignment, at, audience, availableAt, closeAt, dueAt, instructions, kind, targets, title, result.assignment: revised), asked by Course.assignments.Revise:success
where
  earlier, RequestBoundary.request (acceptsSubmissions, assignment, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/revise", requestId, session, targets, title)
then
  RequestBoundary.respond (assignment: revised, requestId)
```

### Course.assignments.RevisedAssignmentAssignsNewAudienceStudents:everyone

Authored path: `Course.assignments.RevisedAssignmentAssignsNewAudienceStudents`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 20.

```reaction
when Assigning.revise (at, assignment, audience, status, targets)
where
  status is among ["PUBLISHED"]
  audience is among ["EVERYONE"]
  Rostering._getActiveStudents () has (user)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: false)
then
  Assigning.assign (assignee: user, assignment, at)
```

### Course.assignments.RevisedAssignmentAssignsNewAudienceStudents:targets

Authored path: `Course.assignments.RevisedAssignmentAssignsNewAudienceStudents`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 20.

```reaction
when Assigning.revise (at, assignment, audience, status, targets)
where
  status is among ["PUBLISHED"]
  audience is among ["TARGETS"]
  Rostering._getActiveStudents () has (section, user)
  section is among targets
  Assigning._isAssigned (assignee: user, assignment) has (assigned: false)
then
  Assigning.assign (assignee: user, assignment, at)
```

### Course.assignments.SetDueOverride:forbidden

Authored path: `Course.assignments.SetDueOverride`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 9.

```reaction
when RequestBoundary.request (assignee, assignment, dueAt, path: "/assignments/set-due-override", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.SetDueOverride:success

Authored path: `Course.assignments.SetDueOverride`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 9.

```reaction
when RequestBoundary.request (assignee, assignment, dueAt, path: "/assignments/set-due-override", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage assignments" with (user)
then
  Assigning.setDueOverride (assignee, assignment, dueAt)
```

### Course.assignments.SetDueOverride:success#2

Authored path: `Course.assignments.SetDueOverride`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 9.

```reaction
when Assigning.setDueOverride (assignee, assignment, dueAt, release), asked by Course.assignments.SetDueOverride:success
where
  earlier, RequestBoundary.request (assignee, assignment, dueAt, path: "/assignments/set-due-override", requestId, session)
then
  RequestBoundary.respond (release, requestId)
```

### Course.assignments.StaffList:forbidden

Authored path: `Course.assignments.StaffList`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 40.

```reaction
when RequestBoundary.request (path: "/assignments/staff-list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.StaffList:success

Authored path: `Course.assignments.StaffList`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 40.

```reaction
when RequestBoundary.request (path: "/assignments/staff-list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage assignments" with (user)
then
  RequestBoundary.respond (assignments: former "the staff assignments ()", requestId)
```

### Course.assignments.StaffSummary:forbidden

Authored path: `Course.assignments.StaffSummary`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 39.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/staff-summary", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.StaffSummary:found

Authored path: `Course.assignments.StaffSummary`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 39.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/staff-summary", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage assignments" with (user)
  view "the assignment (assignment)" with (assignment) has (detail)
then
  RequestBoundary.respond (requestId, summary: detail)
```

### Course.assignments.StaffSummary:missing

Authored path: `Course.assignments.StaffSummary`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 39.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/staff-summary", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage assignments" with (user)
  no view "the assignment (assignment)" with (assignment)
then
  RequestBoundary.respond (requestId, summary: null)
```

### Course.assignments.Submit:forbidden

Authored path: `Course.assignments.Submit`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 43.

```reaction
when RequestBoundary.request (assignment, content, path: "/assignments/submit", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.Submit:success

Authored path: `Course.assignments.Submit`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 43.

```reaction
when RequestBoundary.request (assignment, content, path: "/assignments/submit", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  Posting.create (at, author: user, content)
```

### Course.assignments.Submit:success#2

Authored path: `Course.assignments.Submit`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 43.

```reaction
when Posting.create (at, author: user, content, post), asked by Course.assignments.Submit:success
where
  earlier, RequestBoundary.request (assignment, content, path: "/assignments/submit", requestId, session)
then
  Submitting.submit (artifact: post, assignment, at, submitter: user)
```

### Course.assignments.Submit:success#3

Authored path: `Course.assignments.Submit`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 43.

```reaction
when Submitting.submit (artifact: post, assignment, at, submitter: user, submission), asked by Course.assignments.Submit:success#2
where
  earlier, RequestBoundary.request (assignment, content, path: "/assignments/submit", requestId, session)
then
  RequestBoundary.respond (requestId, submission)
```

### Course.calendar.CalendarMe:forbidden

Authored path: `Course.calendar.CalendarMe`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 5.

```reaction
when RequestBoundary.request (end, path: "/calendar/me", requestId, session, start)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.calendar.CalendarMe:success

Authored path: `Course.calendar.CalendarMe`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 5.

```reaction
when RequestBoundary.request (end, path: "/calendar/me", requestId, session, start)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  RequestBoundary.respond (events: former "the calendar between (start) and (end)" with (end, start), requestId)
```

### Course.calendar.CalendarStaff:forbidden

Authored path: `Course.calendar.CalendarStaff`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 6.

```reaction
when RequestBoundary.request (end, path: "/calendar/staff", requestId, session, start)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view the staff calendar" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.calendar.CalendarStaff:success

Authored path: `Course.calendar.CalendarStaff`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 6.

```reaction
when RequestBoundary.request (end, path: "/calendar/staff", requestId, session, start)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view the staff calendar" with (user)
then
  RequestBoundary.respond (events: former "the calendar between (start) and (end)" with (end, start), requestId)
```

### Course.calendar.LmsMe:forbidden

Authored path: `Course.calendar.LmsMe`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 10.

```reaction
when RequestBoundary.request (path: "/lms/me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.calendar.LmsMe:success

Authored path: `Course.calendar.LmsMe`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 10.

```reaction
when RequestBoundary.request (path: "/lms/me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  RequestBoundary.respond (dashboard: former "the dashboard seat of (user)" with (user), requestId)
```

### Course.calendar.LmsStaffDashboard:forbidden

Authored path: `Course.calendar.LmsStaffDashboard`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 12.

```reaction
when RequestBoundary.request (path: "/lms/staff-dashboard", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.calendar.LmsStaffDashboard:success

Authored path: `Course.calendar.LmsStaffDashboard`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 12.

```reaction
when RequestBoundary.request (path: "/lms/staff-dashboard", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  RequestBoundary.respond (counts: former "the staff dashboard counts ()", dashboard: former "the staff dashboard ()", requestId)
```

### Course.gradeItems.PublishedAcceptingAssignmentGetsGradeItem

Authored path: `Course.gradeItems.PublishedAcceptingAssignmentGetsGradeItem`.
- Covered by [Assignment grade items](../design/compositions/course/grade-items.md), line 4.

```reaction
when Assigning.publish (acceptsSubmissions: true, assignment)
where
  Assigning._getAssignments () has (assignment, title)
then
  Itemizing.ensureItem (item: assignment, label: title, maxPoints: 100)
```

### Course.gradeItems.RevisedAcceptingAssignmentEnsuresGradeItem

Authored path: `Course.gradeItems.RevisedAcceptingAssignmentEnsuresGradeItem`.
- Covered by [Assignment grade items](../design/compositions/course/grade-items.md), line 8.

```reaction
when Assigning.revise (title, acceptsSubmissions: true, assignment, status: "PUBLISHED")
then
  Itemizing.ensureItem (item: assignment, label: title, maxPoints: 100)
```

### Course.grades.GradesAddCriterion:forbidden

Authored path: `Course.grades.GradesAddCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 10.

```reaction
when RequestBoundary.request (item, maxPoints, name, path: "/grades/add-criterion", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesAddCriterion:success

Authored path: `Course.grades.GradesAddCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 10.

```reaction
when RequestBoundary.request (item, maxPoints, name, path: "/grades/add-criterion", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
then
  Itemizing.addCriterion (item, maxPoints, name, position)
```

### Course.grades.GradesAddCriterion:success#2

Authored path: `Course.grades.GradesAddCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 10.

```reaction
when Itemizing.addCriterion (item, maxPoints, name, position, criterion), asked by Course.grades.GradesAddCriterion:success
where
  earlier, RequestBoundary.request (item, maxPoints, name, path: "/grades/add-criterion", position, requestId, session)
then
  RequestBoundary.respond (criterion, requestId)
```

### Course.grades.GradesConfigureItem:forbidden

Authored path: `Course.grades.GradesConfigureItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 4.

```reaction
when RequestBoundary.request (item, label, maxPoints, path: "/grades/configure-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesConfigureItem:success

Authored path: `Course.grades.GradesConfigureItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 4.

```reaction
when RequestBoundary.request (item, label, maxPoints, path: "/grades/configure-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
then
  Itemizing.configureItem (item, label, maxPoints)
```

### Course.grades.GradesConfigureItem:success#2

Authored path: `Course.grades.GradesConfigureItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 4.

```reaction
when Itemizing.configureItem (item, label, maxPoints, gradeItem), asked by Course.grades.GradesConfigureItem:success
where
  earlier, RequestBoundary.request (item, label, maxPoints, path: "/grades/configure-item", requestId, session)
then
  RequestBoundary.respond (gradeItem, requestId)
```

### Course.grades.GradesCriterionScores:forbidden

Authored path: `Course.grades.GradesCriterionScores`.
- Covered by [Grades](../design/compositions/course/grades.md), line 17.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/criterion-scores", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view all grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesCriterionScores:success

Authored path: `Course.grades.GradesCriterionScores`.
- Covered by [Grades](../design/compositions/course/grades.md), line 17.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/criterion-scores", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view all grades" with (user)
then
  RequestBoundary.respond (requestId, scores: former "the criterion scores of (learner) on (item)" with (item, learner))
```

### Course.grades.GradesExcuse:forbidden

Authored path: `Course.grades.GradesExcuse`.
- Covered by [Grades](../design/compositions/course/grades.md), line 31.

```reaction
when RequestBoundary.request (feedback, item, learner, path: "/grades/excuse", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesExcuse:success

Authored path: `Course.grades.GradesExcuse`.
- Covered by [Grades](../design/compositions/course/grades.md), line 31.

```reaction
when RequestBoundary.request (feedback, item, learner, path: "/grades/excuse", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
then
  Grading.excuse (at, feedback, grader: user, item, learner)
```

### Course.grades.GradesExcuse:success#2

Authored path: `Course.grades.GradesExcuse`.
- Covered by [Grades](../design/compositions/course/grades.md), line 31.

```reaction
when Grading.excuse (at, feedback, grader: user, item, learner, grade), asked by Course.grades.GradesExcuse:success
where
  earlier, RequestBoundary.request (feedback, item, learner, path: "/grades/excuse", requestId, session)
then
  RequestBoundary.respond (grade, requestId)
```

### Course.grades.GradesExport:forbidden

Authored path: `Course.grades.GradesExport`.
- Covered by [Grades](../design/compositions/course/grades.md), line 47.

```reaction
when RequestBoundary.request (path: "/grades/export", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view all grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesExport:success

Authored path: `Course.grades.GradesExport`.
- Covered by [Grades](../design/compositions/course/grades.md), line 47.

```reaction
when RequestBoundary.request (path: "/grades/export", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view all grades" with (user)
then
  RequestBoundary.respond (csv: "", requestId)
```

### Course.grades.GradesForItem:forbidden

Authored path: `Course.grades.GradesForItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 40.

```reaction
when RequestBoundary.request (item, path: "/grades/for-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view all grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesForItem:success

Authored path: `Course.grades.GradesForItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 40.

```reaction
when RequestBoundary.request (item, path: "/grades/for-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view all grades" with (user)
then
  RequestBoundary.respond (grades: former "the grades on (item)" with (item), requestId)
```

### Course.grades.GradesForMe:not-student

Authored path: `Course.grades.GradesForMe`.
- Covered by [Grades](../design/compositions/course/grades.md), line 37.

```reaction
when RequestBoundary.request (path: "/grades/for-me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesForMe:success

Authored path: `Course.grades.GradesForMe`.
- Covered by [Grades](../design/compositions/course/grades.md), line 37.

```reaction
when RequestBoundary.request (path: "/grades/for-me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  RequestBoundary.respond (grades: former "the released grades of (learner)" with (learner: user), requestId)
```

### Course.grades.GradesForStudent:forbidden

Authored path: `Course.grades.GradesForStudent`.
- Covered by [Grades](../design/compositions/course/grades.md), line 38.

```reaction
when RequestBoundary.request (learner, path: "/grades/for-student", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view all grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesForStudent:success

Authored path: `Course.grades.GradesForStudent`.
- Covered by [Grades](../design/compositions/course/grades.md), line 38.

```reaction
when RequestBoundary.request (learner, path: "/grades/for-student", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view all grades" with (user)
then
  RequestBoundary.respond (grades: former "the grades of (learner)" with (learner), requestId)
```

### Course.grades.GradesGradebook:forbidden

Authored path: `Course.grades.GradesGradebook`.
- Covered by [Grades](../design/compositions/course/grades.md), line 42.

```reaction
when RequestBoundary.request (path: "/grades/gradebook", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view all grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesGradebook:success

Authored path: `Course.grades.GradesGradebook`.
- Covered by [Grades](../design/compositions/course/grades.md), line 42.

```reaction
when RequestBoundary.request (path: "/grades/gradebook", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view all grades" with (user)
then
  RequestBoundary.respond (gradebook: former "the gradebook ()", requestId)
```

### Course.grades.GradesItem:forbidden

Authored path: `Course.grades.GradesItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 7.

```reaction
when RequestBoundary.request (item, path: "/grades/item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view all grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesItem:missing

Authored path: `Course.grades.GradesItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 7.

```reaction
when RequestBoundary.request (item, path: "/grades/item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view all grades" with (user)
  no Itemizing._getItem (item)
then
  RequestBoundary.respond (error: "GRADE_ITEM_NOT_FOUND", requestId)
```

### Course.grades.GradesItem:success

Authored path: `Course.grades.GradesItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 7.

```reaction
when RequestBoundary.request (item, path: "/grades/item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view all grades" with (user)
  Itemizing._getItem (item) has (label, maxPoints, status)
then
  RequestBoundary.respond (criteria: former "the criteria of (item)" with (item), item, label, maxPoints, requestId, status)
```

### Course.grades.GradesRecord:forbidden

Authored path: `Course.grades.GradesRecord`.
- Covered by [Grades](../design/compositions/course/grades.md), line 21.

```reaction
when RequestBoundary.request (evidence, feedback, item, learner, path: "/grades/record", requestId, score, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesRecord:missing-item

Authored path: `Course.grades.GradesRecord`.
- Covered by [Grades](../design/compositions/course/grades.md), line 21.

```reaction
when RequestBoundary.request (evidence, feedback, item, learner, path: "/grades/record", requestId, score, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
  no Itemizing._getItem (item)
then
  RequestBoundary.respond (error: "GRADE_ITEM_NOT_FOUND", requestId)
```

### Course.grades.GradesRecord:success

Authored path: `Course.grades.GradesRecord`.
- Covered by [Grades](../design/compositions/course/grades.md), line 21.

```reaction
when RequestBoundary.request (evidence, feedback, item, learner, path: "/grades/record", requestId, score, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
  Itemizing._getItem (item) has (maxPoints)
then
  Grading.record (at, evidence, feedback, grader: user, item, learner, outOf: maxPoints, score)
```

### Course.grades.GradesRecord:success#2

Authored path: `Course.grades.GradesRecord`.
- Covered by [Grades](../design/compositions/course/grades.md), line 21.

```reaction
when Grading.record (at, evidence, feedback, grader: user, item, learner, outOf: maxPoints, score, grade), asked by Course.grades.GradesRecord:success
where
  earlier, RequestBoundary.request (evidence, feedback, item, learner, path: "/grades/record", requestId, score, session)
then
  RequestBoundary.respond (grade, requestId)
```

### Course.grades.GradesRelease:forbidden

Authored path: `Course.grades.GradesRelease`.
- Covered by [Grades](../design/compositions/course/grades.md), line 27.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/release", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesRelease:success

Authored path: `Course.grades.GradesRelease`.
- Covered by [Grades](../design/compositions/course/grades.md), line 27.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/release", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
then
  Grading.release (at, item, learner)
```

### Course.grades.GradesRelease:success#2

Authored path: `Course.grades.GradesRelease`.
- Covered by [Grades](../design/compositions/course/grades.md), line 27.

```reaction
when Grading.release (at, item, learner, grade), asked by Course.grades.GradesRelease:success
where
  earlier, RequestBoundary.request (item, learner, path: "/grades/release", requestId, session)
then
  RequestBoundary.respond (grade, requestId)
```

### Course.grades.GradesReleaseItem:forbidden

Authored path: `Course.grades.GradesReleaseItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 28.

```reaction
when RequestBoundary.request (item, path: "/grades/release-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesReleaseItem:success

Authored path: `Course.grades.GradesReleaseItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 28.

```reaction
when RequestBoundary.request (item, path: "/grades/release-item", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
then
  Grading.releaseItem (at, item)
```

### Course.grades.GradesReleaseItem:success#2

Authored path: `Course.grades.GradesReleaseItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 28.

```reaction
when Grading.releaseItem (at, item, released), asked by Course.grades.GradesReleaseItem:success
where
  earlier, RequestBoundary.request (item, path: "/grades/release-item", requestId, session)
then
  RequestBoundary.respond (released, requestId)
```

### Course.grades.GradesRemoveCriterion:forbidden

Authored path: `Course.grades.GradesRemoveCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 12.

```reaction
when RequestBoundary.request (criterion, path: "/grades/remove-criterion", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesRemoveCriterion:success

Authored path: `Course.grades.GradesRemoveCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 12.

```reaction
when RequestBoundary.request (criterion, path: "/grades/remove-criterion", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
then
  Itemizing.removeCriterion (criterion)
```

### Course.grades.GradesRemoveCriterion:success#2

Authored path: `Course.grades.GradesRemoveCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 12.

```reaction
when Itemizing.removeCriterion (criterion, result.criterion: removed), asked by Course.grades.GradesRemoveCriterion:success
where
  earlier, RequestBoundary.request (criterion, path: "/grades/remove-criterion", requestId, session)
then
  RequestBoundary.respond (criterion: removed, requestId)
```

### Course.grades.GradesRetract:forbidden

Authored path: `Course.grades.GradesRetract`.
- Covered by [Grades](../design/compositions/course/grades.md), line 29.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/retract", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesRetract:success

Authored path: `Course.grades.GradesRetract`.
- Covered by [Grades](../design/compositions/course/grades.md), line 29.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/retract", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
then
  Grading.retract (at, item, learner)
```

### Course.grades.GradesRetract:success#2

Authored path: `Course.grades.GradesRetract`.
- Covered by [Grades](../design/compositions/course/grades.md), line 29.

```reaction
when Grading.retract (at, item, learner, grade), asked by Course.grades.GradesRetract:success
where
  earlier, RequestBoundary.request (item, learner, path: "/grades/retract", requestId, session)
then
  RequestBoundary.respond (grade, requestId)
```

### Course.grades.GradesReviseCriterion:forbidden

Authored path: `Course.grades.GradesReviseCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 11.

```reaction
when RequestBoundary.request (criterion, maxPoints, name, path: "/grades/revise-criterion", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesReviseCriterion:success

Authored path: `Course.grades.GradesReviseCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 11.

```reaction
when RequestBoundary.request (criterion, maxPoints, name, path: "/grades/revise-criterion", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
then
  Itemizing.reviseCriterion (criterion, maxPoints, name, position)
```

### Course.grades.GradesReviseCriterion:success#2

Authored path: `Course.grades.GradesReviseCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 11.

```reaction
when Itemizing.reviseCriterion (criterion, maxPoints, name, position, result.criterion: revised), asked by Course.grades.GradesReviseCriterion:success
where
  earlier, RequestBoundary.request (criterion, maxPoints, name, path: "/grades/revise-criterion", position, requestId, session)
then
  RequestBoundary.respond (criterion: revised, requestId)
```

### Course.grades.GradesScoreCriterion:cross-item

Authored path: `Course.grades.GradesScoreCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 23.

```reaction
when RequestBoundary.request (criterion, feedback, item, learner, path: "/grades/score-criterion", points, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
  Itemizing._getCriterion (criterion) and not (item)
then
  RequestBoundary.respond (error: "CRITERION_NOT_FOUND", requestId)
```

### Course.grades.GradesScoreCriterion:forbidden

Authored path: `Course.grades.GradesScoreCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 23.

```reaction
when RequestBoundary.request (criterion, feedback, item, learner, path: "/grades/score-criterion", points, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesScoreCriterion:missing

Authored path: `Course.grades.GradesScoreCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 23.

```reaction
when RequestBoundary.request (criterion, feedback, item, learner, path: "/grades/score-criterion", points, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
  no Itemizing._getCriterion (criterion)
then
  RequestBoundary.respond (error: "CRITERION_NOT_FOUND", requestId)
```

### Course.grades.GradesScoreCriterion:success

Authored path: `Course.grades.GradesScoreCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 23.

```reaction
when RequestBoundary.request (criterion, feedback, item, learner, path: "/grades/score-criterion", points, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
  Itemizing._getCriterion (criterion) has (item, maxPoints: critMax)
then
  Grading.scoreCriterion (criterion, feedback, item, learner, outOf: critMax, points)
```

### Course.grades.GradesScoreCriterion:success#2

Authored path: `Course.grades.GradesScoreCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 23.

```reaction
when Grading.scoreCriterion (criterion, feedback, item, learner, outOf: critMax, points, criterionScore), asked by Course.grades.GradesScoreCriterion:success
where
  earlier, RequestBoundary.request (criterion, feedback, item, learner, path: "/grades/score-criterion", points, requestId, session)
then
  RequestBoundary.respond (criterionScore, requestId)
```

### Course.grades.RemovedCriterionClearsScores

Authored path: `Course.grades.RemovedCriterionClearsScores`.
- Covered by [Grades](../design/compositions/course/grades.md), line 14.

```reaction
when Itemizing.removeCriterion (criterion)
then
  Grading.clearCriterionScores (criterion)
```

### Course.lateDays.Apply:forbidden

Authored path: `Course.lateDays.Apply`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 9.

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/apply", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.Apply:success

Authored path: `Course.lateDays.Apply`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 9.

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/apply", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  Banking.apply (at, days, item: assignment, learner: user)
```

### Course.lateDays.Apply:success#2

Authored path: `Course.lateDays.Apply`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 9.

```reaction
when Banking.apply (at, days, item: assignment, learner: user, use), asked by Course.lateDays.Apply:success
where
  earlier, RequestBoundary.request (assignment, days, path: "/late-days/apply", requestId, session)
then
  RequestBoundary.respond (requestId, use)
```

### Course.lateDays.Balance:balance

Authored path: `Course.lateDays.Balance`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 14.

```reaction
when RequestBoundary.request (learner, path: "/late-days/balance", requestId, session)
where
  view "the active user of (session)" with (session) has (user: learner)
  view "(user) is an active student" with (user: learner)
then
  RequestBoundary.respond (balance: former "the late-day balance of (learner)" with (learner), requestId)
```

### Course.lateDays.Balance:balance-missing

Authored path: `Course.lateDays.Balance`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 14.

```reaction
when RequestBoundary.request (learner, path: "/late-days/balance", requestId, session)
where
  view "the active user of (session)" with (session)
  view "(user) is not an active student" with (user: learner)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.Balance:balance-unauthorized

Authored path: `Course.lateDays.Balance`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 14.

```reaction
when RequestBoundary.request (learner, path: "/late-days/balance", requestId, session)
where
  view "the active user of (session)" with (session) has (user) and not (user: learner)
  view "(user) may not manage late days" with (user)
  view "(user) is an active student" with (user: learner)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.Balance:staff-balance

Authored path: `Course.lateDays.Balance`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 14.

```reaction
when RequestBoundary.request (learner, path: "/late-days/balance", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage late days" with (user)
  view "(user) is an active student" with (user: learner)
then
  RequestBoundary.respond (balance: former "the late-day balance of (learner)" with (learner), requestId)
```

### Course.lateDays.Cancel:forbidden

Authored path: `Course.lateDays.Cancel`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 11.

```reaction
when RequestBoundary.request (assignment, path: "/late-days/cancel", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.Cancel:success

Authored path: `Course.lateDays.Cancel`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 11.

```reaction
when RequestBoundary.request (assignment, path: "/late-days/cancel", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  Banking.cancel (item: assignment, learner: user)
```

### Course.lateDays.Cancel:success#2

Authored path: `Course.lateDays.Cancel`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 11.

```reaction
when Banking.cancel (item: assignment, learner: user, use), asked by Course.lateDays.Cancel:success
where
  earlier, RequestBoundary.request (assignment, path: "/late-days/cancel", requestId, session)
then
  RequestBoundary.respond (requestId, use)
```

### Course.lateDays.Change:forbidden

Authored path: `Course.lateDays.Change`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 10.

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/change", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.Change:success

Authored path: `Course.lateDays.Change`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 10.

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/change", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  Banking.change (days, item: assignment, learner: user)
```

### Course.lateDays.Change:success#2

Authored path: `Course.lateDays.Change`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 10.

```reaction
when Banking.change (days, item: assignment, learner: user, use), asked by Course.lateDays.Change:success
where
  earlier, RequestBoundary.request (assignment, days, path: "/late-days/change", requestId, session)
then
  RequestBoundary.respond (requestId, use)
```

### Course.lateDays.ConfigurePolicy:forbidden

Authored path: `Course.lateDays.ConfigurePolicy`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 4.

```reaction
when RequestBoundary.request (defaultDays, maxDaysPerItem, path: "/late-days/configure-policy", requestId, session, unitHours)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage late days" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.ConfigurePolicy:success

Authored path: `Course.lateDays.ConfigurePolicy`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 4.

```reaction
when RequestBoundary.request (defaultDays, maxDaysPerItem, path: "/late-days/configure-policy", requestId, session, unitHours)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage late days" with (user)
then
  Banking.setTerms (allowance: defaultDays, perItemLimit: maxDaysPerItem, unitHours)
```

### Course.lateDays.ConfigurePolicy:success#2

Authored path: `Course.lateDays.ConfigurePolicy`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 4.

```reaction
when Banking.setTerms (allowance: defaultDays, perItemLimit: maxDaysPerItem, unitHours), asked by Course.lateDays.ConfigurePolicy:success
where
  earlier, RequestBoundary.request (defaultDays, maxDaysPerItem, path: "/late-days/configure-policy", requestId, session, unitHours)
then
  RequestBoundary.respond (policy: true, requestId)
```

### Course.lateDays.ForAssignment:forbidden

Authored path: `Course.lateDays.ForAssignment`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 21.

```reaction
when RequestBoundary.request (assignment, path: "/late-days/for-assignment", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage late days" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.ForAssignment:success

Authored path: `Course.lateDays.ForAssignment`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 21.

```reaction
when RequestBoundary.request (assignment, path: "/late-days/for-assignment", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage late days" with (user)
then
  RequestBoundary.respond (requestId, users: former "the late-day uses on (assignment)" with (assignment))
```

### Course.lateDays.Grant:forbidden

Authored path: `Course.lateDays.Grant`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 6.

```reaction
when RequestBoundary.request (days, learner, path: "/late-days/grant", reason, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage late days" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.Grant:success

Authored path: `Course.lateDays.Grant`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 6.

```reaction
when RequestBoundary.request (days, learner, path: "/late-days/grant", reason, requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage late days" with (user)
then
  Banking.grant (at, days, learner, reason)
```

### Course.lateDays.Grant:success#2

Authored path: `Course.lateDays.Grant`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 6.

```reaction
when Banking.grant (at, days, learner, reason, grant), asked by Course.lateDays.Grant:success
where
  earlier, RequestBoundary.request (days, learner, path: "/late-days/grant", reason, requestId, session)
then
  RequestBoundary.respond (grant, requestId)
```

### Course.lateDays.List:forbidden

Authored path: `Course.lateDays.List`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 12.

```reaction
when RequestBoundary.request (path: "/late-days/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.List:success

Authored path: `Course.lateDays.List`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 12.

```reaction
when RequestBoundary.request (path: "/late-days/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  RequestBoundary.respond (requestId, uses: former "the late-day uses of (learner)" with (learner: user))
```

### Course.lateDays.Policy:forbidden

Authored path: `Course.lateDays.Policy`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 3.

```reaction
when RequestBoundary.request (path: "/late-days/policy", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage late days" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.Policy:success

Authored path: `Course.lateDays.Policy`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 3.

```reaction
when RequestBoundary.request (path: "/late-days/policy", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage late days" with (user)
  Banking._getTerms () has (allowance: defaultDays, perItemLimit: maxDaysPerItem, unitHours)
then
  RequestBoundary.respond (defaultDays, maxDaysPerItem, requestId, unitHours)
```

### Course.lateDays.StaffCancel:hidden

Authored path: `Course.lateDays.StaffCancel`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 20.

```reaction
when RequestBoundary.request (assignment, learner, path: "/late-days/staff-cancel", requestId, session)
where
  view "the active user of (session)" with (session)
  view "(user) is not an active student" with (user: learner)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.StaffCancel:success

Authored path: `Course.lateDays.StaffCancel`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 20.

```reaction
when RequestBoundary.request (assignment, learner, path: "/late-days/staff-cancel", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage late days" with (user)
  view "(user) is an active student" with (user: learner)
then
  Banking.cancel (item: assignment, learner)
```

### Course.lateDays.StaffCancel:success#2

Authored path: `Course.lateDays.StaffCancel`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 20.

```reaction
when Banking.cancel (item: assignment, learner, use), asked by Course.lateDays.StaffCancel:success
where
  earlier, RequestBoundary.request (assignment, learner, path: "/late-days/staff-cancel", requestId, session)
then
  RequestBoundary.respond (requestId, use)
```

### Course.lateDays.StaffCancel:unauthorized

Authored path: `Course.lateDays.StaffCancel`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 20.

```reaction
when RequestBoundary.request (assignment, learner, path: "/late-days/staff-cancel", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage late days" with (user)
  view "(user) is an active student" with (user: learner)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.StaffChange:hidden

Authored path: `Course.lateDays.StaffChange`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 19.

```reaction
when RequestBoundary.request (assignment, days, learner, path: "/late-days/staff-change", requestId, session)
where
  view "the active user of (session)" with (session)
  view "(user) is not an active student" with (user: learner)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.StaffChange:success

Authored path: `Course.lateDays.StaffChange`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 19.

```reaction
when RequestBoundary.request (assignment, days, learner, path: "/late-days/staff-change", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage late days" with (user)
  view "(user) is an active student" with (user: learner)
then
  Banking.change (days, item: assignment, learner)
```

### Course.lateDays.StaffChange:success#2

Authored path: `Course.lateDays.StaffChange`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 19.

```reaction
when Banking.change (days, item: assignment, learner, use), asked by Course.lateDays.StaffChange:success
where
  earlier, RequestBoundary.request (assignment, days, learner, path: "/late-days/staff-change", requestId, session)
then
  RequestBoundary.respond (requestId, use)
```

### Course.lateDays.StaffChange:unauthorized

Authored path: `Course.lateDays.StaffChange`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 19.

```reaction
when RequestBoundary.request (assignment, days, learner, path: "/late-days/staff-change", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage late days" with (user)
  view "(user) is an active student" with (user: learner)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.notes.Acknowledge:forbidden

Authored path: `Course.notes.Acknowledge`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 18.

```reaction
when RequestBoundary.request (note, path: "/students/notes/acknowledge", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Acknowledge:success

Authored path: `Course.notes.Acknowledge`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 18.

```reaction
when RequestBoundary.request (note, path: "/students/notes/acknowledge", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  Noting.acknowledge (at, learner: user, note)
```

### Course.notes.Acknowledge:success#2

Authored path: `Course.notes.Acknowledge`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 18.

```reaction
when Noting.acknowledge (at, learner: user, note), asked by Course.notes.Acknowledge:success
where
  earlier, RequestBoundary.request (note, path: "/students/notes/acknowledge", requestId, session)
then
  RequestBoundary.respond (note, requestId)
```

### Course.notes.Archive:forbidden

Authored path: `Course.notes.Archive`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 6.

```reaction
when RequestBoundary.request (note, path: "/students/notes/archive", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Archive:success

Authored path: `Course.notes.Archive`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 6.

```reaction
when RequestBoundary.request (note, path: "/students/notes/archive", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student notes" with (user)
then
  Noting.archive (at, note)
```

### Course.notes.Archive:success#2

Authored path: `Course.notes.Archive`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 6.

```reaction
when Noting.archive (at, note), asked by Course.notes.Archive:success
where
  earlier, RequestBoundary.request (note, path: "/students/notes/archive", requestId, session)
then
  RequestBoundary.respond (note, requestId)
```

### Course.notes.NotesList:forbidden

Authored path: `Course.notes.NotesList`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 10.

```reaction
when RequestBoundary.request (learner, path: "/students/notes/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.NotesList:success

Authored path: `Course.notes.NotesList`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 10.

```reaction
when RequestBoundary.request (learner, path: "/students/notes/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student notes" with (user)
then
  RequestBoundary.respond (notes: former "the staff notes on (learner)" with (learner), requestId)
```

### Course.notes.NotesVisible:forbidden

Authored path: `Course.notes.NotesVisible`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 18.

```reaction
when RequestBoundary.request (path: "/students/notes/visible", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.NotesVisible:success

Authored path: `Course.notes.NotesVisible`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 18.

```reaction
when RequestBoundary.request (path: "/students/notes/visible", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  RequestBoundary.respond (notes: former "the notes shown to (learner)" with (learner: user), requestId)
```

### Course.notes.Resolve:forbidden

Authored path: `Course.notes.Resolve`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 5.

```reaction
when RequestBoundary.request (note, path: "/students/notes/resolve", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Resolve:success

Authored path: `Course.notes.Resolve`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 5.

```reaction
when RequestBoundary.request (note, path: "/students/notes/resolve", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student notes" with (user)
then
  Noting.resolve (at, note)
```

### Course.notes.Resolve:success#2

Authored path: `Course.notes.Resolve`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 5.

```reaction
when Noting.resolve (at, note), asked by Course.notes.Resolve:success
where
  earlier, RequestBoundary.request (note, path: "/students/notes/resolve", requestId, session)
then
  RequestBoundary.respond (note, requestId)
```

### Course.notes.Restore:forbidden

Authored path: `Course.notes.Restore`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 7.

```reaction
when RequestBoundary.request (note, path: "/students/notes/restore", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Restore:success

Authored path: `Course.notes.Restore`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 7.

```reaction
when RequestBoundary.request (note, path: "/students/notes/restore", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student notes" with (user)
then
  Noting.restore (at, note)
```

### Course.notes.Restore:success#2

Authored path: `Course.notes.Restore`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 7.

```reaction
when Noting.restore (at, note), asked by Course.notes.Restore:success
where
  earlier, RequestBoundary.request (note, path: "/students/notes/restore", requestId, session)
then
  RequestBoundary.respond (note, requestId)
```

### Course.notes.Revise:forbidden

Authored path: `Course.notes.Revise`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 4.

```reaction
when RequestBoundary.request (body, followUpAt, note, path: "/students/notes/revise", requestId, session, tags, visibility)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Revise:success

Authored path: `Course.notes.Revise`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 4.

```reaction
when RequestBoundary.request (body, followUpAt, note, path: "/students/notes/revise", requestId, session, tags, visibility)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student notes" with (user)
then
  Noting.revise (at, body, followUpAt, note, tags, visibility)
```

### Course.notes.Revise:success#2

Authored path: `Course.notes.Revise`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 4.

```reaction
when Noting.revise (at, body, followUpAt, note, tags, visibility), asked by Course.notes.Revise:success
where
  earlier, RequestBoundary.request (body, followUpAt, note, path: "/students/notes/revise", requestId, session, tags, visibility)
then
  RequestBoundary.respond (note, requestId)
```

### Course.notes.StudentsDetail:forbidden

Authored path: `Course.notes.StudentsDetail`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 13.

```reaction
when RequestBoundary.request (path: "/students/detail", requestId, session, user: target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.StudentsDetail:found

Authored path: `Course.notes.StudentsDetail`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 13.

```reaction
when RequestBoundary.request (path: "/students/detail", requestId, session, user: target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student notes" with (user)
  view "the seat detail of (user)" with (user: target) has (detail)
then
  RequestBoundary.respond (detail, requestId)
```

### Course.notes.StudentsDetail:missing

Authored path: `Course.notes.StudentsDetail`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 13.

```reaction
when RequestBoundary.request (path: "/students/detail", requestId, session, user: target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student notes" with (user)
  no view "the seat detail of (user)" with (user: target)
then
  RequestBoundary.respond (detail: null, requestId)
```

### Course.notes.Write:forbidden

Authored path: `Course.notes.Write`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 4.

```reaction
when RequestBoundary.request (body, followUpAt, learner, path: "/students/notes/write", requestId, session, tags, visibility)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Write:success

Authored path: `Course.notes.Write`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 4.

```reaction
when RequestBoundary.request (body, followUpAt, learner, path: "/students/notes/write", requestId, session, tags, visibility)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student notes" with (user)
then
  Noting.write (at, author: user, body, followUpAt, learner, tags, visibility)
```

### Course.notes.Write:success#2

Authored path: `Course.notes.Write`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 4.

```reaction
when Noting.write (at, author: user, body, followUpAt, learner, tags, visibility, note), asked by Course.notes.Write:success
where
  earlier, RequestBoundary.request (body, followUpAt, learner, path: "/students/notes/write", requestId, session, tags, visibility)
then
  RequestBoundary.respond (note, requestId)
```

### Course.roster.ClaimSeat:matched-seat

Authored path: `Course.roster.ClaimSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 18.

```reaction
when RequestBoundary.request (externalKey, path: "/roster/claim-seat", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "the seat matching (user) and (externalKey)" with (externalKey, user) has (seat)
then
  Rostering.claimSeat (seat, user)
```

### Course.roster.ClaimSeat:matched-seat#2

Authored path: `Course.roster.ClaimSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 18.

```reaction
when Rostering.claimSeat (seat, user, result.seat: claimed), asked by Course.roster.ClaimSeat:matched-seat
where
  earlier, RequestBoundary.request (externalKey, path: "/roster/claim-seat", requestId, session)
then
  RequestBoundary.respond (requestId, seat: claimed)
```

### Course.roster.ClaimSeat:missing-seat

Authored path: `Course.roster.ClaimSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 18.

```reaction
when RequestBoundary.request (externalKey, path: "/roster/claim-seat", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  no view "the seat matching (user) and (externalKey)" with (externalKey, user)
then
  RequestBoundary.respond (error: "SEAT_NOT_FOUND", requestId)
```

### Course.roster.ClassConfiguration:absent

Authored path: `Course.roster.ClassConfiguration`.
- Covered by [Roster](../design/compositions/course/roster.md), line 6.

```reaction
when RequestBoundary.request (path: "/roster/class", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
  no view "the class configuration ()"
then
  RequestBoundary.respond (class: null, requestId)
```

### Course.roster.ClassConfiguration:forbidden

Authored path: `Course.roster.ClassConfiguration`.
- Covered by [Roster](../design/compositions/course/roster.md), line 6.

```reaction
when RequestBoundary.request (path: "/roster/class", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.ClassConfiguration:found

Authored path: `Course.roster.ClassConfiguration`.
- Covered by [Roster](../design/compositions/course/roster.md), line 6.

```reaction
when RequestBoundary.request (path: "/roster/class", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
  view "the class configuration ()" has (detail)
then
  RequestBoundary.respond (class: detail, requestId)
```

### Course.roster.ConfigureClass:forbidden

Authored path: `Course.roster.ConfigureClass`.
- Covered by [Roster](../design/compositions/course/roster.md), line 4.

```reaction
when RequestBoundary.request (code, path: "/roster/configure-class", requestId, session, term, timezone, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.ConfigureClass:success

Authored path: `Course.roster.ConfigureClass`.
- Covered by [Roster](../design/compositions/course/roster.md), line 4.

```reaction
when RequestBoundary.request (code, path: "/roster/configure-class", requestId, session, term, timezone, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  Rostering.configureClass (code, term, timezone, title)
```

### Course.roster.ConfigureClass:success#2

Authored path: `Course.roster.ConfigureClass`.
- Covered by [Roster](../design/compositions/course/roster.md), line 4.

```reaction
when Rostering.configureClass (code, term, timezone, title, class), asked by Course.roster.ConfigureClass:success
where
  earlier, RequestBoundary.request (code, path: "/roster/configure-class", requestId, session, term, timezone, title)
then
  RequestBoundary.respond (class, requestId)
```

### Course.roster.DropSeat

Authored path: `Course.roster.DropSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 37.

```reaction
when RequestBoundary.request (path: "/roster/drop", requestId, seat, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Roling.requireCapability (capability: "roster:manage", context: "forum", user)
```

### Course.roster.DropSeat#2

Authored path: `Course.roster.DropSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 37.

```reaction
when Roling.requireCapability (capability: "roster:manage", context: "forum", user), asked by Course.roster.DropSeat
where
  earlier, RequestBoundary.request (path: "/roster/drop", requestId, seat, session)
then
  Rostering.dropSeat (seat)
```

### Course.roster.DropSeat#3

Authored path: `Course.roster.DropSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 37.

```reaction
when Rostering.dropSeat (seat, result.seat: dropped), asked by Course.roster.DropSeat#2
where
  earlier, RequestBoundary.request (path: "/roster/drop", requestId, seat, session)
then
  RequestBoundary.respond (requestId, seat: dropped)
```

### Course.roster.DroppedRoster:forbidden

Authored path: `Course.roster.DroppedRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 33.

```reaction
when RequestBoundary.request (path: "/roster/dropped", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.DroppedRoster:success

Authored path: `Course.roster.DroppedRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 33.

```reaction
when RequestBoundary.request (path: "/roster/dropped", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  RequestBoundary.respond (members: former "the dropped roster ()", requestId)
```

### Course.roster.DroppedStaffSeatRevokesCourseStaff

Authored path: `Course.roster.DroppedStaffSeatRevokesCourseStaff`.
- Covered by [Roster](../design/compositions/course/roster.md), line 39.

```reaction
when Rostering.dropSeat (kind: "STAFF", user: holder)
where
  Roling._getRoleByName (name: "course-staff") has (role)
  Roling._getRoles (context: "forum", user: holder) has (role)
then
  Roling.revoke (context: "forum", role, user: holder)
```

### Course.roster.ImportPreview

Authored path: `Course.roster.ImportPreview`.
- Covered by [Roster](../design/compositions/course/roster.md), line 13.

```reaction
when RequestBoundary.request (csv, path: "/roster/import-preview", requestId)
then
  Rostering.previewImport (csv)
```

### Course.roster.ImportPreview#2

Authored path: `Course.roster.ImportPreview`.
- Covered by [Roster](../design/compositions/course/roster.md), line 13.

```reaction
when Rostering.previewImport (csv, rows), asked by Course.roster.ImportPreview
where
  earlier, RequestBoundary.request (csv, path: "/roster/import-preview", requestId)
then
  RequestBoundary.respond (requestId, rows)
```

### Course.roster.ImportSeats:forbidden

Authored path: `Course.roster.ImportSeats`.
- Covered by [Roster](../design/compositions/course/roster.md), line 15.

```reaction
when RequestBoundary.request (path: "/roster/import", requestId, rows, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.ImportSeats:success

Authored path: `Course.roster.ImportSeats`.
- Covered by [Roster](../design/compositions/course/roster.md), line 15.

```reaction
when RequestBoundary.request (path: "/roster/import", requestId, rows, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  Rostering.importSeats (rows)
```

### Course.roster.ImportSeats:success#2

Authored path: `Course.roster.ImportSeats`.
- Covered by [Roster](../design/compositions/course/roster.md), line 15.

```reaction
when Rostering.importSeats (rows, created, skipped), asked by Course.roster.ImportSeats:success
where
  earlier, RequestBoundary.request (path: "/roster/import", requestId, rows, session)
then
  RequestBoundary.respond (created, requestId, skipped)
```

### Course.roster.LinkUser:forbidden

Authored path: `Course.roster.LinkUser`.
- Covered by [Roster](../design/compositions/course/roster.md), line 20.

```reaction
when RequestBoundary.request (path: "/roster/link-user", requestId, seat, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not manage the roster" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.LinkUser:success

Authored path: `Course.roster.LinkUser`.
- Covered by [Roster](../design/compositions/course/roster.md), line 20.

```reaction
when RequestBoundary.request (path: "/roster/link-user", requestId, seat, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may manage the roster" with (user: actor)
then
  Rostering.claimSeat (seat, user)
```

### Course.roster.LinkUser:success#2

Authored path: `Course.roster.LinkUser`.
- Covered by [Roster](../design/compositions/course/roster.md), line 20.

```reaction
when Rostering.claimSeat (seat, user, result.seat: linked), asked by Course.roster.LinkUser:success
where
  earlier, RequestBoundary.request (path: "/roster/link-user", requestId, seat, session, user)
then
  RequestBoundary.respond (requestId, seat: linked)
```

### Course.roster.MoveSection:forbidden

Authored path: `Course.roster.MoveSection`.
- Covered by [Roster](../design/compositions/course/roster.md), line 41.

```reaction
when RequestBoundary.request (path: "/roster/move-section", requestId, seat, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.MoveSection:success

Authored path: `Course.roster.MoveSection`.
- Covered by [Roster](../design/compositions/course/roster.md), line 41.

```reaction
when RequestBoundary.request (path: "/roster/move-section", requestId, seat, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  Rostering.moveSection (seat, section)
```

### Course.roster.MoveSection:success#2

Authored path: `Course.roster.MoveSection`.
- Covered by [Roster](../design/compositions/course/roster.md), line 41.

```reaction
when Rostering.moveSection (seat, section, result.seat: moved), asked by Course.roster.MoveSection:success
where
  earlier, RequestBoundary.request (path: "/roster/move-section", requestId, seat, section, session)
then
  RequestBoundary.respond (requestId, seat: moved)
```

### Course.roster.PendingRoster:forbidden

Authored path: `Course.roster.PendingRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 31.

```reaction
when RequestBoundary.request (path: "/roster/pending", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.PendingRoster:success

Authored path: `Course.roster.PendingRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 31.

```reaction
when RequestBoundary.request (path: "/roster/pending", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  RequestBoundary.respond (members: former "the pending roster ()", requestId)
```

### Course.roster.ReinstateSeat:forbidden

Authored path: `Course.roster.ReinstateSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 40.

```reaction
when RequestBoundary.request (path: "/roster/reinstate", requestId, seat, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.ReinstateSeat:success

Authored path: `Course.roster.ReinstateSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 40.

```reaction
when RequestBoundary.request (path: "/roster/reinstate", requestId, seat, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  Rostering.reinstateSeat (seat)
```

### Course.roster.ReinstateSeat:success#2

Authored path: `Course.roster.ReinstateSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 40.

```reaction
when Rostering.reinstateSeat (seat, result.seat: reinstated), asked by Course.roster.ReinstateSeat:success
where
  earlier, RequestBoundary.request (path: "/roster/reinstate", requestId, seat, session)
then
  RequestBoundary.respond (requestId, seat: reinstated)
```

### Course.roster.RosterList:forbidden

Authored path: `Course.roster.RosterList`.
- Covered by [Roster](../design/compositions/course/roster.md), line 29.

```reaction
when RequestBoundary.request (path: "/roster/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.RosterList:success

Authored path: `Course.roster.RosterList`.
- Covered by [Roster](../design/compositions/course/roster.md), line 29.

```reaction
when RequestBoundary.request (path: "/roster/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  RequestBoundary.respond (members: former "the roster ()", requestId)
```

### Course.roster.RosterMe:absent

Authored path: `Course.roster.RosterMe`.
- Covered by [Roster](../design/compositions/course/roster.md), line 28.

```reaction
when RequestBoundary.request (path: "/roster/me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  no view "the seat of (user)" with (user)
then
  RequestBoundary.respond (requestId, seat: null)
```

### Course.roster.RosterMe:found

Authored path: `Course.roster.RosterMe`.
- Covered by [Roster](../design/compositions/course/roster.md), line 28.

```reaction
when RequestBoundary.request (path: "/roster/me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "the seat of (user)" with (user) has (seat)
then
  RequestBoundary.respond (requestId, seat)
```

### Course.roster.SectionsCreate:forbidden

Authored path: `Course.roster.SectionsCreate`.
- Covered by [Roster](../design/compositions/course/roster.md), line 9.

```reaction
when RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/create", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.SectionsCreate:success

Authored path: `Course.roster.SectionsCreate`.
- Covered by [Roster](../design/compositions/course/roster.md), line 9.

```reaction
when RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/create", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  Rostering.createSection (location, meetingPattern, name)
```

### Course.roster.SectionsCreate:success#2

Authored path: `Course.roster.SectionsCreate`.
- Covered by [Roster](../design/compositions/course/roster.md), line 9.

```reaction
when Rostering.createSection (location, meetingPattern, name, section), asked by Course.roster.SectionsCreate:success
where
  earlier, RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/create", requestId, session)
then
  RequestBoundary.respond (requestId, section)
```

### Course.roster.SectionsList

Authored path: `Course.roster.SectionsList`.
- Covered by [Roster](../design/compositions/course/roster.md), line 7.

```reaction
when RequestBoundary.request (path: "/roster/sections/list", requestId)
then
  RequestBoundary.respond (requestId, sections: former "the sections ()")
```

### Course.roster.SectionsUpdate:forbidden

Authored path: `Course.roster.SectionsUpdate`.
- Covered by [Roster](../design/compositions/course/roster.md), line 10.

```reaction
when RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/update", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.SectionsUpdate:success

Authored path: `Course.roster.SectionsUpdate`.
- Covered by [Roster](../design/compositions/course/roster.md), line 10.

```reaction
when RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/update", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  Rostering.updateSection (location, meetingPattern, name, section)
```

### Course.roster.SectionsUpdate:success#2

Authored path: `Course.roster.SectionsUpdate`.
- Covered by [Roster](../design/compositions/course/roster.md), line 10.

```reaction
when Rostering.updateSection (location, meetingPattern, name, section, result.section: updated), asked by Course.roster.SectionsUpdate:success
where
  earlier, RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/update", requestId, section, session)
then
  RequestBoundary.respond (requestId, section: updated)
```

### Course.roster.StaffSeatGrantsCourseStaff

Authored path: `Course.roster.StaffSeatGrantsCourseStaff`.
- Covered by [Roster](../design/compositions/course/roster.md), line 24.

```reaction
when Rostering.claimSeat (user: claimer, kind: "STAFF")
where
  Roling._holdsRoleNamed (context: "forum", name: "course-staff", user: claimer) has (held: false)
then
  Roling.ensureRole (capabilities: ["roster:manage", "assignments:manage", "submissions:view-all", "grades:manage", "grades:view-all", "late-days:manage", "student-notes:manage", "calendar:view-staff"], name: "course-staff")
```

### Course.roster.StaffSeatGrantsCourseStaff#2

Authored path: `Course.roster.StaffSeatGrantsCourseStaff`.
- Covered by [Roster](../design/compositions/course/roster.md), line 24.

```reaction
when Roling.ensureRole (capabilities: ["roster:manage", "assignments:manage", "submissions:view-all", "grades:manage", "grades:view-all", "late-days:manage", "student-notes:manage", "calendar:view-staff"], name: "course-staff", role), asked by Course.roster.StaffSeatGrantsCourseStaff
where
  earlier, Rostering.claimSeat (user: claimer, kind: "STAFF")
then
  Roling.grant (context: "forum", role, user: claimer)
```

### Course.submissions.Attempts:attempts

Authored path: `Course.submissions.Attempts`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 6.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/attempts", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user: submitter)
  view "(user) is an active student" with (user: submitter)
then
  RequestBoundary.respond (attempts: former "the attempts for (assignment) by (submitter)" with (assignment, submitter), requestId)
```

### Course.submissions.Attempts:attempts-hidden

Authored path: `Course.submissions.Attempts`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 6.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/attempts", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may not view all submissions" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.Attempts:attempts-missing

Authored path: `Course.submissions.Attempts`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 6.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/attempts", requestId, session, submitter)
where
  view "the active user of (session)" with (session)
  view "(user) is not an active student" with (user: submitter)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.Attempts:staff-attempts

Authored path: `Course.submissions.Attempts`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 6.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/attempts", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may view all submissions" with (user)
  view "(user) is an active student" with (user: submitter)
then
  RequestBoundary.respond (attempts: former "the attempts for (assignment) by (submitter)" with (assignment, submitter), requestId)
```

### Course.submissions.ForAssignment:forbidden

Authored path: `Course.submissions.ForAssignment`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 14.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/for-assignment", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view all submissions" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.submissions.ForAssignment:success

Authored path: `Course.submissions.ForAssignment`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 14.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/for-assignment", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view all submissions" with (user)
then
  RequestBoundary.respond (assigned: former "the assigned population for (assignment)" with (assignment), requestId, submissions: former "the submissions for (assignment)" with (assignment))
```

### Course.submissions.ForStudent:for-student

Authored path: `Course.submissions.ForStudent`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 12.

```reaction
when RequestBoundary.request (path: "/submissions/for-student", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user: submitter)
  view "(user) is an active student" with (user: submitter)
then
  RequestBoundary.respond (requestId, submissions: former "the submissions by (submitter)" with (submitter))
```

### Course.submissions.ForStudent:for-student-hidden

Authored path: `Course.submissions.ForStudent`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 12.

```reaction
when RequestBoundary.request (path: "/submissions/for-student", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may not view all submissions" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.ForStudent:for-student-missing

Authored path: `Course.submissions.ForStudent`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 12.

```reaction
when RequestBoundary.request (path: "/submissions/for-student", requestId, session, submitter)
where
  view "the active user of (session)" with (session)
  view "(user) is not an active student" with (user: submitter)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.ForStudent:staff-for-student

Authored path: `Course.submissions.ForStudent`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 12.

```reaction
when RequestBoundary.request (path: "/submissions/for-student", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may view all submissions" with (user)
  view "(user) is an active student" with (user: submitter)
then
  RequestBoundary.respond (requestId, submissions: former "the submissions by (submitter)" with (submitter))
```

### Course.submissions.Latest:latest-hidden

Authored path: `Course.submissions.Latest`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 5.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/latest", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may not view all submissions" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.Latest:latest-missing

Authored path: `Course.submissions.Latest`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 5.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/latest", requestId, session, submitter)
where
  view "the active user of (session)" with (session)
  view "(user) is not an active student" with (user: submitter)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.Latest:self-found

Authored path: `Course.submissions.Latest`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 5.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/latest", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user: submitter)
  view "(user) is an active student" with (user: submitter)
  view "the latest submission for (assignment) by (submitter)" with (assignment, submitter) has (latest)
then
  RequestBoundary.respond (requestId, submission: latest)
```

### Course.submissions.Latest:self-missing

Authored path: `Course.submissions.Latest`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 5.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/latest", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user: submitter)
  view "(user) is an active student" with (user: submitter)
  no view "the latest submission for (assignment) by (submitter)" with (assignment, submitter)
then
  RequestBoundary.respond (requestId, submission: null)
```

### Course.submissions.Latest:staff-found

Authored path: `Course.submissions.Latest`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 5.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/latest", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may view all submissions" with (user)
  view "(user) is an active student" with (user: submitter)
  view "the latest submission for (assignment) by (submitter)" with (assignment, submitter) has (latest)
then
  RequestBoundary.respond (requestId, submission: latest)
```

### Course.submissions.Latest:staff-missing

Authored path: `Course.submissions.Latest`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 5.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/latest", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may view all submissions" with (user)
  view "(user) is an active student" with (user: submitter)
  no view "the latest submission for (assignment) by (submitter)" with (assignment, submitter)
then
  RequestBoundary.respond (requestId, submission: null)
```

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

### Forum.bookmarks.IsSaved:hidden

Authored path: `Forum.bookmarks.IsSaved`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 14.

```reaction
when RequestBoundary.request (item, path: "/bookmarks/isSaved", requestId, session)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.bookmarks.IsSaved:success

Authored path: `Forum.bookmarks.IsSaved`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 14.

```reaction
when RequestBoundary.request (item, path: "/bookmarks/isSaved", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(post) is readable" with (post: item)
  Bookmarking._isSaved (item, user) has (saved)
then
  RequestBoundary.respond (requestId, saved)
```

### Forum.bookmarks.ListBookmarks

Authored path: `Forum.bookmarks.ListBookmarks`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 10.

```reaction
when RequestBoundary.request (path: "/bookmarks/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (bookmarks: former "the bookmarks of (user)" with (user), requestId)
```

### Forum.bookmarks.PurgeClearsBookmarks

Authored path: `Forum.bookmarks.PurgeClearsBookmarks`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 18.

```reaction
when Trashing.purge (item)
then
  Bookmarking.clearItem (item)
```

### Forum.bookmarks.SaveBookmark:hidden

Authored path: `Forum.bookmarks.SaveBookmark`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/bookmarks/save", requestId, session)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.bookmarks.SaveBookmark:success

Authored path: `Forum.bookmarks.SaveBookmark`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/bookmarks/save", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(post) is readable" with (post: item)
then
  Bookmarking.save (at, item, user)
```

### Forum.bookmarks.SaveBookmark:success#2

Authored path: `Forum.bookmarks.SaveBookmark`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 4.

```reaction
when Bookmarking.save (at, item, user, bookmark), asked by Forum.bookmarks.SaveBookmark:success
where
  earlier, RequestBoundary.request (item, path: "/bookmarks/save", requestId, session)
then
  RequestBoundary.respond (bookmark, requestId)
```

### Forum.bookmarks.UnsaveBookmark:hidden

Authored path: `Forum.bookmarks.UnsaveBookmark`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/bookmarks/unsave", requestId, session)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.bookmarks.UnsaveBookmark:success

Authored path: `Forum.bookmarks.UnsaveBookmark`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/bookmarks/unsave", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(post) is readable" with (post: item)
then
  Bookmarking.unsave (item, user)
```

### Forum.bookmarks.UnsaveBookmark:success#2

Authored path: `Forum.bookmarks.UnsaveBookmark`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 4.

```reaction
when Bookmarking.unsave (item, user, bookmark), asked by Forum.bookmarks.UnsaveBookmark:success
where
  earlier, RequestBoundary.request (item, path: "/bookmarks/unsave", requestId, session)
then
  RequestBoundary.respond (bookmark, requestId)
```

### Forum.categories.AssignCategory:forbidden

Authored path: `Forum.categories.AssignCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 6.

```reaction
when RequestBoundary.request (category, item, path: "/categories/assign", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.categories.AssignCategory:hidden

Authored path: `Forum.categories.AssignCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 6.

```reaction
when RequestBoundary.request (category, item, path: "/categories/assign", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.categories.AssignCategory:success

Authored path: `Forum.categories.AssignCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 6.

```reaction
when RequestBoundary.request (category, item, path: "/categories/assign", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is readable" with (post: item)
then
  Categorizing.assign (category, item)
```

### Forum.categories.AssignCategory:success#2

Authored path: `Forum.categories.AssignCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 6.

```reaction
when Categorizing.assign (category, item, result.item: assigned), asked by Forum.categories.AssignCategory:success
where
  earlier, RequestBoundary.request (category, item, path: "/categories/assign", requestId, session)
then
  RequestBoundary.respond (item: assigned, requestId)
```

### Forum.categories.CategoryForItem:hidden

Authored path: `Forum.categories.CategoryForItem`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 15.

```reaction
when RequestBoundary.request (item, path: "/categories/forItem", requestId)
where
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.categories.CategoryForItem:success

Authored path: `Forum.categories.CategoryForItem`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 15.

```reaction
when RequestBoundary.request (item, path: "/categories/forItem", requestId)
where
  view "(post) is readable" with (post: item)
then
  RequestBoundary.respond (category: former "the category of (item)" with (item), requestId)
```

### Forum.categories.CategoryItems

Authored path: `Forum.categories.CategoryItems`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 13.

```reaction
when RequestBoundary.request (category, path: "/categories/items", requestId)
then
  RequestBoundary.respond (items: former "the items in (category)" with (category), requestId)
```

### Forum.categories.CreateCategory:forbidden

Authored path: `Forum.categories.CreateCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 4.

```reaction
when RequestBoundary.request (description, name, path: "/categories/create", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not administer" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.categories.CreateCategory:success

Authored path: `Forum.categories.CreateCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 4.

```reaction
when RequestBoundary.request (description, name, path: "/categories/create", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may administer" with (user)
then
  Categorizing.createCategory (description, name)
```

### Forum.categories.CreateCategory:success#2

Authored path: `Forum.categories.CreateCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 4.

```reaction
when Categorizing.createCategory (description, name, category), asked by Forum.categories.CreateCategory:success
where
  earlier, RequestBoundary.request (description, name, path: "/categories/create", requestId, session)
then
  RequestBoundary.respond (category, requestId)
```

### Forum.categories.DeleteCategory:forbidden

Authored path: `Forum.categories.DeleteCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 4.

```reaction
when RequestBoundary.request (category, path: "/categories/delete", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not administer" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.categories.DeleteCategory:success

Authored path: `Forum.categories.DeleteCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 4.

```reaction
when RequestBoundary.request (category, path: "/categories/delete", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may administer" with (user)
then
  Categorizing.deleteCategory (category)
```

### Forum.categories.DeleteCategory:success#2

Authored path: `Forum.categories.DeleteCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 4.

```reaction
when Categorizing.deleteCategory (category, result.category: deleted), asked by Forum.categories.DeleteCategory:success
where
  earlier, RequestBoundary.request (category, path: "/categories/delete", requestId, session)
then
  RequestBoundary.respond (category: deleted, requestId)
```

### Forum.categories.ListCategories

Authored path: `Forum.categories.ListCategories`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 11.

```reaction
when RequestBoundary.request (path: "/categories/list", requestId)
then
  RequestBoundary.respond (categories: former "the categories ()", requestId)
```

### Forum.categories.PurgeUnassignsCategory

Authored path: `Forum.categories.PurgeUnassignsCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 19.

```reaction
when Trashing.purge (item)
where
  Categorizing._getCategory (item)
then
  Categorizing.unassign (item)
```

### Forum.categories.UnassignCategory:forbidden

Authored path: `Forum.categories.UnassignCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 7.

```reaction
when RequestBoundary.request (item, path: "/categories/unassign", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.categories.UnassignCategory:hidden

Authored path: `Forum.categories.UnassignCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 7.

```reaction
when RequestBoundary.request (item, path: "/categories/unassign", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.categories.UnassignCategory:success

Authored path: `Forum.categories.UnassignCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 7.

```reaction
when RequestBoundary.request (item, path: "/categories/unassign", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is readable" with (post: item)
then
  Categorizing.unassign (item)
```

### Forum.categories.UnassignCategory:success#2

Authored path: `Forum.categories.UnassignCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 7.

```reaction
when Categorizing.unassign (item, result.item: unassigned), asked by Forum.categories.UnassignCategory:success
where
  earlier, RequestBoundary.request (item, path: "/categories/unassign", requestId, session)
then
  RequestBoundary.respond (item: unassigned, requestId)
```

### Forum.feed.GetThread

Authored path: `Forum.feed.GetThread`.
- Covered by [Feeds and thread context](../design/compositions/forum/feed.md), line 11.

```reaction
when RequestBoundary.request (conversation, path: "/threads/get", requestId)
then
  RequestBoundary.respond (context: former "the thread context (conversation)" with (conversation), requestId, thread: former "the thread (conversation)" with (conversation))
```

### Forum.feed.ListActivity

Authored path: `Forum.feed.ListActivity`.
- Covered by [Feeds and thread context](../design/compositions/forum/feed.md), line 5.

```reaction
when RequestBoundary.request (path: "/threads/activity", requestId)
then
  RequestBoundary.respond (conversations: former "the home feed by activity ()", requestId)
```

### Forum.feed.ListLatest

Authored path: `Forum.feed.ListLatest`.
- Covered by [Feeds and thread context](../design/compositions/forum/feed.md), line 3.

```reaction
when RequestBoundary.request (path: "/threads/latest", requestId)
then
  RequestBoundary.respond (conversations: former "the home feed by creation ()", requestId)
```

### Forum.links.Backlinks:hidden

Authored path: `Forum.links.Backlinks`.
- Covered by [Post links](../design/compositions/forum/links.md), line 9.

```reaction
when RequestBoundary.request (path: "/links/backlinks", requestId, target)
where
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.links.Backlinks:success

Authored path: `Forum.links.Backlinks`.
- Covered by [Post links](../design/compositions/forum/links.md), line 9.

```reaction
when RequestBoundary.request (path: "/links/backlinks", requestId, target)
where
  view "(post) is readable" with (post: target)
then
  RequestBoundary.respond (requestId, sources: former "the backlinks of (target)" with (target))
```

### Forum.links.Forward:hidden

Authored path: `Forum.links.Forward`.
- Covered by [Post links](../design/compositions/forum/links.md), line 7.

```reaction
when RequestBoundary.request (path: "/links/forward", requestId, source)
where
  view "(post) is not readable" with (post: source)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.links.Forward:success

Authored path: `Forum.links.Forward`.
- Covered by [Post links](../design/compositions/forum/links.md), line 7.

```reaction
when RequestBoundary.request (path: "/links/forward", requestId, source)
where
  view "(post) is readable" with (post: source)
then
  RequestBoundary.respond (requestId, targets: former "the forward links of (source)" with (source))
```

### Forum.moderation.FlagRaise:hidden

Authored path: `Forum.moderation.FlagRaise`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 27.

```reaction
when RequestBoundary.request (path: "/flags/raise", reason, requestId, session, target)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.FlagRaise:success

Authored path: `Forum.moderation.FlagRaise`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 27.

```reaction
when RequestBoundary.request (path: "/flags/raise", reason, requestId, session, target)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(post) is readable" with (post: target)
then
  Flagging.flag (at, reason, reporter: user, target)
```

### Forum.moderation.FlagRaise:success#2

Authored path: `Forum.moderation.FlagRaise`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 27.

```reaction
when Flagging.flag (at, reason, reporter: user, target, flag), asked by Forum.moderation.FlagRaise:success
where
  earlier, RequestBoundary.request (path: "/flags/raise", reason, requestId, session, target)
then
  RequestBoundary.respond (flag, requestId)
```

### Forum.moderation.FlagResolve:forbidden

Authored path: `Forum.moderation.FlagResolve`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 29.

```reaction
when RequestBoundary.request (outcome, path: "/flags/resolve", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.moderation.FlagResolve:hidden

Authored path: `Forum.moderation.FlagResolve`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 29.

```reaction
when RequestBoundary.request (outcome, path: "/flags/resolve", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.FlagResolve:success

Authored path: `Forum.moderation.FlagResolve`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 29.

```reaction
when RequestBoundary.request (outcome, path: "/flags/resolve", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is readable" with (post: target)
then
  Flagging.resolve (outcome, target)
```

### Forum.moderation.FlagResolve:success#2

Authored path: `Forum.moderation.FlagResolve`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 29.

```reaction
when Flagging.resolve (outcome, target), asked by Forum.moderation.FlagResolve:success
where
  earlier, RequestBoundary.request (outcome, path: "/flags/resolve", requestId, session, target)
then
  RequestBoundary.respond (requestId, target)
```

### Forum.moderation.FlagsForTarget:missing-target

Authored path: `Forum.moderation.FlagsForTarget`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 34.

```reaction
when RequestBoundary.request (path: "/flags/forTarget", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.FlagsForTarget:target

Authored path: `Forum.moderation.FlagsForTarget`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 34.

```reaction
when RequestBoundary.request (path: "/flags/forTarget", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is readable" with (post: target)
then
  RequestBoundary.respond (flags: former "the flags on (target)" with (target), requestId)
```

### Forum.moderation.FlagsForTarget:target-hidden

Authored path: `Forum.moderation.FlagsForTarget`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 34.

```reaction
when RequestBoundary.request (path: "/flags/forTarget", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.FlagsOpen:hidden

Authored path: `Forum.moderation.FlagsOpen`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 30.

```reaction
when RequestBoundary.request (path: "/flags/open", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.FlagsOpen:success

Authored path: `Forum.moderation.FlagsOpen`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 30.

```reaction
when RequestBoundary.request (path: "/flags/open", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
then
  RequestBoundary.respond (requestId, targets: former "the open flags ()")
```

### Forum.moderation.GetTrashedPost:hidden

Authored path: `Forum.moderation.GetTrashedPost`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 13.

```reaction
when RequestBoundary.request (item, path: "/moderation/posts/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.GetTrashedPost:live

Authored path: `Forum.moderation.GetTrashedPost`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 13.

```reaction
when RequestBoundary.request (item, path: "/moderation/posts/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  Posting._getPost (post: item)
  Trashing._isTrashed (item) has (trashed: false)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.GetTrashedPost:missing

Authored path: `Forum.moderation.GetTrashedPost`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 13.

```reaction
when RequestBoundary.request (item, path: "/moderation/posts/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  no Posting._getPost (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.GetTrashedPost:success

Authored path: `Forum.moderation.GetTrashedPost`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 13.

```reaction
when RequestBoundary.request (item, path: "/moderation/posts/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  Posting._getPost (post: item)
  Trashing._isTrashed (item) has (trashed: true)
then
  RequestBoundary.respond (post: former "the post (post)" with (post: item), requestId)
```

### Forum.moderation.IsLocked:hidden

Authored path: `Forum.moderation.IsLocked`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 23.

```reaction
when RequestBoundary.request (path: "/locks/isLocked", requestId, target)
where
  no view "(target) is public" with (target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.IsLocked:success

Authored path: `Forum.moderation.IsLocked`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 23.

```reaction
when RequestBoundary.request (path: "/locks/isLocked", requestId, target)
where
  view "(target) is public" with (target)
  Locking._isLocked (target) has (locked)
then
  RequestBoundary.respond (locked, requestId)
```

### Forum.moderation.IsTrashed:hidden

Authored path: `Forum.moderation.IsTrashed`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 11.

```reaction
when RequestBoundary.request (item, path: "/trash/isTrashed", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.IsTrashed:success

Authored path: `Forum.moderation.IsTrashed`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 11.

```reaction
when RequestBoundary.request (item, path: "/trash/isTrashed", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  Trashing._isTrashed (item) has (trashed)
then
  RequestBoundary.respond (requestId, trashed)
```

### Forum.moderation.LockList

Authored path: `Forum.moderation.LockList`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 22.

```reaction
when RequestBoundary.request (path: "/locks/list", requestId)
then
  RequestBoundary.respond (locked: former "the locked list ()", requestId)
```

### Forum.moderation.LockTarget:forbidden

Authored path: `Forum.moderation.LockTarget`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 18.

```reaction
when RequestBoundary.request (path: "/locks/lock", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.moderation.LockTarget:hidden

Authored path: `Forum.moderation.LockTarget`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 18.

```reaction
when RequestBoundary.request (path: "/locks/lock", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  no view "(target) is public" with (target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.LockTarget:success

Authored path: `Forum.moderation.LockTarget`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 18.

```reaction
when RequestBoundary.request (path: "/locks/lock", requestId, session, target)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(target) is public" with (target)
then
  Locking.lock (at, target)
```

### Forum.moderation.LockTarget:success#2

Authored path: `Forum.moderation.LockTarget`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 18.

```reaction
when Locking.lock (at, target), asked by Forum.moderation.LockTarget:success
where
  earlier, RequestBoundary.request (path: "/locks/lock", requestId, session, target)
then
  RequestBoundary.respond (requestId, target)
```

### Forum.moderation.PurgeItem:forbidden

Authored path: `Forum.moderation.PurgeItem`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 5.

```reaction
when RequestBoundary.request (item, path: "/trash/purge", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.moderation.PurgeItem:success

Authored path: `Forum.moderation.PurgeItem`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 5.

```reaction
when RequestBoundary.request (item, path: "/trash/purge", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
then
  Trashing.purge (item)
```

### Forum.moderation.PurgeItem:success#2

Authored path: `Forum.moderation.PurgeItem`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 5.

```reaction
when Trashing.purge (item), asked by Forum.moderation.PurgeItem:success
where
  earlier, RequestBoundary.request (item, path: "/trash/purge", requestId, session)
then
  RequestBoundary.respond (item, requestId)
```

### Forum.moderation.RestoreItem:forbidden

Authored path: `Forum.moderation.RestoreItem`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/trash/restore", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.moderation.RestoreItem:success

Authored path: `Forum.moderation.RestoreItem`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/trash/restore", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
then
  Trashing.restore (item)
```

### Forum.moderation.RestoreItem:success#2

Authored path: `Forum.moderation.RestoreItem`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 4.

```reaction
when Trashing.restore (item), asked by Forum.moderation.RestoreItem:success
where
  earlier, RequestBoundary.request (item, path: "/trash/restore", requestId, session)
then
  RequestBoundary.respond (item, requestId)
```

### Forum.moderation.TrashItem:forbidden

Authored path: `Forum.moderation.TrashItem`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/trash/trash", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.moderation.TrashItem:missing

Authored path: `Forum.moderation.TrashItem`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/trash/trash", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  no Posting._getPost (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.TrashItem:success

Authored path: `Forum.moderation.TrashItem`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/trash/trash", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  Posting._getPost (post: item)
then
  Trashing.trash (at, by: user, item)
```

### Forum.moderation.TrashItem:success#2

Authored path: `Forum.moderation.TrashItem`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 4.

```reaction
when Trashing.trash (at, by: user, item), asked by Forum.moderation.TrashItem:success
where
  earlier, RequestBoundary.request (item, path: "/trash/trash", requestId, session)
then
  RequestBoundary.respond (item, requestId)
```

### Forum.moderation.TrashList:hidden

Authored path: `Forum.moderation.TrashList`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 10.

```reaction
when RequestBoundary.request (path: "/trash/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.TrashList:success

Authored path: `Forum.moderation.TrashList`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 10.

```reaction
when RequestBoundary.request (path: "/trash/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
then
  RequestBoundary.respond (requestId, trashed: former "the trash bin ()")
```

### Forum.moderation.UnlockTarget:forbidden

Authored path: `Forum.moderation.UnlockTarget`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 19.

```reaction
when RequestBoundary.request (path: "/locks/unlock", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.moderation.UnlockTarget:hidden

Authored path: `Forum.moderation.UnlockTarget`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 19.

```reaction
when RequestBoundary.request (path: "/locks/unlock", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  no view "(target) is public" with (target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.UnlockTarget:success

Authored path: `Forum.moderation.UnlockTarget`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 19.

```reaction
when RequestBoundary.request (path: "/locks/unlock", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(target) is public" with (target)
then
  Locking.unlock (target)
```

### Forum.moderation.UnlockTarget:success#2

Authored path: `Forum.moderation.UnlockTarget`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 19.

```reaction
when Locking.unlock (target), asked by Forum.moderation.UnlockTarget:success
where
  earlier, RequestBoundary.request (path: "/locks/unlock", requestId, session, target)
then
  RequestBoundary.respond (requestId, target)
```

### Forum.notifications.AcceptNotifiesAnswerAuthor

Authored path: `Forum.notifications.AcceptNotifiesAnswerAuthor`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 22.

```reaction
when Resolving.accept (answer, at, by)
where
  Posting._getPost (post: answer) has (author: answerAuthor)
  Posting._getPost (post: answer) and not (author: by)
then
  Notifying.notify (at, kind: "accepted", link: answer, recipient: answerAuthor, subject: answer)
```

### Forum.notifications.Dismiss

Authored path: `Forum.notifications.Dismiss`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 39.

```reaction
when RequestBoundary.request (notification, path: "/notifications/dismiss", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Notifying.dismiss (notification, recipient: user)
```

### Forum.notifications.Dismiss#2

Authored path: `Forum.notifications.Dismiss`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 39.

```reaction
when Notifying.dismiss (notification, recipient: user, result.notification: dismissed), asked by Forum.notifications.Dismiss
where
  earlier, RequestBoundary.request (notification, path: "/notifications/dismiss", requestId, session)
then
  RequestBoundary.respond (notification: dismissed, requestId)
```

### Forum.notifications.EditMentionsNotify

Authored path: `Forum.notifications.EditMentionsNotify`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 16.

```reaction
when Posting.edit (at, post)
where
  view "the other users mentioned in (post)" with (post) has (user: mentioned)
  view "(user) is not yet notified about (subject)" with (subject: post, user: mentioned)
then
  Notifying.notify (at, kind: "mention", link: post, recipient: mentioned, subject: post)
```

### Forum.notifications.ListNotifications

Authored path: `Forum.notifications.ListNotifications`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 29.

```reaction
when RequestBoundary.request (path: "/notifications/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (notifications: former "the notifications of (user)" with (user), requestId)
```

### Forum.notifications.MarkAllRead

Authored path: `Forum.notifications.MarkAllRead`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 38.

```reaction
when RequestBoundary.request (path: "/notifications/markAllRead", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Notifying.markAllRead (recipient: user)
```

### Forum.notifications.MarkAllRead#2

Authored path: `Forum.notifications.MarkAllRead`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 38.

```reaction
when Notifying.markAllRead (recipient: user, result.recipient), asked by Forum.notifications.MarkAllRead
where
  earlier, RequestBoundary.request (path: "/notifications/markAllRead", requestId, session)
then
  RequestBoundary.respond (recipient, requestId)
```

### Forum.notifications.MarkRead

Authored path: `Forum.notifications.MarkRead`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 38.

```reaction
when RequestBoundary.request (notification, path: "/notifications/markRead", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Notifying.markRead (notification, recipient: user)
```

### Forum.notifications.MarkRead#2

Authored path: `Forum.notifications.MarkRead`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 38.

```reaction
when Notifying.markRead (notification, recipient: user, result.notification: marked), asked by Forum.notifications.MarkRead
where
  earlier, RequestBoundary.request (notification, path: "/notifications/markRead", requestId, session)
then
  RequestBoundary.respond (notification: marked, requestId)
```

### Forum.notifications.NotificationQueuesEmail

Authored path: `Forum.notifications.NotificationQueuesEmail`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 24.

```reaction
when Notifying.notify (at, kind, recipient, notification)
where
  Authenticating._getById (user: recipient) has (email)
  text is notificationMailText (notification)
  html is notificationMailHtml (notification)
then
  Mailing.enqueue (at, html, key: notification, recipient: email, subject: "New Commons notification", text)
```

### Forum.notifications.PurgeClearsNotifications

Authored path: `Forum.notifications.PurgeClearsNotifications`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 45.

```reaction
when Trashing.purge (item)
then
  Notifying.clearSubject (subject: item)
```

### Forum.notifications.ReadInbox

Authored path: `Forum.notifications.ReadInbox`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 31.

```reaction
when RequestBoundary.request (path: "/notifications/inbox", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (notifications: former "the inbox of (user)" with (user), requestId)
```

### Forum.notifications.ReplyMentionsNotify

Authored path: `Forum.notifications.ReplyMentionsNotify`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 14.

```reaction
when Conversing.reply (at, item, parent)
where
  view "the other users mentioned in (post)" with (post: item) has (user: mentioned)
  Conversing._getItem (node: parent) has (item: parentItem)
  Posting._getPost (post: parentItem) and not (author: mentioned)
then
  Notifying.notify (at, kind: "mention", link: item, recipient: mentioned, subject: item)
```

### Forum.notifications.ReplyNotifiesParentAuthor

Authored path: `Forum.notifications.ReplyNotifiesParentAuthor`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 3.

```reaction
when Conversing.reply (at, item, parent)
where
  Conversing._getItem (node: parent) has (item: parentItem)
  Posting._getPost (post: parentItem) has (author: parentAuthor)
  Posting._getPost (post: item) and not (author: parentAuthor)
then
  Notifying.notify (at, kind: "reply", link: item, recipient: parentAuthor, subject: item)
```

### Forum.notifications.ReplyNotifiesWatchers

Authored path: `Forum.notifications.ReplyNotifiesWatchers`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 5.

```reaction
when Conversing.reply (at, item, parent)
where
  Conversing._getConversation (node: parent) has (conversation)
  Subscribing._getSubscribers (target: conversation) has (user: subscriber)
  Posting._getPost (post: item) and not (author: subscriber)
  Conversing._getItem (node: parent) has (item: parentItem)
  Posting._getPost (post: parentItem) and not (author: subscriber)
  view "(user) is not mentioned in (post)" with (post: item, user: subscriber)
then
  Notifying.notify (at, kind: "followed_reply", link: item, recipient: subscriber, subject: item)
```

### Forum.notifications.RootMentionsNotify

Authored path: `Forum.notifications.RootMentionsNotify`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 12.

```reaction
when Conversing.start (at, item)
where
  view "the other users mentioned in (post)" with (post: item) has (user: mentioned)
then
  Notifying.notify (at, kind: "mention", link: item, recipient: mentioned, subject: item)
```

### Forum.notifications.UnreadCount

Authored path: `Forum.notifications.UnreadCount`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 34.

```reaction
when RequestBoundary.request (path: "/notifications/unreadCount", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  Notifying._getUnreadCount (recipient: user) has (count)
then
  RequestBoundary.respond (count, requestId)
```

### Forum.pins.IsPinned:hidden

Authored path: `Forum.pins.IsPinned`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 10.

```reaction
when RequestBoundary.request (item, path: "/pins/isPinned", requestId, scope)
where
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.pins.IsPinned:success

Authored path: `Forum.pins.IsPinned`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 10.

```reaction
when RequestBoundary.request (item, path: "/pins/isPinned", requestId, scope)
where
  view "(post) is readable" with (post: item)
  Pinning._isPinned (item, scope) has (pinned)
then
  RequestBoundary.respond (pinned, requestId)
```

### Forum.pins.PinItem:forbidden

Authored path: `Forum.pins.PinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/pins/pin", priority, requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not pin in (scope)" with (scope, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.pins.PinItem:hidden

Authored path: `Forum.pins.PinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/pins/pin", priority, requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may pin in (scope)" with (scope, user)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.pins.PinItem:success

Authored path: `Forum.pins.PinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/pins/pin", priority, requestId, scope, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may pin in (scope)" with (scope, user)
  view "(post) is readable" with (post: item)
then
  Pinning.pin (at, item, priority, scope)
```

### Forum.pins.PinItem:success#2

Authored path: `Forum.pins.PinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.

```reaction
when Pinning.pin (at, item, priority, scope, pin), asked by Forum.pins.PinItem:success
where
  earlier, RequestBoundary.request (item, path: "/pins/pin", priority, requestId, scope, session)
then
  RequestBoundary.respond (pin, requestId)
```

### Forum.pins.PinsForScope

Authored path: `Forum.pins.PinsForScope`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 8.

```reaction
when RequestBoundary.request (path: "/pins/forScope", requestId, scope)
then
  RequestBoundary.respond (pinned: former "the pins of (scope)" with (scope), requestId)
```

### Forum.pins.PurgeClearsPins

Authored path: `Forum.pins.PurgeClearsPins`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 15.

```reaction
when Trashing.purge (item)
then
  Pinning.clearItem (item)
```

### Forum.pins.SetPinPriority:forbidden

Authored path: `Forum.pins.SetPinPriority`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 5.

```reaction
when RequestBoundary.request (item, path: "/pins/setPriority", priority, requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not pin in (scope)" with (scope, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.pins.SetPinPriority:hidden

Authored path: `Forum.pins.SetPinPriority`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 5.

```reaction
when RequestBoundary.request (item, path: "/pins/setPriority", priority, requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may pin in (scope)" with (scope, user)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.pins.SetPinPriority:success

Authored path: `Forum.pins.SetPinPriority`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 5.

```reaction
when RequestBoundary.request (item, path: "/pins/setPriority", priority, requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may pin in (scope)" with (scope, user)
  view "(post) is readable" with (post: item)
then
  Pinning.setPriority (item, priority, scope)
```

### Forum.pins.SetPinPriority:success#2

Authored path: `Forum.pins.SetPinPriority`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 5.

```reaction
when Pinning.setPriority (item, priority, scope, pin), asked by Forum.pins.SetPinPriority:success
where
  earlier, RequestBoundary.request (item, path: "/pins/setPriority", priority, requestId, scope, session)
then
  RequestBoundary.respond (pin, requestId)
```

### Forum.pins.UnpinItem:forbidden

Authored path: `Forum.pins.UnpinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/pins/unpin", requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not pin in (scope)" with (scope, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.pins.UnpinItem:hidden

Authored path: `Forum.pins.UnpinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/pins/unpin", requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may pin in (scope)" with (scope, user)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.pins.UnpinItem:success

Authored path: `Forum.pins.UnpinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.

```reaction
when RequestBoundary.request (item, path: "/pins/unpin", requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may pin in (scope)" with (scope, user)
  view "(post) is readable" with (post: item)
then
  Pinning.unpin (item, scope)
```

### Forum.pins.UnpinItem:success#2

Authored path: `Forum.pins.UnpinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.

```reaction
when Pinning.unpin (item, scope, pin), asked by Forum.pins.UnpinItem:success
where
  earlier, RequestBoundary.request (item, path: "/pins/unpin", requestId, scope, session)
then
  RequestBoundary.respond (pin, requestId)
```

### Forum.posts.CreatedPostRefreshesDerivedContent:links

Authored path: `Forum.posts.CreatedPostRefreshesDerivedContent`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 4.

```reaction
when Posting.create (content, post)
then
  Linking.setLinksFrom (content, source: post)
```

### Forum.posts.CreatedPostRefreshesDerivedContent:render

Authored path: `Forum.posts.CreatedPostRefreshesDerivedContent`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 4.

```reaction
when Posting.create (content, post)
then
  Formatting.setSource (source: content, target: post)
```

### Forum.posts.DeletePost:delete

Authored path: `Forum.posts.DeletePost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 25.

```reaction
when RequestBoundary.request (path: "/posts/delete", post, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  Posting._getPost (post)
  Trashing._isTrashed (item: post) has (trashed: false)
  Posting._getPost (post) has (author: user)
  Conversing._getNodeByItem (item: post) has (node)
  Conversing._hasChildren (node) has (present: false)
then
  Posting.delete (post)
```

### Forum.posts.DeletePost:delete#2

Authored path: `Forum.posts.DeletePost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 25.

```reaction
when Posting.delete (post), asked by Forum.posts.DeletePost:delete
where
  earlier, RequestBoundary.request (path: "/posts/delete", post, requestId, session)
then
  RequestBoundary.respond (post, requestId)
```

### Forum.posts.DeletePost:forbidden

Authored path: `Forum.posts.DeletePost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 25.

```reaction
when RequestBoundary.request (path: "/posts/delete", post, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  Posting._getPost (post)
  Trashing._isTrashed (item: post) has (trashed: false)
  Posting._getPost (post) and not (author: user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.posts.DeletePost:has-replies

Authored path: `Forum.posts.DeletePost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 25.

```reaction
when RequestBoundary.request (path: "/posts/delete", post, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  Posting._getPost (post)
  Trashing._isTrashed (item: post) has (trashed: false)
  Posting._getPost (post) has (author: user)
  Conversing._getNodeByItem (item: post) has (node)
  Conversing._hasChildren (node) has (present: true)
then
  RequestBoundary.respond (error: "POST_HAS_REPLIES", requestId)
```

### Forum.posts.DeletePost:missing

Authored path: `Forum.posts.DeletePost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 25.

```reaction
when RequestBoundary.request (path: "/posts/delete", post, requestId, session)
where
  view "the active user of (session)" with (session)
  no Posting._getPost (post)
then
  RequestBoundary.respond (error: "POST_NOT_FOUND", requestId)
```

### Forum.posts.DeletePost:trashed

Authored path: `Forum.posts.DeletePost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 25.

```reaction
when RequestBoundary.request (path: "/posts/delete", post, requestId, session)
where
  view "the active user of (session)" with (session)
  Posting._getPost (post)
  Trashing._isTrashed (item: post) has (trashed: true)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.posts.DeletedPostClearsSatellites:backlinks

Authored path: `Forum.posts.DeletedPostClearsSatellites`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 29.

```reaction
when Posting.delete (post)
then
  Linking.clearBacklinks (target: post)
```

### Forum.posts.DeletedPostClearsSatellites:bookmarks

Authored path: `Forum.posts.DeletedPostClearsSatellites`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 29.

```reaction
when Posting.delete (post)
then
  Bookmarking.clearItem (item: post)
```

### Forum.posts.DeletedPostClearsSatellites:formatting

Authored path: `Forum.posts.DeletedPostClearsSatellites`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 29.

```reaction
when Posting.delete (post)
then
  Formatting.clear (target: post)
```

### Forum.posts.DeletedPostClearsSatellites:leaf-node

Authored path: `Forum.posts.DeletedPostClearsSatellites`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 29.

```reaction
when Posting.delete (post)
where
  Conversing._getNodeByItem (item: post) has (node)
  Conversing._hasChildren (node) has (present: false)
then
  Conversing.remove (node)
```

### Forum.posts.DeletedPostClearsSatellites:links

Authored path: `Forum.posts.DeletedPostClearsSatellites`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 29.

```reaction
when Posting.delete (post)
then
  Linking.clearLinks (source: post)
```

### Forum.posts.DeletedPostClearsSatellites:pins

Authored path: `Forum.posts.DeletedPostClearsSatellites`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 29.

```reaction
when Posting.delete (post)
then
  Pinning.clearItem (item: post)
```

### Forum.posts.DeletedPostClearsSatellites:reactions

Authored path: `Forum.posts.DeletedPostClearsSatellites`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 29.

```reaction
when Posting.delete (post)
then
  Reacting.clearTarget (target: post)
```

### Forum.posts.DeletedPostClearsSatellites:tags

Authored path: `Forum.posts.DeletedPostClearsSatellites`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 29.

```reaction
when Posting.delete (post)
then
  Tagging.clearTarget (target: post)
```

### Forum.posts.DeletedPostClearsSatellites:tracking

Authored path: `Forum.posts.DeletedPostClearsSatellites`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 29.

```reaction
when Posting.delete (post)
then
  Tracking.unregister (item: post)
```

### Forum.posts.EditPost:missing-post

Authored path: `Forum.posts.EditPost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 10.

```reaction
when RequestBoundary.request (content, path: "/posts/edit", post, requestId, session)
where
  view "the active user of (session)" with (session)
  no Posting._getPost (post)
then
  RequestBoundary.respond (error: "POST_NOT_FOUND", requestId)
```

### Forum.posts.EditPost:post

Authored path: `Forum.posts.EditPost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 10.

```reaction
when RequestBoundary.request (content, path: "/posts/edit", post, requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) may edit (post)" with (post, user)
then
  Posting.edit (at, content, post)
```

### Forum.posts.EditPost:post#2

Authored path: `Forum.posts.EditPost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 10.

```reaction
when Posting.edit (at, content, post), asked by Forum.posts.EditPost:post
where
  earlier, RequestBoundary.request (content, path: "/posts/edit", post, requestId, session)
then
  RequestBoundary.respond (post, requestId)
```

### Forum.posts.EditPost:post-forbidden

Authored path: `Forum.posts.EditPost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 10.

```reaction
when RequestBoundary.request (content, path: "/posts/edit", post, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not edit (post)" with (post, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.posts.EditPost:trashed-post

Authored path: `Forum.posts.EditPost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 10.

```reaction
when RequestBoundary.request (content, path: "/posts/edit", post, requestId, session)
where
  view "the active user of (session)" with (session)
  Trashing._isTrashed (item: post) has (trashed: true)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.posts.EditedPostRefreshesDerivedContent:links

Authored path: `Forum.posts.EditedPostRefreshesDerivedContent`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 12.

```reaction
when Posting.edit (content, post)
then
  Linking.setLinksFrom (content, source: post)
```

### Forum.posts.EditedPostRefreshesDerivedContent:render

Authored path: `Forum.posts.EditedPostRefreshesDerivedContent`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 12.

```reaction
when Posting.edit (content, post)
then
  Formatting.setSource (source: content, target: post)
```

### Forum.posts.GetPost:not-found

Authored path: `Forum.posts.GetPost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 19.

```reaction
when RequestBoundary.request (path: "/posts/get", post, requestId)
where
  view "(post) is not readable" with (post)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.posts.GetPost:success

Authored path: `Forum.posts.GetPost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 19.

```reaction
when RequestBoundary.request (path: "/posts/get", post, requestId)
where
  view "(post) is readable" with (post)
then
  RequestBoundary.respond (post: former "the post (post)" with (post), requestId)
```

### Forum.posts.PostsByAuthor

Authored path: `Forum.posts.PostsByAuthor`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 22.

```reaction
when RequestBoundary.request (author, path: "/posts/byAuthor", requestId)
then
  RequestBoundary.respond (posts: former "the public posts of (author)" with (author), requestId)
```

### Forum.profiles.GetProfile:hidden

Authored path: `Forum.profiles.GetProfile`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 3.

```reaction
when RequestBoundary.request (path: "/profiles/get", requestId, session, user)
where
  view "the active user of (session)" with (session) has (user: reader)
  no view "(user) is an active course member" with (user: reader)
  view "(user) may not manage the roster" with (user: reader)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.profiles.GetProfile:member

Authored path: `Forum.profiles.GetProfile`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 3.

```reaction
when RequestBoundary.request (path: "/profiles/get", requestId, session, user)
where
  view "the active user of (session)" with (session) has (user: reader) and not (user)
  view "(user) is an active course member" with (user: reader)
  view "(user) may not manage the roster" with (user: reader)
  view "the profile of (user)" with (user)
then
  RequestBoundary.respond (profile: former "the profile face of (user)" with (user), requestId)
```

### Forum.profiles.GetProfile:missing

Authored path: `Forum.profiles.GetProfile`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 3.

```reaction
when RequestBoundary.request (path: "/profiles/get", requestId, session, user)
where
  view "the active user of (session)" with (session)
  no view "the profile of (user)" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.profiles.GetProfile:staff

Authored path: `Forum.profiles.GetProfile`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 3.

```reaction
when RequestBoundary.request (path: "/profiles/get", requestId, session, user)
where
  view "the active user of (session)" with (session) has (user: reader) and not (user)
  view "(user) may manage the roster" with (user: reader)
  view "the profile of (user)" with (user)
then
  RequestBoundary.respond (profile: former "the private profile of (user)" with (user), requestId)
```

### Forum.profiles.GetProfile:success

Authored path: `Forum.profiles.GetProfile`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 3.

```reaction
when RequestBoundary.request (path: "/profiles/get", requestId, session, user)
where
  view "the active user of (session)" with (session) has (user)
  view "the profile of (user)" with (user)
then
  RequestBoundary.respond (profile: former "the private profile of (user)" with (user), requestId)
```

### Forum.profiles.ResolvePublicUser

Authored path: `Forum.profiles.ResolvePublicUser`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 17.

```reaction
when RequestBoundary.request (path: "/users/resolve", ref, requestId)
where
  Authenticating._resolveIdentity (ref) has (user, username)
then
  RequestBoundary.respond (requestId, user, username)
```

### Forum.profiles.SearchUsers:hidden

Authored path: `Forum.profiles.SearchUsers`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 15.

```reaction
when RequestBoundary.request (path: "/users/search", query, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  no view "(user) is an active course member" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.profiles.SearchUsers:success

Authored path: `Forum.profiles.SearchUsers`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 15.

```reaction
when RequestBoundary.request (path: "/users/search", query, requestId, session)
where
  view "the active user of (session)" with (session) has (user: queryUser)
  view "(user) is an active course member" with (user: queryUser)
then
  RequestBoundary.respond (requestId, users: former "the user search (query)" with (query))
```

### Forum.profiles.SetAvatar

Authored path: `Forum.profiles.SetAvatar`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 11.

```reaction
when RequestBoundary.request (avatar, path: "/profiles/setAvatar", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Profiling.setAvatar (avatar, user)
```

### Forum.profiles.SetAvatar#2

Authored path: `Forum.profiles.SetAvatar`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 11.

```reaction
when Profiling.setAvatar (avatar, user), asked by Forum.profiles.SetAvatar
where
  earlier, RequestBoundary.request (avatar, path: "/profiles/setAvatar", requestId, session)
then
  RequestBoundary.respond (requestId, user)
```

### Forum.profiles.SetBio

Authored path: `Forum.profiles.SetBio`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 10.

```reaction
when RequestBoundary.request (bio, path: "/profiles/setBio", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Profiling.setBio (bio, user)
```

### Forum.profiles.SetBio#2

Authored path: `Forum.profiles.SetBio`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 10.

```reaction
when Profiling.setBio (bio, user), asked by Forum.profiles.SetBio
where
  earlier, RequestBoundary.request (bio, path: "/profiles/setBio", requestId, session)
then
  RequestBoundary.respond (requestId, user)
```

### Forum.profiles.SetDisplayName

Authored path: `Forum.profiles.SetDisplayName`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 10.

```reaction
when RequestBoundary.request (displayName, path: "/profiles/setDisplayName", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Profiling.setDisplayName (displayName, user)
```

### Forum.profiles.SetDisplayName#2

Authored path: `Forum.profiles.SetDisplayName`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 10.

```reaction
when Profiling.setDisplayName (displayName, user), asked by Forum.profiles.SetDisplayName
where
  earlier, RequestBoundary.request (displayName, path: "/profiles/setDisplayName", requestId, session)
then
  RequestBoundary.respond (requestId, user)
```

### Forum.purge.PurgeClearsCoreForumState:backlinks

Authored path: `Forum.purge.PurgeClearsCoreForumState`.
- Covered by [Permanent forum cleanup](../design/compositions/forum/purge.md), line 4.

```reaction
when Trashing.purge (item)
then
  Linking.clearBacklinks (target: item)
```

### Forum.purge.PurgeClearsCoreForumState:conversation-lock

Authored path: `Forum.purge.PurgeClearsCoreForumState`.
- Covered by [Permanent forum cleanup](../design/compositions/forum/purge.md), line 4.

```reaction
when Trashing.purge (item)
where
  Conversing._getNodeByItem (item) has (node)
  no Conversing._parentOf (node)
  Conversing._getConversation (node) has (conversation)
  Locking._isLocked (target: conversation) has (locked: true)
then
  Locking.unlock (target: conversation)
```

### Forum.purge.PurgeClearsCoreForumState:flags

Authored path: `Forum.purge.PurgeClearsCoreForumState`.
- Covered by [Permanent forum cleanup](../design/compositions/forum/purge.md), line 4.

```reaction
when Trashing.purge (item)
then
  Flagging.clearTarget (target: item)
```

### Forum.purge.PurgeClearsCoreForumState:formatting

Authored path: `Forum.purge.PurgeClearsCoreForumState`.
- Covered by [Permanent forum cleanup](../design/compositions/forum/purge.md), line 4.

```reaction
when Trashing.purge (item)
then
  Formatting.clear (target: item)
```

### Forum.purge.PurgeClearsCoreForumState:item-lock

Authored path: `Forum.purge.PurgeClearsCoreForumState`.
- Covered by [Permanent forum cleanup](../design/compositions/forum/purge.md), line 4.

```reaction
when Trashing.purge (item)
where
  Locking._isLocked (target: item) has (locked: true)
then
  Locking.unlock (target: item)
```

### Forum.purge.PurgeClearsCoreForumState:leaf-node

Authored path: `Forum.purge.PurgeClearsCoreForumState`.
- Covered by [Permanent forum cleanup](../design/compositions/forum/purge.md), line 4.

```reaction
when Trashing.purge (item)
where
  no Posting._getPost (post: item)
  Conversing._getNodeByItem (item) has (node)
  Conversing._hasChildren (node) has (present: false)
then
  Conversing.remove (node)
```

### Forum.purge.PurgeClearsCoreForumState:links

Authored path: `Forum.purge.PurgeClearsCoreForumState`.
- Covered by [Permanent forum cleanup](../design/compositions/forum/purge.md), line 4.

```reaction
when Trashing.purge (item)
then
  Linking.clearLinks (source: item)
```

### Forum.purge.PurgeClearsCoreForumState:post

Authored path: `Forum.purge.PurgeClearsCoreForumState`.
- Covered by [Permanent forum cleanup](../design/compositions/forum/purge.md), line 4.

```reaction
when Trashing.purge (item)
where
  Posting._getPost (post: item)
then
  Posting.delete (post: item)
```

### Forum.purge.PurgeClearsCoreForumState:tracking

Authored path: `Forum.purge.PurgeClearsCoreForumState`.
- Covered by [Permanent forum cleanup](../design/compositions/forum/purge.md), line 4.

```reaction
when Trashing.purge (item)
then
  Tracking.unregister (item)
```

### Forum.reactions.AddReaction:hidden

Authored path: `Forum.reactions.AddReaction`.
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 4.

```reaction
when RequestBoundary.request (kind, path: "/reactions/add", requestId, session, target)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.reactions.AddReaction:success

Authored path: `Forum.reactions.AddReaction`.
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 4.

```reaction
when RequestBoundary.request (kind, path: "/reactions/add", requestId, session, target)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(post) is readable" with (post: target)
then
  Reacting.react (at, kind, reactor: user, target)
```

### Forum.reactions.AddReaction:success#2

Authored path: `Forum.reactions.AddReaction`.
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 4.

```reaction
when Reacting.react (at, kind, reactor: user, target, reaction), asked by Forum.reactions.AddReaction:success
where
  earlier, RequestBoundary.request (kind, path: "/reactions/add", requestId, session, target)
then
  RequestBoundary.respond (reaction, requestId)
```

### Forum.reactions.PurgeClearsReactions

Authored path: `Forum.reactions.PurgeClearsReactions`.
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 15.

```reaction
when Trashing.purge (item)
then
  Reacting.clearTarget (target: item)
```

### Forum.reactions.ReactionsForTarget:hidden

Authored path: `Forum.reactions.ReactionsForTarget`.
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 9.

```reaction
when RequestBoundary.request (path: "/reactions/forTarget", requestId, target)
where
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.reactions.ReactionsForTarget:success

Authored path: `Forum.reactions.ReactionsForTarget`.
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 9.

```reaction
when RequestBoundary.request (path: "/reactions/forTarget", requestId, target)
where
  view "(post) is readable" with (post: target)
then
  RequestBoundary.respond (reactions: former "the reactions on (target)" with (target), requestId)
```

### Forum.reactions.RemoveReaction:hidden

Authored path: `Forum.reactions.RemoveReaction`.
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 4.

```reaction
when RequestBoundary.request (kind, path: "/reactions/remove", requestId, session, target)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.reactions.RemoveReaction:success

Authored path: `Forum.reactions.RemoveReaction`.
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 4.

```reaction
when RequestBoundary.request (kind, path: "/reactions/remove", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(post) is readable" with (post: target)
then
  Reacting.unreact (kind, reactor: user, target)
```

### Forum.reactions.RemoveReaction:success#2

Authored path: `Forum.reactions.RemoveReaction`.
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 4.

```reaction
when Reacting.unreact (kind, reactor: user, target, reaction), asked by Forum.reactions.RemoveReaction:success
where
  earlier, RequestBoundary.request (kind, path: "/reactions/remove", requestId, session, target)
then
  RequestBoundary.respond (ok: true, requestId)
```

### Forum.resolutions.AcceptAnswer:accepted

Authored path: `Forum.resolutions.AcceptAnswer`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 4.

```reaction
when RequestBoundary.request (answer, path: "/resolutions/accept", question, requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(user) authored (post)" with (post: question, user)
  view "(post) is readable" with (post: question)
  view "(post) is readable" with (post: answer)
then
  Resolving.accept (answer, at, by: user, question)
```

### Forum.resolutions.AcceptAnswer:accepted#2

Authored path: `Forum.resolutions.AcceptAnswer`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 4.

```reaction
when Resolving.accept (answer, at, by: user, question, resolution), asked by Forum.resolutions.AcceptAnswer:accepted
where
  earlier, RequestBoundary.request (answer, path: "/resolutions/accept", question, requestId, session)
then
  RequestBoundary.respond (requestId, resolution)
```

### Forum.resolutions.AcceptAnswer:hidden-answer

Authored path: `Forum.resolutions.AcceptAnswer`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 4.

```reaction
when RequestBoundary.request (answer, path: "/resolutions/accept", question, requestId, session)
where
  view "the active user of (session)" with (session)
  view "(post) is readable" with (post: question)
  view "(post) is not readable" with (post: answer)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.resolutions.AcceptAnswer:hidden-question

Authored path: `Forum.resolutions.AcceptAnswer`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 4.

```reaction
when RequestBoundary.request (answer, path: "/resolutions/accept", question, requestId, session)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: question)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.resolutions.AcceptAnswer:not-author

Authored path: `Forum.resolutions.AcceptAnswer`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 4.

```reaction
when RequestBoundary.request (answer, path: "/resolutions/accept", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) did not author (post)" with (post: question, user)
  view "(post) is readable" with (post: question)
  view "(post) is readable" with (post: answer)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.resolutions.ClearResolution:hidden

Authored path: `Forum.resolutions.ClearResolution`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 7.

```reaction
when RequestBoundary.request (path: "/resolutions/clear", question, requestId, session)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: question)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.resolutions.ClearResolution:not-author

Authored path: `Forum.resolutions.ClearResolution`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 7.

```reaction
when RequestBoundary.request (path: "/resolutions/clear", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) did not author (post)" with (post: question, user)
  view "(post) is readable" with (post: question)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.resolutions.ClearResolution:success

Authored path: `Forum.resolutions.ClearResolution`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 7.

```reaction
when RequestBoundary.request (path: "/resolutions/clear", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) authored (post)" with (post: question, user)
  view "(post) is readable" with (post: question)
then
  Resolving.clear (question)
```

### Forum.resolutions.ClearResolution:success#2

Authored path: `Forum.resolutions.ClearResolution`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 7.

```reaction
when Resolving.clear (question, result.question: cleared), asked by Forum.resolutions.ClearResolution:success
where
  earlier, RequestBoundary.request (path: "/resolutions/clear", question, requestId, session)
then
  RequestBoundary.respond (question: cleared, requestId)
```

### Forum.resolutions.GetResolution:hidden

Authored path: `Forum.resolutions.GetResolution`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 11.

```reaction
when RequestBoundary.request (path: "/resolutions/get", question, requestId)
where
  view "(post) is not readable" with (post: question)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.resolutions.GetResolution:success

Authored path: `Forum.resolutions.GetResolution`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 11.

```reaction
when RequestBoundary.request (path: "/resolutions/get", question, requestId)
where
  view "(post) is readable" with (post: question)
then
  RequestBoundary.respond (requestId, resolution: former "the resolution of (question)" with (question))
```

### Forum.resolutions.IsResolved:hidden

Authored path: `Forum.resolutions.IsResolved`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 14.

```reaction
when RequestBoundary.request (path: "/resolutions/isResolved", question, requestId)
where
  view "(post) is not readable" with (post: question)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.resolutions.IsResolved:success

Authored path: `Forum.resolutions.IsResolved`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 14.

```reaction
when RequestBoundary.request (path: "/resolutions/isResolved", question, requestId)
where
  view "(post) is readable" with (post: question)
  Resolving._isResolved (question) has (resolved)
then
  RequestBoundary.respond (requestId, resolved)
```

### Forum.resolutions.PurgedPostClearsResolutions:answer

Authored path: `Forum.resolutions.PurgedPostClearsResolutions`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 19.

```reaction
when Trashing.purge (item)
where
  Resolving._getQuestionsAnswered (answer: item) has (question) and not (question: item)
then
  Resolving.clear (question)
```

### Forum.resolutions.PurgedPostClearsResolutions:question

Authored path: `Forum.resolutions.PurgedPostClearsResolutions`.
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 19.

```reaction
when Trashing.purge (item)
where
  Resolving._getResolution (question: item)
then
  Resolving.clear (question: item)
```

### Forum.revisions.GetRevision:hidden

Authored path: `Forum.revisions.GetRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 13.

```reaction
when RequestBoundary.request (item, number, path: "/revisions/get", requestId)
where
  Trashing._isTrashed (item) has (trashed: true)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.GetRevision:missing

Authored path: `Forum.revisions.GetRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 13.

```reaction
when RequestBoundary.request (item, number, path: "/revisions/get", requestId)
where
  no Posting._getPost (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.GetRevision:success

Authored path: `Forum.revisions.GetRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 13.

```reaction
when RequestBoundary.request (item, number, path: "/revisions/get", requestId)
where
  Posting._getPost (post: item)
  view "(item) is intact" with (item)
then
  RequestBoundary.respond (requestId, revision: former "the revision numbered (number) of (item)" with (item, number))
```

### Forum.revisions.LatestRevision:hidden

Authored path: `Forum.revisions.LatestRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 15.

```reaction
when RequestBoundary.request (item, path: "/revisions/latest", requestId)
where
  Trashing._isTrashed (item) has (trashed: true)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.LatestRevision:missing

Authored path: `Forum.revisions.LatestRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 15.

```reaction
when RequestBoundary.request (item, path: "/revisions/latest", requestId)
where
  no Posting._getPost (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.LatestRevision:success

Authored path: `Forum.revisions.LatestRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 15.

```reaction
when RequestBoundary.request (item, path: "/revisions/latest", requestId)
where
  Posting._getPost (post: item)
  view "(item) is intact" with (item)
then
  RequestBoundary.respond (requestId, revision: former "the latest revision of (item)" with (item))
```

### Forum.revisions.ListRevisions:hidden

Authored path: `Forum.revisions.ListRevisions`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 11.

```reaction
when RequestBoundary.request (item, path: "/revisions/list", requestId)
where
  Trashing._isTrashed (item) has (trashed: true)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ListRevisions:missing

Authored path: `Forum.revisions.ListRevisions`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 11.

```reaction
when RequestBoundary.request (item, path: "/revisions/list", requestId)
where
  no Posting._getPost (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ListRevisions:success

Authored path: `Forum.revisions.ListRevisions`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 11.

```reaction
when RequestBoundary.request (item, path: "/revisions/list", requestId)
where
  Posting._getPost (post: item)
  view "(item) is intact" with (item)
then
  RequestBoundary.respond (requestId, revisions: former "the revision history of (item)" with (item))
```

### Forum.revisions.ModeratorGetRevision:hidden

Authored path: `Forum.revisions.ModeratorGetRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 22.

```reaction
when RequestBoundary.request (item, number, path: "/moderation/revisions/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ModeratorGetRevision:live

Authored path: `Forum.revisions.ModeratorGetRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 22.

```reaction
when RequestBoundary.request (item, number, path: "/moderation/revisions/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  Posting._getPost (post: item)
  view "(item) is intact" with (item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ModeratorGetRevision:missing

Authored path: `Forum.revisions.ModeratorGetRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 22.

```reaction
when RequestBoundary.request (item, number, path: "/moderation/revisions/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  no Posting._getPost (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ModeratorGetRevision:revision

Authored path: `Forum.revisions.ModeratorGetRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 22.

```reaction
when RequestBoundary.request (item, number, path: "/moderation/revisions/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  Posting._getPost (post: item)
  Trashing._isTrashed (item) has (trashed: true)
then
  RequestBoundary.respond (requestId, revision: former "the revision numbered (number) of (item)" with (item, number))
```

### Forum.revisions.ModeratorLatestRevision:hidden

Authored path: `Forum.revisions.ModeratorLatestRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 24.

```reaction
when RequestBoundary.request (item, path: "/moderation/revisions/latest", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ModeratorLatestRevision:live

Authored path: `Forum.revisions.ModeratorLatestRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 24.

```reaction
when RequestBoundary.request (item, path: "/moderation/revisions/latest", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  Posting._getPost (post: item)
  view "(item) is intact" with (item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ModeratorLatestRevision:missing

Authored path: `Forum.revisions.ModeratorLatestRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 24.

```reaction
when RequestBoundary.request (item, path: "/moderation/revisions/latest", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  no Posting._getPost (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ModeratorLatestRevision:revision

Authored path: `Forum.revisions.ModeratorLatestRevision`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 24.

```reaction
when RequestBoundary.request (item, path: "/moderation/revisions/latest", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  Posting._getPost (post: item)
  Trashing._isTrashed (item) has (trashed: true)
then
  RequestBoundary.respond (requestId, revision: former "the latest revision of (item)" with (item))
```

### Forum.revisions.ModeratorListRevisions:hidden

Authored path: `Forum.revisions.ModeratorListRevisions`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 21.

```reaction
when RequestBoundary.request (item, path: "/moderation/revisions/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ModeratorListRevisions:live

Authored path: `Forum.revisions.ModeratorListRevisions`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 21.

```reaction
when RequestBoundary.request (item, path: "/moderation/revisions/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  Posting._getPost (post: item)
  view "(item) is intact" with (item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ModeratorListRevisions:missing

Authored path: `Forum.revisions.ModeratorListRevisions`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 21.

```reaction
when RequestBoundary.request (item, path: "/moderation/revisions/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  no Posting._getPost (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ModeratorListRevisions:revisions

Authored path: `Forum.revisions.ModeratorListRevisions`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 21.

```reaction
when RequestBoundary.request (item, path: "/moderation/revisions/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  Posting._getPost (post: item)
  Trashing._isTrashed (item) has (trashed: true)
then
  RequestBoundary.respond (requestId, revisions: former "the revision history of (item)" with (item))
```

### Forum.revisions.PurgeClearsRevisions

Authored path: `Forum.revisions.PurgeClearsRevisions`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 29.

```reaction
when Trashing.purge (item)
then
  Revising.clearItem (item)
```

### Forum.revisions.RecordRevisionOnCreate

Authored path: `Forum.revisions.RecordRevisionOnCreate`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 4.

```reaction
when Posting.create (at, content, post)
then
  Revising.record (at, content, item: post)
```

### Forum.revisions.RecordRevisionOnEdit

Authored path: `Forum.revisions.RecordRevisionOnEdit`.
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 6.

```reaction
when Posting.edit (at, content, post)
then
  Revising.record (at, content, item: post)
```

### Forum.subscriptions.IsSubscribed:hidden

Authored path: `Forum.subscriptions.IsSubscribed`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 10.

```reaction
when RequestBoundary.request (path: "/subscriptions/isSubscribed", requestId, session, target)
where
  view "the active user of (session)" with (session)
  no view "(conversation) is readable" with (conversation: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.subscriptions.IsSubscribed:success

Authored path: `Forum.subscriptions.IsSubscribed`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 10.

```reaction
when RequestBoundary.request (path: "/subscriptions/isSubscribed", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(conversation) is readable" with (conversation: target)
  Subscribing._isSubscribed (target, user) has (subscribed)
then
  RequestBoundary.respond (requestId, subscribed)
```

### Forum.subscriptions.MySubscriptions

Authored path: `Forum.subscriptions.MySubscriptions`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 6.

```reaction
when RequestBoundary.request (path: "/subscriptions/mine", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (requestId, subscriptions: former "the subscriptions of (user)" with (user))
```

### Forum.subscriptions.PurgeClearsConversationSubscriptions

Authored path: `Forum.subscriptions.PurgeClearsConversationSubscriptions`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 21.

```reaction
when Trashing.purge (item)
where
  Conversing._getNodeByItem (item) has (node)
  no Conversing._parentOf (node)
  Conversing._getConversation (node) has (conversation)
then
  Subscribing.clearTarget (target: conversation)
```

### Forum.subscriptions.Subscribe:hidden

Authored path: `Forum.subscriptions.Subscribe`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 4.

```reaction
when RequestBoundary.request (path: "/subscriptions/subscribe", requestId, session, target)
where
  view "the active user of (session)" with (session)
  no view "(conversation) is readable" with (conversation: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.subscriptions.Subscribe:success

Authored path: `Forum.subscriptions.Subscribe`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 4.

```reaction
when RequestBoundary.request (path: "/subscriptions/subscribe", requestId, session, target)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
  view "(conversation) is readable" with (conversation: target)
then
  Subscribing.subscribe (at, target, user)
```

### Forum.subscriptions.Subscribe:success#2

Authored path: `Forum.subscriptions.Subscribe`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 4.

```reaction
when Subscribing.subscribe (at, target, user, subscription), asked by Forum.subscriptions.Subscribe:success
where
  earlier, RequestBoundary.request (path: "/subscriptions/subscribe", requestId, session, target)
then
  RequestBoundary.respond (requestId, subscription)
```

### Forum.subscriptions.Subscribers:hidden

Authored path: `Forum.subscriptions.Subscribers`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 13.

```reaction
when RequestBoundary.request (path: "/subscriptions/subscribers", requestId, target)
where
  no view "(conversation) is readable" with (conversation: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.subscriptions.Subscribers:success

Authored path: `Forum.subscriptions.Subscribers`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 13.

```reaction
when RequestBoundary.request (path: "/subscriptions/subscribers", requestId, target)
where
  view "(conversation) is readable" with (conversation: target)
then
  RequestBoundary.respond (requestId, subscribers: former "the subscribers of (target)" with (target))
```

### Forum.subscriptions.Unsubscribe:hidden

Authored path: `Forum.subscriptions.Unsubscribe`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 4.

```reaction
when RequestBoundary.request (path: "/subscriptions/unsubscribe", requestId, session, target)
where
  view "the active user of (session)" with (session)
  no view "(conversation) is readable" with (conversation: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.subscriptions.Unsubscribe:success

Authored path: `Forum.subscriptions.Unsubscribe`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 4.

```reaction
when RequestBoundary.request (path: "/subscriptions/unsubscribe", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(conversation) is readable" with (conversation: target)
then
  Subscribing.unsubscribe (target, user)
```

### Forum.subscriptions.Unsubscribe:success#2

Authored path: `Forum.subscriptions.Unsubscribe`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 4.

```reaction
when Subscribing.unsubscribe (target, user, subscription), asked by Forum.subscriptions.Unsubscribe:success
where
  earlier, RequestBoundary.request (path: "/subscriptions/unsubscribe", requestId, session, target)
then
  RequestBoundary.respond (requestId, subscription)
```

### Forum.tags.AddTag:hidden

Authored path: `Forum.tags.AddTag`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 4.

```reaction
when RequestBoundary.request (path: "/tags/add", requestId, session, tag, target)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.tags.AddTag:success

Authored path: `Forum.tags.AddTag`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 4.

```reaction
when RequestBoundary.request (path: "/tags/add", requestId, session, tag, target)
where
  view "the active user of (session)" with (session)
  view "(post) is readable" with (post: target)
then
  Tagging.addTag (tag, target)
```

### Forum.tags.AddTag:success#2

Authored path: `Forum.tags.AddTag`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 4.

```reaction
when Tagging.addTag (tag, target, result.target: tagged), asked by Forum.tags.AddTag:success
where
  earlier, RequestBoundary.request (path: "/tags/add", requestId, session, tag, target)
then
  RequestBoundary.respond (requestId, target: tagged)
```

### Forum.tags.CreateTag

Authored path: `Forum.tags.CreateTag`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 4.

```reaction
when RequestBoundary.request (name, path: "/tags/create", requestId, session)
where
  view "the active user of (session)" with (session)
then
  Tagging.createTag (name)
```

### Forum.tags.CreateTag#2

Authored path: `Forum.tags.CreateTag`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 4.

```reaction
when Tagging.createTag (name, tag), asked by Forum.tags.CreateTag
where
  earlier, RequestBoundary.request (name, path: "/tags/create", requestId, session)
then
  RequestBoundary.respond (requestId, tag)
```

### Forum.tags.ListTags

Authored path: `Forum.tags.ListTags`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 10.

```reaction
when RequestBoundary.request (path: "/tags/list", requestId)
then
  RequestBoundary.respond (requestId, tags: former "the tags ()")
```

### Forum.tags.PurgeClearsTags

Authored path: `Forum.tags.PurgeClearsTags`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 21.

```reaction
when Trashing.purge (item)
then
  Tagging.clearTarget (target: item)
```

### Forum.tags.RemoveTag:hidden

Authored path: `Forum.tags.RemoveTag`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 5.

```reaction
when RequestBoundary.request (path: "/tags/remove", requestId, session, tag, target)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.tags.RemoveTag:success

Authored path: `Forum.tags.RemoveTag`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 5.

```reaction
when RequestBoundary.request (path: "/tags/remove", requestId, session, tag, target)
where
  view "the active user of (session)" with (session)
  view "(post) is readable" with (post: target)
then
  Tagging.removeTag (tag, target)
```

### Forum.tags.RemoveTag:success#2

Authored path: `Forum.tags.RemoveTag`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 5.

```reaction
when Tagging.removeTag (tag, target, result.target: untagged), asked by Forum.tags.RemoveTag:success
where
  earlier, RequestBoundary.request (path: "/tags/remove", requestId, session, tag, target)
then
  RequestBoundary.respond (requestId, target: untagged)
```

### Forum.tags.TagTargets

Authored path: `Forum.tags.TagTargets`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 14.

```reaction
when RequestBoundary.request (path: "/tags/targets", requestId, tag)
then
  RequestBoundary.respond (requestId, targets: former "the targets tagged (tag)" with (tag))
```

### Forum.tags.TagTargetsByName

Authored path: `Forum.tags.TagTargetsByName`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 16.

```reaction
when RequestBoundary.request (name, path: "/tags/targetsByName", requestId)
then
  RequestBoundary.respond (requestId, targets: former "the targets tagged with (name)" with (name))
```

### Forum.tags.TagsForTarget:hidden

Authored path: `Forum.tags.TagsForTarget`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 12.

```reaction
when RequestBoundary.request (path: "/tags/forTarget", requestId, target)
where
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.tags.TagsForTarget:success

Authored path: `Forum.tags.TagsForTarget`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 12.

```reaction
when RequestBoundary.request (path: "/tags/forTarget", requestId, target)
where
  view "(post) is readable" with (post: target)
then
  RequestBoundary.respond (requestId, tags: former "the tags on (target)" with (target))
```

### Forum.threads.CreateThread

Authored path: `Forum.threads.CreateThread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 3.

```reaction
when RequestBoundary.request (content, path: "/threads/create", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
then
  Posting.create (at, author: user, content)
```

### Forum.threads.CreateThread#2

Authored path: `Forum.threads.CreateThread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 3.

```reaction
when Posting.create (at, author: user, content, post), asked by Forum.threads.CreateThread
then
  Conversing.start (at, item: post)
```

### Forum.threads.CreateThread#3

Authored path: `Forum.threads.CreateThread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 3.

```reaction
when Conversing.start (at, item: post, conversation, node), asked by Forum.threads.CreateThread#2
where
  earlier, RequestBoundary.request (content, path: "/threads/create", requestId, session)
then
  RequestBoundary.respond (conversation, node, post, requestId)
```

### Forum.threads.ForItem:absent

Authored path: `Forum.threads.ForItem`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 25.

```reaction
when RequestBoundary.request (item, path: "/threads/forItem", requestId)
where
  no view "the conversation placing (item)" with (item)
then
  RequestBoundary.respond (conversation: null, requestId)
```

### Forum.threads.ForItem:found

Authored path: `Forum.threads.ForItem`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 25.

```reaction
when RequestBoundary.request (item, path: "/threads/forItem", requestId)
where
  view "the conversation placing (item)" with (item) has (conversation)
then
  RequestBoundary.respond (conversation, requestId)
```

### Forum.threads.ReplyToThread:locked

Authored path: `Forum.threads.ReplyToThread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 5.

```reaction
when RequestBoundary.request (content, parent, path: "/threads/reply", requestId, session)
where
  view "the active user of (session)" with (session)
  Conversing._getConversation (node: parent) has (conversation)
  Locking._isLocked (target: conversation) has (locked: true)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.threads.ReplyToThread:missing-parent

Authored path: `Forum.threads.ReplyToThread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 5.

```reaction
when RequestBoundary.request (content, parent, path: "/threads/reply", requestId, session)
where
  view "the active user of (session)" with (session)
  no Conversing._getConversation (node: parent)
then
  RequestBoundary.respond (error: "PARENT_NODE_NOT_FOUND", requestId)
```

### Forum.threads.ReplyToThread:reply

Authored path: `Forum.threads.ReplyToThread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 5.

```reaction
when RequestBoundary.request (content, parent, path: "/threads/reply", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  Conversing._getConversation (node: parent) has (conversation)
  Locking._isLocked (target: conversation) has (locked: false)
  Timing._now () has (at)
then
  Posting.create (at, author: user, content)
```

### Forum.threads.ReplyToThread:reply#2

Authored path: `Forum.threads.ReplyToThread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 5.

```reaction
when Posting.create (at, author: user, content, post), asked by Forum.threads.ReplyToThread:reply
where
  earlier, RequestBoundary.request (content, parent, path: "/threads/reply", requestId, session)
then
  Conversing.reply (at, item: post, parent)
```

### Forum.threads.ReplyToThread:reply#3

Authored path: `Forum.threads.ReplyToThread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 5.

```reaction
when Conversing.reply (at, item: post, parent, node), asked by Forum.threads.ReplyToThread:reply#2
where
  earlier, RequestBoundary.request (content, parent, path: "/threads/reply", requestId, session)
then
  RequestBoundary.respond (node, post, requestId)
```

### Forum.threads.TrackReplyUnread

Authored path: `Forum.threads.TrackReplyUnread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 18.

```reaction
when Conversing.reply (item, node)
where
  Conversing._getConversation (node) has (conversation)
then
  Tracking.register (item, scope: conversation)
```

### Forum.threads.TrackRootUnread

Authored path: `Forum.threads.TrackRootUnread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 16.

```reaction
when Conversing.start (item, conversation)
then
  Tracking.register (item, scope: conversation)
```

### Forum.unread.MarkAllSeen

Authored path: `Forum.unread.MarkAllSeen`.
- Covered by [Unread tracking](../design/compositions/forum/unread.md), line 11.

```reaction
when RequestBoundary.request (path: "/unread/markAllSeen", requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Tracking.markAllSeen (scope, user)
```

### Forum.unread.MarkAllSeen#2

Authored path: `Forum.unread.MarkAllSeen`.
- Covered by [Unread tracking](../design/compositions/forum/unread.md), line 11.

```reaction
when Tracking.markAllSeen (scope, user), asked by Forum.unread.MarkAllSeen
where
  earlier, RequestBoundary.request (path: "/unread/markAllSeen", requestId, scope, session)
then
  RequestBoundary.respond (requestId, user)
```

### Forum.unread.MarkSeen

Authored path: `Forum.unread.MarkSeen`.
- Covered by [Unread tracking](../design/compositions/forum/unread.md), line 9.

```reaction
when RequestBoundary.request (item, path: "/unread/markSeen", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Tracking.markSeen (item, user)
```

### Forum.unread.MarkSeen#2

Authored path: `Forum.unread.MarkSeen`.
- Covered by [Unread tracking](../design/compositions/forum/unread.md), line 9.

```reaction
when Tracking.markSeen (item, user), asked by Forum.unread.MarkSeen
where
  earlier, RequestBoundary.request (item, path: "/unread/markSeen", requestId, session)
then
  RequestBoundary.respond (item, requestId)
```

### Forum.unread.UnreadCount

Authored path: `Forum.unread.UnreadCount`.
- Covered by [Unread tracking](../design/compositions/forum/unread.md), line 4.

```reaction
when RequestBoundary.request (path: "/unread/count", requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  Tracking._getUnreadCount (scope, user) has (count)
then
  RequestBoundary.respond (count, requestId)
```

### Forum.unread.UnreadList

Authored path: `Forum.unread.UnreadList`.
- Covered by [Unread tracking](../design/compositions/forum/unread.md), line 3.

```reaction
when RequestBoundary.request (path: "/unread/list", requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (items: former "the unread of (user) in (scope)" with (scope, user), requestId)
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/assignments/archive` — requires `assignment`, `session`
- `/assignments/clear-due-override` — requires `assignee`, `assignment`, `session`
- `/assignments/create-draft` — requires `session`, `title`, `instructions`, `kind`, `availableAt`, `dueAt`, `acceptsSubmissions`, `audience`; fills `closeAt` with null when absent; fills `targets` with [] when absent
- `/assignments/for-me` — requires `session`
- `/assignments/get` — requires `assignment`, `session`
- `/assignments/publish` — requires `assignment`, `session`
- `/assignments/revise` — requires `session`, `assignment`, `title`, `instructions`, `kind`, `availableAt`, `dueAt`, `acceptsSubmissions`, `audience`; fills `closeAt` with null when absent; fills `targets` with [] when absent
- `/assignments/set-due-override` — requires `assignee`, `assignment`, `dueAt`, `session`
- `/assignments/staff-list` — requires `session`
- `/assignments/staff-summary` — requires `assignment`, `session`
- `/assignments/submit` — requires `assignment`, `content`, `session`
- `/auth/accept-invitation` — requires `displayName`, `invitation`, `password`, `temporaryPassword`, `username`
- `/auth/changePassword` — requires `session`, `oldPassword`, `newPassword`
- `/auth/login` — requires `password`, `username`
- `/auth/logout` — requires `session`
- `/auth/me` — requires `session`
- `/auth/resolve` — requires `username`
- `/bookmarks/isSaved` — requires `item`, `session`
- `/bookmarks/list` — requires `session`
- `/bookmarks/save` — requires `item`, `session`
- `/bookmarks/unsave` — requires `item`, `session`
- `/calendar/me` — requires `session`, `start`, `end`
- `/calendar/staff` — requires `session`, `start`, `end`
- `/categories/assign` — requires `category`, `item`, `session`
- `/categories/create` — requires `description`, `name`, `session`
- `/categories/delete` — requires `category`, `session`
- `/categories/forItem` — requires `item`
- `/categories/items` — requires `category`
- `/categories/unassign` — requires `item`, `session`
- `/flags/forTarget` — requires `session`, `target`
- `/flags/open` — requires `session`
- `/flags/raise` — requires `reason`, `session`, `target`
- `/flags/resolve` — requires `session`, `target`, `outcome`
- `/grades/add-criterion` — requires `item`, `maxPoints`, `name`, `position`, `session`
- `/grades/configure-item` — requires `item`, `label`, `maxPoints`, `session`
- `/grades/criterion-scores` — requires `item`, `learner`, `session`
- `/grades/excuse` — requires `feedback`, `item`, `learner`, `session`
- `/grades/export` — requires `session`
- `/grades/for-item` — requires `item`, `session`
- `/grades/for-me` — requires `session`
- `/grades/for-student` — requires `learner`, `session`
- `/grades/gradebook` — requires `session`
- `/grades/item` — requires `item`, `session`
- `/grades/record` — requires `session`, `learner`, `item`, `score`, `feedback`; fills `evidence` with null when absent
- `/grades/release` — requires `item`, `learner`, `session`
- `/grades/release-item` — requires `item`, `session`
- `/grades/remove-criterion` — requires `criterion`, `session`
- `/grades/retract` — requires `item`, `learner`, `session`
- `/grades/revise-criterion` — requires `criterion`, `maxPoints`, `name`, `position`, `session`
- `/grades/score-criterion` — requires `criterion`, `feedback`, `item`, `learner`, `points`, `session`
- `/invitations/invite` — requires `email`, `session`
- `/invitations/list` — requires `session`
- `/late-days/apply` — requires `session`, `assignment`, `days`
- `/late-days/balance` — requires `session`, `learner`
- `/late-days/cancel` — requires `session`, `assignment`
- `/late-days/change` — requires `session`, `assignment`, `days`
- `/late-days/configure-policy` — requires `session`, `defaultDays`, `unitHours`, `maxDaysPerItem`
- `/late-days/for-assignment` — requires `session`, `assignment`
- `/late-days/grant` — requires `session`, `learner`, `days`, `reason`
- `/late-days/list` — requires `session`
- `/late-days/policy` — requires `session`
- `/late-days/staff-cancel` — requires `session`, `learner`, `assignment`
- `/late-days/staff-change` — requires `session`, `learner`, `assignment`, `days`
- `/links/backlinks` — requires `target`
- `/links/forward` — requires `source`
- `/lms/me` — requires `session`
- `/lms/staff-dashboard` — requires `session`
- `/locks/isLocked` — requires `target`
- `/locks/lock` — requires `session`, `target`
- `/locks/unlock` — requires `session`, `target`
- `/moderation/posts/get` — requires `item`, `session`
- `/moderation/revisions/get` — requires `item`, `number`, `session`
- `/moderation/revisions/latest` — requires `item`, `session`
- `/moderation/revisions/list` — requires `item`, `session`
- `/notifications/dismiss` — requires `notification`, `session`
- `/notifications/inbox` — requires `session`
- `/notifications/list` — requires `session`
- `/notifications/markAllRead` — requires `session`
- `/notifications/markRead` — requires `notification`, `session`
- `/notifications/unreadCount` — requires `session`
- `/pins/forScope` — requires `scope`
- `/pins/isPinned` — requires `item`, `scope`
- `/pins/pin` — requires `session`, `item`, `scope`, `priority`
- `/pins/setPriority` — requires `session`, `item`, `scope`, `priority`
- `/pins/unpin` — requires `session`, `item`, `scope`
- `/posts/byAuthor` — requires `author`
- `/posts/delete` — requires `session`, `post`
- `/posts/edit` — requires `session`, `post`, `content`
- `/posts/get` — requires `post`
- `/profiles/get` — requires `session`, `user`
- `/profiles/setAvatar` — requires `session`, `avatar`
- `/profiles/setBio` — requires `session`, `bio`
- `/profiles/setDisplayName` — requires `session`, `displayName`
- `/reactions/add` — requires `session`, `target`, `kind`
- `/reactions/forTarget` — requires `target`
- `/reactions/remove` — requires `kind`, `session`, `target`
- `/resolutions/accept` — requires `answer`, `question`, `session`
- `/resolutions/clear` — requires `question`, `session`
- `/resolutions/get` — requires `question`
- `/resolutions/isResolved` — requires `question`
- `/revisions/get` — requires `item`, `number`
- `/revisions/latest` — requires `item`
- `/revisions/list` — requires `item`
- `/roles/can` — requires `capability`, `context`, `user`
- `/roles/define` — requires `capabilities`, `name`, `session`
- `/roles/forUser` — requires `context`, `user`
- `/roles/get` — requires `role`
- `/roles/grant` — requires `context`, `role`, `session`, `user`
- `/roles/revoke` — requires `context`, `role`, `session`, `user`
- `/roster/claim-seat` — requires `externalKey`, `session`
- `/roster/class` — requires `session`
- `/roster/configure-class` — requires `code`, `session`, `term`, `timezone`, `title`
- `/roster/drop` — requires `seat`, `session`
- `/roster/dropped` — requires `session`
- `/roster/import` — requires `rows`, `session`
- `/roster/import-preview` — requires `csv`
- `/roster/link-user` — requires `seat`, `session`, `user`
- `/roster/list` — requires `session`
- `/roster/me` — requires `session`
- `/roster/move-section` — requires `seat`, `section`, `session`
- `/roster/pending` — requires `session`
- `/roster/reinstate` — requires `seat`, `session`
- `/roster/sections/create` — requires `session`, `name`; fills `location` with null when absent; fills `meetingPattern` with null when absent
- `/roster/sections/update` — requires `location`, `meetingPattern`, `name`, `section`, `session`
- `/setup/register-admin` — requires `displayName`, `email`, `password`, `setupSecret`, `username`
- `/students/detail` — requires `session`, `user`
- `/students/notes/acknowledge` — requires `session`, `note`
- `/students/notes/archive` — requires `session`, `note`
- `/students/notes/list` — requires `session`, `learner`
- `/students/notes/resolve` — requires `session`, `note`
- `/students/notes/restore` — requires `session`, `note`
- `/students/notes/revise` — requires `session`, `note`, `body`, `visibility`, `tags`, `followUpAt`
- `/students/notes/visible` — requires `session`
- `/students/notes/write` — requires `session`, `learner`, `body`, `visibility`, `tags`, `followUpAt`
- `/submissions/attempts` — requires `assignment`, `session`, `submitter`
- `/submissions/for-assignment` — requires `assignment`, `session`
- `/submissions/for-student` — requires `session`, `submitter`
- `/submissions/latest` — requires `assignment`, `session`, `submitter`
- `/subscriptions/isSubscribed` — requires `session`, `target`
- `/subscriptions/mine` — requires `session`
- `/subscriptions/subscribe` — requires `session`, `target`
- `/subscriptions/subscribers` — requires `target`
- `/subscriptions/unsubscribe` — requires `session`, `target`
- `/tags/add` — requires `session`, `tag`, `target`
- `/tags/create` — requires `session`, `name`
- `/tags/forTarget` — requires `target`
- `/tags/remove` — requires `session`, `tag`, `target`
- `/tags/targets` — requires `tag`
- `/tags/targetsByName` — requires `name`
- `/threads/create` — requires `content`, `session`
- `/threads/forItem` — requires `item`
- `/threads/get` — requires `conversation`
- `/threads/reply` — requires `content`, `parent`, `session`
- `/trash/isTrashed` — requires `item`, `session`
- `/trash/list` — requires `session`
- `/trash/purge` — requires `item`, `session`
- `/trash/restore` — requires `item`, `session`
- `/trash/trash` — requires `item`, `session`
- `/unread/count` — requires `session`, `scope`
- `/unread/list` — requires `session`, `scope`
- `/unread/markAllSeen` — requires `session`, `scope`
- `/unread/markSeen` — requires `session`, `item`
- `/users/resolve` — requires `ref`
- `/users/search` — requires `session`, `query`
