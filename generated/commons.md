<!-- Generated from the Commons assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.0.0-beta.9; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.0.0-beta.9. -->

# Commons — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Assigning

**Purpose.** Let an author draft an assignment, publish it to everyone or selected sections,
and give each assignee a release with an optional individual due date.

**Principle.** Dana drafts a problem set for two sections and publishes it. Priya and Omar
each receive a release. Dana gives Omar a later due date, then clears that
override. Assigning the problem set to Omar again is refused because he already
has a release. After Dana archives the problem set, it can no longer be revised.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `createDraft (author: Author, title: String, instructions: String, kind: String, availableAt: Date, dueAt: Date, closeAt: Date, acceptsSubmissions: Bool, audience: String, targets: Sections, at: Date) : return (assignment: Assignment)`

**Authored behavior:**

    where audience suits targets
    then
      add a new assignment with author, title, instructions, kind, availableAt, dueAt, closeAt, acceptsSubmissions, audience, and targets
      set assignment's createdAt to at
      add assignment to draft
      return assignment
    where audience is everyone and targets is not empty
    then
      refuse ASSIGNMENT_EVERYONE_NO_TARGETS "An assignment addressed to everyone cannot list targets."
    where audience is targets and targets is empty
    then
      refuse ASSIGNMENT_TARGETS_REQUIRED "A targeted assignment needs at least one target."
    where audience is not everyone and audience is not targets
    then
      refuse ASSIGNMENT_AUDIENCE_INVALID "The assignment audience must be EVERYONE or TARGETS."

**Registered refusal codes:** `ASSIGNMENT_EVERYONE_NO_TARGETS`, `ASSIGNMENT_TARGETS_REQUIRED`, `ASSIGNMENT_AUDIENCE_INVALID`

##### `revise (assignment: Assignment, title: String, instructions: String, kind: String, availableAt: Date, dueAt: Date, closeAt: Date, acceptsSubmissions: Bool, audience: String, targets: Sections, at: Date) : return (assignment: Assignment, status: String, audience: String, targets: Sections, acceptsSubmissions: Bool)`

**Authored behavior:**

    where assignment in assignments, assignment not in archived, and audience suits targets
    then
      set assignment's title, instructions, kind, availableAt, dueAt, closeAt, acceptsSubmissions, audience, and targets from the inputs
      set assignment's updatedAt to at
      return assignment, its status, audience, targets, and acceptsSubmissions
    where assignment not in assignments
    then
      refuse ASSIGNMENT_NOT_FOUND "There is no such assignment."
    where assignment in archived
    then
      refuse ASSIGNMENT_NOT_REVISABLE "An archived assignment can no longer be revised."
    where audience is everyone and targets is not empty
    then
      refuse ASSIGNMENT_EVERYONE_NO_TARGETS "An assignment addressed to everyone cannot list targets."
    where audience is targets and targets is empty
    then
      refuse ASSIGNMENT_TARGETS_REQUIRED "A targeted assignment needs at least one target."
    where audience is not everyone and audience is not targets
    then
      refuse ASSIGNMENT_AUDIENCE_INVALID "The assignment audience must be EVERYONE or TARGETS."

**Registered refusal codes:** `ASSIGNMENT_NOT_FOUND`, `ASSIGNMENT_NOT_REVISABLE`, `ASSIGNMENT_EVERYONE_NO_TARGETS`, `ASSIGNMENT_TARGETS_REQUIRED`, `ASSIGNMENT_AUDIENCE_INVALID`

##### `publish (assignment: Assignment, at: Date) : return (assignment: Assignment, audience: String, targets: Sections, acceptsSubmissions: Bool)`

**Authored behavior:**

    where assignment in draft
    then
      remove assignment from draft
      add assignment to published
      set assignment's updatedAt to at
      return assignment, its audience, targets, and acceptsSubmissions
    where assignment not in assignments
    then
      refuse ASSIGNMENT_NOT_FOUND "There is no such assignment."
    where assignment in assignments and assignment not in draft
    then
      refuse ASSIGNMENT_NOT_DRAFT "Only a draft can be published."

**Registered refusal codes:** `ASSIGNMENT_NOT_FOUND`, `ASSIGNMENT_NOT_DRAFT`

##### `archive (assignment: Assignment, at: Date) : return ()`

**Authored behavior:**

    where assignment in assignments
    then
      remove assignment from draft and from published
      add assignment to archived
      set assignment's updatedAt to at
      return
    where assignment not in assignments
    then
      refuse ASSIGNMENT_NOT_FOUND "There is no such assignment."

**Registered refusal codes:** `ASSIGNMENT_NOT_FOUND`

##### `assign (assignment: Assignment, assignee: Assignee, at: Date) : return (release: Release)`

**Authored behavior:**

    where assignment in published and no release has this assignment and assignee
    then
      add a new release with assignment and assignee
      set release's assignedAt to at
      return release
    where assignment not in assignments
    then
      refuse ASSIGNMENT_NOT_FOUND "There is no such assignment."
    where assignment in assignments and assignment not in published
    then
      refuse ASSIGNMENT_NOT_PUBLISHED "Only a published assignment can be assigned."
    where a release has this assignment and assignee
    then
      refuse RELEASE_ALREADY_EXISTS "This assignee already holds a release of this assignment."

**Registered refusal codes:** `ASSIGNMENT_NOT_FOUND`, `ASSIGNMENT_NOT_PUBLISHED`, `RELEASE_ALREADY_EXISTS`

##### `setDueOverride (assignment: Assignment, assignee: Assignee, dueAt: Date) : return (release: Release)`

**Authored behavior:**

    where a release has this assignment and assignee
    then
      set release's dueOverride to dueAt
      return release
    where no release has this assignment and assignee
    then
      refuse RELEASE_NOT_FOUND "This assignee holds no release of this assignment."

**Registered refusal codes:** `RELEASE_NOT_FOUND`

##### `clearDueOverride (assignment: Assignment, assignee: Assignee) : return (release: Release)`

**Authored behavior:**

    where a release has this assignment and assignee
    then
      set release's dueOverride to none
      return release
    where no release has this assignment and assignee
    then
      refuse RELEASE_NOT_FOUND "This assignee holds no release of this assignment."

**Registered refusal codes:** `RELEASE_NOT_FOUND`

#### Queries

##### `_getDetail (assignment: String) : optional (detail: Assignment)`

##### `_getAssignments () : many (assignment: String, author: String, title: String, instructions: String, kind: String, availableAt: String, dueAt: String, closeAt: String | Null, acceptsSubmissions: Boolean, audience: Audience, targets: Strings, status: String, createdAt: Date, updatedAt: Date | Null)`

##### `_getAssigned (assignee: String) : many (assignment: String, release: String, dueOverride: String | Null, status: ASSIGNED)`

##### `_getAssignees (assignment: String) : many (assignee: String)`

##### `_isAssigned (assignment: String, assignee: String) : one (assigned: Boolean)`

##### `_getPublishedForAudience (audience: String | Null) : many (assignment: String)`

##### `_getPublishedInWindow (start: String | Date, end: String | Date) : many (assignment: String)`

### Authenticating

**Purpose.** Let a person create an account with a username and password, then use those
credentials to identify themselves later.

**Principle.** Nadia registers with the username nadia, a password, and her email address. A
user now exists for her. Later she authenticates with that username and
password and is recognized as the same user.

When Omar tries to register the username nadia, it is refused as taken. When
he tries to authenticate with a guessed password, he is turned away without
learning whether the username or the password was wrong.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `register (username: String, password: String, email: String) : return (user: User)`

**Authored behavior:**

    where email looks like an address, username is within name length, username is well-formed,
          password is within password length, and no user has username username
    then
      add a new user with username, a passwordVerifier derived from password, and email
      return user
    where email does not look like an address
    then
      refuse INVALID_BODY "The email address is not well formed."
    where username is not within name length
    then
      refuse USERNAME_INVALID_LENGTH "The username must be 3 to 32 characters long."
    where username is not well-formed
    then
      refuse USERNAME_INVALID_CHARS "The username must start with a letter and contain only letters, digits, hyphens, and underscores."
    where password is not within password length
    then
      refuse PASSWORD_INVALID_LENGTH "The password must be 8 to 128 characters long."
    where some user has username username
    then
      refuse USERNAME_TAKEN "That username is already taken."

**Registered refusal codes:** `INVALID_BODY`, `USERNAME_INVALID_LENGTH`, `USERNAME_INVALID_CHARS`, `PASSWORD_INVALID_LENGTH`, `USERNAME_TAKEN`

##### `authenticate (username: String, password: String) : return (user: User)`

**Authored behavior:**

    where some user has username username and password matches its passwordVerifier
    then
      return that user
    where no user has username username whose passwordVerifier matches password
    then
      refuse INVALID_CREDENTIALS "Unknown username or wrong password."

**Registered refusal codes:** `INVALID_CREDENTIALS`

##### `changePassword (user: User, oldPassword: String, newPassword: String) : return (user: User)`

**Authored behavior:**

    where the user exists and oldPassword matches its passwordVerifier, and newPassword is within password length
    then
      set the user's passwordVerifier to one derived from newPassword
      return user
    where the user does not exist or oldPassword does not match its passwordVerifier
    then
      refuse INVALID_CREDENTIALS "The current password is wrong."
    where newPassword is not within password length
    then
      refuse PASSWORD_INVALID_LENGTH "The password must be 8 to 128 characters long."

**Registered refusal codes:** `INVALID_CREDENTIALS`, `PASSWORD_INVALID_LENGTH`

#### Queries

##### `_getById (user: String) : optional (username: String, email: String)`

##### `_getByUsername (username: String) : optional (user: String)`

##### `_getUserCount () : one (count: Number)`

##### `_search (query: String) : many (user: String, username: String)`

##### `_resolveIdentity (ref: String) : one (user: String | Null, username: String | Null)`

##### `_denotedUser (ref: String) : optional (user: String)`

### Banking

**Purpose.** Give each learner a visible allowance of late days that staff can increase and
the learner can apply to individual items of work.

**Principle.** The course gives every learner three late days and limits each item to two. Ana
applies two days to an essay. She cannot apply two more to a problem set because
only one remains. Her advisor grants two extra days for conference travel, so
the second use succeeds. Ana later cancels that use. Its days return to her
balance, while the canceled use remains recorded.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `setTerms (allowance: Number, perItemLimit: Number, unitHours: Number) : return ()`

**Authored behavior:**

    then
      set the terms' allowance, perItemLimit, and unitHours from the inputs
      return

##### `grant (learner: Learner, days: Number, reason: String, at: Date) : return (grant: Grant)`

**Authored behavior:**

    where days is greater than zero
    then
      add a new grant with learner, days, and reason
      set grant's grantedAt to at
      return grant
    where days is not greater than zero
    then
      refuse LATE_DAYS_MUST_BE_POSITIVE "A grant must be for a positive number of days."

**Registered refusal codes:** `LATE_DAYS_MUST_BE_POSITIVE`

##### `apply (learner: Learner, item: Item, days: Number, at: Date) : return (use: Use)`

**Authored behavior:**

    where days is greater than zero, days is at most the terms' perItemLimit, learner has no applied use for item, and days is at most the balance of learner
    then
      add a new use with learner, item, and days
      set use's appliedAt to at
      add use to applied
      return use
    where days is not greater than zero
    then
      refuse LATE_DAYS_MUST_BE_POSITIVE "Late days must be a positive number."
    where days is greater than the terms' perItemLimit
    then
      refuse LATE_DAYS_EXCEED_MAX "That is more late days than any one item may absorb."
    where learner has an applied use for item
    then
      refuse LATE_USE_ALREADY_EXISTS "Late days already stand applied to this item."
    where days is greater than the balance of learner
    then
      refuse INSUFFICIENT_BALANCE "The learner's balance is short of the days requested."

**Registered refusal codes:** `LATE_DAYS_MUST_BE_POSITIVE`, `LATE_DAYS_EXCEED_MAX`, `LATE_USE_ALREADY_EXISTS`, `INSUFFICIENT_BALANCE`

##### `change (learner: Learner, item: Item, days: Number) : return (use: Use)`

**Authored behavior:**

    where the applied use of learner and item stands, days is at least zero, days is at most the terms' perItemLimit, and the increase over the use's days is at most the balance of learner
    then
      set use's days to days
      return use
    where learner has no applied use for item
    then
      refuse LATE_USE_NOT_FOUND "No late days stand applied to this item."
    where days is less than zero
    then
      refuse LATE_DAYS_NEGATIVE "Late days cannot be negative."
    where days is greater than the terms' perItemLimit
    then
      refuse LATE_DAYS_EXCEED_MAX "That is more late days than any one item may absorb."
    where the increase over the use's days is greater than the balance of learner
    then
      refuse INSUFFICIENT_BALANCE "The learner's balance is short of the increase requested."

**Registered refusal codes:** `LATE_USE_NOT_FOUND`, `LATE_DAYS_NEGATIVE`, `LATE_DAYS_EXCEED_MAX`, `INSUFFICIENT_BALANCE`

##### `cancel (learner: Learner, item: Item) : return (use: Use)`

**Authored behavior:**

    where the applied use of learner and item stands
    then
      remove use from applied
      add use to canceled
      return use
    where learner has no applied use for item
    then
      refuse LATE_USE_NOT_FOUND "No late days stand applied to this item."

**Registered refusal codes:** `LATE_USE_NOT_FOUND`

#### Queries

##### `_getTerms () : one (allowance: Number, perItemLimit: Number, unitHours: Number)`

##### `_getBalance (learner: String) : one (granted: Number, used: Number, remaining: Number)`

##### `_getApplied (learner: String, item: String) : optional (use: String, days: Number, appliedAt: Date)`

##### `_getUses (learner: String) : many (use: String, item: String, days: Number, status: String, appliedAt: Date)`

##### `_getUsesForItem (item: String) : many (learner: String, days: Number)`

##### `_getGrants (learner: String) : many (grant: String, days: Number, reason: String, grantedAt: Date)`

### Bookmarking

**Purpose.** Let a user keep a private list of items they want to return to later.

**Principle.** Ada saves a post, then saves another. Her list shows the newer bookmark first.
Saving the first post again is refused. Removing it succeeds once and is refused
the second time. Bob's bookmarks are independent of Ada's. Clearing an item
removes its bookmarks from every user's list and succeeds when none exist.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `save (user: User, item: Item, at: Date) : return (bookmark: Bookmark)`

**Authored behavior:**

    where no bookmark has this user and item
    then
      add a new bookmark with user, item, and savedAt at
      return bookmark
    where some bookmark has this user and item
    then
      refuse BOOKMARK_ALREADY_EXISTS "This user has already saved this item."

**Registered refusal codes:** `BOOKMARK_ALREADY_EXISTS`

##### `unsave (user: User, item: Item) : return (bookmark: Bookmark)`

**Authored behavior:**

    where some bookmark has this user and item
    then
      delete that bookmark
      return bookmark
    where no bookmark has this user and item
    then
      refuse BOOKMARK_NOT_FOUND "There is no such bookmark to remove."

**Registered refusal codes:** `BOOKMARK_NOT_FOUND`

##### `clearItem (item: Item) : return ()`

**Authored behavior:**

    then
      remove every bookmark of item
      return

#### Queries

##### `_getSaved (user: String) : many (item: String, savedAt: Date)`

##### `_isSaved (user: String, item: String) : one (saved: Boolean)`

### Categorizing

**Purpose.** Sort items into named categories. Each item belongs to at most one category, so
its home and each category's contents can be read directly.

**Principle.** Priya creates a Homework category and assigns a quiz to it. Assigning the quiz
to Exams moves it there. Unassigning it leaves it with no category, and a
second unassignment is refused. A second category named Homework is also
refused. Deleting Exams leaves every item in it uncategorized.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `createCategory (name: String, description: String) : return (category: Category)`

**Authored behavior:**

    where no category has this name
    then
      add a new category with name and description
      return category
    where some category has this name
    then
      refuse CATEGORY_ALREADY_EXISTS "A category with this name already exists."

**Registered refusal codes:** `CATEGORY_ALREADY_EXISTS`

##### `assign (item: Item, category: Category) : return ()`

**Authored behavior:**

    where category in categories
    then
      set item's home to category, replacing any prior home
      return
    where category not in categories
    then
      refuse CATEGORY_NOT_FOUND "There is no such category."

**Registered refusal codes:** `CATEGORY_NOT_FOUND`

##### `unassign (item: Item) : return ()`

**Authored behavior:**

    where item in categorized
    then
      remove item from categorized
      return
    where item not in categorized
    then
      refuse ITEM_NOT_CATEGORIZED "This item is not in any category."

**Registered refusal codes:** `ITEM_NOT_CATEGORIZED`

##### `deleteCategory (category: Category) : return ()`

**Authored behavior:**

    where category in categories
    then
      remove every item whose home is category from categorized
      delete category
      return
    where category not in categories
    then
      refuse CATEGORY_NOT_FOUND "There is no such category."

**Registered refusal codes:** `CATEGORY_NOT_FOUND`

#### Queries

##### `_getCategory (item: String) : optional (category: String, name: String, description: String)`

##### `_getHome (item: String) : optional (home: Category)`

##### `_getItems (category: String) : many (item: String)`

##### `_getAllCategories () : many (category: String, name: String, description: String)`

### Conversing

**Purpose.** Arrange items into conversations, with one root and replies that may have replies
of their own.

**Principle.** Noor starts a conversation with her question. Omar replies to it, and Priya
replies to Omar. An item can appear in only one conversation, so placing Omar's
answer again is refused. Omar's reply cannot be removed while Priya's reply is
beneath it. Removing the last node also removes the conversation.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `start (item: Item, at: Date) : return (conversation: Conversation, node: Node)`

**Authored behavior:**

    where no node has this item
    then
      add a new conversation with root node and createdAt at
      add a new node with conversation, item, depth 0, and createdAt at
      return conversation and node
    where a node has this item
    then
      refuse ITEM_ALREADY_IN_CONVERSATION "This item is already in a conversation."

**Registered refusal codes:** `ITEM_ALREADY_IN_CONVERSATION`

##### `reply (item: Item, parent: Node, at: Date) : return (node: Node)`

**Authored behavior:**

    where parent not in nodes
    then
      refuse PARENT_NODE_NOT_FOUND "There is no such node to reply to."
    where parent in nodes and a node has this item
    then
      refuse ITEM_ALREADY_IN_CONVERSATION "This item is already in a conversation."
    where parent in nodes and no node has this item
    then
      add a new node with conversation the parent's conversation, item, parent,
        depth one more than the parent's depth, and createdAt at
      return node

**Registered refusal codes:** `PARENT_NODE_NOT_FOUND`, `ITEM_ALREADY_IN_CONVERSATION`

##### `remove (node: Node) : return ()`

**Authored behavior:**

    where node not in nodes
    then
      refuse NODE_NOT_FOUND "There is no such node."
    where another node has node as its parent
    then
      refuse NODE_HAS_CHILDREN "This node has replies beneath it."
    where node in nodes, no node has node as its parent, and another node shares its conversation
    then
      delete node
      return
    where node in nodes, no node has node as its parent, and no other node shares its conversation
    then
      delete node
      delete its conversation
      return

**Registered refusal codes:** `NODE_NOT_FOUND`, `NODE_HAS_CHILDREN`

#### Queries

##### `_getThread (conversation: String) : many (node: String, item: String, parent: String | Null, depth: Number)`

##### `_getConversation (node: String) : optional (conversation: String)`

##### `_getNodeByItem (item: String) : optional (node: String)`

##### `_parentOf (node: String) : optional (parent: String)`

##### `_getItem (node: String) : optional (item: String)`

##### `_hasChildren (node: String) : one (present: Boolean)`

##### `_getConversations () : many (conversation: String, root: String, item: String, createdAt: Date, lastActivityAt: Date)`

##### `_getConversationsByLastActivity () : many (conversation: String, root: String, item: String, createdAt: Date, lastActivityAt: Date)`

### Flagging

**Purpose.** Let a person report a concern about a target and let a moderator resolve all
open concerns about that target as upheld or dismissed.

**Principle.** Sam reports a post as spam, and Rita reports the same post for another reason.
The post's open-flag count is now two. A moderator dismisses the reports, which
closes both flags. Sam cannot open another flag on the post while his first is
open. Unknown outcomes and targets without open flags are refused.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `flag (reporter: User, target: Target, reason: String, at: Date) : return (flag: Flag)`

**Authored behavior:**

    where no flag in open has this reporter and this target
    then
      add a new flag with reporter, target, reason, and createdAt at
      add flag to open
      return flag
    where some flag in open has this reporter and this target
    then
      refuse FLAG_ALREADY_EXISTS "You already have an open flag on this."

**Registered refusal codes:** `FLAG_ALREADY_EXISTS`

##### `resolve (target: Target, outcome: String) : return ()`

**Authored behavior:**

    where outcome is neither "upheld" nor "dismissed"
    then
      refuse VALIDATION_FAILED "An outcome must be upheld or dismissed."
    where some flag in open has this target
    then
      remove every flag with this target from open
      add each of them to upheld if outcome is "upheld", or to dismissed if outcome is "dismissed"
      return
    where no flag in open has this target
    then
      refuse FLAG_NOT_FOUND "There are no open flags on this."

**Registered refusal codes:** `VALIDATION_FAILED`, `FLAG_NOT_FOUND`

##### `clearTarget (target: Target) : return (target: Target)`

**Authored behavior:**

    then
      delete every flag on target
      return target

#### Queries

##### `_getOpenTargets () : many (target: String, count: Number)`

##### `_getFlags (target: String) : many (flag: String, reporter: String, reason: String, status: String, createdAt: Date)`

### Formatting

**Purpose.** Keep the rendered HTML for a target's source text and replace it when the source
changes.

**Principle.** Ben supplies a paragraph of source text and receives its rendered HTML. Editing
the source replaces that rendering. Clearing the target removes the rendering;
clearing it again still succeeds.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `setSource (target: Target, source: String) : return (rendered: String)`

**Authored behavior:**

    then
      delete any formatting for target
      add a new formatting with target, source, and rendered source rendered
      return rendered

##### `clear (target: Target) : return ()`

**Authored behavior:**

    then
      delete any formatting for target
      return

#### Queries

##### `_getRendered (target: String) : optional (rendered: String)`

### Grading

**Purpose.** Give each learner one grade per item, with a score, maximum, feedback, and a
clear draft, released, or excused status. Each grade keeps the maximum used
when it was recorded.

**Principle.** Ms. Okafor records Ana's essay grade as 42 out of 50, revises the draft to 45,
and releases it. Further recording is refused until she retracts it. She then
records 44 and releases every draft for the essay. Ben is excused, so recording
a score for him is refused. A score of 60 out of 50 is also refused.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `record (learner: Learner, item: Item, evidence: Evidence, grader: Grader, score: Number, outOf: Number, feedback: String, at: Date) : return (grade: Grade)`

**Authored behavior:**

    where score is within outOf and the grade of learner and item is in draft
    then
      set grade's evidence, grader, score, outOf, and feedback from the inputs
      set grade's updatedAt to at
      return grade
    where score is within outOf and learner has no grade for item
    then
      add a new grade with learner, item, evidence, grader, score, outOf, and feedback
      set grade's updatedAt to at
      add grade to draft
      return grade
    where score is not within outOf
    then
      refuse SCORE_OUT_OF_RANGE "The score must be between zero and what the grade is out of."
    where the grade of learner and item is in released
    then
      refuse GRADE_ALREADY_RELEASED "This grade has already been released."
    where the grade of learner and item is in excused
    then
      refuse LEARNER_EXCUSED "This learner has been excused from this item."

**Registered refusal codes:** `SCORE_OUT_OF_RANGE`, `GRADE_ALREADY_RELEASED`, `LEARNER_EXCUSED`

##### `scoreCriterion (learner: Learner, item: Item, criterion: Criterion, points: Number, outOf: Number, feedback: String) : return (criterionScore: CriterionScore)`

**Authored behavior:**

    where the grade of learner and item is in draft, points is within outOf, and grade has a criterionScore for criterion
    then
      set criterionScore's points, outOf, and feedback from the inputs
      return criterionScore
    where the grade of learner and item is in draft, points is within outOf, and grade has no criterionScore for criterion
    then
      add a new criterionScore with grade, criterion, points, outOf, and feedback
      return criterionScore
    where learner has no grade for item
    then
      refuse GRADE_NOT_FOUND "There is no grade for this learner and item."
    where the grade of learner and item is in released
    then
      refuse GRADE_ALREADY_RELEASED "This grade has already been released."
    where the grade of learner and item is in excused
    then
      refuse LEARNER_EXCUSED "This learner has been excused from this item."
    where points is not within outOf
    then
      refuse SCORE_OUT_OF_RANGE "The points must be between zero and what the criterion is out of."

**Registered refusal codes:** `GRADE_NOT_FOUND`, `GRADE_ALREADY_RELEASED`, `LEARNER_EXCUSED`, `SCORE_OUT_OF_RANGE`

##### `release (learner: Learner, item: Item, at: Date) : return (grade: Grade)`

**Authored behavior:**

    where the grade of learner and item is in draft
    then
      remove grade from draft
      add grade to released
      set grade's releasedAt to at and updatedAt to at
      return grade
    where learner has no grade in draft for item
    then
      refuse GRADE_DRAFT_NOT_FOUND "There is no draft grade for this learner and item."

**Registered refusal codes:** `GRADE_DRAFT_NOT_FOUND`

##### `releaseItem (item: Item, at: Date) : return (released: Grades)`

**Authored behavior:**

    then
      remove every draft grade of item from draft and add each to released
      set each one's releasedAt to at and updatedAt to at
      return released, the grades so released, each with its learner

##### `retract (learner: Learner, item: Item, at: Date) : return (grade: Grade)`

**Authored behavior:**

    where the grade of learner and item is in released
    then
      remove grade from released
      add grade to draft
      set grade's releasedAt to none and updatedAt to at
      return grade
    where learner has no released grade for item
    then
      refuse GRADE_RELEASED_NOT_FOUND "There is no released grade for this learner and item."

**Registered refusal codes:** `GRADE_RELEASED_NOT_FOUND`

##### `excuse (learner: Learner, item: Item, grader: Grader, feedback: String, at: Date) : return (grade: Grade)`

**Authored behavior:**

    where learner has a grade for item
    then
      remove grade from draft and from released
      add grade to excused
      set grade's score to 0, grader to grader, feedback to feedback, releasedAt to none, and updatedAt to at
      return grade
    where learner has no grade for item
    then
      refuse GRADE_NOT_FOUND "There is no grade for this learner and item."

**Registered refusal codes:** `GRADE_NOT_FOUND`

##### `clearCriterionScores (criterion: Criterion) : return ()`

**Authored behavior:**

    then
      delete every criterionScore for criterion
      return

#### Queries

##### `_getGrade (learner: String, item: String) : optional (grade: String, score: Number, outOf: Number, status: String, feedback: String)`

##### `_getGradesForLearner (learner: String) : many (item: String, grade: String, score: Number, outOf: Number, status: String, feedback: String)`

##### `_getGradesForItem (item: String) : many (learner: String, grade: String, score: Number, status: String)`

##### `_getCriterionScores (learner: String, item: String) : many (criterion: String, points: Number, feedback: String)`

### Inviting

**Purpose.** Issue durable, single-use invitations through an application-selected delivery
channel.

**Principle.** An administrator invites Nadia at an address on a delivery channel. The
application creates one durable, non-expiring invitation with a temporary credential.
Inviting the same channel and address again returns the same invitation and
credential; it does not rotate them. Nadia uses both values to claim the
invitation once.

Inviting does not interpret channels or addresses. A composition chooses the
channel and delegates validation, normalization, and delivery to the concept
that owns that channel.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `invite (channel: String, address: String, at: Date) : return (invitation: Invitation, channel: String, address: String, credential: String, created: Boolean)`

**Authored behavior:**

    where no invitation has channel and address
    then
      add a new invitation with createdAt and lastInvitedAt at, inviteCount 1, and no user
      return invitation, channel, address, its derived credential, and true
    where an unclaimed invitation has channel and address
    then
      set its lastInvitedAt to at and increment its inviteCount
      return that invitation, channel, address, its unchanged derived credential, and false
    where a claimed invitation has channel and address
    then
      refuse INVITATION_ALREADY_CLAIMED "That invitation has already been used."

**Registered refusal codes:** `INVITATION_ALREADY_CLAIMED`

##### `verify (invitation: Invitation, credential: String, channel: String) : return (invitation: Invitation, address: String)`

**Authored behavior:**

    where invitation exists on channel, has no user, and credential matches
    then
      return invitation and its address
    where no such unclaimed invitation matches
    then
      refuse INVITATION_INVALID "That invitation is not valid."

**Registered refusal codes:** `INVITATION_INVALID`

##### `claim (invitation: Invitation, credential: String, user: String) : return (invitation: Invitation, channel: String, address: String)`

**Authored behavior:**

    where invitation exists, has no user, and credential matches
    then
      set its user to user
      return invitation, channel, and address
    where no such unclaimed invitation matches
    then
      refuse INVITATION_INVALID "That invitation is not valid."

**Registered refusal codes:** `INVITATION_INVALID`

#### Queries

##### `_getAvailable (invitation: String, credential: String) : optional (channel: String, address: String)`

##### `_getInvitations () : many (invitation: String, channel: String, address: String, createdAt: Date, lastInvitedAt: Date, inviteCount: Number, user: String | Null)`

### Itemizing

**Purpose.** Describe how an item is assessed with a label, a maximum score, and optional
ordered criteria.

**Principle.** Professor Lee configures the midterm as a grade item worth 100 points. She adds
Argument, worth 60, and Style, worth 40, in that order. A later `ensureItem`
request finds the existing item and leaves it unchanged. Adding a criterion to
an item that has not been configured is refused. Archiving the midterm removes
it from the active items.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `configureItem (item: Item, label: String, maxPoints: Number) : return (gradeItem: GradeItem)`

**Authored behavior:**

    where maxPoints is a workable maximum and a gradeItem with item is in active
    then
      set gradeItem's label to label and maxPoints to maxPoints
      return gradeItem
    where maxPoints is a workable maximum and no gradeItem with item is in active
    then
      add a new gradeItem with item, label, and maxPoints
      add gradeItem to active
      return gradeItem
    where maxPoints is not a workable maximum
    then
      refuse SCORE_OUT_OF_RANGE "The maximum must be at least zero."

**Registered refusal codes:** `SCORE_OUT_OF_RANGE`

##### `ensureItem (item: Item, label: String, maxPoints: Number) : return (gradeItem: GradeItem)`

**Authored behavior:**

    where a gradeItem with item is in active
    then
      return gradeItem
    where no gradeItem with item is in active
    then
      add a new gradeItem with item, label, and maxPoints
      add gradeItem to active
      return gradeItem

##### `archiveItem (item: Item) : return (gradeItem: GradeItem)`

**Authored behavior:**

    where a gradeItem with item is in active
    then
      remove gradeItem from active
      add gradeItem to archived
      return gradeItem
    where no gradeItem with item is in active
    then
      refuse GRADE_ITEM_NOT_FOUND "There is no active grade item for this."

**Registered refusal codes:** `GRADE_ITEM_NOT_FOUND`

##### `addCriterion (item: Item, name: String, maxPoints: Number, position: Number) : return (criterion: Criterion)`

**Authored behavior:**

    where a gradeItem with item is in active
    then
      add a new criterion with item, name, maxPoints, and position
      return criterion
    where no gradeItem with item is in active
    then
      refuse GRADE_ITEM_NOT_FOUND "There is no active grade item for this."

**Registered refusal codes:** `GRADE_ITEM_NOT_FOUND`

##### `reviseCriterion (criterion: Criterion, name: String, maxPoints: Number, position: Number) : return ()`

**Authored behavior:**

    where criterion in criteria
    then
      set criterion's name, maxPoints, and position from the inputs
      return
    where criterion not in criteria
    then
      refuse CRITERION_NOT_FOUND "There is no such criterion."

**Registered refusal codes:** `CRITERION_NOT_FOUND`

##### `removeCriterion (criterion: Criterion) : return ()`

**Authored behavior:**

    where criterion in criteria
    then
      delete criterion
      return
    where criterion not in criteria
    then
      refuse CRITERION_NOT_FOUND "There is no such criterion."

**Registered refusal codes:** `CRITERION_NOT_FOUND`

#### Queries

##### `_getItem (item: String) : optional (item: String, label: String, maxPoints: Number, status: String)`

##### `_getItems () : many (item: String, label: String, maxPoints: Number)`

##### `_getCriteria (item: String) : many (criterion: String, name: String, maxPoints: Number, position: Number)`

##### `_getCriterion (criterion: String) : optional (item: String, name: String, maxPoints: Number)`

### Linking

**Purpose.** Record the ordered targets that a source links to, and support reading or
removing those links from either direction.

**Principle.** Noor's guide links to two worksheets, which are returned in the order she named
them. After she edits the guide to link to one worksheet, setting the links
replaces the previous list. Clearing a discarded worksheet's backlinks removes
it from every source. Clearing links that do not exist still succeeds.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `setLinks (source: Source, targets: Targets) : return ()`

**Authored behavior:**

    then
      set source's links to targets, replacing any prior links
      return

##### `setLinksFrom (source: Source, content: String) : return ()`

**Authored behavior:**

    then
      read each nonempty target between [[ and ]] from left to right
      set source's links to those targets in that order, preserving repeats
      return

##### `clearLinks (source: Source) : return ()`

**Authored behavior:**

    then
      remove all of source's links
      return

##### `clearBacklinks (target: Target) : return ()`

**Authored behavior:**

    then
      remove target from every source's links
      return

#### Queries

##### `_getLinks (source: String) : many (target: String)`

##### `_getBacklinks (target: String) : many (source: String)`

### Locking

**Purpose.** Record when a target is locked and allow that lock to be removed later.

**Principle.** When the deadline passes, Dana locks a report and the action records the time.
Locking it again is refused. After an extension, Dana unlocks it. Unlocking an
unlocked report is also refused.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `lock (target: Target, at: Date) : return ()`

**Authored behavior:**

    where no lock has this target
    then
      add a new lock with target and lockedAt at
      return
    where a lock has this target
    then
      refuse TARGET_ALREADY_LOCKED "This is already locked."

**Registered refusal codes:** `TARGET_ALREADY_LOCKED`

##### `unlock (target: Target) : return ()`

**Authored behavior:**

    where a lock has this target
    then
      delete the lock
      return
    where no lock has this target
    then
      refuse TARGET_NOT_LOCKED "This is not locked."

**Registered refusal codes:** `TARGET_NOT_LOCKED`

#### Queries

##### `_isLocked (target: String) : one (locked: Boolean)`

##### `_getLocked () : many (target: String, lockedAt: Date)`

### Mailing

**Purpose.** Keep a durable outbox of email messages that the application has decided to
send, independently of the SMTP transport that delivers them.

**Principle.** An application queues an email it has already rendered. A host worker reads
queued messages, sends them through SMTP, and marks successful deliveries sent.
Failed messages remain queued for a later attempt.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `normalizeRecipient (recipient: String) : return (recipient: String)`

**Authored behavior:**

    where recipient looks like an email address
    then
      return the trimmed, lower-cased recipient
    where recipient does not look like an email address
    then
      refuse MAIL_RECIPIENT_INVALID "The mail recipient is not well formed."

**Registered refusal codes:** `MAIL_RECIPIENT_INVALID`

##### `enqueue (key: String, recipient: String, subject: String, text: String, html: String, at: Date) : return (message: Message)`

**Authored behavior:**

    where recipient looks like an email address and no message has key
    then
      add the message with its normalized recipient and no sentAt
      return message
    where recipient looks like an email address and a message already has key
    then
      clear its sentAt and replace its delivery content using the normalized recipient
      return that message
    where recipient does not look like an email address
    then
      refuse MAIL_RECIPIENT_INVALID "The mail recipient is not well formed."

**Registered refusal codes:** `MAIL_RECIPIENT_INVALID`

##### `markSent (message: Message, at: Date) : return (message: Message)`

**Authored behavior:**

    where message exists
    then
      set sentAt to at
      return message
    where message does not exist
    then
      refuse MAIL_NOT_FOUND "There is no such mail message."

**Registered refusal codes:** `MAIL_NOT_FOUND`

#### Queries

##### `_getPending () : many (message: String, key: String, recipient: String, subject: String, text: String, html: String, createdAt: Date)`

##### `_getStatus (message: String) : optional (sentAt: Date | Null)`

### Notifying

**Purpose.** Give each person an inbox of events that concern them, with actions to mark,
dismiss, or clear notifications.

**Principle.** Someone replies to Mara's post, creating an unread notification that identifies
the event and its subject. Mara marks it read, which lowers her unread count
without removing it. She later marks every notification read and dismisses one.
Dismissing it again is refused. Noah cannot read or dismiss Mara's
notifications.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `notify (recipient: Person, kind: String, subject: String, link: String, at: Date) : return (notification: Notification)`

**Authored behavior:**

    then
      add a new notification with recipient, kind, subject, link, and createdAt at
      add notification to unread
      return notification

##### `markRead (notification: Notification, recipient: Person) : return (notification: Notification)`

**Authored behavior:**

    where notification in notifications and its recipient is recipient
    then
      remove notification from unread
      return notification
    where no such notification of this recipient
    then
      refuse NOTIFICATION_NOT_FOUND "There is no such notification."

**Registered refusal codes:** `NOTIFICATION_NOT_FOUND`

##### `markAllRead (recipient: Person) : return (recipient: Person)`

**Authored behavior:**

    then
      remove every notification of recipient from unread
      return recipient

##### `dismiss (notification: Notification, recipient: Person) : return (notification: Notification)`

**Authored behavior:**

    where notification in notifications and its recipient is recipient
    then
      delete notification
      return notification
    where no such notification of this recipient
    then
      refuse NOTIFICATION_NOT_FOUND "There is no such notification."

**Registered refusal codes:** `NOTIFICATION_NOT_FOUND`

##### `clearSubject (subject: Target) : return (subject: Target)`

**Authored behavior:**

    then
      delete every notification about subject
      return subject

#### Queries

##### `_getInbox (recipient: String) : many (notification: String, kind: String, subject: String, link: String | Null, createdAt: Date, read: Boolean)`

##### `_hasFor (user: String, subject: String) : one (notified: Boolean)`

##### `_getUnreadCount (recipient: String) : one (count: Number)`

### Noting

**Purpose.** Let staff keep notes about a learner, choose whether to show each note to that
learner, and move notes through open, resolved, and archived states.

**Principle.** Ms. Okafor writes a note about Ana's project work, shows it to Ana, and Ana
acknowledges it. A second note about a missed meeting remains staff-only and has
a follow-up date. After the meeting, Ms. Okafor revises, resolves, and archives
that note. Revising a resolved note is refused; restoring it makes it open
again. Hiding an acknowledged note does not erase Ana's acknowledgment.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `write (author: Author, learner: Learner, body: String, visibility: String, tags: Strings, followUpAt: Date, at: Date) : return (note: Note)`

**Authored behavior:**

    where visibility names a visibility
    then
      add a new note with author, learner, body, tags, and followUpAt
      set note's createdAt to at
      add note to open
      add note to disclosed if visibility is "LEARNER_VISIBLE"
      return note
    where visibility does not name a visibility
    then
      refuse INVALID_VISIBILITY "Visibility must be staff-only or learner-visible."

**Registered refusal codes:** `INVALID_VISIBILITY`

##### `revise (note: Note, body: String, visibility: String, tags: Strings, followUpAt: Date, at: Date) : return (note: Note)`

**Authored behavior:**

    where note in open and visibility names a visibility
    then
      set note's body, tags, and followUpAt from the inputs
      set note's updatedAt to at
      add note to disclosed if visibility is "LEARNER_VISIBLE", remove it from disclosed otherwise
      return note
    where no note has this note
    then
      refuse NOTE_NOT_FOUND "There is no such note."
    where note not in open
    then
      refuse NOTE_NOT_OPEN "This note is no longer open."
    where visibility does not name a visibility
    then
      refuse INVALID_VISIBILITY "Visibility must be staff-only or learner-visible."

**Registered refusal codes:** `NOTE_NOT_FOUND`, `NOTE_NOT_OPEN`, `INVALID_VISIBILITY`

##### `resolve (note: Note, at: Date) : return (note: Note)`

**Authored behavior:**

    where note in open
    then
      remove note from open
      add note to resolved
      set note's updatedAt to at
      return note
    where no note has this note
    then
      refuse NOTE_NOT_FOUND "There is no such note."
    where note not in open
    then
      refuse NOTE_NOT_OPEN "This note is no longer open."

**Registered refusal codes:** `NOTE_NOT_FOUND`, `NOTE_NOT_OPEN`

##### `archive (note: Note, at: Date) : return (note: Note)`

**Authored behavior:**

    where note in resolved
    then
      remove note from resolved
      add note to archived
      set note's updatedAt to at
      return note
    where no note has this note
    then
      refuse NOTE_NOT_FOUND "There is no such note."
    where note not in resolved
    then
      refuse NOTE_NOT_RESOLVED "Only a resolved note can be archived."

**Registered refusal codes:** `NOTE_NOT_FOUND`, `NOTE_NOT_RESOLVED`

##### `restore (note: Note, at: Date) : return (note: Note)`

**Authored behavior:**

    where note in resolved or note in archived
    then
      remove note from resolved and from archived
      add note to open
      set note's updatedAt to at
      return note
    where no note has this note
    then
      refuse NOTE_NOT_FOUND "There is no such note."
    where note in open
    then
      refuse NOTE_NOT_RESTORABLE "This note cannot be restored."

**Registered refusal codes:** `NOTE_NOT_FOUND`, `NOTE_NOT_RESTORABLE`

##### `acknowledge (note: Note, learner: Learner, at: Date) : return (note: Note)`

**Authored behavior:**

    where note in disclosed and the learner of note is learner
    then
      set note's acknowledgedAt to at
      return note
    where no note has this note
    then
      refuse NOTE_NOT_FOUND "There is no such note."
    where note not in disclosed
    then
      refuse NOTE_NOT_LEARNER_VISIBLE "This note is not shown to its learner."
    where the learner of note is not learner
    then
      refuse NOTE_NOT_OWNER "Only the learner a note concerns may acknowledge it."

**Registered refusal codes:** `NOTE_NOT_FOUND`, `NOTE_NOT_LEARNER_VISIBLE`, `NOTE_NOT_OWNER`

#### Queries

##### `_getNote (note: String) : optional (note: String, author: String, learner: String, body: String, visibility: String, status: String, createdAt: Date, updatedAt: Date | Null, followUpAt: Date | Null, acknowledgedAt: Date | Null, tags: Strings)`

##### `_getActiveNotesFor (learner: String) : many (note: String, author: String, learner: String, body: String, visibility: String, status: String, createdAt: Date, updatedAt: Date | Null, followUpAt: Date | Null, acknowledgedAt: Date | Null, tags: Strings)`

##### `_getShownTo (learner: String) : many (note: String, author: String, learner: String, body: String, status: String, createdAt: Date, updatedAt: Date | Null, followUpAt: Date | Null, acknowledgedAt: Date | Null, tags: Strings)`

##### `_getByAuthor (author: String) : many (note: String, learner: String, status: String, visibility: String, createdAt: Date)`

##### `_getOpenFollowUpsBefore (before: Date) : many (note: String, author: String, learner: String, body: String, followUpAt: Date, createdAt: Date)`

### Pinning

**Purpose.** Let a scope keep selected items above its ordinary listing, ordered by priority.

**Principle.** An administrator pins an announcement in a discussion. A second item with a
higher priority appears first, and changing a priority changes the order.
Pinning the same item twice in one scope is refused. Unpinning it succeeds once;
unpinning it again or changing the priority of an unpinned item is refused. The
same item may be pinned independently in another scope. Clearing an item
removes all of its pins and succeeds when none exist.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `pin (item: Item, scope: Scope, priority: Number, at: Date) : return (pin: Pin)`

**Authored behavior:**

    where no pin has this item and scope
    then
      add a new pin with item, scope, priority, and pinnedAt at
      return pin
    where some pin has this item and scope
    then
      refuse ITEM_ALREADY_PINNED "This item is already pinned in this scope."

**Registered refusal codes:** `ITEM_ALREADY_PINNED`

##### `unpin (item: Item, scope: Scope) : return (pin: Pin)`

**Authored behavior:**

    where some pin has this item and scope
    then
      delete that pin
      return pin
    where no pin has this item and scope
    then
      refuse ITEM_NOT_PINNED "There is no such pin to remove."

**Registered refusal codes:** `ITEM_NOT_PINNED`

##### `setPriority (item: Item, scope: Scope, priority: Number) : return (pin: Pin)`

**Authored behavior:**

    where some pin has this item and scope
    then
      set that pin's priority to priority
      return pin
    where no pin has this item and scope
    then
      refuse ITEM_NOT_PINNED "There is no such pin to reprioritize."

**Registered refusal codes:** `ITEM_NOT_PINNED`

##### `clearItem (item: Item) : return ()`

**Authored behavior:**

    then
      remove every pin of item
      return

#### Queries

##### `_getPinned (scope: String) : many (item: String, priority: Number)`

##### `_isPinned (item: String, scope: String) : one (pinned: Boolean)`

### Posting

**Purpose.** Let an author create, edit, and delete a post while retaining its author and
creation time.

**Principle.** On Monday Amara creates an announcement. On Wednesday she edits its content,
and the post records the edit time. On Friday she deletes it. Deleting it again
is refused because the post no longer exists.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `create (author: Author, content: String, at: Date) : return (post: Post)`

**Authored behavior:**

    then
      add a new post with author, content, and createdAt at
      return post

##### `edit (post: Post, content: String, at: Date) : return (post: Post)`

**Authored behavior:**

    where post in posts
    then
      set the post's content to content, and its editedAt to at
      return post
    where post not in posts
    then
      refuse POST_NOT_FOUND "There is no such post."

**Registered refusal codes:** `POST_NOT_FOUND`

##### `delete (post: Post) : return ()`

**Authored behavior:**

    where post in posts
    then
      delete post
      return
    where post not in posts
    then
      refuse POST_NOT_FOUND "There is no such post."

**Registered refusal codes:** `POST_NOT_FOUND`

#### Queries

##### `_getPost (post: String) : optional (author: String, content: String, createdAt: Date, editedAt: Date | Null)`

##### `_getByAuthor (author: String) : many (post: String)`

##### `_getMentions (post: String) : many (handle: String)`

##### `_isMentioned (post: String, handle: String) : one (mentioned: Boolean)`

### Profiling

**Purpose.** Keep a display name, bio, avatar, and contact email for each user, so the user
can be presented by profile details rather than only an identifier.

**Principle.** Priya's profile is created with her display name and email; her bio and avatar
start empty. A second profile for Priya is refused. She later changes her bio
and avatar. Updating a profile that was never created is refused.

A field never set reads as the empty string.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `createProfile (user: User, displayName: String, email: String) : return (user: User)`

**Authored behavior:**

    where no profile has user user
    then
      add a new profile with user, displayName, and email, and with an empty bio and avatar
      return user
    where some profile has user user
    then
      refuse PROFILE_ALREADY_EXISTS "This user already has a profile."

**Registered refusal codes:** `PROFILE_ALREADY_EXISTS`

##### `setDisplayName (user: User, displayName: String) : return (user: User)`

**Authored behavior:**

    where some profile has user user
    then
      set that profile's displayName to displayName
      return user
    where no profile has user user
    then
      refuse PROFILE_NOT_FOUND "There is no profile for this user."

**Registered refusal codes:** `PROFILE_NOT_FOUND`

##### `setBio (user: User, bio: String) : return (user: User)`

**Authored behavior:**

    where some profile has user user
    then
      set that profile's bio to bio
      return user
    where no profile has user user
    then
      refuse PROFILE_NOT_FOUND "There is no profile for this user."

**Registered refusal codes:** `PROFILE_NOT_FOUND`

##### `setAvatar (user: User, avatar: String) : return (user: User)`

**Authored behavior:**

    where some profile has user user
    then
      set that profile's avatar to avatar
      return user
    where no profile has user user
    then
      refuse PROFILE_NOT_FOUND "There is no profile for this user."

**Registered refusal codes:** `PROFILE_NOT_FOUND`

#### Queries

##### `_getProfile (user: String) : optional (profile: Profile)`

##### `_getProfileFields (user: String) : optional (displayName: String, bio: String, avatar: String, email: String)`

### Reacting

**Purpose.** Let a person add or remove a named response, such as a thumbs-up or heart, on a
target.

**Principle.** Noah reacts to a post with "up." Mara adds her own "up" and a "heart." Each
person may add one reaction of each kind to the target. Noah's second "up" is
refused. Removing it succeeds once and is refused the second time. Clearing a
target removes every reaction and succeeds when none exist.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `react (reactor: Person, target: Target, kind: String, at: Date) : return (reaction: Reaction)`

**Authored behavior:**

    where no reaction has this reactor, target, and kind
    then
      add a new reaction with reactor, target, kind, and reactedAt at
      return reaction
    where some reaction has this reactor, target, and kind
    then
      refuse REACTION_ALREADY_EXISTS "This person has already reacted to the target with this kind."

**Registered refusal codes:** `REACTION_ALREADY_EXISTS`

##### `unreact (reactor: Person, target: Target, kind: String) : return (reaction: Reaction)`

**Authored behavior:**

    where some reaction has this reactor, target, and kind
    then
      delete that reaction
      return reaction
    where no reaction has this reactor, target, and kind
    then
      refuse REACTION_NOT_FOUND "There is no such reaction to take back."

**Registered refusal codes:** `REACTION_NOT_FOUND`

##### `clearTarget (target: Target) : return ()`

**Authored behavior:**

    then
      remove every reaction on target
      return

#### Queries

##### `_getReactionsForTarget (target: String) : many (reaction: String, reactor: String, kind: String)`

##### `_getReactionsByUser (reactor: String) : many (reaction: String, target: String, kind: String)`

##### `_countByKind (target: String) : many (kind: String, count: Number)`

##### `_hasReacted (reactor: String, target: String, kind: String) : one (hasReacted: Boolean)`

### RequestBoundary

**Purpose.** Let the outside world ask for things and receive answers, so each authored answer belongs to one pending call and failed waits settle without forging one.

**Principle.** A call arrives and becomes pending. An answer travels back once; timeout or abort ends only the wait, while a quiescent interpreter failure returns an opaque internal error.

Actions:

- `request (…)`
- `respond (…)` — may refuse `NOT_PENDING`

### Resolving

**Purpose.** Mark at most one accepted answer for a question, including who accepted it and
when.

**Principle.** Lena accepts Bo's answer to her question. When she later accepts another
answer, it replaces the first. Clearing the accepted answer succeeds once and
is refused when the question has no resolution.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `accept (question: Question, answer: Answer, by: User, at: Date) : return ()`

**Authored behavior:**

    then
      add question to resolved with answer, resolvedBy by, and resolvedAt at, replacing any prior resolution
      return

##### `clear (question: Question) : return ()`

**Authored behavior:**

    where question in resolved
    then
      remove question from resolved
      return
    where question not in resolved
    then
      refuse RESOLUTION_NOT_FOUND "This question has no accepted answer."

**Registered refusal codes:** `RESOLUTION_NOT_FOUND`

#### Queries

##### `_isResolved (question: String) : one (resolved: Boolean)`

##### `_getResolution (question: String) : optional (answer: String, resolvedBy: String, resolvedAt: Date)`

##### `_getQuestionsAnswered (answer: String) : many (question: String)`

### Revising

**Purpose.** Keep numbered versions of an item's content so readers can compare its current
and earlier text.

**Principle.** Amara's first post content is revision 1. Two edits create revisions 2 and 3,
each with its saved content and time. A reader can list the revisions, read the
latest one, or select revision 2. Clearing the item removes every revision and
succeeds when no history exists.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `record (item: Item, content: String, at: Date) : return (revision: Revision, number: Number)`

**Authored behavior:**

    then
      add a new revision with item, content, and savedAt at, numbered one past the item's highest standing revision (or 1)
      return revision and number

##### `clearItem (item: Item) : return ()`

**Authored behavior:**

    then
      delete every revision with item item
      return

#### Queries

##### `_getRevisions (item: String) : many (revision: String, number: Number, content: String, savedAt: Date)`

##### `_getRevision (item: String, number: Number) : optional (revision: String, number: Number, content: String, savedAt: Date)`

##### `_getLatest (item: String) : optional (revision: String, number: Number, content: String, savedAt: Date)`

### Roling

**Purpose.** Define roles as named sets of capabilities, then grant or revoke those roles for
individual users within a context.

**Principle.** A course defines an instructor role with grade and publish capabilities. A
second role with the same name is refused. Maya receives the role in the
course; granting it there again is refused. Revoking the role succeeds once and
is refused when she no longer holds it.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `defineRole (name: String, capabilities: Strings) : return (role: Role)`

**Authored behavior:**

    where no role has name name
    then
      add a new role with name and capabilities
      return role
    where some role has name name
    then
      refuse ROLE_ALREADY_EXISTS "A role with this name already exists."

**Registered refusal codes:** `ROLE_ALREADY_EXISTS`

##### `ensureRole (name: String, capabilities: Strings) : return (role: Role)`

**Authored behavior:**

    where some role has name name
    then
      return that role
    where no role has name name
    then
      add a new role with name and capabilities
      return role

##### `grant (user: User, context: Context, role: Role) : return (grant: Grant)`

**Authored behavior:**

    where role in roles and no grant has user, context, and role
    then
      add a new grant with user, context, and role
      return grant
    where role not in roles
    then
      refuse ROLE_NOT_FOUND "No such role exists."
    where some grant has user, context, and role
    then
      refuse GRANT_ALREADY_EXISTS "The user already holds this role in this context."

**Registered refusal codes:** `ROLE_NOT_FOUND`, `GRANT_ALREADY_EXISTS`

##### `revoke (user: User, context: Context, role: Role) : return (grant: Grant)`

**Authored behavior:**

    where some grant has user, context, and role
    then
      delete that grant
      return grant
    where no grant has user, context, and role
    then
      refuse GRANT_NOT_FOUND "The user does not hold this role in this context."

**Registered refusal codes:** `GRANT_NOT_FOUND`

##### `requireCapability (user: User, context: Context, capability: String) : return (allowed: Boolean)`

**Authored behavior:**

    where the user holds a granted role in the context that includes capability
    then
      return allowed true
    otherwise
      refuse FORBIDDEN "The user does not hold the required capability in this context."

**Registered refusal codes:** `FORBIDDEN`

#### Queries

##### `_hasCapability (user: String, context: String, capability: String) : one (allowed: Boolean)`

##### `_hasCapabilityHolder (context: String, capability: String) : one (present: Boolean)`

##### `_holdsRoleNamed (user: String, context: String, name: String) : one (held: Boolean)`

##### `_getRoles (user: String, context: String) : many (role: String)`

##### `_getRoleByName (name: String) : optional (role: String)`

##### `_getRoleDetail (role: String) : optional (name: String, capabilities: Strings)`

##### `_listRoles () : many (role: String, name: String, capabilities: Strings)`

##### `_denotedRole (ref: String) : optional (role: String)`

### Rostering

**Purpose.** Keep one class configuration, its sections, and the pending, active, or dropped
seats held by its members.

**Principle.** The class is configured once; a second configuration is refused. An import
creates pending seats for Ana and Ben and skips a later row with Ana's existing
external key. Ana claims her seat and becomes active. Ben cannot claim another
seat while he already holds an active one. Ana's seat may be dropped,
reinstated, or moved to another section.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `configureClass (code: String, title: String, term: String, timezone: String) : return (class: Class)`

**Authored behavior:**

    where no class is configured
    then
      add a new class with code, title, term, and timezone
      return class
    where a class is already configured
    then
      refuse CLASS_ALREADY_CONFIGURED "The class has already been configured."

**Registered refusal codes:** `CLASS_ALREADY_CONFIGURED`

##### `createSection (name: String, location: String, meetingPattern: String) : return (section: Section)`

**Authored behavior:**

    then
      add a new section with name, location, and meetingPattern
      return section

##### `updateSection (section: Section, name: String, location: String, meetingPattern: String) : return ()`

**Authored behavior:**

    where section in sections
    then
      set section's name, location, and meetingPattern
      return
    where section not in sections
    then
      refuse SECTION_NOT_FOUND "No such section exists."

**Registered refusal codes:** `SECTION_NOT_FOUND`

##### `previewImport (csv: String) : return (rows: Rows)`

**Authored behavior:**

    then
      read the first newline-delimited line as comma-delimited headers
      read each later newline-delimited line as comma-delimited values, without quoting or escaping
      return rows

##### `importSeats (rows: Rows) : return (created: Seats, skipped: Strings)`

**Authored behavior:**

    then
      for each row whose externalKey no seat already carries:
        add a new seat with the row's externalKey, email, rosterName, kind, and section, and no holder
        add the seat to pending
      return the seats created and the externalKeys skipped

##### `claimSeat (seat: Seat, user: User) : return ()`

**Authored behavior:**

    where seat in pending and user holds no seat in active
    then
      set seat's holder to user
      remove seat from pending, add seat to active
      return
    where seat not in seats
    then
      refuse SEAT_NOT_FOUND "No such seat exists."
    where seat not in pending
    then
      refuse SEAT_NOT_PENDING "This seat is not open to claim."
    where user holds a seat in active
    then
      refuse SEAT_ALREADY_ACTIVE "This user already holds an active seat."

**Registered refusal codes:** `SEAT_NOT_FOUND`, `SEAT_NOT_PENDING`, `SEAT_ALREADY_ACTIVE`

##### `dropSeat (seat: Seat) : return ()`

**Authored behavior:**

    where seat in active
    then
      remove seat from active, add seat to dropped
      return
    where seat not in seats
    then
      refuse SEAT_NOT_FOUND "No such seat exists."
    where seat not in active
    then
      refuse SEAT_NOT_ACTIVE "This seat is not active."

**Registered refusal codes:** `SEAT_NOT_FOUND`, `SEAT_NOT_ACTIVE`

##### `reinstateSeat (seat: Seat) : return ()`

**Authored behavior:**

    where seat in dropped and its holder holds no other seat in active
    then
      remove seat from dropped, add seat to active
      return
    where seat not in seats
    then
      refuse SEAT_NOT_FOUND "No such seat exists."
    where seat not in dropped
    then
      refuse SEAT_NOT_DROPPED "This seat is not dropped."
    where seat in dropped and its holder holds another seat in active
    then
      refuse SEAT_ALREADY_ACTIVE "This user already holds an active seat."

**Registered refusal codes:** `SEAT_NOT_FOUND`, `SEAT_NOT_DROPPED`, `SEAT_ALREADY_ACTIVE`

##### `moveSection (seat: Seat, section: Section) : return ()`

**Authored behavior:**

    where seat in seats
    then
      set seat's section to section
      return
    where seat not in seats
    then
      refuse SEAT_NOT_FOUND "No such seat exists."

**Registered refusal codes:** `SEAT_NOT_FOUND`

#### Queries

##### `_getSections () : many (section: String, name: String, location: String, meetingPattern: String, status: String)`

##### `_getSeatByExternalKey (externalKey: String) : optional (seat: String, email: String)`

##### `_getSeatByUser (user: String) : optional (seat: String, user: String | Null, externalKey: String, email: String, rosterName: String, kind: String, section: String | Null, status: String)`

##### `_getSeatDetail (user: String) : optional (detail: Seat)`

##### `_getActiveMembers () : many (user: String | Null, seat: String, kind: String, section: String | Null, rosterName: String, email: String)`

##### `_isActiveStudent (user: String) : one (active: Boolean)`

##### `_getActiveStudents () : many (user: String, seat: String, section: String | Null, rosterName: String, email: String)`

##### `_getUnclaimedSeats () : many (seat: String, externalKey: String, email: String, rosterName: String, kind: String, section: String | Null)`

### Sessioning

**Purpose.** Give a user a session that identifies them until it ends or expires.

**Principle.** Maya starts a session that expires one day later. Before expiry, it identifies
her. Ending it removes the session. Ending the same session again is refused.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `start (user: User, at: Moment) : return (session: Session, expiresAt: Moment)`

**Authored behavior:**

    then
      add a new session with user and expiresAt one day after at
      return session and expiresAt

##### `end (session: Session) : return ()`

**Authored behavior:**

    where session in sessions
    then
      delete session
      return
    where session not in sessions
    then
      refuse SESSION_NOT_FOUND "There is no such session."

**Registered refusal codes:** `SESSION_NOT_FOUND`

##### `endAllForUser (user: User) : return (user: User)`

**Authored behavior:**

    then
      delete every session standing for user
      return user

#### Queries

##### `_getUser (session: String, at: Date) : optional (user: String)`

##### `_isExpired (session: String, at: Date) : one (expired: Boolean)`

### Submitting

**Purpose.** Let a learner submit numbered attempts for an assignment and withdraw or
restore each attempt.

**Principle.** Maya submits an essay as attempt one, withdraws it, and submits a revision as
attempt two. Withdrawal does not reuse the first number. Withdrawing the first
attempt again is refused. Restoring it succeeds, so both attempts are submitted.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `submit (assignment: Assignment, submitter: Submitter, artifact: Artifact, at: Date) : return (submission: Submission)`

**Authored behavior:**

    then
      add a new submission with assignment and submitter, its artifacts holding artifact
      set submission's number to one more than the highest number among this submitter's submissions for this assignment, or 1 when there are none
      set submission's submittedAt to at
      add submission to submitted
      return submission

##### `withdraw (submission: Submission) : return ()`

**Authored behavior:**

    where submission in submitted
    then
      remove submission from submitted
      add submission to withdrawn
      return
    where submission not in submissions
    then
      refuse SUBMISSION_NOT_FOUND "There is no such submission."
    where submission in withdrawn
    then
      refuse SUBMISSION_NOT_SUBMITTED "Only a submitted attempt can be withdrawn."

**Registered refusal codes:** `SUBMISSION_NOT_FOUND`, `SUBMISSION_NOT_SUBMITTED`

##### `restore (submission: Submission) : return ()`

**Authored behavior:**

    where submission in withdrawn
    then
      remove submission from withdrawn
      add submission to submitted
      return
    where submission not in submissions
    then
      refuse SUBMISSION_NOT_FOUND "There is no such submission."
    where submission in submitted
    then
      refuse SUBMISSION_NOT_WITHDRAWN "Only a withdrawn attempt can be restored."

**Registered refusal codes:** `SUBMISSION_NOT_FOUND`, `SUBMISSION_NOT_WITHDRAWN`

#### Queries

##### `_getLatest (assignment: String, submitter: String) : optional (latest: Submission)`

##### `_getAttempts (assignment: String, submitter: String) : many (submission: String, artifacts: Strings, submittedAt: Date, number: Number, status: String)`

##### `_getSubmissionsForAssignment (assignment: String) : many (submitter: String, submission: String, submittedAt: Date, number: Number, status: String)`

##### `_getSubmissionsForSubmitter (submitter: String) : many (assignment: String, submission: String, submittedAt: Date, number: Number, status: String)`

### Subscribing

**Purpose.** Record the targets a person follows so later events on those targets can reach
them.

**Principle.** Mara follows two threads, and her subscriptions list the newer one first.
Following the first thread again is refused. Unfollowing it succeeds once and
is refused the second time. Asking whether she follows a target always answers
yes or no.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `subscribe (user: Person, target: Target, at: Date) : return (subscription: Subscription)`

**Authored behavior:**

    where no subscription has this user and target
    then
      add a new subscription with user, target, and subscribedAt at
      return subscription
    where some subscription has this user and target
    then
      refuse ALREADY_SUBSCRIBED "This person already follows the target."

**Registered refusal codes:** `ALREADY_SUBSCRIBED`

##### `unsubscribe (user: Person, target: Target) : return (subscription: Subscription)`

**Authored behavior:**

    where some subscription has this user and target
    then
      delete that subscription
      return subscription
    where no subscription has this user and target
    then
      refuse NOT_SUBSCRIBED "There is no such subscription to drop."

**Registered refusal codes:** `NOT_SUBSCRIBED`

##### `clearTarget (target: Target) : return (target: Target)`

**Authored behavior:**

    then
      delete every subscription to target
      return target

#### Queries

##### `_getSubscribers (target: String) : many (user: String)`

##### `_getSubscriptions (user: String) : many (target: String, subscribedAt: Date)`

##### `_isSubscribed (user: String, target: String) : one (subscribed: Boolean)`

### Tagging

**Purpose.** Keep a shared set of named tags and apply or remove them from targets.

**Principle.** Ken creates an `urgent` tag and adds it to a report. Applying it again or
applying an unknown tag is refused. Ken removes the tag from the report.
Deleting a tag removes it from every target. Clearing a target removes all its
tags and succeeds when none are present.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `createTag (name: String) : return (tag: Tag)`

**Authored behavior:**

    where no tag has this name
    then
      add a new tag with name
      return tag
    where some tag has this name
    then
      refuse TAG_ALREADY_EXISTS "A tag with this name already exists."

**Registered refusal codes:** `TAG_ALREADY_EXISTS`

##### `addTag (target: Target, tag: Tag) : return ()`

**Authored behavior:**

    where tag in tags and tag not in target's applied
    then
      append tag to target's applied
      return
    where tag not in tags
    then
      refuse TAG_NOT_FOUND "There is no such tag."
    where tag in target's applied
    then
      refuse TAG_ALREADY_APPLIED "This tag is already applied to the target."

**Registered refusal codes:** `TAG_NOT_FOUND`, `TAG_ALREADY_APPLIED`

##### `removeTag (target: Target, tag: Tag) : return ()`

**Authored behavior:**

    where tag in target's applied
    then
      remove tag from target's applied
      return
    where tag not in target's applied
    then
      refuse TAG_NOT_APPLIED "This tag is not applied to the target."

**Registered refusal codes:** `TAG_NOT_APPLIED`

##### `deleteTag (tag: Tag) : return ()`

**Authored behavior:**

    where tag in tags
    then
      remove tag from every target's applied
      delete tag
      return
    where tag not in tags
    then
      refuse TAG_NOT_FOUND "There is no such tag."

**Registered refusal codes:** `TAG_NOT_FOUND`

##### `clearTarget (target: Target) : return ()`

**Authored behavior:**

    then
      remove target from tagged
      return

#### Queries

##### `_getTags (target: String) : many (tag: String, name: String)`

##### `_getTargets (tag: String) : many (target: String)`

##### `_getByName (name: String) : optional (tag: String)`

##### `_getAllTags () : many (tag: String, name: String)`

### Timing

**Purpose.** Tell a caller the current moment, so a choice that needs a timestamp does not
invent one.

**Principle.** Noor asks what time it is and learns that it is 10:30. When she asks later, she
learns the later moment rather than the earlier answer.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `capture () : return (at: Date)`

**Authored behavior:**

    then
      return the current moment as at

#### Queries

##### `_now () : one (at: Date)`

### Tracking

**Purpose.** Record which items belong to each scope and which items each user has seen.

**Principle.** Dana registers a discussion in the Algebra course. It is unread for Bob until
he marks it seen. Marking it seen again or marking an unregistered item is
refused. Marking the whole scope seen records every remaining item and succeeds
when none remain. Unregistering the discussion removes it and all of its seen
marks; unregistering it again succeeds. Registering it twice is refused.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `register (item: Item, scope: Scope) : return (item: Item)`

**Authored behavior:**

    where item not in registered
    then
      add item to registered with scope
      return item
    where item in registered
    then
      refuse ITEM_ALREADY_REGISTERED "This item is already being tracked."

**Registered refusal codes:** `ITEM_ALREADY_REGISTERED`

##### `unregister (item: Item) : return (item: Item)`

**Authored behavior:**

    then
      remove item from registered
      remove every seen-mark of item
      return item

##### `markSeen (user: User, item: Item) : return (item: Item)`

**Authored behavior:**

    where item in registered and no seen-mark has this user and item
    then
      add a seen-mark with user and item
      return item
    where item not in registered
    then
      refuse ITEM_NOT_REGISTERED "This item is not being tracked."
    where some seen-mark has this user and item
    then
      refuse ITEM_ALREADY_SEEN "This user has already seen this item."

**Registered refusal codes:** `ITEM_NOT_REGISTERED`, `ITEM_ALREADY_SEEN`

##### `markAllSeen (user: User, scope: Scope) : return (user: User)`

**Authored behavior:**

    then
      for every registered item in scope the user has not seen,
        add a seen-mark with user and that item
      return user

#### Queries

##### `_inScope (scope: String) : many (item: String)`

##### `_getUnread (user: String, scope: String) : many (item: String)`

##### `_getUnreadCount (user: String, scope: String) : one (count: Number)`

### Trashing

**Purpose.** Let an item be moved to trash, restored, or removed permanently.

**Principle.** Maya trashes a draft, recording who did it and when. She restores it, trashes
it again, and then purges it. Restoring or purging an item outside the trash is
refused, as is trashing an item already there.

_Registration checks member names, recoverable input names, and refusal mappings._
_Engine-evaluated reads enforce query cardinality. Types, results, and behavior prose are not executable assertions._

#### Actions

##### `trash (item: Item, by: User, at: Date) : return ()`

**Authored behavior:**

    where item not in trashed
    then
      add item to trashed with trashedBy by and trashedAt at
      return
    where item in trashed
    then
      refuse ITEM_ALREADY_TRASHED "This item is already in the trash."

**Registered refusal codes:** `ITEM_ALREADY_TRASHED`

##### `restore (item: Item) : return ()`

**Authored behavior:**

    where item in trashed
    then
      remove item from trashed
      return
    where item not in trashed
    then
      refuse ITEM_NOT_TRASHED "This item is not in the trash."

**Registered refusal codes:** `ITEM_NOT_TRASHED`

##### `purge (item: Item) : return ()`

**Authored behavior:**

    where item in trashed
    then
      remove item from trashed
      return
    where item not in trashed
    then
      refuse ITEM_NOT_TRASHED "This item is not in the trash."

**Registered refusal codes:** `ITEM_NOT_TRASHED`

#### Queries

##### `_isTrashed (item: String) : one (trashed: Boolean)`

##### `_getTrashed () : many (item: String, trashedBy: String, trashedAt: Date)`

## Views

_Views name reusable conditions. Multiple `where` blocks are alternatives._

```view
(item) is intact — inputs (item); outputs (); bindings ()
  where Trashing._isTrashed (item) has (trashed: false)
```

```view
(conversation) is readable — inputs (conversation); outputs (); bindings (node, item)
  where
    Conversing._getThread (conversation) has (item, node)
    no Conversing._parentOf (node)
    Posting._getPost (post: item)
    view "(item) is intact" with (item)
```

```view
(post) is not readable — inputs (post); outputs (); bindings ()
  where Trashing._isTrashed (item: post) has (trashed: true)
  where no Posting._getPost (post)
```

```view
(post) is readable — inputs (post); outputs (); bindings ()
  where
    Posting._getPost (post)
    Trashing._isTrashed (item: post) has (trashed: false)
```

```view
(target) is public — inputs (target); outputs (); bindings ()
  where
    Posting._getPost (post: target)
    view "(item) is intact" with (item: target)
  where view "(conversation) is readable" with (conversation: target)
```

```view
(user) authored (post) — inputs (user, post); outputs (); bindings ()
  where Posting._getPost (post) has (author: user)
```

```view
(user) did not author (post) — inputs (user, post); outputs (); bindings ()
  where Posting._getPost (post) and not (author: user)
```

```view
(user) is an active course member — inputs (user); outputs (); bindings ()
  where Rostering._getSeatByUser (user) has (status: "ACTIVE")
```

```view
(user) is an active student — inputs (user); outputs (); bindings ()
  where Rostering._isActiveStudent (user) has (active: true)
```

```view
(user) is not an active student — inputs (user); outputs (); bindings ()
  where Rostering._isActiveStudent (user) has (active: false)
```

```view
(user) is not mentioned in (post) — inputs (user, post); outputs (); bindings (username)
  where
    Authenticating._getById (user) has (username)
    Posting._isMentioned (handle: username, post) has (mentioned: false)
```

```view
(user) is not yet notified about (subject) — inputs (user, subject); outputs (); bindings ()
  where Notifying._hasFor (subject, user) has (notified: false)
```

```view
(user) may administer — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "administer", context: "forum", user) has (allowed: true)
  where Roling._hasCapabilityHolder (capability: "administer", context: "forum") has (present: false)
```

```view
(user) may edit (post) — inputs (user, post); outputs (); bindings (node, conversation)
  where
    Posting._getPost (post) has (author: user)
    Trashing._isTrashed (item: post) has (trashed: false)
    Conversing._getNodeByItem (item: post) has (node)
    Conversing._getConversation (node) has (conversation)
    Locking._isLocked (target: conversation) has (locked: false)
```

```view
(user) may manage assignments — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "assignments:manage", context: "forum", user) has (allowed: true)
```

```view
(user) may manage grades — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "grades:manage", context: "forum", user) has (allowed: true)
```

```view
(user) may manage late days — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "late-days:manage", context: "forum", user) has (allowed: true)
```

```view
(user) may manage student notes — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "student-notes:manage", context: "forum", user) has (allowed: true)
```

```view
(user) may manage the roster — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "roster:manage", context: "forum", user) has (allowed: true)
```

```view
(user) may moderate — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "moderate", context: "forum", user) has (allowed: true)
  where Roling._hasCapabilityHolder (capability: "administer", context: "forum") has (present: false)
```

```view
(user) may not administer — inputs (user); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "administer", context: "forum", user) has (allowed: false)
    Roling._hasCapabilityHolder (capability: "administer", context: "forum") has (present: true)
```

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

```view
(user) may not manage assignments — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "assignments:manage", context: "forum", user) has (allowed: false)
```

```view
(user) may not manage grades — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "grades:manage", context: "forum", user) has (allowed: false)
```

```view
(user) may not manage late days — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "late-days:manage", context: "forum", user) has (allowed: false)
```

```view
(user) may not manage student notes — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "student-notes:manage", context: "forum", user) has (allowed: false)
```

```view
(user) may not manage the roster — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "roster:manage", context: "forum", user) has (allowed: false)
```

```view
(user) may not moderate — inputs (user); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "moderate", context: "forum", user) has (allowed: false)
    Roling._hasCapabilityHolder (capability: "administer", context: "forum") has (present: true)
```

```view
(user) may not pin in (scope) — inputs (user, scope); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "pin", context: scope, user) has (allowed: false)
    Roling._hasCapability (capability: "pin", context: "forum", user) has (allowed: false)
```

```view
(user) may not view all grades — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "grades:view-all", context: "forum", user) has (allowed: false)
```

```view
(user) may not view all submissions — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "submissions:view-all", context: "forum", user) has (allowed: false)
```

```view
(user) may not view the staff calendar — inputs (user); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "calendar:view-staff", context: "forum", user) has (allowed: false)
    Roling._hasCapability (capability: "roster:manage", context: "forum", user) has (allowed: false)
```

```view
(user) may pin in (scope) — inputs (user, scope); outputs (); bindings ()
  where Roling._hasCapability (capability: "pin", context: scope, user) has (allowed: true)
  where Roling._hasCapability (capability: "pin", context: "forum", user) has (allowed: true)
```

```view
(user) may view all grades — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "grades:view-all", context: "forum", user) has (allowed: true)
```

```view
(user) may view all submissions — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "submissions:view-all", context: "forum", user) has (allowed: true)
```

```view
(user) may view the staff calendar — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "calendar:view-staff", context: "forum", user) has (allowed: true)
  where Roling._hasCapability (capability: "roster:manage", context: "forum", user) has (allowed: true)
```

```view
the active user of (session) — inputs (session); outputs (user); bindings (at) — answers at most one (user)
  where
    Timing._now () has (at)
    Sessioning._getUser (at, session) has (user)
```

```view
the assignment (assignment) — inputs (assignment); outputs (detail); bindings () — answers at most one (detail)
  where Assigning._getDetail (assignment) has (detail)
```

```view
the conversation placing (item) — inputs (item); outputs (conversation); bindings (node) — answers at most one (conversation)
  where
    Conversing._getNodeByItem (item) has (node)
    Posting._getPost (post: item)
    view "(item) is intact" with (item)
    Conversing._getConversation (node) has (conversation)
```

```view
the latest submission for (assignment) by (submitter) — inputs (assignment, submitter); outputs (latest); bindings () — answers at most one (latest)
  where Submitting._getLatest (assignment, submitter) has (latest)
```

```view
the other users mentioned in (post) — inputs (post); outputs (user); bindings (handle) — answers any number of (user)
  where
    Posting._getMentions (post) has (handle)
    Authenticating._getByUsername (username: handle) has (user)
    Posting._getPost (post) and not (author: user)
```

```view
the profile of (user) — inputs (user); outputs (profile); bindings () — answers at most one (profile)
  where Profiling._getProfile (user) has (profile)
```

```view
the public posts by (author) — inputs (author); outputs (post); bindings () — answers any number of (post)
  where
    Posting._getByAuthor (author) has (post)
    view "(item) is intact" with (item: post)
```

```view
the public posts in (conversation) — inputs (conversation); outputs (node, item, author, createdAt); bindings () — answers any number of (node, item, author, createdAt)
  where
    Conversing._getThread (conversation) has (item, node)
    view "(item) is intact" with (item)
    Posting._getPost (post: item) has (author, createdAt)
```

```view
the readable bookmarks of (user) — inputs (user); outputs (item, savedAt); bindings () — answers any number of (item, savedAt)
  where
    Bookmarking._getSaved (user) has (item, savedAt)
    view "(post) is readable" with (post: item)
```

```view
the seat detail of (user) — inputs (user); outputs (detail); bindings () — answers at most one (detail)
  where Rostering._getSeatDetail (user) has (detail)
```

```view
the seat matching (user) and (externalKey) — inputs (user, externalKey); outputs (seat); bindings (email) — answers at most one (seat)
  where
    Profiling._getProfileFields (user) has (email)
    Rostering._getSeatByExternalKey (externalKey) has (email, seat)
```

```view
the seat of (user) — inputs (user); outputs (seat); bindings () — answers at most one (seat)
  where Rostering._getSeatByUser (user) has (seat)
```

```view
the user named (username) — inputs (username); outputs (user); bindings () — answers at most one (user)
  where Authenticating._getByUsername (username) has (user)
```

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

```former
Former "the assigned population for (assignment)" — inputs (assignment); bindings (assignee, rosterName); promises exactly one record — forms:
  each Assigning._getAssignees (assignment) has (assignee)
    where Rostering._getSeatByUser (user: assignee) has (rosterName)
    form a record of
      assignee
      rosterName
```

```former
Former "the assignments of (student)" — inputs (student); bindings (assignment, release, dueOverride, status); promises exactly one record — forms:
  each Assigning._getAssigned (assignee: student) has (assignment, dueOverride, release, status)
    form a record of
      assignment
      dueOverride
      release
      status
```

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

```former
Former "the backlinks of (target)" — inputs (target); bindings (source); promises exactly one record — forms:
  each Linking._getBacklinks (target) has (source)
    where view "(post) is readable" with (post: source)
    form a record of
      source
```

```former
Former "the post summary of (item)" — inputs (item); bindings (author, content, createdAt, editedAt); promises at most one record — forms:
  a record of
    where Posting._getPost (post: item) has (author, content, createdAt, editedAt)
    author
    content
    createdAt
    editedAt
```

```former
Former "the bookmarked posts of (user)" — inputs (user); bindings (item, savedAt); promises exactly one record — forms:
  each view "the readable bookmarks of (user)" with (user) has (item, savedAt)
    form a record of
      item
      post: former "the post summary of (item)" with (item)
      savedAt
```

```former
Former "the bookmarks of (user)" — inputs (user); bindings (item, savedAt); promises exactly one record — forms:
  each view "the readable bookmarks of (user)" with (user) has (item, savedAt)
    form a record of
      item
      savedAt
```

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

```former
Former "the categories ()" — inputs (); bindings (category, name, description); promises exactly one record — forms:
  each Categorizing._getAllCategories () has (category, description, name)
    form a record of
      category
      description
      name
```

```former
Former "the category of (item)" — inputs (item); bindings (category, name, description); promises exactly one record — forms:
  each Categorizing._getCategory (item) has (category, description, name)
    form a record of
      category
      description
      name
```

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

```former
Former "the defined roles ()" — inputs (); bindings (role, name, capabilities); promises exactly one record — forms:
  each Roling._listRoles () has (capabilities, name, role)
    form a record of
      capabilities
      name
      role
```

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

```former
Former "the forward links of (source)" — inputs (source); bindings (target); promises exactly one record — forms:
  each Linking._getLinks (source) has (target)
    where view "(post) is readable" with (post: target)
    form a record of
      target
```

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

```former
Former "the grades on (item)" — inputs (item); bindings (learner, grade, score, status); promises exactly one record — forms:
  each Grading._getGradesForItem (item) has (grade, learner, score, status)
    form a record of
      grade
      learner
      score
      status
```

```former
Former "the thread stats of (conversation)" — inputs (conversation); bindings (replyNode, replyItem, activityItem, activityAt, partItem, participant); promises exactly one record — forms:
  a record of
    lastActivityAt: the activityAt of the first view "the public posts in (conversation)" with (conversation) has (createdAt: activityAt, item: activityItem)
      arranged by activityAt, descending
    participants: the distinct participant of each view "the public posts in (conversation)" with (conversation) has (author: participant, item: partItem)
    replyCount: the count of view "the public posts in (conversation)" with (conversation) has (item: replyItem, node: replyNode)
      where Conversing._parentOf (node: replyNode)
```

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

```former
Former "the items in (category)" — inputs (category); bindings (item); promises exactly one record — forms:
  each Categorizing._getItems (category) has (item)
    where view "(post) is readable" with (post: item)
    form a record of
      item
```

```former
Former "the late-day balance of (learner)" — inputs (learner); bindings (granted, used, remaining); promises exactly one record — forms:
  a record of
    where Banking._getBalance (learner) has (granted, remaining, used)
    granted
    remaining
    used
```

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

```former
Former "the late-day uses on (assignment)" — inputs (assignment); bindings (learner, days); promises exactly one record — forms:
  each Banking._getUsesForItem (item: assignment) has (days, learner)
    form a record of
      days
      learner
```

```former
Former "the latest revision of (item)" — inputs (item); bindings (revision, number, content, savedAt); promises exactly one record — forms:
  each Revising._getLatest (item) has (content, number, revision, savedAt)
    form a record of
      content
      number
      revision
      savedAt
```

```former
Former "the locked list ()" — inputs (); bindings (target, lockedAt); promises exactly one record — forms:
  each Locking._getLocked () has (lockedAt, target)
    where view "(target) is public" with (target)
    form a record of
      lockedAt
      target
```

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

```former
Former "the open flags ()" — inputs (); bindings (target, count); promises exactly one record — forms:
  each Flagging._getOpenTargets () has (count, target)
    where view "(post) is readable" with (post: target)
    form a record of
      count
      target
```

```former
Former "the pins of (scope)" — inputs (scope); bindings (item, priority); promises exactly one record — forms:
  each Pinning._getPinned (scope) has (item, priority)
    where view "(post) is readable" with (post: item)
    form a record of
      item
      priority
```

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

```former
Former "the private profile of (user)" — inputs (user); bindings (displayName, bio, avatar, email); promises at most one record — forms:
  a record of
    where Profiling._getProfileFields (user) has (avatar, bio, displayName, email)
    avatar
    bio
    displayName
    email
```

```former
Former "the profile face of (user)" — inputs (user); bindings (displayName, bio, avatar); promises at most one record — forms:
  a record of
    where Profiling._getProfileFields (user) has (avatar, bio, displayName)
    avatar
    bio
    displayName
```

```former
Former "the public posts of (author)" — inputs (author); bindings (post); promises exactly one record — forms:
  each view "the public posts by (author)" with (author) has (post)
    form a record of
      post
```

```former
Former "the reaction counts on (target)" — inputs (target); bindings (kind, count); promises exactly one record — forms:
  each Reacting._countByKind (target) has (count, kind)
    form a record of
      count
      kind
```

```former
Former "the reactions on (target)" — inputs (target); bindings (reaction, reactor, kind); promises exactly one record — forms:
  each Reacting._getReactionsForTarget (target) has (kind, reaction, reactor)
    form a record of
      kind
      reaction
      user: reactor
```

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

```former
Former "the resolution of (question)" — inputs (question); bindings (answer, resolvedBy, resolvedAt); promises exactly one record — forms:
  each Resolving._getResolution (question) has (answer, resolvedAt, resolvedBy)
    where view "(post) is readable" with (post: answer)
    form a record of
      answer
      resolvedAt
      resolvedBy
```

```former
Former "the revision history of (item)" — inputs (item); bindings (revision, number, content, savedAt); promises exactly one record — forms:
  each Revising._getRevisions (item) has (content, number, revision, savedAt)
    form a record of
      content
      number
      revision
      savedAt
```

```former
Former "the revision numbered (number) of (item)" — inputs (number, item); bindings (content, savedAt); promises exactly one record — forms:
  each Revising._getRevision (item, number) has (content, savedAt)
    form a record of
      content
      savedAt
```

```former
Former "the roles held by (user) in (context)" — inputs (user, context); bindings (role); promises exactly one record — forms:
  each Roling._getRoles (context, user) has (role)
    form a record of
      role
```

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

```former
Former "the staff dashboard counts ()" — inputs (); bindings (assignment, item, learner, use); promises exactly one record — forms:
  a record of
    assignments: the count of Assigning._getAssignments () has (assignment)
    gradeItems: the count of Itemizing._getItems () has (item)
    lateDayUses: the count of Rostering._getActiveStudents () has (user: learner)
      where Banking._getUses (learner) has (status: "APPLIED", use)
```

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

```former
Former "the subscribers of (target)" — inputs (target); bindings (user); promises exactly one record — forms:
  each Subscribing._getSubscribers (target) has (user)
    where view "(conversation) is readable" with (conversation: target)
    form a record of
      user
```

```former
Former "the subscriptions of (user)" — inputs (user); bindings (target, subscribedAt); promises exactly one record — forms:
  each Subscribing._getSubscriptions (user) has (subscribedAt, target)
    where view "(conversation) is readable" with (conversation: target)
    form a record of
      subscribedAt
      target
```

```former
Former "the tags ()" — inputs (); bindings (tag, name); promises exactly one record — forms:
  each Tagging._getAllTags () has (name, tag)
    form a record of
      name
      tag
```

```former
Former "the tags on (target)" — inputs (target); bindings (tag, name); promises exactly one record — forms:
  each Tagging._getTags (target) has (name, tag)
    where view "(post) is readable" with (post: target)
    form a record of
      name
      tag
```

```former
Former "the targets tagged (tag)" — inputs (tag); bindings (target); promises exactly one record — forms:
  each Tagging._getTargets (tag) has (target)
    where view "(post) is readable" with (post: target)
    form a record of
      target
```

```former
Former "the targets tagged with (name)" — inputs (name); bindings (tag, target); promises exactly one record — forms:
  each Tagging._getByName (name) has (tag)
    where Tagging._getTargets (tag) has (target)
    where view "(post) is readable" with (post: target)
    form a record of
      target
```

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

```former
Former "the trash bin ()" — inputs (); bindings (item, trashedBy, trashedAt); promises exactly one record — forms:
  each Trashing._getTrashed () has (item, trashedAt, trashedBy)
    form a record of
      item
      trashedAt
      trashedBy
```

```former
Former "the unread of (user) in (scope)" — inputs (user, scope); bindings (item); promises exactly one record — forms:
  each Tracking._getUnread (scope, user) has (item)
    form a record of
      item
```

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

```former
Former "the user search (query)" — inputs (query); bindings (user, username); promises exactly one record — forms:
  each Authenticating._search (query) has (user, username)
    form a record of
      profile: former "the profile face of (user)" with (user)
      user
      username
```

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

```reaction
when RequestBoundary.request (displayName, invitation, password, path: "/auth/accept-invitation", requestId, temporaryPassword, username)
then
  Inviting.verify (channel: "email", credential: temporaryPassword, invitation)
```

### Access.auth.AcceptInvitation#2

```reaction
when Inviting.verify (channel: "email", credential: temporaryPassword, invitation, address: email), asked by Access.auth.AcceptInvitation
where
  earlier, RequestBoundary.request (displayName, invitation, password, path: "/auth/accept-invitation", requestId, temporaryPassword, username)
then
  Authenticating.register (email, password, username)
```

### Access.auth.AcceptInvitation#3

```reaction
when Authenticating.register (email, password, username, user), asked by Access.auth.AcceptInvitation#2
where
  earlier, RequestBoundary.request (displayName, invitation, password, path: "/auth/accept-invitation", requestId, temporaryPassword, username)
then
  Profiling.createProfile (displayName, email, user)
```

### Access.auth.AcceptInvitation#4

```reaction
when Profiling.createProfile (displayName, email, user), asked by Access.auth.AcceptInvitation#3
where
  earlier, Inviting.verify (channel: "email", credential: temporaryPassword, invitation, address: email), asked by Access.auth.AcceptInvitation
then
  Inviting.claim (credential: temporaryPassword, invitation, user)
```

### Access.auth.AcceptInvitation#5

```reaction
when Inviting.claim (credential: temporaryPassword, invitation, user), asked by Access.auth.AcceptInvitation#4
where
  earlier, RequestBoundary.request (displayName, invitation, password, path: "/auth/accept-invitation", requestId, temporaryPassword, username)
then
  RequestBoundary.respond (requestId, user)
```

### Access.auth.BootstrapAdminOnLogin

```reaction
when Authenticating.authenticate (user)
where
  Authenticating._getUserCount () has (count: 1)
  Roling._hasCapabilityHolder (capability: "administer", context: "forum") has (present: false)
then
  Roling.ensureRole (capabilities: ["administer", "moderate", "pin", "late-days:manage", "calendar:view-staff", "student-notes:manage"], name: "administrator")
```

### Access.auth.BootstrapAdminOnLogin#2

```reaction
when Roling.ensureRole (capabilities: ["administer", "moderate", "pin", "late-days:manage", "calendar:view-staff", "student-notes:manage"], name: "administrator", role), asked by Access.auth.BootstrapAdminOnLogin
where
  earlier, Authenticating.authenticate (user)
then
  Roling.grant (context: "forum", role, user)
```

### Access.auth.BootstrapAdminOnRegister

```reaction
when Authenticating.register (user)
where
  Authenticating._getUserCount () has (count: 1)
  Roling._hasCapabilityHolder (capability: "administer", context: "forum") has (present: false)
then
  Roling.ensureRole (capabilities: ["administer", "moderate", "pin", "late-days:manage", "calendar:view-staff", "student-notes:manage"], name: "administrator")
```

### Access.auth.BootstrapAdminOnRegister#2

```reaction
when Roling.ensureRole (capabilities: ["administer", "moderate", "pin", "late-days:manage", "calendar:view-staff", "student-notes:manage"], name: "administrator", role), asked by Access.auth.BootstrapAdminOnRegister
where
  earlier, Authenticating.register (user)
then
  Roling.grant (context: "forum", role, user)
```

### Access.auth.ChangePassword

```reaction
when RequestBoundary.request (newPassword, oldPassword, path: "/auth/changePassword", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Authenticating.changePassword (newPassword, oldPassword, user)
```

### Access.auth.ChangePassword#2

```reaction
when Authenticating.changePassword (newPassword, oldPassword, user), asked by Access.auth.ChangePassword
then
  Sessioning.endAllForUser (user)
```

### Access.auth.ChangePassword#3

```reaction
when Sessioning.endAllForUser (user), asked by Access.auth.ChangePassword#2
where
  earlier, RequestBoundary.request (newPassword, oldPassword, path: "/auth/changePassword", requestId, session)
then
  RequestBoundary.respond (requestId, user)
```

### Access.auth.InvalidSessionIsRejected:expired-session

```reaction
when RequestBoundary.request (requestId, session)
where
  Timing._now () has (at)
  Sessioning._isExpired (at, session) has (expired: true)
then
  Sessioning.end (session)
```

### Access.auth.InvalidSessionIsRejected:expired-session#2

```reaction
when Sessioning.end (session), asked by Access.auth.InvalidSessionIsRejected:expired-session
where
  earlier, RequestBoundary.request (requestId, session)
then
  RequestBoundary.respond (error: "UNAUTHORIZED", requestId)
```

### Access.auth.InvalidSessionIsRejected:unknown-session

```reaction
when RequestBoundary.request (requestId, session)
where
  Timing._now () has (at)
  Sessioning._isExpired (at, session) has (expired: false)
  no view "the active user of (session)" with (session)
then
  RequestBoundary.respond (error: "UNAUTHORIZED", requestId)
```

### Access.auth.Login

```reaction
when RequestBoundary.request (password, path: "/auth/login", requestId, username)
then
  Authenticating.authenticate (password, username)
```

### Access.auth.Login#2

```reaction
when Authenticating.authenticate (password, username, user), asked by Access.auth.Login
then
  Timing.capture ()
```

### Access.auth.Login#3

```reaction
when Timing.capture (at), asked by Access.auth.Login#2
where
  earlier, Authenticating.authenticate (password, username, user), asked by Access.auth.Login
then
  Sessioning.start (at, user)
```

### Access.auth.Login#4

```reaction
when Sessioning.start (at, user, expiresAt, session), asked by Access.auth.Login#3
where
  earlier, RequestBoundary.request (password, path: "/auth/login", requestId, username)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### Access.auth.Logout

```reaction
when RequestBoundary.request (path: "/auth/logout", requestId, session)
where
  view "the active user of (session)" with (session)
then
  Sessioning.end (session)
```

### Access.auth.Logout#2

```reaction
when Sessioning.end (session), asked by Access.auth.Logout
where
  earlier, RequestBoundary.request (path: "/auth/logout", requestId, session)
then
  RequestBoundary.respond (ok: true, requestId)
```

### Access.auth.Me

```reaction
when RequestBoundary.request (path: "/auth/me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  Authenticating._getById (user) has (email, username)
  Profiling._getProfile (user) has (profile)
then
  RequestBoundary.respond (email, profile, requestId, user, username)
```

### Access.auth.Resolve:absent

```reaction
when RequestBoundary.request (path: "/auth/resolve", requestId, username)
where
  no view "the user named (username)" with (username)
then
  RequestBoundary.respond (requestId, user: null)
```

### Access.auth.Resolve:found

```reaction
when RequestBoundary.request (path: "/auth/resolve", requestId, username)
where
  view "the user named (username)" with (username) has (user)
then
  RequestBoundary.respond (requestId, user)
```

### Access.invitations.EmailInvitationQueuesMail

```reaction
when Inviting.invite (address, at, channel: "email", created, credential, invitation)
where
  text is invitationMailText (credential, invitation)
  html is invitationMailHtml (credential, invitation)
then
  Mailing.enqueue (at, html, key: invitation, recipient: address, subject: "Your Commons invitation", text)
```

### Access.invitations.Invite:forbidden

```reaction
when RequestBoundary.request (email, path: "/invitations/invite", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.invitations.Invite:success

```reaction
when RequestBoundary.request (email, path: "/invitations/invite", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
then
  Mailing.normalizeRecipient (recipient: email)
```

### Access.invitations.Invite:success#2

```reaction
when Mailing.normalizeRecipient (recipient: email, result.recipient), asked by Access.invitations.Invite:success
then
  Timing.capture ()
```

### Access.invitations.Invite:success#3

```reaction
when Timing.capture (at), asked by Access.invitations.Invite:success#2
where
  earlier, Mailing.normalizeRecipient (recipient: email, result.recipient), asked by Access.invitations.Invite:success
then
  Inviting.invite (address: recipient, at, channel: "email")
```

### Access.invitations.Invite:success#4

```reaction
when Inviting.invite (address: recipient, at, channel: "email", created, invitation), asked by Access.invitations.Invite:success#3
where
  earlier, RequestBoundary.request (email, path: "/invitations/invite", requestId, session)
then
  RequestBoundary.respond (created, email: recipient, invitation, requestId)
```

### Access.invitations.List:forbidden

```reaction
when RequestBoundary.request (path: "/invitations/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.invitations.List:success

```reaction
when RequestBoundary.request (path: "/invitations/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
then
  RequestBoundary.respond (invitations: former "the invitations ()", requestId)
```

### Access.roles.DefineRole:forbidden

```reaction
when RequestBoundary.request (capabilities, name, path: "/roles/define", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not administer" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.roles.DefineRole:success

```reaction
when RequestBoundary.request (capabilities, name, path: "/roles/define", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may administer" with (user)
then
  Roling.defineRole (capabilities, name)
```

### Access.roles.DefineRole:success#2

```reaction
when Roling.defineRole (capabilities, name, role), asked by Access.roles.DefineRole:success
where
  earlier, RequestBoundary.request (capabilities, name, path: "/roles/define", requestId, session)
then
  RequestBoundary.respond (requestId, role)
```

### Access.roles.GrantRole:forbidden

```reaction
when RequestBoundary.request (context, path: "/roles/grant", requestId, role, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.roles.GrantRole:success

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

```reaction
when Roling.grant (context, role: resolved, user: subject, grant), asked by Access.roles.GrantRole:success
where
  earlier, RequestBoundary.request (context, path: "/roles/grant", requestId, role, session, user)
then
  RequestBoundary.respond (grant, requestId)
```

### Access.roles.RevokeRole:forbidden

```reaction
when RequestBoundary.request (context, path: "/roles/revoke", requestId, role, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.roles.RevokeRole:success

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

```reaction
when Roling.revoke (context, role: resolved, user: subject, grant), asked by Access.roles.RevokeRole:success
where
  earlier, RequestBoundary.request (context, path: "/roles/revoke", requestId, role, session, user)
then
  RequestBoundary.respond (grant, requestId)
```

### Access.roles.RoleCan

```reaction
when RequestBoundary.request (capability, context, path: "/roles/can", requestId, user)
where
  Roling._hasCapability (capability, context, user) has (allowed)
then
  RequestBoundary.respond (allowed, requestId)
```

### Access.roles.RoleGet

```reaction
when RequestBoundary.request (path: "/roles/get", requestId, role)
where
  Roling._getRoleDetail (role) has (capabilities, name)
then
  RequestBoundary.respond (capabilities, name, requestId)
```

### Access.roles.RoleList

```reaction
when RequestBoundary.request (path: "/roles/list", requestId)
then
  RequestBoundary.respond (requestId, roles: former "the defined roles ()")
```

### Access.roles.RolesForUser

```reaction
when RequestBoundary.request (context, path: "/roles/forUser", requestId, user)
where
  Authenticating._denotedUser (ref: user) has (user: subject)
then
  RequestBoundary.respond (requestId, roles: former "the roles held by (user) in (context)" with (context, user: subject))
```

### Course.assignments.Archive:forbidden

```reaction
when RequestBoundary.request (assignment, path: "/assignments/archive", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.Archive:success

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

```reaction
when Assigning.archive (assignment, at, result.assignment: archived), asked by Course.assignments.Archive:success
where
  earlier, RequestBoundary.request (assignment, path: "/assignments/archive", requestId, session)
then
  RequestBoundary.respond (assignment: archived, requestId)
```

### Course.assignments.ClaimedStudentSeatReceivesPublished

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

```reaction
when RequestBoundary.request (assignee, assignment, path: "/assignments/clear-due-override", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.ClearDueOverride:success

```reaction
when RequestBoundary.request (assignee, assignment, path: "/assignments/clear-due-override", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage assignments" with (user)
then
  Assigning.clearDueOverride (assignee, assignment)
```

### Course.assignments.ClearDueOverride:success#2

```reaction
when Assigning.clearDueOverride (assignee, assignment, release), asked by Course.assignments.ClearDueOverride:success
where
  earlier, RequestBoundary.request (assignee, assignment, path: "/assignments/clear-due-override", requestId, session)
then
  RequestBoundary.respond (release, requestId)
```

### Course.assignments.CreateDraft:forbidden

```reaction
when RequestBoundary.request (acceptsSubmissions, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/create-draft", requestId, session, targets, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.CreateDraft:success

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

```reaction
when Assigning.createDraft (acceptsSubmissions, at, audience, author: user, availableAt, closeAt, dueAt, instructions, kind, targets, title, assignment), asked by Course.assignments.CreateDraft:success
where
  earlier, RequestBoundary.request (acceptsSubmissions, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/create-draft", requestId, session, targets, title)
then
  RequestBoundary.respond (assignment, requestId)
```

### Course.assignments.ForMe:forbidden

```reaction
when RequestBoundary.request (path: "/assignments/for-me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.ForMe:success

```reaction
when RequestBoundary.request (path: "/assignments/for-me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  RequestBoundary.respond (assignments: former "the assignments of (student)" with (student: user), requestId)
```

### Course.assignments.GetAssignment:absent

```reaction
when RequestBoundary.request (assignment, path: "/assignments/get", requestId)
where
  no view "the assignment (assignment)" with (assignment)
then
  RequestBoundary.respond (assignment: null, requestId)
```

### Course.assignments.GetAssignment:found

```reaction
when RequestBoundary.request (assignment, path: "/assignments/get", requestId)
where
  view "the assignment (assignment)" with (assignment) has (detail)
then
  RequestBoundary.respond (assignment: detail, requestId)
```

### Course.assignments.Publish:forbidden

```reaction
when RequestBoundary.request (assignment, path: "/assignments/publish", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.Publish:success

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

```reaction
when Assigning.publish (assignment, at, result.assignment: published), asked by Course.assignments.Publish:success
where
  earlier, RequestBoundary.request (assignment, path: "/assignments/publish", requestId, session)
then
  RequestBoundary.respond (assignment: published, requestId)
```

### Course.assignments.PublishedAcceptingAssignmentGetsGradeItem

```reaction
when Assigning.publish (acceptsSubmissions: true, assignment)
where
  Assigning._getAssignments () has (assignment, title)
then
  Itemizing.ensureItem (item: assignment, label: title, maxPoints: 100)
```

### Course.assignments.PublishedAssignmentAssignsAudienceStudents:everyone

```reaction
when Assigning.publish (at, assignment, audience, targets)
where
  audience is among ["EVERYONE"]
  Rostering._getActiveStudents () has (user)
then
  Assigning.assign (assignee: user, assignment, at)
```

### Course.assignments.PublishedAssignmentAssignsAudienceStudents:targets

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

```reaction
when RequestBoundary.request (acceptsSubmissions, assignment, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/revise", requestId, session, targets, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.Revise:success

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

```reaction
when Assigning.revise (acceptsSubmissions, assignment, at, audience, availableAt, closeAt, dueAt, instructions, kind, targets, title, result.assignment: revised), asked by Course.assignments.Revise:success
where
  earlier, RequestBoundary.request (acceptsSubmissions, assignment, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/revise", requestId, session, targets, title)
then
  RequestBoundary.respond (assignment: revised, requestId)
```

### Course.assignments.RevisedAssignmentAssignsNewAudienceStudents:everyone

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

```reaction
when RequestBoundary.request (assignee, assignment, dueAt, path: "/assignments/set-due-override", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.SetDueOverride:success

```reaction
when RequestBoundary.request (assignee, assignment, dueAt, path: "/assignments/set-due-override", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage assignments" with (user)
then
  Assigning.setDueOverride (assignee, assignment, dueAt)
```

### Course.assignments.SetDueOverride:success#2

```reaction
when Assigning.setDueOverride (assignee, assignment, dueAt, release), asked by Course.assignments.SetDueOverride:success
where
  earlier, RequestBoundary.request (assignee, assignment, dueAt, path: "/assignments/set-due-override", requestId, session)
then
  RequestBoundary.respond (release, requestId)
```

### Course.assignments.StaffList:forbidden

```reaction
when RequestBoundary.request (path: "/assignments/staff-list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.StaffList:success

```reaction
when RequestBoundary.request (path: "/assignments/staff-list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage assignments" with (user)
then
  RequestBoundary.respond (assignments: former "the staff assignments ()", requestId)
```

### Course.assignments.StaffSummary:forbidden

```reaction
when RequestBoundary.request (assignment, path: "/assignments/staff-summary", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage assignments" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.StaffSummary:found

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

```reaction
when RequestBoundary.request (assignment, content, path: "/assignments/submit", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.Submit:success

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

```reaction
when Posting.create (at, author: user, content, post), asked by Course.assignments.Submit:success
where
  earlier, RequestBoundary.request (assignment, content, path: "/assignments/submit", requestId, session)
then
  Submitting.submit (artifact: post, assignment, at, submitter: user)
```

### Course.assignments.Submit:success#3

```reaction
when Submitting.submit (artifact: post, assignment, at, submitter: user, submission), asked by Course.assignments.Submit:success#2
where
  earlier, RequestBoundary.request (assignment, content, path: "/assignments/submit", requestId, session)
then
  RequestBoundary.respond (requestId, submission)
```

### Course.calendar.CalendarMe:forbidden

```reaction
when RequestBoundary.request (end, path: "/calendar/me", requestId, session, start)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.calendar.CalendarMe:success

```reaction
when RequestBoundary.request (end, path: "/calendar/me", requestId, session, start)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  RequestBoundary.respond (events: former "the calendar between (start) and (end)" with (end, start), requestId)
```

### Course.calendar.CalendarStaff:forbidden

```reaction
when RequestBoundary.request (end, path: "/calendar/staff", requestId, session, start)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view the staff calendar" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.calendar.CalendarStaff:success

```reaction
when RequestBoundary.request (end, path: "/calendar/staff", requestId, session, start)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view the staff calendar" with (user)
then
  RequestBoundary.respond (events: former "the calendar between (start) and (end)" with (end, start), requestId)
```

### Course.calendar.LmsMe:forbidden

```reaction
when RequestBoundary.request (path: "/lms/me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.calendar.LmsMe:success

```reaction
when RequestBoundary.request (path: "/lms/me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  RequestBoundary.respond (dashboard: former "the dashboard seat of (user)" with (user), requestId)
```

### Course.calendar.LmsStaffDashboard:forbidden

```reaction
when RequestBoundary.request (path: "/lms/staff-dashboard", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.calendar.LmsStaffDashboard:success

```reaction
when RequestBoundary.request (path: "/lms/staff-dashboard", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  RequestBoundary.respond (counts: former "the staff dashboard counts ()", dashboard: former "the staff dashboard ()", requestId)
```

### Course.grades.GradesAddCriterion:forbidden

```reaction
when RequestBoundary.request (item, maxPoints, name, path: "/grades/add-criterion", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesAddCriterion:success

```reaction
when RequestBoundary.request (item, maxPoints, name, path: "/grades/add-criterion", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
then
  Itemizing.addCriterion (item, maxPoints, name, position)
```

### Course.grades.GradesAddCriterion:success#2

```reaction
when Itemizing.addCriterion (item, maxPoints, name, position, criterion), asked by Course.grades.GradesAddCriterion:success
where
  earlier, RequestBoundary.request (item, maxPoints, name, path: "/grades/add-criterion", position, requestId, session)
then
  RequestBoundary.respond (criterion, requestId)
```

### Course.grades.GradesConfigureItem:forbidden

```reaction
when RequestBoundary.request (item, label, maxPoints, path: "/grades/configure-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesConfigureItem:success

```reaction
when RequestBoundary.request (item, label, maxPoints, path: "/grades/configure-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
then
  Itemizing.configureItem (item, label, maxPoints)
```

### Course.grades.GradesConfigureItem:success#2

```reaction
when Itemizing.configureItem (item, label, maxPoints, gradeItem), asked by Course.grades.GradesConfigureItem:success
where
  earlier, RequestBoundary.request (item, label, maxPoints, path: "/grades/configure-item", requestId, session)
then
  RequestBoundary.respond (gradeItem, requestId)
```

### Course.grades.GradesExcuse:forbidden

```reaction
when RequestBoundary.request (feedback, item, learner, path: "/grades/excuse", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesExcuse:success

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

```reaction
when Grading.excuse (at, feedback, grader: user, item, learner, grade), asked by Course.grades.GradesExcuse:success
where
  earlier, RequestBoundary.request (feedback, item, learner, path: "/grades/excuse", requestId, session)
then
  RequestBoundary.respond (grade, requestId)
```

### Course.grades.GradesExport:forbidden

```reaction
when RequestBoundary.request (path: "/grades/export", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view all grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesExport:success

```reaction
when RequestBoundary.request (path: "/grades/export", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view all grades" with (user)
then
  RequestBoundary.respond (csv: "", requestId)
```

### Course.grades.GradesForItem:forbidden

```reaction
when RequestBoundary.request (item, path: "/grades/for-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view all grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesForItem:success

```reaction
when RequestBoundary.request (item, path: "/grades/for-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view all grades" with (user)
then
  RequestBoundary.respond (grades: former "the grades on (item)" with (item), requestId)
```

### Course.grades.GradesForMe:not-student

```reaction
when RequestBoundary.request (path: "/grades/for-me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesForMe:success

```reaction
when RequestBoundary.request (path: "/grades/for-me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  RequestBoundary.respond (grades: former "the released grades of (learner)" with (learner: user), requestId)
```

### Course.grades.GradesForStudent:forbidden

```reaction
when RequestBoundary.request (learner, path: "/grades/for-student", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view all grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesForStudent:success

```reaction
when RequestBoundary.request (learner, path: "/grades/for-student", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view all grades" with (user)
then
  RequestBoundary.respond (grades: former "the grades of (learner)" with (learner), requestId)
```

### Course.grades.GradesGradebook:forbidden

```reaction
when RequestBoundary.request (path: "/grades/gradebook", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view all grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesGradebook:success

```reaction
when RequestBoundary.request (path: "/grades/gradebook", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view all grades" with (user)
then
  RequestBoundary.respond (learners: former "the gradebook learners ()", requestId)
```

### Course.grades.GradesRecord:forbidden

```reaction
when RequestBoundary.request (evidence, feedback, item, learner, path: "/grades/record", requestId, score, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesRecord:missing-item

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

```reaction
when Grading.record (at, evidence, feedback, grader: user, item, learner, outOf: maxPoints, score, grade), asked by Course.grades.GradesRecord:success
where
  earlier, RequestBoundary.request (evidence, feedback, item, learner, path: "/grades/record", requestId, score, session)
then
  RequestBoundary.respond (grade, requestId)
```

### Course.grades.GradesRelease:forbidden

```reaction
when RequestBoundary.request (item, learner, path: "/grades/release", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesRelease:success

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

```reaction
when Grading.release (at, item, learner, grade), asked by Course.grades.GradesRelease:success
where
  earlier, RequestBoundary.request (item, learner, path: "/grades/release", requestId, session)
then
  RequestBoundary.respond (grade, requestId)
```

### Course.grades.GradesReleaseItem:forbidden

```reaction
when RequestBoundary.request (item, path: "/grades/release-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesReleaseItem:success

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

```reaction
when Grading.releaseItem (at, item, released), asked by Course.grades.GradesReleaseItem:success
where
  earlier, RequestBoundary.request (item, path: "/grades/release-item", requestId, session)
then
  RequestBoundary.respond (released, requestId)
```

### Course.grades.GradesRemoveCriterion:forbidden

```reaction
when RequestBoundary.request (criterion, path: "/grades/remove-criterion", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesRemoveCriterion:success

```reaction
when RequestBoundary.request (criterion, path: "/grades/remove-criterion", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
then
  Itemizing.removeCriterion (criterion)
```

### Course.grades.GradesRemoveCriterion:success#2

```reaction
when Itemizing.removeCriterion (criterion, result.criterion: removed), asked by Course.grades.GradesRemoveCriterion:success
where
  earlier, RequestBoundary.request (criterion, path: "/grades/remove-criterion", requestId, session)
then
  RequestBoundary.respond (criterion: removed, requestId)
```

### Course.grades.GradesRetract:forbidden

```reaction
when RequestBoundary.request (item, learner, path: "/grades/retract", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesRetract:success

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

```reaction
when Grading.retract (at, item, learner, grade), asked by Course.grades.GradesRetract:success
where
  earlier, RequestBoundary.request (item, learner, path: "/grades/retract", requestId, session)
then
  RequestBoundary.respond (grade, requestId)
```

### Course.grades.GradesReviseCriterion:forbidden

```reaction
when RequestBoundary.request (criterion, maxPoints, name, path: "/grades/revise-criterion", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesReviseCriterion:success

```reaction
when RequestBoundary.request (criterion, maxPoints, name, path: "/grades/revise-criterion", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage grades" with (user)
then
  Itemizing.reviseCriterion (criterion, maxPoints, name, position)
```

### Course.grades.GradesReviseCriterion:success#2

```reaction
when Itemizing.reviseCriterion (criterion, maxPoints, name, position, result.criterion: revised), asked by Course.grades.GradesReviseCriterion:success
where
  earlier, RequestBoundary.request (criterion, maxPoints, name, path: "/grades/revise-criterion", position, requestId, session)
then
  RequestBoundary.respond (criterion: revised, requestId)
```

### Course.grades.GradesScoreCriterion:cross-item

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

```reaction
when RequestBoundary.request (criterion, feedback, item, learner, path: "/grades/score-criterion", points, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage grades" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesScoreCriterion:missing

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

```reaction
when Grading.scoreCriterion (criterion, feedback, item, learner, outOf: critMax, points, criterionScore), asked by Course.grades.GradesScoreCriterion:success
where
  earlier, RequestBoundary.request (criterion, feedback, item, learner, path: "/grades/score-criterion", points, requestId, session)
then
  RequestBoundary.respond (criterionScore, requestId)
```

### Course.grades.RemovedCriterionClearsScores

```reaction
when Itemizing.removeCriterion (criterion)
then
  Grading.clearCriterionScores (criterion)
```

### Course.grades.RevisedAcceptingAssignmentEnsuresGradeItem

```reaction
when Assigning.revise (title, acceptsSubmissions: true, assignment, status: "PUBLISHED")
then
  Itemizing.ensureItem (item: assignment, label: title, maxPoints: 100)
```

### Course.lateDays.Apply:forbidden

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/apply", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.Apply:success

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

```reaction
when Banking.apply (at, days, item: assignment, learner: user, use), asked by Course.lateDays.Apply:success
where
  earlier, RequestBoundary.request (assignment, days, path: "/late-days/apply", requestId, session)
then
  RequestBoundary.respond (requestId, use)
```

### Course.lateDays.Balance:balance

```reaction
when RequestBoundary.request (learner, path: "/late-days/balance", requestId, session)
where
  view "the active user of (session)" with (session) has (user: learner)
  view "(user) is an active student" with (user: learner)
then
  RequestBoundary.respond (balance: former "the late-day balance of (learner)" with (learner), requestId)
```

### Course.lateDays.Balance:balance-missing

```reaction
when RequestBoundary.request (learner, path: "/late-days/balance", requestId, session)
where
  view "the active user of (session)" with (session)
  view "(user) is not an active student" with (user: learner)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.Balance:balance-unauthorized

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

```reaction
when RequestBoundary.request (assignment, path: "/late-days/cancel", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.Cancel:success

```reaction
when RequestBoundary.request (assignment, path: "/late-days/cancel", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  Banking.cancel (item: assignment, learner: user)
```

### Course.lateDays.Cancel:success#2

```reaction
when Banking.cancel (item: assignment, learner: user, use), asked by Course.lateDays.Cancel:success
where
  earlier, RequestBoundary.request (assignment, path: "/late-days/cancel", requestId, session)
then
  RequestBoundary.respond (requestId, use)
```

### Course.lateDays.Change:forbidden

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/change", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.Change:success

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/change", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  Banking.change (days, item: assignment, learner: user)
```

### Course.lateDays.Change:success#2

```reaction
when Banking.change (days, item: assignment, learner: user, use), asked by Course.lateDays.Change:success
where
  earlier, RequestBoundary.request (assignment, days, path: "/late-days/change", requestId, session)
then
  RequestBoundary.respond (requestId, use)
```

### Course.lateDays.ConfigurePolicy:forbidden

```reaction
when RequestBoundary.request (defaultDays, maxDaysPerItem, path: "/late-days/configure-policy", requestId, session, unitHours)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage late days" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.ConfigurePolicy:success

```reaction
when RequestBoundary.request (defaultDays, maxDaysPerItem, path: "/late-days/configure-policy", requestId, session, unitHours)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage late days" with (user)
then
  Banking.setTerms (allowance: defaultDays, perItemLimit: maxDaysPerItem, unitHours)
```

### Course.lateDays.ConfigurePolicy:success#2

```reaction
when Banking.setTerms (allowance: defaultDays, perItemLimit: maxDaysPerItem, unitHours), asked by Course.lateDays.ConfigurePolicy:success
where
  earlier, RequestBoundary.request (defaultDays, maxDaysPerItem, path: "/late-days/configure-policy", requestId, session, unitHours)
then
  RequestBoundary.respond (policy: true, requestId)
```

### Course.lateDays.ForAssignment:forbidden

```reaction
when RequestBoundary.request (assignment, path: "/late-days/for-assignment", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage late days" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.ForAssignment:success

```reaction
when RequestBoundary.request (assignment, path: "/late-days/for-assignment", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage late days" with (user)
then
  RequestBoundary.respond (requestId, users: former "the late-day uses on (assignment)" with (assignment))
```

### Course.lateDays.Grant:forbidden

```reaction
when RequestBoundary.request (days, learner, path: "/late-days/grant", reason, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage late days" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.Grant:success

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

```reaction
when Banking.grant (at, days, learner, reason, grant), asked by Course.lateDays.Grant:success
where
  earlier, RequestBoundary.request (days, learner, path: "/late-days/grant", reason, requestId, session)
then
  RequestBoundary.respond (grant, requestId)
```

### Course.lateDays.List:forbidden

```reaction
when RequestBoundary.request (path: "/late-days/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.List:success

```reaction
when RequestBoundary.request (path: "/late-days/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  RequestBoundary.respond (requestId, uses: former "the late-day uses of (learner)" with (learner: user))
```

### Course.lateDays.StaffCancel:hidden

```reaction
when RequestBoundary.request (assignment, learner, path: "/late-days/staff-cancel", requestId, session)
where
  view "the active user of (session)" with (session)
  view "(user) is not an active student" with (user: learner)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.StaffCancel:success

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

```reaction
when Banking.cancel (item: assignment, learner, use), asked by Course.lateDays.StaffCancel:success
where
  earlier, RequestBoundary.request (assignment, learner, path: "/late-days/staff-cancel", requestId, session)
then
  RequestBoundary.respond (requestId, use)
```

### Course.lateDays.StaffCancel:unauthorized

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

```reaction
when RequestBoundary.request (assignment, days, learner, path: "/late-days/staff-change", requestId, session)
where
  view "the active user of (session)" with (session)
  view "(user) is not an active student" with (user: learner)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.StaffChange:success

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

```reaction
when Banking.change (days, item: assignment, learner, use), asked by Course.lateDays.StaffChange:success
where
  earlier, RequestBoundary.request (assignment, days, learner, path: "/late-days/staff-change", requestId, session)
then
  RequestBoundary.respond (requestId, use)
```

### Course.lateDays.StaffChange:unauthorized

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

```reaction
when RequestBoundary.request (note, path: "/students/notes/acknowledge", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Acknowledge:success

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

```reaction
when Noting.acknowledge (at, learner: user, note), asked by Course.notes.Acknowledge:success
where
  earlier, RequestBoundary.request (note, path: "/students/notes/acknowledge", requestId, session)
then
  RequestBoundary.respond (note, requestId)
```

### Course.notes.Archive:forbidden

```reaction
when RequestBoundary.request (note, path: "/students/notes/archive", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Archive:success

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

```reaction
when Noting.archive (at, note), asked by Course.notes.Archive:success
where
  earlier, RequestBoundary.request (note, path: "/students/notes/archive", requestId, session)
then
  RequestBoundary.respond (note, requestId)
```

### Course.notes.NotesList:forbidden

```reaction
when RequestBoundary.request (learner, path: "/students/notes/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.NotesList:success

```reaction
when RequestBoundary.request (learner, path: "/students/notes/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student notes" with (user)
then
  RequestBoundary.respond (notes: former "the staff notes on (learner)" with (learner), requestId)
```

### Course.notes.NotesVisible:forbidden

```reaction
when RequestBoundary.request (path: "/students/notes/visible", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.NotesVisible:success

```reaction
when RequestBoundary.request (path: "/students/notes/visible", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  RequestBoundary.respond (notes: former "the notes shown to (learner)" with (learner: user), requestId)
```

### Course.notes.Resolve:forbidden

```reaction
when RequestBoundary.request (note, path: "/students/notes/resolve", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Resolve:success

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

```reaction
when Noting.resolve (at, note), asked by Course.notes.Resolve:success
where
  earlier, RequestBoundary.request (note, path: "/students/notes/resolve", requestId, session)
then
  RequestBoundary.respond (note, requestId)
```

### Course.notes.Restore:forbidden

```reaction
when RequestBoundary.request (note, path: "/students/notes/restore", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Restore:success

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

```reaction
when Noting.restore (at, note), asked by Course.notes.Restore:success
where
  earlier, RequestBoundary.request (note, path: "/students/notes/restore", requestId, session)
then
  RequestBoundary.respond (note, requestId)
```

### Course.notes.Revise:forbidden

```reaction
when RequestBoundary.request (body, followUpAt, note, path: "/students/notes/revise", requestId, session, tags, visibility)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Revise:success

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

```reaction
when Noting.revise (at, body, followUpAt, note, tags, visibility), asked by Course.notes.Revise:success
where
  earlier, RequestBoundary.request (body, followUpAt, note, path: "/students/notes/revise", requestId, session, tags, visibility)
then
  RequestBoundary.respond (note, requestId)
```

### Course.notes.StudentsDetail:forbidden

```reaction
when RequestBoundary.request (path: "/students/detail", requestId, session, user: target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.StudentsDetail:found

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

```reaction
when RequestBoundary.request (body, followUpAt, learner, path: "/students/notes/write", requestId, session, tags, visibility)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student notes" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Write:success

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

```reaction
when Noting.write (at, author: user, body, followUpAt, learner, tags, visibility, note), asked by Course.notes.Write:success
where
  earlier, RequestBoundary.request (body, followUpAt, learner, path: "/students/notes/write", requestId, session, tags, visibility)
then
  RequestBoundary.respond (note, requestId)
```

### Course.roster.ClaimSeat:matched-seat

```reaction
when RequestBoundary.request (externalKey, path: "/roster/claim-seat", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "the seat matching (user) and (externalKey)" with (externalKey, user) has (seat)
then
  Rostering.claimSeat (seat, user)
```

### Course.roster.ClaimSeat:matched-seat#2

```reaction
when Rostering.claimSeat (seat, user, result.seat: claimed), asked by Course.roster.ClaimSeat:matched-seat
where
  earlier, RequestBoundary.request (externalKey, path: "/roster/claim-seat", requestId, session)
then
  RequestBoundary.respond (requestId, seat: claimed)
```

### Course.roster.ClaimSeat:missing-seat

```reaction
when RequestBoundary.request (externalKey, path: "/roster/claim-seat", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  no view "the seat matching (user) and (externalKey)" with (externalKey, user)
then
  RequestBoundary.respond (error: "SEAT_NOT_FOUND", requestId)
```

### Course.roster.ConfigureClass:forbidden

```reaction
when RequestBoundary.request (code, path: "/roster/configure-class", requestId, session, term, timezone, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.ConfigureClass:success

```reaction
when RequestBoundary.request (code, path: "/roster/configure-class", requestId, session, term, timezone, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  Rostering.configureClass (code, term, timezone, title)
```

### Course.roster.ConfigureClass:success#2

```reaction
when Rostering.configureClass (code, term, timezone, title, class), asked by Course.roster.ConfigureClass:success
where
  earlier, RequestBoundary.request (code, path: "/roster/configure-class", requestId, session, term, timezone, title)
then
  RequestBoundary.respond (class, requestId)
```

### Course.roster.DropSeat

```reaction
when RequestBoundary.request (path: "/roster/drop", requestId, seat, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Roling.requireCapability (capability: "roster:manage", context: "forum", user)
```

### Course.roster.DropSeat#2

```reaction
when Roling.requireCapability (capability: "roster:manage", context: "forum", user), asked by Course.roster.DropSeat
where
  earlier, RequestBoundary.request (path: "/roster/drop", requestId, seat, session)
then
  Rostering.dropSeat (seat)
```

### Course.roster.DropSeat#3

```reaction
when Rostering.dropSeat (seat, result.seat: dropped), asked by Course.roster.DropSeat#2
where
  earlier, RequestBoundary.request (path: "/roster/drop", requestId, seat, session)
then
  RequestBoundary.respond (requestId, seat: dropped)
```

### Course.roster.DroppedStaffSeatRevokesCourseStaff

```reaction
when Rostering.dropSeat (kind: "STAFF", user: holder)
where
  Roling._getRoleByName (name: "course-staff") has (role)
  Roling._getRoles (context: "forum", user: holder) has (role)
then
  Roling.revoke (context: "forum", role, user: holder)
```

### Course.roster.ImportPreview

```reaction
when RequestBoundary.request (csv, path: "/roster/import-preview", requestId)
then
  Rostering.previewImport (csv)
```

### Course.roster.ImportPreview#2

```reaction
when Rostering.previewImport (csv, rows), asked by Course.roster.ImportPreview
where
  earlier, RequestBoundary.request (csv, path: "/roster/import-preview", requestId)
then
  RequestBoundary.respond (requestId, rows)
```

### Course.roster.ImportSeats:forbidden

```reaction
when RequestBoundary.request (path: "/roster/import", requestId, rows, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.ImportSeats:success

```reaction
when RequestBoundary.request (path: "/roster/import", requestId, rows, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  Rostering.importSeats (rows)
```

### Course.roster.ImportSeats:success#2

```reaction
when Rostering.importSeats (rows, created, skipped), asked by Course.roster.ImportSeats:success
where
  earlier, RequestBoundary.request (path: "/roster/import", requestId, rows, session)
then
  RequestBoundary.respond (created, requestId, skipped)
```

### Course.roster.LinkUser:forbidden

```reaction
when RequestBoundary.request (path: "/roster/link-user", requestId, seat, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not manage the roster" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.LinkUser:success

```reaction
when RequestBoundary.request (path: "/roster/link-user", requestId, seat, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may manage the roster" with (user: actor)
then
  Rostering.claimSeat (seat, user)
```

### Course.roster.LinkUser:success#2

```reaction
when Rostering.claimSeat (seat, user, result.seat: linked), asked by Course.roster.LinkUser:success
where
  earlier, RequestBoundary.request (path: "/roster/link-user", requestId, seat, session, user)
then
  RequestBoundary.respond (requestId, seat: linked)
```

### Course.roster.MoveSection:forbidden

```reaction
when RequestBoundary.request (path: "/roster/move-section", requestId, seat, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.MoveSection:success

```reaction
when RequestBoundary.request (path: "/roster/move-section", requestId, seat, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  Rostering.moveSection (seat, section)
```

### Course.roster.MoveSection:success#2

```reaction
when Rostering.moveSection (seat, section, result.seat: moved), asked by Course.roster.MoveSection:success
where
  earlier, RequestBoundary.request (path: "/roster/move-section", requestId, seat, section, session)
then
  RequestBoundary.respond (requestId, seat: moved)
```

### Course.roster.ReinstateSeat:forbidden

```reaction
when RequestBoundary.request (path: "/roster/reinstate", requestId, seat, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.ReinstateSeat:success

```reaction
when RequestBoundary.request (path: "/roster/reinstate", requestId, seat, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  Rostering.reinstateSeat (seat)
```

### Course.roster.ReinstateSeat:success#2

```reaction
when Rostering.reinstateSeat (seat, result.seat: reinstated), asked by Course.roster.ReinstateSeat:success
where
  earlier, RequestBoundary.request (path: "/roster/reinstate", requestId, seat, session)
then
  RequestBoundary.respond (requestId, seat: reinstated)
```

### Course.roster.RosterList:forbidden

```reaction
when RequestBoundary.request (path: "/roster/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.RosterList:success

```reaction
when RequestBoundary.request (path: "/roster/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  RequestBoundary.respond (members: former "the roster ()", requestId)
```

### Course.roster.RosterMe:absent

```reaction
when RequestBoundary.request (path: "/roster/me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  no view "the seat of (user)" with (user)
then
  RequestBoundary.respond (requestId, seat: null)
```

### Course.roster.RosterMe:found

```reaction
when RequestBoundary.request (path: "/roster/me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "the seat of (user)" with (user) has (seat)
then
  RequestBoundary.respond (requestId, seat)
```

### Course.roster.SectionsCreate:forbidden

```reaction
when RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/create", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.SectionsCreate:success

```reaction
when RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/create", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  Rostering.createSection (location, meetingPattern, name)
```

### Course.roster.SectionsCreate:success#2

```reaction
when Rostering.createSection (location, meetingPattern, name, section), asked by Course.roster.SectionsCreate:success
where
  earlier, RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/create", requestId, session)
then
  RequestBoundary.respond (requestId, section)
```

### Course.roster.SectionsList

```reaction
when RequestBoundary.request (path: "/roster/sections/list", requestId)
then
  RequestBoundary.respond (requestId, sections: former "the sections ()")
```

### Course.roster.SectionsUpdate:forbidden

```reaction
when RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/update", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the roster" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.SectionsUpdate:success

```reaction
when RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/update", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the roster" with (user)
then
  Rostering.updateSection (location, meetingPattern, name, section)
```

### Course.roster.SectionsUpdate:success#2

```reaction
when Rostering.updateSection (location, meetingPattern, name, section, result.section: updated), asked by Course.roster.SectionsUpdate:success
where
  earlier, RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/update", requestId, section, session)
then
  RequestBoundary.respond (requestId, section: updated)
```

### Course.roster.StaffSeatGrantsCourseStaff

```reaction
when Rostering.claimSeat (user: claimer, kind: "STAFF")
where
  Roling._holdsRoleNamed (context: "forum", name: "course-staff", user: claimer) has (held: false)
then
  Roling.ensureRole (capabilities: ["roster:manage", "assignments:manage", "submissions:view-all", "grades:manage", "grades:view-all", "late-days:manage", "student-notes:manage", "calendar:view-staff"], name: "course-staff")
```

### Course.roster.StaffSeatGrantsCourseStaff#2

```reaction
when Roling.ensureRole (capabilities: ["roster:manage", "assignments:manage", "submissions:view-all", "grades:manage", "grades:view-all", "late-days:manage", "student-notes:manage", "calendar:view-staff"], name: "course-staff", role), asked by Course.roster.StaffSeatGrantsCourseStaff
where
  earlier, Rostering.claimSeat (user: claimer, kind: "STAFF")
then
  Roling.grant (context: "forum", role, user: claimer)
```

### Course.submissions.Attempts:attempts

```reaction
when RequestBoundary.request (assignment, path: "/submissions/attempts", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user: submitter)
  view "(user) is an active student" with (user: submitter)
then
  RequestBoundary.respond (attempts: former "the attempts for (assignment) by (submitter)" with (assignment, submitter), requestId)
```

### Course.submissions.Attempts:attempts-hidden

```reaction
when RequestBoundary.request (assignment, path: "/submissions/attempts", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may not view all submissions" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.Attempts:attempts-missing

```reaction
when RequestBoundary.request (assignment, path: "/submissions/attempts", requestId, session, submitter)
where
  view "the active user of (session)" with (session)
  view "(user) is not an active student" with (user: submitter)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.Attempts:staff-attempts

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

```reaction
when RequestBoundary.request (assignment, path: "/submissions/for-assignment", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not view all submissions" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.submissions.ForAssignment:success

```reaction
when RequestBoundary.request (assignment, path: "/submissions/for-assignment", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may view all submissions" with (user)
then
  RequestBoundary.respond (assigned: former "the assigned population for (assignment)" with (assignment), requestId, submissions: former "the submissions for (assignment)" with (assignment))
```

### Course.submissions.ForStudent:for-student

```reaction
when RequestBoundary.request (path: "/submissions/for-student", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user: submitter)
  view "(user) is an active student" with (user: submitter)
then
  RequestBoundary.respond (requestId, submissions: former "the submissions by (submitter)" with (submitter))
```

### Course.submissions.ForStudent:for-student-hidden

```reaction
when RequestBoundary.request (path: "/submissions/for-student", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may not view all submissions" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.ForStudent:for-student-missing

```reaction
when RequestBoundary.request (path: "/submissions/for-student", requestId, session, submitter)
where
  view "the active user of (session)" with (session)
  view "(user) is not an active student" with (user: submitter)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.ForStudent:staff-for-student

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

```reaction
when RequestBoundary.request (assignment, path: "/submissions/latest", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may not view all submissions" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.Latest:latest-missing

```reaction
when RequestBoundary.request (assignment, path: "/submissions/latest", requestId, session, submitter)
where
  view "the active user of (session)" with (session)
  view "(user) is not an active student" with (user: submitter)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.Latest:self-found

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

```reaction
when RequestBoundary.request (item, path: "/bookmarks/isSaved", requestId, session)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.bookmarks.IsSaved:success

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

```reaction
when RequestBoundary.request (path: "/bookmarks/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (bookmarks: former "the bookmarks of (user)" with (user), requestId)
```

### Forum.bookmarks.PurgeClearsBookmarks

```reaction
when Trashing.purge (item)
then
  Bookmarking.clearItem (item)
```

### Forum.bookmarks.SaveBookmark:hidden

```reaction
when RequestBoundary.request (item, path: "/bookmarks/save", requestId, session)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.bookmarks.SaveBookmark:success

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

```reaction
when Bookmarking.save (at, item, user, bookmark), asked by Forum.bookmarks.SaveBookmark:success
where
  earlier, RequestBoundary.request (item, path: "/bookmarks/save", requestId, session)
then
  RequestBoundary.respond (bookmark, requestId)
```

### Forum.bookmarks.UnsaveBookmark:hidden

```reaction
when RequestBoundary.request (item, path: "/bookmarks/unsave", requestId, session)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.bookmarks.UnsaveBookmark:success

```reaction
when RequestBoundary.request (item, path: "/bookmarks/unsave", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(post) is readable" with (post: item)
then
  Bookmarking.unsave (item, user)
```

### Forum.bookmarks.UnsaveBookmark:success#2

```reaction
when Bookmarking.unsave (item, user, bookmark), asked by Forum.bookmarks.UnsaveBookmark:success
where
  earlier, RequestBoundary.request (item, path: "/bookmarks/unsave", requestId, session)
then
  RequestBoundary.respond (bookmark, requestId)
```

### Forum.categories.AssignCategory:forbidden

```reaction
when RequestBoundary.request (category, item, path: "/categories/assign", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.categories.AssignCategory:hidden

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

```reaction
when Categorizing.assign (category, item, result.item: assigned), asked by Forum.categories.AssignCategory:success
where
  earlier, RequestBoundary.request (category, item, path: "/categories/assign", requestId, session)
then
  RequestBoundary.respond (item: assigned, requestId)
```

### Forum.categories.CategoryForItem:hidden

```reaction
when RequestBoundary.request (item, path: "/categories/forItem", requestId)
where
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.categories.CategoryForItem:success

```reaction
when RequestBoundary.request (item, path: "/categories/forItem", requestId)
where
  view "(post) is readable" with (post: item)
then
  RequestBoundary.respond (category: former "the category of (item)" with (item), requestId)
```

### Forum.categories.CategoryItems

```reaction
when RequestBoundary.request (category, path: "/categories/items", requestId)
then
  RequestBoundary.respond (items: former "the items in (category)" with (category), requestId)
```

### Forum.categories.CreateCategory:forbidden

```reaction
when RequestBoundary.request (description, name, path: "/categories/create", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not administer" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.categories.CreateCategory:success

```reaction
when RequestBoundary.request (description, name, path: "/categories/create", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may administer" with (user)
then
  Categorizing.createCategory (description, name)
```

### Forum.categories.CreateCategory:success#2

```reaction
when Categorizing.createCategory (description, name, category), asked by Forum.categories.CreateCategory:success
where
  earlier, RequestBoundary.request (description, name, path: "/categories/create", requestId, session)
then
  RequestBoundary.respond (category, requestId)
```

### Forum.categories.DeleteCategory:forbidden

```reaction
when RequestBoundary.request (category, path: "/categories/delete", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not administer" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.categories.DeleteCategory:success

```reaction
when RequestBoundary.request (category, path: "/categories/delete", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may administer" with (user)
then
  Categorizing.deleteCategory (category)
```

### Forum.categories.DeleteCategory:success#2

```reaction
when Categorizing.deleteCategory (category, result.category: deleted), asked by Forum.categories.DeleteCategory:success
where
  earlier, RequestBoundary.request (category, path: "/categories/delete", requestId, session)
then
  RequestBoundary.respond (category: deleted, requestId)
```

### Forum.categories.ListCategories

```reaction
when RequestBoundary.request (path: "/categories/list", requestId)
then
  RequestBoundary.respond (categories: former "the categories ()", requestId)
```

### Forum.categories.PurgeUnassignsCategory

```reaction
when Trashing.purge (item)
where
  Categorizing._getCategory (item)
then
  Categorizing.unassign (item)
```

### Forum.categories.UnassignCategory:forbidden

```reaction
when RequestBoundary.request (item, path: "/categories/unassign", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.categories.UnassignCategory:hidden

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

```reaction
when Categorizing.unassign (item, result.item: unassigned), asked by Forum.categories.UnassignCategory:success
where
  earlier, RequestBoundary.request (item, path: "/categories/unassign", requestId, session)
then
  RequestBoundary.respond (item: unassigned, requestId)
```

### Forum.links.Backlinks:hidden

```reaction
when RequestBoundary.request (path: "/links/backlinks", requestId, target)
where
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.links.Backlinks:success

```reaction
when RequestBoundary.request (path: "/links/backlinks", requestId, target)
where
  view "(post) is readable" with (post: target)
then
  RequestBoundary.respond (requestId, sources: former "the backlinks of (target)" with (target))
```

### Forum.links.Forward:hidden

```reaction
when RequestBoundary.request (path: "/links/forward", requestId, source)
where
  view "(post) is not readable" with (post: source)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.links.Forward:success

```reaction
when RequestBoundary.request (path: "/links/forward", requestId, source)
where
  view "(post) is readable" with (post: source)
then
  RequestBoundary.respond (requestId, targets: former "the forward links of (source)" with (source))
```

### Forum.moderation.FlagRaise:hidden

```reaction
when RequestBoundary.request (path: "/flags/raise", reason, requestId, session, target)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.FlagRaise:success

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

```reaction
when Flagging.flag (at, reason, reporter: user, target, flag), asked by Forum.moderation.FlagRaise:success
where
  earlier, RequestBoundary.request (path: "/flags/raise", reason, requestId, session, target)
then
  RequestBoundary.respond (flag, requestId)
```

### Forum.moderation.FlagResolve:forbidden

```reaction
when RequestBoundary.request (outcome, path: "/flags/resolve", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.moderation.FlagResolve:hidden

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

```reaction
when Flagging.resolve (outcome, target), asked by Forum.moderation.FlagResolve:success
where
  earlier, RequestBoundary.request (outcome, path: "/flags/resolve", requestId, session, target)
then
  RequestBoundary.respond (requestId, target)
```

### Forum.moderation.FlagsForTarget:missing-target

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

```reaction
when RequestBoundary.request (path: "/flags/forTarget", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.FlagsOpen:hidden

```reaction
when RequestBoundary.request (path: "/flags/open", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.FlagsOpen:success

```reaction
when RequestBoundary.request (path: "/flags/open", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
then
  RequestBoundary.respond (requestId, targets: former "the open flags ()")
```

### Forum.moderation.GetTrashedPost:hidden

```reaction
when RequestBoundary.request (item, path: "/moderation/posts/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.GetTrashedPost:live

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

```reaction
when RequestBoundary.request (path: "/locks/isLocked", requestId, target)
where
  no view "(target) is public" with (target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.IsLocked:success

```reaction
when RequestBoundary.request (path: "/locks/isLocked", requestId, target)
where
  view "(target) is public" with (target)
  Locking._isLocked (target) has (locked)
then
  RequestBoundary.respond (locked, requestId)
```

### Forum.moderation.IsTrashed:hidden

```reaction
when RequestBoundary.request (item, path: "/trash/isTrashed", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.IsTrashed:success

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

```reaction
when RequestBoundary.request (path: "/locks/list", requestId)
then
  RequestBoundary.respond (locked: former "the locked list ()", requestId)
```

### Forum.moderation.LockTarget:forbidden

```reaction
when RequestBoundary.request (path: "/locks/lock", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.moderation.LockTarget:hidden

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

```reaction
when Locking.lock (at, target), asked by Forum.moderation.LockTarget:success
where
  earlier, RequestBoundary.request (path: "/locks/lock", requestId, session, target)
then
  RequestBoundary.respond (requestId, target)
```

### Forum.moderation.PurgeItem:forbidden

```reaction
when RequestBoundary.request (item, path: "/trash/purge", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.moderation.PurgeItem:success

```reaction
when RequestBoundary.request (item, path: "/trash/purge", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
then
  Trashing.purge (item)
```

### Forum.moderation.PurgeItem:success#2

```reaction
when Trashing.purge (item), asked by Forum.moderation.PurgeItem:success
where
  earlier, RequestBoundary.request (item, path: "/trash/purge", requestId, session)
then
  RequestBoundary.respond (item, requestId)
```

### Forum.moderation.PurgedItemClearsModerationState:backlinks

```reaction
when Trashing.purge (item)
then
  Linking.clearBacklinks (target: item)
```

### Forum.moderation.PurgedItemClearsModerationState:conversation-lock

```reaction
when Trashing.purge (item)
where
  Conversing._getNodeByItem (item) has (node)
  Conversing._getConversation (node) has (conversation)
  Locking._isLocked (target: conversation) has (locked: true)
then
  Locking.unlock (target: conversation)
```

### Forum.moderation.PurgedItemClearsModerationState:flags

```reaction
when Trashing.purge (item)
then
  Flagging.clearTarget (target: item)
```

### Forum.moderation.PurgedItemClearsModerationState:formatting

```reaction
when Trashing.purge (item)
then
  Formatting.clear (target: item)
```

### Forum.moderation.PurgedItemClearsModerationState:item-lock

```reaction
when Trashing.purge (item)
where
  Locking._isLocked (target: item) has (locked: true)
then
  Locking.unlock (target: item)
```

### Forum.moderation.PurgedItemClearsModerationState:leaf-node

```reaction
when Trashing.purge (item)
where
  Conversing._getNodeByItem (item) has (node)
  Conversing._hasChildren (node) has (present: false)
then
  Conversing.remove (node)
```

### Forum.moderation.PurgedItemClearsModerationState:links

```reaction
when Trashing.purge (item)
then
  Linking.clearLinks (source: item)
```

### Forum.moderation.PurgedItemClearsModerationState:post

```reaction
when Trashing.purge (item)
where
  Posting._getPost (post: item)
then
  Posting.delete (post: item)
```

### Forum.moderation.PurgedItemClearsModerationState:tracking

```reaction
when Trashing.purge (item)
then
  Tracking.unregister (item)
```

### Forum.moderation.RestoreItem:forbidden

```reaction
when RequestBoundary.request (item, path: "/trash/restore", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.moderation.RestoreItem:success

```reaction
when RequestBoundary.request (item, path: "/trash/restore", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
then
  Trashing.restore (item)
```

### Forum.moderation.RestoreItem:success#2

```reaction
when Trashing.restore (item), asked by Forum.moderation.RestoreItem:success
where
  earlier, RequestBoundary.request (item, path: "/trash/restore", requestId, session)
then
  RequestBoundary.respond (item, requestId)
```

### Forum.moderation.TrashItem:forbidden

```reaction
when RequestBoundary.request (item, path: "/trash/trash", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.moderation.TrashItem:missing

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

```reaction
when Trashing.trash (at, by: user, item), asked by Forum.moderation.TrashItem:success
where
  earlier, RequestBoundary.request (item, path: "/trash/trash", requestId, session)
then
  RequestBoundary.respond (item, requestId)
```

### Forum.moderation.TrashList:hidden

```reaction
when RequestBoundary.request (path: "/trash/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.moderation.TrashList:success

```reaction
when RequestBoundary.request (path: "/trash/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
then
  RequestBoundary.respond (requestId, trashed: former "the trash bin ()")
```

### Forum.moderation.UnlockTarget:forbidden

```reaction
when RequestBoundary.request (path: "/locks/unlock", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.moderation.UnlockTarget:hidden

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

```reaction
when Locking.unlock (target), asked by Forum.moderation.UnlockTarget:success
where
  earlier, RequestBoundary.request (path: "/locks/unlock", requestId, session, target)
then
  RequestBoundary.respond (requestId, target)
```

### Forum.notifications.AcceptNotifiesAnswerAuthor

```reaction
when Resolving.accept (answer, at, by)
where
  Posting._getPost (post: answer) has (author: answerAuthor)
  Posting._getPost (post: answer) and not (author: by)
then
  Notifying.notify (at, kind: "accepted", link: answer, recipient: answerAuthor, subject: answer)
```

### Forum.notifications.Dismiss

```reaction
when RequestBoundary.request (notification, path: "/notifications/dismiss", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Notifying.dismiss (notification, recipient: user)
```

### Forum.notifications.Dismiss#2

```reaction
when Notifying.dismiss (notification, recipient: user, result.notification: dismissed), asked by Forum.notifications.Dismiss
where
  earlier, RequestBoundary.request (notification, path: "/notifications/dismiss", requestId, session)
then
  RequestBoundary.respond (notification: dismissed, requestId)
```

### Forum.notifications.EditMentionsNotify

```reaction
when Posting.edit (at, post)
where
  view "the other users mentioned in (post)" with (post) has (user: mentioned)
  view "(user) is not yet notified about (subject)" with (subject: post, user: mentioned)
then
  Notifying.notify (at, kind: "mention", link: post, recipient: mentioned, subject: post)
```

### Forum.notifications.ListNotifications

```reaction
when RequestBoundary.request (path: "/notifications/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (notifications: former "the notifications of (user)" with (user), requestId)
```

### Forum.notifications.MarkAllRead

```reaction
when RequestBoundary.request (path: "/notifications/markAllRead", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Notifying.markAllRead (recipient: user)
```

### Forum.notifications.MarkAllRead#2

```reaction
when Notifying.markAllRead (recipient: user, result.recipient), asked by Forum.notifications.MarkAllRead
where
  earlier, RequestBoundary.request (path: "/notifications/markAllRead", requestId, session)
then
  RequestBoundary.respond (recipient, requestId)
```

### Forum.notifications.MarkRead

```reaction
when RequestBoundary.request (notification, path: "/notifications/markRead", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Notifying.markRead (notification, recipient: user)
```

### Forum.notifications.MarkRead#2

```reaction
when Notifying.markRead (notification, recipient: user, result.notification: marked), asked by Forum.notifications.MarkRead
where
  earlier, RequestBoundary.request (notification, path: "/notifications/markRead", requestId, session)
then
  RequestBoundary.respond (notification: marked, requestId)
```

### Forum.notifications.NotificationQueuesEmail

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

```reaction
when Trashing.purge (item)
then
  Notifying.clearSubject (subject: item)
```

### Forum.notifications.ReadInbox

```reaction
when RequestBoundary.request (path: "/notifications/inbox", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (notifications: former "the inbox of (user)" with (user), requestId)
```

### Forum.notifications.ReplyMentionsNotify

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

```reaction
when Conversing.start (at, item)
where
  view "the other users mentioned in (post)" with (post: item) has (user: mentioned)
then
  Notifying.notify (at, kind: "mention", link: item, recipient: mentioned, subject: item)
```

### Forum.notifications.UnreadCount

```reaction
when RequestBoundary.request (path: "/notifications/unreadCount", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  Notifying._getUnreadCount (recipient: user) has (count)
then
  RequestBoundary.respond (count, requestId)
```

### Forum.pins.IsPinned:hidden

```reaction
when RequestBoundary.request (item, path: "/pins/isPinned", requestId, scope)
where
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.pins.IsPinned:success

```reaction
when RequestBoundary.request (item, path: "/pins/isPinned", requestId, scope)
where
  view "(post) is readable" with (post: item)
  Pinning._isPinned (item, scope) has (pinned)
then
  RequestBoundary.respond (pinned, requestId)
```

### Forum.pins.PinItem:forbidden

```reaction
when RequestBoundary.request (item, path: "/pins/pin", priority, requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not pin in (scope)" with (scope, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.pins.PinItem:hidden

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

```reaction
when Pinning.pin (at, item, priority, scope, pin), asked by Forum.pins.PinItem:success
where
  earlier, RequestBoundary.request (item, path: "/pins/pin", priority, requestId, scope, session)
then
  RequestBoundary.respond (pin, requestId)
```

### Forum.pins.PinsForScope

```reaction
when RequestBoundary.request (path: "/pins/forScope", requestId, scope)
then
  RequestBoundary.respond (pinned: former "the pins of (scope)" with (scope), requestId)
```

### Forum.pins.PurgeClearsPins

```reaction
when Trashing.purge (item)
then
  Pinning.clearItem (item)
```

### Forum.pins.SetPinPriority:forbidden

```reaction
when RequestBoundary.request (item, path: "/pins/setPriority", priority, requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not pin in (scope)" with (scope, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.pins.SetPinPriority:hidden

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

```reaction
when Pinning.setPriority (item, priority, scope, pin), asked by Forum.pins.SetPinPriority:success
where
  earlier, RequestBoundary.request (item, path: "/pins/setPriority", priority, requestId, scope, session)
then
  RequestBoundary.respond (pin, requestId)
```

### Forum.pins.UnpinItem:forbidden

```reaction
when RequestBoundary.request (item, path: "/pins/unpin", requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not pin in (scope)" with (scope, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.pins.UnpinItem:hidden

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

```reaction
when Pinning.unpin (item, scope, pin), asked by Forum.pins.UnpinItem:success
where
  earlier, RequestBoundary.request (item, path: "/pins/unpin", requestId, scope, session)
then
  RequestBoundary.respond (pin, requestId)
```

### Forum.posts.DeletePost:delete

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

```reaction
when Posting.delete (post), asked by Forum.posts.DeletePost:delete
where
  earlier, RequestBoundary.request (path: "/posts/delete", post, requestId, session)
then
  RequestBoundary.respond (post, requestId)
```

### Forum.posts.DeletePost:forbidden

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

```reaction
when RequestBoundary.request (path: "/posts/delete", post, requestId, session)
where
  view "the active user of (session)" with (session)
  no Posting._getPost (post)
then
  RequestBoundary.respond (error: "POST_NOT_FOUND", requestId)
```

### Forum.posts.DeletePost:trashed

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

```reaction
when Posting.delete (post)
then
  Linking.clearBacklinks (target: post)
```

### Forum.posts.DeletedPostClearsSatellites:bookmarks

```reaction
when Posting.delete (post)
then
  Bookmarking.clearItem (item: post)
```

### Forum.posts.DeletedPostClearsSatellites:formatting

```reaction
when Posting.delete (post)
then
  Formatting.clear (target: post)
```

### Forum.posts.DeletedPostClearsSatellites:leaf-node

```reaction
when Posting.delete (post)
where
  Conversing._getNodeByItem (item: post) has (node)
  Conversing._hasChildren (node) has (present: false)
then
  Conversing.remove (node)
```

### Forum.posts.DeletedPostClearsSatellites:links

```reaction
when Posting.delete (post)
then
  Linking.clearLinks (source: post)
```

### Forum.posts.DeletedPostClearsSatellites:pins

```reaction
when Posting.delete (post)
then
  Pinning.clearItem (item: post)
```

### Forum.posts.DeletedPostClearsSatellites:reactions

```reaction
when Posting.delete (post)
then
  Reacting.clearTarget (target: post)
```

### Forum.posts.DeletedPostClearsSatellites:tags

```reaction
when Posting.delete (post)
then
  Tagging.clearTarget (target: post)
```

### Forum.posts.DeletedPostClearsSatellites:tracking

```reaction
when Posting.delete (post)
then
  Tracking.unregister (item: post)
```

### Forum.posts.EditPost:missing-post

```reaction
when RequestBoundary.request (content, path: "/posts/edit", post, requestId, session)
where
  view "the active user of (session)" with (session)
  no Posting._getPost (post)
then
  RequestBoundary.respond (error: "POST_NOT_FOUND", requestId)
```

### Forum.posts.EditPost:post

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

```reaction
when Posting.edit (at, content, post), asked by Forum.posts.EditPost:post
where
  earlier, RequestBoundary.request (content, path: "/posts/edit", post, requestId, session)
then
  RequestBoundary.respond (post, requestId)
```

### Forum.posts.EditPost:post-forbidden

```reaction
when RequestBoundary.request (content, path: "/posts/edit", post, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not edit (post)" with (post, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.posts.EditPost:trashed-post

```reaction
when RequestBoundary.request (content, path: "/posts/edit", post, requestId, session)
where
  view "the active user of (session)" with (session)
  Trashing._isTrashed (item: post) has (trashed: true)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.posts.EditedPostRefreshesDerivedContent:links

```reaction
when Posting.edit (content, post)
then
  Linking.setLinksFrom (content, source: post)
```

### Forum.posts.EditedPostRefreshesDerivedContent:render

```reaction
when Posting.edit (content, post)
then
  Formatting.setSource (source: content, target: post)
```

### Forum.posts.GetPost:not-found

```reaction
when RequestBoundary.request (path: "/posts/get", post, requestId)
where
  view "(post) is not readable" with (post)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.posts.GetPost:success

```reaction
when RequestBoundary.request (path: "/posts/get", post, requestId)
where
  view "(post) is readable" with (post)
then
  RequestBoundary.respond (post: former "the post (post)" with (post), requestId)
```

### Forum.posts.PostsByAuthor

```reaction
when RequestBoundary.request (author, path: "/posts/byAuthor", requestId)
then
  RequestBoundary.respond (posts: former "the public posts of (author)" with (author), requestId)
```

### Forum.profiles.GetProfile:hidden

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

```reaction
when RequestBoundary.request (path: "/profiles/get", requestId, session, user)
where
  view "the active user of (session)" with (session)
  no view "the profile of (user)" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.profiles.GetProfile:staff

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

```reaction
when RequestBoundary.request (path: "/profiles/get", requestId, session, user)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active course member" with (user)
  view "the profile of (user)" with (user)
then
  RequestBoundary.respond (profile: former "the private profile of (user)" with (user), requestId)
```

### Forum.profiles.ResolvePublicUser

```reaction
when RequestBoundary.request (path: "/users/resolve", ref, requestId)
where
  Authenticating._resolveIdentity (ref) has (user, username)
then
  RequestBoundary.respond (requestId, user, username)
```

### Forum.profiles.SearchUsers:hidden

```reaction
when RequestBoundary.request (path: "/users/search", query, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  no view "(user) is an active course member" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.profiles.SearchUsers:success

```reaction
when RequestBoundary.request (path: "/users/search", query, requestId, session)
where
  view "the active user of (session)" with (session) has (user: queryUser)
  view "(user) is an active course member" with (user: queryUser)
then
  RequestBoundary.respond (requestId, users: former "the user search (query)" with (query))
```

### Forum.profiles.SetAvatar

```reaction
when RequestBoundary.request (avatar, path: "/profiles/setAvatar", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Profiling.setAvatar (avatar, user)
```

### Forum.profiles.SetAvatar#2

```reaction
when Profiling.setAvatar (avatar, user), asked by Forum.profiles.SetAvatar
where
  earlier, RequestBoundary.request (avatar, path: "/profiles/setAvatar", requestId, session)
then
  RequestBoundary.respond (requestId, user)
```

### Forum.profiles.SetBio

```reaction
when RequestBoundary.request (bio, path: "/profiles/setBio", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Profiling.setBio (bio, user)
```

### Forum.profiles.SetBio#2

```reaction
when Profiling.setBio (bio, user), asked by Forum.profiles.SetBio
where
  earlier, RequestBoundary.request (bio, path: "/profiles/setBio", requestId, session)
then
  RequestBoundary.respond (requestId, user)
```

### Forum.profiles.SetDisplayName

```reaction
when RequestBoundary.request (displayName, path: "/profiles/setDisplayName", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Profiling.setDisplayName (displayName, user)
```

### Forum.profiles.SetDisplayName#2

```reaction
when Profiling.setDisplayName (displayName, user), asked by Forum.profiles.SetDisplayName
where
  earlier, RequestBoundary.request (displayName, path: "/profiles/setDisplayName", requestId, session)
then
  RequestBoundary.respond (requestId, user)
```

### Forum.reactions.AddReaction:hidden

```reaction
when RequestBoundary.request (kind, path: "/reactions/add", requestId, session, target)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.reactions.AddReaction:success

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

```reaction
when Reacting.react (at, kind, reactor: user, target, reaction), asked by Forum.reactions.AddReaction:success
where
  earlier, RequestBoundary.request (kind, path: "/reactions/add", requestId, session, target)
then
  RequestBoundary.respond (reaction, requestId)
```

### Forum.reactions.PurgeClearsReactions

```reaction
when Trashing.purge (item)
then
  Reacting.clearTarget (target: item)
```

### Forum.reactions.ReactionsForTarget:hidden

```reaction
when RequestBoundary.request (path: "/reactions/forTarget", requestId, target)
where
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.reactions.ReactionsForTarget:success

```reaction
when RequestBoundary.request (path: "/reactions/forTarget", requestId, target)
where
  view "(post) is readable" with (post: target)
then
  RequestBoundary.respond (reactions: former "the reactions on (target)" with (target), requestId)
```

### Forum.reactions.RemoveReaction:hidden

```reaction
when RequestBoundary.request (kind, path: "/reactions/remove", requestId, session, target)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.reactions.RemoveReaction:success

```reaction
when RequestBoundary.request (kind, path: "/reactions/remove", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(post) is readable" with (post: target)
then
  Reacting.unreact (kind, reactor: user, target)
```

### Forum.reactions.RemoveReaction:success#2

```reaction
when Reacting.unreact (kind, reactor: user, target, reaction), asked by Forum.reactions.RemoveReaction:success
where
  earlier, RequestBoundary.request (kind, path: "/reactions/remove", requestId, session, target)
then
  RequestBoundary.respond (ok: true, requestId)
```

### Forum.resolutions.AcceptAnswer:accepted

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

```reaction
when Resolving.accept (answer, at, by: user, question, resolution), asked by Forum.resolutions.AcceptAnswer:accepted
where
  earlier, RequestBoundary.request (answer, path: "/resolutions/accept", question, requestId, session)
then
  RequestBoundary.respond (requestId, resolution)
```

### Forum.resolutions.AcceptAnswer:hidden-answer

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

```reaction
when RequestBoundary.request (answer, path: "/resolutions/accept", question, requestId, session)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: question)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.resolutions.AcceptAnswer:not-author

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

```reaction
when RequestBoundary.request (path: "/resolutions/clear", question, requestId, session)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: question)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.resolutions.ClearResolution:not-author

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

```reaction
when Resolving.clear (question, result.question: cleared), asked by Forum.resolutions.ClearResolution:success
where
  earlier, RequestBoundary.request (path: "/resolutions/clear", question, requestId, session)
then
  RequestBoundary.respond (question: cleared, requestId)
```

### Forum.resolutions.GetResolution:hidden

```reaction
when RequestBoundary.request (path: "/resolutions/get", question, requestId)
where
  view "(post) is not readable" with (post: question)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.resolutions.GetResolution:success

```reaction
when RequestBoundary.request (path: "/resolutions/get", question, requestId)
where
  view "(post) is readable" with (post: question)
then
  RequestBoundary.respond (requestId, resolution: former "the resolution of (question)" with (question))
```

### Forum.resolutions.IsResolved:hidden

```reaction
when RequestBoundary.request (path: "/resolutions/isResolved", question, requestId)
where
  view "(post) is not readable" with (post: question)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.resolutions.IsResolved:success

```reaction
when RequestBoundary.request (path: "/resolutions/isResolved", question, requestId)
where
  view "(post) is readable" with (post: question)
  Resolving._isResolved (question) has (resolved)
then
  RequestBoundary.respond (requestId, resolved)
```

### Forum.resolutions.PurgedPostClearsResolutions:answer

```reaction
when Trashing.purge (item)
where
  Resolving._getQuestionsAnswered (answer: item) has (question) and not (question: item)
then
  Resolving.clear (question)
```

### Forum.resolutions.PurgedPostClearsResolutions:question

```reaction
when Trashing.purge (item)
where
  Resolving._getResolution (question: item)
then
  Resolving.clear (question: item)
```

### Forum.revisions.GetRevision:hidden

```reaction
when RequestBoundary.request (item, number, path: "/revisions/get", requestId)
where
  Trashing._isTrashed (item) has (trashed: true)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.GetRevision:missing

```reaction
when RequestBoundary.request (item, number, path: "/revisions/get", requestId)
where
  no Posting._getPost (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.GetRevision:success

```reaction
when RequestBoundary.request (item, number, path: "/revisions/get", requestId)
where
  Posting._getPost (post: item)
  view "(item) is intact" with (item)
then
  RequestBoundary.respond (requestId, revision: former "the revision numbered (number) of (item)" with (item, number))
```

### Forum.revisions.LatestRevision:hidden

```reaction
when RequestBoundary.request (item, path: "/revisions/latest", requestId)
where
  Trashing._isTrashed (item) has (trashed: true)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.LatestRevision:missing

```reaction
when RequestBoundary.request (item, path: "/revisions/latest", requestId)
where
  no Posting._getPost (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.LatestRevision:success

```reaction
when RequestBoundary.request (item, path: "/revisions/latest", requestId)
where
  Posting._getPost (post: item)
  view "(item) is intact" with (item)
then
  RequestBoundary.respond (requestId, revision: former "the latest revision of (item)" with (item))
```

### Forum.revisions.ListRevisions:hidden

```reaction
when RequestBoundary.request (item, path: "/revisions/list", requestId)
where
  Trashing._isTrashed (item) has (trashed: true)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ListRevisions:missing

```reaction
when RequestBoundary.request (item, path: "/revisions/list", requestId)
where
  no Posting._getPost (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ListRevisions:success

```reaction
when RequestBoundary.request (item, path: "/revisions/list", requestId)
where
  Posting._getPost (post: item)
  view "(item) is intact" with (item)
then
  RequestBoundary.respond (requestId, revisions: former "the revision history of (item)" with (item))
```

### Forum.revisions.ModeratorGetRevision:hidden

```reaction
when RequestBoundary.request (item, number, path: "/moderation/revisions/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ModeratorGetRevision:live

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

```reaction
when RequestBoundary.request (item, path: "/moderation/revisions/latest", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ModeratorLatestRevision:live

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

```reaction
when RequestBoundary.request (item, path: "/moderation/revisions/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.revisions.ModeratorListRevisions:live

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

```reaction
when Trashing.purge (item)
then
  Revising.clearItem (item)
```

### Forum.revisions.RecordRevisionOnCreate

```reaction
when Posting.create (at, content, post)
then
  Revising.record (at, content, item: post)
```

### Forum.revisions.RecordRevisionOnEdit

```reaction
when Posting.edit (at, content, post)
then
  Revising.record (at, content, item: post)
```

### Forum.subscriptions.IsSubscribed:hidden

```reaction
when RequestBoundary.request (path: "/subscriptions/isSubscribed", requestId, session, target)
where
  view "the active user of (session)" with (session)
  no view "(conversation) is readable" with (conversation: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.subscriptions.IsSubscribed:success

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

```reaction
when RequestBoundary.request (path: "/subscriptions/mine", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (requestId, subscriptions: former "the subscriptions of (user)" with (user))
```

### Forum.subscriptions.PurgeClearsConversationSubscriptions

```reaction
when Trashing.purge (item)
where
  Conversing._getNodeByItem (item) has (node)
  Conversing._getConversation (node) has (conversation)
then
  Subscribing.clearTarget (target: conversation)
```

### Forum.subscriptions.Subscribe:hidden

```reaction
when RequestBoundary.request (path: "/subscriptions/subscribe", requestId, session, target)
where
  view "the active user of (session)" with (session)
  no view "(conversation) is readable" with (conversation: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.subscriptions.Subscribe:success

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

```reaction
when Subscribing.subscribe (at, target, user, subscription), asked by Forum.subscriptions.Subscribe:success
where
  earlier, RequestBoundary.request (path: "/subscriptions/subscribe", requestId, session, target)
then
  RequestBoundary.respond (requestId, subscription)
```

### Forum.subscriptions.Subscribers:hidden

```reaction
when RequestBoundary.request (path: "/subscriptions/subscribers", requestId, target)
where
  no view "(conversation) is readable" with (conversation: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.subscriptions.Subscribers:success

```reaction
when RequestBoundary.request (path: "/subscriptions/subscribers", requestId, target)
where
  view "(conversation) is readable" with (conversation: target)
then
  RequestBoundary.respond (requestId, subscribers: former "the subscribers of (target)" with (target))
```

### Forum.subscriptions.Unsubscribe:hidden

```reaction
when RequestBoundary.request (path: "/subscriptions/unsubscribe", requestId, session, target)
where
  view "the active user of (session)" with (session)
  no view "(conversation) is readable" with (conversation: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.subscriptions.Unsubscribe:success

```reaction
when RequestBoundary.request (path: "/subscriptions/unsubscribe", requestId, session, target)
where
  view "the active user of (session)" with (session) has (user)
  view "(conversation) is readable" with (conversation: target)
then
  Subscribing.unsubscribe (target, user)
```

### Forum.subscriptions.Unsubscribe:success#2

```reaction
when Subscribing.unsubscribe (target, user, subscription), asked by Forum.subscriptions.Unsubscribe:success
where
  earlier, RequestBoundary.request (path: "/subscriptions/unsubscribe", requestId, session, target)
then
  RequestBoundary.respond (requestId, subscription)
```

### Forum.tags.AddTag:hidden

```reaction
when RequestBoundary.request (path: "/tags/add", requestId, session, tag, target)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.tags.AddTag:success

```reaction
when RequestBoundary.request (path: "/tags/add", requestId, session, tag, target)
where
  view "the active user of (session)" with (session)
  view "(post) is readable" with (post: target)
then
  Tagging.addTag (tag, target)
```

### Forum.tags.AddTag:success#2

```reaction
when Tagging.addTag (tag, target, result.target: tagged), asked by Forum.tags.AddTag:success
where
  earlier, RequestBoundary.request (path: "/tags/add", requestId, session, tag, target)
then
  RequestBoundary.respond (requestId, target: tagged)
```

### Forum.tags.CreateTag

```reaction
when RequestBoundary.request (name, path: "/tags/create", requestId, session)
where
  view "the active user of (session)" with (session)
then
  Tagging.createTag (name)
```

### Forum.tags.CreateTag#2

```reaction
when Tagging.createTag (name, tag), asked by Forum.tags.CreateTag
where
  earlier, RequestBoundary.request (name, path: "/tags/create", requestId, session)
then
  RequestBoundary.respond (requestId, tag)
```

### Forum.tags.ListTags

```reaction
when RequestBoundary.request (path: "/tags/list", requestId)
then
  RequestBoundary.respond (requestId, tags: former "the tags ()")
```

### Forum.tags.PurgeClearsTags

```reaction
when Trashing.purge (item)
then
  Tagging.clearTarget (target: item)
```

### Forum.tags.RemoveTag:hidden

```reaction
when RequestBoundary.request (path: "/tags/remove", requestId, session, tag, target)
where
  view "the active user of (session)" with (session)
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.tags.RemoveTag:success

```reaction
when RequestBoundary.request (path: "/tags/remove", requestId, session, tag, target)
where
  view "the active user of (session)" with (session)
  view "(post) is readable" with (post: target)
then
  Tagging.removeTag (tag, target)
```

### Forum.tags.RemoveTag:success#2

```reaction
when Tagging.removeTag (tag, target, result.target: untagged), asked by Forum.tags.RemoveTag:success
where
  earlier, RequestBoundary.request (path: "/tags/remove", requestId, session, tag, target)
then
  RequestBoundary.respond (requestId, target: untagged)
```

### Forum.tags.TagTargets

```reaction
when RequestBoundary.request (path: "/tags/targets", requestId, tag)
then
  RequestBoundary.respond (requestId, targets: former "the targets tagged (tag)" with (tag))
```

### Forum.tags.TagTargetsByName

```reaction
when RequestBoundary.request (name, path: "/tags/targetsByName", requestId)
then
  RequestBoundary.respond (requestId, targets: former "the targets tagged with (name)" with (name))
```

### Forum.tags.TagsForTarget:hidden

```reaction
when RequestBoundary.request (path: "/tags/forTarget", requestId, target)
where
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.tags.TagsForTarget:success

```reaction
when RequestBoundary.request (path: "/tags/forTarget", requestId, target)
where
  view "(post) is readable" with (post: target)
then
  RequestBoundary.respond (requestId, tags: former "the tags on (target)" with (target))
```

### Forum.threads.CreateThread

```reaction
when RequestBoundary.request (content, path: "/threads/create", requestId, session)
where
  Timing._now () has (at)
  view "the active user of (session)" with (session) has (user)
then
  Posting.create (at, author: user, content)
```

### Forum.threads.CreateThread#2

```reaction
when Posting.create (at, author: user, content, post), asked by Forum.threads.CreateThread
then
  Conversing.start (at, item: post)
```

### Forum.threads.CreateThread#3

```reaction
when Conversing.start (at, item: post, conversation, node), asked by Forum.threads.CreateThread#2
where
  earlier, RequestBoundary.request (content, path: "/threads/create", requestId, session)
then
  RequestBoundary.respond (conversation, node, post, requestId)
```

### Forum.threads.CreatedPostRefreshesDerivedContent:links

```reaction
when Posting.create (content, post)
then
  Linking.setLinksFrom (content, source: post)
```

### Forum.threads.CreatedPostRefreshesDerivedContent:render

```reaction
when Posting.create (content, post)
then
  Formatting.setSource (source: content, target: post)
```

### Forum.threads.ForItem:absent

```reaction
when RequestBoundary.request (item, path: "/threads/forItem", requestId)
where
  no view "the conversation placing (item)" with (item)
then
  RequestBoundary.respond (conversation: null, requestId)
```

### Forum.threads.ForItem:found

```reaction
when RequestBoundary.request (item, path: "/threads/forItem", requestId)
where
  view "the conversation placing (item)" with (item) has (conversation)
then
  RequestBoundary.respond (conversation, requestId)
```

### Forum.threads.GetThread

```reaction
when RequestBoundary.request (conversation, path: "/threads/get", requestId)
then
  RequestBoundary.respond (context: former "the thread context (conversation)" with (conversation), requestId, thread: former "the thread (conversation)" with (conversation))
```

### Forum.threads.ListActivity

```reaction
when RequestBoundary.request (path: "/threads/activity", requestId)
then
  RequestBoundary.respond (conversations: former "the home feed by activity ()", requestId)
```

### Forum.threads.ListLatest

```reaction
when RequestBoundary.request (path: "/threads/latest", requestId)
then
  RequestBoundary.respond (conversations: former "the home feed by creation ()", requestId)
```

### Forum.threads.ReplyToThread:locked

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

```reaction
when RequestBoundary.request (content, parent, path: "/threads/reply", requestId, session)
where
  view "the active user of (session)" with (session)
  no Conversing._getConversation (node: parent)
then
  RequestBoundary.respond (error: "PARENT_NODE_NOT_FOUND", requestId)
```

### Forum.threads.ReplyToThread:reply

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

```reaction
when Posting.create (at, author: user, content, post), asked by Forum.threads.ReplyToThread:reply
where
  earlier, RequestBoundary.request (content, parent, path: "/threads/reply", requestId, session)
then
  Conversing.reply (at, item: post, parent)
```

### Forum.threads.ReplyToThread:reply#3

```reaction
when Conversing.reply (at, item: post, parent, node), asked by Forum.threads.ReplyToThread:reply#2
where
  earlier, RequestBoundary.request (content, parent, path: "/threads/reply", requestId, session)
then
  RequestBoundary.respond (node, post, requestId)
```

### Forum.threads.TrackReplyUnread

```reaction
when Conversing.reply (item, node)
where
  Conversing._getConversation (node) has (conversation)
then
  Tracking.register (item, scope: conversation)
```

### Forum.threads.TrackRootUnread

```reaction
when Conversing.start (item, conversation)
then
  Tracking.register (item, scope: conversation)
```

### Forum.unread.MarkAllSeen

```reaction
when RequestBoundary.request (path: "/unread/markAllSeen", requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Tracking.markAllSeen (scope, user)
```

### Forum.unread.MarkAllSeen#2

```reaction
when Tracking.markAllSeen (scope, user), asked by Forum.unread.MarkAllSeen
where
  earlier, RequestBoundary.request (path: "/unread/markAllSeen", requestId, scope, session)
then
  RequestBoundary.respond (requestId, user)
```

### Forum.unread.MarkSeen

```reaction
when RequestBoundary.request (item, path: "/unread/markSeen", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Tracking.markSeen (item, user)
```

### Forum.unread.MarkSeen#2

```reaction
when Tracking.markSeen (item, user), asked by Forum.unread.MarkSeen
where
  earlier, RequestBoundary.request (item, path: "/unread/markSeen", requestId, session)
then
  RequestBoundary.respond (item, requestId)
```

### Forum.unread.UnreadCount

```reaction
when RequestBoundary.request (path: "/unread/count", requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  Tracking._getUnreadCount (scope, user) has (count)
then
  RequestBoundary.respond (count, requestId)
```

### Forum.unread.UnreadList

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
- `/assignments/get` — requires `assignment`
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
- `/grades/excuse` — requires `feedback`, `item`, `learner`, `session`
- `/grades/export` — requires `session`
- `/grades/for-item` — requires `item`, `session`
- `/grades/for-me` — requires `session`
- `/grades/for-student` — requires `learner`, `session`
- `/grades/gradebook` — requires `session`
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
- `/roster/configure-class` — requires `code`, `session`, `term`, `timezone`, `title`
- `/roster/drop` — requires `seat`, `session`
- `/roster/import` — requires `rows`, `session`
- `/roster/import-preview` — requires `csv`
- `/roster/link-user` — requires `seat`, `session`, `user`
- `/roster/list` — requires `session`
- `/roster/me` — requires `session`
- `/roster/move-section` — requires `seat`, `section`, `session`
- `/roster/reinstate` — requires `seat`, `session`
- `/roster/sections/create` — requires `session`, `name`; fills `location` with null when absent; fills `meetingPattern` with null when absent
- `/roster/sections/update` — requires `location`, `meetingPattern`, `name`, `section`, `session`
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
