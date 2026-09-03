<!-- Generated from the Commons assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.0.0-beta.16; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.0.0-beta.16. -->

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
  - Refuses `ASSIGNMENT_SCHEDULE_INVALID`: Availability must be on or before the due date, and the due date must be on or before close.
- `revise(assignment: Assignment, title: String, instructions: String, kind: String, availableAt: Date, dueAt: Date, closeAt: Date, acceptsSubmissions: Bool, audience: String, targets: Sections, at: Date) : return (assignment: Assignment, status: String, audience: String, targets: Sections, acceptsSubmissions: Bool)`
  - Refuses `ASSIGNMENT_NOT_FOUND`: There is no such assignment.
  - Refuses `ASSIGNMENT_NOT_REVISABLE`: An archived assignment can no longer be revised.
  - Refuses `ASSIGNMENT_EVERYONE_NO_TARGETS`: An assignment addressed to everyone cannot list targets.
  - Refuses `ASSIGNMENT_TARGETS_REQUIRED`: A targeted assignment needs at least one target.
  - Refuses `ASSIGNMENT_AUDIENCE_INVALID`: The assignment audience must be EVERYONE or TARGETS.
  - Refuses `ASSIGNMENT_SCHEDULE_INVALID`: Availability must be on or before the due date, and the due date must be on or before close.
- `publish(assignment: Assignment, at: Date) : return (assignment: Assignment, audience: String, targets: Sections, acceptsSubmissions: Bool)`
  - Refuses `ASSIGNMENT_NOT_FOUND`: There is no such assignment.
  - Refuses `ASSIGNMENT_NOT_DRAFT`: Only a draft can be published.
  - Refuses `ASSIGNMENT_SCHEDULE_INVALID`: Availability must be on or before the due date, and the due date must be on or before close.
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

- `Assigning` — instance of `Assigning` — [Commons application](../design/application.md), line 100.
  - `Assignee` is `Authenticating.User` — [Commons application](../design/application.md), line 102.
  - `Author` is `Authenticating.User` — [Commons application](../design/application.md), line 101.
  - `Sections` is `Rostering.Section` — [Commons application](../design/application.md), line 103.

### Authenticating

Defined in [Authenticating](../design/concepts/Authenticating.md), line 1.

#### Actions

- `register(username: String, password: String, email: String) : return (user: User)`
  - Refuses `INVALID_BODY`: The email address is not well formed.
  - Refuses `USERNAME_INVALID_LENGTH`: The username must be 3 to 32 characters long.
  - Refuses `USERNAME_INVALID_CHARS`: The username must start with a letter and contain only letters, digits, hyphens, and underscores.
  - Refuses `PASSWORD_INVALID_LENGTH`: The password must be 8 to 128 characters long.
  - Refuses `USERNAME_TAKEN`: That username is already taken.
  - Refuses `EMAIL_TAKEN`: That email address already has an account.
- `authenticate(username: String, password: String) : return (user: User)`
  - Refuses `INVALID_CREDENTIALS`: Unknown username or wrong password.
- `changePassword(user: User, oldPassword: String, newPassword: String) : return (user: User)`
  - Refuses `INVALID_CREDENTIALS`: The current password is wrong.
  - Refuses `PASSWORD_INVALID_LENGTH`: The password must be 8 to 128 characters long.
- `resetPassword(user: User, newPassword: String) : return (user: User)`
  - Refuses `INVALID_CREDENTIALS`: There is no such account.
  - Refuses `PASSWORD_INVALID_LENGTH`: The password must be 8 to 128 characters long.

#### Queries

- `_getById(user: String) : optional (username: String, email: String)`
- `_getByEmail(email: String) : optional (user: String)`
- `_getByUsername(username: String) : optional (user: String)`
- `_getUserCount() : one (count: Number)`
- `_getUsers() : many (user: String, username: String, email: String)`
- `_search(query: String) : many (user: String, username: String)`
- `_resolveIdentity(ref: String) : one (user: String | Null, username: String | Null)`
- `_denotedUser(ref: String) : one (user: String)`

#### Instances

- `Authenticating` — instance of `Authenticating` — [Commons application](../design/application.md), line 105.

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

- `Banking` — instance of `Banking` — [Commons application](../design/application.md), line 107.
  - `Item` is `Assigning.Assignment` — [Commons application](../design/application.md), line 109.
  - `Learner` is `Authenticating.User` — [Commons application](../design/application.md), line 108.

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

- `Bookmarking` — instance of `Bookmarking` — [Commons application](../design/application.md), line 111.
  - `Item` is `Posting.Post` — [Commons application](../design/application.md), line 113.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 112.

### Categorizing

Defined in [Categorizing](../design/concepts/Categorizing.md), line 1.

#### Actions

- `createCategory(scope: Scope, name: String, description: String) : return (category: Category)`
  - Refuses `CATEGORY_ALREADY_EXISTS`: A category with this name already exists.
- `ensureCategory(scope: Scope, name: String, description: String) : return (category: Category)`
- `renameCategory(category: Category, name: String) : return (category: Category)`
  - Refuses `CATEGORY_NOT_FOUND`: There is no such category.
  - Refuses `CATEGORY_ALREADY_EXISTS`: A category with this name already exists.
- `describeCategory(category: Category, description: String) : return (category: Category)`
  - Refuses `CATEGORY_NOT_FOUND`: There is no such category.
- `mergeCategory(category: Category, into: Category) : return (into: Category)`
  - Refuses `CATEGORY_NOT_FOUND`: There is no such category.
  - Refuses `SAME_CATEGORY`: A category cannot be merged into itself.
  - Refuses `DIFFERENT_SCOPES`: These categories are not in the same scope.
- `file(scope: Scope, name: String, item: Item) : return (category: Category)`
- `assign(item: Item, category: Category) : return (item: Item)`
  - Refuses `CATEGORY_NOT_FOUND`: There is no such category.
- `unassign(item: Item) : return (item: Item)`
  - Refuses `ITEM_NOT_CATEGORIZED`: This item is not in any category.
- `deleteCategory(category: Category) : return (category: Category)`
  - Refuses `CATEGORY_NOT_FOUND`: There is no such category.

#### Queries

- `_getCategory(item: String) : optional (category: String, name: String, description: String)`
- `_getCategoryDetail(category: String) : optional (scope: String, name: String, description: String)`
- `_getHome(item: String) : optional (home: Category)`
- `_getItems(category: String) : many (item: String)`
- `_categoriesIn(scope: String) : many (category: String, name: String, description: String)`
- `_categoriesWithItems(scope: String) : one (categories: Seq)`

#### Instances

- `Categorizing` — instance of `Categorizing` — [Commons application](../design/application.md), line 115.
  - `Item` is `Categorizable` — [Commons application](../design/application.md), line 117.
  - `Scope` is `CategoryScope` — [Commons application](../design/application.md), line 116.

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

- `Conversing` — instance of `Conversing` — [Commons application](../design/application.md), line 119.
  - `Item` is `Posting.Post` — [Commons application](../design/application.md), line 120.

### Drafting

Defined in [Drafting](../design/concepts/Drafting.md), line 1.

#### Actions

- `describe(author: Author, request: String, at: Date) : return (brief: Brief)`
- `open(author: Author, request: String, form: String, material: Seq, origin: Origin, at: Date) : return (brief: Brief, candidate: Candidate)`
- `correct(author: Author, candidate: Candidate, request: String, at: Date) : return (brief: Brief)`
  - Refuses `CANDIDATE_NOT_FOUND`: There is no such draft to correct.
  - Refuses `ALREADY_ADOPTED`: This draft was already adopted; edit it directly instead.
- `propose(brief: Brief, form: String, material: Seq) : return (candidate: Candidate)`
  - Refuses `BRIEF_NOT_FOUND`: There is no such request.
  - Refuses `ALREADY_DRAFTED`: This request was already drafted; correct the draft instead.
  - Refuses `AWAITING_CLARIFICATION`: This request is waiting on the author's clarification.
  - Refuses `REQUEST_STALLED`: This request stalled; describe it again.
- `ask(brief: Brief, question: String) : return (clarification: Clarification)`
  - Refuses `BRIEF_NOT_FOUND`: There is no such request.
  - Refuses `ALREADY_DRAFTED`: This request was already drafted; correct the draft instead.
  - Refuses `REQUEST_STALLED`: This request stalled; describe it again.
- `stall(brief: Brief, reason: String) : return (brief: Brief)`
  - Refuses `BRIEF_NOT_FOUND`: There is no such request.
  - Refuses `NOT_AWAITING_DRAFT`: This request is not waiting on a draft.
- `clarify(clarification: Clarification, answer: String) : return (clarification: Clarification, brief: Brief)`
  - Refuses `CLARIFICATION_NOT_FOUND`: There is no such question.
  - Refuses `ALREADY_ANSWERED`: This question was already answered.
- `adopt(candidate: Candidate) : return (candidate: Candidate)`
  - Refuses `CANDIDATE_NOT_FOUND`: There is no such draft.
  - Refuses `ALREADY_ADOPTED`: This draft was already adopted.

#### Queries

- `_brief(brief: String) : optional (author: String, request: String, createdAt: Date, basis: String | Null)`
- `_briefs(author: String) : many (brief: String, request: String, createdAt: Date, basis: String | Null)`
- `_lines(author: String) : many (brief: String, request: String, createdAt: Date, origin: String | Null, adopted: Boolean, stalled: Boolean, clarifying: Boolean)`
- `_openedFrom(origin: String) : many (brief: String, author: String, request: String, createdAt: Date, adopted: Boolean, stalled: Boolean, clarifying: Boolean)`
- `_standing(brief: String) : optional (clarifying: Boolean, stalled: Boolean)`
- `_originOf(brief: String) : optional (origin: String)`
- `_basisOf(brief: String) : optional (basis: String)`
- `_rootOf(brief: String) : optional (root: String, request: String)`
- `_clarifications(brief: String) : many (clarification: String, question: String, answer: String | Null)`
- `_candidateOf(brief: String) : optional (candidate: String, form: String, adopted: Boolean)`
- `_candidate(candidate: String) : optional (brief: String, form: String, adopted: Boolean)`
- `_items(candidate: String) : many (item: String, prompt: String, choices: Seq, expected: String, explanation: String, position: Number)`
- `_material(candidate: String) : optional (form: String, material: Seq)`
- `_line(brief: String) : many (brief: String, request: String, basis: String | Null, candidate: String | Null, form: String | Null, adopted: Boolean)`

#### Instances

- `Drafting` — instance of `Drafting` — [Commons application](../design/application.md), line 122.
  - `Author` is `Authenticating.User` — [Commons application](../design/application.md), line 123.
  - `Origin` is `Questioning.Questionnaire` — [Commons application](../design/application.md), line 124.

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

- `Flagging` — instance of `Flagging` — [Commons application](../design/application.md), line 130.
  - `Target` is `Posting.Post` — [Commons application](../design/application.md), line 132.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 131.

### Formatting

Defined in [Formatting](../design/concepts/Formatting.md), line 1.

#### Actions

- `setSource(target: Target, source: String) : return (target: Target, rendered: String)`
- `clear(target: Target) : return (target: Target)`

#### Queries

- `_getRendered(target: String) : optional (rendered: String)`

#### Instances

- `Formatting` — instance of `Formatting` — [Commons application](../design/application.md), line 134.
  - `Target` is `Posting.Post` — [Commons application](../design/application.md), line 135.

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
- `restoreExcused(learner: Learner, item: Item, at: Date) : return (grade: Grade)`
  - Refuses `GRADE_EXCUSED_NOT_FOUND`: There is no excused grade for this learner and item.
- `excuse(learner: Learner, item: Item, grader: Grader, feedback: String, at: Date) : return (grade: Grade)`
  - Refuses `GRADE_NOT_FOUND`: There is no grade for this learner and item.
- `clearCriterionScores(criterion: Criterion) : return (criterion: Criterion)`

#### Queries

- `_getGrade(learner: String, item: String) : optional (grade: String, score: Number, outOf: Number, status: String, feedback: String)`
- `_getGradesForLearner(learner: String) : many (item: String, grade: String, score: Number, outOf: Number, status: String, feedback: String)`
- `_getGradesForItem(item: String) : many (learner: String, grade: String, score: Number, feedback: String, status: String)`
- `_getCriterionScores(learner: String, item: String) : many (criterion: String, points: Number, feedback: String)`

#### Instances

- `Grading` — instance of `Grading` — [Commons application](../design/application.md), line 137.
  - `Criterion` is `Itemizing.Criterion` — [Commons application](../design/application.md), line 141.
  - `Evidence` is `Submitting.Submission` — [Commons application](../design/application.md), line 142.
  - `Grader` is `Authenticating.User` — [Commons application](../design/application.md), line 138.
  - `Item` is `Assigning.Assignment` — [Commons application](../design/application.md), line 140.
  - `Learner` is `Authenticating.User` — [Commons application](../design/application.md), line 139.

### Grouping

Defined in [Grouping](../design/concepts/Grouping.md), line 1.

#### Actions

- `create(title: String, creator: Person, at: Date) : return (group: Group)`
- `rename(group: Group, member: Person, title: String, at: Date) : return (group: Group)`
  - Refuses `GROUP_NOT_FOUND`: There is no such group.
  - Refuses `NOT_A_MEMBER`: This person is not a member of the group.
- `addMember(group: Group, member: Person, candidate: Person, at: Date) : return (group: Group)`
  - Refuses `GROUP_NOT_FOUND`: There is no such group.
  - Refuses `NOT_A_MEMBER`: This person is not a member of the group.
  - Refuses `ALREADY_A_MEMBER`: This person is already a member of the group.
- `removeMember(group: Group, member: Person, target: Person, at: Date) : return (group: Group)`
  - Refuses `GROUP_NOT_FOUND`: There is no such group.
  - Refuses `NOT_A_MEMBER`: This person is not a member of the group.
  - Refuses `TARGET_NOT_A_MEMBER`: The target person is not a member of the group.
  - Refuses `LAST_MEMBER`: The final member cannot be removed from the group.
- `leave(group: Group, member: Person, at: Date) : return (group: Group)`
  - Refuses `GROUP_NOT_FOUND`: There is no such group.
  - Refuses `NOT_A_MEMBER`: This person is not a member of the group.
  - Refuses `LAST_MEMBER`: The final member cannot leave the group.

#### Queries

- `_getGroup(group: String) : optional (title: String, createdAt: Date, updatedAt: Date)`
- `_getMembers(group: String) : many (member: String)`
- `_getGroupsOf(member: String) : many (group: String, title: String, createdAt: Date, updatedAt: Date)`
- `_isMember(group: String, member: String) : one (isMember: Boolean)`

#### Instances

- `Grouping` — instance of `Grouping` — [Commons application](../design/application.md), line 144.
  - `Person` is `Authenticating.User` — [Commons application](../design/application.md), line 145.

### Insisting

Defined in [Insisting](../design/concepts/Insisting.md), line 1.

#### Actions

- `complain(aim: Aim, patience: Number, offering: String, account: String) : return (complaint: Complaint, insistence: Insistence, remaining: Number)`
  - Refuses `NO_PATIENCE`: Insisting takes at least one complaint.
  - Refuses `PATIENCE_SPENT`: This aim has had every complaint it was given.
- `giveUp(aim: Aim) : return (insistence: Insistence)`
  - Refuses `NOT_INSISTING`: Nothing is being insisted on for this aim.
- `satisfy(aim: Aim) : return (insistence: Insistence)`
  - Refuses `NOT_INSISTING`: Nothing is being insisted on for this aim.

#### Queries

- `_unsettledFor(aim: String) : optional (insistence: String, patience: Number, remaining: Number)`
- `_standingFor(aim: String) : optional (insistence: String, remaining: Number)`
- `_spentFor(aim: String) : optional (insistence: String, complaints: Number)`
- `_for(aim: String) : many (insistence: String, patience: Number, settled: Boolean, satisfied: Boolean, exhausted: Boolean, remaining: Number)`
- `_complaints(insistence: String) : many (complaint: String, offering: String, account: String)`

#### Instances

- `Insisting` — instance of `Insisting` — [Commons application](../design/application.md), line 147.
  - `Aim` is `LiveSubject` — [Commons application](../design/application.md), line 148.

### Inviting

Defined in [Inviting](../design/concepts/Inviting.md), line 1.

#### Actions

- `invite(channel: String, address: String, at: Date) : return (invitation: Invitation, channel: String, address: String, credential: String, created: Boolean)`
  - Refuses `INVITATION_ALREADY_CLAIMED`: That invitation has already been used.
- `verify(invitation: Invitation, credential: String, channel: String) : return (invitation: Invitation, address: String)`
  - Refuses `INVITATION_INVALID`: That invitation is not valid.
- `claim(invitation: Invitation, credential: String, user: User) : return (invitation: Invitation, channel: String, address: String)`
  - Refuses `INVITATION_INVALID`: That invitation is not valid.
- `retract(invitation: Invitation) : return ()`
  - Refuses `INVITATION_NOT_FOUND`: That invitation no longer exists.
  - Refuses `INVITATION_ALREADY_CLAIMED`: That invitation has already been used.

#### Queries

- `_getAvailable(invitation: String, credential: String) : optional (channel: String, address: String)`
- `_getInvitationByAddress(channel: String, address: String) : optional (invitation: String, user: User | Null)`
- `_getInvitations() : many (invitation: String, channel: String, address: String, createdAt: Date, lastInvitedAt: Date, inviteCount: Number, user: User | Null)`

#### Instances

- `Inviting` — instance of `Inviting` — [Commons application](../design/application.md), line 150.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 151.

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

- `Itemizing` — instance of `Itemizing` — [Commons application](../design/application.md), line 153.
  - `Item` is `Assigning.Assignment` — [Commons application](../design/application.md), line 154.

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

- `AdoptLinking` — instance of `Linking` — [Commons application](../design/application.md), line 160.
  - `Source` is `Drafting.Brief` — [Commons application](../design/application.md), line 161.
  - `Target` is `Questioning.Questionnaire` — [Commons application](../design/application.md), line 162.
- `Linking` — instance of `Linking` — [Commons application](../design/application.md), line 156.
  - `Source` is `Linkable` — [Commons application](../design/application.md), line 157.
  - `Target` is `Linkable` — [Commons application](../design/application.md), line 158.

### Locating

Defined in [Locating](../design/concepts/Locating.md), line 1.

#### Actions

- `ensure(subject: Subject) : return (location: Location, code: String)`
- `locate(code: String) : return (subject: Subject)`
  - Refuses `NOTHING_LOCATED`: Nothing is located there.

#### Queries

- `_for(subject: String) : optional (location: String, code: String)`
- `_at(code: String) : optional (location: String, subject: String)`

#### Instances

- `Locating` — instance of `Locating` — [Commons application](../design/application.md), line 167.
  - `Subject` is `Publishing.Edition` — [Commons application](../design/application.md), line 168.

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

- `Locking` — instance of `Locking` — [Commons application](../design/application.md), line 164.
  - `Target` is `Lockable` — [Commons application](../design/application.md), line 165.

### Mailing

Defined in [Mailing](../design/concepts/Mailing.md), line 1.

#### Actions

- `normalizeRecipient(recipient: String) : return (recipient: String)`
  - Refuses `MAIL_RECIPIENT_INVALID`: The mail recipient is not well formed.
- `enqueue(key: Key, recipient: String, subject: String, text: String, html: String, at: Date) : return (message: Message)`
  - Refuses `MAIL_RECIPIENT_INVALID`: The mail recipient is not well formed.
- `markSent(message: Message, at: Date) : return (message: Message)`
  - Refuses `MAIL_NOT_FOUND`: There is no such mail message.
- `markFailed(message: Message, error: String, at: Date) : return (message: Message)`
  - Refuses `MAIL_NOT_FOUND`: There is no such mail message.

#### Queries

- `_getPending() : many (message: String, key: Key, recipient: String, subject: String, text: String, html: String, createdAt: Date)`
- `_getStatus(message: String) : optional (sentAt: Date | Null)`
- `_getMessages() : many (message: String, key: Key, recipient: String, subject: String, createdAt: Date, sentAt: Date | Null, attempts: Number, lastAttemptAt: Date | Null, lastError: String | Null)`

#### Instances

- `Mailing` — instance of `Mailing` — [Commons application](../design/application.md), line 170.
  - `Key` is `MailKey` — [Commons application](../design/application.md), line 171.

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

- `Notifying` — instance of `Notifying` — [Commons application](../design/application.md), line 173.
  - `Link` is `Posting.Post` — [Commons application](../design/application.md), line 176.
  - `Person` is `Authenticating.User` — [Commons application](../design/application.md), line 174.
  - `Subject` is `Posting.Post` — [Commons application](../design/application.md), line 175.
- `TaskNotifying` — instance of `Notifying` — [Commons application](../design/application.md), line 178.
  - `Link` is `TaskSubject` — [Commons application](../design/application.md), line 181.
  - `Person` is `Authenticating.User` — [Commons application](../design/application.md), line 179.
  - `Subject` is `TaskSubject` — [Commons application](../design/application.md), line 180.

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

- `Noting` — instance of `Noting` — [Commons application](../design/application.md), line 183.
  - `Author` is `Authenticating.User` — [Commons application](../design/application.md), line 184.
  - `Learner` is `Authenticating.User` — [Commons application](../design/application.md), line 185.

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

- `Pinning` — instance of `Pinning` — [Commons application](../design/application.md), line 187.
  - `Item` is `Pinnable` — [Commons application](../design/application.md), line 188.
  - `Scope` is `PinScope` — [Commons application](../design/application.md), line 189.

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

- `Posting` — instance of `Posting` — [Commons application](../design/application.md), line 191.
  - `Author` is `Authenticating.User` — [Commons application](../design/application.md), line 192.

### Profiling

Defined in [Profiling](../design/concepts/Profiling.md), line 1.

#### Actions

- `createProfile(user: User, displayName: String) : return (user: User)`
  - Refuses `PROFILE_ALREADY_EXISTS`: This user already has a profile.
- `setDisplayName(user: User, displayName: String) : return (user: User)`
  - Refuses `PROFILE_NOT_FOUND`: There is no profile for this user.
- `setBio(user: User, bio: String) : return (user: User)`
  - Refuses `PROFILE_NOT_FOUND`: There is no profile for this user.
- `setAvatar(user: User, avatar: String) : return (user: User)`
  - Refuses `PROFILE_NOT_FOUND`: There is no profile for this user.

#### Queries

- `_getProfile(user: String) : optional (profile: Profile)`
- `_getProfileFields(user: String) : optional (displayName: String, bio: String, avatar: String)`
- `_getProfilesOf(users: Strings) : many (user: String, displayName: String, bio: String, avatar: String)`

#### Instances

- `Profiling` — instance of `Profiling` — [Commons application](../design/application.md), line 194.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 195.

### Publishing

Defined in [Publishing](../design/concepts/Publishing.md), line 1.

#### Actions

- `publish(author: Author, material: Material, at: Date) : return (edition: Edition)`
  - Refuses `MATERIAL_ALREADY_SHARED`: This is already running; close the open run first.
- `close(edition: Edition, at: Date) : return (edition: Edition)`
  - Refuses `EDITION_NOT_FOUND`: There is no such edition.
  - Refuses `ALREADY_CLOSED`: This edition is already closed.

#### Queries

- `_edition(edition: String) : optional (author: String, material: String, open: Boolean, openedAt: Date, closedAt: Date | Null)`
- `_hasOpenEditionFor(material: String) : one (open: Boolean)`
- `_editionsFor(material: String) : many (edition: String, open: Boolean, openedAt: Date, closedAt: Date | Null)`
- `_openEditions() : many (edition: String, author: String, material: String, openedAt: Date)`

#### Instances

- `Publishing` — instance of `Publishing` — [Commons application](../design/application.md), line 197.
  - `Author` is `Authenticating.User` — [Commons application](../design/application.md), line 198.
  - `Material` is `LiveMaterial` — [Commons application](../design/application.md), line 199.

### Questioning

Defined in [Questioning](../design/concepts/Questioning.md), line 1.

#### Actions

- `compose(author: Author, title: String, form: String, disclosure: String, at: Date) : return (questionnaire: Questionnaire)`
  - Refuses `UNKNOWN_FORM`: A questionnaire is a quiz or a survey.
  - Refuses `UNKNOWN_DISCLOSURE`: That is not a disclosure level.
  - Refuses `INVALID_TITLE`: The title must be 1 to 200 characters long.
- `setDisclosure(questionnaire: Questionnaire, disclosure: String) : return (questionnaire: Questionnaire)`
  - Refuses `QUESTIONNAIRE_NOT_FOUND`: There is no such questionnaire.
  - Refuses `QUESTIONNAIRE_RETIRED`: This questionnaire was retired.
  - Refuses `UNKNOWN_DISCLOSURE`: That is not a disclosure level.
- `retitle(questionnaire: Questionnaire, title: String) : return (questionnaire: Questionnaire)`
  - Refuses `QUESTIONNAIRE_NOT_FOUND`: There is no such questionnaire.
  - Refuses `QUESTIONNAIRE_RETIRED`: This questionnaire was retired.
  - Refuses `INVALID_TITLE`: The title must be 1 to 200 characters long.
- `addQuestion(questionnaire: Questionnaire, prompt: String, choices: Seq, expected: String, explanation: String, position: Number) : return (question: Question)`
  - Refuses `QUESTIONNAIRE_NOT_FOUND`: There is no such questionnaire.
  - Refuses `QUESTIONNAIRE_RETIRED`: This questionnaire was retired.
  - Refuses `QUESTION_LIMIT_REACHED`: A questionnaire may contain at most 100 questions.
  - Refuses `INVALID_PROMPT`: The prompt must be 1 to 10000 characters long.
  - Refuses `INVALID_CHOICES`: A question may offer at most 50 choices, each 1 to 500 characters long.
  - Refuses `DUPLICATE_CHOICES`: Choices must be distinct, ignoring case and surrounding space.
  - Refuses `INVALID_EXPECTED`: The expected answer must exactly match an offered choice.
  - Refuses `INVALID_REFERENCE`: A written-answer reference may be at most 2000 characters long.
  - Refuses `INVALID_EXPLANATION`: An explanation may be at most 2000 characters long.
- `reviseQuestion(question: Question, prompt: String, choices: Seq, expected: String, explanation: String, position: Number) : return (question: Question)`
  - Refuses `QUESTION_NOT_FOUND`: There is no such question.
  - Refuses `QUESTIONNAIRE_RETIRED`: This questionnaire was retired.
  - Refuses `INVALID_PROMPT`: The prompt must be 1 to 10000 characters long.
  - Refuses `INVALID_CHOICES`: A question may offer at most 50 choices, each 1 to 500 characters long.
  - Refuses `DUPLICATE_CHOICES`: Choices must be distinct, ignoring case and surrounding space.
  - Refuses `INVALID_PARTS`: A question offers choices or takes parts, not both.
  - Refuses `INVALID_EXPECTED`: The expected answer must exactly match an offered choice.
  - Refuses `INVALID_REFERENCE`: A written-answer reference may be at most 2000 characters long.
  - Refuses `INVALID_EXPLANATION`: An explanation may be at most 2000 characters long.
- `setParts(question: Question, parts: Seq, cap: Number) : return (question: Question)`
  - Refuses `QUESTION_NOT_FOUND`: There is no such question.
  - Refuses `QUESTIONNAIRE_RETIRED`: This questionnaire was retired.
  - Refuses `INVALID_PARTS`: Parts are up to 12 short labels, or one label repeated up to a cap of 2 to 20, and never beside choices.
- `swapQuestions(question: Question, other: Question) : return (question: Question, other: Question)`
  - Refuses `QUESTION_NOT_FOUND`: There is no such question.
  - Refuses `NOT_SIBLINGS`: These questions do not share a questionnaire.
  - Refuses `QUESTIONNAIRE_RETIRED`: This questionnaire was retired.
- `removeQuestion(question: Question) : return (question: Question, questionnaire: Questionnaire, position: Number)`
  - Refuses `QUESTION_NOT_FOUND`: There is no such question.
  - Refuses `QUESTIONNAIRE_RETIRED`: This questionnaire was retired.
- `present(questionnaire: Questionnaire) : return (presentation: Value, form: String, disclosure: String, proposes: Boolean, expectations: Seq)`
  - Refuses `QUESTIONNAIRE_NOT_FOUND`: There is no such questionnaire.
  - Refuses `QUESTIONNAIRE_RETIRED`: This questionnaire was retired.
- `retire(questionnaire: Questionnaire) : return (questionnaire: Questionnaire)`
  - Refuses `QUESTIONNAIRE_NOT_FOUND`: There is no such questionnaire.
  - Refuses `QUESTIONNAIRE_RETIRED`: This questionnaire was retired.

#### Queries

- `_getQuestionnaire(questionnaire: String) : optional (author: String, title: String, form: String, disclosure: String, createdAt: Date, retired: Boolean)`
- `_getQuestionnaires() : many (questionnaire: String, author: String, title: String, form: String, disclosure: String, createdAt: Date, retired: Boolean)`
- `_getQuestions(questionnaire: String) : many (question: String, prompt: String, choices: Seq, expected: String, explanation: String, parts: Seq, cap: Number, position: Number)`
- `_getQuestion(question: String) : optional (questionnaire: String, prompt: String, choices: Seq, expected: String, explanation: String, parts: Seq, cap: Number, position: Number)`
- `_material(questionnaire: String) : optional (form: String, material: Seq)`
- `_proposesAnswers(questionnaire: String) : one (proposes: Boolean)`
- `_expectedAnswers(questionnaire: String) : optional (expectations: Seq)`
- `_materials(questionnaires: Seq) : one (materials: Seq)`
- `_references(questionnaire: String) : many (question: String, prompt: String, expected: String, explanation: String, position: Number)`

#### Instances

- `Questioning` — instance of `Questioning` — [Commons application](../design/application.md), line 201.
  - `Author` is `Authenticating.User` — [Commons application](../design/application.md), line 202.

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

- `Reacting` — instance of `Reacting` — [Commons application](../design/application.md), line 204.
  - `Person` is `Authenticating.User` — [Commons application](../design/application.md), line 205.
  - `Target` is `Posting.Post` — [Commons application](../design/application.md), line 206.

### Reasoning

Defined in [Reasoning](../design/concepts/Reasoning.md), line 1.

#### Actions

- `ask(reasoner: Reasoner, about: Subject, passage: String, at: Date) : return (asking: Asking)`
- `answer(asking: Asking, reply: String, at: Date) : return (asking: Asking, reply: String)`
  - Refuses `ASKING_NOT_FOUND`: There is no such ask.
  - Refuses `ALREADY_SETTLED`: This ask was already settled.
- `fail(asking: Asking, account: String, at: Date) : return (asking: Asking)`
  - Refuses `ASKING_NOT_FOUND`: There is no such ask.
  - Refuses `ALREADY_SETTLED`: This ask was already settled.

#### Queries

- `_pending() : many (asking: String, reasoner: String, about: String, passage: String, askedAt: Date)`
- `_asking(asking: String) : optional (reasoner: String, about: String, passage: String, askedAt: Date, pending: Boolean)`
- `_replyOf(asking: String) : optional (reply: String, answeredAt: Date)`
- `_failureOf(asking: String) : optional (account: String, failedAt: Date)`
- `_repliesAbout(about: String) : many (asking: String, reasoner: String, passage: String, reply: String, answeredAt: Date)`

#### Instances

- `Reasoning` — instance of `Reasoning` — [Commons application](../design/application.md), line 208.
  - `Reasoner` is `LiveReasoner` — [Commons application](../design/application.md), line 209.
  - `Subject` is `LiveSubject` — [Commons application](../design/application.md), line 210.

### Relaying

Defined in [Relaying](../design/concepts/Relaying.md), line 1.

#### Actions

- `plan(author: Author, title: String, at: Date) : return (relay: Relay)`
  - Refuses `INVALID_TITLE`: The title must be 1 to 200 characters long.
- `retitle(relay: Relay, title: String) : return (relay: Relay)`
  - Refuses `RELAY_NOT_FOUND`: There is no such relay.
  - Refuses `INVALID_TITLE`: The title must be 1 to 200 characters long.
- `addLeg(relay: Relay, material: Material) : return (leg: Leg, position: Number)`
  - Refuses `RELAY_NOT_FOUND`: There is no such relay.
- `removeLeg(leg: Leg) : return (leg: Leg, relay: Relay, material: Material)`
  - Refuses `LEG_NOT_FOUND`: There is no such leg.
  - Refuses `LEG_DRAWN_ON`: Another leg still draws on this one.
- `moveLeg(leg: Leg, position: Number) : return (leg: Leg, position: Number)`
  - Refuses `LEG_NOT_FOUND`: There is no such leg.
  - Refuses `NO_SUCH_POSITION`: There is no such place in this relay.
  - Refuses `FORWARD_DRAW`: A leg cannot come before what it draws on.
- `draw(leg: Leg, source: Leg, shape: String) : return (draw: Draw)`
  - Refuses `LEG_NOT_FOUND`: There is no such leg.
  - Refuses `NOT_SIBLINGS`: These legs do not share a relay.
  - Refuses `FORWARD_DRAW`: A leg cannot come before what it draws on.
  - Refuses `INVALID_SHAPE`: A draw needs a shape.
- `undraw(leg: Leg, source: Leg) : return (leg: Leg)`
  - Refuses `NO_DRAW`: This leg does not draw on that one.

#### Queries

- `_relay(relay: String) : optional (author: String, title: String, createdAt: Date)`
- `_relays() : many (relay: String, author: String, title: String, createdAt: Date)`
- `_legs(relay: String) : many (leg: String, material: String, position: Number)`
- `_leg(leg: String) : optional (relay: String, material: String, position: Number)`
- `_legFor(material: String) : optional (leg: String, relay: String, position: Number)`
- `_draws(leg: String) : many (draw: String, source: String, shape: String)`
- `_drawsOn(source: String) : many (draw: String, leg: String, shape: String)`
- `_plan(relay: String) : optional (legs: Seq)`

#### Instances

- `Relaying` — instance of `Relaying` — [Commons application](../design/application.md), line 212.
  - `Author` is `Authenticating.User` — [Commons application](../design/application.md), line 213.
  - `Material` is `Questioning.Questionnaire` — [Commons application](../design/application.md), line 214.

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

- `Resolving` — instance of `Resolving` — [Commons application](../design/application.md), line 221.
  - `Answer` is `Posting.Post` — [Commons application](../design/application.md), line 224.
  - `Question` is `Posting.Post` — [Commons application](../design/application.md), line 223.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 222.

### Responding

Defined in [Responding](../design/concepts/Responding.md), line 1.

#### Actions

- `begin(participant: Participant, subject: Subject, at: Date) : return (response: Response)`
  - Refuses `ALREADY_SUBMITTED`: This was already handed in.
  - Refuses `NO_PARTICIPANT`: A response needs someone to belong to.
- `answer(response: Response, item: Item, value: String) : return (response: Response)`
  - Refuses `RESPONSE_NOT_FOUND`: There is no such response.
  - Refuses `ALREADY_SUBMITTED`: This was already handed in.
  - Refuses `BLANK_ANSWER`: An answer needs something in it.
- `submit(response: Response, at: Date) : return (response: Response)`
  - Refuses `RESPONSE_NOT_FOUND`: There is no such response.
  - Refuses `ALREADY_SUBMITTED`: This was already handed in.

#### Queries

- `_response(response: String) : optional (subject: String, participant: String, submitted: Boolean, startedAt: Date, submittedAt: Date | Null)`
- `_responseFor(subject: String, participant: String) : optional (response: String, submitted: Boolean)`
- `_responsesFor(subject: String) : many (response: String, participant: String, submitted: Boolean, startedAt: Date, submittedAt: Date | Null)`
- `_answers(response: String) : many (item: String, value: String)`
- `_valuesFor(subject: String, item: String) : many (response: String, participant: String, value: String)`
- `_collectedAnswers(response: String) : optional (answers: Seq)`
- `_submittedAnswers(subject: String) : many (response: String, participant: String, item: String, value: String)`
- `_valuesForSubject(subject: String) : one (values: Seq)`

#### Instances

- `Responding` — instance of `Responding` — [Commons application](../design/application.md), line 216.
  - `Item` is `LiveItem` — [Commons application](../design/application.md), line 219.
  - `Participant` is `LiveParticipant` — [Commons application](../design/application.md), line 218.
  - `Subject` is `Publishing.Edition` — [Commons application](../design/application.md), line 217.

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

- `Revising` — instance of `Revising` — [Commons application](../design/application.md), line 226.
  - `Item` is `Posting.Post` — [Commons application](../design/application.md), line 227.

### Roling

Defined in [Roling](../design/concepts/Roling.md), line 1.

#### Actions

- `defineRole(name: String, capabilities: Strings) : return (role: Role)`
  - Refuses `ROLE_ALREADY_EXISTS`: A role with this name already exists.
- `ensureRole(name: String, capabilities: Strings) : return (role: Role)`
- `deleteRole(role: Role) : return (role: Role)`
  - Refuses `ROLE_NOT_FOUND`: No such role exists.
  - Refuses `ROLE_IN_USE`: The role is still assigned to a user.
- `assign(user: User, context: Context, role: Role) : return (assignment: Assignment)`
  - Refuses `ROLE_NOT_FOUND`: No such role exists.
- `revoke(user: User, context: Context) : return (assignment: Assignment)`
  - Refuses `ASSIGNMENT_NOT_FOUND`: The user holds no role in this context.
- `requireCapability(user: User, context: Context, capability: String) : return (allowed: Boolean)`
  - Refuses `FORBIDDEN`: The user does not hold the required capability in this context.

#### Queries

- `_hasCapability(user: String, context: String, capability: String) : one (allowed: Boolean)`
- `_hasCapabilityHolder(context: String, capability: String) : one (present: Boolean)`
- `_isSoleCapabilityHolder(user: String, context: String, capability: String) : one (sole: Boolean)`
- `_holdsRoleNamed(user: String, context: String, name: String) : one (held: Boolean)`
- `_getRole(user: String, context: String) : optional (role: String)`
- `_getContextsOfRoleNamed(user: String, name: String) : many (context: String)`
- `_getHoldersOfRoleNamed(context: String, name: String) : many (user: String)`
- `_getRoleByName(name: String) : optional (role: String)`
- `_getRoleDetail(role: String) : optional (name: String, capabilities: Strings)`
- `_listRoles() : many (role: String, name: String, capabilities: Strings)`
- `_denotedRole(ref: String) : one (role: String)`

#### Instances

- `Roling` — instance of `Roling` — [Commons application](../design/application.md), line 229.
  - `Context` is `Conversing.Conversation` — [Commons application](../design/application.md), line 231.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 230.

### Rostering

Defined in [Rostering](../design/concepts/Rostering.md), line 1.

#### Actions

- `configureClass(code: String, title: String, term: String, timezone: String) : return (class: Class)`
  - Refuses `CLASS_ALREADY_CONFIGURED`: The class has already been configured.
  - Refuses `CLASS_TIMEZONE_INVALID`: Choose a valid IANA timezone.
- `updateClass(code: String, title: String, term: String, timezone: String) : return (class: Class)`
  - Refuses `CLASS_NOT_CONFIGURED`: The class has not been configured.
  - Refuses `CLASS_TIMEZONE_INVALID`: Choose a valid IANA timezone.
- `createSection(name: String, location: String, meetingPattern: String) : return (section: Section)`
- `updateSection(section: Section, name: String, location: String, meetingPattern: String) : return (section: Section)`
  - Refuses `SECTION_NOT_FOUND`: No such section exists.
- `previewImport(csv: String) : return (rows: Rows)`
- `importSeats(rows: Rows) : return (created: Seats, skipped: Strings)`
  - Refuses `SECTION_NOT_FOUND`: No such section exists.
- `enrol(email: String, kind: String, section: Section, user: User) : return (seat: Seat, kind: String, user: User, section: Section)`
  - Refuses `SEAT_ALREADY_EXISTS`: A seat already exists for this address.
  - Refuses `SEAT_ALREADY_ACTIVE`: This user already holds an active seat.
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
- `removeSeat(seat: Seat) : return (seat: Seat, email: String)`
  - Refuses `SEAT_NOT_FOUND`: No such seat exists.
- `moveSection(seat: Seat, section: Section) : return (seat: Seat)`
  - Refuses `SEAT_NOT_FOUND`: No such seat exists.

#### Queries

- `_getClass() : optional (detail: Class)`
- `_getSections() : many (section: String, name: String, location: String, meetingPattern: String, status: String)`
- `_getSeatByEmail(email: String) : optional (seat: String, email: String)`
- `_getPendingSeatByEmail(email: String) : optional (seat: String, email: String, displayName: String)`
- `_getSeatByUser(user: String) : optional (seat: String, user: String | Null, email: String, kind: String, section: String | Null, status: String)`
- `_getSeatDetail(user: String) : optional (detail: Seat)`
- `_getActiveMembers() : many (user: String | Null, seat: String, kind: String, section: String | Null, email: String)`
- `_isActiveStudent(user: String) : one (active: Boolean)`
- `_getActiveStudents() : many (user: String, seat: String, section: String | Null, email: String)`
- `_getUnclaimedSeats() : many (seat: String, email: String, kind: String, section: String | Null, displayName: String)`
- `_getDroppedSeats() : many (user: String | Null, seat: String, kind: String, section: String | Null, email: String)`

#### Instances

- `Rostering` — instance of `Rostering` — [Commons application](../design/application.md), line 233.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 234.

### Scoring

Defined in [Scoring](../design/concepts/Scoring.md), line 1.

#### Actions

- `establish(subject: Subject, disclosure: String, expectations: Seq) : return (key: Key)`
  - Refuses `KEY_EXISTS`: This already has a key.
  - Refuses `UNKNOWN_DISCLOSURE`: That is not a disclosure level.
- `grade(key: Key, submission: Submission, answers: Seq) : return (result: Result, score: Number)`
  - Refuses `KEY_NOT_FOUND`: There is no such key.
  - Refuses `ALREADY_GRADED`: This submission was already graded.

#### Queries

- `_keyFor(subject: String) : optional (key: String, disclosure: String)`
- `_key(key: String) : optional (subject: String, disclosure: String)`
- `_expectations(key: String) : many (item: String, expected: String, explanation: String)`
- `_resultFor(key: String, submission: String) : optional (result: String, score: Number, outOf: Number)`
- `_results(key: String) : many (result: String, submission: String, score: Number, outOf: Number)`

#### Instances

- `Scoring` — instance of `Scoring` — [Commons application](../design/application.md), line 236.
  - `Item` is `Questioning.Question` — [Commons application](../design/application.md), line 238.
  - `Subject` is `Publishing.Edition` — [Commons application](../design/application.md), line 237.
  - `Submission` is `Responding.Response` — [Commons application](../design/application.md), line 239.

### Sessioning

Defined in [Sessioning](../design/concepts/Sessioning.md), line 1.

#### Actions

- `start(user: User, at?: Date) : return (session: Session, expiresAt: Date)`
- `end(session: Session) : return (session: Session)`
  - Refuses `SESSION_NOT_FOUND`: There is no such session.
- `endAllForUser(user: User) : return (user: User)`

#### Queries

- `_getUser(session: String, at?: Date) : optional (user: String)`
- `_isExpired(session: String, at: Date) : one (expired: Boolean)`

#### Instances

- `Sessioning` — instance of `Sessioning` — [Commons application](../design/application.md), line 245.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 246.

### Sharing

Defined in [Sharing](../design/concepts/Sharing.md), line 1.

#### Actions

- `issue(subject: Subject) : return (share: Share, token: String)`
- `open(token: String) : return (subject: Subject)`
  - Refuses `NOTHING_SHARED`: Nothing is shared here.

#### Queries

- `_share(token: String) : optional (share: String, subject: String)`
- `_sharesFor(subject: String) : many (share: String, token: String)`

#### Instances

- `Sharing` — instance of `Sharing` — [Commons application](../design/application.md), line 248.
  - `Subject` is `Publishing.Edition` — [Commons application](../design/application.md), line 249.

### Snapshotting

Defined in [Snapshotting](../design/concepts/Snapshotting.md), line 1.

#### Actions

- `capture(subject: Subject, value: Value) : return (snapshot: Snapshot)`
  - Refuses `SNAPSHOT_EXISTS`: This subject already has a snapshot.

#### Queries

- `_snapshot(subject: String) : optional (snapshot: String, value: Value)`

#### Instances

- `RunSnapshotting` — instance of `Snapshotting` — [Commons application](../design/application.md), line 241.
  - `Subject` is `Publishing.Edition` — [Commons application](../design/application.md), line 242.
  - `Value` is `LiveRunSnapshot` — [Commons application](../design/application.md), line 243.

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
- `_getSubmissionsForAssignment(assignment: String) : many (submitter: String, submission: String, artifacts: Artifacts, submittedAt: Date, number: Number, status: String)`
- `_getSubmissionsForSubmitter(submitter: String) : many (assignment: String, submission: String, submittedAt: Date, number: Number, status: String)`

#### Instances

- `Submitting` — instance of `Submitting` — [Commons application](../design/application.md), line 254.
  - `Artifact` is `Posting.Post` — [Commons application](../design/application.md), line 257.
  - `Assignment` is `Assigning.Assignment` — [Commons application](../design/application.md), line 256.
  - `Submitter` is `Authenticating.User` — [Commons application](../design/application.md), line 255.

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

- `Subscribing` — instance of `Subscribing` — [Commons application](../design/application.md), line 259.
  - `Person` is `Subscriber` — [Commons application](../design/application.md), line 260.
  - `Target` is `Subscribable` — [Commons application](../design/application.md), line 261.

### Suggesting

Defined in [Suggesting](../design/concepts/Suggesting.md), line 1.

#### Actions

- `offer(subject: Subject, lines: Seq, at: Date) : return (offering: Offering)`
  - Refuses `NOTHING_OFFERED`: An offering needs at least one suggestion.
  - Refuses `INVALID_SUGGESTION`: Every suggestion needs a kind.
- `take(suggestion: Suggestion) : return (suggestion: Suggestion, offering: Offering, kind: String, target: String, value: String)`
  - Refuses `SUGGESTION_NOT_FOUND`: There is no such suggestion.
  - Refuses `SUGGESTION_SETTLED`: This suggestion was already settled.
- `decline(suggestion: Suggestion) : return (suggestion: Suggestion)`
  - Refuses `SUGGESTION_NOT_FOUND`: There is no such suggestion.
  - Refuses `SUGGESTION_SETTLED`: This suggestion was already settled.

#### Queries

- `_offering(offering: String) : optional (subject: String, offeredAt: Date)`
- `_offeringsAbout(subject: String) : many (offering: String, offeredAt: Date)`
- `_suggestions(offering: String) : many (suggestion: String, kind: String, target: String, value: String, position: Number, standing: String)`
- `_pendingIn(offering: String) : many (suggestion: String, kind: String, target: String, value: String, position: Number)`
- `_suggestion(suggestion: String) : optional (offering: String, subject: String, kind: String, target: String, value: String, position: Number, standing: String)`

#### Instances

- `Suggesting` — instance of `Suggesting` — [Commons application](../design/application.md), line 251.
  - `Subject` is `LiveSubject` — [Commons application](../design/application.md), line 252.

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

- `Tagging` — instance of `Tagging` — [Commons application](../design/application.md), line 263.
  - `Target` is `Posting.Post` — [Commons application](../design/application.md), line 264.

### Tasking

Defined in [Tasking](../design/concepts/Tasking.md), line 1.

#### Actions

- `create(scope: Scope, title: String, details: String, startsAt: Date, endsAt: Date, assignee: Assignee, at: Date) : return (task: Task)`
  - Refuses `TASK_WINDOW_INVALID`: A task's window cannot end before it begins.
- `describe(task: Task, title: String, details: String, at: Date) : return (task: Task)`
  - Refuses `TASK_NOT_FOUND`: There is no such task.
  - Refuses `TASK_CANCELED`: A canceled task can no longer be changed.
- `retime(task: Task, startsAt: Date, endsAt: Date, at: Date) : return (task: Task, assignee?: Assignee)`
  - Refuses `TASK_NOT_FOUND`: There is no such task.
  - Refuses `TASK_CANCELED`: A canceled task can no longer be changed.
  - Refuses `TASK_WINDOW_INVALID`: A task's window cannot end before it begins.
- `assign(task: Task, assignee: Assignee, at: Date) : return (task: Task)`
  - Refuses `TASK_NOT_FOUND`: There is no such task.
  - Refuses `TASK_CANCELED`: A canceled task can no longer be changed.
- `release(task: Task, at: Date) : return (task: Task)`
  - Refuses `TASK_NOT_FOUND`: There is no such task.
  - Refuses `TASK_CANCELED`: A canceled task can no longer be changed.
- `complete(task: Task, at: Date) : return (task: Task, assignee?: Assignee)`
  - Refuses `TASK_NOT_FOUND`: There is no such task.
  - Refuses `TASK_ALREADY_COMPLETE`: This task is already complete.
  - Refuses `TASK_CANCELED`: A canceled task can no longer be changed.
- `reopen(task: Task, at: Date) : return (task: Task, assignee?: Assignee)`
  - Refuses `TASK_NOT_FOUND`: There is no such task.
  - Refuses `TASK_NOT_COMPLETE`: Only a completed task can be reopened.
  - Refuses `TASK_CANCELED`: Only a completed task can be reopened; uncancel this task instead.
- `cancel(task: Task, at: Date) : return (task: Task, assignee?: Assignee)`
  - Refuses `TASK_NOT_FOUND`: There is no such task.
  - Refuses `TASK_ALREADY_COMPLETE`: This task is already complete.
  - Refuses `TASK_ALREADY_CANCELED`: This task is already canceled.
- `uncancel(task: Task, at: Date) : return (task: Task, assignee?: Assignee)`
  - Refuses `TASK_NOT_FOUND`: There is no such task.
  - Refuses `TASK_NOT_CANCELED`: Only a canceled task can be uncanceled, and this task is already outstanding.
  - Refuses `TASK_ALREADY_COMPLETE`: This task is already complete.
- `delete(task: Task, at: Date) : return ()`
  - Refuses `TASK_NOT_FOUND`: There is no such task.
  - Refuses `TASK_NOT_SETTLED`: Only a completed or canceled task can be deleted; complete or cancel this task first.

#### Queries

- `_getTask(task: String, at: Date) : optional (scope: String, title: String, details: String, startsAt: String, endsAt: String, assignee: String | Null, state: String, overdue: Boolean, createdAt: Date, updatedAt: Date)`
- `_getTasksInScope(scope: String, at: Date) : many (task: String, title: String, details: String, startsAt: String, endsAt: String, assignee: String | Null, state: String, overdue: Boolean, createdAt: Date, updatedAt: Date)`
- `_getAssigned(assignee: String, at: Date) : many (task: String, scope: String, title: String, details: String, startsAt: String, endsAt: String, state: String, overdue: Boolean, createdAt: Date, updatedAt: Date)`

#### Instances

- `Tasking` — instance of `Tasking` — [Commons application](../design/application.md), line 266.
  - `Assignee` is `Authenticating.User` — [Commons application](../design/application.md), line 268.
  - `Scope` is `Grouping.Group` — [Commons application](../design/application.md), line 267.

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

- `Tracking` — instance of `Tracking` — [Commons application](../design/application.md), line 270.
  - `Item` is `Posting.Post` — [Commons application](../design/application.md), line 272.
  - `Scope` is `Conversing.Conversation` — [Commons application](../design/application.md), line 273.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 271.

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

- `Archiving` — instance of `Trashing` — [Commons application](../design/application.md), line 96.
  - `Item` is `Authenticating.User` — [Commons application](../design/application.md), line 98.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 97.
- `DraftTrashing` — instance of `Trashing` — [Commons application](../design/application.md), line 126.
  - `Item` is `Drafting.Brief` — [Commons application](../design/application.md), line 128.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 127.
- `Trashing` — instance of `Trashing` — [Commons application](../design/application.md), line 275.
  - `Item` is `Trashable` — [Commons application](../design/application.md), line 277.
  - `User` is `Authenticating.User` — [Commons application](../design/application.md), line 276.

### Vouching

Defined in [Vouching](../design/concepts/Vouching.md), line 1.

#### Actions

- `issue(subject: Subject, at: Date, expiresAt: Date) : return (voucher: Voucher, subject: Subject, credential: String)`
  - Refuses `VOUCHER_EXPIRY_INVALID`: The voucher expiry must come after its issue time.
- `verify(voucher: Voucher, credential: String, at: Date) : return (voucher: Voucher, subject: Subject)`
  - Refuses `VOUCHER_INVALID`: That voucher is not valid.
- `redeem(voucher: Voucher, credential: String, at: Date) : return (voucher: Voucher, subject: Subject)`
  - Refuses `VOUCHER_INVALID`: That voucher is not valid.

#### Queries

- `_getIssuedSince(subject: Subject, since: Date) : many (voucher: String, issuedAt: Date, expiresAt: Date)`

#### Instances

- `PasswordResetVouching` — instance of `Vouching` — [Commons application](../design/application.md), line 279.
  - `Subject` is `Authenticating.User` — [Commons application](../design/application.md), line 280.

## Application types

Concrete types:

- `Categorizable` — [Commons application](../design/application.md), line 82.
- `CategoryScope` — [Commons application](../design/application.md), line 77.
- `Linkable` — [Commons application](../design/application.md), line 60.
- `LiveItem` — [Commons application](../design/application.md), line 41.
- `LiveMaterial` — [Commons application](../design/application.md), line 37.
- `LiveParticipant` — [Commons application](../design/application.md), line 24.
- `LiveReasoner` — [Commons application](../design/application.md), line 29.
- `LiveRunSnapshot` — [Commons application](../design/application.md), line 33.
- `LiveSubject` — [Commons application](../design/application.md), line 45.
- `Lockable` — [Commons application](../design/application.md), line 18.
- `MailKey` — [Commons application](../design/application.md), line 15.
- `PinScope` — [Commons application](../design/application.md), line 73.
- `Pinnable` — [Commons application](../design/application.md), line 69.
- `Subscribable` — [Commons application](../design/application.md), line 56.
- `Subscriber` — [Commons application](../design/application.md), line 52.
- `TaskSubject` — [Commons application](../design/application.md), line 21.
- `Trashable` — [Commons application](../design/application.md), line 64.

## Computations

- `answerKind(value: Json, answer: String) : String` — [The wall](../design/compositions/live/walls.md), line 81.
- `answerReceipt(value: LiveRunSnapshot, answers: Seq) : Seq` — [Live runs](../design/compositions/live/runs.md), line 86.
- `boardQuestions(value: LiveRunSnapshot, values: Seq) : Seq` — [Live runs](../design/compositions/live/runs.md), line 82.
- `briefStanding(request: String) : String` — [Edits the model proposes](../design/compositions/live/edits.md), line 22.
- `capabilitiesAreKnown(capabilities: Strings) : Bool` — [Commons application](../design/application.md), line 364.
- `cardId(response: String, item: String) : String` — [The wall](../design/compositions/live/walls.md), line 36.
- `cardStanding(card: String, values: Json) : String` — [The wall](../design/compositions/live/walls.md), line 28.
- `carryUses() : Json` — [Relays and their runs](../design/compositions/live/relays.md), line 54.
- `clarifiedPassage(request: String, question: String, answer: String) : String` — [Commons application](../design/application.md), line 430.
- `draftTitle(form: String) : String` — [Commons application](../design/application.md), line 418.
- `draftingPassage(request: String) : String` — [Commons application](../design/application.md), line 422.
- `editCap(value: String) : Number` — [Edits the model proposes](../design/compositions/live/edits.md), line 81.
- `editChoices(value: String) : Strings` — [Edits the model proposes](../design/compositions/live/edits.md), line 84.
- `editParts(value: String) : Strings` — [Edits the model proposes](../design/compositions/live/edits.md), line 78.
- `editPosition(value: String) : Number` — [Edits the model proposes](../design/compositions/live/edits.md), line 87.
- `editPrompt(round: Json) : String` — [Edits the model proposes](../design/compositions/live/edits.md), line 66.
- `editRoundCap(round: Json) : Number` — [Edits the model proposes](../design/compositions/live/edits.md), line 72.
- `editRoundChoices(round: Json) : Strings` — [Edits the model proposes](../design/compositions/live/edits.md), line 75.
- `editRoundJson(value: String) : Json` — [Edits the model proposes](../design/compositions/live/edits.md), line 49.
- `editRoundParts(round: Json) : Strings` — [Edits the model proposes](../design/compositions/live/edits.md), line 69.
- `editRoundPosition(round: Json) : Number` — [Edits the model proposes](../design/compositions/live/edits.md), line 60.
- `editRoundTakesFrom(round: Json) : Number` — [Edits the model proposes](../design/compositions/live/edits.md), line 52.
- `editRoundTakesShape(round: Json) : String` — [Edits the model proposes](../design/compositions/live/edits.md), line 56.
- `editShape(value: String) : String` — [Edits the model proposes](../design/compositions/live/edits.md), line 90.
- `editTitle(round: Json) : String` — [Edits the model proposes](../design/compositions/live/edits.md), line 63.
- `effectiveCapabilities(capabilities: Strings) : Strings` — [Commons application](../design/application.md), line 368.
- `explanationReceipt(value: LiveRunSnapshot, answers: Seq) : Seq` — [Live runs](../design/compositions/live/runs.md), line 89.
- `invitationMailHtml(invitation: String, credential: String) : String` — [Commons application](../design/application.md), line 355.
- `invitationMailText(invitation: String, credential: String) : String` — [Commons application](../design/application.md), line 352.
- `isSame(left: String, right: String) : Bool` — [The wall](../design/compositions/live/walls.md), line 40.
- `legMaterials(legs: Json) : Strings` — [Edits the model proposes](../design/compositions/live/edits.md), line 30.
- `lidLines(reply: String, categories: Json) : Json` — [The wall](../design/compositions/live/walls.md), line 69.
- `lidPassage(pile: String, categories: Json, values: Json) : String` — [The wall](../design/compositions/live/walls.md), line 65.
- `noChoices(question: String) : Strings` — [Relays and their runs](../design/compositions/live/relays.md), line 51.
- `notificationMailHtml(notification: String) : String` — [Commons application](../design/application.md), line 361.
- `notificationMailText(notification: String) : String` — [Commons application](../design/application.md), line 358.
- `oneBoxCap(question: String) : Number` — [Relays and their runs](../design/compositions/live/relays.md), line 48.
- `oneBoxParts(question: String) : Strings` — [Relays and their runs](../design/compositions/live/relays.md), line 44.
- `parseKind(reply: String) : String` — [Commons application](../design/application.md), line 438.
- `parsedForm(reply: String) : String` — [Commons application](../design/application.md), line 442.
- `parsedMaterial(reply: String) : Json` — [Commons application](../design/application.md), line 445.
- `parsedQuestion(reply: String) : String` — [Commons application](../design/application.md), line 449.
- `parsedReason(reply: String) : String` — [Commons application](../design/application.md), line 453.
- `partLabel(value: Json, item: String) : String` — [The wall](../design/compositions/live/walls.md), line 85.
- `participantAnswers(reply: String, value: Json) : Json` — [The wall](../design/compositions/live/walls.md), line 77.
- `participantPassage(value: Json, participant: String) : String` — [The wall](../design/compositions/live/walls.md), line 73.
- `participantQuestions(value: LiveRunSnapshot) : Seq` — [Live runs](../design/compositions/live/runs.md), line 78.
- `passwordResetCooldownStart(at: Date) : Date` — [Commons application](../design/application.md), line 373.
- `passwordResetExpiry(at: Date) : Date` — [Commons application](../design/application.md), line 378.
- `passwordResetMailHtml(voucher: String, credential: String, username: String) : String` — [Commons application](../design/application.md), line 384.
- `passwordResetMailText(voucher: String, credential: String, username: String) : String` — [Commons application](../design/application.md), line 381.
- `pickPriority(count: Number) : Number` — [The wall](../design/compositions/live/walls.md), line 32.
- `pileCards(pile: String, categories: Json, values: Json) : Strings` — [Relays and their runs](../design/compositions/live/relays.md), line 68.
- `placingLines(reply: String, categories: Json, values: Json) : Json` — [The wall](../design/compositions/live/walls.md), line 56.
- `placingPassage(value: Json, categories: Json, values: Json) : String` — [The wall](../design/compositions/live/walls.md), line 43.
- `placingReading(reply: String, categories: Json, values: Json) : String` — [The wall](../design/compositions/live/walls.md), line 53.
- `placingReason(reply: String, categories: Json, values: Json) : String` — [The wall](../design/compositions/live/walls.md), line 61.
- `placingRepairPassage(value: Json, categories: Json, values: Json, offering: String, account: String) : String` — [The wall](../design/compositions/live/walls.md), line 49.
- `positionAfter(position: Number) : Number` — [Commons application](../design/application.md), line 461.
- `positionBefore(position: Number) : Number` — [Commons application](../design/application.md), line 466.
- `receiptKind(choices: Strings, expected: String) : String` — [Commons application](../design/application.md), line 470.
- `relayDraftPassage(request: String, legs: Json, materials: Json) : String` — [Edits the model proposes](../design/compositions/live/edits.md), line 26.
- `relayDraftReading(reply: String) : String` — [Edits the model proposes](../design/compositions/live/edits.md), line 37.
- `relayDraftReason(reply: String) : String` — [Edits the model proposes](../design/compositions/live/edits.md), line 40.
- `relayDraftRepairPassage(passage: String, offering: String, account: String) : String` — [Edits the model proposes](../design/compositions/live/edits.md), line 33.
- `relayEditLines(reply: String, legs: Json, materials: Json) : Json` — [Edits the model proposes](../design/compositions/live/edits.md), line 44.
- `repairPassage(request: String, offering: String, account: String) : String` — [Commons application](../design/application.md), line 434.
- `revisionPassage(request: String, form: String, material: Json) : String` — [Commons application](../design/application.md), line 426.
- `setupSecretMatches(secret: String) : Bool` — [Commons application](../design/application.md), line 387.
- `singleImportRow(email: String, kind: String, section: String, displayName: String) : Rows` — [Commons application](../design/application.md), line 390.
- `snapshotForm(value: LiveRunSnapshot) : String` — [Live runs](../design/compositions/live/runs.md), line 67.
- `snapshotHasQuestion(value: LiveRunSnapshot, question: String) : Boolean` — [Live runs](../design/compositions/live/runs.md), line 70.
- `snapshotIsWhole(value: LiveRunSnapshot, answers: Seq) : Boolean` — [Live runs](../design/compositions/live/runs.md), line 74.
- `snapshotTitle(value: LiveRunSnapshot) : String` — [Live runs](../design/compositions/live/runs.md), line 64.
- `soleTarget(target: String) : Strings` — [Commons application](../design/application.md), line 457.
- `subjectIsAddress(subject: String) : Bool` — [Commons application](../design/application.md), line 396.
- `taskListMailHtml(kind: String, listTitle: String) : String` — [Commons application](../design/application.md), line 406.
- `taskListMailSubject(kind: String, listTitle: String) : String` — [Commons application](../design/application.md), line 400.
- `taskListMailText(kind: String, listTitle: String) : String` — [Commons application](../design/application.md), line 403.
- `taskMailHtml(kind: String, taskTitle: String, listTitle: String, deadline: String) : String` — [Commons application](../design/application.md), line 415.
- `taskMailSubject(kind: String, taskTitle: String, listTitle: String) : String` — [Commons application](../design/application.md), line 409.
- `taskMailText(kind: String, taskTitle: String, listTitle: String, deadline: String) : String` — [Commons application](../design/application.md), line 412.
- `useFit(use: String, choices: Strings, parts: Strings) : String` — [Relays and their runs](../design/compositions/live/relays.md), line 62.
- `useStanding(use: String) : String` — [Relays and their runs](../design/compositions/live/relays.md), line 58.

## Views

_Views name reusable conditions. Multiple `where` blocks are alternatives._

### (card) is a card of (round)

```view
(card) is a card of (round) — inputs (card, round); outputs (); bindings (values, standing)
  where
    Responding._valuesForSubject (subject: round) has (values)
    standing is cardStanding (card, values)
    standing is among ["known"]
```

### (round) is of a closed run

```view
(round) is of a closed run — inputs (round); outputs (); bindings (run)
  where
    Linking._getLinks (source: round) has (target: run)
    Publishing._edition (edition: run) has (open: false)
```

### (pile) is on the wall of a closed run

```view
(pile) is on the wall of a closed run — inputs (pile); outputs (); bindings (round)
  where
    Categorizing._getCategoryDetail (category: pile) has (scope: round)
    view "(round) is of a closed run" with (round)
```

### (card) is in a pile of a closed run

```view
(card) is in a pile of a closed run — inputs (card); outputs (); bindings (category)
  where
    Categorizing._getCategory (item: card) has (category)
    view "(pile) is on the wall of a closed run" with (pile: category)
```

### (card) is in no pile of a closed run

```view
(card) is in no pile of a closed run — inputs (card); outputs (); bindings ()
  where no view "(card) is in a pile of a closed run" with (card)
```

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

### the round of (leg) in (run)

```view
the round of (leg) in (run) — inputs (run, leg); outputs (round, open); bindings (material) — answers at most one (round, open)
  where
    Relaying._leg (leg) has (material)
    Linking._getBacklinks (target: run) has (source: round)
    Publishing._edition (edition: round) has (material, open)
```

### (leg) already ran in (run)

```view
(leg) already ran in (run) — inputs (run, leg); outputs (); bindings ()
  where view "the round of (leg) in (run)" with (leg, run)
```

### (leg) has not run in (run)

```view
(leg) has not run in (run) — inputs (run, leg); outputs (); bindings ()
  where no view "the round of (leg) in (run)" with (leg, run)
```

### (leg) is a round of (run)

```view
(leg) is a round of (run) — inputs (run, leg); outputs (); bindings (relay)
  where
    Publishing._edition (edition: run) has (material: relay)
    Relaying._leg (leg) has (relay)
```

### (leg) is not a round of (run)

```view
(leg) is not a round of (run) — inputs (run, leg); outputs (); bindings (relay)
  where
    Publishing._edition (edition: run) has (material: relay)
    Relaying._leg (leg) and not (relay)
```

### (leg) takes from a round not yet closed in (run)

```view
(leg) takes from a round not yet closed in (run) — inputs (run, leg); outputs (); bindings (source)
  where
    Relaying._draws (leg) has (source)
    no view "the round of (leg) in (run)" with (leg: source, run) has (open: false)
```

### (leg) takes nothing

```view
(leg) takes nothing — inputs (leg); outputs (); bindings ()
  where no Relaying._draws (leg)
```

### (member) removed somebody else from (list)

```view
(member) removed somebody else from (list) — inputs (member, list); outputs (); bindings ()
  where Grouping._isMember (group: list, member) has (isMember: true)
```

### (participant) holds a seat on (run)

```view
(participant) holds a seat on (run) — inputs (participant, run); outputs (); bindings ()
  where Subscribing._isSubscribed (target: run, user: participant) has (subscribed: true)
```

### (participant)'s seat is not dismissed

```view
(participant)'s seat is not dismissed — inputs (participant); outputs (); bindings ()
  where Trashing._isTrashed (item: participant) has (trashed: false)
```

### (pile) holds a card

```view
(pile) holds a card — inputs (pile); outputs (); bindings ()
  where Categorizing._getItems (category: pile)
```

### (pile) is a pile

```view
(pile) is a pile — inputs (pile); outputs (); bindings ()
  where Categorizing._getCategoryDetail (category: pile)
```

### (pile) is no pile

```view
(pile) is no pile — inputs (pile); outputs (); bindings ()
  where no Categorizing._getCategoryDetail (category: pile)
```

### (pile) is not on the wall of a closed run

```view
(pile) is not on the wall of a closed run — inputs (pile); outputs (); bindings ()
  where no view "(pile) is on the wall of a closed run" with (pile)
```

### (pile) is on the wall of (round)

```view
(pile) is on the wall of (round) — inputs (pile, round); outputs (); bindings ()
  where Categorizing._getCategoryDetail (category: pile) has (scope: round)
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

### (question) belongs to (run)

```view
(question) belongs to (run) — inputs (question, run); outputs (); bindings (presentation, belongs)
  where
    RunSnapshotting._snapshot (subject: run) has (value: presentation)
    belongs is snapshotHasQuestion (question, value: presentation)
    belongs is among [true]
```

### (question) is not part of (run)

```view
(question) is not part of (run) — inputs (question, run); outputs (); bindings (presentation, belongs)
  where
    RunSnapshotting._snapshot (subject: run) has (value: presentation)
    belongs is snapshotHasQuestion (question, value: presentation)
    belongs is among [false]
```

### (questionnaire) has an open run

```view
(questionnaire) has an open run — inputs (questionnaire); outputs (); bindings ()
  where Publishing._hasOpenEditionFor (material: questionnaire) has (open: true)
```

### (questionnaire) has no open run

```view
(questionnaire) has no open run — inputs (questionnaire); outputs (); bindings ()
  where Publishing._hasOpenEditionFor (material: questionnaire) has (open: false)
```

### (relay) has an open run

```view
(relay) has an open run — inputs (relay); outputs (); bindings ()
  where Publishing._hasOpenEditionFor (material: relay) has (open: true)
```

### (relay) has no open run

```view
(relay) has no open run — inputs (relay); outputs (); bindings ()
  where Publishing._hasOpenEditionFor (material: relay) has (open: false)
```

### (relay) is not retired

```view
(relay) is not retired — inputs (relay); outputs (); bindings ()
  where Trashing._isTrashed (item: relay) has (trashed: false)
```

### (relay) is retired

```view
(relay) is retired — inputs (relay); outputs (); bindings ()
  where Trashing._isTrashed (item: relay) has (trashed: true)
```

### (response) answers every question

```view
(response) answers every question — inputs (response); outputs (); bindings (run, presentation, answers, whole)
  where
    Responding._response (response) has (subject: run)
    RunSnapshotting._snapshot (subject: run) has (value: presentation)
    Responding._collectedAnswers (response) has (answers)
    whole is snapshotIsWhole (answers, value: presentation)
    whole is among [true]
```

### (response) leaves a question unanswered

```view
(response) leaves a question unanswered — inputs (response); outputs (); bindings (run, presentation, answers, whole)
  where
    Responding._response (response) has (subject: run)
    RunSnapshotting._snapshot (subject: run) has (value: presentation)
    Responding._collectedAnswers (response) has (answers)
    whole is snapshotIsWhole (answers, value: presentation)
    whole is among [false]
```

### (round) has a card still in the tray

```view
(round) has a card still in the tray — inputs (round); outputs (); bindings (response, item, card)
  where
    Responding._submittedAnswers (subject: round) has (item, response)
    card is cardId (item, response)
    no Categorizing._getCategory (item: card)
```

### (round) has every card in a pile

```view
(round) has every card in a pile — inputs (round); outputs (); bindings ()
  where no view "(round) has a card still in the tray" with (round)
```

### (round) has no piles picked

```view
(round) has no piles picked — inputs (round); outputs (); bindings ()
  where no Pinning._getPinned (scope: round)
```

### (round) has piles picked

```view
(round) has piles picked — inputs (round); outputs (); bindings ()
  where Pinning._getPinned (scope: round)
```

### (round) is a round with a captured question

```view
(round) is a round with a captured question — inputs (round); outputs (); bindings ()
  where
    Publishing._edition (edition: round)
    RunSnapshotting._snapshot (subject: round)
```

### (round) is not of a closed run

```view
(round) is not of a closed run — inputs (round); outputs (); bindings ()
  where no view "(round) is of a closed run" with (round)
```

### (round) is of an open run

```view
(round) is of an open run — inputs (round); outputs (); bindings (run)
  where
    Linking._getLinks (source: round) has (target: run)
    Publishing._edition (edition: run) has (open: true)
```

### (run) is open to participation

```view
(run) is open to participation — inputs (run); outputs (); bindings ()
  where Publishing._edition (edition: run) has (open: true)
```

### (round) is open on an open run

```view
(round) is open on an open run — inputs (round); outputs (); bindings ()
  where
    view "(run) is open to participation" with (run: round)
    view "(round) is of an open run" with (round)
```

### (round) is not open on an open run

```view
(round) is not open on an open run — inputs (round); outputs (); bindings ()
  where no view "(round) is open on an open run" with (round)
```

### the open round of (run)

```view
the open round of (run) — inputs (run); outputs (round); bindings () — answers at most one (round)
  where
    Linking._getBacklinks (target: run) has (source: round)
    Publishing._edition (edition: run) has (open: true)
    Publishing._edition (edition: round) has (open: true)
```

### (run) has a round open

```view
(run) has a round open — inputs (run); outputs (); bindings ()
  where view "the open round of (run)" with (run)
```

### (run) has no round open

```view
(run) has no round open — inputs (run); outputs (); bindings ()
  where no view "the open round of (run)" with (run)
```

### (run) is a questionnaire run

```view
(run) is a questionnaire run — inputs (run); outputs (); bindings ()
  where RunSnapshotting._snapshot (subject: run)
```

### (run) is a relay run

```view
(run) is a relay run — inputs (run); outputs (); bindings (relay)
  where
    Publishing._edition (edition: run) has (material: relay)
    Relaying._relay (relay)
```

### (run) is a round of a relay

```view
(run) is a round of a relay — inputs (run); outputs (); bindings (questionnaire)
  where
    Publishing._edition (edition: run) has (material: questionnaire)
    Relaying._legFor (material: questionnaire)
```

### (run) is closed

```view
(run) is closed — inputs (run); outputs (); bindings ()
  where Publishing._edition (edition: run) has (open: false)
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

### (user) belongs to task list (list)

```view
(user) belongs to task list (list) — inputs (user, list); outputs (); bindings ()
  where Grouping._isMember (group: list, member: user) has (isMember: true)
```

### (user) did not author (post)

```view
(user) did not author (post) — inputs (user, post); outputs (); bindings ()
  where Posting._getPost (post) and not (author: user)
```

### (user) does not belong to task list (list)

```view
(user) does not belong to task list (list) — inputs (user, list); outputs (); bindings ()
  where Grouping._isMember (group: list, member: user) has (isMember: false)
```

### (user) holds a role in (context)

```view
(user) holds a role in (context) — inputs (user, context); outputs (); bindings ()
  where Roling._getRole (context, user)
```

### (user) holds no role in (context)

```view
(user) holds no role in (context) — inputs (user, context); outputs (); bindings ()
  where no Roling._getRole (context, user)
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

### (user) is archived

```view
(user) is archived — inputs (user); outputs (); bindings ()
  where Archiving._isTrashed (item: user) has (trashed: true)
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

### (user) is not the only administrator

```view
(user) is not the only administrator — inputs (user); outputs (); bindings ()
  where Roling._isSoleCapabilityHolder (capability: "administer", context: "commons", user) has (sole: false)
```

### (user) is not yet notified about (subject)

Authored path: `Forum.notifications.isNotYetNotifiedAbout`.
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 17.

```view
(user) is not yet notified about (subject) — inputs (user, subject); outputs (); bindings ()
  where Notifying._hasFor (subject, user) has (notified: false)
```

### (user) is the only administrator

```view
(user) is the only administrator — inputs (user); outputs (); bindings ()
  where Roling._isSoleCapabilityHolder (capability: "administer", context: "commons", user) has (sole: true)
```

### (user) may act on task (task) at (at)

```view
(user) may act on task (task) at (at) — inputs (user, task, at); outputs (); bindings (list)
  where
    Tasking._getTask (at, task) has (scope: list)
    Grouping._isMember (group: list, member: user) has (isMember: true)
```

### (user) may administer

```view
(user) may administer — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: true)
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

### (user) may grade

```view
(user) may grade — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "grade", context: "commons", user) has (allowed: true)
  where Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: true)
```

### (user) may host live runs

```view
(user) may host live runs — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "live:host", context: "commons", user) has (allowed: true)
  where Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: true)
```

### (user) may manage student records

```view
(user) may manage student records — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "student-records", context: "commons", user) has (allowed: true)
  where Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: true)
```

### (user) may manage the course

```view
(user) may manage the course — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "course:manage", context: "commons", user) has (allowed: true)
  where Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: true)
```

### (user) may moderate

```view
(user) may moderate — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "moderate", context: "commons", user) has (allowed: true)
  where Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: true)
```

### (user) may not act on task (task) at (at)

```view
(user) may not act on task (task) at (at) — inputs (user, task, at); outputs (); bindings (list)
  where
    Tasking._getTask (at, task) has (scope: list)
    Grouping._isMember (group: list, member: user) has (isMember: false)
  where no Tasking._getTask (at, task)
```

### (user) may not administer

```view
(user) may not administer — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: false)
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

### (user) may not grade

```view
(user) may not grade — inputs (user); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "grade", context: "commons", user) has (allowed: false)
    Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: false)
```

### (user) may not host live runs

```view
(user) may not host live runs — inputs (user); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "live:host", context: "commons", user) has (allowed: false)
    Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: false)
```

### (user) may not manage student records

```view
(user) may not manage student records — inputs (user); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "student-records", context: "commons", user) has (allowed: false)
    Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: false)
```

### (user) may not manage the course

```view
(user) may not manage the course — inputs (user); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "course:manage", context: "commons", user) has (allowed: false)
    Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: false)
```

### (user) may not moderate

```view
(user) may not moderate — inputs (user); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "moderate", context: "commons", user) has (allowed: false)
    Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: false)
```

### (user) may not view the staff calendar

```view
(user) may not view the staff calendar — inputs (user); outputs (); bindings ()
  where
    Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: false)
    Roling._hasCapability (capability: "course:manage", context: "commons", user) has (allowed: false)
    Roling._hasCapability (capability: "grade", context: "commons", user) has (allowed: false)
    Roling._hasCapability (capability: "student-records", context: "commons", user) has (allowed: false)
    Roling._hasCapability (capability: "moderate", context: "commons", user) has (allowed: false)
```

### (user) may view the staff calendar

```view
(user) may view the staff calendar — inputs (user); outputs (); bindings ()
  where Roling._hasCapability (capability: "administer", context: "commons", user) has (allowed: true)
  where Roling._hasCapability (capability: "course:manage", context: "commons", user) has (allowed: true)
  where Roling._hasCapability (capability: "grade", context: "commons", user) has (allowed: true)
  where Roling._hasCapability (capability: "student-records", context: "commons", user) has (allowed: true)
  where Roling._hasCapability (capability: "moderate", context: "commons", user) has (allowed: true)
```

### an ask about (round) is still out

```view
an ask about (round) is still out — inputs (round); outputs (); bindings ()
  where Reasoning._pending () has (about: round)
```

### every round (leg) takes from has closed in (run)

```view
every round (leg) takes from has closed in (run) — inputs (run, leg); outputs (); bindings ()
  where no view "(leg) takes from a round not yet closed in (run)" with (leg, run)
```

### nothing is still out about (round)

```view
nothing is still out about (round) — inputs (round); outputs (); bindings ()
  where no Reasoning._pending () has (about: round)
```

### somebody other than (actor) must hear about (task) at (at)

```view
somebody other than (actor) must hear about (task) at (at) — inputs (task, actor, at); outputs (); bindings (list, assignee)
  where
    Tasking._getTask (at, task) has (scope: list)
    Grouping._getMembers (group: list) has (member: assignee)
    Tasking._getTask (at, task) has (assignee)
    Tasking._getTask (at, task) and not (assignee: actor)
```

### the account at (email)

Authored path: `Course.roster.theAccountAt`.
- Covered by [Roster](../design/compositions/course/roster.md), line 28.

```view
the account at (email) — inputs (email); outputs (user); bindings () — answers at most one (user)
  where Authenticating._getByEmail (email) has (user)
```

### the account for (address)

Authored path: `Access.roles.theAccountForAddress`.
- Covered by [Roles](../design/compositions/access/roles.md), line 41.

```view
the account for (address) — inputs (address); outputs (user); bindings () — answers at most one (user)
  where Authenticating._getByEmail (email: address) has (user)
```

### the active user of (session)

Authored path: `Access.session.activeUser`.
- Covered by [Session boundary](../design/compositions/access/session.md), line 13.

```view
the active user of (session) — inputs (session); outputs (user); bindings () — answers at most one (user)
  where Sessioning._getUser (session) has (user)
```

### the archived user named (username)

Authored path: `Access.auth.theArchivedUserNamed`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 47.

```view
the archived user named (username) — inputs (username); outputs (user); bindings () — answers at most one (user)
  where
    Authenticating._getByUsername (username) has (user)
    view "(user) is archived" with (user)
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

### the invitation for (address)

Authored path: `Access.invitations.theInvitationFor`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 14.

```view
the invitation for (address) — inputs (address); outputs (invitation); bindings () — answers at most one (invitation)
  where Inviting._getInvitationByAddress (address, channel: "email") has (invitation)
```

### the item count of (candidate)

```view
the item count of (candidate) — inputs (candidate); outputs (total); bindings () — answers exactly one (total)
  where total is the count of Drafting._items (candidate)
```

### the latest submission for (assignment) by (submitter)

Authored path: `Course.submissions.theLatestSubmission`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 3.

```view
the latest submission for (assignment) by (submitter) — inputs (assignment, submitter); outputs (latest); bindings () — answers at most one (latest)
  where Submitting._getLatest (assignment, submitter) has (latest)
```

### the list title behind (subject) of kind (kind) for (reader) at (at)

```view
the list title behind (subject) of kind (kind) for (reader) at (at) — inputs (subject, kind, reader, at); outputs (title); bindings (list) — answers at most one (title)
  where
    Grouping._getGroup (group: subject) has (title)
    Grouping._isMember (group: subject, member: reader) has (isMember: true)
  where
    Grouping._getGroup (group: subject) has (title)
    Grouping._isMember (group: subject, member: reader) has (isMember: false)
    kind is among ["task-list-removed"]
  where
    Tasking._getTask (at, task: subject) has (scope: list)
    Grouping._getGroup (group: list) has (title)
    Grouping._isMember (group: list, member: reader) has (isMember: true)
```

### the live account at (email)

Authored path: `Course.roster.theLiveAccountAt`.
- Covered by [Roster](../design/compositions/course/roster.md), line 34.

```view
the live account at (email) — inputs (email); outputs (user); bindings () — answers at most one (user)
  where
    Authenticating._getByEmail (email) has (user)
    no view "(user) is archived" with (user)
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

### the pick count of (round)

```view
the pick count of (round) — inputs (round); outputs (taken); bindings () — answers exactly one (taken)
  where taken is the count of Pinning._getPinned (scope: round)
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

### the question count of (questionnaire)

```view
the question count of (questionnaire) — inputs (questionnaire); outputs (total); bindings () — answers exactly one (total)
  where total is the count of Questioning._getQuestions (questionnaire)
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

### the role of (user) in (context)

Authored path: `Access.roles.theRoleOf`.
- Covered by [Roles](../design/compositions/access/roles.md), line 100.

```view
the role of (user) in (context) — inputs (user, context); outputs (role, name, capabilities); bindings () — answers at most one (role, name, capabilities)
  where
    Roling._getRole (context, user) has (role)
    Roling._getRoleDetail (role) has (capabilities, name)
```

### the root of drafting line (brief)

```view
the root of drafting line (brief) — inputs (brief); outputs (root, rootAuthor, abandoned); bindings () — answers exactly one (root, rootAuthor, abandoned)
  where
    Drafting._rootOf (brief) has (root)
    Drafting._brief (brief: root) has (author: rootAuthor)
    DraftTrashing._isTrashed (item: root) has (trashed: abandoned)
```

### the run of (round)

```view
the run of (round) — inputs (round); outputs (run); bindings () — answers at most one (run)
  where Linking._getLinks (source: round) has (target: run)
```

### the seat at (email)

Authored path: `Course.roster.theSeatAt`.
- Covered by [Roster](../design/compositions/course/roster.md), line 110.

```view
the seat at (email) — inputs (email); outputs (seat); bindings () — answers at most one (seat)
  where Rostering._getSeatByEmail (email) has (seat)
```

### the seat detail of (user)

Authored path: `Course.notes.theSeatDetailOf`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 12.

```view
the seat detail of (user) — inputs (user); outputs (detail); bindings () — answers at most one (detail)
  where Rostering._getSeatDetail (user) has (detail)
```

### the seat of (user)

Authored path: `Course.roster.theSeatOf`.
- Covered by [Roster](../design/compositions/course/roster.md), line 168.

```view
the seat of (user) — inputs (user); outputs (seat); bindings () — answers at most one (seat)
  where Rostering._getSeatByUser (user) has (seat, status: "ACTIVE")
```

### the task behind (subject) for (reader) at (at)

```view
the task behind (subject) for (reader) at (at) — inputs (subject, reader, at); outputs (list, title, details, startsAt, endsAt, state, assignee); bindings () — answers at most one (list, title, details, startsAt, endsAt, state, assignee)
  where
    Tasking._getTask (at, task: subject) has (assignee, details, endsAt, scope: list, startsAt, state, title)
    Grouping._isMember (group: list, member: reader) has (isMember: true)
```

### the task list holding (task) at (at)

```view
the task list holding (task) at (at) — inputs (task, at); outputs (list); bindings () — answers at most one (list)
  where Tasking._getTask (at, task) has (scope: list)
```

### the task notification mail of kind (kind) about (subject) for (recipient) at (at)

```view
the task notification mail of kind (kind) about (subject) for (recipient) at (at) — inputs (kind, subject, recipient, at); outputs (mailSubject, text, html); bindings (listTitle, taskTitle, list, deadline) — answers at most one (mailSubject, text, html)
  where
    Grouping._getGroup (group: subject) has (title: listTitle)
    mailSubject is taskListMailSubject (kind, listTitle)
    text is taskListMailText (kind, listTitle)
    html is taskListMailHtml (kind, listTitle)
  where
    Tasking._getTask (at, task: subject) has (endsAt: deadline, scope: list, title: taskTitle)
    Grouping._getGroup (group: list) has (title: listTitle)
    Grouping._isMember (group: list, member: recipient) has (isMember: true)
    mailSubject is taskMailSubject (kind, listTitle, taskTitle)
    text is taskMailText (deadline, kind, listTitle, taskTitle)
    html is taskMailHtml (deadline, kind, listTitle, taskTitle)
```

### the user named (username)

Authored path: `Access.auth.theUserNamed`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 55.

```view
the user named (username) — inputs (username); outputs (user); bindings () — answers at most one (user)
  where Authenticating._getByUsername (username) has (user)
```

### what (leg) takes

```view
what (leg) takes — inputs (leg); outputs (source, shape); bindings () — answers at most one (source, shape)
  where Relaying._draws (leg) has (shape, source)
```

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### the answers outcome of (response)

Authored path: `Live.participation.theAnswersOutcome`.
- Covered by [Participation](../design/compositions/live/participation.md), line 68.

```former
Former "the answers outcome of (response)" — inputs (response); bindings (run, key, presentation, disclosure, score, outOf, answers, receipt); promises at most one record — forms:
  a record of
    where Responding._response (response) has (subject: run, submitted: true)
    where RunSnapshotting._snapshot (subject: run) has (value: presentation)
    where Scoring._keyFor (subject: run) has (disclosure, key)
    where whether Scoring._resultFor (key, submission: response) has (outOf, score)
    where Responding._collectedAnswers (response) has (answers)
    where receipt is answerReceipt (answers, value: presentation)
    disclosure
    outOf
    receipt
    response
    score
```

### the assigned population for (assignment)

Authored path: `Course.submissions.theAssignedPopulationForAssignment`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 15.

```former
Former "the assigned population for (assignment)" — inputs (assignment); bindings (assignee, displayName, release, dueOverride, releaseStatus); promises exactly one record — forms:
  each Assigning._getAssignees (assignment) has (assignee)
    where whether Profiling._getProfileFields (user: assignee) has (displayName)
    where Assigning._getAssigned (assignee) has (assignment, dueOverride, release, status: releaseStatus)
    form a record of
      assignee
      displayName
      dueOverride
      release
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

### the board of (run)

Authored path: `Live.runs.theRunBoard`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 52.

```former
Former "the board of (run)" — inputs (run); bindings (questionnaire, title, form, open, openedAt, closedAt, token, code, started, handedIn, presentation, values, questions); promises at most one record — forms:
  a record of
    where Publishing._edition (edition: run) has (closedAt, material: questionnaire, open, openedAt)
    where RunSnapshotting._snapshot (subject: run) has (value: presentation)
    where Responding._valuesForSubject (subject: run) has (values)
    where title is snapshotTitle (value: presentation)
    where form is snapshotForm (value: presentation)
    where questions is boardQuestions (value: presentation, values)
    where whether Locating._for (subject: run) has (code)
    closedAt
    code
    form
    handedIn: the count of Responding._responsesFor (subject: run) has (response: handedIn, submitted: true)
    open
    openedAt
    questionnaire
    questions
    run
    started: the count of Responding._responsesFor (subject: run) has (response: started)
    title
    token: the token of the first Sharing._sharesFor (subject: run) has (token)
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

### the calendar of (student) between (start) and (end)

Authored path: `Course.calendar.theCalendarOf`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 5.

```former
Former "the calendar of (student) between (start) and (end)" — inputs (student, start, end); bindings (assignment, release, dueOverride, title, kind, availableAt, dueAt, closeAt, status); promises exactly one record — forms:
  each Assigning._getAssigned (assignee: student) has (assignment, dueOverride, release)
    where Assigning._getPublishedInWindow (end, start) has (assignment)
    where Assigning._getAssignments () has (assignment, availableAt, closeAt, dueAt, kind, status, title)
    form a record of
      assignment
      availableAt
      closeAt
      dueAt
      dueOverride
      kind
      release
      status
      title
```

### the categories ()

Authored path: `Forum.categories.theCategories`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 13.

```former
Former "the categories ()" — inputs (); bindings (category, name, description); promises exactly one record — forms:
  each Categorizing._categoriesIn (scope: "forum") has (category, description, name)
    form a record of
      category
      description
      name
```

### the category of (item)

Authored path: `Forum.categories.theCategoryOf`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 17.

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
- Covered by [Grades](../design/compositions/course/grades.md), line 21.

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
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 8.

```former
Former "the dashboard seat of (user)" — inputs (user); bindings (seat, holder, email, kind, section, status); promises exactly one record — forms:
  each Rostering._getSeatByUser (user) has (email, kind, seat, section, status, user: holder)
    form a record of
      email
      kind
      seat
      section
      status
      user: holder
```

### the defined roles ()

Authored path: `Access.roles.theDefinedRoles`.
- Covered by [Roles](../design/compositions/access/roles.md), line 97.

```former
Former "the defined roles ()" — inputs (); bindings (role, name, capabilities); promises exactly one record — forms:
  each Roling._listRoles () has (capabilities, name, role)
    form a record of
      capabilities
      name
      role
```

### the drafting line of (brief)

Authored path: `Live.drafting.theDraftLine`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 50.

```former
Former "the drafting line of (brief)" — inputs (brief); bindings (step, request, basis, candidate, form, adopted, clarifying, stalled, clarification, question, answer, prompt, choices, expected, explanation, position, refines, composed, root, rootAuthor, abandoned); promises exactly one record — forms:
  each Drafting._line (brief) has (adopted, basis, brief: step, candidate, form, request)
    where view "the root of drafting line (brief)" with (brief: step) has (abandoned, root, rootAuthor)
    where Drafting._standing (brief: step) has (clarifying, stalled)
    where whether Drafting._originOf (brief: step) has (origin: refines)
    where whether AdoptLinking._getLinks (source: step) has (target: composed)
    form a record of
      abandoned
      adopted
      basis
      candidate
      clarifications: each Drafting._clarifications (brief: step) has (answer, clarification, question)
        form a record of
          answer
          clarification
          question
      clarifying
      composed
      form
      items: each Drafting._items (candidate) has (choices, expected, explanation, position, prompt)
        form a record of
          choices
          expected
          explanation
          position
          prompt
      refines
      request
      root
      rootAuthor
      stalled
      step
```

### the drafting lines of (author)

Authored path: `Live.drafting.theDraftLines`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 100.

```former
Former "the drafting lines of (author)" — inputs (author); bindings (brief, request, createdAt, origin, adopted, stalled, clarifying, refinesTitle, composed, composedTitle, rootAuthor, abandoned); promises exactly one record — forms:
  each Drafting._lines (author) has (adopted, brief, clarifying, createdAt, origin, request, stalled)
    where view "the root of drafting line (brief)" with (brief) has (abandoned, rootAuthor)
    where whether Questioning._getQuestionnaire (questionnaire: origin) has (title: refinesTitle)
    where whether AdoptLinking._getLinks (source: brief) has (target: composed)
    where whether Questioning._getQuestionnaire (questionnaire: composed) has (title: composedTitle)
    form a record of
      abandoned
      adopted
      brief
      clarifying
      composed
      composedTitle
      createdAt
      refines: origin
      refinesTitle
      request
      rootAuthor
      stalled
```

### the drafting provenance of (questionnaire)

Authored path: `Live.drafting.theProvenance`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 107.

```former
Former "the drafting provenance of (questionnaire)" — inputs (questionnaire); bindings (composer, composedRequest, composedAt, brief, author, request, createdAt, adopted, stalled, clarifying, composedRoot, composedRootAuthor, composedAbandoned, rootAuthor, abandoned); promises exactly one record — forms:
  a record of
    composed: each AdoptLinking._getBacklinks (target: questionnaire) has (source: composer)
      where view "the root of drafting line (brief)" with (brief: composer) has (abandoned: composedAbandoned, root: composedRoot, rootAuthor: composedRootAuthor)
      where Drafting._brief (brief: composer) has (createdAt: composedAt, request: composedRequest)
      form a record of
        abandoned: composedAbandoned
        brief: composer
        createdAt: composedAt
        request: composedRequest
        root: composedRoot
        rootAuthor: composedRootAuthor
    refined: each Drafting._openedFrom (origin: questionnaire) has (adopted, author, brief, clarifying, createdAt, request, stalled)
      where view "the root of drafting line (brief)" with (brief) has (abandoned, rootAuthor)
      form a record of
        abandoned
        adopted
        author
        brief
        clarifying
        createdAt
        request
        rootAuthor
        stalled
```

### the dropped roster ()

Authored path: `Course.roster.theDroppedRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 179.

```former
Former "the dropped roster ()" — inputs (); bindings (user, seat, kind, section, email, displayName); promises exactly one record — forms:
  each Rostering._getDroppedSeats () has (email, kind, seat, section, user)
    where whether Profiling._getProfileFields (user) has (displayName)
    form a record of
      displayName
      email
      kind
      seat
      section
      user
```

### the explained outcome of (response)

Authored path: `Live.participation.theExplanationsOutcome`.
- Covered by [Participation](../design/compositions/live/participation.md), line 69.

```former
Former "the explained outcome of (response)" — inputs (response); bindings (run, key, presentation, disclosure, score, outOf, answers, receipt); promises at most one record — forms:
  a record of
    where Responding._response (response) has (subject: run, submitted: true)
    where RunSnapshotting._snapshot (subject: run) has (value: presentation)
    where Scoring._keyFor (subject: run) has (disclosure, key)
    where whether Scoring._resultFor (key, submission: response) has (outOf, score)
    where Responding._collectedAnswers (response) has (answers)
    where receipt is explanationReceipt (answers, value: presentation)
    disclosure
    outOf
    receipt
    response
    score
```

### the face of (run)

Authored path: `Live.participation.theParticipantFace`.
- Covered by [Participation](../design/compositions/live/participation.md), line 19.

```former
Former "the face of (run)" — inputs (run); bindings (open, presentation, title, form, questions); promises at most one record — forms:
  a record of
    where Publishing._edition (edition: run) has (open)
    where RunSnapshotting._snapshot (subject: run) has (value: presentation)
    where title is snapshotTitle (value: presentation)
    where form is snapshotForm (value: presentation)
    where questions is participantQuestions (value: presentation)
    form
    open
    questions
    run
    title
```

### the face of relay run (run)

Authored path: `Live.relays.theRelayFace`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 41.

```former
Former "the face of relay run (run)" — inputs (run); bindings (relay, title, open, openRound, presentation, questions, leg, material, position, roundTitle, round, roundOpen); promises at most one record — forms:
  a record of
    where Publishing._edition (edition: run) has (material: relay, open)
    where Relaying._relay (relay) has (title)
    where whether view "the open round of (run)" with (run) has (round: openRound)
    where whether RunSnapshotting._snapshot (subject: openRound) has (value: presentation)
    where questions is participantQuestions (value: presentation)
    open
    openRound
    questions
    rounds: each Relaying._legs (relay) has (leg, material, position)
      where Questioning._getQuestionnaire (questionnaire: material) has (title: roundTitle)
      where whether view "the round of (leg) in (run)" with (leg, run) has (open: roundOpen, round)
      form a record of
        leg
        number: position
        open: roundOpen
        round
        title: roundTitle
    run
    title
```

### the figure of (round)

Authored path: `Live.relays.theRoundFigure`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 33.

```former
Former "the figure of (round)" — inputs (round); bindings (open, openedAt, closedAt, begun, handedIn, modelResponse, participant, run); promises at most one record — forms:
  a record of
    where Publishing._edition (edition: round) has (closedAt, open, openedAt)
    begun: the count of Responding._responsesFor (subject: round) has (response: begun)
    closedAt
    handedIn: the count of Responding._responsesFor (subject: round) has (response: handedIn, submitted: true)
    handedInByModel: the count of Responding._responsesFor (subject: round) has (participant, response: modelResponse, submitted: true)
      where view "the run of (round)" with (round) has (run)
      where view "(participant) holds a seat on (run)" with (participant, run)
    open
    openedAt
    round
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
- Covered by [Grades](../design/compositions/course/grades.md), line 44.

```former
Former "the gradebook ()" — inputs (); bindings (item, label, maxPoints, user, section, displayName, email, cellItem, grade, score, feedback, status, assigned); promises exactly one record — forms:
  a record of
    items: each Itemizing._getItems () has (item, label, maxPoints)
      form a record of
        item
        label
        maxPoints
    learners: each Rostering._getActiveStudents () has (email, section, user)
      where whether Profiling._getProfileFields (user) has (displayName)
      arranged by displayName
      form a record of
        cells: each Itemizing._getItems () has (item: cellItem)
          where Assigning._isAssigned (assignee: user, assignment: cellItem) has (assigned)
          where whether Grading._getGrade (item: cellItem, learner: user) has (feedback, grade, score, status)
          form a record of
            assigned
            feedback
            grade
            item: cellItem
            score
            status
        displayName
        email
        learner: user
        section
```

### the gradebook learners ()

Authored path: `Course.grades.theGradebookLearners`.
- Covered by [Grades](../design/compositions/course/grades.md), line 46.

```former
Former "the gradebook learners ()" — inputs (); bindings (user, seat, section, email, displayName); promises exactly one record — forms:
  each Rostering._getActiveStudents () has (email, seat, section, user)
    where whether Profiling._getProfileFields (user) has (displayName)
    form a record of
      displayName
      email
      seat
      section
      user
```

### the grades of (learner)

Authored path: `Course.grades.theGradesOf`.
- Covered by [Grades](../design/compositions/course/grades.md), line 40.

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
- Covered by [Grades](../design/compositions/course/grades.md), line 42.

```former
Former "the grades on (item)" — inputs (item); bindings (learner, grade, score, feedback, status); promises exactly one record — forms:
  each Grading._getGradesForItem (item) has (feedback, grade, learner, score, status)
    form a record of
      feedback
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

### the invitation details of (invitation) with (credential)

Authored path: `Access.auth.theInvitationDetails`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 23.

```former
Former "the invitation details of (invitation) with (credential)" — inputs (invitation, credential); bindings (address, displayName); promises at most one record — forms:
  a record of
    where Inviting._getAvailable (credential, invitation) has (address, channel: "email")
    where Rostering._getPendingSeatByEmail (email: address) has (displayName)
    displayName
    email: address
```

### the invitations ()

Authored path: `Access.invitations.theInvitations`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 26.

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
- Covered by [Categories](../design/compositions/forum/categories.md), line 15.

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

### the mail messages ()

Authored path: `Access.mail.theMailMessages`.
- Covered by [Mail](../design/compositions/access/mail.md), line 15.

```former
Former "the mail messages ()" — inputs (); bindings (message, key, recipient, subject, createdAt, sentAt, attempts, lastAttemptAt, lastError); promises exactly one record — forms:
  each Mailing._getMessages () has (attempts, createdAt, key, lastAttemptAt, lastError, message, recipient, sentAt, subject)
    form a record of
      attempts
      createdAt
      key
      lastAttemptAt
      lastError
      message
      recipient
      sentAt
      subject
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
- Covered by [Student notes](../design/compositions/course/notes.md), line 16.

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

### the offerings about (relay)

Authored path: `Live.edits.theOfferings`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 11.

```former
Former "the offerings about (relay)" — inputs (relay); bindings (offering, offeredAt, suggestion, kind, target, value, position, standing); promises exactly one record — forms:
  each Suggesting._offeringsAbout (subject: relay) has (offeredAt, offering)
    form a record of
      lines: each Suggesting._suggestions (offering) has (kind, position, standing, suggestion, target, value)
        form a record of
          kind
          position
          standing
          suggestion
          target
          value
      offeredAt
      offering
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

### the open runs

Authored path: `Live.runs.theOpenRuns`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 47.

```former
Former "the open runs" — inputs (); bindings (run, questionnaire, presentation, title, form, openedAt, token, code); promises exactly one record — forms:
  each Publishing._openEditions () has (edition: run, material: questionnaire, openedAt)
    where RunSnapshotting._snapshot (subject: run) has (value: presentation)
    where title is snapshotTitle (value: presentation)
    where form is snapshotForm (value: presentation)
    where whether Sharing._sharesFor (subject: run) has (token)
    where whether Locating._for (subject: run) has (code)
    form a record of
      code
      form
      openedAt
      questionnaire
      run
      title
      token
```

### the pending roster ()

Authored path: `Course.roster.thePendingRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 173.

```former
Former "the pending roster ()" — inputs (); bindings (seat, email, kind, section, displayName); promises exactly one record — forms:
  each Rostering._getUnclaimedSeats () has (displayName, email, kind, seat, section)
    form a record of
      displayName
      email
      kind
      seat
      section
```

### the pick of (pile) on (round)

```former
Former "the pick of (pile) on (round)" — inputs (round, pile); bindings (); promises at most one record — forms:
  a record of
    where Pinning._isPinned (item: pile, scope: round) has (pinned: true)
    picked: pile
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

### the presentation of (leg)

Authored path: `Live.relays.theRoundPresentation`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.

```former
Former "the presentation of (leg)" — inputs (leg); bindings (questionnaire, title, form, disclosure, question, prompt, choices, expected, explanation, parts, cap, position); promises at most one record — forms:
  a record of
    where Relaying._leg (leg) has (material: questionnaire)
    where Questioning._getQuestionnaire (questionnaire) has (disclosure, form, title)
    disclosure
    form
    questions: each Questioning._getQuestions (questionnaire) has (cap, choices, expected, explanation, parts, position, prompt, question)
      form a record of
        cap
        choices
        expected
        explanation
        item: question
        parts
        position
        prompt
    title
```

### the presentation of (leg) showing (sourceRound)

Authored path: `Live.relays.theRoundPresentationShowing`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.

```former
Former "the presentation of (leg) showing (sourceRound)" — inputs (leg, sourceRound); bindings (questionnaire, title, form, disclosure, question, prompt, choices, expected, explanation, parts, cap, position, pile, name, categories, values, cards); promises at most one record — forms:
  a record of
    where Relaying._leg (leg) has (material: questionnaire)
    where Questioning._getQuestionnaire (questionnaire) has (disclosure, form, title)
    disclosure
    form
    questions: each Questioning._getQuestions (questionnaire) has (cap, choices, expected, explanation, parts, position, prompt, question)
      form a record of
        cap
        choices
        context: each Pinning._getPinned (scope: sourceRound) has (item: pile)
          where Categorizing._getCategoryDetail (category: pile) has (name)
          where Categorizing._categoriesWithItems (scope: sourceRound) has (categories)
          where Responding._valuesForSubject (subject: sourceRound) has (values)
          where cards is pileCards (categories, pile, values)
          form a record of
            cards
            name
        expected
        explanation
        item: question
        parts
        position
        prompt
    title
```

### the presentation of (leg) taking from (sourceRound)

Authored path: `Live.relays.theRoundPresentationTaking`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.

```former
Former "the presentation of (leg) taking from (sourceRound)" — inputs (leg, sourceRound); bindings (questionnaire, title, form, disclosure, question, prompt, expected, explanation, parts, cap, position, pile, name); promises at most one record — forms:
  a record of
    where Relaying._leg (leg) has (material: questionnaire)
    where Questioning._getQuestionnaire (questionnaire) has (disclosure, form, title)
    disclosure
    form
    questions: each Questioning._getQuestions (questionnaire) has (expected, explanation, position, prompt, question)
      where parts is oneBoxParts (question)
      where cap is oneBoxCap (question)
      form a record of
        cap
        choices: the distinct name of each Pinning._getPinned (scope: sourceRound) has (item: pile)
          where Categorizing._getCategoryDetail (category: pile) has (name)
        expected
        explanation
        item: question
        parts
        position
        prompt
    title
```

### the presentation of (leg) taking parts from (sourceRound)

Authored path: `Live.relays.theRoundPresentationTakingParts`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.

```former
Former "the presentation of (leg) taking parts from (sourceRound)" — inputs (leg, sourceRound); bindings (questionnaire, title, form, disclosure, question, prompt, expected, explanation, cap, choices, position, pile, name); promises at most one record — forms:
  a record of
    where Relaying._leg (leg) has (material: questionnaire)
    where Questioning._getQuestionnaire (questionnaire) has (disclosure, form, title)
    disclosure
    form
    questions: each Questioning._getQuestions (questionnaire) has (expected, explanation, position, prompt, question)
      where cap is oneBoxCap (question)
      where choices is noChoices (question)
      form a record of
        cap
        choices
        expected
        explanation
        item: question
        parts: the distinct name of each Pinning._getPinned (scope: sourceRound) has (item: pile)
          where Categorizing._getCategoryDetail (category: pile) has (name)
        position
        prompt
    title
```

### the private profile of (user)

```former
Former "the private profile of (user)" — inputs (user); bindings (displayName, bio, avatar, email); promises at most one record — forms:
  a record of
    where Profiling._getProfileFields (user) has (avatar, bio, displayName)
    where Authenticating._getById (user) has (email)
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

### the questionnaire (questionnaire)

Authored path: `Live.quizzes.theQuestionnaire`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 55.

```former
Former "the questionnaire (questionnaire)" — inputs (questionnaire); bindings (title, form, disclosure, createdAt, retired, question, prompt, choices, expected, explanation, position, run, open, openedAt, closedAt, token); promises at most one record — forms:
  a record of
    where Questioning._getQuestionnaire (questionnaire) has (createdAt, disclosure, form, retired, title)
    createdAt
    disclosure
    form
    questionnaire
    questions: each Questioning._getQuestions (questionnaire) has (choices, expected, explanation, position, prompt, question)
      form a record of
        choices
        expected
        explanation
        position
        prompt
        question
    retired
    runs: each Publishing._editionsFor (material: questionnaire) has (closedAt, edition: run, open, openedAt)
      where whether Sharing._sharesFor (subject: run) has (token)
      form a record of
        closedAt
        open
        openedAt
        run
        token
    title
```

### the questionnaires

Authored path: `Live.quizzes.theQuestionnaires`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 50.

```former
Former "the questionnaires" — inputs (); bindings (questionnaire, title, form, disclosure, createdAt, retired, run, token, questions, proposes); promises exactly one record — forms:
  each Questioning._getQuestionnaires () has (createdAt, disclosure, form, questionnaire, retired, title)
    where no Relaying._legFor (material: questionnaire)
    where whether Publishing._editionsFor (material: questionnaire) has (edition: run, open: true)
    where whether Sharing._sharesFor (subject: run) has (token)
    where view "the question count of (questionnaire)" with (questionnaire) has (total: questions)
    where Questioning._proposesAnswers (questionnaire) has (proposes)
    form a record of
      createdAt
      disclosure
      form
      openRun: run
      proposes
      questionnaire
      questions
      retired
      title
      token
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

### the role face of (user) in (context)

Authored path: `Access.roles.theRoleFaceOf`.
- Covered by [Roles](../design/compositions/access/roles.md), line 93.

```former
Former "the role face of (user) in (context)" — inputs (user, context); bindings (role, name, capabilities); promises at most one record — forms:
  a record of
    where Roling._getRole (context, user) has (role)
    where Roling._getRoleDetail (role) has (capabilities, name)
    capabilities
    name
    role
```

### the registered users ()

Authored path: `Access.auth.theRegisteredUsers`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 133.

```former
Former "the registered users ()" — inputs (); bindings (user, username, email, displayName, avatar, archived); promises exactly one record — forms:
  each Authenticating._getUsers () has (email, user, username)
    where whether Profiling._getProfileFields (user) has (avatar, displayName)
    where Archiving._isTrashed (item: user) has (trashed: archived)
    form a record of
      archived
      avatar
      displayName
      email
      role: whether former "the role face of (user) in (context)" with (context: "commons", user)
      user
      username
```

### the relay (relay)

Authored path: `Live.relays.theRelay`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 23.

```former
Former "the relay (relay)" — inputs (relay); bindings (title, createdAt, leg, material, position, roundTitle, question, prompt, choices, parts, cap, source, sourceNumber, shape, run, open, openedAt, closedAt, token, code, retired, ran); promises at most one record — forms:
  a record of
    where Relaying._relay (relay) has (createdAt, title)
    where Trashing._isTrashed (item: relay) has (trashed: retired)
    createdAt
    relay
    retired
    rounds: each Relaying._legs (relay) has (leg, material, position)
      where Questioning._getQuestionnaire (questionnaire: material) has (title: roundTitle)
      where Questioning._getQuestions (questionnaire: material) has (cap, choices, parts, prompt, question)
      form a record of
        cap
        choices
        leg
        number: position
        parts
        prompt
        question
        questionnaire: material
        takes: each Relaying._draws (leg) has (shape, source)
          where Relaying._leg (leg: source) has (position: sourceNumber)
          form a record of
            shape
            source
            sourceNumber
        title: roundTitle
    runs: each Publishing._editionsFor (material: relay) has (closedAt, edition: run, open, openedAt)
      where whether Sharing._sharesFor (subject: run) has (token)
      where whether Locating._for (subject: run) has (code)
      form a record of
        closedAt
        code
        open
        openedAt
        rounds: each Linking._getBacklinks (target: run) has (source: ran)
          form a record of
            figure: whether former "the figure of (round)" with (round: ran)
            round: ran
        run
        token
    title
```

### the relays

Authored path: `Live.relays.theRelays`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 23.

```former
Former "the relays" — inputs (); bindings (relay, title, createdAt, leg, material, position, roundTitle, run, code, openRound, round, open, runs, past, retired); promises exactly one record — forms:
  each Relaying._relays () has (createdAt, relay, title)
    where Trashing._isTrashed (item: relay) has (trashed: retired)
    where whether Publishing._editionsFor (material: relay) has (edition: run, open: true)
    where whether Locating._for (subject: run) has (code)
    where whether view "the open round of (run)" with (run) has (round: openRound)
    form a record of
      closedRuns: the count of Publishing._editionsFor (material: relay) has (edition: past, open: false)
      code
      createdAt
      figure: whether former "the figure of (round)" with (round: openRound)
      openRound
      relay
      retired
      rounds: each Relaying._legs (relay) has (leg, material, position)
        where Questioning._getQuestionnaire (questionnaire: material) has (title: roundTitle)
        where whether view "the round of (leg) in (run)" with (leg, run) has (open, round)
        form a record of
          leg
          number: position
          open
          round
          title: roundTitle
      run
      runs: the count of Publishing._editionsFor (material: relay) has (edition: runs)
      title
```

### the released grades of (learner)

Authored path: `Course.grades.theReleasedGradesOf`.
- Covered by [Grades](../design/compositions/course/grades.md), line 37.

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

### the roster ()

Authored path: `Course.roster.theRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 171.

```former
Former "the roster ()" — inputs (); bindings (user, seat, kind, section, email, displayName); promises exactly one record — forms:
  each Rostering._getActiveMembers () has (email, kind, seat, section, user)
    where whether Profiling._getProfileFields (user) has (displayName)
    form a record of
      displayName
      email
      kind
      seat
      section
      user
```

### the run (run)

Authored path: `Live.relays.theRelayRun`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 33.

```former
Former "the run (run)" — inputs (run); bindings (relay, title, open, openedAt, closedAt, token, code, openRound, leg, material, position, roundTitle, round, takenFrom, seat); promises at most one record — forms:
  a record of
    where Publishing._edition (edition: run) has (closedAt, material: relay, open, openedAt)
    where Relaying._relay (relay) has (title)
    where whether Locating._for (subject: run) has (code)
    where whether view "the open round of (run)" with (run) has (round: openRound)
    closedAt
    code
    open
    openRound
    openedAt
    relay
    rounds: each Relaying._legs (relay) has (leg, material, position)
      where Questioning._getQuestionnaire (questionnaire: material) has (title: roundTitle)
      where whether view "the round of (leg) in (run)" with (leg, run) has (round)
      form a record of
        figure: whether former "the figure of (round)" with (round)
        leg
        number: position
        round
        takes: the count of Relaying._draws (leg) has (source: takenFrom)
        title: roundTitle
    run
    seats: each Subscribing._getSubscribers (target: run) has (user: seat)
      where view "(participant)'s seat is not dismissed" with (participant: seat)
      form a record of
        participant: seat
    title
    token: the token of the first Sharing._sharesFor (subject: run) has (token)
```

### the score outcome of (response)

Authored path: `Live.participation.theScoreOutcome`.
- Covered by [Participation](../design/compositions/live/participation.md), line 67.

```former
Former "the score outcome of (response)" — inputs (response); bindings (run, key, disclosure, score, outOf); promises at most one record — forms:
  a record of
    where Responding._response (response) has (subject: run, submitted: true)
    where Scoring._keyFor (subject: run) has (disclosure, key)
    where whether Scoring._resultFor (key, submission: response) has (outOf, score)
    disclosure
    outOf
    response
    score
```

### the scores of (run)

Authored path: `Live.runs.theRunScores`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 57.

```former
Former "the scores of (run)" — inputs (run); bindings (key, disclosure, submission, participant, name, score, outOf); promises at most one record — forms:
  a record of
    where Scoring._keyFor (subject: run) has (disclosure, key)
    disclosure
    results: each Scoring._results (key) has (outOf, score, submission)
      where Responding._response (response: submission) has (participant)
      where whether Profiling._getProfileFields (user: participant) has (displayName: name)
      form a record of
        name
        outOf
        participant
        score
        submission
    run
```

### the sections ()

Authored path: `Course.roster.theSections`.
- Covered by [Roster](../design/compositions/course/roster.md), line 12.

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
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 10.

```former
Former "the staff dashboard ()" — inputs (); bindings (user, seat, kind, section, email, displayName); promises exactly one record — forms:
  each Rostering._getActiveMembers () has (email, kind, seat, section, user)
    where whether Profiling._getProfileFields (user) has (displayName)
    form a record of
      displayName
      email
      kind
      seat
      section
      user
```

### the staff dashboard counts ()

Authored path: `Course.calendar.theStaffDashboardCounts`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 11.

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
Former "the submissions for (assignment)" — inputs (assignment); bindings (submitter, submitterName, submission, artifacts, submittedAt, number, status); promises exactly one record — forms:
  each Submitting._getSubmissionsForAssignment (assignment) has (artifacts, number, status, submission, submittedAt, submitter)
    where whether Profiling._getProfileFields (user: submitter) has (displayName: submitterName)
    form a record of
      artifacts
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
- Covered by [Tags](../design/compositions/forum/tags.md), line 12.

```former
Former "the tags ()" — inputs (); bindings (tag, name); promises exactly one record — forms:
  each Tagging._getAllTags () has (name, tag)
    form a record of
      name
      tag
```

### the tags on (target)

Authored path: `Forum.tags.theTagsOn`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 14.

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
- Covered by [Tags](../design/compositions/forum/tags.md), line 16.

```former
Former "the targets tagged (tag)" — inputs (tag); bindings (target); promises exactly one record — forms:
  each Tagging._getTargets (tag) has (target)
    where view "(post) is readable" with (post: target)
    form a record of
      target
```

### the targets tagged with (name)

Authored path: `Forum.tags.theTargetsTaggedWithName`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 18.

```former
Former "the targets tagged with (name)" — inputs (name); bindings (tag, target); promises exactly one record — forms:
  each Tagging._getByName (name) has (tag)
    where Tagging._getTargets (tag) has (target)
    where view "(post) is readable" with (post: target)
    form a record of
      target
```

### the task notification presentation of (subject) of kind (kind) for (reader) at (at)

Authored path: `Tasks.notifications.theTaskNotificationPresentationOf`.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 105.

```former
Former "the task notification presentation of (subject) of kind (kind) for (reader) at (at)" — inputs (subject, kind, reader, at); bindings (listTitle, list, title, details, startsAt, endsAt, state, assignee); promises exactly one record — forms:
  a record of
    where whether view "the list title behind (subject) of kind (kind) for (reader) at (at)" with (at, kind, reader, subject) has (title: listTitle)
    where whether view "the task behind (subject) for (reader) at (at)" with (at, reader, subject) has (assignee, details, endsAt, list, startsAt, state, title)
    list
    listTitle
    task: a record of
      assignee
      details
      endsAt
      startsAt
      state
      title
```

### the task inbox of (user) at (at)

Authored path: `Tasks.notifications.theTaskInboxOf`.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 103.

```former
Former "the task inbox of (user) at (at)" — inputs (user, at); bindings (notification, kind, subject, link, createdAt, read); promises exactly one record — forms:
  each TaskNotifying._getInbox (recipient: user) has (createdAt, kind, link, notification, read, subject)
    form a record of
      createdAt
      kind
      link
      notification
      read
      subject
      … former "the task notification presentation of (subject) of kind (kind) for (reader) at (at)" with (at, kind, reader: user, subject), with blank leaves if absent
```

### the task list (list) at (at)

Authored path: `Tasks.lists.theTaskList`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 43.

```former
Former "the task list (list) at (at)" — inputs (list, at); bindings (title, member, memberName, openTask); promises at most one record — forms:
  a record of
    where Grouping._getGroup (group: list) has (title)
    list
    members: each Grouping._getMembers (group: list) has (member)
      where Profiling._getProfileFields (user: member) has (displayName: memberName)
      form a record of
        displayName: memberName
        user: member
    openTasks: the count of Tasking._getTasksInScope (at, scope: list) has (state: "OPEN", task: openTask)
    title
```

### the task lists of (user) at (at)

Authored path: `Tasks.lists.theTaskListsOf`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 41.

```former
Former "the task lists of (user) at (at)" — inputs (user, at); bindings (list, title, member, memberName, openTask); promises exactly one record — forms:
  each Grouping._getGroupsOf (member: user) has (group: list, title)
    form a record of
      list
      members: each Grouping._getMembers (group: list) has (member)
        where Profiling._getProfileFields (user: member) has (displayName: memberName)
        form a record of
          displayName: memberName
          user: member
      openTasks: the count of Tasking._getTasksInScope (at, scope: list) has (state: "OPEN", task: openTask)
      title
```

### the tasks assigned to (user) at (at)

Authored path: `Tasks.tasks.theTasksAssignedTo`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 89.

```former
Former "the tasks assigned to (user) at (at)" — inputs (user, at); bindings (task, title, details, startsAt, endsAt, state, overdue, createdAt, updatedAt, list, listTitle); promises exactly one record — forms:
  each Tasking._getAssigned (assignee: user, at) has (createdAt, details, endsAt, overdue, scope: list, startsAt, state, task, title, updatedAt)
    where Grouping._getGroup (group: list) has (title: listTitle)
    where Grouping._isMember (group: list, member: user) has (isMember: true)
    arranged by endsAt
    form a record of
      createdAt
      details
      endsAt
      list
      listTitle
      overdue
      startsAt
      state
      task
      title
      updatedAt
```

### the tasks in (list) at (at)

Authored path: `Tasks.tasks.theTasksIn`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 87.

```former
Former "the tasks in (list) at (at)" — inputs (list, at); bindings (task, title, details, startsAt, endsAt, assignee, state, overdue, createdAt, updatedAt); promises exactly one record — forms:
  each Tasking._getTasksInScope (at, scope: list) has (assignee, createdAt, details, endsAt, overdue, startsAt, state, task, title, updatedAt)
    arranged by endsAt
    form a record of
      assignee
      createdAt
      details
      endsAt
      overdue
      startsAt
      state
      task
      title
      updatedAt
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
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 37.

```former
Former "the user page of (user)" — inputs (user); bindings (post, node, conversation); promises exactly one record — forms:
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
    role: whether former "the role face of (user) in (context)" with (context: "commons", user)
```

### the user search (query)

Authored path: `Forum.profiles.theUserSearch`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 31.

```former
Former "the user search (query)" — inputs (query); bindings (user, username); promises exactly one record — forms:
  each Authenticating._search (query) has (user, username)
    form a record of
      profile: former "the profile face of (user)" with (user)
      user
      username
```

### the wall of (round) as (viewer) sees it

Authored path: `Live.walls.theWall`.
- Covered by [The wall](../design/compositions/live/walls.md), line 5.

```former
Former "the wall of (round) as (viewer) sees it" — inputs (round, viewer); bindings (questionnaire, presentation, open, openedAt, closedAt, title, leg, number, questions, begun, handedIn, response, participant, item, value, card, pile, run, model, mine, part, category, name, description, held); promises at most one record — forms:
  a record of
    where Publishing._edition (edition: round) has (closedAt, material: questionnaire, open, openedAt)
    where RunSnapshotting._snapshot (subject: round) has (value: presentation)
    where Questioning._getQuestionnaire (questionnaire) has (title)
    where questions is participantQuestions (value: presentation)
    where whether Relaying._legFor (material: questionnaire) has (leg, position: number)
    begun: the count of Responding._responsesFor (subject: round) has (response: begun)
    cards: each Responding._submittedAnswers (subject: round) has (item, participant, response, value)
      where card is cardId (item, response)
      where view "the run of (round)" with (round) has (run)
      where Subscribing._isSubscribed (target: run, user: participant) has (subscribed: model)
      where mine is isSame (left: response, right: viewer)
      where part is partLabel (item, value: presentation)
      where whether Categorizing._getCategory (item: card) has (category: pile)
      form a record of
        card
        mine
        model
        part
        pile
        value
    closedAt
    handedIn: the count of Responding._responsesFor (subject: round) has (response: handedIn, submitted: true)
    number
    open
    openedAt
    piles: each Categorizing._categoriesIn (scope: round) has (category, description, name)
      form a record of
        count: the count of Categorizing._getItems (category) has (item: held)
        description
        name
        pile: category
        … former "the pick of (pile) on (round)" with (pile: category, round), with blank leaves if absent
    questions
    round
    title
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
- Covered by [Authentication](../design/compositions/access/auth.md), line 136.

```reaction
when RequestBoundary.request (displayName, invitation, password, path: "/auth/accept-invitation", requestId, temporaryPassword, username)
then
  Inviting.verify (channel: "email", credential: temporaryPassword, invitation)
```

### Access.auth.AcceptInvitation#2

Authored path: `Access.auth.AcceptInvitation`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 7.
- Covered by [Authentication](../design/compositions/access/auth.md), line 136.

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
- Covered by [Authentication](../design/compositions/access/auth.md), line 136.

```reaction
when Authenticating.register (email, password, username, user), asked by Access.auth.AcceptInvitation#2
where
  earlier, RequestBoundary.request (displayName, invitation, password, path: "/auth/accept-invitation", requestId, temporaryPassword, username)
then
  Profiling.createProfile (displayName, user)
```

### Access.auth.AcceptInvitation#4

Authored path: `Access.auth.AcceptInvitation`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 7.
- Covered by [Authentication](../design/compositions/access/auth.md), line 136.

```reaction
when Profiling.createProfile (displayName, user), asked by Access.auth.AcceptInvitation#3
where
  earlier, Inviting.verify (channel: "email", credential: temporaryPassword, invitation, address: email), asked by Access.auth.AcceptInvitation
then
  Inviting.claim (credential: temporaryPassword, invitation, user)
```

### Access.auth.AcceptInvitation#5

Authored path: `Access.auth.AcceptInvitation`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 7.
- Covered by [Authentication](../design/compositions/access/auth.md), line 136.

```reaction
when Inviting.claim (credential: temporaryPassword, invitation, user), asked by Access.auth.AcceptInvitation#4
where
  earlier, RequestBoundary.request (displayName, invitation, password, path: "/auth/accept-invitation", requestId, temporaryPassword, username)
then
  RequestBoundary.respond (requestId, user)
```

### Access.auth.ArchiveUser:forbidden

Authored path: `Access.auth.ArchiveUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 96.
- Covered by [Authentication](../design/compositions/access/auth.md), line 137.

```reaction
when RequestBoundary.request (path: "/users/archive", requestId, session, user)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.auth.ArchiveUser:last-administrator

Authored path: `Access.auth.ArchiveUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 96.
- Covered by [Authentication](../design/compositions/access/auth.md), line 137.

```reaction
when RequestBoundary.request (path: "/users/archive", requestId, session, user)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  view "the active user of (session)" with (session) and not (user)
  view "(user) is the only administrator" with (user)
then
  RequestBoundary.respond (error: "LAST_ADMINISTRATOR", requestId)
```

### Access.auth.ArchiveUser:self

Authored path: `Access.auth.ArchiveUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 96.
- Covered by [Authentication](../design/compositions/access/auth.md), line 137.

```reaction
when RequestBoundary.request (path: "/users/archive", requestId, session, user)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.auth.ArchiveUser:success

Authored path: `Access.auth.ArchiveUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 96.
- Covered by [Authentication](../design/compositions/access/auth.md), line 137.

```reaction
when RequestBoundary.request (path: "/users/archive", requestId, session, user)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  view "the active user of (session)" with (session) and not (user)
  view "(user) is not the only administrator" with (user)
  view "(user) holds a role in (context)" with (context: "commons", user)
then
  Roling.requireCapability (capability: "administer", context: "commons", user: actor)
```

### Access.auth.ArchiveUser:success#2

Authored path: `Access.auth.ArchiveUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 96.
- Covered by [Authentication](../design/compositions/access/auth.md), line 137.

```reaction
when Roling.requireCapability (capability: "administer", context: "commons", user: actor), asked by Access.auth.ArchiveUser:success
where
  earlier, RequestBoundary.request (path: "/users/archive", requestId, session, user)
then
  Roling.revoke (context: "commons", user)
```

### Access.auth.ArchiveUser:success#3

Authored path: `Access.auth.ArchiveUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 96.
- Covered by [Authentication](../design/compositions/access/auth.md), line 137.

```reaction
when Roling.revoke (context: "commons", user), asked by Access.auth.ArchiveUser:success#2
where
  earlier, Roling.requireCapability (capability: "administer", context: "commons", user: actor), asked by Access.auth.ArchiveUser:success
  at is the current flow's instant
then
  Archiving.trash (at, by: actor, item: user)
```

### Access.auth.ArchiveUser:success#4

Authored path: `Access.auth.ArchiveUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 96.
- Covered by [Authentication](../design/compositions/access/auth.md), line 137.

```reaction
when Archiving.trash (at, by: actor, item: user), asked by Access.auth.ArchiveUser:success#3
then
  Sessioning.endAllForUser (user)
```

### Access.auth.ArchiveUser:success#5

Authored path: `Access.auth.ArchiveUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 96.
- Covered by [Authentication](../design/compositions/access/auth.md), line 137.

```reaction
when Sessioning.endAllForUser (user), asked by Access.auth.ArchiveUser:success#4
where
  earlier, RequestBoundary.request (path: "/users/archive", requestId, session, user)
then
  RequestBoundary.respond (requestId, user)
```

### Access.auth.ArchiveUser:success-without-role

Authored path: `Access.auth.ArchiveUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 96.
- Covered by [Authentication](../design/compositions/access/auth.md), line 137.

```reaction
when RequestBoundary.request (path: "/users/archive", requestId, session, user)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  view "the active user of (session)" with (session) and not (user)
  view "(user) is not the only administrator" with (user)
  view "(user) holds no role in (context)" with (context: "commons", user)
then
  Archiving.trash (at, by: actor, item: user)
```

### Access.auth.ArchiveUser:success-without-role#2

Authored path: `Access.auth.ArchiveUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 96.
- Covered by [Authentication](../design/compositions/access/auth.md), line 137.

```reaction
when Archiving.trash (at, by: actor, item: user), asked by Access.auth.ArchiveUser:success-without-role
then
  Sessioning.endAllForUser (user)
```

### Access.auth.ArchiveUser:success-without-role#3

Authored path: `Access.auth.ArchiveUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 96.
- Covered by [Authentication](../design/compositions/access/auth.md), line 137.

```reaction
when Sessioning.endAllForUser (user), asked by Access.auth.ArchiveUser:success-without-role#2
where
  earlier, RequestBoundary.request (path: "/users/archive", requestId, session, user)
then
  RequestBoundary.respond (requestId, user)
```

### Access.auth.BootstrapAdminOnLogin

Authored path: `Access.auth.BootstrapAdminOnLogin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 67.

```reaction
when Authenticating.authenticate (user)
where
  Authenticating._getUserCount () has (count: 1)
  Roling._hasCapabilityHolder (capability: "administer", context: "commons") has (present: false)
then
  Roling.ensureRole (capabilities: ["administer"], name: "administrator")
```

### Access.auth.BootstrapAdminOnLogin#2

Authored path: `Access.auth.BootstrapAdminOnLogin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 67.

```reaction
when Roling.ensureRole (capabilities: ["administer"], name: "administrator", role), asked by Access.auth.BootstrapAdminOnLogin
where
  earlier, Authenticating.authenticate (user)
then
  Roling.assign (context: "commons", role, user)
```

### Access.auth.BootstrapAdminOnRegister

Authored path: `Access.auth.BootstrapAdminOnRegister`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 65.

```reaction
when Authenticating.register (user)
where
  Authenticating._getUserCount () has (count: 1)
  Roling._hasCapabilityHolder (capability: "administer", context: "commons") has (present: false)
then
  Roling.ensureRole (capabilities: ["administer"], name: "administrator")
```

### Access.auth.BootstrapAdminOnRegister#2

Authored path: `Access.auth.BootstrapAdminOnRegister`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 65.

```reaction
when Roling.ensureRole (capabilities: ["administer"], name: "administrator", role), asked by Access.auth.BootstrapAdminOnRegister
where
  earlier, Authenticating.register (user)
then
  Roling.assign (context: "commons", role, user)
```

### Access.auth.ChangePassword

Authored path: `Access.auth.ChangePassword`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 59.
- Covered by [Authentication](../design/compositions/access/auth.md), line 138.

```reaction
when RequestBoundary.request (newPassword, oldPassword, path: "/auth/changePassword", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Authenticating.changePassword (newPassword, oldPassword, user)
```

### Access.auth.ChangePassword#2

Authored path: `Access.auth.ChangePassword`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 59.
- Covered by [Authentication](../design/compositions/access/auth.md), line 138.

```reaction
when Authenticating.changePassword (newPassword, oldPassword, user), asked by Access.auth.ChangePassword
then
  Sessioning.endAllForUser (user)
```

### Access.auth.ChangePassword#3

Authored path: `Access.auth.ChangePassword`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 59.
- Covered by [Authentication](../design/compositions/access/auth.md), line 138.

```reaction
when Sessioning.endAllForUser (user), asked by Access.auth.ChangePassword#2
where
  earlier, RequestBoundary.request (newPassword, oldPassword, path: "/auth/changePassword", requestId, session)
then
  RequestBoundary.respond (requestId, user)
```

### Access.auth.InvitationDetails:invalid

Authored path: `Access.auth.InvitationDetails`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 21.
- Covered by [Authentication](../design/compositions/access/auth.md), line 139.

```reaction
when RequestBoundary.request (invitation, path: "/auth/invitation", requestId, temporaryPassword)
where
  no Inviting._getAvailable (credential: temporaryPassword, invitation)
then
  RequestBoundary.respond (error: "INVITATION_INVALID", requestId)
```

### Access.auth.InvitationDetails:seated

Authored path: `Access.auth.InvitationDetails`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 21.
- Covered by [Authentication](../design/compositions/access/auth.md), line 139.

```reaction
when RequestBoundary.request (invitation, path: "/auth/invitation", requestId, temporaryPassword)
where
  Inviting._getAvailable (credential: temporaryPassword, invitation) has (address: email)
  Rostering._getPendingSeatByEmail (email)
then
  RequestBoundary.respond (invitation: former "the invitation details of (invitation) with (credential)" with (credential: temporaryPassword, invitation), requestId)
```

### Access.auth.InvitationDetails:unseated

Authored path: `Access.auth.InvitationDetails`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 21.
- Covered by [Authentication](../design/compositions/access/auth.md), line 139.

```reaction
when RequestBoundary.request (invitation, path: "/auth/invitation", requestId, temporaryPassword)
where
  Inviting._getAvailable (credential: temporaryPassword, invitation) has (address: email)
  no Rostering._getPendingSeatByEmail (email)
then
  RequestBoundary.respond (invitation: (displayName: "", email), requestId)
```

### Access.auth.ListUsers:forbidden

Authored path: `Access.auth.ListUsers`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 131.
- Covered by [Authentication](../design/compositions/access/auth.md), line 140.

```reaction
when RequestBoundary.request (path: "/users/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.auth.ListUsers:success

Authored path: `Access.auth.ListUsers`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 131.
- Covered by [Authentication](../design/compositions/access/auth.md), line 140.

```reaction
when RequestBoundary.request (path: "/users/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
then
  RequestBoundary.respond (requestId, users: former "the registered users ()")
```

### Access.auth.Login:archived

Authored path: `Access.auth.Login`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 45.
- Covered by [Authentication](../design/compositions/access/auth.md), line 141.

```reaction
when RequestBoundary.request (password, path: "/auth/login", requestId, username)
where
  view "the archived user named (username)" with (username)
then
  Authenticating.authenticate (password, username)
```

### Access.auth.Login:archived#2

Authored path: `Access.auth.Login`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 45.
- Covered by [Authentication](../design/compositions/access/auth.md), line 141.

```reaction
when Authenticating.authenticate (password, username), asked by Access.auth.Login:archived
where
  earlier, RequestBoundary.request (password, path: "/auth/login", requestId, username)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.auth.Login:success

Authored path: `Access.auth.Login`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 45.
- Covered by [Authentication](../design/compositions/access/auth.md), line 141.

```reaction
when RequestBoundary.request (password, path: "/auth/login", requestId, username)
where
  at is the current flow's instant
  no view "the archived user named (username)" with (username)
then
  Authenticating.authenticate (password, username)
```

### Access.auth.Login:success#2

Authored path: `Access.auth.Login`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 45.
- Covered by [Authentication](../design/compositions/access/auth.md), line 141.

```reaction
when Authenticating.authenticate (password, username, user), asked by Access.auth.Login:success
where
  at is the current flow's instant
then
  Sessioning.start (at, user)
```

### Access.auth.Login:success#3

Authored path: `Access.auth.Login`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 45.
- Covered by [Authentication](../design/compositions/access/auth.md), line 141.

```reaction
when Sessioning.start (at, user, expiresAt, session), asked by Access.auth.Login:success#2
where
  earlier, RequestBoundary.request (password, path: "/auth/login", requestId, username)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### Access.auth.Logout

Authored path: `Access.auth.Logout`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 50.
- Covered by [Authentication](../design/compositions/access/auth.md), line 143.

```reaction
when RequestBoundary.request (path: "/auth/logout", requestId, session)
where
  view "the active user of (session)" with (session)
then
  Sessioning.end (session)
```

### Access.auth.Logout#2

Authored path: `Access.auth.Logout`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 50.
- Covered by [Authentication](../design/compositions/access/auth.md), line 143.

```reaction
when Sessioning.end (session), asked by Access.auth.Logout
where
  earlier, RequestBoundary.request (path: "/auth/logout", requestId, session)
then
  RequestBoundary.respond (ok: true, requestId)
```

### Access.auth.Me

Authored path: `Access.auth.Me`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 51.
- Covered by [Authentication](../design/compositions/access/auth.md), line 144.

```reaction
when RequestBoundary.request (path: "/auth/me", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  Authenticating._getById (user) has (email, username)
  Profiling._getProfile (user) has (profile)
then
  RequestBoundary.respond (email, profile, requestId, user, username)
```

### Access.auth.Permissions:assigned

Authored path: `Access.auth.Permissions`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 84.
- Covered by [Authentication](../design/compositions/access/auth.md), line 142.

```reaction
when RequestBoundary.request (path: "/auth/permissions", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "the role of (user) in (context)" with (context: "commons", user) has (capabilities)
  effective is effectiveCapabilities (capabilities)
then
  RequestBoundary.respond (capabilities: effective, requestId)
```

### Access.auth.Permissions:none

Authored path: `Access.auth.Permissions`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 84.
- Covered by [Authentication](../design/compositions/access/auth.md), line 142.

```reaction
when RequestBoundary.request (path: "/auth/permissions", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  no view "the role of (user) in (context)" with (context: "commons", user)
then
  RequestBoundary.respond (capabilities: [], requestId)
```

### Access.auth.RegisterInitialAdmin:initialized

Authored path: `Access.auth.RegisterInitialAdmin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 72.
- Covered by [Authentication](../design/compositions/access/auth.md), line 145.

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
- Covered by [Authentication](../design/compositions/access/auth.md), line 72.
- Covered by [Authentication](../design/compositions/access/auth.md), line 145.

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
- Covered by [Authentication](../design/compositions/access/auth.md), line 72.
- Covered by [Authentication](../design/compositions/access/auth.md), line 145.

```reaction
when Authenticating.register (email, password, username, user), asked by Access.auth.RegisterInitialAdmin:success
where
  earlier, RequestBoundary.request (displayName, email, password, path: "/setup/register-admin", requestId, setupSecret, username)
then
  Profiling.createProfile (displayName, user)
```

### Access.auth.RegisterInitialAdmin:success#3

Authored path: `Access.auth.RegisterInitialAdmin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 72.
- Covered by [Authentication](../design/compositions/access/auth.md), line 145.

```reaction
when Profiling.createProfile (displayName, user), asked by Access.auth.RegisterInitialAdmin:success#2
where
  earlier, RequestBoundary.request (displayName, email, password, path: "/setup/register-admin", requestId, setupSecret, username)
then
  RequestBoundary.respond (requestId, user)
```

### Access.auth.RegisterInitialAdmin:unauthorized

Authored path: `Access.auth.RegisterInitialAdmin`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 72.
- Covered by [Authentication](../design/compositions/access/auth.md), line 145.

```reaction
when RequestBoundary.request (displayName, email, password, path: "/setup/register-admin", requestId, setupSecret, username)
where
  valid is setupSecretMatches (secret: setupSecret)
  valid is among [false]
then
  RequestBoundary.respond (error: "UNAUTHORIZED", requestId)
```

### Access.auth.Resolve:absent

Authored path: `Access.auth.Resolve`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 56.
- Covered by [Authentication](../design/compositions/access/auth.md), line 146.

```reaction
when RequestBoundary.request (path: "/auth/resolve", requestId, username)
where
  no view "the user named (username)" with (username)
then
  RequestBoundary.respond (requestId, user: null)
```

### Access.auth.Resolve:found

Authored path: `Access.auth.Resolve`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 56.
- Covered by [Authentication](../design/compositions/access/auth.md), line 146.

```reaction
when RequestBoundary.request (path: "/auth/resolve", requestId, username)
where
  view "the user named (username)" with (username) has (user)
then
  RequestBoundary.respond (requestId, user)
```

### Access.auth.RestoreUser:forbidden

Authored path: `Access.auth.RestoreUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 116.
- Covered by [Authentication](../design/compositions/access/auth.md), line 147.

```reaction
when RequestBoundary.request (path: "/users/restore", requestId, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.auth.RestoreUser:success

Authored path: `Access.auth.RestoreUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 116.
- Covered by [Authentication](../design/compositions/access/auth.md), line 147.

```reaction
when RequestBoundary.request (path: "/users/restore", requestId, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
then
  Archiving.restore (item: user)
```

### Access.auth.RestoreUser:success#2

Authored path: `Access.auth.RestoreUser`.
- Covered by [Authentication](../design/compositions/access/auth.md), line 116.
- Covered by [Authentication](../design/compositions/access/auth.md), line 147.

```reaction
when Archiving.restore (item: user), asked by Access.auth.RestoreUser:success
where
  earlier, RequestBoundary.request (path: "/users/restore", requestId, session, user)
then
  RequestBoundary.respond (requestId, user)
```

### Access.invitations.EmailInvitationQueuesMail

Authored path: `Access.invitations.EmailInvitationQueuesMail`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 19.

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
- Covered by [Invitations](../design/compositions/access/invitations.md), line 38.

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
- Covered by [Invitations](../design/compositions/access/invitations.md), line 38.

```reaction
when RequestBoundary.request (email, path: "/invitations/invite", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
then
  Mailing.normalizeRecipient (recipient: email)
```

### Access.invitations.Invite:success#2

Authored path: `Access.invitations.Invite`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 4.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 38.

```reaction
when Mailing.normalizeRecipient (recipient: email, result.recipient), asked by Access.invitations.Invite:success
where
  at is the current flow's instant
then
  Inviting.invite (address: recipient, at, channel: "email")
```

### Access.invitations.Invite:success#3

Authored path: `Access.invitations.Invite`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 4.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 38.

```reaction
when Inviting.invite (address: recipient, at, channel: "email", created, invitation), asked by Access.invitations.Invite:success#2
where
  earlier, RequestBoundary.request (email, path: "/invitations/invite", requestId, session)
then
  RequestBoundary.respond (created, email: recipient, invitation, requestId)
```

### Access.invitations.List:forbidden

Authored path: `Access.invitations.List`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 25.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 39.

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
- Covered by [Invitations](../design/compositions/access/invitations.md), line 25.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 39.

```reaction
when RequestBoundary.request (path: "/invitations/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
then
  RequestBoundary.respond (invitations: former "the invitations ()", requestId)
```

### Access.invitations.Retract:forbidden

Authored path: `Access.invitations.Retract`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 31.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 40.

```reaction
when RequestBoundary.request (invitation, path: "/invitations/retract", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.invitations.Retract:success

Authored path: `Access.invitations.Retract`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 31.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 40.

```reaction
when RequestBoundary.request (invitation, path: "/invitations/retract", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
then
  Inviting.retract (invitation)
```

### Access.invitations.Retract:success#2

Authored path: `Access.invitations.Retract`.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 31.
- Covered by [Invitations](../design/compositions/access/invitations.md), line 40.

```reaction
when Inviting.retract (invitation), asked by Access.invitations.Retract:success
where
  earlier, RequestBoundary.request (invitation, path: "/invitations/retract", requestId, session)
then
  RequestBoundary.respond (invitation, requestId)
```

### Access.mail.List:forbidden

Authored path: `Access.mail.List`.
- Covered by [Mail](../design/compositions/access/mail.md), line 13.
- Covered by [Mail](../design/compositions/access/mail.md), line 22.

```reaction
when RequestBoundary.request (path: "/mail/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.mail.List:success

Authored path: `Access.mail.List`.
- Covered by [Mail](../design/compositions/access/mail.md), line 13.
- Covered by [Mail](../design/compositions/access/mail.md), line 22.

```reaction
when RequestBoundary.request (path: "/mail/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
then
  RequestBoundary.respond (messages: former "the mail messages ()", requestId)
```

### Access.recovery.PasswordResetQueuesMail

Authored path: `Access.recovery.PasswordResetQueuesMail`.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 17.

```reaction
when PasswordResetVouching.issue (at, credential, subject: user, voucher)
where
  Authenticating._getById (user) has (email, username)
  text is passwordResetMailText (credential, username, voucher)
  html is passwordResetMailHtml (credential, username, voucher)
then
  Mailing.enqueue (at, html, key: voucher, recipient: email, subject: "Reset your Commons password", text)
```

### Access.recovery.RequestPasswordReset:accepted

Authored path: `Access.recovery.RequestPasswordReset`.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 4.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 41.

```reaction
when RequestBoundary.request (email, path: "/auth/request-password-reset", requestId)
where
  at is the current flow's instant
then
  Mailing.normalizeRecipient (recipient: email)
```

### Access.recovery.RequestPasswordReset:accepted#2

Authored path: `Access.recovery.RequestPasswordReset`.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 4.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 41.

```reaction
when Mailing.normalizeRecipient (recipient: email, result.recipient), asked by Access.recovery.RequestPasswordReset:accepted
where
  earlier, RequestBoundary.request (email, path: "/auth/request-password-reset", requestId)
then
  RequestBoundary.respond (ok: true, requestId)
```

### Access.recovery.RequestPasswordReset:issued

Authored path: `Access.recovery.RequestPasswordReset`.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 4.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 41.

```reaction
when RequestBoundary.request (email, path: "/auth/request-password-reset", requestId)
where
  at is the current flow's instant
  Authenticating._getByEmail (email) has (user)
  quietSince is passwordResetCooldownStart (at)
  no PasswordResetVouching._getIssuedSince (since: quietSince, subject: user)
  expiresAt is passwordResetExpiry (at)
then
  PasswordResetVouching.issue (at, expiresAt, subject: user)
```

### Access.recovery.ResetPassword

Authored path: `Access.recovery.ResetPassword`.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 27.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 42.

```reaction
when RequestBoundary.request (credential, newPassword, path: "/auth/reset-password", requestId, voucher)
where
  at is the current flow's instant
then
  PasswordResetVouching.verify (at, credential, voucher)
```

### Access.recovery.ResetPassword#2

Authored path: `Access.recovery.ResetPassword`.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 27.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 42.

```reaction
when PasswordResetVouching.verify (at, credential, voucher, subject: user), asked by Access.recovery.ResetPassword
where
  earlier, RequestBoundary.request (credential, newPassword, path: "/auth/reset-password", requestId, voucher)
then
  Authenticating.resetPassword (newPassword, user)
```

### Access.recovery.ResetPassword#3

Authored path: `Access.recovery.ResetPassword`.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 27.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 42.

```reaction
when Authenticating.resetPassword (newPassword, user), asked by Access.recovery.ResetPassword#2
where
  earlier, PasswordResetVouching.verify (at, credential, voucher, subject: user), asked by Access.recovery.ResetPassword
then
  PasswordResetVouching.redeem (at, credential, voucher)
```

### Access.recovery.ResetPassword#4

Authored path: `Access.recovery.ResetPassword`.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 27.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 42.

```reaction
when PasswordResetVouching.redeem (at, credential, voucher), asked by Access.recovery.ResetPassword#3
where
  earlier, PasswordResetVouching.verify (at, credential, voucher, subject: user), asked by Access.recovery.ResetPassword
then
  Sessioning.endAllForUser (user)
```

### Access.recovery.ResetPassword#5

Authored path: `Access.recovery.ResetPassword`.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 27.
- Covered by [Recovery](../design/compositions/access/recovery.md), line 42.

```reaction
when Sessioning.endAllForUser (user), asked by Access.recovery.ResetPassword#4
where
  earlier, RequestBoundary.request (credential, newPassword, path: "/auth/reset-password", requestId, voucher)
then
  RequestBoundary.respond (ok: true, requestId)
```

### Access.roles.AssignRole:forbidden

Authored path: `Access.roles.AssignRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 30.
- Covered by [Roles](../design/compositions/access/roles.md), line 107.

```reaction
when RequestBoundary.request (context, path: "/roles/assign", requestId, role, session, user)
where
  byAddress is subjectIsAddress (subject: user)
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.roles.AssignRole:last-administrator

Authored path: `Access.roles.AssignRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 30.
- Covered by [Roles](../design/compositions/access/roles.md), line 107.

```reaction
when RequestBoundary.request (context, path: "/roles/assign", requestId, role, session, user)
where
  byAddress is subjectIsAddress (subject: user)
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  byAddress is among [false]
  Authenticating._denotedUser (ref: user) has (user: subject)
  view "(user) is the only administrator" with (user: subject)
then
  RequestBoundary.respond (error: "LAST_ADMINISTRATOR", requestId)
```

### Access.roles.AssignRole:last-administrator-by-address

Authored path: `Access.roles.AssignRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 30.
- Covered by [Roles](../design/compositions/access/roles.md), line 107.

```reaction
when RequestBoundary.request (context, path: "/roles/assign", requestId, role, session, user)
where
  byAddress is subjectIsAddress (subject: user)
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  byAddress is among [true]
  view "the account for (address)" with (address: user) has (user: subject)
  view "(user) is the only administrator" with (user: subject)
then
  RequestBoundary.respond (error: "LAST_ADMINISTRATOR", requestId)
```

### Access.roles.AssignRole:subject-not-found

Authored path: `Access.roles.AssignRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 30.
- Covered by [Roles](../design/compositions/access/roles.md), line 107.

```reaction
when RequestBoundary.request (context, path: "/roles/assign", requestId, role, session, user)
where
  byAddress is subjectIsAddress (subject: user)
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  byAddress is among [true]
  no view "the account for (address)" with (address: user)
then
  RequestBoundary.respond (error: "SUBJECT_NOT_FOUND", requestId)
```

### Access.roles.AssignRole:success

Authored path: `Access.roles.AssignRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 30.
- Covered by [Roles](../design/compositions/access/roles.md), line 107.

```reaction
when RequestBoundary.request (context, path: "/roles/assign", requestId, role, session, user)
where
  byAddress is subjectIsAddress (subject: user)
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  byAddress is among [false]
  Authenticating._denotedUser (ref: user) has (user: subject)
  view "(user) is not the only administrator" with (user: subject)
  Roling._denotedRole (ref: role) has (role: resolved)
then
  Roling.assign (context, role: resolved, user: subject)
```

### Access.roles.AssignRole:success#2

Authored path: `Access.roles.AssignRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 30.
- Covered by [Roles](../design/compositions/access/roles.md), line 107.

```reaction
when Roling.assign (context, role: resolved, user: subject, assignment), asked by Access.roles.AssignRole:success
where
  earlier, RequestBoundary.request (context, path: "/roles/assign", requestId, role, session, user)
then
  RequestBoundary.respond (assignment, requestId)
```

### Access.roles.AssignRole:success-by-address

Authored path: `Access.roles.AssignRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 30.
- Covered by [Roles](../design/compositions/access/roles.md), line 107.

```reaction
when RequestBoundary.request (context, path: "/roles/assign", requestId, role, session, user)
where
  byAddress is subjectIsAddress (subject: user)
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  byAddress is among [true]
  view "the account for (address)" with (address: user) has (user: subject)
  view "(user) is not the only administrator" with (user: subject)
  Roling._denotedRole (ref: role) has (role: resolved)
then
  Roling.assign (context, role: resolved, user: subject)
```

### Access.roles.AssignRole:success-by-address#2

Authored path: `Access.roles.AssignRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 30.
- Covered by [Roles](../design/compositions/access/roles.md), line 107.

```reaction
when Roling.assign (context, role: resolved, user: subject, assignment), asked by Access.roles.AssignRole:success-by-address
where
  earlier, RequestBoundary.request (context, path: "/roles/assign", requestId, role, session, user)
then
  RequestBoundary.respond (assignment, requestId)
```

### Access.roles.DefineRole:forbidden

Authored path: `Access.roles.DefineRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 20.
- Covered by [Roles](../design/compositions/access/roles.md), line 105.

```reaction
when RequestBoundary.request (capabilities, name, path: "/roles/define", requestId, session)
where
  known is capabilitiesAreKnown (capabilities)
  view "the active user of (session)" with (session) has (user)
  view "(user) may not administer" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.roles.DefineRole:success

Authored path: `Access.roles.DefineRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 20.
- Covered by [Roles](../design/compositions/access/roles.md), line 105.

```reaction
when RequestBoundary.request (capabilities, name, path: "/roles/define", requestId, session)
where
  known is capabilitiesAreKnown (capabilities)
  view "the active user of (session)" with (session) has (user)
  view "(user) may administer" with (user)
  known is among [true]
then
  Roling.defineRole (capabilities, name)
```

### Access.roles.DefineRole:success#2

Authored path: `Access.roles.DefineRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 20.
- Covered by [Roles](../design/compositions/access/roles.md), line 105.

```reaction
when Roling.defineRole (capabilities, name, role), asked by Access.roles.DefineRole:success
where
  earlier, RequestBoundary.request (capabilities, name, path: "/roles/define", requestId, session)
then
  RequestBoundary.respond (requestId, role)
```

### Access.roles.DefineRole:unknown-capability

Authored path: `Access.roles.DefineRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 20.
- Covered by [Roles](../design/compositions/access/roles.md), line 105.

```reaction
when RequestBoundary.request (capabilities, name, path: "/roles/define", requestId, session)
where
  known is capabilitiesAreKnown (capabilities)
  view "the active user of (session)" with (session) has (user)
  view "(user) may administer" with (user)
  known is among [false]
then
  RequestBoundary.respond (error: "UNKNOWN_CAPABILITY", requestId)
```

### Access.roles.DeleteRole:forbidden

Authored path: `Access.roles.DeleteRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 27.
- Covered by [Roles](../design/compositions/access/roles.md), line 106.

```reaction
when RequestBoundary.request (path: "/roles/delete", requestId, role, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not administer" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.roles.DeleteRole:success

Authored path: `Access.roles.DeleteRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 27.
- Covered by [Roles](../design/compositions/access/roles.md), line 106.

```reaction
when RequestBoundary.request (path: "/roles/delete", requestId, role, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may administer" with (user)
  Roling._denotedRole (ref: role) has (role: resolved)
then
  Roling.deleteRole (role: resolved)
```

### Access.roles.DeleteRole:success#2

Authored path: `Access.roles.DeleteRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 27.
- Covered by [Roles](../design/compositions/access/roles.md), line 106.

```reaction
when Roling.deleteRole (role: resolved), asked by Access.roles.DeleteRole:success
where
  earlier, RequestBoundary.request (path: "/roles/delete", requestId, role, session)
then
  RequestBoundary.respond (requestId, role: resolved)
```

### Access.roles.RevokeRole:forbidden

Authored path: `Access.roles.RevokeRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 33.
- Covered by [Roles](../design/compositions/access/roles.md), line 108.

```reaction
when RequestBoundary.request (context, path: "/roles/revoke", requestId, session, user)
where
  byAddress is subjectIsAddress (subject: user)
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not administer" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Access.roles.RevokeRole:last-administrator

Authored path: `Access.roles.RevokeRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 33.
- Covered by [Roles](../design/compositions/access/roles.md), line 108.

```reaction
when RequestBoundary.request (context, path: "/roles/revoke", requestId, session, user)
where
  byAddress is subjectIsAddress (subject: user)
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  byAddress is among [false]
  Authenticating._denotedUser (ref: user) has (user: subject)
  view "(user) is the only administrator" with (user: subject)
then
  RequestBoundary.respond (error: "LAST_ADMINISTRATOR", requestId)
```

### Access.roles.RevokeRole:last-administrator-by-address

Authored path: `Access.roles.RevokeRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 33.
- Covered by [Roles](../design/compositions/access/roles.md), line 108.

```reaction
when RequestBoundary.request (context, path: "/roles/revoke", requestId, session, user)
where
  byAddress is subjectIsAddress (subject: user)
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  byAddress is among [true]
  view "the account for (address)" with (address: user) has (user: subject)
  view "(user) is the only administrator" with (user: subject)
then
  RequestBoundary.respond (error: "LAST_ADMINISTRATOR", requestId)
```

### Access.roles.RevokeRole:subject-not-found

Authored path: `Access.roles.RevokeRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 33.
- Covered by [Roles](../design/compositions/access/roles.md), line 108.

```reaction
when RequestBoundary.request (context, path: "/roles/revoke", requestId, session, user)
where
  byAddress is subjectIsAddress (subject: user)
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  byAddress is among [true]
  no view "the account for (address)" with (address: user)
then
  RequestBoundary.respond (error: "SUBJECT_NOT_FOUND", requestId)
```

### Access.roles.RevokeRole:success

Authored path: `Access.roles.RevokeRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 33.
- Covered by [Roles](../design/compositions/access/roles.md), line 108.

```reaction
when RequestBoundary.request (context, path: "/roles/revoke", requestId, session, user)
where
  byAddress is subjectIsAddress (subject: user)
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  byAddress is among [false]
  Authenticating._denotedUser (ref: user) has (user: subject)
  view "(user) is not the only administrator" with (user: subject)
then
  Roling.revoke (context, user: subject)
```

### Access.roles.RevokeRole:success#2

Authored path: `Access.roles.RevokeRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 33.
- Covered by [Roles](../design/compositions/access/roles.md), line 108.

```reaction
when Roling.revoke (context, user: subject, assignment), asked by Access.roles.RevokeRole:success
where
  earlier, RequestBoundary.request (context, path: "/roles/revoke", requestId, session, user)
then
  RequestBoundary.respond (assignment, requestId)
```

### Access.roles.RevokeRole:success-by-address

Authored path: `Access.roles.RevokeRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 33.
- Covered by [Roles](../design/compositions/access/roles.md), line 108.

```reaction
when RequestBoundary.request (context, path: "/roles/revoke", requestId, session, user)
where
  byAddress is subjectIsAddress (subject: user)
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may administer" with (user: actor)
  byAddress is among [true]
  view "the account for (address)" with (address: user) has (user: subject)
  view "(user) is not the only administrator" with (user: subject)
then
  Roling.revoke (context, user: subject)
```

### Access.roles.RevokeRole:success-by-address#2

Authored path: `Access.roles.RevokeRole`.
- Covered by [Roles](../design/compositions/access/roles.md), line 33.
- Covered by [Roles](../design/compositions/access/roles.md), line 108.

```reaction
when Roling.revoke (context, user: subject, assignment), asked by Access.roles.RevokeRole:success-by-address
where
  earlier, RequestBoundary.request (context, path: "/roles/revoke", requestId, session, user)
then
  RequestBoundary.respond (assignment, requestId)
```

### Access.roles.RoleForUser:held

Authored path: `Access.roles.RoleForUser`.
- Covered by [Roles](../design/compositions/access/roles.md), line 92.
- Covered by [Roles](../design/compositions/access/roles.md), line 109.

```reaction
when RequestBoundary.request (context, path: "/roles/forUser", requestId, user)
where
  Authenticating._denotedUser (ref: user) has (user: subject)
  view "the role of (user) in (context)" with (context, user: subject) has (capabilities, name, role)
then
  RequestBoundary.respond (capabilities, name, requestId, role)
```

### Access.roles.RoleForUser:none

Authored path: `Access.roles.RoleForUser`.
- Covered by [Roles](../design/compositions/access/roles.md), line 92.
- Covered by [Roles](../design/compositions/access/roles.md), line 109.

```reaction
when RequestBoundary.request (context, path: "/roles/forUser", requestId, user)
where
  Authenticating._denotedUser (ref: user) has (user: subject)
  no view "the role of (user) in (context)" with (context, user: subject)
then
  RequestBoundary.respond (capabilities: [], name: null, requestId, role: null)
```

### Access.roles.RoleGet

Authored path: `Access.roles.RoleGet`.
- Covered by [Roles](../design/compositions/access/roles.md), line 95.
- Covered by [Roles](../design/compositions/access/roles.md), line 110.

```reaction
when RequestBoundary.request (path: "/roles/get", requestId, role)
where
  Roling._getRoleDetail (role) has (capabilities, name)
then
  RequestBoundary.respond (capabilities, name, requestId)
```

### Access.roles.RoleList

Authored path: `Access.roles.RoleList`.
- Covered by [Roles](../design/compositions/access/roles.md), line 96.
- Covered by [Roles](../design/compositions/access/roles.md), line 111.

```reaction
when RequestBoundary.request (path: "/roles/list", requestId)
then
  RequestBoundary.respond (requestId, roles: former "the defined roles ()")
```

### Access.session.InvalidSessionIsRejected:expired-session

Authored path: `Access.session.InvalidSessionIsRejected`.
- Covered by [Session boundary](../design/compositions/access/session.md), line 6.

```reaction
when RequestBoundary.request (requestId, session)
where
  at is the current flow's instant
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
  at is the current flow's instant
  Sessioning._isExpired (at, session) has (expired: false)
  no view "the active user of (session)" with (session)
then
  RequestBoundary.respond (error: "UNAUTHORIZED", requestId)
```

### Course.assignments.Archive:forbidden

Authored path: `Course.assignments.Archive`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 7.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 51.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/archive", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.Archive:success

Authored path: `Course.assignments.Archive`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 7.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 51.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/archive", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Assigning.archive (assignment, at)
```

### Course.assignments.Archive:success#2

Authored path: `Course.assignments.Archive`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 7.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 51.

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
  at is the current flow's instant
  Assigning._getPublishedForAudience (audience: section) has (assignment)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: false)
then
  Assigning.assign (assignee: user, assignment, at)
```

### Course.assignments.ClearDueOverride:forbidden

Authored path: `Course.assignments.ClearDueOverride`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 10.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 52.

```reaction
when RequestBoundary.request (assignee, assignment, path: "/assignments/clear-due-override", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.ClearDueOverride:success

Authored path: `Course.assignments.ClearDueOverride`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 10.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 52.

```reaction
when RequestBoundary.request (assignee, assignment, path: "/assignments/clear-due-override", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Assigning.clearDueOverride (assignee, assignment)
```

### Course.assignments.ClearDueOverride:success#2

Authored path: `Course.assignments.ClearDueOverride`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 10.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 52.

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
- Covered by [Assignments](../design/compositions/course/assignments.md), line 53.

```reaction
when RequestBoundary.request (acceptsSubmissions, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/create-draft", requestId, session, targets, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.CreateDraft:success

Authored path: `Course.assignments.CreateDraft`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 4.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 53.

```reaction
when RequestBoundary.request (acceptsSubmissions, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/create-draft", requestId, session, targets, title)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Assigning.createDraft (acceptsSubmissions, at, audience, author: user, availableAt, closeAt, dueAt, instructions, kind, targets, title)
```

### Course.assignments.CreateDraft:success#2

Authored path: `Course.assignments.CreateDraft`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 4.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 53.

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
- Covered by [Assignments](../design/compositions/course/assignments.md), line 54.

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
- Covered by [Assignments](../design/compositions/course/assignments.md), line 54.

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
- Covered by [Assignments](../design/compositions/course/assignments.md), line 55.

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
- Covered by [Assignments](../design/compositions/course/assignments.md), line 55.

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
- Covered by [Assignments](../design/compositions/course/assignments.md), line 55.

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
- Covered by [Assignments](../design/compositions/course/assignments.md), line 55.

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
- Covered by [Assignments](../design/compositions/course/assignments.md), line 56.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/publish", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.Publish:success

Authored path: `Course.assignments.Publish`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 6.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 56.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/publish", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Assigning.publish (assignment, at)
```

### Course.assignments.Publish:success#2

Authored path: `Course.assignments.Publish`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 6.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 56.

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
  at is the current flow's instant
  Assigning._getPublishedForAudience (audience: section) has (assignment)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: false)
then
  Assigning.assign (assignee: user, assignment, at)
```

### Course.assignments.Revise:forbidden

Authored path: `Course.assignments.Revise`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 5.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 57.

```reaction
when RequestBoundary.request (acceptsSubmissions, assignment, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/revise", requestId, session, targets, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.Revise:success

Authored path: `Course.assignments.Revise`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 5.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 57.

```reaction
when RequestBoundary.request (acceptsSubmissions, assignment, audience, availableAt, closeAt, dueAt, instructions, kind, path: "/assignments/revise", requestId, session, targets, title)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Assigning.revise (acceptsSubmissions, assignment, at, audience, availableAt, closeAt, dueAt, instructions, kind, targets, title)
```

### Course.assignments.Revise:success#2

Authored path: `Course.assignments.Revise`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 5.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 57.

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
- Covered by [Assignments](../design/compositions/course/assignments.md), line 58.

```reaction
when RequestBoundary.request (assignee, assignment, dueAt, path: "/assignments/set-due-override", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.SetDueOverride:success

Authored path: `Course.assignments.SetDueOverride`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 9.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 58.

```reaction
when RequestBoundary.request (assignee, assignment, dueAt, path: "/assignments/set-due-override", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Assigning.setDueOverride (assignee, assignment, dueAt)
```

### Course.assignments.SetDueOverride:success#2

Authored path: `Course.assignments.SetDueOverride`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 9.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 58.

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
- Covered by [Assignments](../design/compositions/course/assignments.md), line 59.

```reaction
when RequestBoundary.request (path: "/assignments/staff-list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.StaffList:success

Authored path: `Course.assignments.StaffList`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 40.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 59.

```reaction
when RequestBoundary.request (path: "/assignments/staff-list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  RequestBoundary.respond (assignments: former "the staff assignments ()", requestId)
```

### Course.assignments.StaffSummary:forbidden

Authored path: `Course.assignments.StaffSummary`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 39.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 60.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/staff-summary", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.assignments.StaffSummary:found

Authored path: `Course.assignments.StaffSummary`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 39.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 60.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/staff-summary", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
  view "the assignment (assignment)" with (assignment) has (detail)
then
  RequestBoundary.respond (requestId, summary: detail)
```

### Course.assignments.StaffSummary:missing

Authored path: `Course.assignments.StaffSummary`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 39.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 60.

```reaction
when RequestBoundary.request (assignment, path: "/assignments/staff-summary", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
  no view "the assignment (assignment)" with (assignment)
then
  RequestBoundary.respond (requestId, summary: null)
```

### Course.assignments.Submit:forbidden

Authored path: `Course.assignments.Submit`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 43.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 61.

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
- Covered by [Assignments](../design/compositions/course/assignments.md), line 61.

```reaction
when RequestBoundary.request (assignment, content, path: "/assignments/submit", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  Posting.create (at, author: user, content)
```

### Course.assignments.Submit:success#2

Authored path: `Course.assignments.Submit`.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 43.
- Covered by [Assignments](../design/compositions/course/assignments.md), line 61.

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
- Covered by [Assignments](../design/compositions/course/assignments.md), line 61.

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
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 18.

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
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 18.

```reaction
when RequestBoundary.request (end, path: "/calendar/me", requestId, session, start)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  RequestBoundary.respond (events: former "the calendar of (student) between (start) and (end)" with (end, start, student: user), requestId)
```

### Course.calendar.CalendarStaff:forbidden

Authored path: `Course.calendar.CalendarStaff`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 5.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 19.

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
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 5.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 19.

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
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 7.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 20.

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
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 7.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 20.

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
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 9.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 21.

```reaction
when RequestBoundary.request (path: "/lms/staff-dashboard", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.calendar.LmsStaffDashboard:success

Authored path: `Course.calendar.LmsStaffDashboard`.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 9.
- Covered by [Calendar and dashboards](../design/compositions/course/calendar.md), line 21.

```reaction
when RequestBoundary.request (path: "/lms/staff-dashboard", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
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
- Covered by [Grades](../design/compositions/course/grades.md), line 13.
- Covered by [Grades](../design/compositions/course/grades.md), line 54.

```reaction
when RequestBoundary.request (item, maxPoints, name, path: "/grades/add-criterion", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesAddCriterion:success

Authored path: `Course.grades.GradesAddCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 13.
- Covered by [Grades](../design/compositions/course/grades.md), line 54.

```reaction
when RequestBoundary.request (item, maxPoints, name, path: "/grades/add-criterion", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  Itemizing.addCriterion (item, maxPoints, name, position)
```

### Course.grades.GradesAddCriterion:success#2

Authored path: `Course.grades.GradesAddCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 13.
- Covered by [Grades](../design/compositions/course/grades.md), line 54.

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
- Covered by [Grades](../design/compositions/course/grades.md), line 55.

```reaction
when RequestBoundary.request (item, label, maxPoints, path: "/grades/configure-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesConfigureItem:success

Authored path: `Course.grades.GradesConfigureItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 4.
- Covered by [Grades](../design/compositions/course/grades.md), line 55.

```reaction
when RequestBoundary.request (item, label, maxPoints, path: "/grades/configure-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  Itemizing.configureItem (item, label, maxPoints)
```

### Course.grades.GradesConfigureItem:success#2

Authored path: `Course.grades.GradesConfigureItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 4.
- Covered by [Grades](../design/compositions/course/grades.md), line 55.

```reaction
when Itemizing.configureItem (item, label, maxPoints, gradeItem), asked by Course.grades.GradesConfigureItem:success
where
  earlier, RequestBoundary.request (item, label, maxPoints, path: "/grades/configure-item", requestId, session)
then
  RequestBoundary.respond (gradeItem, requestId)
```

### Course.grades.GradesCriterionScores:forbidden

Authored path: `Course.grades.GradesCriterionScores`.
- Covered by [Grades](../design/compositions/course/grades.md), line 20.
- Covered by [Grades](../design/compositions/course/grades.md), line 56.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/criterion-scores", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesCriterionScores:learner

Authored path: `Course.grades.GradesCriterionScores`.
- Covered by [Grades](../design/compositions/course/grades.md), line 20.
- Covered by [Grades](../design/compositions/course/grades.md), line 56.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/criterion-scores", requestId, session)
where
  view "the active user of (session)" with (session) has (user: learner)
  view "(user) is an active student" with (user: learner)
  Grading._getGrade (item, learner) has (status: "RELEASED")
then
  RequestBoundary.respond (requestId, scores: former "the criterion scores of (learner) on (item)" with (item, learner))
```

### Course.grades.GradesCriterionScores:success

Authored path: `Course.grades.GradesCriterionScores`.
- Covered by [Grades](../design/compositions/course/grades.md), line 20.
- Covered by [Grades](../design/compositions/course/grades.md), line 56.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/criterion-scores", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  RequestBoundary.respond (requestId, scores: former "the criterion scores of (learner) on (item)" with (item, learner))
```

### Course.grades.GradesExcuse:forbidden

Authored path: `Course.grades.GradesExcuse`.
- Covered by [Grades](../design/compositions/course/grades.md), line 34.
- Covered by [Grades](../design/compositions/course/grades.md), line 57.

```reaction
when RequestBoundary.request (feedback, item, learner, path: "/grades/excuse", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesExcuse:success

Authored path: `Course.grades.GradesExcuse`.
- Covered by [Grades](../design/compositions/course/grades.md), line 34.
- Covered by [Grades](../design/compositions/course/grades.md), line 57.

```reaction
when RequestBoundary.request (feedback, item, learner, path: "/grades/excuse", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  Grading.excuse (at, feedback, grader: user, item, learner)
```

### Course.grades.GradesExcuse:success#2

Authored path: `Course.grades.GradesExcuse`.
- Covered by [Grades](../design/compositions/course/grades.md), line 34.
- Covered by [Grades](../design/compositions/course/grades.md), line 57.

```reaction
when Grading.excuse (at, feedback, grader: user, item, learner, grade), asked by Course.grades.GradesExcuse:success
where
  earlier, RequestBoundary.request (feedback, item, learner, path: "/grades/excuse", requestId, session)
then
  RequestBoundary.respond (grade, requestId)
```

### Course.grades.GradesExport:forbidden

Authored path: `Course.grades.GradesExport`.
- Covered by [Grades](../design/compositions/course/grades.md), line 50.
- Covered by [Grades](../design/compositions/course/grades.md), line 58.

```reaction
when RequestBoundary.request (path: "/grades/export", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesExport:success

Authored path: `Course.grades.GradesExport`.
- Covered by [Grades](../design/compositions/course/grades.md), line 50.
- Covered by [Grades](../design/compositions/course/grades.md), line 58.

```reaction
when RequestBoundary.request (path: "/grades/export", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  RequestBoundary.respond (csv: "", requestId)
```

### Course.grades.GradesForItem:forbidden

Authored path: `Course.grades.GradesForItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 41.
- Covered by [Grades](../design/compositions/course/grades.md), line 59.

```reaction
when RequestBoundary.request (item, path: "/grades/for-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesForItem:success

Authored path: `Course.grades.GradesForItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 41.
- Covered by [Grades](../design/compositions/course/grades.md), line 59.

```reaction
when RequestBoundary.request (item, path: "/grades/for-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  RequestBoundary.respond (grades: former "the grades on (item)" with (item), requestId)
```

### Course.grades.GradesForMe:not-student

Authored path: `Course.grades.GradesForMe`.
- Covered by [Grades](../design/compositions/course/grades.md), line 38.
- Covered by [Grades](../design/compositions/course/grades.md), line 60.

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
- Covered by [Grades](../design/compositions/course/grades.md), line 38.
- Covered by [Grades](../design/compositions/course/grades.md), line 60.

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
- Covered by [Grades](../design/compositions/course/grades.md), line 39.
- Covered by [Grades](../design/compositions/course/grades.md), line 61.

```reaction
when RequestBoundary.request (learner, path: "/grades/for-student", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesForStudent:success

Authored path: `Course.grades.GradesForStudent`.
- Covered by [Grades](../design/compositions/course/grades.md), line 39.
- Covered by [Grades](../design/compositions/course/grades.md), line 61.

```reaction
when RequestBoundary.request (learner, path: "/grades/for-student", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  RequestBoundary.respond (grades: former "the grades of (learner)" with (learner), requestId)
```

### Course.grades.GradesGradebook:forbidden

Authored path: `Course.grades.GradesGradebook`.
- Covered by [Grades](../design/compositions/course/grades.md), line 43.
- Covered by [Grades](../design/compositions/course/grades.md), line 62.

```reaction
when RequestBoundary.request (path: "/grades/gradebook", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesGradebook:success

Authored path: `Course.grades.GradesGradebook`.
- Covered by [Grades](../design/compositions/course/grades.md), line 43.
- Covered by [Grades](../design/compositions/course/grades.md), line 62.

```reaction
when RequestBoundary.request (path: "/grades/gradebook", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  RequestBoundary.respond (gradebook: former "the gradebook ()", requestId)
```

### Course.grades.GradesItem:forbidden

Authored path: `Course.grades.GradesItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 7.
- Covered by [Grades](../design/compositions/course/grades.md), line 63.

```reaction
when RequestBoundary.request (item, path: "/grades/item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesItem:learner

Authored path: `Course.grades.GradesItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 7.
- Covered by [Grades](../design/compositions/course/grades.md), line 63.

```reaction
when RequestBoundary.request (item, path: "/grades/item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
  Assigning._isAssigned (assignee: user, assignment: item) has (assigned: true)
  Itemizing._getItem (item) has (label, maxPoints, status)
then
  RequestBoundary.respond (criteria: former "the criteria of (item)" with (item), item, label, maxPoints, requestId, status)
```

### Course.grades.GradesItem:missing

Authored path: `Course.grades.GradesItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 7.
- Covered by [Grades](../design/compositions/course/grades.md), line 63.

```reaction
when RequestBoundary.request (item, path: "/grades/item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
  no Itemizing._getItem (item)
then
  RequestBoundary.respond (error: "GRADE_ITEM_NOT_FOUND", requestId)
```

### Course.grades.GradesItem:success

Authored path: `Course.grades.GradesItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 7.
- Covered by [Grades](../design/compositions/course/grades.md), line 63.

```reaction
when RequestBoundary.request (item, path: "/grades/item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
  Itemizing._getItem (item) has (label, maxPoints, status)
then
  RequestBoundary.respond (criteria: former "the criteria of (item)" with (item), item, label, maxPoints, requestId, status)
```

### Course.grades.GradesRecord:forbidden

Authored path: `Course.grades.GradesRecord`.
- Covered by [Grades](../design/compositions/course/grades.md), line 24.
- Covered by [Grades](../design/compositions/course/grades.md), line 64.

```reaction
when RequestBoundary.request (evidence, feedback, item, learner, path: "/grades/record", requestId, score, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesRecord:missing-item

Authored path: `Course.grades.GradesRecord`.
- Covered by [Grades](../design/compositions/course/grades.md), line 24.
- Covered by [Grades](../design/compositions/course/grades.md), line 64.

```reaction
when RequestBoundary.request (evidence, feedback, item, learner, path: "/grades/record", requestId, score, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
  no Itemizing._getItem (item)
then
  RequestBoundary.respond (error: "GRADE_ITEM_NOT_FOUND", requestId)
```

### Course.grades.GradesRecord:success

Authored path: `Course.grades.GradesRecord`.
- Covered by [Grades](../design/compositions/course/grades.md), line 24.
- Covered by [Grades](../design/compositions/course/grades.md), line 64.

```reaction
when RequestBoundary.request (evidence, feedback, item, learner, path: "/grades/record", requestId, score, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
  Itemizing._getItem (item) has (maxPoints)
then
  Grading.record (at, evidence, feedback, grader: user, item, learner, outOf: maxPoints, score)
```

### Course.grades.GradesRecord:success#2

Authored path: `Course.grades.GradesRecord`.
- Covered by [Grades](../design/compositions/course/grades.md), line 24.
- Covered by [Grades](../design/compositions/course/grades.md), line 64.

```reaction
when Grading.record (at, evidence, feedback, grader: user, item, learner, outOf: maxPoints, score, grade), asked by Course.grades.GradesRecord:success
where
  earlier, RequestBoundary.request (evidence, feedback, item, learner, path: "/grades/record", requestId, score, session)
then
  RequestBoundary.respond (grade, requestId)
```

### Course.grades.GradesRelease:forbidden

Authored path: `Course.grades.GradesRelease`.
- Covered by [Grades](../design/compositions/course/grades.md), line 30.
- Covered by [Grades](../design/compositions/course/grades.md), line 65.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/release", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesRelease:success

Authored path: `Course.grades.GradesRelease`.
- Covered by [Grades](../design/compositions/course/grades.md), line 30.
- Covered by [Grades](../design/compositions/course/grades.md), line 65.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/release", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  Grading.release (at, item, learner)
```

### Course.grades.GradesRelease:success#2

Authored path: `Course.grades.GradesRelease`.
- Covered by [Grades](../design/compositions/course/grades.md), line 30.
- Covered by [Grades](../design/compositions/course/grades.md), line 65.

```reaction
when Grading.release (at, item, learner, grade), asked by Course.grades.GradesRelease:success
where
  earlier, RequestBoundary.request (item, learner, path: "/grades/release", requestId, session)
then
  RequestBoundary.respond (grade, requestId)
```

### Course.grades.GradesReleaseItem:forbidden

Authored path: `Course.grades.GradesReleaseItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 31.
- Covered by [Grades](../design/compositions/course/grades.md), line 66.

```reaction
when RequestBoundary.request (item, path: "/grades/release-item", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesReleaseItem:success

Authored path: `Course.grades.GradesReleaseItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 31.
- Covered by [Grades](../design/compositions/course/grades.md), line 66.

```reaction
when RequestBoundary.request (item, path: "/grades/release-item", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  Grading.releaseItem (at, item)
```

### Course.grades.GradesReleaseItem:success#2

Authored path: `Course.grades.GradesReleaseItem`.
- Covered by [Grades](../design/compositions/course/grades.md), line 31.
- Covered by [Grades](../design/compositions/course/grades.md), line 66.

```reaction
when Grading.releaseItem (at, item, released), asked by Course.grades.GradesReleaseItem:success
where
  earlier, RequestBoundary.request (item, path: "/grades/release-item", requestId, session)
then
  RequestBoundary.respond (released, requestId)
```

### Course.grades.GradesRemoveCriterion:forbidden

Authored path: `Course.grades.GradesRemoveCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 15.
- Covered by [Grades](../design/compositions/course/grades.md), line 67.

```reaction
when RequestBoundary.request (criterion, path: "/grades/remove-criterion", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesRemoveCriterion:success

Authored path: `Course.grades.GradesRemoveCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 15.
- Covered by [Grades](../design/compositions/course/grades.md), line 67.

```reaction
when RequestBoundary.request (criterion, path: "/grades/remove-criterion", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  Itemizing.removeCriterion (criterion)
```

### Course.grades.GradesRemoveCriterion:success#2

Authored path: `Course.grades.GradesRemoveCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 15.
- Covered by [Grades](../design/compositions/course/grades.md), line 67.

```reaction
when Itemizing.removeCriterion (criterion, result.criterion: removed), asked by Course.grades.GradesRemoveCriterion:success
where
  earlier, RequestBoundary.request (criterion, path: "/grades/remove-criterion", requestId, session)
then
  RequestBoundary.respond (criterion: removed, requestId)
```

### Course.grades.GradesRestoreExcused:forbidden

Authored path: `Course.grades.GradesRestoreExcused`.
- Covered by [Grades](../design/compositions/course/grades.md), line 34.
- Covered by [Grades](../design/compositions/course/grades.md), line 69.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/restore-excused", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesRestoreExcused:success

Authored path: `Course.grades.GradesRestoreExcused`.
- Covered by [Grades](../design/compositions/course/grades.md), line 34.
- Covered by [Grades](../design/compositions/course/grades.md), line 69.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/restore-excused", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  Grading.restoreExcused (at, item, learner)
```

### Course.grades.GradesRestoreExcused:success#2

Authored path: `Course.grades.GradesRestoreExcused`.
- Covered by [Grades](../design/compositions/course/grades.md), line 34.
- Covered by [Grades](../design/compositions/course/grades.md), line 69.

```reaction
when Grading.restoreExcused (at, item, learner, grade), asked by Course.grades.GradesRestoreExcused:success
where
  earlier, RequestBoundary.request (item, learner, path: "/grades/restore-excused", requestId, session)
then
  RequestBoundary.respond (grade, requestId)
```

### Course.grades.GradesRetract:forbidden

Authored path: `Course.grades.GradesRetract`.
- Covered by [Grades](../design/compositions/course/grades.md), line 32.
- Covered by [Grades](../design/compositions/course/grades.md), line 68.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/retract", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesRetract:success

Authored path: `Course.grades.GradesRetract`.
- Covered by [Grades](../design/compositions/course/grades.md), line 32.
- Covered by [Grades](../design/compositions/course/grades.md), line 68.

```reaction
when RequestBoundary.request (item, learner, path: "/grades/retract", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  Grading.retract (at, item, learner)
```

### Course.grades.GradesRetract:success#2

Authored path: `Course.grades.GradesRetract`.
- Covered by [Grades](../design/compositions/course/grades.md), line 32.
- Covered by [Grades](../design/compositions/course/grades.md), line 68.

```reaction
when Grading.retract (at, item, learner, grade), asked by Course.grades.GradesRetract:success
where
  earlier, RequestBoundary.request (item, learner, path: "/grades/retract", requestId, session)
then
  RequestBoundary.respond (grade, requestId)
```

### Course.grades.GradesReviseCriterion:forbidden

Authored path: `Course.grades.GradesReviseCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 14.
- Covered by [Grades](../design/compositions/course/grades.md), line 70.

```reaction
when RequestBoundary.request (criterion, maxPoints, name, path: "/grades/revise-criterion", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesReviseCriterion:success

Authored path: `Course.grades.GradesReviseCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 14.
- Covered by [Grades](../design/compositions/course/grades.md), line 70.

```reaction
when RequestBoundary.request (criterion, maxPoints, name, path: "/grades/revise-criterion", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  Itemizing.reviseCriterion (criterion, maxPoints, name, position)
```

### Course.grades.GradesReviseCriterion:success#2

Authored path: `Course.grades.GradesReviseCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 14.
- Covered by [Grades](../design/compositions/course/grades.md), line 70.

```reaction
when Itemizing.reviseCriterion (criterion, maxPoints, name, position, result.criterion: revised), asked by Course.grades.GradesReviseCriterion:success
where
  earlier, RequestBoundary.request (criterion, maxPoints, name, path: "/grades/revise-criterion", position, requestId, session)
then
  RequestBoundary.respond (criterion: revised, requestId)
```

### Course.grades.GradesScoreCriterion:cross-item

Authored path: `Course.grades.GradesScoreCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 26.
- Covered by [Grades](../design/compositions/course/grades.md), line 71.

```reaction
when RequestBoundary.request (criterion, feedback, item, learner, path: "/grades/score-criterion", points, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
  Itemizing._getCriterion (criterion) and not (item)
then
  RequestBoundary.respond (error: "CRITERION_NOT_FOUND", requestId)
```

### Course.grades.GradesScoreCriterion:forbidden

Authored path: `Course.grades.GradesScoreCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 26.
- Covered by [Grades](../design/compositions/course/grades.md), line 71.

```reaction
when RequestBoundary.request (criterion, feedback, item, learner, path: "/grades/score-criterion", points, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.grades.GradesScoreCriterion:missing

Authored path: `Course.grades.GradesScoreCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 26.
- Covered by [Grades](../design/compositions/course/grades.md), line 71.

```reaction
when RequestBoundary.request (criterion, feedback, item, learner, path: "/grades/score-criterion", points, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
  no Itemizing._getCriterion (criterion)
then
  RequestBoundary.respond (error: "CRITERION_NOT_FOUND", requestId)
```

### Course.grades.GradesScoreCriterion:success

Authored path: `Course.grades.GradesScoreCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 26.
- Covered by [Grades](../design/compositions/course/grades.md), line 71.

```reaction
when RequestBoundary.request (criterion, feedback, item, learner, path: "/grades/score-criterion", points, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
  Itemizing._getCriterion (criterion) has (item, maxPoints: critMax)
then
  Grading.scoreCriterion (criterion, feedback, item, learner, outOf: critMax, points)
```

### Course.grades.GradesScoreCriterion:success#2

Authored path: `Course.grades.GradesScoreCriterion`.
- Covered by [Grades](../design/compositions/course/grades.md), line 26.
- Covered by [Grades](../design/compositions/course/grades.md), line 71.

```reaction
when Grading.scoreCriterion (criterion, feedback, item, learner, outOf: critMax, points, criterionScore), asked by Course.grades.GradesScoreCriterion:success
where
  earlier, RequestBoundary.request (criterion, feedback, item, learner, path: "/grades/score-criterion", points, requestId, session)
then
  RequestBoundary.respond (criterionScore, requestId)
```

### Course.grades.RemovedCriterionClearsScores

Authored path: `Course.grades.RemovedCriterionClearsScores`.
- Covered by [Grades](../design/compositions/course/grades.md), line 17.

```reaction
when Itemizing.removeCriterion (criterion)
then
  Grading.clearCriterionScores (criterion)
```

### Course.lateDays.Apply:forbidden

Authored path: `Course.lateDays.Apply`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 9.
- Covered by [Late days](../design/compositions/course/late-days.md), line 29.

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/apply", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.Apply:not-assigned

Authored path: `Course.lateDays.Apply`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 9.
- Covered by [Late days](../design/compositions/course/late-days.md), line 29.

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/apply", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: false)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.Apply:not-published

Authored path: `Course.lateDays.Apply`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 9.
- Covered by [Late days](../design/compositions/course/late-days.md), line 29.

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/apply", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: true)
  no Assigning._getAssignments () has (assignment, status: "PUBLISHED")
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.Apply:success

Authored path: `Course.lateDays.Apply`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 9.
- Covered by [Late days](../design/compositions/course/late-days.md), line 29.

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/apply", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: true)
  Assigning._getAssignments () has (assignment, status: "PUBLISHED")
then
  Banking.apply (at, days, item: assignment, learner: user)
```

### Course.lateDays.Apply:success#2

Authored path: `Course.lateDays.Apply`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 9.
- Covered by [Late days](../design/compositions/course/late-days.md), line 29.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 30.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 30.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 30.

```reaction
when RequestBoundary.request (learner, path: "/late-days/balance", requestId, session)
where
  view "the active user of (session)" with (session) has (user) and not (user: learner)
  view "(user) may not manage student records" with (user)
  view "(user) is an active student" with (user: learner)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.Balance:staff-balance

Authored path: `Course.lateDays.Balance`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 14.
- Covered by [Late days](../design/compositions/course/late-days.md), line 30.

```reaction
when RequestBoundary.request (learner, path: "/late-days/balance", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
  view "(user) is an active student" with (user: learner)
then
  RequestBoundary.respond (balance: former "the late-day balance of (learner)" with (learner), requestId)
```

### Course.lateDays.Cancel:forbidden

Authored path: `Course.lateDays.Cancel`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 11.
- Covered by [Late days](../design/compositions/course/late-days.md), line 31.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 31.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 31.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 32.

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/change", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is not an active student" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.Change:not-assigned

Authored path: `Course.lateDays.Change`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 10.
- Covered by [Late days](../design/compositions/course/late-days.md), line 32.

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/change", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: false)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.Change:not-published

Authored path: `Course.lateDays.Change`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 10.
- Covered by [Late days](../design/compositions/course/late-days.md), line 32.

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/change", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: true)
  no Assigning._getAssignments () has (assignment, status: "PUBLISHED")
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.Change:success

Authored path: `Course.lateDays.Change`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 10.
- Covered by [Late days](../design/compositions/course/late-days.md), line 32.

```reaction
when RequestBoundary.request (assignment, days, path: "/late-days/change", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
  Assigning._isAssigned (assignee: user, assignment) has (assigned: true)
  Assigning._getAssignments () has (assignment, status: "PUBLISHED")
then
  Banking.change (days, item: assignment, learner: user)
```

### Course.lateDays.Change:success#2

Authored path: `Course.lateDays.Change`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 10.
- Covered by [Late days](../design/compositions/course/late-days.md), line 32.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 33.

```reaction
when RequestBoundary.request (defaultDays, maxDaysPerItem, path: "/late-days/configure-policy", requestId, session, unitHours)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student records" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.ConfigurePolicy:success

Authored path: `Course.lateDays.ConfigurePolicy`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 4.
- Covered by [Late days](../design/compositions/course/late-days.md), line 33.

```reaction
when RequestBoundary.request (defaultDays, maxDaysPerItem, path: "/late-days/configure-policy", requestId, session, unitHours)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
then
  Banking.setTerms (allowance: defaultDays, perItemLimit: maxDaysPerItem, unitHours)
```

### Course.lateDays.ConfigurePolicy:success#2

Authored path: `Course.lateDays.ConfigurePolicy`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 4.
- Covered by [Late days](../design/compositions/course/late-days.md), line 33.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 34.

```reaction
when RequestBoundary.request (assignment, path: "/late-days/for-assignment", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student records" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.ForAssignment:success

Authored path: `Course.lateDays.ForAssignment`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 21.
- Covered by [Late days](../design/compositions/course/late-days.md), line 34.

```reaction
when RequestBoundary.request (assignment, path: "/late-days/for-assignment", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
then
  RequestBoundary.respond (requestId, users: former "the late-day uses on (assignment)" with (assignment))
```

### Course.lateDays.Grant:forbidden

Authored path: `Course.lateDays.Grant`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 6.
- Covered by [Late days](../design/compositions/course/late-days.md), line 35.

```reaction
when RequestBoundary.request (days, learner, path: "/late-days/grant", reason, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student records" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.Grant:success

Authored path: `Course.lateDays.Grant`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 6.
- Covered by [Late days](../design/compositions/course/late-days.md), line 35.

```reaction
when RequestBoundary.request (days, learner, path: "/late-days/grant", reason, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
then
  Banking.grant (at, days, learner, reason)
```

### Course.lateDays.Grant:success#2

Authored path: `Course.lateDays.Grant`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 6.
- Covered by [Late days](../design/compositions/course/late-days.md), line 35.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 36.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 36.

```reaction
when RequestBoundary.request (path: "/late-days/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
  Banking._getTerms () has (perItemLimit: maxDaysPerItem, unitHours)
then
  RequestBoundary.respond (maxDaysPerItem, requestId, unitHours, uses: former "the late-day uses of (learner)" with (learner: user))
```

### Course.lateDays.Policy:forbidden

Authored path: `Course.lateDays.Policy`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 3.
- Covered by [Late days](../design/compositions/course/late-days.md), line 37.

```reaction
when RequestBoundary.request (path: "/late-days/policy", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student records" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.lateDays.Policy:success

Authored path: `Course.lateDays.Policy`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 3.
- Covered by [Late days](../design/compositions/course/late-days.md), line 37.

```reaction
when RequestBoundary.request (path: "/late-days/policy", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
  Banking._getTerms () has (allowance: defaultDays, perItemLimit: maxDaysPerItem, unitHours)
then
  RequestBoundary.respond (defaultDays, maxDaysPerItem, requestId, unitHours)
```

### Course.lateDays.StaffCancel:hidden

Authored path: `Course.lateDays.StaffCancel`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 20.
- Covered by [Late days](../design/compositions/course/late-days.md), line 38.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 38.

```reaction
when RequestBoundary.request (assignment, learner, path: "/late-days/staff-cancel", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
  view "(user) is an active student" with (user: learner)
then
  Banking.cancel (item: assignment, learner)
```

### Course.lateDays.StaffCancel:success#2

Authored path: `Course.lateDays.StaffCancel`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 20.
- Covered by [Late days](../design/compositions/course/late-days.md), line 38.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 38.

```reaction
when RequestBoundary.request (assignment, learner, path: "/late-days/staff-cancel", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student records" with (user)
  view "(user) is an active student" with (user: learner)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.lateDays.StaffChange:hidden

Authored path: `Course.lateDays.StaffChange`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 19.
- Covered by [Late days](../design/compositions/course/late-days.md), line 39.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 39.

```reaction
when RequestBoundary.request (assignment, days, learner, path: "/late-days/staff-change", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
  view "(user) is an active student" with (user: learner)
then
  Banking.change (days, item: assignment, learner)
```

### Course.lateDays.StaffChange:success#2

Authored path: `Course.lateDays.StaffChange`.
- Covered by [Late days](../design/compositions/course/late-days.md), line 19.
- Covered by [Late days](../design/compositions/course/late-days.md), line 39.

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
- Covered by [Late days](../design/compositions/course/late-days.md), line 39.

```reaction
when RequestBoundary.request (assignment, days, learner, path: "/late-days/staff-change", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student records" with (user)
  view "(user) is an active student" with (user: learner)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.notes.Acknowledge:forbidden

Authored path: `Course.notes.Acknowledge`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 17.
- Covered by [Student notes](../design/compositions/course/notes.md), line 27.

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
- Covered by [Student notes](../design/compositions/course/notes.md), line 17.
- Covered by [Student notes](../design/compositions/course/notes.md), line 27.

```reaction
when RequestBoundary.request (note, path: "/students/notes/acknowledge", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) is an active student" with (user)
then
  Noting.acknowledge (at, learner: user, note)
```

### Course.notes.Acknowledge:success#2

Authored path: `Course.notes.Acknowledge`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 17.
- Covered by [Student notes](../design/compositions/course/notes.md), line 27.

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
- Covered by [Student notes](../design/compositions/course/notes.md), line 28.

```reaction
when RequestBoundary.request (note, path: "/students/notes/archive", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student records" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Archive:success

Authored path: `Course.notes.Archive`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 6.
- Covered by [Student notes](../design/compositions/course/notes.md), line 28.

```reaction
when RequestBoundary.request (note, path: "/students/notes/archive", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
then
  Noting.archive (at, note)
```

### Course.notes.Archive:success#2

Authored path: `Course.notes.Archive`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 6.
- Covered by [Student notes](../design/compositions/course/notes.md), line 28.

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
- Covered by [Student notes](../design/compositions/course/notes.md), line 29.

```reaction
when RequestBoundary.request (learner, path: "/students/notes/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student records" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.NotesList:success

Authored path: `Course.notes.NotesList`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 10.
- Covered by [Student notes](../design/compositions/course/notes.md), line 29.

```reaction
when RequestBoundary.request (learner, path: "/students/notes/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
then
  RequestBoundary.respond (notes: former "the staff notes on (learner)" with (learner), requestId)
```

### Course.notes.NotesVisible:forbidden

Authored path: `Course.notes.NotesVisible`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 17.
- Covered by [Student notes](../design/compositions/course/notes.md), line 30.

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
- Covered by [Student notes](../design/compositions/course/notes.md), line 17.
- Covered by [Student notes](../design/compositions/course/notes.md), line 30.

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
- Covered by [Student notes](../design/compositions/course/notes.md), line 31.

```reaction
when RequestBoundary.request (note, path: "/students/notes/resolve", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student records" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Resolve:success

Authored path: `Course.notes.Resolve`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 5.
- Covered by [Student notes](../design/compositions/course/notes.md), line 31.

```reaction
when RequestBoundary.request (note, path: "/students/notes/resolve", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
then
  Noting.resolve (at, note)
```

### Course.notes.Resolve:success#2

Authored path: `Course.notes.Resolve`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 5.
- Covered by [Student notes](../design/compositions/course/notes.md), line 31.

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
- Covered by [Student notes](../design/compositions/course/notes.md), line 32.

```reaction
when RequestBoundary.request (note, path: "/students/notes/restore", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student records" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Restore:success

Authored path: `Course.notes.Restore`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 7.
- Covered by [Student notes](../design/compositions/course/notes.md), line 32.

```reaction
when RequestBoundary.request (note, path: "/students/notes/restore", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
then
  Noting.restore (at, note)
```

### Course.notes.Restore:success#2

Authored path: `Course.notes.Restore`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 7.
- Covered by [Student notes](../design/compositions/course/notes.md), line 32.

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
- Covered by [Student notes](../design/compositions/course/notes.md), line 33.

```reaction
when RequestBoundary.request (body, followUpAt, note, path: "/students/notes/revise", requestId, session, tags, visibility)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student records" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Revise:success

Authored path: `Course.notes.Revise`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 4.
- Covered by [Student notes](../design/compositions/course/notes.md), line 33.

```reaction
when RequestBoundary.request (body, followUpAt, note, path: "/students/notes/revise", requestId, session, tags, visibility)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
then
  Noting.revise (at, body, followUpAt, note, tags, visibility)
```

### Course.notes.Revise:success#2

Authored path: `Course.notes.Revise`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 4.
- Covered by [Student notes](../design/compositions/course/notes.md), line 33.

```reaction
when Noting.revise (at, body, followUpAt, note, tags, visibility), asked by Course.notes.Revise:success
where
  earlier, RequestBoundary.request (body, followUpAt, note, path: "/students/notes/revise", requestId, session, tags, visibility)
then
  RequestBoundary.respond (note, requestId)
```

### Course.notes.StudentsDetail:forbidden

Authored path: `Course.notes.StudentsDetail`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 12.
- Covered by [Student notes](../design/compositions/course/notes.md), line 34.

```reaction
when RequestBoundary.request (path: "/students/detail", requestId, session, user: target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student records" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.StudentsDetail:found

Authored path: `Course.notes.StudentsDetail`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 12.
- Covered by [Student notes](../design/compositions/course/notes.md), line 34.

```reaction
when RequestBoundary.request (path: "/students/detail", requestId, session, user: target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
  view "the seat detail of (user)" with (user: target) has (detail)
  Profiling._getProfileFields (user: target) has (displayName)
then
  RequestBoundary.respond (detail, displayName, requestId)
```

### Course.notes.StudentsDetail:missing

Authored path: `Course.notes.StudentsDetail`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 12.
- Covered by [Student notes](../design/compositions/course/notes.md), line 34.

```reaction
when RequestBoundary.request (path: "/students/detail", requestId, session, user: target)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
  no view "the seat detail of (user)" with (user: target)
then
  RequestBoundary.respond (detail: null, displayName: null, requestId)
```

### Course.notes.Write:forbidden

Authored path: `Course.notes.Write`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 4.
- Covered by [Student notes](../design/compositions/course/notes.md), line 35.

```reaction
when RequestBoundary.request (body, followUpAt, learner, path: "/students/notes/write", requestId, session, tags, visibility)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage student records" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.notes.Write:success

Authored path: `Course.notes.Write`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 4.
- Covered by [Student notes](../design/compositions/course/notes.md), line 35.

```reaction
when RequestBoundary.request (body, followUpAt, learner, path: "/students/notes/write", requestId, session, tags, visibility)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage student records" with (user)
then
  Noting.write (at, author: user, body, followUpAt, learner, tags, visibility)
```

### Course.notes.Write:success#2

Authored path: `Course.notes.Write`.
- Covered by [Student notes](../design/compositions/course/notes.md), line 4.
- Covered by [Student notes](../design/compositions/course/notes.md), line 35.

```reaction
when Noting.write (at, author: user, body, followUpAt, learner, tags, visibility, note), asked by Course.notes.Write:success
where
  earlier, RequestBoundary.request (body, followUpAt, learner, path: "/students/notes/write", requestId, session, tags, visibility)
then
  RequestBoundary.respond (note, requestId)
```

### Course.roster.AddPerson:forbidden

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.AddPerson:new-seat-archived-account

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
  rows is singleImportRow (displayName, email, kind, section)
  no view "the seat at (email)" with (email)
  view "the account at (email)" with (email)
  no view "the live account at (email)" with (email)
then
  Rostering.importSeats (rows)
```

### Course.roster.AddPerson:new-seat-archived-account#2

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when Rostering.importSeats (rows), asked by Course.roster.AddPerson:new-seat-archived-account
where
  earlier, RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
then
  RequestBoundary.respond (account: "ARCHIVED", created: true, requestId)
```

### Course.roster.AddPerson:new-seat-live-account

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
  rows is singleImportRow (displayName, email, kind, section)
  no view "the seat at (email)" with (email)
  view "the live account at (email)" with (email)
then
  Rostering.importSeats (rows)
```

### Course.roster.AddPerson:new-seat-live-account#2

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when Rostering.importSeats (rows), asked by Course.roster.AddPerson:new-seat-live-account
where
  earlier, RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
then
  RequestBoundary.respond (account: "LIVE", created: true, requestId)
```

### Course.roster.AddPerson:new-seat-without-account

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
  rows is singleImportRow (displayName, email, kind, section)
  no view "the seat at (email)" with (email)
  no view "the account at (email)" with (email)
then
  Rostering.importSeats (rows)
```

### Course.roster.AddPerson:new-seat-without-account#2

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when Rostering.importSeats (rows), asked by Course.roster.AddPerson:new-seat-without-account
where
  earlier, RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
then
  RequestBoundary.respond (account: "NONE", created: true, requestId)
```

### Course.roster.AddPerson:seat-already-exists

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
  view "the seat at (email)" with (email)
  no Rostering._getPendingSeatByEmail (email)
then
  RequestBoundary.respond (error: "SEAT_ALREADY_EXISTS", requestId)
```

### Course.roster.AddPerson:standing-seat-archived-account

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
  rows is singleImportRow (displayName, email, kind, section)
  view "the seat at (email)" with (email)
  Rostering._getPendingSeatByEmail (email)
  view "the account at (email)" with (email)
  no view "the live account at (email)" with (email)
then
  Rostering.importSeats (rows)
```

### Course.roster.AddPerson:standing-seat-archived-account#2

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when Rostering.importSeats (rows), asked by Course.roster.AddPerson:standing-seat-archived-account
where
  earlier, RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
then
  RequestBoundary.respond (account: "ARCHIVED", created: false, requestId)
```

### Course.roster.AddPerson:standing-seat-live-account

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
  rows is singleImportRow (displayName, email, kind, section)
  view "the seat at (email)" with (email)
  Rostering._getPendingSeatByEmail (email)
  view "the live account at (email)" with (email)
then
  Rostering.importSeats (rows)
```

### Course.roster.AddPerson:standing-seat-live-account#2

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when Rostering.importSeats (rows), asked by Course.roster.AddPerson:standing-seat-live-account
where
  earlier, RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
then
  RequestBoundary.respond (account: "LIVE", created: false, requestId)
```

### Course.roster.AddPerson:standing-seat-without-account

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
  rows is singleImportRow (displayName, email, kind, section)
  view "the seat at (email)" with (email)
  Rostering._getPendingSeatByEmail (email)
  no view "the account at (email)" with (email)
then
  Rostering.importSeats (rows)
```

### Course.roster.AddPerson:standing-seat-without-account#2

Authored path: `Course.roster.AddPerson`.
- Covered by [Roster](../design/compositions/course/roster.md), line 97.
- Covered by [Roster](../design/compositions/course/roster.md), line 226.

```reaction
when Rostering.importSeats (rows), asked by Course.roster.AddPerson:standing-seat-without-account
where
  earlier, RequestBoundary.request (displayName, email, kind, path: "/roster/add-person", requestId, section, session)
then
  RequestBoundary.respond (account: "NONE", created: false, requestId)
```

### Course.roster.ClaimedInvitationClaimsItsSeat

Authored path: `Course.roster.ClaimedInvitationClaimsItsSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 51.

```reaction
when Inviting.claim (user, address, channel: "email")
where
  Rostering._getPendingSeatByEmail (email: address) has (seat)
then
  Rostering.claimSeat (seat, user)
```

### Course.roster.ClassConfiguration:absent

Authored path: `Course.roster.ClassConfiguration`.
- Covered by [Roster](../design/compositions/course/roster.md), line 6.
- Covered by [Roster](../design/compositions/course/roster.md), line 227.

```reaction
when RequestBoundary.request (path: "/roster/class", requestId, session)
where
  view "the active user of (session)" with (session)
  no view "the class configuration ()"
then
  RequestBoundary.respond (class: null, requestId)
```

### Course.roster.ClassConfiguration:found

Authored path: `Course.roster.ClassConfiguration`.
- Covered by [Roster](../design/compositions/course/roster.md), line 6.
- Covered by [Roster](../design/compositions/course/roster.md), line 227.

```reaction
when RequestBoundary.request (path: "/roster/class", requestId, session)
where
  view "the active user of (session)" with (session)
  view "the class configuration ()" has (detail)
then
  RequestBoundary.respond (class: detail, requestId)
```

### Course.roster.ConfigureClass:forbidden

Authored path: `Course.roster.ConfigureClass`.
- Covered by [Roster](../design/compositions/course/roster.md), line 4.
- Covered by [Roster](../design/compositions/course/roster.md), line 228.

```reaction
when RequestBoundary.request (code, path: "/roster/configure-class", requestId, session, term, timezone, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.ConfigureClass:success

Authored path: `Course.roster.ConfigureClass`.
- Covered by [Roster](../design/compositions/course/roster.md), line 4.
- Covered by [Roster](../design/compositions/course/roster.md), line 228.

```reaction
when RequestBoundary.request (code, path: "/roster/configure-class", requestId, session, term, timezone, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Rostering.configureClass (code, term, timezone, title)
```

### Course.roster.ConfigureClass:success#2

Authored path: `Course.roster.ConfigureClass`.
- Covered by [Roster](../design/compositions/course/roster.md), line 4.
- Covered by [Roster](../design/compositions/course/roster.md), line 228.

```reaction
when Rostering.configureClass (code, term, timezone, title, class), asked by Course.roster.ConfigureClass:success
where
  earlier, RequestBoundary.request (code, path: "/roster/configure-class", requestId, session, term, timezone, title)
then
  RequestBoundary.respond (class, requestId)
```

### Course.roster.DropSeat:forbidden

Authored path: `Course.roster.DropSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 182.
- Covered by [Roster](../design/compositions/course/roster.md), line 229.

```reaction
when RequestBoundary.request (path: "/roster/drop", requestId, seat, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.DropSeat:success

Authored path: `Course.roster.DropSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 182.
- Covered by [Roster](../design/compositions/course/roster.md), line 229.

```reaction
when RequestBoundary.request (path: "/roster/drop", requestId, seat, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Rostering.dropSeat (seat)
```

### Course.roster.DropSeat:success#2

Authored path: `Course.roster.DropSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 182.
- Covered by [Roster](../design/compositions/course/roster.md), line 229.

```reaction
when Rostering.dropSeat (seat, result.seat: dropped), asked by Course.roster.DropSeat:success
where
  earlier, RequestBoundary.request (path: "/roster/drop", requestId, seat, session)
then
  RequestBoundary.respond (requestId, seat: dropped)
```

### Course.roster.DroppedRoster:forbidden

Authored path: `Course.roster.DroppedRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 178.
- Covered by [Roster](../design/compositions/course/roster.md), line 230.

```reaction
when RequestBoundary.request (path: "/roster/dropped", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.DroppedRoster:success

Authored path: `Course.roster.DroppedRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 178.
- Covered by [Roster](../design/compositions/course/roster.md), line 230.

```reaction
when RequestBoundary.request (path: "/roster/dropped", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  RequestBoundary.respond (members: former "the dropped roster ()", requestId)
```

### Course.roster.Enrol:forbidden

Authored path: `Course.roster.Enrol`.
- Covered by [Roster](../design/compositions/course/roster.md), line 84.
- Covered by [Roster](../design/compositions/course/roster.md), line 231.

```reaction
when RequestBoundary.request (email, kind, path: "/roster/enroll", requestId, section, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may not manage the course" with (user: actor)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.Enrol:success

Authored path: `Course.roster.Enrol`.
- Covered by [Roster](../design/compositions/course/roster.md), line 84.
- Covered by [Roster](../design/compositions/course/roster.md), line 231.

```reaction
when RequestBoundary.request (email, kind, path: "/roster/enroll", requestId, section, session, user)
where
  view "the active user of (session)" with (session) has (user: actor)
  view "(user) may manage the course" with (user: actor)
then
  Rostering.enrol (email, kind, section, user)
```

### Course.roster.Enrol:success#2

Authored path: `Course.roster.Enrol`.
- Covered by [Roster](../design/compositions/course/roster.md), line 84.
- Covered by [Roster](../design/compositions/course/roster.md), line 231.

```reaction
when Rostering.enrol (email, kind, section, user, seat), asked by Course.roster.Enrol:success
where
  earlier, RequestBoundary.request (email, kind, path: "/roster/enroll", requestId, section, session, user)
then
  RequestBoundary.respond (requestId, seat)
```

### Course.roster.ImportPreview

Authored path: `Course.roster.ImportPreview`.
- Covered by [Roster](../design/compositions/course/roster.md), line 17.
- Covered by [Roster](../design/compositions/course/roster.md), line 232.

```reaction
when RequestBoundary.request (csv, path: "/roster/import-preview", requestId)
then
  Rostering.previewImport (csv)
```

### Course.roster.ImportPreview#2

Authored path: `Course.roster.ImportPreview`.
- Covered by [Roster](../design/compositions/course/roster.md), line 17.
- Covered by [Roster](../design/compositions/course/roster.md), line 232.

```reaction
when Rostering.previewImport (csv, rows), asked by Course.roster.ImportPreview
where
  earlier, RequestBoundary.request (csv, path: "/roster/import-preview", requestId)
then
  RequestBoundary.respond (requestId, rows)
```

### Course.roster.ImportSeats:forbidden

Authored path: `Course.roster.ImportSeats`.
- Covered by [Roster](../design/compositions/course/roster.md), line 19.
- Covered by [Roster](../design/compositions/course/roster.md), line 233.

```reaction
when RequestBoundary.request (path: "/roster/import", requestId, rows, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.ImportSeats:success

Authored path: `Course.roster.ImportSeats`.
- Covered by [Roster](../design/compositions/course/roster.md), line 19.
- Covered by [Roster](../design/compositions/course/roster.md), line 233.

```reaction
when RequestBoundary.request (path: "/roster/import", requestId, rows, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Rostering.importSeats (rows)
```

### Course.roster.ImportSeats:success#2

Authored path: `Course.roster.ImportSeats`.
- Covered by [Roster](../design/compositions/course/roster.md), line 19.
- Covered by [Roster](../design/compositions/course/roster.md), line 233.

```reaction
when Rostering.importSeats (rows, created, skipped), asked by Course.roster.ImportSeats:success
where
  earlier, RequestBoundary.request (path: "/roster/import", requestId, rows, session)
then
  RequestBoundary.respond (created, requestId, skipped)
```

### Course.roster.ImportedSeatClaimsItsAccount

Authored path: `Course.roster.ImportedSeatClaimsItsAccount`.
- Covered by [Roster](../design/compositions/course/roster.md), line 33.

```reaction
when Rostering.importSeats ()
where
  Rostering._getUnclaimedSeats () has (email, seat)
  view "the live account at (email)" with (email) has (user)
then
  Rostering.claimSeat (seat, user)
```

### Course.roster.ImportedSeatInvitesItsAddress

Authored path: `Course.roster.ImportedSeatInvitesItsAddress`.
- Covered by [Roster](../design/compositions/course/roster.md), line 43.

```reaction
when Rostering.importSeats ()
where
  at is the current flow's instant
  Rostering._getUnclaimedSeats () has (email)
  no view "the account at (email)" with (email)
  no view "the invitation for (address)" with (address: email)
then
  Inviting.invite (address: email, at, channel: "email")
```

### Course.roster.MoveSection:forbidden

Authored path: `Course.roster.MoveSection`.
- Covered by [Roster](../design/compositions/course/roster.md), line 184.
- Covered by [Roster](../design/compositions/course/roster.md), line 234.

```reaction
when RequestBoundary.request (path: "/roster/move-section", requestId, seat, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.MoveSection:success

Authored path: `Course.roster.MoveSection`.
- Covered by [Roster](../design/compositions/course/roster.md), line 184.
- Covered by [Roster](../design/compositions/course/roster.md), line 234.

```reaction
when RequestBoundary.request (path: "/roster/move-section", requestId, seat, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Rostering.moveSection (seat, section)
```

### Course.roster.MoveSection:success#2

Authored path: `Course.roster.MoveSection`.
- Covered by [Roster](../design/compositions/course/roster.md), line 184.
- Covered by [Roster](../design/compositions/course/roster.md), line 234.

```reaction
when Rostering.moveSection (seat, section, result.seat: moved), asked by Course.roster.MoveSection:success
where
  earlier, RequestBoundary.request (path: "/roster/move-section", requestId, seat, section, session)
then
  RequestBoundary.respond (requestId, seat: moved)
```

### Course.roster.PendingRoster:forbidden

Authored path: `Course.roster.PendingRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 172.
- Covered by [Roster](../design/compositions/course/roster.md), line 235.

```reaction
when RequestBoundary.request (path: "/roster/pending", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.PendingRoster:success

Authored path: `Course.roster.PendingRoster`.
- Covered by [Roster](../design/compositions/course/roster.md), line 172.
- Covered by [Roster](../design/compositions/course/roster.md), line 235.

```reaction
when RequestBoundary.request (path: "/roster/pending", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  RequestBoundary.respond (members: former "the pending roster ()", requestId)
```

### Course.roster.ReinstateSeat:forbidden

Authored path: `Course.roster.ReinstateSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 183.
- Covered by [Roster](../design/compositions/course/roster.md), line 236.

```reaction
when RequestBoundary.request (path: "/roster/reinstate", requestId, seat, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.ReinstateSeat:success

Authored path: `Course.roster.ReinstateSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 183.
- Covered by [Roster](../design/compositions/course/roster.md), line 236.

```reaction
when RequestBoundary.request (path: "/roster/reinstate", requestId, seat, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Rostering.reinstateSeat (seat)
```

### Course.roster.ReinstateSeat:success#2

Authored path: `Course.roster.ReinstateSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 183.
- Covered by [Roster](../design/compositions/course/roster.md), line 236.

```reaction
when Rostering.reinstateSeat (seat, result.seat: reinstated), asked by Course.roster.ReinstateSeat:success
where
  earlier, RequestBoundary.request (path: "/roster/reinstate", requestId, seat, session)
then
  RequestBoundary.respond (requestId, seat: reinstated)
```

### Course.roster.RemoveSeat:forbidden

Authored path: `Course.roster.RemoveSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 186.
- Covered by [Roster](../design/compositions/course/roster.md), line 237.

```reaction
when RequestBoundary.request (path: "/roster/remove", requestId, seat, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.RemoveSeat:success

Authored path: `Course.roster.RemoveSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 186.
- Covered by [Roster](../design/compositions/course/roster.md), line 237.

```reaction
when RequestBoundary.request (path: "/roster/remove", requestId, seat, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Rostering.removeSeat (seat)
```

### Course.roster.RemoveSeat:success#2

Authored path: `Course.roster.RemoveSeat`.
- Covered by [Roster](../design/compositions/course/roster.md), line 186.
- Covered by [Roster](../design/compositions/course/roster.md), line 237.

```reaction
when Rostering.removeSeat (seat, email, result.seat: removed), asked by Course.roster.RemoveSeat:success
where
  earlier, RequestBoundary.request (path: "/roster/remove", requestId, seat, session)
then
  RequestBoundary.respond (email, requestId, seat: removed)
```

### Course.roster.RosterList:forbidden

Authored path: `Course.roster.RosterList`.
- Covered by [Roster](../design/compositions/course/roster.md), line 170.
- Covered by [Roster](../design/compositions/course/roster.md), line 238.

```reaction
when RequestBoundary.request (path: "/roster/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.RosterList:success

Authored path: `Course.roster.RosterList`.
- Covered by [Roster](../design/compositions/course/roster.md), line 170.
- Covered by [Roster](../design/compositions/course/roster.md), line 238.

```reaction
when RequestBoundary.request (path: "/roster/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  RequestBoundary.respond (members: former "the roster ()", requestId)
```

### Course.roster.RosterMe:absent

Authored path: `Course.roster.RosterMe`.
- Covered by [Roster](../design/compositions/course/roster.md), line 169.
- Covered by [Roster](../design/compositions/course/roster.md), line 239.

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
- Covered by [Roster](../design/compositions/course/roster.md), line 169.
- Covered by [Roster](../design/compositions/course/roster.md), line 239.

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
- Covered by [Roster](../design/compositions/course/roster.md), line 13.
- Covered by [Roster](../design/compositions/course/roster.md), line 240.

```reaction
when RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/create", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.SectionsCreate:success

Authored path: `Course.roster.SectionsCreate`.
- Covered by [Roster](../design/compositions/course/roster.md), line 13.
- Covered by [Roster](../design/compositions/course/roster.md), line 240.

```reaction
when RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/create", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Rostering.createSection (location, meetingPattern, name)
```

### Course.roster.SectionsCreate:success#2

Authored path: `Course.roster.SectionsCreate`.
- Covered by [Roster](../design/compositions/course/roster.md), line 13.
- Covered by [Roster](../design/compositions/course/roster.md), line 240.

```reaction
when Rostering.createSection (location, meetingPattern, name, section), asked by Course.roster.SectionsCreate:success
where
  earlier, RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/create", requestId, session)
then
  RequestBoundary.respond (requestId, section)
```

### Course.roster.SectionsList

Authored path: `Course.roster.SectionsList`.
- Covered by [Roster](../design/compositions/course/roster.md), line 11.
- Covered by [Roster](../design/compositions/course/roster.md), line 241.

```reaction
when RequestBoundary.request (path: "/roster/sections/list", requestId)
then
  RequestBoundary.respond (requestId, sections: former "the sections ()")
```

### Course.roster.SectionsUpdate:forbidden

Authored path: `Course.roster.SectionsUpdate`.
- Covered by [Roster](../design/compositions/course/roster.md), line 14.
- Covered by [Roster](../design/compositions/course/roster.md), line 242.

```reaction
when RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/update", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.SectionsUpdate:success

Authored path: `Course.roster.SectionsUpdate`.
- Covered by [Roster](../design/compositions/course/roster.md), line 14.
- Covered by [Roster](../design/compositions/course/roster.md), line 242.

```reaction
when RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/update", requestId, section, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Rostering.updateSection (location, meetingPattern, name, section)
```

### Course.roster.SectionsUpdate:success#2

Authored path: `Course.roster.SectionsUpdate`.
- Covered by [Roster](../design/compositions/course/roster.md), line 14.
- Covered by [Roster](../design/compositions/course/roster.md), line 242.

```reaction
when Rostering.updateSection (location, meetingPattern, name, section, result.section: updated), asked by Course.roster.SectionsUpdate:success
where
  earlier, RequestBoundary.request (location, meetingPattern, name, path: "/roster/sections/update", requestId, section, session)
then
  RequestBoundary.respond (requestId, section: updated)
```

### Course.roster.UpdateClass:forbidden

Authored path: `Course.roster.UpdateClass`.
- Covered by [Roster](../design/compositions/course/roster.md), line 7.
- Covered by [Roster](../design/compositions/course/roster.md), line 243.

```reaction
when RequestBoundary.request (code, path: "/roster/update-class", requestId, session, term, timezone, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not manage the course" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.roster.UpdateClass:success

Authored path: `Course.roster.UpdateClass`.
- Covered by [Roster](../design/compositions/course/roster.md), line 7.
- Covered by [Roster](../design/compositions/course/roster.md), line 243.

```reaction
when RequestBoundary.request (code, path: "/roster/update-class", requestId, session, term, timezone, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may manage the course" with (user)
then
  Rostering.updateClass (code, term, timezone, title)
```

### Course.roster.UpdateClass:success#2

Authored path: `Course.roster.UpdateClass`.
- Covered by [Roster](../design/compositions/course/roster.md), line 7.
- Covered by [Roster](../design/compositions/course/roster.md), line 243.

```reaction
when Rostering.updateClass (code, term, timezone, title, class), asked by Course.roster.UpdateClass:success
where
  earlier, RequestBoundary.request (code, path: "/roster/update-class", requestId, session, term, timezone, title)
then
  RequestBoundary.respond (class, requestId)
```

### Course.submissions.Attempts:attempts

Authored path: `Course.submissions.Attempts`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 6.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 24.

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
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 24.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/attempts", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.Attempts:attempts-missing

Authored path: `Course.submissions.Attempts`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 6.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 24.

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
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 24.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/attempts", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may grade" with (user)
  view "(user) is an active student" with (user: submitter)
then
  RequestBoundary.respond (attempts: former "the attempts for (assignment) by (submitter)" with (assignment, submitter), requestId)
```

### Course.submissions.ForAssignment:forbidden

Authored path: `Course.submissions.ForAssignment`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 14.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 25.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/for-assignment", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Course.submissions.ForAssignment:success

Authored path: `Course.submissions.ForAssignment`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 14.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 25.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/for-assignment", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may grade" with (user)
then
  RequestBoundary.respond (assigned: former "the assigned population for (assignment)" with (assignment), requestId, submissions: former "the submissions for (assignment)" with (assignment))
```

### Course.submissions.ForStudent:for-student

Authored path: `Course.submissions.ForStudent`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 12.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 26.

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
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 26.

```reaction
when RequestBoundary.request (path: "/submissions/for-student", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.ForStudent:for-student-missing

Authored path: `Course.submissions.ForStudent`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 12.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 26.

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
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 26.

```reaction
when RequestBoundary.request (path: "/submissions/for-student", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may grade" with (user)
  view "(user) is an active student" with (user: submitter)
then
  RequestBoundary.respond (requestId, submissions: former "the submissions by (submitter)" with (submitter))
```

### Course.submissions.Latest:latest-hidden

Authored path: `Course.submissions.Latest`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 5.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 27.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/latest", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may not grade" with (user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Course.submissions.Latest:latest-missing

Authored path: `Course.submissions.Latest`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 5.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 27.

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
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 27.

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
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 27.

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
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 27.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/latest", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may grade" with (user)
  view "(user) is an active student" with (user: submitter)
  view "the latest submission for (assignment) by (submitter)" with (assignment, submitter) has (latest)
then
  RequestBoundary.respond (requestId, submission: latest)
```

### Course.submissions.Latest:staff-missing

Authored path: `Course.submissions.Latest`.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 5.
- Covered by [Submission reads](../design/compositions/course/submissions.md), line 27.

```reaction
when RequestBoundary.request (assignment, path: "/submissions/latest", requestId, session, submitter)
where
  view "the active user of (session)" with (session) has (user) and not (user: submitter)
  view "(user) may grade" with (user)
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
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 23.

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
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 23.

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
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 24.

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
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 25.

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
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 25.

```reaction
when RequestBoundary.request (item, path: "/bookmarks/save", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(post) is readable" with (post: item)
then
  Bookmarking.save (at, item, user)
```

### Forum.bookmarks.SaveBookmark:success#2

Authored path: `Forum.bookmarks.SaveBookmark`.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 4.
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 25.

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
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 26.

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
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 26.

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
- Covered by [Bookmarks](../design/compositions/forum/bookmarks.md), line 26.

```reaction
when Bookmarking.unsave (item, user, bookmark), asked by Forum.bookmarks.UnsaveBookmark:success
where
  earlier, RequestBoundary.request (item, path: "/bookmarks/unsave", requestId, session)
then
  RequestBoundary.respond (bookmark, requestId)
```

### Forum.categories.AssignCategory:forbidden

Authored path: `Forum.categories.AssignCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 7.
- Covered by [Categories](../design/compositions/forum/categories.md), line 26.

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
- Covered by [Categories](../design/compositions/forum/categories.md), line 7.
- Covered by [Categories](../design/compositions/forum/categories.md), line 26.

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
- Covered by [Categories](../design/compositions/forum/categories.md), line 7.
- Covered by [Categories](../design/compositions/forum/categories.md), line 26.

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
- Covered by [Categories](../design/compositions/forum/categories.md), line 7.
- Covered by [Categories](../design/compositions/forum/categories.md), line 26.

```reaction
when Categorizing.assign (category, item, result.item: assigned), asked by Forum.categories.AssignCategory:success
where
  earlier, RequestBoundary.request (category, item, path: "/categories/assign", requestId, session)
then
  RequestBoundary.respond (item: assigned, requestId)
```

### Forum.categories.CategoryForItem:hidden

Authored path: `Forum.categories.CategoryForItem`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 16.
- Covered by [Categories](../design/compositions/forum/categories.md), line 27.

```reaction
when RequestBoundary.request (item, path: "/categories/forItem", requestId)
where
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.categories.CategoryForItem:success

Authored path: `Forum.categories.CategoryForItem`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 16.
- Covered by [Categories](../design/compositions/forum/categories.md), line 27.

```reaction
when RequestBoundary.request (item, path: "/categories/forItem", requestId)
where
  view "(post) is readable" with (post: item)
then
  RequestBoundary.respond (category: former "the category of (item)" with (item), requestId)
```

### Forum.categories.CategoryItems

Authored path: `Forum.categories.CategoryItems`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 14.
- Covered by [Categories](../design/compositions/forum/categories.md), line 28.

```reaction
when RequestBoundary.request (category, path: "/categories/items", requestId)
then
  RequestBoundary.respond (items: former "the items in (category)" with (category), requestId)
```

### Forum.categories.CreateCategory:forbidden

Authored path: `Forum.categories.CreateCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 4.
- Covered by [Categories](../design/compositions/forum/categories.md), line 29.

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
- Covered by [Categories](../design/compositions/forum/categories.md), line 29.

```reaction
when RequestBoundary.request (description, name, path: "/categories/create", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may administer" with (user)
then
  Categorizing.createCategory (description, name, scope: "forum")
```

### Forum.categories.CreateCategory:success#2

Authored path: `Forum.categories.CreateCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 4.
- Covered by [Categories](../design/compositions/forum/categories.md), line 29.

```reaction
when Categorizing.createCategory (description, name, scope: "forum", category), asked by Forum.categories.CreateCategory:success
where
  earlier, RequestBoundary.request (description, name, path: "/categories/create", requestId, session)
then
  RequestBoundary.respond (category, requestId)
```

### Forum.categories.DeleteCategory:forbidden

Authored path: `Forum.categories.DeleteCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 4.
- Covered by [Categories](../design/compositions/forum/categories.md), line 30.

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
- Covered by [Categories](../design/compositions/forum/categories.md), line 30.

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
- Covered by [Categories](../design/compositions/forum/categories.md), line 30.

```reaction
when Categorizing.deleteCategory (category, result.category: deleted), asked by Forum.categories.DeleteCategory:success
where
  earlier, RequestBoundary.request (category, path: "/categories/delete", requestId, session)
then
  RequestBoundary.respond (category: deleted, requestId)
```

### Forum.categories.ListCategories

Authored path: `Forum.categories.ListCategories`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 12.
- Covered by [Categories](../design/compositions/forum/categories.md), line 31.

```reaction
when RequestBoundary.request (path: "/categories/list", requestId)
then
  RequestBoundary.respond (categories: former "the categories ()", requestId)
```

### Forum.categories.PurgeUnassignsCategory

Authored path: `Forum.categories.PurgeUnassignsCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 20.

```reaction
when Trashing.purge (item)
where
  Categorizing._getCategory (item)
then
  Categorizing.unassign (item)
```

### Forum.categories.UnassignCategory:forbidden

Authored path: `Forum.categories.UnassignCategory`.
- Covered by [Categories](../design/compositions/forum/categories.md), line 8.
- Covered by [Categories](../design/compositions/forum/categories.md), line 32.

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
- Covered by [Categories](../design/compositions/forum/categories.md), line 8.
- Covered by [Categories](../design/compositions/forum/categories.md), line 32.

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
- Covered by [Categories](../design/compositions/forum/categories.md), line 8.
- Covered by [Categories](../design/compositions/forum/categories.md), line 32.

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
- Covered by [Categories](../design/compositions/forum/categories.md), line 8.
- Covered by [Categories](../design/compositions/forum/categories.md), line 32.

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
- Covered by [Feeds and thread context](../design/compositions/forum/feed.md), line 26.

```reaction
when RequestBoundary.request (conversation, path: "/threads/get", requestId)
then
  RequestBoundary.respond (context: former "the thread context (conversation)" with (conversation), requestId, thread: former "the thread (conversation)" with (conversation))
```

### Forum.feed.ListActivity

Authored path: `Forum.feed.ListActivity`.
- Covered by [Feeds and thread context](../design/compositions/forum/feed.md), line 5.
- Covered by [Feeds and thread context](../design/compositions/forum/feed.md), line 27.

```reaction
when RequestBoundary.request (path: "/threads/activity", requestId)
then
  RequestBoundary.respond (conversations: former "the home feed by activity ()", requestId)
```

### Forum.feed.ListLatest

Authored path: `Forum.feed.ListLatest`.
- Covered by [Feeds and thread context](../design/compositions/forum/feed.md), line 3.
- Covered by [Feeds and thread context](../design/compositions/forum/feed.md), line 28.

```reaction
when RequestBoundary.request (path: "/threads/latest", requestId)
then
  RequestBoundary.respond (conversations: former "the home feed by creation ()", requestId)
```

### Forum.links.Backlinks:hidden

Authored path: `Forum.links.Backlinks`.
- Covered by [Post links](../design/compositions/forum/links.md), line 9.
- Covered by [Post links](../design/compositions/forum/links.md), line 20.

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
- Covered by [Post links](../design/compositions/forum/links.md), line 20.

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
- Covered by [Post links](../design/compositions/forum/links.md), line 21.

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
- Covered by [Post links](../design/compositions/forum/links.md), line 21.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 39.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 39.

```reaction
when RequestBoundary.request (path: "/flags/raise", reason, requestId, session, target)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(post) is readable" with (post: target)
then
  Flagging.flag (at, reason, reporter: user, target)
```

### Forum.moderation.FlagRaise:success#2

Authored path: `Forum.moderation.FlagRaise`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 27.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 39.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 40.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 40.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 40.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 40.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 41.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 41.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 41.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 42.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 42.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 43.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 43.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 43.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 43.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 44.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 44.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 45.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 45.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 46.

```reaction
when RequestBoundary.request (path: "/locks/list", requestId)
then
  RequestBoundary.respond (locked: former "the locked list ()", requestId)
```

### Forum.moderation.LockTarget:forbidden

Authored path: `Forum.moderation.LockTarget`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 18.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 47.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 47.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 47.

```reaction
when RequestBoundary.request (path: "/locks/lock", requestId, session, target)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(target) is public" with (target)
then
  Locking.lock (at, target)
```

### Forum.moderation.LockTarget:success#2

Authored path: `Forum.moderation.LockTarget`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 18.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 47.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 48.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 48.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 48.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 49.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 49.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 49.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 50.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 50.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 50.

```reaction
when RequestBoundary.request (item, path: "/trash/trash", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  Posting._getPost (post: item)
then
  Trashing.trash (at, by: user, item)
```

### Forum.moderation.TrashItem:success#2

Authored path: `Forum.moderation.TrashItem`.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 4.
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 50.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 51.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 51.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 52.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 52.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 52.

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
- Covered by [Moderation](../design/compositions/forum/moderation.md), line 52.

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
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 50.

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
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 50.

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
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 51.

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
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 52.

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
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 52.

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
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 53.

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
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 53.

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
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 54.

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
- Covered by [Notifications](../design/compositions/forum/notifications.md), line 55.

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
- Covered by [Pins](../design/compositions/forum/pins.md), line 22.

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
- Covered by [Pins](../design/compositions/forum/pins.md), line 22.

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
- Covered by [Pins](../design/compositions/forum/pins.md), line 23.

```reaction
when RequestBoundary.request (item, path: "/pins/pin", priority, requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.pins.PinItem:hidden

Authored path: `Forum.pins.PinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.
- Covered by [Pins](../design/compositions/forum/pins.md), line 23.

```reaction
when RequestBoundary.request (item, path: "/pins/pin", priority, requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.pins.PinItem:success

Authored path: `Forum.pins.PinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.
- Covered by [Pins](../design/compositions/forum/pins.md), line 23.

```reaction
when RequestBoundary.request (item, path: "/pins/pin", priority, requestId, scope, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is readable" with (post: item)
then
  Pinning.pin (at, item, priority, scope)
```

### Forum.pins.PinItem:success#2

Authored path: `Forum.pins.PinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.
- Covered by [Pins](../design/compositions/forum/pins.md), line 23.

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
- Covered by [Pins](../design/compositions/forum/pins.md), line 24.

```reaction
when RequestBoundary.request (path: "/pins/forScope", requestId, scope)
then
  RequestBoundary.respond (pinned: former "the pins of (scope)" with (scope), requestId)
```

### Forum.pins.PurgeClearsPins

Authored path: `Forum.pins.PurgeClearsPins`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 16.

```reaction
when Trashing.purge (item)
then
  Pinning.clearItem (item)
```

### Forum.pins.SetPinPriority:forbidden

Authored path: `Forum.pins.SetPinPriority`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 5.
- Covered by [Pins](../design/compositions/forum/pins.md), line 25.

```reaction
when RequestBoundary.request (item, path: "/pins/setPriority", priority, requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.pins.SetPinPriority:hidden

Authored path: `Forum.pins.SetPinPriority`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 5.
- Covered by [Pins](../design/compositions/forum/pins.md), line 25.

```reaction
when RequestBoundary.request (item, path: "/pins/setPriority", priority, requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.pins.SetPinPriority:success

Authored path: `Forum.pins.SetPinPriority`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 5.
- Covered by [Pins](../design/compositions/forum/pins.md), line 25.

```reaction
when RequestBoundary.request (item, path: "/pins/setPriority", priority, requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is readable" with (post: item)
then
  Pinning.setPriority (item, priority, scope)
```

### Forum.pins.SetPinPriority:success#2

Authored path: `Forum.pins.SetPinPriority`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 5.
- Covered by [Pins](../design/compositions/forum/pins.md), line 25.

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
- Covered by [Pins](../design/compositions/forum/pins.md), line 26.

```reaction
when RequestBoundary.request (item, path: "/pins/unpin", requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not moderate" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Forum.pins.UnpinItem:hidden

Authored path: `Forum.pins.UnpinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.
- Covered by [Pins](../design/compositions/forum/pins.md), line 26.

```reaction
when RequestBoundary.request (item, path: "/pins/unpin", requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is not readable" with (post: item)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.pins.UnpinItem:success

Authored path: `Forum.pins.UnpinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.
- Covered by [Pins](../design/compositions/forum/pins.md), line 26.

```reaction
when RequestBoundary.request (item, path: "/pins/unpin", requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may moderate" with (user)
  view "(post) is readable" with (post: item)
then
  Pinning.unpin (item, scope)
```

### Forum.pins.UnpinItem:success#2

Authored path: `Forum.pins.UnpinItem`.
- Covered by [Pins](../design/compositions/forum/pins.md), line 4.
- Covered by [Pins](../design/compositions/forum/pins.md), line 26.

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
- Covered by [Posts](../design/compositions/forum/posts.md), line 37.

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
- Covered by [Posts](../design/compositions/forum/posts.md), line 37.

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
- Covered by [Posts](../design/compositions/forum/posts.md), line 37.

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
- Covered by [Posts](../design/compositions/forum/posts.md), line 37.

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
- Covered by [Posts](../design/compositions/forum/posts.md), line 37.

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
- Covered by [Posts](../design/compositions/forum/posts.md), line 37.

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
- Covered by [Posts](../design/compositions/forum/posts.md), line 38.

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
- Covered by [Posts](../design/compositions/forum/posts.md), line 38.

```reaction
when RequestBoundary.request (content, path: "/posts/edit", post, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may edit (post)" with (post, user)
then
  Posting.edit (at, content, post)
```

### Forum.posts.EditPost:post#2

Authored path: `Forum.posts.EditPost`.
- Covered by [Posts](../design/compositions/forum/posts.md), line 10.
- Covered by [Posts](../design/compositions/forum/posts.md), line 38.

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
- Covered by [Posts](../design/compositions/forum/posts.md), line 38.

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
- Covered by [Posts](../design/compositions/forum/posts.md), line 38.

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
- Covered by [Posts](../design/compositions/forum/posts.md), line 39.

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
- Covered by [Posts](../design/compositions/forum/posts.md), line 39.

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
- Covered by [Posts](../design/compositions/forum/posts.md), line 40.

```reaction
when RequestBoundary.request (author, path: "/posts/byAuthor", requestId)
then
  RequestBoundary.respond (posts: former "the public posts of (author)" with (author), requestId)
```

### Forum.profiles.GetProfile:hidden

Authored path: `Forum.profiles.GetProfile`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 3.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 42.

```reaction
when RequestBoundary.request (path: "/profiles/get", requestId, session, user)
where
  view "the active user of (session)" with (session) has (user: reader)
  no view "(user) is an active course member" with (user: reader)
  view "(user) may not manage the course" with (user: reader)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.profiles.GetProfile:member

Authored path: `Forum.profiles.GetProfile`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 3.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 42.

```reaction
when RequestBoundary.request (path: "/profiles/get", requestId, session, user)
where
  view "the active user of (session)" with (session) has (user: reader) and not (user)
  view "(user) is an active course member" with (user: reader)
  view "(user) may not manage the course" with (user: reader)
  view "the profile of (user)" with (user)
then
  RequestBoundary.respond (profile: former "the profile face of (user)" with (user), requestId)
```

### Forum.profiles.GetProfile:missing

Authored path: `Forum.profiles.GetProfile`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 3.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 42.

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
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 42.

```reaction
when RequestBoundary.request (path: "/profiles/get", requestId, session, user)
where
  view "the active user of (session)" with (session) has (user: reader) and not (user)
  view "(user) may manage the course" with (user: reader)
  view "the profile of (user)" with (user)
then
  RequestBoundary.respond (profile: former "the private profile of (user)" with (user), requestId)
```

### Forum.profiles.GetProfile:success

Authored path: `Forum.profiles.GetProfile`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 3.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 42.

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
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 32.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 43.

```reaction
when RequestBoundary.request (path: "/users/resolve", ref, requestId)
where
  Authenticating._resolveIdentity (ref) has (user, username)
then
  RequestBoundary.respond (requestId, user, username)
```

### Forum.profiles.SearchUsers:hidden

Authored path: `Forum.profiles.SearchUsers`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 30.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 44.

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
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 30.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 44.

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
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 26.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 45.

```reaction
when RequestBoundary.request (avatar, path: "/profiles/setAvatar", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Profiling.setAvatar (avatar, user)
```

### Forum.profiles.SetAvatar#2

Authored path: `Forum.profiles.SetAvatar`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 26.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 45.

```reaction
when Profiling.setAvatar (avatar, user), asked by Forum.profiles.SetAvatar
where
  earlier, RequestBoundary.request (avatar, path: "/profiles/setAvatar", requestId, session)
then
  RequestBoundary.respond (requestId, user)
```

### Forum.profiles.SetBio

Authored path: `Forum.profiles.SetBio`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 25.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 46.

```reaction
when RequestBoundary.request (bio, path: "/profiles/setBio", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Profiling.setBio (bio, user)
```

### Forum.profiles.SetBio#2

Authored path: `Forum.profiles.SetBio`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 25.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 46.

```reaction
when Profiling.setBio (bio, user), asked by Forum.profiles.SetBio
where
  earlier, RequestBoundary.request (bio, path: "/profiles/setBio", requestId, session)
then
  RequestBoundary.respond (requestId, user)
```

### Forum.profiles.SetDisplayName

Authored path: `Forum.profiles.SetDisplayName`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 25.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 47.

```reaction
when RequestBoundary.request (displayName, path: "/profiles/setDisplayName", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  Profiling.setDisplayName (displayName, user)
```

### Forum.profiles.SetDisplayName#2

Authored path: `Forum.profiles.SetDisplayName`.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 25.
- Covered by [Profiles and public identity](../design/compositions/forum/profiles.md), line 47.

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
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 20.

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
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 20.

```reaction
when RequestBoundary.request (kind, path: "/reactions/add", requestId, session, target)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(post) is readable" with (post: target)
then
  Reacting.react (at, kind, reactor: user, target)
```

### Forum.reactions.AddReaction:success#2

Authored path: `Forum.reactions.AddReaction`.
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 4.
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 20.

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
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 21.

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
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 21.

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
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 22.

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
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 22.

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
- Covered by [Post reactions](../design/compositions/forum/reactions.md), line 22.

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
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 24.

```reaction
when RequestBoundary.request (answer, path: "/resolutions/accept", question, requestId, session)
where
  at is the current flow's instant
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
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 24.

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
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 24.

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
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 24.

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
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 24.

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
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 25.

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
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 25.

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
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 25.

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
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 25.

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
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 26.

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
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 26.

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
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 27.

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
- Covered by [Accepted answers](../design/compositions/forum/resolutions.md), line 27.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 34.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 34.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 34.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 35.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 35.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 35.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 36.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 36.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 36.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 37.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 37.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 37.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 37.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 38.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 38.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 38.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 38.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 39.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 39.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 39.

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
- Covered by [Revision history](../design/compositions/forum/revisions.md), line 39.

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
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 28.

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
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 28.

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
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 29.

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
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 30.

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
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 30.

```reaction
when RequestBoundary.request (path: "/subscriptions/subscribe", requestId, session, target)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(conversation) is readable" with (conversation: target)
then
  Subscribing.subscribe (at, target, user)
```

### Forum.subscriptions.Subscribe:success#2

Authored path: `Forum.subscriptions.Subscribe`.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 4.
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 30.

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
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 31.

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
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 31.

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
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 32.

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
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 32.

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
- Covered by [Thread subscriptions](../design/compositions/forum/subscriptions.md), line 32.

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
- Covered by [Tags](../design/compositions/forum/tags.md), line 28.

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
- Covered by [Tags](../design/compositions/forum/tags.md), line 28.

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
- Covered by [Tags](../design/compositions/forum/tags.md), line 28.

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
- Covered by [Tags](../design/compositions/forum/tags.md), line 29.

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
- Covered by [Tags](../design/compositions/forum/tags.md), line 29.

```reaction
when Tagging.createTag (name, tag), asked by Forum.tags.CreateTag
where
  earlier, RequestBoundary.request (name, path: "/tags/create", requestId, session)
then
  RequestBoundary.respond (requestId, tag)
```

### Forum.tags.ListTags

Authored path: `Forum.tags.ListTags`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 11.
- Covered by [Tags](../design/compositions/forum/tags.md), line 30.

```reaction
when RequestBoundary.request (path: "/tags/list", requestId)
then
  RequestBoundary.respond (requestId, tags: former "the tags ()")
```

### Forum.tags.PurgeClearsTags

Authored path: `Forum.tags.PurgeClearsTags`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 22.

```reaction
when Trashing.purge (item)
then
  Tagging.clearTarget (target: item)
```

### Forum.tags.RemoveTag:hidden

Authored path: `Forum.tags.RemoveTag`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 5.
- Covered by [Tags](../design/compositions/forum/tags.md), line 31.

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
- Covered by [Tags](../design/compositions/forum/tags.md), line 31.

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
- Covered by [Tags](../design/compositions/forum/tags.md), line 31.

```reaction
when Tagging.removeTag (tag, target, result.target: untagged), asked by Forum.tags.RemoveTag:success
where
  earlier, RequestBoundary.request (path: "/tags/remove", requestId, session, tag, target)
then
  RequestBoundary.respond (requestId, target: untagged)
```

### Forum.tags.TagTargets

Authored path: `Forum.tags.TagTargets`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 15.
- Covered by [Tags](../design/compositions/forum/tags.md), line 32.

```reaction
when RequestBoundary.request (path: "/tags/targets", requestId, tag)
then
  RequestBoundary.respond (requestId, targets: former "the targets tagged (tag)" with (tag))
```

### Forum.tags.TagTargetsByName

Authored path: `Forum.tags.TagTargetsByName`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 17.
- Covered by [Tags](../design/compositions/forum/tags.md), line 33.

```reaction
when RequestBoundary.request (name, path: "/tags/targetsByName", requestId)
then
  RequestBoundary.respond (requestId, targets: former "the targets tagged with (name)" with (name))
```

### Forum.tags.TagsForTarget:hidden

Authored path: `Forum.tags.TagsForTarget`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 13.
- Covered by [Tags](../design/compositions/forum/tags.md), line 34.

```reaction
when RequestBoundary.request (path: "/tags/forTarget", requestId, target)
where
  view "(post) is not readable" with (post: target)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Forum.tags.TagsForTarget:success

Authored path: `Forum.tags.TagsForTarget`.
- Covered by [Tags](../design/compositions/forum/tags.md), line 13.
- Covered by [Tags](../design/compositions/forum/tags.md), line 34.

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
- Covered by [Threads](../design/compositions/forum/threads.md), line 33.

```reaction
when RequestBoundary.request (content, path: "/threads/create", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
then
  Posting.create (at, author: user, content)
```

### Forum.threads.CreateThread#2

Authored path: `Forum.threads.CreateThread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 3.
- Covered by [Threads](../design/compositions/forum/threads.md), line 33.

```reaction
when Posting.create (at, author: user, content, post), asked by Forum.threads.CreateThread
then
  Conversing.start (at, item: post)
```

### Forum.threads.CreateThread#3

Authored path: `Forum.threads.CreateThread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 3.
- Covered by [Threads](../design/compositions/forum/threads.md), line 33.

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
- Covered by [Threads](../design/compositions/forum/threads.md), line 34.

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
- Covered by [Threads](../design/compositions/forum/threads.md), line 34.

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
- Covered by [Threads](../design/compositions/forum/threads.md), line 35.

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
- Covered by [Threads](../design/compositions/forum/threads.md), line 35.

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
- Covered by [Threads](../design/compositions/forum/threads.md), line 35.

```reaction
when RequestBoundary.request (content, parent, path: "/threads/reply", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  Conversing._getConversation (node: parent) has (conversation)
  Locking._isLocked (target: conversation) has (locked: false)
  at is the current flow's instant
then
  Posting.create (at, author: user, content)
```

### Forum.threads.ReplyToThread:reply#2

Authored path: `Forum.threads.ReplyToThread`.
- Covered by [Threads](../design/compositions/forum/threads.md), line 5.
- Covered by [Threads](../design/compositions/forum/threads.md), line 35.

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
- Covered by [Threads](../design/compositions/forum/threads.md), line 35.

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
- Covered by [Unread tracking](../design/compositions/forum/unread.md), line 21.

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
- Covered by [Unread tracking](../design/compositions/forum/unread.md), line 21.

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
- Covered by [Unread tracking](../design/compositions/forum/unread.md), line 22.

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
- Covered by [Unread tracking](../design/compositions/forum/unread.md), line 22.

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
- Covered by [Unread tracking](../design/compositions/forum/unread.md), line 23.

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
- Covered by [Unread tracking](../design/compositions/forum/unread.md), line 24.

```reaction
when RequestBoundary.request (path: "/unread/list", requestId, scope, session)
where
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (items: former "the unread of (user) in (scope)" with (scope, user), requestId)
```

### Live.drafting.Abandon:abandoned

Authored path: `Live.drafting.Abandon`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 88.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 116.

```reaction
when RequestBoundary.request (brief, path: "/live/drafts/abandon", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "the root of drafting line (brief)" with (brief) has (abandoned: true, rootAuthor: user)
then
  RequestBoundary.respond (error: "CONFLICT", requestId)
```

### Live.drafting.Abandon:adopted

Authored path: `Live.drafting.Abandon`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 88.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 116.

```reaction
when RequestBoundary.request (brief, path: "/live/drafts/abandon", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false, root, rootAuthor: user)
  Drafting._line (brief: root) has (adopted: true)
then
  RequestBoundary.respond (error: "ALREADY_ADOPTED", requestId)
```

### Live.drafting.Abandon:forbidden

Authored path: `Live.drafting.Abandon`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 88.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 116.

```reaction
when RequestBoundary.request (brief, path: "/live/drafts/abandon", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.drafting.Abandon:missing

Authored path: `Live.drafting.Abandon`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 88.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 116.

```reaction
when RequestBoundary.request (brief, path: "/live/drafts/abandon", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Drafting._rootOf (brief)
then
  RequestBoundary.respond (error: "BRIEF_NOT_FOUND", requestId)
```

### Live.drafting.Abandon:not-author

Authored path: `Live.drafting.Abandon`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 88.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 116.

```reaction
when RequestBoundary.request (brief, path: "/live/drafts/abandon", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "the root of drafting line (brief)" with (brief) and not (rootAuthor: user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.drafting.Abandon:success

Authored path: `Live.drafting.Abandon`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 88.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 116.

```reaction
when RequestBoundary.request (brief, path: "/live/drafts/abandon", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false, root, rootAuthor: user)
  no Drafting._line (brief: root) has (adopted: true)
then
  DraftTrashing.trash (at, by: user, item: root)
```

### Live.drafting.Abandon:success#2

Authored path: `Live.drafting.Abandon`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 88.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 116.

```reaction
when DraftTrashing.trash (at, by: user, item: root, result.item: trashed), asked by Live.drafting.Abandon:success
where
  earlier, RequestBoundary.request (brief, path: "/live/drafts/abandon", requestId, session)
then
  RequestBoundary.respond (brief: trashed, requestId)
```

### Live.drafting.AbandonedLineGivesUpInsistence

Authored path: `Live.drafting.AbandonedLineGivesUpInsistence`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 96.

```reaction
when DraftTrashing.trash (item: root)
where
  Drafting._line (brief: root) has (brief)
  Insisting._unsettledFor (aim: brief)
then
  Insisting.giveUp (aim: brief)
```

### Live.drafting.Adopt:abandoned

Authored path: `Live.drafting.Adopt`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 55.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 115.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/adopt", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Drafting._candidate (candidate) has (brief)
  view "the root of drafting line (brief)" with (brief) has (abandoned: true, rootAuthor: user)
then
  RequestBoundary.respond (error: "CONFLICT", requestId)
```

### Live.drafting.Adopt:forbidden

Authored path: `Live.drafting.Adopt`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 55.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 115.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/adopt", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.drafting.Adopt:form-fixed-quiz

Authored path: `Live.drafting.Adopt`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 55.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 115.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/adopt", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Drafting._candidate (candidate) has (brief, form: "survey")
  Drafting._originOf (brief) has (origin: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
  Questioning._getQuestionnaire (questionnaire) has (form: "quiz", retired: false)
then
  RequestBoundary.respond (error: "FORM_FIXED", requestId)
```

### Live.drafting.Adopt:form-fixed-survey

Authored path: `Live.drafting.Adopt`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 55.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 115.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/adopt", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Drafting._candidate (candidate) has (brief, form: "quiz")
  Drafting._originOf (brief) has (origin: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
  Questioning._getQuestionnaire (questionnaire) has (form: "survey", retired: false)
then
  RequestBoundary.respond (error: "FORM_FIXED", requestId)
```

### Live.drafting.Adopt:missing

Authored path: `Live.drafting.Adopt`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 55.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 115.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/adopt", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Drafting._candidate (candidate)
then
  RequestBoundary.respond (error: "CANDIDATE_NOT_FOUND", requestId)
```

### Live.drafting.Adopt:not-author

Authored path: `Live.drafting.Adopt`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 55.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 115.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/adopt", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Drafting._candidate (candidate) has (brief)
  view "the root of drafting line (brief)" with (brief) and not (rootAuthor: user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.drafting.Adopt:refit

Authored path: `Live.drafting.Adopt`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 55.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 115.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/adopt", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Drafting._candidate (candidate) has (brief, form)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false, rootAuthor: user)
  Drafting._originOf (brief) has (origin: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
  Questioning._getQuestionnaire (questionnaire) has (form, retired: false)
then
  Drafting.adopt (candidate)
```

### Live.drafting.Adopt:refit#2

Authored path: `Live.drafting.Adopt`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 55.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 115.

```reaction
when Drafting.adopt (candidate, result.candidate: adopted), asked by Live.drafting.Adopt:refit
where
  earlier, RequestBoundary.request (candidate, path: "/live/drafts/adopt", requestId, session)
then
  RequestBoundary.respond (candidate: adopted, requestId)
```

### Live.drafting.Adopt:retired

Authored path: `Live.drafting.Adopt`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 55.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 115.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/adopt", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Drafting._candidate (candidate) has (brief)
  Drafting._originOf (brief) has (origin: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
  Questioning._getQuestionnaire (questionnaire) has (retired: true)
then
  RequestBoundary.respond (error: "QUESTIONNAIRE_RETIRED", requestId)
```

### Live.drafting.Adopt:run-open

Authored path: `Live.drafting.Adopt`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 55.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 115.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/adopt", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Drafting._candidate (candidate) has (brief)
  Drafting._originOf (brief) has (origin: questionnaire)
  view "(questionnaire) has an open run" with (questionnaire)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.drafting.Adopt:success

Authored path: `Live.drafting.Adopt`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 55.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 115.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/adopt", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Drafting._candidate (candidate) has (brief)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false, rootAuthor: user)
  no Drafting._originOf (brief)
then
  Drafting.adopt (candidate)
```

### Live.drafting.Adopt:success#2

Authored path: `Live.drafting.Adopt`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 55.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 115.

```reaction
when Drafting.adopt (candidate, result.candidate: adopted), asked by Live.drafting.Adopt:success
where
  earlier, RequestBoundary.request (candidate, path: "/live/drafts/adopt", requestId, session)
then
  RequestBoundary.respond (candidate: adopted, requestId)
```

### Live.drafting.AdoptedCandidateComposesQuestionnaire

Authored path: `Live.drafting.AdoptedCandidateComposesQuestionnaire`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 57.

```reaction
when Drafting.adopt (candidate)
where
  at is the current flow's instant
  Drafting._candidate (candidate) has (brief, form)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  no Drafting._originOf (brief)
  Drafting._brief (brief) has (author)
  title is draftTitle (form)
then
  Questioning.compose (at, author, disclosure: "score", form, title)
```

### Live.drafting.AdoptedCandidateComposesQuestionnaire:each-item#2

Authored path: `Live.drafting.AdoptedCandidateComposesQuestionnaire`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 57.

```reaction
when Questioning.compose (at, author, disclosure: "score", form, title, questionnaire), asked by Live.drafting.AdoptedCandidateComposesQuestionnaire
where
  earlier, Drafting.adopt (candidate)
  Drafting._items (candidate) has (choices, expected, explanation, position, prompt)
then
  Questioning.addQuestion (choices, expected, explanation, position, prompt, questionnaire)
```

### Live.drafting.AdoptedCandidateComposesQuestionnaire:link#2

Authored path: `Live.drafting.AdoptedCandidateComposesQuestionnaire`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 57.

```reaction
when Questioning.compose (at, author, disclosure: "score", form, title, questionnaire), asked by Live.drafting.AdoptedCandidateComposesQuestionnaire
where
  targets is soleTarget (target: questionnaire)
  earlier, Drafting.adopt (candidate)
  Drafting._candidate (candidate) has (brief: linked)
then
  AdoptLinking.setLinks (source: linked, targets)
```

### Live.drafting.AdoptedRevisionRevisesQuestionnaire:grow

Authored path: `Live.drafting.AdoptedRevisionRevisesQuestionnaire`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 77.

```reaction
when Drafting.adopt (candidate)
where
  Drafting._candidate (candidate) has (brief)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  Drafting._originOf (brief) has (origin: questionnaire)
  Drafting._items (candidate) has (choices, expected, explanation, position: past, prompt)
  view "the question count of (questionnaire)" with (questionnaire) has (total: questionTotal)
  past is greater than questionTotal
then
  Questioning.addQuestion (choices, expected, explanation, position: past, prompt, questionnaire)
```

### Live.drafting.AdoptedRevisionRevisesQuestionnaire:revise

Authored path: `Live.drafting.AdoptedRevisionRevisesQuestionnaire`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 77.

```reaction
when Drafting.adopt (candidate)
where
  Drafting._candidate (candidate) has (brief)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  Drafting._originOf (brief) has (origin: questionnaire)
  Drafting._items (candidate) has (choices, expected, explanation, position, prompt)
  Questioning._getQuestions (questionnaire) has (position, question)
then
  Questioning.reviseQuestion (choices, expected, explanation, position, prompt, question)
```

### Live.drafting.AdoptedRevisionRevisesQuestionnaire:shed

Authored path: `Live.drafting.AdoptedRevisionRevisesQuestionnaire`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 77.

```reaction
when Drafting.adopt (candidate)
where
  Drafting._candidate (candidate) has (brief)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  Drafting._originOf (brief) has (origin: questionnaire)
  Questioning._getQuestions (questionnaire) has (position: shedAt, question: shed)
  view "the item count of (candidate)" with (candidate) has (total: itemTotal)
  shedAt is greater than itemTotal
then
  Questioning.removeQuestion (question: shed)
```

### Live.drafting.AskedQuestionSatisfiesInsistence

Authored path: `Live.drafting.AskedQuestionSatisfiesInsistence`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 40.

```reaction
when Drafting.ask (brief)
where
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  Insisting._unsettledFor (aim: brief)
then
  Insisting.satisfy (aim: brief)
```

### Live.drafting.ClarifiedBriefAsksReasoner

Authored path: `Live.drafting.ClarifiedBriefAsksReasoner`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 16.

```reaction
when Drafting.clarify (answer, clarification, brief)
where
  at is the current flow's instant
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  Drafting._clarifications (brief) has (clarification, question)
  Drafting._brief (brief) has (request)
  passage is clarifiedPassage (answer, question, request)
then
  Reasoning.ask (about: brief, at, passage, reasoner: "gemini-flash")
```

### Live.drafting.Clarify:abandoned

Authored path: `Live.drafting.Clarify`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 18.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 117.

```reaction
when RequestBoundary.request (answer, clarification, path: "/live/drafts/clarify", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Drafting._lines (author: user) has (brief: root)
  Drafting._line (brief: root) has (brief)
  Drafting._clarifications (brief) has (clarification)
  DraftTrashing._isTrashed (item: root) has (trashed: true)
then
  RequestBoundary.respond (error: "CONFLICT", requestId)
```

### Live.drafting.Clarify:forbidden

Authored path: `Live.drafting.Clarify`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 18.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 117.

```reaction
when RequestBoundary.request (answer, clarification, path: "/live/drafts/clarify", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.drafting.Clarify:success

Authored path: `Live.drafting.Clarify`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 18.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 117.

```reaction
when RequestBoundary.request (answer, clarification, path: "/live/drafts/clarify", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Drafting._lines (author: user) has (brief: root)
  Drafting._line (brief: root) has (brief)
  Drafting._clarifications (brief) has (clarification)
  DraftTrashing._isTrashed (item: root) has (trashed: false)
then
  Drafting.clarify (answer, clarification)
```

### Live.drafting.Clarify:success#2

Authored path: `Live.drafting.Clarify`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 18.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 117.

```reaction
when Drafting.clarify (answer, clarification, brief, result.clarification: clarified), asked by Live.drafting.Clarify:success
where
  earlier, RequestBoundary.request (answer, clarification, path: "/live/drafts/clarify", requestId, session)
then
  RequestBoundary.respond (brief, clarification: clarified, requestId)
```

### Live.drafting.ComplaintRetriesTheAsk

Authored path: `Live.drafting.ComplaintRetriesTheAsk`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 35.

```reaction
when Insisting.complain (account, aim: brief, offering)
where
  at is the current flow's instant
  Drafting._brief (brief)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  Insisting._standingFor (aim: brief)
  Drafting._brief (brief) has (request)
  passage is repairPassage (account, offering, request)
then
  Reasoning.ask (about: brief, at, passage, reasoner: "gemini-flash")
```

### Live.drafting.Correct:abandoned

Authored path: `Live.drafting.Correct`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 48.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 118.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/correct", request, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Drafting._candidate (candidate) has (brief: continued)
  view "the root of drafting line (brief)" with (brief: continued) has (abandoned: true, rootAuthor: user)
then
  RequestBoundary.respond (error: "CONFLICT", requestId)
```

### Live.drafting.Correct:forbidden

Authored path: `Live.drafting.Correct`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 48.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 118.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/correct", request, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.drafting.Correct:not-author

Authored path: `Live.drafting.Correct`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 48.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 118.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/correct", request, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Drafting._candidate (candidate) has (brief: continued)
  view "the root of drafting line (brief)" with (brief: continued) and not (rootAuthor: user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.drafting.Correct:success

Authored path: `Live.drafting.Correct`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 48.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 118.

```reaction
when RequestBoundary.request (candidate, path: "/live/drafts/correct", request, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Drafting._candidate (candidate) has (brief: continued)
  view "the root of drafting line (brief)" with (brief: continued) has (abandoned: false, rootAuthor: user)
then
  Drafting.correct (at, author: user, candidate, request)
```

### Live.drafting.Correct:success#2

Authored path: `Live.drafting.Correct`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 48.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 118.

```reaction
when Drafting.correct (at, author: user, candidate, request, brief), asked by Live.drafting.Correct:success
where
  earlier, RequestBoundary.request (candidate, path: "/live/drafts/correct", request, requestId, session)
then
  RequestBoundary.respond (brief, requestId)
```

### Live.drafting.CorrectedBriefAsksReasoner

Authored path: `Live.drafting.CorrectedBriefAsksReasoner`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 13.

```reaction
when Drafting.correct (candidate, request, brief)
where
  at is the current flow's instant
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  Drafting._material (candidate) has (form, material)
  passage is revisionPassage (form, material, request)
then
  Reasoning.ask (about: brief, at, passage, reasoner: "gemini-flash")
```

### Live.drafting.CorrectionQuestionComplains

Authored path: `Live.drafting.CorrectionQuestionComplains`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 30.

```reaction
when Reasoning.answer (asking, reply)
where
  Reasoning._asking (asking) has (about: brief)
  Drafting._brief (brief)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  kind is parseKind (reply)
  kind is among ["question"]
  Drafting._basisOf (brief)
then
  Insisting.complain (account: "A correction takes no clarifying question — the form was already settled. Deliver the whole revised draft.", aim: brief, offering: reply, patience: 3)
```

### Live.drafting.Describe:forbidden

Authored path: `Live.drafting.Describe`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 10.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 119.

```reaction
when RequestBoundary.request (path: "/live/drafts/describe", request, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.drafting.Describe:success

Authored path: `Live.drafting.Describe`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 10.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 119.

```reaction
when RequestBoundary.request (path: "/live/drafts/describe", request, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  Drafting.describe (at, author: user, request)
```

### Live.drafting.Describe:success#2

Authored path: `Live.drafting.Describe`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 10.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 119.

```reaction
when Drafting.describe (at, author: user, request, brief), asked by Live.drafting.Describe:success
where
  earlier, RequestBoundary.request (path: "/live/drafts/describe", request, requestId, session)
then
  RequestBoundary.respond (brief, requestId)
```

### Live.drafting.DescribedBriefAsksReasoner

Authored path: `Live.drafting.DescribedBriefAsksReasoner`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 11.

```reaction
when Drafting.describe (request, brief)
where
  at is the current flow's instant
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  passage is draftingPassage (request)
then
  Reasoning.ask (about: brief, at, passage, reasoner: "gemini-flash")
```

### Live.drafting.FailedAskStallsTheBrief:give-up

Authored path: `Live.drafting.FailedAskStallsTheBrief`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 45.

```reaction
when Reasoning.fail (asking)
where
  Reasoning._asking (asking) has (about: brief)
  Drafting._brief (brief)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  Insisting._unsettledFor (aim: brief)
then
  Insisting.giveUp (aim: brief)
```

### Live.drafting.FailedAskStallsTheBrief:stall

Authored path: `Live.drafting.FailedAskStallsTheBrief`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 45.

```reaction
when Reasoning.fail (asking)
where
  Reasoning._asking (asking) has (about: brief)
  Drafting._brief (brief)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  Reasoning._failureOf (asking) has (account)
  Drafting._standing (brief) has (stalled: false)
then
  Drafting.stall (brief, reason: account)
```

### Live.drafting.Line:forbidden

Authored path: `Live.drafting.Line`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 49.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 120.

```reaction
when RequestBoundary.request (brief, path: "/live/drafts/line", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.drafting.Line:success

Authored path: `Live.drafting.Line`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 49.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 120.

```reaction
when RequestBoundary.request (brief, path: "/live/drafts/line", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  RequestBoundary.respond (line: former "the drafting line of (brief)" with (brief), requestId)
```

### Live.drafting.Lines:forbidden

Authored path: `Live.drafting.Lines`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 99.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 121.

```reaction
when RequestBoundary.request (path: "/live/drafts/lines", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.drafting.Lines:success

Authored path: `Live.drafting.Lines`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 99.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 121.

```reaction
when RequestBoundary.request (path: "/live/drafts/lines", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  RequestBoundary.respond (lines: former "the drafting lines of (author)" with (author: user), requestId)
```

### Live.drafting.ProposedDraftSatisfiesInsistence

Authored path: `Live.drafting.ProposedDraftSatisfiesInsistence`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 38.

```reaction
when Drafting.propose (brief)
where
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  Insisting._unsettledFor (aim: brief)
then
  Insisting.satisfy (aim: brief)
```

### Live.drafting.Provenance:forbidden

Authored path: `Live.drafting.Provenance`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 106.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 122.

```reaction
when RequestBoundary.request (path: "/live/drafts/provenance", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.drafting.Provenance:success

Authored path: `Live.drafting.Provenance`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 106.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 122.

```reaction
when RequestBoundary.request (path: "/live/drafts/provenance", questionnaire, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  RequestBoundary.respond (provenance: former "the drafting provenance of (questionnaire)" with (questionnaire), requestId)
```

### Live.drafting.Refine:forbidden

Authored path: `Live.drafting.Refine`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 67.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 123.

```reaction
when RequestBoundary.request (path: "/live/drafts/refine", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.drafting.Refine:missing

Authored path: `Live.drafting.Refine`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 67.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 123.

```reaction
when RequestBoundary.request (path: "/live/drafts/refine", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Questioning._getQuestionnaire (questionnaire)
then
  RequestBoundary.respond (error: "QUESTIONNAIRE_NOT_FOUND", requestId)
```

### Live.drafting.Refine:retired

Authored path: `Live.drafting.Refine`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 67.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 123.

```reaction
when RequestBoundary.request (path: "/live/drafts/refine", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestionnaire (questionnaire) has (retired: true)
then
  RequestBoundary.respond (error: "QUESTIONNAIRE_RETIRED", requestId)
```

### Live.drafting.Refine:run-open

Authored path: `Live.drafting.Refine`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 67.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 123.

```reaction
when RequestBoundary.request (path: "/live/drafts/refine", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestionnaire (questionnaire) has (retired: false)
  view "(questionnaire) has an open run" with (questionnaire)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.drafting.Refine:success

Authored path: `Live.drafting.Refine`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 67.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 123.

```reaction
when RequestBoundary.request (path: "/live/drafts/refine", questionnaire, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestionnaire (questionnaire) has (retired: false, title)
  view "(questionnaire) has no open run" with (questionnaire)
  Questioning._material (questionnaire) has (form, material)
then
  Drafting.open (at, author: user, form, material, origin: questionnaire, request: title)
```

### Live.drafting.Refine:success#2

Authored path: `Live.drafting.Refine`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 67.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 123.

```reaction
when Drafting.open (at, author: user, form, material, origin: questionnaire, request: title, brief, candidate), asked by Live.drafting.Refine:success
where
  earlier, RequestBoundary.request (path: "/live/drafts/refine", questionnaire, requestId, session)
then
  RequestBoundary.respond (brief, candidate, requestId)
```

### Live.drafting.ReplyDraftProposes

Authored path: `Live.drafting.ReplyDraftProposes`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 24.

```reaction
when Reasoning.answer (asking, reply)
where
  Reasoning._asking (asking) has (about: brief)
  Drafting._brief (brief)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  kind is parseKind (reply)
  kind is among ["draft"]
  form is parsedForm (reply)
  material is parsedMaterial (reply)
then
  Drafting.propose (brief, form, material)
```

### Live.drafting.ReplyNeitherComplains

Authored path: `Live.drafting.ReplyNeitherComplains`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 33.

```reaction
when Reasoning.answer (asking, reply)
where
  Reasoning._asking (asking) has (about: brief)
  Drafting._brief (brief)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  kind is parseKind (reply)
  kind is among ["neither"]
  reason is parsedReason (reply)
then
  Insisting.complain (account: reason, aim: brief, offering: reply, patience: 3)
```

### Live.drafting.ReplyQuestionAsks

Authored path: `Live.drafting.ReplyQuestionAsks`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 26.

```reaction
when Reasoning.answer (asking, reply)
where
  Reasoning._asking (asking) has (about: brief)
  Drafting._brief (brief)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  kind is parseKind (reply)
  kind is among ["question"]
  no Drafting._basisOf (brief)
  question is parsedQuestion (reply)
then
  Drafting.ask (brief, question)
```

### Live.drafting.SpentPatienceStallsTheBrief

Authored path: `Live.drafting.SpentPatienceStallsTheBrief`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 42.

```reaction
when Insisting.complain (aim: brief)
where
  Drafting._brief (brief)
  view "the root of drafting line (brief)" with (brief) has (abandoned: false)
  Insisting._spentFor (aim: brief)
then
  Drafting.stall (brief, reason: "The reply could not be read, and standing on it did not help.")
```

### Live.drafting.SpentPatienceStallsTheBrief#2

Authored path: `Live.drafting.SpentPatienceStallsTheBrief`.
- Covered by [Drafting with the reasoner](../design/compositions/live/drafting.md), line 42.

```reaction
when Drafting.stall (brief, reason: "The reply could not be read, and standing on it did not help."), asked by Live.drafting.SpentPatienceStallsTheBrief
then
  Insisting.giveUp (aim: brief)
```

### Live.edits.ComplaintRetriesTheAsk

Authored path: `Live.edits.ComplaintRetriesTheAsk`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 7.

```reaction
when Insisting.complain (account, aim: relay, offering)
where
  at is the current flow's instant
  Relaying._relay (relay)
  Insisting._standingFor (aim: relay)
  Reasoning._repliesAbout (about: relay) has (passage: asked, reply: offering)
  passage is relayDraftRepairPassage (account, offering, passage: asked)
then
  Reasoning.ask (about: relay, at, passage, reasoner: "gemini-flash")
```

### Live.edits.Decline:forbidden

Authored path: `Live.edits.Decline`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 11.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 96.

```reaction
when RequestBoundary.request (path: "/live/edits/decline", requestId, session, suggestion)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.edits.Decline:success

Authored path: `Live.edits.Decline`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 11.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 96.

```reaction
when RequestBoundary.request (path: "/live/edits/decline", requestId, session, suggestion)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  Suggesting.decline (suggestion)
```

### Live.edits.Decline:success#2

Authored path: `Live.edits.Decline`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 11.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 96.

```reaction
when Suggesting.decline (suggestion, result.suggestion: declined), asked by Live.edits.Decline:success
where
  earlier, RequestBoundary.request (path: "/live/edits/decline", requestId, session, suggestion)
then
  RequestBoundary.respond (requestId, suggestion: declined)
```

### Live.edits.Draft:blank

Authored path: `Live.edits.Draft`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 7.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 97.

```reaction
when RequestBoundary.request (path: "/live/edits/draft", relay, request, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  said is briefStanding (request)
  said is among ["blank"]
then
  RequestBoundary.respond (error: "INVALID_REQUEST", requestId)
```

### Live.edits.Draft:forbidden

Authored path: `Live.edits.Draft`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 7.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 97.

```reaction
when RequestBoundary.request (path: "/live/edits/draft", relay, request, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.edits.Draft:missing

Authored path: `Live.edits.Draft`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 7.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 97.

```reaction
when RequestBoundary.request (path: "/live/edits/draft", relay, request, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._relay (relay)
then
  RequestBoundary.respond (error: "RELAY_NOT_FOUND", requestId)
```

### Live.edits.Draft:success

Authored path: `Live.edits.Draft`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 7.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 97.

```reaction
when RequestBoundary.request (path: "/live/edits/draft", relay, request, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  said is briefStanding (request)
  said is among ["given"]
  Relaying._plan (relay) has (legs)
  questionnaires is legMaterials (legs)
  Questioning._materials (questionnaires) has (materials)
  passage is relayDraftPassage (legs, materials, request)
then
  Reasoning.ask (about: relay, at, passage, reasoner: "gemini-flash")
```

### Live.edits.Draft:success#2

Authored path: `Live.edits.Draft`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 7.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 97.

```reaction
when Reasoning.ask (about: relay, at, passage, reasoner: "gemini-flash", asking), asked by Live.edits.Draft:success
where
  earlier, RequestBoundary.request (path: "/live/edits/draft", relay, request, requestId, session)
then
  RequestBoundary.respond (asking, requestId)
```

### Live.edits.FailedAskGivesUp

Authored path: `Live.edits.FailedAskGivesUp`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 7.

```reaction
when Reasoning.fail (asking)
where
  Reasoning._asking (asking) has (about: relay)
  Relaying._relay (relay)
  Insisting._unsettledFor (aim: relay)
then
  Insisting.giveUp (aim: relay)
```

### Live.edits.OfferedEditsSatisfyInsistence

Authored path: `Live.edits.OfferedEditsSatisfyInsistence`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 7.

```reaction
when Suggesting.offer (subject: relay)
where
  Relaying._relay (relay)
  Insisting._unsettledFor (aim: relay)
then
  Insisting.satisfy (aim: relay)
```

### Live.edits.Offerings:forbidden

Authored path: `Live.edits.Offerings`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 11.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 98.

```reaction
when RequestBoundary.request (path: "/live/edits/offerings", relay, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.edits.Offerings:success

Authored path: `Live.edits.Offerings`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 11.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 98.

```reaction
when RequestBoundary.request (path: "/live/edits/offerings", relay, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  RequestBoundary.respond (offerings: former "the offerings about (relay)" with (relay), requestId)
```

### Live.edits.ReplyOffersRelayEdits

Authored path: `Live.edits.ReplyOffersRelayEdits`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 7.

```reaction
when Reasoning.answer (asking, reply)
where
  at is the current flow's instant
  Reasoning._asking (asking) has (about: relay)
  Relaying._relay (relay)
  reading is relayDraftReading (reply)
  reading is among ["relay"]
  Relaying._plan (relay) has (legs)
  questionnaires is legMaterials (legs)
  Questioning._materials (questionnaires) has (materials)
  lines is relayEditLines (legs, materials, reply)
then
  Suggesting.offer (at, lines, subject: relay)
```

### Live.edits.ReplyUnusableComplains

Authored path: `Live.edits.ReplyUnusableComplains`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 7.

```reaction
when Reasoning.answer (asking, reply)
where
  Reasoning._asking (asking) has (about: relay)
  Relaying._relay (relay)
  reading is relayDraftReading (reply)
  reading is among ["neither"]
  account is relayDraftReason (reply)
then
  Insisting.complain (account, aim: relay, offering: reply, patience: 2)
```

### Live.edits.SpentPatienceGivesUp

Authored path: `Live.edits.SpentPatienceGivesUp`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 7.

```reaction
when Insisting.complain (aim: relay)
where
  Relaying._relay (relay)
  Insisting._spentFor (aim: relay)
then
  Insisting.giveUp (aim: relay)
```

### Live.edits.Take:forbidden

Authored path: `Live.edits.Take`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 11.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 99.

```reaction
when RequestBoundary.request (path: "/live/edits/take", requestId, session, suggestion)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.edits.Take:relay

Authored path: `Live.edits.Take`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 11.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 99.

```reaction
when RequestBoundary.request (path: "/live/edits/take", requestId, session, suggestion)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Suggesting._suggestion (suggestion) has (target)
  no Relaying._leg (leg: target)
then
  Suggesting.take (suggestion)
```

### Live.edits.Take:relay#2

Authored path: `Live.edits.Take`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 11.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 99.

```reaction
when Suggesting.take (suggestion, result.suggestion: taken), asked by Live.edits.Take:relay
where
  earlier, RequestBoundary.request (path: "/live/edits/take", requestId, session, suggestion)
then
  RequestBoundary.respond (requestId, suggestion: taken)
```

### Live.edits.Take:round

Authored path: `Live.edits.Take`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 11.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 99.

```reaction
when RequestBoundary.request (path: "/live/edits/take", requestId, session, suggestion)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Suggesting._suggestion (suggestion) has (target)
  Relaying._leg (leg: target) has (material: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
then
  Suggesting.take (suggestion)
```

### Live.edits.Take:round#2

Authored path: `Live.edits.Take`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 11.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 99.

```reaction
when Suggesting.take (suggestion, result.suggestion: taken), asked by Live.edits.Take:round
where
  earlier, RequestBoundary.request (path: "/live/edits/take", requestId, session, suggestion)
then
  RequestBoundary.respond (requestId, suggestion: taken)
```

### Live.edits.Take:run-open

Authored path: `Live.edits.Take`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 11.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 99.

```reaction
when RequestBoundary.request (path: "/live/edits/take", requestId, session, suggestion)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Suggesting._suggestion (suggestion) has (target)
  Relaying._leg (leg: target) has (material: questionnaire)
  view "(questionnaire) has an open run" with (questionnaire)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.edits.TakenAddAddsRound

Authored path: `Live.edits.TakenAddAddsRound`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 13.

```reaction
when Suggesting.take (suggestion, kind: "add", value)
where
  at is the current flow's instant
  Suggesting._suggestion (suggestion) has (subject: relay)
  Relaying._relay (relay) has (author)
  round is editRoundJson (value)
  title is editTitle (round)
then
  Questioning.compose (at, author, disclosure: "score", form: "survey", title)
```

### Live.edits.TakenAddAddsRound#2

Authored path: `Live.edits.TakenAddAddsRound`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 13.

```reaction
when Questioning.compose (at, author, disclosure: "score", form: "survey", title, questionnaire), asked by Live.edits.TakenAddAddsRound
where
  earlier, Suggesting.take (suggestion, kind: "add", value)
  asked is editRoundJson (value)
  prompt is editPrompt (round: asked)
  choices is editRoundChoices (round: asked)
then
  Questioning.addQuestion (choices, expected: "", explanation: "", position: 1, prompt, questionnaire)
```

### Live.edits.TakenAddAddsRound#3

Authored path: `Live.edits.TakenAddAddsRound`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 13.

```reaction
when Questioning.addQuestion (choices, expected: "", explanation: "", position: 1, prompt, questionnaire, question), asked by Live.edits.TakenAddAddsRound#2
where
  earlier, Suggesting.take (suggestion, kind: "add", value)
  shaped is editRoundJson (value)
  parts is editRoundParts (round: shaped)
  cap is editRoundCap (round: shaped)
then
  Questioning.setParts (cap, parts, question)
```

### Live.edits.TakenAddAddsRound#4

Authored path: `Live.edits.TakenAddAddsRound`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 13.

```reaction
when Questioning.setParts (cap, parts, question), asked by Live.edits.TakenAddAddsRound#3
where
  Questioning._getQuestion (question) has (questionnaire)
  earlier, Suggesting.take (suggestion, kind: "add", value)
  Suggesting._suggestion (suggestion) has (subject: placed)
then
  Relaying.addLeg (material: questionnaire, relay: placed)
```

### Live.edits.TakenAddAddsRound:drawn#5

Authored path: `Live.edits.TakenAddAddsRound`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 13.

```reaction
when Relaying.addLeg (material: questionnaire, relay: placed, leg: added), asked by Live.edits.TakenAddAddsRound#4
where
  Relaying._leg (leg: added) has (relay: drawn)
  Relaying._legs (relay: drawn) has (leg: source, position: from)
  earlier, Suggesting.take (suggestion, kind: "add", value)
  drawing is editRoundJson (value)
  shape is editRoundTakesShape (round: drawing)
  shape is among ["context", "choices", "parts"]
  from is editRoundTakesFrom (round: drawing)
then
  Relaying.draw (leg: added, shape, source)
```

### Live.edits.TakenAddAddsRound:placed#5

Authored path: `Live.edits.TakenAddAddsRound`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 13.

```reaction
when Relaying.addLeg (material: questionnaire, relay: placed, leg: added), asked by Live.edits.TakenAddAddsRound#4
where
  earlier, Suggesting.take (suggestion, kind: "add", value)
  landing is editRoundJson (value)
  position is editRoundPosition (round: landing)
  position is greater than 0
then
  Relaying.moveLeg (leg: added, position)
```

### Live.edits.TakenChoicesReviseRound

Authored path: `Live.edits.TakenChoicesReviseRound`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 16.

```reaction
when Suggesting.take (suggestion, kind: "choices", target, value)
where
  Suggesting._suggestion (suggestion) has (subject: relay)
  Relaying._relay (relay)
  Relaying._leg (leg: target) has (material, relay)
  Questioning._getQuestions (questionnaire: material) has (expected, explanation, position, prompt, question)
  choices is editChoices (value)
then
  Questioning.reviseQuestion (choices, expected, explanation, position, prompt, question)
```

### Live.edits.TakenMoveMovesRound

Authored path: `Live.edits.TakenMoveMovesRound`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 15.

```reaction
when Suggesting.take (suggestion, kind: "move", target, value)
where
  Suggesting._suggestion (suggestion) has (subject: relay)
  Relaying._relay (relay)
  Relaying._leg (leg: target) has (relay)
  position is editPosition (value)
then
  Relaying.moveLeg (leg: target, position)
```

### Live.edits.TakenPartsSetParts

Authored path: `Live.edits.TakenPartsSetParts`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 16.

```reaction
when Suggesting.take (suggestion, kind: "parts", target, value)
where
  Suggesting._suggestion (suggestion) has (subject: relay)
  Relaying._relay (relay)
  Relaying._leg (leg: target) has (material, relay)
  Questioning._getQuestions (questionnaire: material) has (question)
  parts is editParts (value)
  cap is editCap (value)
then
  Questioning.setParts (cap, parts, question)
```

### Live.edits.TakenPromptRevisesRound

Authored path: `Live.edits.TakenPromptRevisesRound`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 16.

```reaction
when Suggesting.take (suggestion, kind: "prompt", target, value)
where
  Suggesting._suggestion (suggestion) has (subject: relay)
  Relaying._relay (relay)
  Relaying._leg (leg: target) has (material, relay)
  Questioning._getQuestions (questionnaire: material) has (choices, expected, explanation, position, question)
then
  Questioning.reviseQuestion (choices, expected, explanation, position, prompt: value, question)
```

### Live.edits.TakenRemoveRemovesRound

Authored path: `Live.edits.TakenRemoveRemovesRound`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 14.

```reaction
when Suggesting.take (suggestion, kind: "remove", target)
where
  Suggesting._suggestion (suggestion) has (subject: relay)
  Relaying._relay (relay)
  Relaying._leg (leg: target) has (relay)
then
  Relaying.removeLeg (leg: target)
```

### Live.edits.TakenRemoveRemovesRound#2

Authored path: `Live.edits.TakenRemoveRemovesRound`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 14.

```reaction
when Relaying.removeLeg (leg: target, material), asked by Live.edits.TakenRemoveRemovesRound
then
  Questioning.retire (questionnaire: material)
```

### Live.edits.TakenTakesDraws

Authored path: `Live.edits.TakenTakesDraws`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 17.

```reaction
when Suggesting.take (suggestion, kind: "takes", target, value)
where
  Suggesting._suggestion (suggestion) has (subject: relay)
  Relaying._relay (relay)
  Relaying._leg (leg: target) has (relay)
  shape is editShape (value)
  shape is among ["context", "choices", "parts"]
  position is editPosition (value)
  Relaying._legs (relay) has (leg: source, position)
then
  Relaying.draw (leg: target, shape, source)
```

### Live.edits.TakenTakesUndraws

Authored path: `Live.edits.TakenTakesUndraws`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 17.

```reaction
when Suggesting.take (suggestion, kind: "takes", target, value)
where
  Suggesting._suggestion (suggestion) has (subject: relay)
  Relaying._relay (relay)
  Relaying._leg (leg: target) has (relay)
  shape is editShape (value)
  shape is among [""]
  Relaying._draws (leg: target) has (source)
then
  Relaying.undraw (leg: target, source)
```

### Live.edits.TakenTitleRetitlesRound

Authored path: `Live.edits.TakenTitleRetitlesRound`.
- Covered by [Edits the model proposes](../design/compositions/live/edits.md), line 16.

```reaction
when Suggesting.take (suggestion, kind: "title", target, value)
where
  Suggesting._suggestion (suggestion) has (subject: relay)
  Relaying._relay (relay)
  Relaying._leg (leg: target) has (material, relay)
then
  Questioning.retitle (questionnaire: material, title: value)
```

### Live.participation.Answer:closed

Authored path: `Live.participation.Answer`.
- Covered by [Participation](../design/compositions/live/participation.md), line 45.
- Covered by [Participation](../design/compositions/live/participation.md), line 89.

```reaction
when RequestBoundary.request (path: "/live/p/answer", question, requestId, response, value)
where
  Responding._response (response) has (subject: run)
  view "(run) is closed" with (run)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.participation.Answer:not-part

Authored path: `Live.participation.Answer`.
- Covered by [Participation](../design/compositions/live/participation.md), line 45.
- Covered by [Participation](../design/compositions/live/participation.md), line 89.

```reaction
when RequestBoundary.request (path: "/live/p/answer", question, requestId, response, value)
where
  Responding._response (response) has (subject: run)
  view "(run) is open to participation" with (run)
  view "(question) is not part of (run)" with (question, run)
then
  RequestBoundary.respond (error: "NOT_PART", requestId)
```

### Live.participation.Answer:success

Authored path: `Live.participation.Answer`.
- Covered by [Participation](../design/compositions/live/participation.md), line 45.
- Covered by [Participation](../design/compositions/live/participation.md), line 89.

```reaction
when RequestBoundary.request (path: "/live/p/answer", question, requestId, response, value)
where
  Responding._response (response) has (subject: run)
  view "(run) is open to participation" with (run)
  view "(question) belongs to (run)" with (question, run)
then
  Responding.answer (item: question, response, value)
```

### Live.participation.Answer:success#2

Authored path: `Live.participation.Answer`.
- Covered by [Participation](../design/compositions/live/participation.md), line 45.
- Covered by [Participation](../design/compositions/live/participation.md), line 89.

```reaction
when Responding.answer (item: question, response, value, result.response: answered), asked by Live.participation.Answer:success
where
  earlier, RequestBoundary.request (path: "/live/p/answer", question, requestId, response, value)
then
  RequestBoundary.respond (requestId, response: answered)
```

### Live.participation.Arrive

Authored path: `Live.participation.Arrive`.
- Covered by [Participation](../design/compositions/live/participation.md), line 17.
- Covered by [Participation](../design/compositions/live/participation.md), line 90.

```reaction
when RequestBoundary.request (path: "/live/p/arrive", requestId, token)
then
  Sharing.open (token)
```

### Live.participation.Arrive:questionnaire#2

Authored path: `Live.participation.Arrive`.
- Covered by [Participation](../design/compositions/live/participation.md), line 17.
- Covered by [Participation](../design/compositions/live/participation.md), line 90.

```reaction
when Sharing.open (token, subject: run), asked by Live.participation.Arrive
where
  view "(run) is a questionnaire run" with (run)
  earlier, RequestBoundary.request (path: "/live/p/arrive", requestId, token)
then
  RequestBoundary.respond (face: former "the face of (run)" with (run), requestId)
```

### Live.participation.Arrive:relay#2

Authored path: `Live.participation.Arrive`.
- Covered by [Participation](../design/compositions/live/participation.md), line 17.
- Covered by [Participation](../design/compositions/live/participation.md), line 90.

```reaction
when Sharing.open (token, subject: run), asked by Live.participation.Arrive
where
  view "(run) is a relay run" with (run)
  earlier, RequestBoundary.request (path: "/live/p/arrive", requestId, token)
then
  RequestBoundary.respond (relay: former "the face of relay run (run)" with (run), requestId)
```

### Live.participation.Begin

Authored path: `Live.participation.Begin`.
- Covered by [Participation](../design/compositions/live/participation.md), line 33.
- Covered by [Participation](../design/compositions/live/participation.md), line 91.

```reaction
when RequestBoundary.request (device, path: "/live/p/begin", requestId, token)
then
  Sharing.open (token)
```

### Live.participation.Begin:closed#2

Authored path: `Live.participation.Begin`.
- Covered by [Participation](../design/compositions/live/participation.md), line 33.
- Covered by [Participation](../design/compositions/live/participation.md), line 91.

```reaction
when Sharing.open (token, subject: run), asked by Live.participation.Begin
where
  view "(run) is closed" with (run)
  earlier, RequestBoundary.request (device, path: "/live/p/begin", requestId, token)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.participation.Begin:no-open-round#2

Authored path: `Live.participation.Begin`.
- Covered by [Participation](../design/compositions/live/participation.md), line 33.
- Covered by [Participation](../design/compositions/live/participation.md), line 91.

```reaction
when Sharing.open (token, subject: run), asked by Live.participation.Begin
where
  view "(run) is open to participation" with (run)
  view "(run) is a relay run" with (run)
  view "(run) has no round open" with (run)
  earlier, RequestBoundary.request (device, path: "/live/p/begin", requestId, token)
then
  RequestBoundary.respond (error: "NO_OPEN_ROUND", requestId)
```

### Live.participation.Begin:open#2

Authored path: `Live.participation.Begin`.
- Covered by [Participation](../design/compositions/live/participation.md), line 33.
- Covered by [Participation](../design/compositions/live/participation.md), line 91.

```reaction
when Sharing.open (token, subject: run), asked by Live.participation.Begin
where
  at is the current flow's instant
  view "(run) is open to participation" with (run)
  view "(run) is a questionnaire run" with (run)
  earlier, RequestBoundary.request (device, path: "/live/p/begin", requestId, token)
then
  Responding.begin (at, participant: device, subject: run)
```

### Live.participation.Begin:open#3

Authored path: `Live.participation.Begin`.
- Covered by [Participation](../design/compositions/live/participation.md), line 33.
- Covered by [Participation](../design/compositions/live/participation.md), line 91.

```reaction
when Responding.begin (at, participant: device, subject: run, response), asked by Live.participation.Begin:open#2
where
  earlier, RequestBoundary.request (device, path: "/live/p/begin", requestId, token)
then
  RequestBoundary.respond (participant: device, requestId, response)
```

### Live.participation.Begin:round#2

Authored path: `Live.participation.Begin`.
- Covered by [Participation](../design/compositions/live/participation.md), line 33.
- Covered by [Participation](../design/compositions/live/participation.md), line 91.

```reaction
when Sharing.open (token, subject: run), asked by Live.participation.Begin
where
  at is the current flow's instant
  view "(run) is open to participation" with (run)
  view "(run) is a relay run" with (run)
  view "the open round of (run)" with (run) has (round)
  earlier, RequestBoundary.request (device, path: "/live/p/begin", requestId, token)
then
  Responding.begin (at, participant: device, subject: round)
```

### Live.participation.Begin:round#3

Authored path: `Live.participation.Begin`.
- Covered by [Participation](../design/compositions/live/participation.md), line 33.
- Covered by [Participation](../design/compositions/live/participation.md), line 91.

```reaction
when Responding.begin (at, participant: device, subject: round, response), asked by Live.participation.Begin:round#2
where
  earlier, RequestBoundary.request (device, path: "/live/p/begin", requestId, token)
then
  RequestBoundary.respond (participant: device, requestId, response)
```

### Live.participation.BeginSigned

Authored path: `Live.participation.BeginSigned`.
- Covered by [Participation](../design/compositions/live/participation.md), line 35.
- Covered by [Participation](../design/compositions/live/participation.md), line 92.

```reaction
when RequestBoundary.request (path: "/live/p/begin-signed", requestId, session, token)
then
  Sharing.open (token)
```

### Live.participation.BeginSigned:closed#2

Authored path: `Live.participation.BeginSigned`.
- Covered by [Participation](../design/compositions/live/participation.md), line 35.
- Covered by [Participation](../design/compositions/live/participation.md), line 92.

```reaction
when Sharing.open (token, subject: run), asked by Live.participation.BeginSigned
where
  view "(run) is closed" with (run)
  earlier, RequestBoundary.request (path: "/live/p/begin-signed", requestId, session, token)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.participation.BeginSigned:no-open-round#2

Authored path: `Live.participation.BeginSigned`.
- Covered by [Participation](../design/compositions/live/participation.md), line 35.
- Covered by [Participation](../design/compositions/live/participation.md), line 92.

```reaction
when Sharing.open (token, subject: run), asked by Live.participation.BeginSigned
where
  view "(run) is open to participation" with (run)
  view "(run) is a relay run" with (run)
  view "(run) has no round open" with (run)
  earlier, RequestBoundary.request (path: "/live/p/begin-signed", requestId, session, token)
then
  RequestBoundary.respond (error: "NO_OPEN_ROUND", requestId)
```

### Live.participation.BeginSigned:open#2

Authored path: `Live.participation.BeginSigned`.
- Covered by [Participation](../design/compositions/live/participation.md), line 35.
- Covered by [Participation](../design/compositions/live/participation.md), line 92.

```reaction
when Sharing.open (token, subject: run), asked by Live.participation.BeginSigned
where
  at is the current flow's instant
  view "(run) is open to participation" with (run)
  view "(run) is a questionnaire run" with (run)
  earlier, RequestBoundary.request (path: "/live/p/begin-signed", requestId, session, token)
  view "the active user of (session)" with (session) has (user)
then
  Responding.begin (at, participant: user, subject: run)
```

### Live.participation.BeginSigned:open#3

Authored path: `Live.participation.BeginSigned`.
- Covered by [Participation](../design/compositions/live/participation.md), line 35.
- Covered by [Participation](../design/compositions/live/participation.md), line 92.

```reaction
when Responding.begin (at, participant: user, subject: run, response), asked by Live.participation.BeginSigned:open#2
where
  earlier, RequestBoundary.request (path: "/live/p/begin-signed", requestId, session, token)
then
  RequestBoundary.respond (participant: user, requestId, response)
```

### Live.participation.BeginSigned:round#2

Authored path: `Live.participation.BeginSigned`.
- Covered by [Participation](../design/compositions/live/participation.md), line 35.
- Covered by [Participation](../design/compositions/live/participation.md), line 92.

```reaction
when Sharing.open (token, subject: run), asked by Live.participation.BeginSigned
where
  at is the current flow's instant
  view "(run) is open to participation" with (run)
  view "(run) is a relay run" with (run)
  view "the open round of (run)" with (run) has (round)
  earlier, RequestBoundary.request (path: "/live/p/begin-signed", requestId, session, token)
  view "the active user of (session)" with (session) has (user)
then
  Responding.begin (at, participant: user, subject: round)
```

### Live.participation.BeginSigned:round#3

Authored path: `Live.participation.BeginSigned`.
- Covered by [Participation](../design/compositions/live/participation.md), line 35.
- Covered by [Participation](../design/compositions/live/participation.md), line 92.

```reaction
when Responding.begin (at, participant: user, subject: round, response), asked by Live.participation.BeginSigned:round#2
where
  earlier, RequestBoundary.request (path: "/live/p/begin-signed", requestId, session, token)
then
  RequestBoundary.respond (participant: user, requestId, response)
```

### Live.participation.Locate

Authored path: `Live.participation.Locate`.
- Covered by [Participation](../design/compositions/live/participation.md), line 10.
- Covered by [Participation](../design/compositions/live/participation.md), line 93.

```reaction
when RequestBoundary.request (code, path: "/live/p/locate", requestId)
then
  Locating.locate (code)
```

### Live.participation.Locate#2

Authored path: `Live.participation.Locate`.
- Covered by [Participation](../design/compositions/live/participation.md), line 10.
- Covered by [Participation](../design/compositions/live/participation.md), line 93.

```reaction
when Locating.locate (code, subject: run), asked by Live.participation.Locate
where
  Sharing._sharesFor (subject: run) has (token)
  earlier, RequestBoundary.request (code, path: "/live/p/locate", requestId)
then
  RequestBoundary.respond (requestId, token)
```

### Live.participation.Outcome:answers

Authored path: `Live.participation.Outcome`.
- Covered by [Participation](../design/compositions/live/participation.md), line 64.
- Covered by [Participation](../design/compositions/live/participation.md), line 94.

```reaction
when RequestBoundary.request (path: "/live/p/outcome", requestId, response)
where
  Responding._response (response) has (subject: run, submitted: true)
  Scoring._keyFor (subject: run) has (disclosure: "answers")
then
  RequestBoundary.respond (outcome: former "the answers outcome of (response)" with (response), received: true, requestId)
```

### Live.participation.Outcome:explanations

Authored path: `Live.participation.Outcome`.
- Covered by [Participation](../design/compositions/live/participation.md), line 64.
- Covered by [Participation](../design/compositions/live/participation.md), line 94.

```reaction
when RequestBoundary.request (path: "/live/p/outcome", requestId, response)
where
  Responding._response (response) has (subject: run, submitted: true)
  Scoring._keyFor (subject: run) has (disclosure: "explanations")
then
  RequestBoundary.respond (outcome: former "the explained outcome of (response)" with (response), received: true, requestId)
```

### Live.participation.Outcome:in-progress

Authored path: `Live.participation.Outcome`.
- Covered by [Participation](../design/compositions/live/participation.md), line 64.
- Covered by [Participation](../design/compositions/live/participation.md), line 94.

```reaction
when RequestBoundary.request (path: "/live/p/outcome", requestId, response)
where
  Responding._response (response) has (submitted: false)
then
  RequestBoundary.respond (error: "NOT_SUBMITTED", requestId)
```

### Live.participation.Outcome:score

Authored path: `Live.participation.Outcome`.
- Covered by [Participation](../design/compositions/live/participation.md), line 64.
- Covered by [Participation](../design/compositions/live/participation.md), line 94.

```reaction
when RequestBoundary.request (path: "/live/p/outcome", requestId, response)
where
  Responding._response (response) has (subject: run, submitted: true)
  Scoring._keyFor (subject: run) has (disclosure: "score")
then
  RequestBoundary.respond (outcome: former "the score outcome of (response)" with (response), received: true, requestId)
```

### Live.participation.Outcome:survey

Authored path: `Live.participation.Outcome`.
- Covered by [Participation](../design/compositions/live/participation.md), line 64.
- Covered by [Participation](../design/compositions/live/participation.md), line 94.

```reaction
when RequestBoundary.request (path: "/live/p/outcome", requestId, response)
where
  Responding._response (response) has (subject: run, submitted: true)
  no Scoring._keyFor (subject: run)
then
  RequestBoundary.respond (received: true, requestId)
```

### Live.participation.Submit:closed

Authored path: `Live.participation.Submit`.
- Covered by [Participation](../design/compositions/live/participation.md), line 55.
- Covered by [Participation](../design/compositions/live/participation.md), line 95.

```reaction
when RequestBoundary.request (path: "/live/p/submit", requestId, response)
where
  Responding._response (response) has (subject: run)
  view "(run) is closed" with (run)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.participation.Submit:quiz-incomplete

Authored path: `Live.participation.Submit`.
- Covered by [Participation](../design/compositions/live/participation.md), line 55.
- Covered by [Participation](../design/compositions/live/participation.md), line 95.

```reaction
when RequestBoundary.request (path: "/live/p/submit", requestId, response)
where
  Responding._response (response) has (subject: run)
  view "(run) is open to participation" with (run)
  RunSnapshotting._snapshot (subject: run) has (value: presentation)
  form is snapshotForm (value: presentation)
  form is among ["quiz"]
  view "(response) leaves a question unanswered" with (response)
then
  RequestBoundary.respond (error: "INCOMPLETE", requestId)
```

### Live.participation.Submit:quiz-whole

Authored path: `Live.participation.Submit`.
- Covered by [Participation](../design/compositions/live/participation.md), line 55.
- Covered by [Participation](../design/compositions/live/participation.md), line 95.

```reaction
when RequestBoundary.request (path: "/live/p/submit", requestId, response)
where
  at is the current flow's instant
  Responding._response (response) has (subject: run)
  view "(run) is open to participation" with (run)
  RunSnapshotting._snapshot (subject: run) has (value: presentation)
  form is snapshotForm (value: presentation)
  form is among ["quiz"]
  view "(response) answers every question" with (response)
then
  Responding.submit (at, response)
```

### Live.participation.Submit:quiz-whole#2

Authored path: `Live.participation.Submit`.
- Covered by [Participation](../design/compositions/live/participation.md), line 55.
- Covered by [Participation](../design/compositions/live/participation.md), line 95.

```reaction
when Responding.submit (at, response, result.response: submitted), asked by Live.participation.Submit:quiz-whole
where
  earlier, RequestBoundary.request (path: "/live/p/submit", requestId, response)
then
  RequestBoundary.respond (requestId, response: submitted)
```

### Live.participation.Submit:round-incomplete

Authored path: `Live.participation.Submit`.
- Covered by [Participation](../design/compositions/live/participation.md), line 55.
- Covered by [Participation](../design/compositions/live/participation.md), line 95.

```reaction
when RequestBoundary.request (path: "/live/p/submit", requestId, response)
where
  Responding._response (response) has (subject: run)
  view "(run) is open to participation" with (run)
  view "(run) is a round of a relay" with (run)
  view "(response) leaves a question unanswered" with (response)
then
  RequestBoundary.respond (error: "INCOMPLETE", requestId)
```

### Live.participation.Submit:round-whole

Authored path: `Live.participation.Submit`.
- Covered by [Participation](../design/compositions/live/participation.md), line 55.
- Covered by [Participation](../design/compositions/live/participation.md), line 95.

```reaction
when RequestBoundary.request (path: "/live/p/submit", requestId, response)
where
  at is the current flow's instant
  Responding._response (response) has (subject: run)
  view "(run) is open to participation" with (run)
  view "(run) is a round of a relay" with (run)
  view "(response) answers every question" with (response)
then
  Responding.submit (at, response)
```

### Live.participation.Submit:round-whole#2

Authored path: `Live.participation.Submit`.
- Covered by [Participation](../design/compositions/live/participation.md), line 55.
- Covered by [Participation](../design/compositions/live/participation.md), line 95.

```reaction
when Responding.submit (at, response, result.response: submitted), asked by Live.participation.Submit:round-whole
where
  earlier, RequestBoundary.request (path: "/live/p/submit", requestId, response)
then
  RequestBoundary.respond (requestId, response: submitted)
```

### Live.participation.Submit:survey

Authored path: `Live.participation.Submit`.
- Covered by [Participation](../design/compositions/live/participation.md), line 55.
- Covered by [Participation](../design/compositions/live/participation.md), line 95.

```reaction
when RequestBoundary.request (path: "/live/p/submit", requestId, response)
where
  at is the current flow's instant
  Responding._response (response) has (subject: run)
  view "(run) is open to participation" with (run)
  RunSnapshotting._snapshot (subject: run) has (value: presentation)
  form is snapshotForm (value: presentation)
  form is among ["survey"]
  no view "(run) is a round of a relay" with (run)
then
  Responding.submit (at, response)
```

### Live.participation.Submit:survey#2

Authored path: `Live.participation.Submit`.
- Covered by [Participation](../design/compositions/live/participation.md), line 55.
- Covered by [Participation](../design/compositions/live/participation.md), line 95.

```reaction
when Responding.submit (at, response, result.response: submitted), asked by Live.participation.Submit:survey
where
  earlier, RequestBoundary.request (path: "/live/p/submit", requestId, response)
then
  RequestBoundary.respond (requestId, response: submitted)
```

### Live.participation.SubmittedResponseIsGraded

Authored path: `Live.participation.SubmittedResponseIsGraded`.
- Covered by [Participation](../design/compositions/live/participation.md), line 62.

```reaction
when Responding.submit (response)
where
  Responding._response (response) has (subject: run)
  Scoring._keyFor (subject: run) has (key)
  Responding._collectedAnswers (response) has (answers)
then
  Scoring.grade (answers, key, submission: response)
```

### Live.participation.Wall:in-progress

Authored path: `Live.participation.Wall`.
- Covered by [Participation](../design/compositions/live/participation.md), line 79.
- Covered by [Participation](../design/compositions/live/participation.md), line 96.

```reaction
when RequestBoundary.request (path: "/live/p/wall", requestId, response)
where
  Responding._response (response) has (submitted: false)
then
  RequestBoundary.respond (error: "NOT_SUBMITTED", requestId)
```

### Live.participation.Wall:submitted

Authored path: `Live.participation.Wall`.
- Covered by [Participation](../design/compositions/live/participation.md), line 79.
- Covered by [Participation](../design/compositions/live/participation.md), line 96.

```reaction
when RequestBoundary.request (path: "/live/p/wall", requestId, response)
where
  Responding._response (response) has (subject: round, submitted: true)
then
  RequestBoundary.respond (requestId, wall: former "the wall of (round) as (viewer) sees it" with (round, viewer: response))
```

### Live.quizzes.AddQuestion:forbidden

Authored path: `Live.quizzes.AddQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 23.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 60.

```reaction
when RequestBoundary.request (choices, expected, explanation, path: "/live/quizzes/add-question", prompt, questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.quizzes.AddQuestion:round

Authored path: `Live.quizzes.AddQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 23.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 60.

```reaction
when RequestBoundary.request (choices, expected, explanation, path: "/live/quizzes/add-question", prompt, questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._legFor (material: questionnaire)
then
  RequestBoundary.respond (error: "QUESTIONNAIRE_NOT_FOUND", requestId)
```

### Live.quizzes.AddQuestion:run-open

Authored path: `Live.quizzes.AddQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 23.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 60.

```reaction
when RequestBoundary.request (choices, expected, explanation, path: "/live/quizzes/add-question", prompt, questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has an open run" with (questionnaire)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.quizzes.AddQuestion:success

Authored path: `Live.quizzes.AddQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 23.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 60.

```reaction
when RequestBoundary.request (choices, expected, explanation, path: "/live/quizzes/add-question", prompt, questionnaire, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
  view "the question count of (questionnaire)" with (questionnaire) has (total: standing)
  position is positionAfter (position: standing)
then
  Questioning.addQuestion (choices, expected, explanation, position, prompt, questionnaire)
```

### Live.quizzes.AddQuestion:success#2

Authored path: `Live.quizzes.AddQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 23.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 60.

```reaction
when Questioning.addQuestion (choices, expected, explanation, position, prompt, questionnaire, question), asked by Live.quizzes.AddQuestion:success
where
  earlier, RequestBoundary.request (choices, expected, explanation, path: "/live/quizzes/add-question", prompt, questionnaire, requestId, session)
then
  RequestBoundary.respond (question, requestId)
```

### Live.quizzes.Create:forbidden

Authored path: `Live.quizzes.Create`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 12.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 61.

```reaction
when RequestBoundary.request (disclosure, form, path: "/live/quizzes/create", requestId, session, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.quizzes.Create:success

Authored path: `Live.quizzes.Create`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 12.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 61.

```reaction
when RequestBoundary.request (disclosure, form, path: "/live/quizzes/create", requestId, session, title)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  Questioning.compose (at, author: user, disclosure, form, title)
```

### Live.quizzes.Create:success#2

Authored path: `Live.quizzes.Create`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 12.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 61.

```reaction
when Questioning.compose (at, author: user, disclosure, form, title, questionnaire), asked by Live.quizzes.Create:success
where
  earlier, RequestBoundary.request (disclosure, form, path: "/live/quizzes/create", requestId, session, title)
then
  RequestBoundary.respond (questionnaire, requestId)
```

### Live.quizzes.Get:forbidden

Authored path: `Live.quizzes.Get`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 54.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 62.

```reaction
when RequestBoundary.request (path: "/live/quizzes/get", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.quizzes.Get:round

Authored path: `Live.quizzes.Get`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 54.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 62.

```reaction
when RequestBoundary.request (path: "/live/quizzes/get", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._legFor (material: questionnaire)
then
  RequestBoundary.respond (error: "QUESTIONNAIRE_NOT_FOUND", requestId)
```

### Live.quizzes.Get:success

Authored path: `Live.quizzes.Get`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 54.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 62.

```reaction
when RequestBoundary.request (path: "/live/quizzes/get", questionnaire, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._legFor (material: questionnaire)
then
  RequestBoundary.respond (questionnaire: former "the questionnaire (questionnaire)" with (questionnaire), requestId)
```

### Live.quizzes.List:forbidden

Authored path: `Live.quizzes.List`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 49.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 63.

```reaction
when RequestBoundary.request (path: "/live/quizzes/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.quizzes.List:success

Authored path: `Live.quizzes.List`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 49.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 63.

```reaction
when RequestBoundary.request (path: "/live/quizzes/list", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  RequestBoundary.respond (questionnaires: former "the questionnaires", requestId)
```

### Live.quizzes.LowerQuestion:at-edge

Authored path: `Live.quizzes.LowerQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 37.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 64.

```reaction
when RequestBoundary.request (path: "/live/quizzes/lower-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (position, questionnaire)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
  view "the question count of (questionnaire)" with (questionnaire) has (total: standing)
  position is at least standing
then
  RequestBoundary.respond (error: "AT_EDGE", requestId)
```

### Live.quizzes.LowerQuestion:forbidden

Authored path: `Live.quizzes.LowerQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 37.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 64.

```reaction
when RequestBoundary.request (path: "/live/quizzes/lower-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.quizzes.LowerQuestion:missing

Authored path: `Live.quizzes.LowerQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 37.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 64.

```reaction
when RequestBoundary.request (path: "/live/quizzes/lower-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Questioning._getQuestion (question)
then
  RequestBoundary.respond (error: "QUESTION_NOT_FOUND", requestId)
```

### Live.quizzes.LowerQuestion:round

Authored path: `Live.quizzes.LowerQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 37.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 64.

```reaction
when RequestBoundary.request (path: "/live/quizzes/lower-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (questionnaire)
  Relaying._legFor (material: questionnaire)
then
  RequestBoundary.respond (error: "QUESTIONNAIRE_NOT_FOUND", requestId)
```

### Live.quizzes.LowerQuestion:run-open

Authored path: `Live.quizzes.LowerQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 37.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 64.

```reaction
when RequestBoundary.request (path: "/live/quizzes/lower-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (questionnaire)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has an open run" with (questionnaire)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.quizzes.LowerQuestion:success

Authored path: `Live.quizzes.LowerQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 37.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 64.

```reaction
when RequestBoundary.request (path: "/live/quizzes/lower-question", question, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (position, questionnaire)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
  view "the question count of (questionnaire)" with (questionnaire) has (total: standing)
  position is less than standing
  target is positionAfter (position)
  Questioning._getQuestions (questionnaire) has (position: target, question: neighbor)
then
  Questioning.swapQuestions (other: neighbor, question)
```

### Live.quizzes.LowerQuestion:success#2

Authored path: `Live.quizzes.LowerQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 37.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 64.

```reaction
when Questioning.swapQuestions (other: neighbor, question), asked by Live.quizzes.LowerQuestion:success
where
  earlier, RequestBoundary.request (path: "/live/quizzes/lower-question", question, requestId, session)
then
  RequestBoundary.respond (question, requestId)
```

### Live.quizzes.RaiseQuestion:at-edge

Authored path: `Live.quizzes.RaiseQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 36.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 65.

```reaction
when RequestBoundary.request (path: "/live/quizzes/raise-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (position: 1, questionnaire)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
then
  RequestBoundary.respond (error: "AT_EDGE", requestId)
```

### Live.quizzes.RaiseQuestion:forbidden

Authored path: `Live.quizzes.RaiseQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 36.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 65.

```reaction
when RequestBoundary.request (path: "/live/quizzes/raise-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.quizzes.RaiseQuestion:missing

Authored path: `Live.quizzes.RaiseQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 36.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 65.

```reaction
when RequestBoundary.request (path: "/live/quizzes/raise-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Questioning._getQuestion (question)
then
  RequestBoundary.respond (error: "QUESTION_NOT_FOUND", requestId)
```

### Live.quizzes.RaiseQuestion:round

Authored path: `Live.quizzes.RaiseQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 36.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 65.

```reaction
when RequestBoundary.request (path: "/live/quizzes/raise-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (questionnaire)
  Relaying._legFor (material: questionnaire)
then
  RequestBoundary.respond (error: "QUESTIONNAIRE_NOT_FOUND", requestId)
```

### Live.quizzes.RaiseQuestion:run-open

Authored path: `Live.quizzes.RaiseQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 36.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 65.

```reaction
when RequestBoundary.request (path: "/live/quizzes/raise-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (questionnaire)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has an open run" with (questionnaire)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.quizzes.RaiseQuestion:success

Authored path: `Live.quizzes.RaiseQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 36.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 65.

```reaction
when RequestBoundary.request (path: "/live/quizzes/raise-question", question, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (position, questionnaire)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
  position is greater than 1
  target is positionBefore (position)
  Questioning._getQuestions (questionnaire) has (position: target, question: neighbor)
then
  Questioning.swapQuestions (other: neighbor, question)
```

### Live.quizzes.RaiseQuestion:success#2

Authored path: `Live.quizzes.RaiseQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 36.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 65.

```reaction
when Questioning.swapQuestions (other: neighbor, question), asked by Live.quizzes.RaiseQuestion:success
where
  earlier, RequestBoundary.request (path: "/live/quizzes/raise-question", question, requestId, session)
then
  RequestBoundary.respond (question, requestId)
```

### Live.quizzes.RemoveQuestion:forbidden

Authored path: `Live.quizzes.RemoveQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 25.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 66.

```reaction
when RequestBoundary.request (path: "/live/quizzes/remove-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.quizzes.RemoveQuestion:missing

Authored path: `Live.quizzes.RemoveQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 25.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 66.

```reaction
when RequestBoundary.request (path: "/live/quizzes/remove-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Questioning._getQuestion (question)
then
  RequestBoundary.respond (error: "QUESTION_NOT_FOUND", requestId)
```

### Live.quizzes.RemoveQuestion:round

Authored path: `Live.quizzes.RemoveQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 25.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 66.

```reaction
when RequestBoundary.request (path: "/live/quizzes/remove-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (questionnaire)
  Relaying._legFor (material: questionnaire)
then
  RequestBoundary.respond (error: "QUESTIONNAIRE_NOT_FOUND", requestId)
```

### Live.quizzes.RemoveQuestion:run-open

Authored path: `Live.quizzes.RemoveQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 25.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 66.

```reaction
when RequestBoundary.request (path: "/live/quizzes/remove-question", question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (questionnaire)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has an open run" with (questionnaire)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.quizzes.RemoveQuestion:success

Authored path: `Live.quizzes.RemoveQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 25.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 66.

```reaction
when RequestBoundary.request (path: "/live/quizzes/remove-question", question, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (questionnaire)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
then
  Questioning.removeQuestion (question)
```

### Live.quizzes.RemoveQuestion:success#2

Authored path: `Live.quizzes.RemoveQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 25.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 66.

```reaction
when Questioning.removeQuestion (question, result.question: removed), asked by Live.quizzes.RemoveQuestion:success
where
  earlier, RequestBoundary.request (path: "/live/quizzes/remove-question", question, requestId, session)
then
  RequestBoundary.respond (question: removed, requestId)
```

### Live.quizzes.RemovedQuestionClosesRanks

Authored path: `Live.quizzes.RemovedQuestionClosesRanks`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 33.

```reaction
when Questioning.removeQuestion (question, position, questionnaire)
where
  Questioning._getQuestions (questionnaire) has (choices: laterChoices, expected: laterExpected, explanation: laterExplanation, position: laterAt, prompt: laterPrompt, question: later)
  laterAt is greater than position
  closed is positionBefore (position: laterAt)
then
  Questioning.reviseQuestion (choices: laterChoices, expected: laterExpected, explanation: laterExplanation, position: closed, prompt: laterPrompt, question: later)
```

### Live.quizzes.Retire:forbidden

Authored path: `Live.quizzes.Retire`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 20.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 67.

```reaction
when RequestBoundary.request (path: "/live/quizzes/retire", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.quizzes.Retire:round

Authored path: `Live.quizzes.Retire`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 20.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 67.

```reaction
when RequestBoundary.request (path: "/live/quizzes/retire", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._legFor (material: questionnaire)
then
  RequestBoundary.respond (error: "QUESTIONNAIRE_NOT_FOUND", requestId)
```

### Live.quizzes.Retire:run-open

Authored path: `Live.quizzes.Retire`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 20.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 67.

```reaction
when RequestBoundary.request (path: "/live/quizzes/retire", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has an open run" with (questionnaire)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.quizzes.Retire:success

Authored path: `Live.quizzes.Retire`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 20.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 67.

```reaction
when RequestBoundary.request (path: "/live/quizzes/retire", questionnaire, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
then
  Questioning.retire (questionnaire)
```

### Live.quizzes.Retire:success#2

Authored path: `Live.quizzes.Retire`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 20.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 67.

```reaction
when Questioning.retire (questionnaire, result.questionnaire: retired), asked by Live.quizzes.Retire:success
where
  earlier, RequestBoundary.request (path: "/live/quizzes/retire", questionnaire, requestId, session)
then
  RequestBoundary.respond (questionnaire: retired, requestId)
```

### Live.quizzes.Retitle:forbidden

Authored path: `Live.quizzes.Retitle`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 18.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 68.

```reaction
when RequestBoundary.request (path: "/live/quizzes/retitle", questionnaire, requestId, session, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.quizzes.Retitle:round

Authored path: `Live.quizzes.Retitle`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 18.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 68.

```reaction
when RequestBoundary.request (path: "/live/quizzes/retitle", questionnaire, requestId, session, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._legFor (material: questionnaire)
then
  RequestBoundary.respond (error: "QUESTIONNAIRE_NOT_FOUND", requestId)
```

### Live.quizzes.Retitle:run-open

Authored path: `Live.quizzes.Retitle`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 18.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 68.

```reaction
when RequestBoundary.request (path: "/live/quizzes/retitle", questionnaire, requestId, session, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has an open run" with (questionnaire)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.quizzes.Retitle:success

Authored path: `Live.quizzes.Retitle`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 18.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 68.

```reaction
when RequestBoundary.request (path: "/live/quizzes/retitle", questionnaire, requestId, session, title)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
then
  Questioning.retitle (questionnaire, title)
```

### Live.quizzes.Retitle:success#2

Authored path: `Live.quizzes.Retitle`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 18.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 68.

```reaction
when Questioning.retitle (questionnaire, title, result.questionnaire: retitled), asked by Live.quizzes.Retitle:success
where
  earlier, RequestBoundary.request (path: "/live/quizzes/retitle", questionnaire, requestId, session, title)
then
  RequestBoundary.respond (questionnaire: retitled, requestId)
```

### Live.quizzes.ReviseQuestion:forbidden

Authored path: `Live.quizzes.ReviseQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 24.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 69.

```reaction
when RequestBoundary.request (choices, expected, explanation, path: "/live/quizzes/revise-question", prompt, question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.quizzes.ReviseQuestion:missing

Authored path: `Live.quizzes.ReviseQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 24.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 69.

```reaction
when RequestBoundary.request (choices, expected, explanation, path: "/live/quizzes/revise-question", prompt, question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Questioning._getQuestion (question)
then
  RequestBoundary.respond (error: "QUESTION_NOT_FOUND", requestId)
```

### Live.quizzes.ReviseQuestion:round

Authored path: `Live.quizzes.ReviseQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 24.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 69.

```reaction
when RequestBoundary.request (choices, expected, explanation, path: "/live/quizzes/revise-question", prompt, question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (questionnaire)
  Relaying._legFor (material: questionnaire)
then
  RequestBoundary.respond (error: "QUESTIONNAIRE_NOT_FOUND", requestId)
```

### Live.quizzes.ReviseQuestion:run-open

Authored path: `Live.quizzes.ReviseQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 24.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 69.

```reaction
when RequestBoundary.request (choices, expected, explanation, path: "/live/quizzes/revise-question", prompt, question, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (questionnaire)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has an open run" with (questionnaire)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.quizzes.ReviseQuestion:success

Authored path: `Live.quizzes.ReviseQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 24.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 69.

```reaction
when RequestBoundary.request (choices, expected, explanation, path: "/live/quizzes/revise-question", prompt, question, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Questioning._getQuestion (question) has (position, questionnaire)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
then
  Questioning.reviseQuestion (choices, expected, explanation, position, prompt, question)
```

### Live.quizzes.ReviseQuestion:success#2

Authored path: `Live.quizzes.ReviseQuestion`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 24.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 69.

```reaction
when Questioning.reviseQuestion (choices, expected, explanation, position, prompt, question, result.question: revised), asked by Live.quizzes.ReviseQuestion:success
where
  earlier, RequestBoundary.request (choices, expected, explanation, path: "/live/quizzes/revise-question", prompt, question, requestId, session)
then
  RequestBoundary.respond (question: revised, requestId)
```

### Live.quizzes.SetDisclosure:forbidden

Authored path: `Live.quizzes.SetDisclosure`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 19.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 70.

```reaction
when RequestBoundary.request (disclosure, path: "/live/quizzes/set-disclosure", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.quizzes.SetDisclosure:round

Authored path: `Live.quizzes.SetDisclosure`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 19.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 70.

```reaction
when RequestBoundary.request (disclosure, path: "/live/quizzes/set-disclosure", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._legFor (material: questionnaire)
then
  RequestBoundary.respond (error: "QUESTIONNAIRE_NOT_FOUND", requestId)
```

### Live.quizzes.SetDisclosure:run-open

Authored path: `Live.quizzes.SetDisclosure`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 19.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 70.

```reaction
when RequestBoundary.request (disclosure, path: "/live/quizzes/set-disclosure", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has an open run" with (questionnaire)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.quizzes.SetDisclosure:success

Authored path: `Live.quizzes.SetDisclosure`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 19.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 70.

```reaction
when RequestBoundary.request (disclosure, path: "/live/quizzes/set-disclosure", questionnaire, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._legFor (material: questionnaire)
  view "(questionnaire) has no open run" with (questionnaire)
then
  Questioning.setDisclosure (disclosure, questionnaire)
```

### Live.quizzes.SetDisclosure:success#2

Authored path: `Live.quizzes.SetDisclosure`.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 19.
- Covered by [Quizzes and surveys](../design/compositions/live/quizzes.md), line 70.

```reaction
when Questioning.setDisclosure (disclosure, questionnaire, result.questionnaire: changed), asked by Live.quizzes.SetDisclosure:success
where
  earlier, RequestBoundary.request (disclosure, path: "/live/quizzes/set-disclosure", questionnaire, requestId, session)
then
  RequestBoundary.respond (questionnaire: changed, requestId)
```

### Live.relays.AddRound:forbidden

Authored path: `Live.relays.AddRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 74.

```reaction
when RequestBoundary.request (cap, choices, parts, path: "/live/relays/add-round", prompt, relay, requestId, session, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.AddRound:missing

Authored path: `Live.relays.AddRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 74.

```reaction
when RequestBoundary.request (cap, choices, parts, path: "/live/relays/add-round", prompt, relay, requestId, session, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._relay (relay)
then
  RequestBoundary.respond (error: "RELAY_NOT_FOUND", requestId)
```

### Live.relays.AddRound:retired

Authored path: `Live.relays.AddRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 74.

```reaction
when RequestBoundary.request (cap, choices, parts, path: "/live/relays/add-round", prompt, relay, requestId, session, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._relay (relay)
  view "(relay) is retired" with (relay)
then
  RequestBoundary.respond (error: "RELAY_RETIRED", requestId)
```

### Live.relays.AddRound:success

Authored path: `Live.relays.AddRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 74.

```reaction
when RequestBoundary.request (cap, choices, parts, path: "/live/relays/add-round", prompt, relay, requestId, session, title)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._relay (relay)
  view "(relay) is not retired" with (relay)
then
  Questioning.compose (at, author: user, disclosure: "score", form: "survey", title)
```

### Live.relays.AddRound:success#2

Authored path: `Live.relays.AddRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 74.

```reaction
when Questioning.compose (at, author: user, disclosure: "score", form: "survey", title, questionnaire), asked by Live.relays.AddRound:success
where
  earlier, RequestBoundary.request (cap, choices, parts, path: "/live/relays/add-round", prompt, relay, requestId, session, title)
then
  Questioning.addQuestion (choices, expected: "", explanation: "", position: 1, prompt, questionnaire)
```

### Live.relays.AddRound:success#3

Authored path: `Live.relays.AddRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 74.

```reaction
when Questioning.addQuestion (choices, expected: "", explanation: "", position: 1, prompt, questionnaire, question), asked by Live.relays.AddRound:success#2
where
  earlier, RequestBoundary.request (cap, choices, parts, path: "/live/relays/add-round", prompt, relay, requestId, session, title)
then
  Questioning.setParts (cap, parts, question)
```

### Live.relays.AddRound:success#4

Authored path: `Live.relays.AddRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 74.

```reaction
when Questioning.setParts (cap, parts, question), asked by Live.relays.AddRound:success#3
where
  earlier, Questioning.compose (at, author: user, disclosure: "score", form: "survey", title, questionnaire), asked by Live.relays.AddRound:success
  earlier, RequestBoundary.request (cap, choices, parts, path: "/live/relays/add-round", prompt, relay, requestId, session, title)
then
  Relaying.addLeg (material: questionnaire, relay)
```

### Live.relays.AddRound:success#5

Authored path: `Live.relays.AddRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 74.

```reaction
when Relaying.addLeg (material: questionnaire, relay, leg, position), asked by Live.relays.AddRound:success#4
where
  earlier, Questioning.addQuestion (choices, expected: "", explanation: "", position: 1, prompt, questionnaire, question), asked by Live.relays.AddRound:success#2
  earlier, RequestBoundary.request (cap, choices, parts, path: "/live/relays/add-round", prompt, relay, requestId, session, title)
then
  RequestBoundary.respond (leg, position, question, questionnaire, requestId)
```

### Live.relays.CapturedRoundSeatsParticipants

Authored path: `Live.relays.CapturedRoundSeatsParticipants`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 37.

```reaction
when RunSnapshotting.capture (subject: round)
where
  at is the current flow's instant
  view "the run of (round)" with (round) has (run)
  Subscribing._getSubscribers (target: run) has (user: participant)
  view "(participant)'s seat is not dismissed" with (participant)
then
  Responding.begin (at, participant, subject: round)
```

### Live.relays.ClearTakes:forbidden

Authored path: `Live.relays.ClearTakes`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 75.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/clear-takes", requestId, session, source)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.ClearTakes:missing

Authored path: `Live.relays.ClearTakes`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 75.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/clear-takes", requestId, session, source)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._leg (leg)
then
  RequestBoundary.respond (error: "LEG_NOT_FOUND", requestId)
```

### Live.relays.ClearTakes:retired

Authored path: `Live.relays.ClearTakes`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 75.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/clear-takes", requestId, session, source)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._leg (leg) has (relay)
  view "(relay) is retired" with (relay)
then
  RequestBoundary.respond (error: "RELAY_RETIRED", requestId)
```

### Live.relays.ClearTakes:success

Authored path: `Live.relays.ClearTakes`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 75.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/clear-takes", requestId, session, source)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._leg (leg) has (relay)
  view "(relay) is not retired" with (relay)
then
  Relaying.undraw (leg, source)
```

### Live.relays.ClearTakes:success#2

Authored path: `Live.relays.ClearTakes`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 75.

```reaction
when Relaying.undraw (leg, source, result.leg: cleared), asked by Live.relays.ClearTakes:success
where
  earlier, RequestBoundary.request (leg, path: "/live/relays/clear-takes", requestId, session, source)
then
  RequestBoundary.respond (leg: cleared, requestId)
```

### Live.relays.Close:bare

Authored path: `Live.relays.Close`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 31.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 76.

```reaction
when RequestBoundary.request (path: "/live/relays/close", requestId, run, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(run) is open to participation" with (run)
  view "(run) has no round open" with (run)
then
  Publishing.close (at, edition: run)
```

### Live.relays.Close:bare#2

Authored path: `Live.relays.Close`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 31.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 76.

```reaction
when Publishing.close (at, edition: run, result.edition: closed), asked by Live.relays.Close:bare
where
  earlier, RequestBoundary.request (path: "/live/relays/close", requestId, run, session)
then
  RequestBoundary.respond (requestId, run: closed)
```

### Live.relays.Close:forbidden

Authored path: `Live.relays.Close`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 31.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 76.

```reaction
when RequestBoundary.request (path: "/live/relays/close", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.Close:with-round

Authored path: `Live.relays.Close`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 31.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 76.

```reaction
when RequestBoundary.request (path: "/live/relays/close", requestId, run, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "the open round of (run)" with (run) has (round)
then
  Publishing.close (at, edition: round)
```

### Live.relays.Close:with-round#2

Authored path: `Live.relays.Close`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 31.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 76.

```reaction
when Publishing.close (at, edition: round, result.edition: closedRound), asked by Live.relays.Close:with-round
where
  earlier, RequestBoundary.request (path: "/live/relays/close", requestId, run, session)
then
  Publishing.close (at, edition: run)
```

### Live.relays.Close:with-round#3

Authored path: `Live.relays.Close`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 31.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 76.

```reaction
when Publishing.close (at, edition: run, result.edition: closed), asked by Live.relays.Close:with-round#2
where
  earlier, RequestBoundary.request (path: "/live/relays/close", requestId, run, session)
then
  RequestBoundary.respond (requestId, run: closed)
```

### Live.relays.CloseRound:forbidden

Authored path: `Live.relays.CloseRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 31.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 77.

```reaction
when RequestBoundary.request (path: "/live/relays/close-round", requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.CloseRound:success

Authored path: `Live.relays.CloseRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 31.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 77.

```reaction
when RequestBoundary.request (path: "/live/relays/close-round", requestId, round, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  Publishing.close (at, edition: round)
```

### Live.relays.CloseRound:success#2

Authored path: `Live.relays.CloseRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 31.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 77.

```reaction
when Publishing.close (at, edition: round, result.edition: closed), asked by Live.relays.CloseRound:success
where
  earlier, RequestBoundary.request (path: "/live/relays/close-round", requestId, round, session)
then
  RequestBoundary.respond (requestId, round: closed)
```

### Live.relays.Dismiss:already-dismissed

Authored path: `Live.relays.Dismiss`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 37.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 78.

```reaction
when RequestBoundary.request (participant, path: "/live/relays/dismiss", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(participant) holds a seat on (run)" with (participant, run)
  no view "(participant)'s seat is not dismissed" with (participant)
then
  RequestBoundary.respond (participant, requestId)
```

### Live.relays.Dismiss:forbidden

Authored path: `Live.relays.Dismiss`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 37.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 78.

```reaction
when RequestBoundary.request (participant, path: "/live/relays/dismiss", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.Dismiss:not-seated

Authored path: `Live.relays.Dismiss`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 37.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 78.

```reaction
when RequestBoundary.request (participant, path: "/live/relays/dismiss", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no view "(participant) holds a seat on (run)" with (participant, run)
then
  RequestBoundary.respond (error: "NOT_SEATED", requestId)
```

### Live.relays.Dismiss:success

Authored path: `Live.relays.Dismiss`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 37.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 78.

```reaction
when RequestBoundary.request (participant, path: "/live/relays/dismiss", requestId, run, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(participant) holds a seat on (run)" with (participant, run)
  view "(participant)'s seat is not dismissed" with (participant)
then
  Trashing.trash (at, by: user, item: participant)
```

### Live.relays.Dismiss:success#2

Authored path: `Live.relays.Dismiss`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 37.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 78.

```reaction
when Trashing.trash (at, by: user, item: participant), asked by Live.relays.Dismiss:success
where
  earlier, RequestBoundary.request (participant, path: "/live/relays/dismiss", requestId, run, session)
then
  RequestBoundary.respond (participant, requestId)
```

### Live.relays.Get:forbidden

Authored path: `Live.relays.Get`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 23.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 79.

```reaction
when RequestBoundary.request (path: "/live/relays/get", relay, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.Get:success

Authored path: `Live.relays.Get`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 23.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 79.

```reaction
when RequestBoundary.request (path: "/live/relays/get", relay, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  RequestBoundary.respond (relay: former "the relay (relay)" with (relay), requestId)
```

### Live.relays.Invite:closed

Authored path: `Live.relays.Invite`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 37.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 80.

```reaction
when RequestBoundary.request (device, path: "/live/relays/invite", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(run) is closed" with (run)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.relays.Invite:forbidden

Authored path: `Live.relays.Invite`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 37.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 80.

```reaction
when RequestBoundary.request (device, path: "/live/relays/invite", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.Invite:success

Authored path: `Live.relays.Invite`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 37.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 80.

```reaction
when RequestBoundary.request (device, path: "/live/relays/invite", requestId, run, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(run) is open to participation" with (run)
then
  Subscribing.subscribe (at, target: run, user: device)
```

### Live.relays.Invite:success#2

Authored path: `Live.relays.Invite`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 37.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 80.

```reaction
when Subscribing.subscribe (at, target: run, user: device), asked by Live.relays.Invite:success
where
  earlier, RequestBoundary.request (device, path: "/live/relays/invite", requestId, run, session)
then
  RequestBoundary.respond (participant: device, requestId)
```

### Live.relays.Launch:forbidden

Authored path: `Live.relays.Launch`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 27.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 81.

```reaction
when RequestBoundary.request (path: "/live/relays/launch", relay, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.Launch:missing

Authored path: `Live.relays.Launch`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 27.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 81.

```reaction
when RequestBoundary.request (path: "/live/relays/launch", relay, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._relay (relay)
then
  RequestBoundary.respond (error: "RELAY_NOT_FOUND", requestId)
```

### Live.relays.Launch:retired

Authored path: `Live.relays.Launch`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 27.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 81.

```reaction
when RequestBoundary.request (path: "/live/relays/launch", relay, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._relay (relay)
  view "(relay) is retired" with (relay)
then
  RequestBoundary.respond (error: "RELAY_RETIRED", requestId)
```

### Live.relays.Launch:success

Authored path: `Live.relays.Launch`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 27.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 81.

```reaction
when RequestBoundary.request (path: "/live/relays/launch", relay, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._relay (relay)
  view "(relay) is not retired" with (relay)
then
  Publishing.publish (at, author: user, material: relay)
```

### Live.relays.Launch:success#2

Authored path: `Live.relays.Launch`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 27.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 81.

```reaction
when Publishing.publish (at, author: user, material: relay, edition: run), asked by Live.relays.Launch:success
then
  Sharing.issue (subject: run)
```

### Live.relays.Launch:success#3

Authored path: `Live.relays.Launch`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 27.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 81.

```reaction
when Sharing.issue (subject: run, token), asked by Live.relays.Launch:success#2
then
  Locating.ensure (subject: run)
```

### Live.relays.Launch:success#4

Authored path: `Live.relays.Launch`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 27.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 81.

```reaction
when Locating.ensure (subject: run, code), asked by Live.relays.Launch:success#3
where
  earlier, Sharing.issue (subject: run, token), asked by Live.relays.Launch:success#2
  earlier, RequestBoundary.request (path: "/live/relays/launch", relay, requestId, session)
then
  RequestBoundary.respond (code, requestId, run, token)
```

### Live.relays.List:forbidden

Authored path: `Live.relays.List`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 23.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 82.

```reaction
when RequestBoundary.request (path: "/live/relays/list", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.List:success

Authored path: `Live.relays.List`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 23.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 82.

```reaction
when RequestBoundary.request (path: "/live/relays/list", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  RequestBoundary.respond (relays: former "the relays", requestId)
```

### Live.relays.MoveRound:forbidden

Authored path: `Live.relays.MoveRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 83.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/move-round", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.MoveRound:missing

Authored path: `Live.relays.MoveRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 83.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/move-round", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._leg (leg)
then
  RequestBoundary.respond (error: "LEG_NOT_FOUND", requestId)
```

### Live.relays.MoveRound:retired

Authored path: `Live.relays.MoveRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 83.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/move-round", position, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._leg (leg) has (relay)
  view "(relay) is retired" with (relay)
then
  RequestBoundary.respond (error: "RELAY_RETIRED", requestId)
```

### Live.relays.MoveRound:success

Authored path: `Live.relays.MoveRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 83.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/move-round", position, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._leg (leg) has (relay)
  view "(relay) is not retired" with (relay)
then
  Relaying.moveLeg (leg, position)
```

### Live.relays.MoveRound:success#2

Authored path: `Live.relays.MoveRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 83.

```reaction
when Relaying.moveLeg (leg, position, result.leg: moved, result.position: placed), asked by Live.relays.MoveRound:success
where
  earlier, RequestBoundary.request (leg, path: "/live/relays/move-round", position, requestId, session)
then
  RequestBoundary.respond (leg: moved, position: placed, requestId)
```

### Live.relays.OpenRound:plain

Authored path: `Live.relays.OpenRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 84.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/open-round", requestId, run, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(run) is open to participation" with (run)
  view "(leg) is a round of (run)" with (leg, run)
  view "(run) has no round open" with (run)
  view "(leg) has not run in (run)" with (leg, run)
  view "every round (leg) takes from has closed in (run)" with (leg, run)
  view "(leg) takes nothing" with (leg)
  Relaying._leg (leg) has (material: questionnaire)
then
  Publishing.publish (at, author: user, material: questionnaire)
```

### Live.relays.OpenRound:plain#2

Authored path: `Live.relays.OpenRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 84.

```reaction
when Publishing.publish (at, author: user, material: questionnaire, edition: round), asked by Live.relays.OpenRound:plain
where
  earlier, RequestBoundary.request (leg, path: "/live/relays/open-round", requestId, run, session)
  tie is soleTarget (target: run)
then
  Linking.setLinks (source: round, targets: tie)
```

### Live.relays.OpenRound:plain#3

Authored path: `Live.relays.OpenRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 84.

```reaction
when Linking.setLinks (source: round, targets: tie), asked by Live.relays.OpenRound:plain#2
where
  earlier, RequestBoundary.request (leg, path: "/live/relays/open-round", requestId, run, session)
then
  RequestBoundary.respond (requestId, round)
```

### Live.relays.OpenRound:taking

Authored path: `Live.relays.OpenRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 84.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/open-round", requestId, run, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(run) is open to participation" with (run)
  view "(leg) is a round of (run)" with (leg, run)
  view "(run) has no round open" with (run)
  view "(leg) has not run in (run)" with (leg, run)
  view "every round (leg) takes from has closed in (run)" with (leg, run)
  view "what (leg) takes" with (leg) has (source)
  view "the round of (leg) in (run)" with (leg: source, run) has (round: sourceRound)
  view "(round) has piles picked" with (round: sourceRound)
  Relaying._leg (leg) has (material: questionnaire)
then
  Publishing.publish (at, author: user, material: questionnaire)
```

### Live.relays.OpenRound:taking#2

Authored path: `Live.relays.OpenRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 84.

```reaction
when Publishing.publish (at, author: user, material: questionnaire, edition: round), asked by Live.relays.OpenRound:taking
where
  earlier, RequestBoundary.request (leg, path: "/live/relays/open-round", requestId, run, session)
  tie is soleTarget (target: run)
then
  Linking.setLinks (source: round, targets: tie)
```

### Live.relays.OpenRound:taking#3

Authored path: `Live.relays.OpenRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 84.

```reaction
when Linking.setLinks (source: round, targets: tie), asked by Live.relays.OpenRound:taking#2
where
  earlier, RequestBoundary.request (leg, path: "/live/relays/open-round", requestId, run, session)
then
  RequestBoundary.respond (requestId, round)
```

### Live.relays.OpenRoundRefused:closed

Authored path: `Live.relays.OpenRoundRefused`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 85.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/open-round", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(run) is closed" with (run)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.relays.OpenRoundRefused:forbidden

Authored path: `Live.relays.OpenRoundRefused`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 85.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/open-round", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.OpenRoundRefused:not-of-run

Authored path: `Live.relays.OpenRoundRefused`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 85.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/open-round", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(leg) is not a round of (run)" with (leg, run)
then
  RequestBoundary.respond (error: "LEG_NOT_FOUND", requestId)
```

### Live.relays.OpenRoundRefused:nothing-picked

Authored path: `Live.relays.OpenRoundRefused`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 85.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/open-round", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(run) is open to participation" with (run)
  view "(leg) is a round of (run)" with (leg, run)
  view "(run) has no round open" with (run)
  view "(leg) has not run in (run)" with (leg, run)
  view "every round (leg) takes from has closed in (run)" with (leg, run)
  view "what (leg) takes" with (leg) has (source)
  view "the round of (leg) in (run)" with (leg: source, run) has (round: sourceRound)
  view "(round) has no piles picked" with (round: sourceRound)
then
  RequestBoundary.respond (error: "NOTHING_PICKED", requestId)
```

### Live.relays.OpenRoundRefused:round-done

Authored path: `Live.relays.OpenRoundRefused`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 85.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/open-round", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(run) is open to participation" with (run)
  view "(leg) is a round of (run)" with (leg, run)
  view "(run) has no round open" with (run)
  view "(leg) already ran in (run)" with (leg, run)
then
  RequestBoundary.respond (error: "ROUND_DONE", requestId)
```

### Live.relays.OpenRoundRefused:round-open

Authored path: `Live.relays.OpenRoundRefused`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 85.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/open-round", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(run) is open to participation" with (run)
  view "(leg) is a round of (run)" with (leg, run)
  view "(run) has a round open" with (run)
then
  RequestBoundary.respond (error: "ROUND_OPEN", requestId)
```

### Live.relays.OpenRoundRefused:source-open

Authored path: `Live.relays.OpenRoundRefused`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 85.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/open-round", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(run) is open to participation" with (run)
  view "(leg) is a round of (run)" with (leg, run)
  view "(run) has no round open" with (run)
  view "(leg) has not run in (run)" with (leg, run)
  view "(leg) takes from a round not yet closed in (run)" with (leg, run)
then
  RequestBoundary.respond (error: "SOURCE_OPEN", requestId)
```

### Live.relays.Plan:forbidden

Authored path: `Live.relays.Plan`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 86.

```reaction
when RequestBoundary.request (path: "/live/relays/plan", requestId, session, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.Plan:success

Authored path: `Live.relays.Plan`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 86.

```reaction
when RequestBoundary.request (path: "/live/relays/plan", requestId, session, title)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  Relaying.plan (at, author: user, title)
```

### Live.relays.Plan:success#2

Authored path: `Live.relays.Plan`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 86.

```reaction
when Relaying.plan (at, author: user, title, relay), asked by Live.relays.Plan:success
where
  earlier, RequestBoundary.request (path: "/live/relays/plan", requestId, session, title)
then
  RequestBoundary.respond (relay, requestId)
```

### Live.relays.RemoveRound:forbidden

Authored path: `Live.relays.RemoveRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 87.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/remove-round", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.RemoveRound:retired

Authored path: `Live.relays.RemoveRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 87.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/remove-round", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._leg (leg) has (relay)
  view "(relay) is retired" with (relay)
then
  RequestBoundary.respond (error: "RELAY_RETIRED", requestId)
```

### Live.relays.RemoveRound:run-open

Authored path: `Live.relays.RemoveRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 87.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/remove-round", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._leg (leg) has (material: questionnaire)
  view "(questionnaire) has an open run" with (questionnaire)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.relays.RemoveRound:success

Authored path: `Live.relays.RemoveRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 87.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/remove-round", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._leg (leg) has (material: questionnaire, relay)
  view "(relay) is not retired" with (relay)
  view "(questionnaire) has no open run" with (questionnaire)
then
  Relaying.removeLeg (leg)
```

### Live.relays.RemoveRound:success#2

Authored path: `Live.relays.RemoveRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 87.

```reaction
when Relaying.removeLeg (leg, result.leg: removed, material), asked by Live.relays.RemoveRound:success
then
  Questioning.retire (questionnaire: material)
```

### Live.relays.RemoveRound:success#3

Authored path: `Live.relays.RemoveRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 87.

```reaction
when Questioning.retire (questionnaire: material), asked by Live.relays.RemoveRound:success#2
where
  earlier, Relaying.removeLeg (leg, result.leg: removed, material), asked by Live.relays.RemoveRound:success
  earlier, RequestBoundary.request (leg, path: "/live/relays/remove-round", requestId, session)
then
  RequestBoundary.respond (leg: removed, requestId)
```

### Live.relays.Retire:forbidden

Authored path: `Live.relays.Retire`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 88.

```reaction
when RequestBoundary.request (path: "/live/relays/retire", relay, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.Retire:missing

Authored path: `Live.relays.Retire`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 88.

```reaction
when RequestBoundary.request (path: "/live/relays/retire", relay, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._relay (relay)
then
  RequestBoundary.respond (error: "RELAY_NOT_FOUND", requestId)
```

### Live.relays.Retire:retired

Authored path: `Live.relays.Retire`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 88.

```reaction
when RequestBoundary.request (path: "/live/relays/retire", relay, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._relay (relay)
  view "(relay) is retired" with (relay)
then
  RequestBoundary.respond (error: "RELAY_RETIRED", requestId)
```

### Live.relays.Retire:run-open

Authored path: `Live.relays.Retire`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 88.

```reaction
when RequestBoundary.request (path: "/live/relays/retire", relay, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._relay (relay)
  view "(relay) has an open run" with (relay)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.relays.Retire:success

Authored path: `Live.relays.Retire`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 88.

```reaction
when RequestBoundary.request (path: "/live/relays/retire", relay, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._relay (relay)
  view "(relay) has no open run" with (relay)
  view "(relay) is not retired" with (relay)
then
  Trashing.trash (at, by: user, item: relay)
```

### Live.relays.Retire:success#2

Authored path: `Live.relays.Retire`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 88.

```reaction
when Trashing.trash (at, by: user, item: relay, result.item: retired), asked by Live.relays.Retire:success
where
  earlier, RequestBoundary.request (path: "/live/relays/retire", relay, requestId, session)
then
  RequestBoundary.respond (relay: retired, requestId)
```

### Live.relays.Retitle:forbidden

Authored path: `Live.relays.Retitle`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 89.

```reaction
when RequestBoundary.request (path: "/live/relays/retitle", relay, requestId, session, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.Retitle:missing

Authored path: `Live.relays.Retitle`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 89.

```reaction
when RequestBoundary.request (path: "/live/relays/retitle", relay, requestId, session, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._relay (relay)
then
  RequestBoundary.respond (error: "RELAY_NOT_FOUND", requestId)
```

### Live.relays.Retitle:retired

Authored path: `Live.relays.Retitle`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 89.

```reaction
when RequestBoundary.request (path: "/live/relays/retitle", relay, requestId, session, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._relay (relay)
  view "(relay) is retired" with (relay)
then
  RequestBoundary.respond (error: "RELAY_RETIRED", requestId)
```

### Live.relays.Retitle:success

Authored path: `Live.relays.Retitle`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 89.

```reaction
when RequestBoundary.request (path: "/live/relays/retitle", relay, requestId, session, title)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._relay (relay)
  view "(relay) is not retired" with (relay)
then
  Relaying.retitle (relay, title)
```

### Live.relays.Retitle:success#2

Authored path: `Live.relays.Retitle`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 89.

```reaction
when Relaying.retitle (relay, title, result.relay: retitled), asked by Live.relays.Retitle:success
where
  earlier, RequestBoundary.request (path: "/live/relays/retitle", relay, requestId, session, title)
then
  RequestBoundary.respond (relay: retitled, requestId)
```

### Live.relays.ReviseRound

Authored path: `Live.relays.ReviseRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 90.

```reaction
when RequestBoundary.request (cap, choices, leg, parts, path: "/live/relays/revise-round", prompt, requestId, session, title)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._leg (leg) has (material: questionnaire, relay)
  view "(relay) is not retired" with (relay)
  view "(questionnaire) has no open run" with (questionnaire)
then
  Questioning.retitle (questionnaire, title)
```

### Live.relays.ReviseRound#2

Authored path: `Live.relays.ReviseRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 90.

```reaction
when Questioning.retitle (questionnaire, title), asked by Live.relays.ReviseRound
where
  earlier, RequestBoundary.request (cap, choices, leg, parts, path: "/live/relays/revise-round", prompt, requestId, session, title)
  Relaying._leg (leg) has (material)
  Questioning._getQuestions (questionnaire: material) has (question)
then
  Questioning.setParts (cap: 0, parts: [], question)
```

### Live.relays.ReviseRound#3

Authored path: `Live.relays.ReviseRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 90.

```reaction
when Questioning.setParts (cap: 0, parts: [], question, result.question: held), asked by Live.relays.ReviseRound#2
where
  Questioning._getQuestion (question: held) has (position)
  earlier, RequestBoundary.request (cap, choices, leg, parts, path: "/live/relays/revise-round", prompt, requestId, session, title)
then
  Questioning.reviseQuestion (choices, expected: "", explanation: "", position, prompt, question: held)
```

### Live.relays.ReviseRound#4

Authored path: `Live.relays.ReviseRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 90.

```reaction
when Questioning.reviseQuestion (choices, expected: "", explanation: "", position, prompt, question: held, result.question: revised), asked by Live.relays.ReviseRound#3
where
  earlier, RequestBoundary.request (cap, choices, leg, parts, path: "/live/relays/revise-round", prompt, requestId, session, title)
then
  Questioning.setParts (cap, parts, question: revised)
```

### Live.relays.ReviseRound#5

Authored path: `Live.relays.ReviseRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 90.

```reaction
when Questioning.setParts (cap, parts, question: revised, result.question: again), asked by Live.relays.ReviseRound#4
where
  earlier, RequestBoundary.request (cap, choices, leg, parts, path: "/live/relays/revise-round", prompt, requestId, session, title)
then
  RequestBoundary.respond (question: again, requestId)
```

### Live.relays.ReviseRoundRefused:forbidden

Authored path: `Live.relays.ReviseRoundRefused`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 91.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/revise-round", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.ReviseRoundRefused:missing

Authored path: `Live.relays.ReviseRoundRefused`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 91.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/revise-round", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._leg (leg)
then
  RequestBoundary.respond (error: "LEG_NOT_FOUND", requestId)
```

### Live.relays.ReviseRoundRefused:retired

Authored path: `Live.relays.ReviseRoundRefused`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 91.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/revise-round", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._leg (leg) has (relay)
  view "(relay) is retired" with (relay)
then
  RequestBoundary.respond (error: "RELAY_RETIRED", requestId)
```

### Live.relays.ReviseRoundRefused:run-open

Authored path: `Live.relays.ReviseRoundRefused`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 91.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/revise-round", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._leg (leg) has (material: questionnaire)
  view "(questionnaire) has an open run" with (questionnaire)
then
  RequestBoundary.respond (error: "RUN_OPEN", requestId)
```

### Live.relays.Run:forbidden

Authored path: `Live.relays.Run`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 33.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 92.

```reaction
when RequestBoundary.request (path: "/live/relays/run", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.Run:success

Authored path: `Live.relays.Run`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 33.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 92.

```reaction
when RequestBoundary.request (path: "/live/relays/run", requestId, run, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  RequestBoundary.respond (requestId, run: former "the run (run)" with (run))
```

### Live.relays.SeatedParticipantAnswersOpenRound

Authored path: `Live.relays.SeatedParticipantAnswersOpenRound`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 37.

```reaction
when Subscribing.subscribe (target: run, user: participant)
where
  at is the current flow's instant
  view "(run) is a relay run" with (run)
  view "the open round of (run)" with (run) has (round)
then
  Responding.begin (at, participant, subject: round)
```

### Live.relays.SetTakes:forbidden

Authored path: `Live.relays.SetTakes`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 93.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/set-takes", requestId, session, shape, source)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.SetTakes:missing

Authored path: `Live.relays.SetTakes`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 93.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/set-takes", requestId, session, shape, source)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Relaying._leg (leg)
then
  RequestBoundary.respond (error: "LEG_NOT_FOUND", requestId)
```

### Live.relays.SetTakes:retired

Authored path: `Live.relays.SetTakes`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 93.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/set-takes", requestId, session, shape, source)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._leg (leg) has (relay)
  view "(relay) is retired" with (relay)
then
  RequestBoundary.respond (error: "RELAY_RETIRED", requestId)
```

### Live.relays.SetTakes:success

Authored path: `Live.relays.SetTakes`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 93.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/set-takes", requestId, session, shape, source)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._leg (leg) has (material: questionnaire, relay)
  view "(relay) is not retired" with (relay)
  Questioning._getQuestions (questionnaire) has (choices, parts)
  fit is useFit (choices, parts, use: shape)
  fit is among ["open"]
then
  Relaying.draw (leg, shape, source)
```

### Live.relays.SetTakes:success#2

Authored path: `Live.relays.SetTakes`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 93.

```reaction
when Relaying.draw (leg, shape, source, draw), asked by Live.relays.SetTakes:success
where
  earlier, RequestBoundary.request (leg, path: "/live/relays/set-takes", requestId, session, shape, source)
then
  RequestBoundary.respond (draw, requestId)
```

### Live.relays.SetTakes:use-not-open

Authored path: `Live.relays.SetTakes`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 7.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 93.

```reaction
when RequestBoundary.request (leg, path: "/live/relays/set-takes", requestId, session, shape, source)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Relaying._leg (leg) has (material: questionnaire, relay)
  view "(relay) is not retired" with (relay)
  Questioning._getQuestions (questionnaire) has (choices, parts)
  fit is useFit (choices, parts, use: shape)
  fit is among ["closed", "unknown"]
then
  RequestBoundary.respond (error: "INVALID_USE", requestId)
```

### Live.relays.TiedRoundCapturesPresentation:choices

Authored path: `Live.relays.TiedRoundCapturesPresentation`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.

```reaction
when Linking.setLinks (source: round)
where
  Publishing._edition (edition: round) has (material: questionnaire)
  Relaying._legFor (material: questionnaire) has (leg)
  Linking._getLinks (source: round) has (target: run)
  view "what (leg) takes" with (leg) has (shape: "choices", source)
  view "the round of (leg) in (run)" with (leg: source, run) has (round: carried)
then
  RunSnapshotting.capture (subject: round, value: former "the presentation of (leg) taking from (sourceRound)" with (leg, sourceRound: carried))
```

### Live.relays.TiedRoundCapturesPresentation:context

Authored path: `Live.relays.TiedRoundCapturesPresentation`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.

```reaction
when Linking.setLinks (source: round)
where
  Publishing._edition (edition: round) has (material: questionnaire)
  Relaying._legFor (material: questionnaire) has (leg)
  Linking._getLinks (source: round) has (target: run)
  view "what (leg) takes" with (leg) has (shape: "context", source)
  view "the round of (leg) in (run)" with (leg: source, run) has (round: carried)
then
  RunSnapshotting.capture (subject: round, value: former "the presentation of (leg) showing (sourceRound)" with (leg, sourceRound: carried))
```

### Live.relays.TiedRoundCapturesPresentation:parts

Authored path: `Live.relays.TiedRoundCapturesPresentation`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.

```reaction
when Linking.setLinks (source: round)
where
  Publishing._edition (edition: round) has (material: questionnaire)
  Relaying._legFor (material: questionnaire) has (leg)
  Linking._getLinks (source: round) has (target: run)
  view "what (leg) takes" with (leg) has (shape: "parts", source)
  view "the round of (leg) in (run)" with (leg: source, run) has (round: carried)
then
  RunSnapshotting.capture (subject: round, value: former "the presentation of (leg) taking parts from (sourceRound)" with (leg, sourceRound: carried))
```

### Live.relays.TiedRoundCapturesPresentation:plain

Authored path: `Live.relays.TiedRoundCapturesPresentation`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 29.

```reaction
when Linking.setLinks (source: round)
where
  Publishing._edition (edition: round) has (material: questionnaire)
  Relaying._legFor (material: questionnaire) has (leg)
  view "(leg) takes nothing" with (leg)
then
  RunSnapshotting.capture (subject: round, value: former "the presentation of (leg)" with (leg))
```

### Live.relays.Uses:forbidden

Authored path: `Live.relays.Uses`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 19.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 94.

```reaction
when RequestBoundary.request (path: "/live/relays/uses", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.relays.Uses:success

Authored path: `Live.relays.Uses`.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 19.
- Covered by [Relays and their runs](../design/compositions/live/relays.md), line 94.

```reaction
when RequestBoundary.request (path: "/live/relays/uses", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  uses is carryUses
then
  RequestBoundary.respond (requestId, uses)
```

### Live.runs.Close:forbidden

Authored path: `Live.runs.Close`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 42.
- Covered by [Live runs](../design/compositions/live/runs.md), line 94.

```reaction
when RequestBoundary.request (path: "/live/runs/close", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.runs.Close:success

Authored path: `Live.runs.Close`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 42.
- Covered by [Live runs](../design/compositions/live/runs.md), line 94.

```reaction
when RequestBoundary.request (path: "/live/runs/close", requestId, run, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  Publishing.close (at, edition: run)
```

### Live.runs.Close:success#2

Authored path: `Live.runs.Close`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 42.
- Covered by [Live runs](../design/compositions/live/runs.md), line 94.

```reaction
when Publishing.close (at, edition: run, result.edition: closed), asked by Live.runs.Close:success
where
  earlier, RequestBoundary.request (path: "/live/runs/close", requestId, run, session)
then
  RequestBoundary.respond (requestId, run: closed)
```

### Live.runs.Launch

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when RequestBoundary.request (path: "/live/runs/launch", questionnaire, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  Questioning.present (questionnaire)
```

### Live.runs.Launch:quiz#2

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when Questioning.present (questionnaire, disclosure, expectations, form, presentation, proposes), asked by Live.runs.Launch
where
  at is the current flow's instant
  no Relaying._legFor (material: questionnaire)
  form is among ["quiz"]
  proposes is among [true]
  earlier, RequestBoundary.request (path: "/live/runs/launch", questionnaire, requestId, session)
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  Publishing.publish (at, author: user, material: questionnaire)
```

### Live.runs.Launch:quiz#3

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when Publishing.publish (at, author: user, material: questionnaire, edition: run), asked by Live.runs.Launch:quiz#2
where
  earlier, Questioning.present (questionnaire, disclosure, expectations, form, presentation, proposes), asked by Live.runs.Launch
then
  RunSnapshotting.capture (subject: run, value: presentation)
```

### Live.runs.Launch:quiz#4

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when RunSnapshotting.capture (subject: run, value: presentation, snapshot), asked by Live.runs.Launch:quiz#3
where
  earlier, Questioning.present (questionnaire, disclosure, expectations, form, presentation, proposes), asked by Live.runs.Launch
then
  Scoring.establish (disclosure, expectations, subject: run)
```

### Live.runs.Launch:quiz#5

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when Scoring.establish (disclosure, expectations, subject: run, key), asked by Live.runs.Launch:quiz#4
then
  Sharing.issue (subject: run)
```

### Live.runs.Launch:quiz#6

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when Sharing.issue (subject: run, token), asked by Live.runs.Launch:quiz#5
then
  Locating.ensure (subject: run)
```

### Live.runs.Launch:quiz#7

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when Locating.ensure (subject: run, code), asked by Live.runs.Launch:quiz#6
where
  earlier, Sharing.issue (subject: run, token), asked by Live.runs.Launch:quiz#5
  earlier, RequestBoundary.request (path: "/live/runs/launch", questionnaire, requestId, session)
then
  RequestBoundary.respond (code, requestId, run, token)
```

### Live.runs.Launch:round#2

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when Questioning.present (questionnaire, disclosure, expectations, form, presentation, proposes), asked by Live.runs.Launch
where
  Relaying._legFor (material: questionnaire)
  earlier, RequestBoundary.request (path: "/live/runs/launch", questionnaire, requestId, session)
then
  RequestBoundary.respond (error: "QUESTIONNAIRE_NOT_FOUND", requestId)
```

### Live.runs.Launch:survey#2

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when Questioning.present (questionnaire, disclosure, expectations, form, presentation, proposes), asked by Live.runs.Launch
where
  at is the current flow's instant
  no Relaying._legFor (material: questionnaire)
  form is among ["survey"]
  earlier, RequestBoundary.request (path: "/live/runs/launch", questionnaire, requestId, session)
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  Publishing.publish (at, author: user, material: questionnaire)
```

### Live.runs.Launch:survey#3

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when Publishing.publish (at, author: user, material: questionnaire, edition: run), asked by Live.runs.Launch:survey#2
where
  earlier, Questioning.present (questionnaire, disclosure, expectations, form, presentation, proposes), asked by Live.runs.Launch
then
  RunSnapshotting.capture (subject: run, value: presentation)
```

### Live.runs.Launch:survey#4

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when RunSnapshotting.capture (subject: run, value: presentation, snapshot), asked by Live.runs.Launch:survey#3
then
  Sharing.issue (subject: run)
```

### Live.runs.Launch:survey#5

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when Sharing.issue (subject: run, token), asked by Live.runs.Launch:survey#4
then
  Locating.ensure (subject: run)
```

### Live.runs.Launch:survey#6

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when Locating.ensure (subject: run, code), asked by Live.runs.Launch:survey#5
where
  earlier, Sharing.issue (subject: run, token), asked by Live.runs.Launch:survey#4
  earlier, RequestBoundary.request (path: "/live/runs/launch", questionnaire, requestId, session)
then
  RequestBoundary.respond (code, requestId, run, token)
```

### Live.runs.Launch:unready-quiz#2

Authored path: `Live.runs.Launch`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 7.
- Covered by [Live runs](../design/compositions/live/runs.md), line 95.

```reaction
when Questioning.present (questionnaire, disclosure, expectations, form, presentation, proposes), asked by Live.runs.Launch
where
  no Relaying._legFor (material: questionnaire)
  form is among ["quiz"]
  proposes is among [false]
  earlier, RequestBoundary.request (path: "/live/runs/launch", questionnaire, requestId, session)
then
  RequestBoundary.respond (error: "NOT_QUIZ_READY", requestId)
```

### Live.runs.LaunchForbidden

Authored path: `Live.runs.LaunchForbidden`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 16.
- Covered by [Live runs](../design/compositions/live/runs.md), line 96.

```reaction
when RequestBoundary.request (path: "/live/runs/launch", questionnaire, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.runs.OpenRuns:forbidden

Authored path: `Live.runs.OpenRuns`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 46.
- Covered by [Live runs](../design/compositions/live/runs.md), line 97.

```reaction
when RequestBoundary.request (path: "/live/runs/open", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.runs.OpenRuns:success

Authored path: `Live.runs.OpenRuns`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 46.
- Covered by [Live runs](../design/compositions/live/runs.md), line 97.

```reaction
when RequestBoundary.request (path: "/live/runs/open", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  RequestBoundary.respond (requestId, runs: former "the open runs")
```

### Live.runs.Results:forbidden

Authored path: `Live.runs.Results`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 51.
- Covered by [Live runs](../design/compositions/live/runs.md), line 98.

```reaction
when RequestBoundary.request (path: "/live/runs/results", requestId, run, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.runs.Results:quiz

Authored path: `Live.runs.Results`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 51.
- Covered by [Live runs](../design/compositions/live/runs.md), line 98.

```reaction
when RequestBoundary.request (path: "/live/runs/results", requestId, run, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  Scoring._keyFor (subject: run)
then
  RequestBoundary.respond (board: former "the board of (run)" with (run), requestId, scores: former "the scores of (run)" with (run))
```

### Live.runs.Results:survey

Authored path: `Live.runs.Results`.
- Covered by [Live runs](../design/compositions/live/runs.md), line 51.
- Covered by [Live runs](../design/compositions/live/runs.md), line 98.

```reaction
when RequestBoundary.request (path: "/live/runs/results", requestId, run, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  no Scoring._keyFor (subject: run)
then
  RequestBoundary.respond (board: former "the board of (run)" with (run), requestId)
```

### Live.walls.BegunModelResponseAsksMind

Authored path: `Live.walls.BegunModelResponseAsksMind`.
- Covered by [The wall](../design/compositions/live/walls.md), line 25.

```reaction
when Responding.begin (participant, subject: round, response)
where
  at is the current flow's instant
  view "the run of (round)" with (round) has (run)
  view "(participant) holds a seat on (run)" with (participant, run)
  RunSnapshotting._snapshot (subject: round) has (value)
  passage is participantPassage (participant, value)
then
  Reasoning.ask (about: response, at, passage, reasoner: "gemini-flash")
```

### Live.walls.ComplaintRetriesTheAsk

Authored path: `Live.walls.ComplaintRetriesTheAsk`.
- Covered by [The wall](../design/compositions/live/walls.md), line 17.

```reaction
when Insisting.complain (account, aim: round, offering)
where
  at is the current flow's instant
  view "(round) is a round with a captured question" with (round)
  Insisting._standingFor (aim: round)
  RunSnapshotting._snapshot (subject: round) has (value)
  Categorizing._categoriesWithItems (scope: round) has (categories)
  Responding._valuesForSubject (subject: round) has (values)
  passage is placingRepairPassage (account, categories, offering, value, values)
then
  Reasoning.ask (about: round, at, passage, reasoner: "gemini-flash")
```

### Live.walls.DescribePile:closed

Authored path: `Live.walls.DescribePile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 21.
- Covered by [The wall](../design/compositions/live/walls.md), line 91.

```reaction
when RequestBoundary.request (description, path: "/live/walls/describe-pile", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is on the wall of a closed run" with (pile)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.walls.DescribePile:forbidden

Authored path: `Live.walls.DescribePile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 21.
- Covered by [The wall](../design/compositions/live/walls.md), line 91.

```reaction
when RequestBoundary.request (description, path: "/live/walls/describe-pile", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.walls.DescribePile:success

Authored path: `Live.walls.DescribePile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 21.
- Covered by [The wall](../design/compositions/live/walls.md), line 91.

```reaction
when RequestBoundary.request (description, path: "/live/walls/describe-pile", pile, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is not on the wall of a closed run" with (pile)
then
  Categorizing.describeCategory (category: pile, description)
```

### Live.walls.DescribePile:success#2

Authored path: `Live.walls.DescribePile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 21.
- Covered by [The wall](../design/compositions/live/walls.md), line 91.

```reaction
when Categorizing.describeCategory (category: pile, description, result.category: described), asked by Live.walls.DescribePile:success
where
  earlier, RequestBoundary.request (description, path: "/live/walls/describe-pile", pile, requestId, session)
then
  RequestBoundary.respond (pile: described, requestId)
```

### Live.walls.FailedAskGivesUp

Authored path: `Live.walls.FailedAskGivesUp`.
- Covered by [The wall](../design/compositions/live/walls.md), line 17.

```reaction
when Reasoning.fail (asking)
where
  Reasoning._asking (asking) has (about: round)
  view "(round) is a round with a captured question" with (round)
  Insisting._unsettledFor (aim: round)
then
  Insisting.giveUp (aim: round)
```

### Live.walls.HandedInBallotsJoinTheirPiles

Authored path: `Live.walls.HandedInBallotsJoinTheirPiles`.
- Covered by [The wall](../design/compositions/live/walls.md), line 3.

```reaction
when Responding.submit (response)
where
  Responding._response (response) has (subject: round)
  view "(round) is a round with a captured question" with (round)
  RunSnapshotting._snapshot (subject: round) has (value: presentation)
  Responding._answers (response) has (item, value)
  kind is answerKind (answer: value, value: presentation)
  kind is among ["choice"]
  card is cardId (item, response)
then
  Categorizing.file (item: card, name: value, scope: round)
```

### Live.walls.MergePile:closed

Authored path: `Live.walls.MergePile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 92.

```reaction
when RequestBoundary.request (into, path: "/live/walls/merge-pile", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is on the wall of a closed run" with (pile)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.walls.MergePile:forbidden

Authored path: `Live.walls.MergePile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 92.

```reaction
when RequestBoundary.request (into, path: "/live/walls/merge-pile", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.walls.MergePile:success

Authored path: `Live.walls.MergePile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 92.

```reaction
when RequestBoundary.request (into, path: "/live/walls/merge-pile", pile, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is not on the wall of a closed run" with (pile)
then
  Categorizing.mergeCategory (category: pile, into)
```

### Live.walls.MergePile:success#2

Authored path: `Live.walls.MergePile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 92.

```reaction
when Categorizing.mergeCategory (category: pile, into, result.into: merged), asked by Live.walls.MergePile:success
where
  earlier, RequestBoundary.request (into, path: "/live/walls/merge-pile", pile, requestId, session)
then
  RequestBoundary.respond (pile: merged, requestId)
```

### Live.walls.MergedPileIsUnpicked

Authored path: `Live.walls.MergedPileIsUnpicked`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.

```reaction
when Categorizing.mergeCategory (category)
then
  Pinning.clearItem (item: category)
```

### Live.walls.MoveCard:closed

Authored path: `Live.walls.MoveCard`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 93.

```reaction
when RequestBoundary.request (card, path: "/live/walls/move-card", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is on the wall of a closed run" with (pile)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.walls.MoveCard:forbidden

Authored path: `Live.walls.MoveCard`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 93.

```reaction
when RequestBoundary.request (card, path: "/live/walls/move-card", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.walls.MoveCard:missing

Authored path: `Live.walls.MoveCard`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 93.

```reaction
when RequestBoundary.request (card, path: "/live/walls/move-card", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is no pile" with (pile)
then
  RequestBoundary.respond (error: "CATEGORY_NOT_FOUND", requestId)
```

### Live.walls.MoveCard:no-such-card

Authored path: `Live.walls.MoveCard`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 93.

```reaction
when RequestBoundary.request (card, path: "/live/walls/move-card", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is a pile" with (pile)
  view "(pile) is not on the wall of a closed run" with (pile)
  Categorizing._getCategoryDetail (category: pile) has (scope: round)
  no view "(card) is a card of (round)" with (card, round)
then
  RequestBoundary.respond (error: "CARD_NOT_FOUND", requestId)
```

### Live.walls.MoveCard:success

Authored path: `Live.walls.MoveCard`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 93.

```reaction
when RequestBoundary.request (card, path: "/live/walls/move-card", pile, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is a pile" with (pile)
  view "(pile) is not on the wall of a closed run" with (pile)
  Categorizing._getCategoryDetail (category: pile) has (scope: round)
  view "(card) is a card of (round)" with (card, round)
then
  Categorizing.assign (category: pile, item: card)
```

### Live.walls.MoveCard:success#2

Authored path: `Live.walls.MoveCard`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 93.

```reaction
when Categorizing.assign (category: pile, item: card, result.item: assigned), asked by Live.walls.MoveCard:success
where
  earlier, RequestBoundary.request (card, path: "/live/walls/move-card", pile, requestId, session)
then
  RequestBoundary.respond (card: assigned, pile, requestId)
```

### Live.walls.OpenPile:closed

Authored path: `Live.walls.OpenPile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 94.

```reaction
when RequestBoundary.request (card, name, path: "/live/walls/open-pile", requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is of a closed run" with (round)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.walls.OpenPile:forbidden

Authored path: `Live.walls.OpenPile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 94.

```reaction
when RequestBoundary.request (card, name, path: "/live/walls/open-pile", requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.walls.OpenPile:no-such-card

Authored path: `Live.walls.OpenPile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 94.

```reaction
when RequestBoundary.request (card, name, path: "/live/walls/open-pile", requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is not of a closed run" with (round)
  no view "(card) is a card of (round)" with (card, round)
then
  RequestBoundary.respond (error: "CARD_NOT_FOUND", requestId)
```

### Live.walls.OpenPile:success

Authored path: `Live.walls.OpenPile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 94.

```reaction
when RequestBoundary.request (card, name, path: "/live/walls/open-pile", requestId, round, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is not of a closed run" with (round)
  view "(card) is a card of (round)" with (card, round)
then
  Categorizing.ensureCategory (description: "", name, scope: round)
```

### Live.walls.OpenPile:success#2

Authored path: `Live.walls.OpenPile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 94.

```reaction
when Categorizing.ensureCategory (description: "", name, scope: round, category), asked by Live.walls.OpenPile:success
where
  earlier, RequestBoundary.request (card, name, path: "/live/walls/open-pile", requestId, round, session)
then
  Categorizing.assign (category, item: card)
```

### Live.walls.OpenPile:success#3

Authored path: `Live.walls.OpenPile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 94.

```reaction
when Categorizing.assign (category, item: card, result.item: assigned), asked by Live.walls.OpenPile:success#2
where
  earlier, RequestBoundary.request (card, name, path: "/live/walls/open-pile", requestId, round, session)
then
  RequestBoundary.respond (card: assigned, pile: category, requestId)
```

### Live.walls.Pick:already-picked

Authored path: `Live.walls.Pick`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 95.

```reaction
when RequestBoundary.request (path: "/live/walls/pick", pile, requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is not of a closed run" with (round)
  view "(pile) is on the wall of (round)" with (pile, round)
  Pinning._isPinned (item: pile, scope: round) has (pinned: true)
then
  RequestBoundary.respond (pile, requestId)
```

### Live.walls.Pick:closed

Authored path: `Live.walls.Pick`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 95.

```reaction
when RequestBoundary.request (path: "/live/walls/pick", pile, requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is of a closed run" with (round)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.walls.Pick:forbidden

Authored path: `Live.walls.Pick`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 95.

```reaction
when RequestBoundary.request (path: "/live/walls/pick", pile, requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.walls.Pick:missing

Authored path: `Live.walls.Pick`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 95.

```reaction
when RequestBoundary.request (path: "/live/walls/pick", pile, requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is not of a closed run" with (round)
  no view "(pile) is on the wall of (round)" with (pile, round)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Live.walls.Pick:success

Authored path: `Live.walls.Pick`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 95.

```reaction
when RequestBoundary.request (path: "/live/walls/pick", pile, requestId, round, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is not of a closed run" with (round)
  view "(pile) is on the wall of (round)" with (pile, round)
  Pinning._isPinned (item: pile, scope: round) has (pinned: false)
  view "the pick count of (round)" with (round) has (taken)
  priority is pickPriority (count: taken)
then
  Pinning.pin (at, item: pile, priority, scope: round)
```

### Live.walls.Pick:success#2

Authored path: `Live.walls.Pick`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 95.

```reaction
when Pinning.pin (at, item: pile, priority, scope: round), asked by Live.walls.Pick:success
where
  earlier, RequestBoundary.request (path: "/live/walls/pick", pile, requestId, round, session)
then
  RequestBoundary.respond (pile, requestId)
```

### Live.walls.PlacedReplySatisfiesInsistence

Authored path: `Live.walls.PlacedReplySatisfiesInsistence`.
- Covered by [The wall](../design/compositions/live/walls.md), line 17.

```reaction
when Suggesting.offer (subject: round)
where
  view "(round) is a round with a captured question" with (round)
  Insisting._unsettledFor (aim: round)
then
  Insisting.satisfy (aim: round)
```

### Live.walls.PlacingOfferingIsTaken

Authored path: `Live.walls.PlacingOfferingIsTaken`.
- Covered by [The wall](../design/compositions/live/walls.md), line 15.

```reaction
when Suggesting.offer (subject: round, offering)
where
  view "(round) is a round with a captured question" with (round)
  Suggesting._pendingIn (offering) has (suggestion)
then
  Suggesting.take (suggestion)
```

### Live.walls.Read:forbidden

Authored path: `Live.walls.Read`.
- Covered by [The wall](../design/compositions/live/walls.md), line 5.
- Covered by [The wall](../design/compositions/live/walls.md), line 97.

```reaction
when RequestBoundary.request (path: "/live/walls/read", requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.walls.Read:success

Authored path: `Live.walls.Read`.
- Covered by [The wall](../design/compositions/live/walls.md), line 5.
- Covered by [The wall](../design/compositions/live/walls.md), line 97.

```reaction
when RequestBoundary.request (path: "/live/walls/read", requestId, round, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
then
  RequestBoundary.respond (requestId, wall: former "the wall of (round) as (viewer) sees it" with (round, viewer: ""))
```

### Live.walls.RenamePile:closed

Authored path: `Live.walls.RenamePile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 98.

```reaction
when RequestBoundary.request (name, path: "/live/walls/rename-pile", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is on the wall of a closed run" with (pile)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.walls.RenamePile:forbidden

Authored path: `Live.walls.RenamePile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 98.

```reaction
when RequestBoundary.request (name, path: "/live/walls/rename-pile", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.walls.RenamePile:success

Authored path: `Live.walls.RenamePile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 98.

```reaction
when RequestBoundary.request (name, path: "/live/walls/rename-pile", pile, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is not on the wall of a closed run" with (pile)
then
  Categorizing.renameCategory (category: pile, name)
```

### Live.walls.RenamePile:success#2

Authored path: `Live.walls.RenamePile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 98.

```reaction
when Categorizing.renameCategory (category: pile, name, result.category: renamed), asked by Live.walls.RenamePile:success
where
  earlier, RequestBoundary.request (name, path: "/live/walls/rename-pile", pile, requestId, session)
then
  RequestBoundary.respond (pile: renamed, requestId)
```

### Live.walls.ReplyOffersLid

Authored path: `Live.walls.ReplyOffersLid`.
- Covered by [The wall](../design/compositions/live/walls.md), line 21.

```reaction
when Reasoning.answer (asking, reply)
where
  at is the current flow's instant
  Reasoning._asking (asking) has (about: round)
  view "(round) is a round with a captured question" with (round)
  Categorizing._categoriesWithItems (scope: round) has (categories)
  Responding._valuesForSubject (subject: round) has (values)
  reading is placingReading (categories, reply, values)
  reading is among ["lid"]
  lines is lidLines (categories, reply)
then
  Suggesting.offer (at, lines, subject: round)
```

### Live.walls.ReplyPlacesCards

Authored path: `Live.walls.ReplyPlacesCards`.
- Covered by [The wall](../design/compositions/live/walls.md), line 15.

```reaction
when Reasoning.answer (asking, reply)
where
  at is the current flow's instant
  Reasoning._asking (asking) has (about: round)
  view "(round) is a round with a captured question" with (round)
  Categorizing._categoriesWithItems (scope: round) has (categories)
  Responding._valuesForSubject (subject: round) has (values)
  reading is placingReading (categories, reply, values)
  reading is among ["placed"]
  lines is placingLines (categories, reply, values)
then
  Suggesting.offer (at, lines, subject: round)
```

### Live.walls.ReplyUnusableComplains

Authored path: `Live.walls.ReplyUnusableComplains`.
- Covered by [The wall](../design/compositions/live/walls.md), line 17.

```reaction
when Reasoning.answer (asking, reply)
where
  Reasoning._asking (asking) has (about: round)
  view "(round) is a round with a captured question" with (round)
  Categorizing._categoriesWithItems (scope: round) has (categories)
  Responding._valuesForSubject (subject: round) has (values)
  reading is placingReading (categories, reply, values)
  reading is among ["neither"]
  account is placingReason (categories, reply, values)
then
  Insisting.complain (account, aim: round, offering: reply, patience: 2)
```

### Live.walls.Sort:asked

Authored path: `Live.walls.Sort`.
- Covered by [The wall](../design/compositions/live/walls.md), line 13.
- Covered by [The wall](../design/compositions/live/walls.md), line 99.

```reaction
when RequestBoundary.request (path: "/live/walls/sort", requestId, round, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is open on an open run" with (round)
  view "(round) has a card still in the tray" with (round)
  view "nothing is still out about (round)" with (round)
  no Insisting._unsettledFor (aim: round)
  RunSnapshotting._snapshot (subject: round) has (value)
  Categorizing._categoriesWithItems (scope: round) has (categories)
  Responding._valuesForSubject (subject: round) has (values)
  passage is placingPassage (categories, value, values)
then
  Reasoning.ask (about: round, at, passage, reasoner: "gemini-flash")
```

### Live.walls.Sort:asked#2

Authored path: `Live.walls.Sort`.
- Covered by [The wall](../design/compositions/live/walls.md), line 13.
- Covered by [The wall](../design/compositions/live/walls.md), line 99.

```reaction
when Reasoning.ask (about: round, at, passage, reasoner: "gemini-flash", asking), asked by Live.walls.Sort:asked
where
  earlier, RequestBoundary.request (path: "/live/walls/sort", requestId, round, session)
then
  RequestBoundary.respond (asked: true, asking, requestId)
```

### Live.walls.Sort:closed

Authored path: `Live.walls.Sort`.
- Covered by [The wall](../design/compositions/live/walls.md), line 13.
- Covered by [The wall](../design/compositions/live/walls.md), line 99.

```reaction
when RequestBoundary.request (path: "/live/walls/sort", requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is not open on an open run" with (round)
then
  RequestBoundary.respond (asked: false, requestId)
```

### Live.walls.Sort:forbidden

Authored path: `Live.walls.Sort`.
- Covered by [The wall](../design/compositions/live/walls.md), line 13.
- Covered by [The wall](../design/compositions/live/walls.md), line 99.

```reaction
when RequestBoundary.request (path: "/live/walls/sort", requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.walls.Sort:insisting

Authored path: `Live.walls.Sort`.
- Covered by [The wall](../design/compositions/live/walls.md), line 13.
- Covered by [The wall](../design/compositions/live/walls.md), line 99.

```reaction
when RequestBoundary.request (path: "/live/walls/sort", requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is open on an open run" with (round)
  view "(round) has a card still in the tray" with (round)
  view "nothing is still out about (round)" with (round)
  Insisting._unsettledFor (aim: round)
then
  RequestBoundary.respond (asked: false, requestId)
```

### Live.walls.Sort:nothing-to-sort

Authored path: `Live.walls.Sort`.
- Covered by [The wall](../design/compositions/live/walls.md), line 13.
- Covered by [The wall](../design/compositions/live/walls.md), line 99.

```reaction
when RequestBoundary.request (path: "/live/walls/sort", requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is open on an open run" with (round)
  view "(round) has every card in a pile" with (round)
then
  RequestBoundary.respond (asked: false, requestId)
```

### Live.walls.Sort:still-out

Authored path: `Live.walls.Sort`.
- Covered by [The wall](../design/compositions/live/walls.md), line 13.
- Covered by [The wall](../design/compositions/live/walls.md), line 99.

```reaction
when RequestBoundary.request (path: "/live/walls/sort", requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is open on an open run" with (round)
  view "(round) has a card still in the tray" with (round)
  view "an ask about (round) is still out" with (round)
then
  RequestBoundary.respond (asked: false, requestId)
```

### Live.walls.SpentPatienceGivesUp

Authored path: `Live.walls.SpentPatienceGivesUp`.
- Covered by [The wall](../design/compositions/live/walls.md), line 17.

```reaction
when Insisting.complain (aim: round)
where
  view "(round) is a round with a captured question" with (round)
  Insisting._spentFor (aim: round)
then
  Insisting.giveUp (aim: round)
```

### Live.walls.Summarize:asked

Authored path: `Live.walls.Summarize`.
- Covered by [The wall](../design/compositions/live/walls.md), line 21.
- Covered by [The wall](../design/compositions/live/walls.md), line 100.

```reaction
when RequestBoundary.request (path: "/live/walls/summarize", pile, requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is not on the wall of a closed run" with (pile)
  view "(pile) holds a card" with (pile)
  Categorizing._getCategoryDetail (category: pile) has (scope: round)
  Categorizing._categoriesWithItems (scope: round) has (categories)
  Responding._valuesForSubject (subject: round) has (values)
  passage is lidPassage (categories, pile, values)
then
  Reasoning.ask (about: round, at, passage, reasoner: "gemini-flash")
```

### Live.walls.Summarize:asked#2

Authored path: `Live.walls.Summarize`.
- Covered by [The wall](../design/compositions/live/walls.md), line 21.
- Covered by [The wall](../design/compositions/live/walls.md), line 100.

```reaction
when Reasoning.ask (about: round, at, passage, reasoner: "gemini-flash", asking), asked by Live.walls.Summarize:asked
where
  earlier, RequestBoundary.request (path: "/live/walls/summarize", pile, requestId, session)
then
  RequestBoundary.respond (asked: true, asking, requestId)
```

### Live.walls.Summarize:closed

Authored path: `Live.walls.Summarize`.
- Covered by [The wall](../design/compositions/live/walls.md), line 21.
- Covered by [The wall](../design/compositions/live/walls.md), line 100.

```reaction
when RequestBoundary.request (path: "/live/walls/summarize", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is on the wall of a closed run" with (pile)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.walls.Summarize:empty

Authored path: `Live.walls.Summarize`.
- Covered by [The wall](../design/compositions/live/walls.md), line 21.
- Covered by [The wall](../design/compositions/live/walls.md), line 100.

```reaction
when RequestBoundary.request (path: "/live/walls/summarize", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is not on the wall of a closed run" with (pile)
  view "(pile) is a pile" with (pile)
  no view "(pile) holds a card" with (pile)
then
  RequestBoundary.respond (asked: false, requestId)
```

### Live.walls.Summarize:forbidden

Authored path: `Live.walls.Summarize`.
- Covered by [The wall](../design/compositions/live/walls.md), line 21.
- Covered by [The wall](../design/compositions/live/walls.md), line 100.

```reaction
when RequestBoundary.request (path: "/live/walls/summarize", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.walls.Summarize:missing

Authored path: `Live.walls.Summarize`.
- Covered by [The wall](../design/compositions/live/walls.md), line 21.
- Covered by [The wall](../design/compositions/live/walls.md), line 100.

```reaction
when RequestBoundary.request (path: "/live/walls/summarize", pile, requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(pile) is no pile" with (pile)
then
  RequestBoundary.respond (error: "CATEGORY_NOT_FOUND", requestId)
```

### Live.walls.TakenLidDescribesPile

Authored path: `Live.walls.TakenLidDescribesPile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 21.

```reaction
when Suggesting.take (suggestion, kind, target, value)
where
  Suggesting._suggestion (suggestion) has (subject: round)
  view "(round) is a round with a captured question" with (round)
  kind is among ["lid"]
then
  Categorizing.describeCategory (category: target, description: value)
```

### Live.walls.TakenOpenMakesPile

Authored path: `Live.walls.TakenOpenMakesPile`.
- Covered by [The wall](../design/compositions/live/walls.md), line 15.

```reaction
when Suggesting.take (suggestion, kind, target, value)
where
  Suggesting._suggestion (suggestion) has (subject: round)
  view "(round) is a round with a captured question" with (round)
  kind is among ["open"]
then
  Categorizing.file (item: target, name: value, scope: round)
```

### Live.walls.TakenPlaceAssignsCard

Authored path: `Live.walls.TakenPlaceAssignsCard`.
- Covered by [The wall](../design/compositions/live/walls.md), line 15.

```reaction
when Suggesting.take (suggestion, kind, target, value)
where
  Suggesting._suggestion (suggestion) has (subject: round)
  view "(round) is a round with a captured question" with (round)
  kind is among ["place"]
then
  Categorizing.assign (category: value, item: target)
```

### Live.walls.ToTray:closed

Authored path: `Live.walls.ToTray`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 101.

```reaction
when RequestBoundary.request (card, path: "/live/walls/to-tray", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(card) is in a pile of a closed run" with (card)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.walls.ToTray:forbidden

Authored path: `Live.walls.ToTray`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 101.

```reaction
when RequestBoundary.request (card, path: "/live/walls/to-tray", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.walls.ToTray:success

Authored path: `Live.walls.ToTray`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 101.

```reaction
when RequestBoundary.request (card, path: "/live/walls/to-tray", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(card) is in no pile of a closed run" with (card)
then
  Categorizing.unassign (item: card)
```

### Live.walls.ToTray:success#2

Authored path: `Live.walls.ToTray`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 101.

```reaction
when Categorizing.unassign (item: card, result.item: unassigned), asked by Live.walls.ToTray:success
where
  earlier, RequestBoundary.request (card, path: "/live/walls/to-tray", requestId, session)
then
  RequestBoundary.respond (card: unassigned, requestId)
```

### Live.walls.Unpick:closed

Authored path: `Live.walls.Unpick`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 96.

```reaction
when RequestBoundary.request (path: "/live/walls/unpick", pile, requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is of a closed run" with (round)
then
  RequestBoundary.respond (error: "CLOSED", requestId)
```

### Live.walls.Unpick:forbidden

Authored path: `Live.walls.Unpick`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 96.

```reaction
when RequestBoundary.request (path: "/live/walls/unpick", pile, requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may not host live runs" with (user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Live.walls.Unpick:missing

Authored path: `Live.walls.Unpick`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 96.

```reaction
when RequestBoundary.request (path: "/live/walls/unpick", pile, requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is not of a closed run" with (round)
  no view "(pile) is on the wall of (round)" with (pile, round)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Live.walls.Unpick:not-picked

Authored path: `Live.walls.Unpick`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 96.

```reaction
when RequestBoundary.request (path: "/live/walls/unpick", pile, requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is not of a closed run" with (round)
  view "(pile) is on the wall of (round)" with (pile, round)
  Pinning._isPinned (item: pile, scope: round) has (pinned: false)
then
  RequestBoundary.respond (pile, requestId)
```

### Live.walls.Unpick:success

Authored path: `Live.walls.Unpick`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 96.

```reaction
when RequestBoundary.request (path: "/live/walls/unpick", pile, requestId, round, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) may host live runs" with (user)
  view "(round) is not of a closed run" with (round)
  view "(pile) is on the wall of (round)" with (pile, round)
  Pinning._isPinned (item: pile, scope: round) has (pinned: true)
then
  Pinning.unpin (item: pile, scope: round)
```

### Live.walls.Unpick:success#2

Authored path: `Live.walls.Unpick`.
- Covered by [The wall](../design/compositions/live/walls.md), line 9.
- Covered by [The wall](../design/compositions/live/walls.md), line 96.

```reaction
when Pinning.unpin (item: pile, scope: round), asked by Live.walls.Unpick:success
where
  earlier, RequestBoundary.request (path: "/live/walls/unpick", pile, requestId, round, session)
then
  RequestBoundary.respond (pile, requestId)
```

### Tasks.lists.AddMember:profile-not-found

Authored path: `Tasks.lists.AddMember`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 16.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 47.

```reaction
when RequestBoundary.request (candidate, list, path: "/tasklists/add-member", requestId, session)
where
  view "the active user of (session)" with (session)
  no Profiling._getProfile (user: candidate)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### Tasks.lists.AddMember:success

Authored path: `Tasks.lists.AddMember`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 16.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 47.

```reaction
when RequestBoundary.request (candidate, list, path: "/tasklists/add-member", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  Profiling._getProfile (user: candidate)
then
  Grouping.addMember (at, candidate, group: list, member: user)
```

### Tasks.lists.AddMember:success#2

Authored path: `Tasks.lists.AddMember`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 16.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 47.

```reaction
when Grouping.addMember (at, candidate, group: list, member: user, result.group: added), asked by Tasks.lists.AddMember:success
where
  earlier, RequestBoundary.request (candidate, list, path: "/tasklists/add-member", requestId, session)
then
  RequestBoundary.respond (list: added, requestId)
```

### Tasks.lists.CreateList

Authored path: `Tasks.lists.CreateList`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 8.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 48.

```reaction
when RequestBoundary.request (path: "/tasklists/create", requestId, session, title)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
then
  Grouping.create (at, creator: user, title)
```

### Tasks.lists.CreateList#2

Authored path: `Tasks.lists.CreateList`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 8.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 48.

```reaction
when Grouping.create (at, creator: user, title, group: list), asked by Tasks.lists.CreateList
where
  earlier, RequestBoundary.request (path: "/tasklists/create", requestId, session, title)
then
  RequestBoundary.respond (list, requestId)
```

### Tasks.lists.GetList:forbidden

Authored path: `Tasks.lists.GetList`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 42.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 49.

```reaction
when RequestBoundary.request (list, path: "/tasklists/get", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) does not belong to task list (list)" with (list, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Tasks.lists.GetList:success

Authored path: `Tasks.lists.GetList`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 42.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 49.

```reaction
when RequestBoundary.request (list, path: "/tasklists/get", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) belongs to task list (list)" with (list, user)
then
  RequestBoundary.respond (list: former "the task list (list) at (at)" with (at, list), requestId, tasks: former "the tasks in (list) at (at)" with (at, list))
```

### Tasks.lists.LeaveList

Authored path: `Tasks.lists.LeaveList`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 24.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 50.

```reaction
when RequestBoundary.request (list, path: "/tasklists/leave", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
then
  Grouping.leave (at, group: list, member: user)
```

### Tasks.lists.LeaveList#2

Authored path: `Tasks.lists.LeaveList`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 24.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 50.

```reaction
when Grouping.leave (at, group: list, member: user, result.group: left), asked by Tasks.lists.LeaveList
where
  earlier, RequestBoundary.request (list, path: "/tasklists/leave", requestId, session)
then
  RequestBoundary.respond (list: left, requestId)
```

### Tasks.lists.LeftMemberReleasesOpenTasks

Authored path: `Tasks.lists.LeftMemberReleasesOpenTasks`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 27.

```reaction
when Grouping.leave (member: user, group)
where
  at is the current flow's instant
  Tasking._getTasksInScope (at, scope: group) has (assignee: user, state: "OPEN", task)
then
  Tasking.release (at, task)
```

### Tasks.lists.MyLists

Authored path: `Tasks.lists.MyLists`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 40.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 51.

```reaction
when RequestBoundary.request (path: "/tasklists/mine", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (lists: former "the task lists of (user) at (at)" with (at, user), requestId)
```

### Tasks.lists.RemoveMember

Authored path: `Tasks.lists.RemoveMember`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 20.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 52.

```reaction
when RequestBoundary.request (list, path: "/tasklists/remove-member", requestId, session, target)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
then
  Grouping.removeMember (at, group: list, member: user, target)
```

### Tasks.lists.RemoveMember#2

Authored path: `Tasks.lists.RemoveMember`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 20.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 52.

```reaction
when Grouping.removeMember (at, group: list, member: user, target, result.group: removed), asked by Tasks.lists.RemoveMember
where
  earlier, RequestBoundary.request (list, path: "/tasklists/remove-member", requestId, session, target)
then
  RequestBoundary.respond (list: removed, requestId)
```

### Tasks.lists.RemovedMemberReleasesOpenTasks

Authored path: `Tasks.lists.RemovedMemberReleasesOpenTasks`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 28.

```reaction
when Grouping.removeMember (target, group)
where
  at is the current flow's instant
  Tasking._getTasksInScope (at, scope: group) has (assignee: target, state: "OPEN", task)
then
  Tasking.release (at, task)
```

### Tasks.lists.RenameList

Authored path: `Tasks.lists.RenameList`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 13.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 53.

```reaction
when RequestBoundary.request (list, path: "/tasklists/rename", requestId, session, title)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
then
  Grouping.rename (at, group: list, member: user, title)
```

### Tasks.lists.RenameList#2

Authored path: `Tasks.lists.RenameList`.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 13.
- Covered by [Task lists](../design/compositions/tasks/lists.md), line 53.

```reaction
when Grouping.rename (at, group: list, member: user, title, result.group: renamed), asked by Tasks.lists.RenameList
where
  earlier, RequestBoundary.request (list, path: "/tasklists/rename", requestId, session, title)
then
  RequestBoundary.respond (list: renamed, requestId)
```

### Tasks.notifications.Dismiss

Authored path: `Tasks.notifications.Dismiss`.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 133.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 148.

```reaction
when RequestBoundary.request (notification, path: "/tasknotifications/dismiss", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  TaskNotifying.dismiss (notification, recipient: user)
```

### Tasks.notifications.Dismiss#2

Authored path: `Tasks.notifications.Dismiss`.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 133.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 148.

```reaction
when TaskNotifying.dismiss (notification, recipient: user, result.notification: dismissed), asked by Tasks.notifications.Dismiss
where
  earlier, RequestBoundary.request (notification, path: "/tasknotifications/dismiss", requestId, session)
then
  RequestBoundary.respond (notification: dismissed, requestId)
```

### Tasks.notifications.MarkAllRead

Authored path: `Tasks.notifications.MarkAllRead`.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 131.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 149.

```reaction
when RequestBoundary.request (path: "/tasknotifications/markAllRead", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  TaskNotifying.markAllRead (recipient: user)
```

### Tasks.notifications.MarkAllRead#2

Authored path: `Tasks.notifications.MarkAllRead`.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 131.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 149.

```reaction
when TaskNotifying.markAllRead (recipient: user, result.recipient), asked by Tasks.notifications.MarkAllRead
where
  earlier, RequestBoundary.request (path: "/tasknotifications/markAllRead", requestId, session)
then
  RequestBoundary.respond (recipient, requestId)
```

### Tasks.notifications.MarkRead

Authored path: `Tasks.notifications.MarkRead`.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 130.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 150.

```reaction
when RequestBoundary.request (notification, path: "/tasknotifications/markRead", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
then
  TaskNotifying.markRead (notification, recipient: user)
```

### Tasks.notifications.MarkRead#2

Authored path: `Tasks.notifications.MarkRead`.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 130.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 150.

```reaction
when TaskNotifying.markRead (notification, recipient: user, result.notification: marked), asked by Tasks.notifications.MarkRead
where
  earlier, RequestBoundary.request (notification, path: "/tasknotifications/markRead", requestId, session)
then
  RequestBoundary.respond (notification: marked, requestId)
```

### Tasks.notifications.MembershipGainNotifies

Authored path: `Tasks.notifications.MembershipGainNotifies`.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 16.

```reaction
when Grouping.addMember (at, candidate, group: list)
then
  TaskNotifying.notify (at, kind: "task-list-added", link: list, recipient: candidate, subject: list)
```

### Tasks.notifications.MembershipLossNotifies

Authored path: `Tasks.notifications.MembershipLossNotifies`.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 20.

```reaction
when Grouping.removeMember (at, member, target, group: list)
where
  view "(member) removed somebody else from (list)" with (list, member)
then
  TaskNotifying.notify (at, kind: "task-list-removed", link: list, recipient: target, subject: list)
```

### Tasks.notifications.NotificationQueuesEmail

Authored path: `Tasks.notifications.NotificationQueuesEmail`.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 74.

```reaction
when TaskNotifying.notify (at, kind, recipient, subject, notification)
where
  Authenticating._getById (user: recipient) has (email)
  view "the task notification mail of kind (kind) about (subject) for (recipient) at (at)" with (at, kind, recipient, subject) has (html, mailSubject, text)
then
  Mailing.enqueue (at, html, key: notification, recipient: email, subject: mailSubject, text)
```

### Tasks.notifications.ReadInbox

Authored path: `Tasks.notifications.ReadInbox`.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 102.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 151.

```reaction
when RequestBoundary.request (path: "/tasknotifications/inbox", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (notifications: former "the task inbox of (user) at (at)" with (at, user), requestId)
```

### Tasks.notifications.UnreadCount

Authored path: `Tasks.notifications.UnreadCount`.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 128.
- Covered by [Task notifications](../design/compositions/tasks/notifications.md), line 152.

```reaction
when RequestBoundary.request (path: "/tasknotifications/unreadCount", requestId, session)
where
  view "the active user of (session)" with (session) has (user)
  TaskNotifying._getUnreadCount (recipient: user) has (count)
then
  RequestBoundary.respond (count, requestId)
```

### Tasks.tasks.AssignTask:assignee-outside-list

Authored path: `Tasks.tasks.AssignTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 23.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 94.

```reaction
when RequestBoundary.request (assignee, path: "/tasks/assign", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
  view "the task list holding (task) at (at)" with (at, task) has (list)
  view "(user) does not belong to task list (list)" with (list, user: assignee)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Tasks.tasks.AssignTask:forbidden

Authored path: `Tasks.tasks.AssignTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 23.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 94.

```reaction
when RequestBoundary.request (assignee, path: "/tasks/assign", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may not act on task (task) at (at)" with (at, task, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Tasks.tasks.AssignTask:self-assignment

Authored path: `Tasks.tasks.AssignTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 23.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 94.

```reaction
when RequestBoundary.request (assignee, path: "/tasks/assign", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
  view "the task list holding (task) at (at)" with (at, task) has (list)
  view "(user) belongs to task list (list)" with (list, user: assignee)
  view "the active user of (session)" with (session) has (user: assignee)
then
  Tasking.assign (assignee, at, task)
```

### Tasks.tasks.AssignTask:self-assignment#2

Authored path: `Tasks.tasks.AssignTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 23.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 94.

```reaction
when Tasking.assign (assignee, at, task, result.task: assigned), asked by Tasks.tasks.AssignTask:self-assignment
where
  earlier, RequestBoundary.request (assignee, path: "/tasks/assign", requestId, session, task)
then
  RequestBoundary.respond (requestId, task: assigned)
```

### Tasks.tasks.AssignTask:success

Authored path: `Tasks.tasks.AssignTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 23.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 94.

```reaction
when RequestBoundary.request (assignee, path: "/tasks/assign", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
  view "the task list holding (task) at (at)" with (at, task) has (list)
  view "(user) belongs to task list (list)" with (list, user: assignee)
  view "the active user of (session)" with (session) and not (user: assignee)
then
  Tasking.assign (assignee, at, task)
```

### Tasks.tasks.AssignTask:success#2

Authored path: `Tasks.tasks.AssignTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 23.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 94.

```reaction
when Tasking.assign (assignee, at, task, result.task: assigned), asked by Tasks.tasks.AssignTask:success
then
  TaskNotifying.notify (at, kind: "task-assigned", link: task, recipient: assignee, subject: task)
```

### Tasks.tasks.AssignTask:success#3

Authored path: `Tasks.tasks.AssignTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 23.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 94.

```reaction
when TaskNotifying.notify (at, kind: "task-assigned", link: task, recipient: assignee, subject: task), asked by Tasks.tasks.AssignTask:success#2
where
  earlier, Tasking.assign (assignee, at, task, result.task: assigned), asked by Tasks.tasks.AssignTask:success
  earlier, RequestBoundary.request (assignee, path: "/tasks/assign", requestId, session, task)
then
  RequestBoundary.respond (requestId, task: assigned)
```

### Tasks.tasks.CancelTask:announced

Authored path: `Tasks.tasks.CancelTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 34.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 95.

```reaction
when RequestBoundary.request (path: "/tasks/cancel", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
  view "somebody other than (actor) must hear about (task) at (at)" with (actor: user, at, task)
then
  Tasking.cancel (at, task)
```

### Tasks.tasks.CancelTask:announced#2

Authored path: `Tasks.tasks.CancelTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 34.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 95.

```reaction
when Tasking.cancel (at, task, assignee: recipient, result.task: canceled), asked by Tasks.tasks.CancelTask:announced
then
  TaskNotifying.notify (at, kind: "task-canceled", link: task, recipient, subject: task)
```

### Tasks.tasks.CancelTask:announced#3

Authored path: `Tasks.tasks.CancelTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 34.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 95.

```reaction
when TaskNotifying.notify (at, kind: "task-canceled", link: task, recipient, subject: task), asked by Tasks.tasks.CancelTask:announced#2
where
  earlier, Tasking.cancel (at, task, assignee: recipient, result.task: canceled), asked by Tasks.tasks.CancelTask:announced
  earlier, RequestBoundary.request (path: "/tasks/cancel", requestId, session, task)
then
  RequestBoundary.respond (requestId, task: canceled)
```

### Tasks.tasks.CancelTask:forbidden

Authored path: `Tasks.tasks.CancelTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 34.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 95.

```reaction
when RequestBoundary.request (path: "/tasks/cancel", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may not act on task (task) at (at)" with (at, task, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Tasks.tasks.CancelTask:silent

Authored path: `Tasks.tasks.CancelTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 34.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 95.

```reaction
when RequestBoundary.request (path: "/tasks/cancel", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
  no view "somebody other than (actor) must hear about (task) at (at)" with (actor: user, at, task)
then
  Tasking.cancel (at, task)
```

### Tasks.tasks.CancelTask:silent#2

Authored path: `Tasks.tasks.CancelTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 34.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 95.

```reaction
when Tasking.cancel (at, task, result.task: canceled), asked by Tasks.tasks.CancelTask:silent
where
  earlier, RequestBoundary.request (path: "/tasks/cancel", requestId, session, task)
then
  RequestBoundary.respond (requestId, task: canceled)
```

### Tasks.tasks.CompleteTask:announced

Authored path: `Tasks.tasks.CompleteTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 28.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 96.

```reaction
when RequestBoundary.request (path: "/tasks/complete", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
  view "somebody other than (actor) must hear about (task) at (at)" with (actor: user, at, task)
then
  Tasking.complete (at, task)
```

### Tasks.tasks.CompleteTask:announced#2

Authored path: `Tasks.tasks.CompleteTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 28.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 96.

```reaction
when Tasking.complete (at, task, assignee: recipient, result.task: completed), asked by Tasks.tasks.CompleteTask:announced
then
  TaskNotifying.notify (at, kind: "task-completed", link: task, recipient, subject: task)
```

### Tasks.tasks.CompleteTask:announced#3

Authored path: `Tasks.tasks.CompleteTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 28.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 96.

```reaction
when TaskNotifying.notify (at, kind: "task-completed", link: task, recipient, subject: task), asked by Tasks.tasks.CompleteTask:announced#2
where
  earlier, Tasking.complete (at, task, assignee: recipient, result.task: completed), asked by Tasks.tasks.CompleteTask:announced
  earlier, RequestBoundary.request (path: "/tasks/complete", requestId, session, task)
then
  RequestBoundary.respond (requestId, task: completed)
```

### Tasks.tasks.CompleteTask:forbidden

Authored path: `Tasks.tasks.CompleteTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 28.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 96.

```reaction
when RequestBoundary.request (path: "/tasks/complete", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may not act on task (task) at (at)" with (at, task, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Tasks.tasks.CompleteTask:silent

Authored path: `Tasks.tasks.CompleteTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 28.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 96.

```reaction
when RequestBoundary.request (path: "/tasks/complete", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
  no view "somebody other than (actor) must hear about (task) at (at)" with (actor: user, at, task)
then
  Tasking.complete (at, task)
```

### Tasks.tasks.CompleteTask:silent#2

Authored path: `Tasks.tasks.CompleteTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 28.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 96.

```reaction
when Tasking.complete (at, task, result.task: completed), asked by Tasks.tasks.CompleteTask:silent
where
  earlier, RequestBoundary.request (path: "/tasks/complete", requestId, session, task)
then
  RequestBoundary.respond (requestId, task: completed)
```

### Tasks.tasks.CreateTask:forbidden

Authored path: `Tasks.tasks.CreateTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 10.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 97.

```reaction
when RequestBoundary.request (details, endsAt, list, path: "/tasks/create", requestId, session, startsAt, title)
where
  view "the active user of (session)" with (session) has (user)
  view "(user) does not belong to task list (list)" with (list, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Tasks.tasks.CreateTask:success

Authored path: `Tasks.tasks.CreateTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 10.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 97.

```reaction
when RequestBoundary.request (details, endsAt, list, path: "/tasks/create", requestId, session, startsAt, title)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) belongs to task list (list)" with (list, user)
then
  Tasking.create (assignee: null, at, details, endsAt, scope: list, startsAt, title)
```

### Tasks.tasks.CreateTask:success#2

Authored path: `Tasks.tasks.CreateTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 10.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 97.

```reaction
when Tasking.create (assignee: null, at, details, endsAt, scope: list, startsAt, title, task), asked by Tasks.tasks.CreateTask:success
where
  earlier, RequestBoundary.request (details, endsAt, list, path: "/tasks/create", requestId, session, startsAt, title)
then
  RequestBoundary.respond (requestId, task)
```

### Tasks.tasks.DeleteTask:forbidden

Authored path: `Tasks.tasks.DeleteTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 65.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 98.

```reaction
when RequestBoundary.request (path: "/tasks/delete", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may not act on task (task) at (at)" with (at, task, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Tasks.tasks.DeleteTask:success

Authored path: `Tasks.tasks.DeleteTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 65.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 98.

```reaction
when RequestBoundary.request (path: "/tasks/delete", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
then
  Tasking.delete (at, task)
```

### Tasks.tasks.DeleteTask:success#2

Authored path: `Tasks.tasks.DeleteTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 65.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 98.

```reaction
when Tasking.delete (at, task), asked by Tasks.tasks.DeleteTask:success
where
  earlier, RequestBoundary.request (path: "/tasks/delete", requestId, session, task)
then
  RequestBoundary.respond (ok: true, requestId)
```

### Tasks.tasks.DescribeTask:forbidden

Authored path: `Tasks.tasks.DescribeTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 17.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 99.

```reaction
when RequestBoundary.request (details, path: "/tasks/describe", requestId, session, task, title)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may not act on task (task) at (at)" with (at, task, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Tasks.tasks.DescribeTask:success

Authored path: `Tasks.tasks.DescribeTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 17.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 99.

```reaction
when RequestBoundary.request (details, path: "/tasks/describe", requestId, session, task, title)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
then
  Tasking.describe (at, details, task, title)
```

### Tasks.tasks.DescribeTask:success#2

Authored path: `Tasks.tasks.DescribeTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 17.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 99.

```reaction
when Tasking.describe (at, details, task, title, result.task: described), asked by Tasks.tasks.DescribeTask:success
where
  earlier, RequestBoundary.request (details, path: "/tasks/describe", requestId, session, task, title)
then
  RequestBoundary.respond (requestId, task: described)
```

### Tasks.tasks.MyTasks

Authored path: `Tasks.tasks.MyTasks`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 88.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 100.

```reaction
when RequestBoundary.request (path: "/tasks/mine", requestId, session)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
then
  RequestBoundary.respond (requestId, tasks: former "the tasks assigned to (user) at (at)" with (at, user))
```

### Tasks.tasks.ReleaseTask:forbidden

Authored path: `Tasks.tasks.ReleaseTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 26.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 101.

```reaction
when RequestBoundary.request (path: "/tasks/release", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may not act on task (task) at (at)" with (at, task, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Tasks.tasks.ReleaseTask:success

Authored path: `Tasks.tasks.ReleaseTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 26.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 101.

```reaction
when RequestBoundary.request (path: "/tasks/release", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
then
  Tasking.release (at, task)
```

### Tasks.tasks.ReleaseTask:success#2

Authored path: `Tasks.tasks.ReleaseTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 26.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 101.

```reaction
when Tasking.release (at, task, result.task: released), asked by Tasks.tasks.ReleaseTask:success
where
  earlier, RequestBoundary.request (path: "/tasks/release", requestId, session, task)
then
  RequestBoundary.respond (requestId, task: released)
```

### Tasks.tasks.ReopenTask:announced

Authored path: `Tasks.tasks.ReopenTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 31.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 102.

```reaction
when RequestBoundary.request (path: "/tasks/reopen", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
  view "somebody other than (actor) must hear about (task) at (at)" with (actor: user, at, task)
then
  Tasking.reopen (at, task)
```

### Tasks.tasks.ReopenTask:announced#2

Authored path: `Tasks.tasks.ReopenTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 31.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 102.

```reaction
when Tasking.reopen (at, task, assignee: recipient, result.task: reopened), asked by Tasks.tasks.ReopenTask:announced
then
  TaskNotifying.notify (at, kind: "task-reopened", link: task, recipient, subject: task)
```

### Tasks.tasks.ReopenTask:announced#3

Authored path: `Tasks.tasks.ReopenTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 31.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 102.

```reaction
when TaskNotifying.notify (at, kind: "task-reopened", link: task, recipient, subject: task), asked by Tasks.tasks.ReopenTask:announced#2
where
  earlier, Tasking.reopen (at, task, assignee: recipient, result.task: reopened), asked by Tasks.tasks.ReopenTask:announced
  earlier, RequestBoundary.request (path: "/tasks/reopen", requestId, session, task)
then
  RequestBoundary.respond (requestId, task: reopened)
```

### Tasks.tasks.ReopenTask:forbidden

Authored path: `Tasks.tasks.ReopenTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 31.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 102.

```reaction
when RequestBoundary.request (path: "/tasks/reopen", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may not act on task (task) at (at)" with (at, task, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Tasks.tasks.ReopenTask:silent

Authored path: `Tasks.tasks.ReopenTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 31.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 102.

```reaction
when RequestBoundary.request (path: "/tasks/reopen", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
  no view "somebody other than (actor) must hear about (task) at (at)" with (actor: user, at, task)
then
  Tasking.reopen (at, task)
```

### Tasks.tasks.ReopenTask:silent#2

Authored path: `Tasks.tasks.ReopenTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 31.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 102.

```reaction
when Tasking.reopen (at, task, result.task: reopened), asked by Tasks.tasks.ReopenTask:silent
where
  earlier, RequestBoundary.request (path: "/tasks/reopen", requestId, session, task)
then
  RequestBoundary.respond (requestId, task: reopened)
```

### Tasks.tasks.RetimeTask:announced

Authored path: `Tasks.tasks.RetimeTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 20.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 103.

```reaction
when RequestBoundary.request (endsAt, path: "/tasks/retime", requestId, session, startsAt, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
  view "somebody other than (actor) must hear about (task) at (at)" with (actor: user, at, task)
then
  Tasking.retime (at, endsAt, startsAt, task)
```

### Tasks.tasks.RetimeTask:announced#2

Authored path: `Tasks.tasks.RetimeTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 20.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 103.

```reaction
when Tasking.retime (at, endsAt, startsAt, task, assignee: recipient, result.task: retimed), asked by Tasks.tasks.RetimeTask:announced
then
  TaskNotifying.notify (at, kind: "task-retimed", link: task, recipient, subject: task)
```

### Tasks.tasks.RetimeTask:announced#3

Authored path: `Tasks.tasks.RetimeTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 20.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 103.

```reaction
when TaskNotifying.notify (at, kind: "task-retimed", link: task, recipient, subject: task), asked by Tasks.tasks.RetimeTask:announced#2
where
  earlier, Tasking.retime (at, endsAt, startsAt, task, assignee: recipient, result.task: retimed), asked by Tasks.tasks.RetimeTask:announced
  earlier, RequestBoundary.request (endsAt, path: "/tasks/retime", requestId, session, startsAt, task)
then
  RequestBoundary.respond (requestId, task: retimed)
```

### Tasks.tasks.RetimeTask:forbidden

Authored path: `Tasks.tasks.RetimeTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 20.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 103.

```reaction
when RequestBoundary.request (endsAt, path: "/tasks/retime", requestId, session, startsAt, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may not act on task (task) at (at)" with (at, task, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Tasks.tasks.RetimeTask:silent

Authored path: `Tasks.tasks.RetimeTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 20.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 103.

```reaction
when RequestBoundary.request (endsAt, path: "/tasks/retime", requestId, session, startsAt, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
  no view "somebody other than (actor) must hear about (task) at (at)" with (actor: user, at, task)
then
  Tasking.retime (at, endsAt, startsAt, task)
```

### Tasks.tasks.RetimeTask:silent#2

Authored path: `Tasks.tasks.RetimeTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 20.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 103.

```reaction
when Tasking.retime (at, endsAt, startsAt, task, result.task: retimed), asked by Tasks.tasks.RetimeTask:silent
where
  earlier, RequestBoundary.request (endsAt, path: "/tasks/retime", requestId, session, startsAt, task)
then
  RequestBoundary.respond (requestId, task: retimed)
```

### Tasks.tasks.UncancelTask:announced

Authored path: `Tasks.tasks.UncancelTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 37.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 104.

```reaction
when RequestBoundary.request (path: "/tasks/uncancel", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
  view "somebody other than (actor) must hear about (task) at (at)" with (actor: user, at, task)
then
  Tasking.uncancel (at, task)
```

### Tasks.tasks.UncancelTask:announced#2

Authored path: `Tasks.tasks.UncancelTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 37.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 104.

```reaction
when Tasking.uncancel (at, task, assignee: recipient, result.task: uncanceled), asked by Tasks.tasks.UncancelTask:announced
then
  TaskNotifying.notify (at, kind: "task-uncanceled", link: task, recipient, subject: task)
```

### Tasks.tasks.UncancelTask:announced#3

Authored path: `Tasks.tasks.UncancelTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 37.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 104.

```reaction
when TaskNotifying.notify (at, kind: "task-uncanceled", link: task, recipient, subject: task), asked by Tasks.tasks.UncancelTask:announced#2
where
  earlier, Tasking.uncancel (at, task, assignee: recipient, result.task: uncanceled), asked by Tasks.tasks.UncancelTask:announced
  earlier, RequestBoundary.request (path: "/tasks/uncancel", requestId, session, task)
then
  RequestBoundary.respond (requestId, task: uncanceled)
```

### Tasks.tasks.UncancelTask:forbidden

Authored path: `Tasks.tasks.UncancelTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 37.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 104.

```reaction
when RequestBoundary.request (path: "/tasks/uncancel", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may not act on task (task) at (at)" with (at, task, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### Tasks.tasks.UncancelTask:silent

Authored path: `Tasks.tasks.UncancelTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 37.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 104.

```reaction
when RequestBoundary.request (path: "/tasks/uncancel", requestId, session, task)
where
  at is the current flow's instant
  view "the active user of (session)" with (session) has (user)
  view "(user) may act on task (task) at (at)" with (at, task, user)
  no view "somebody other than (actor) must hear about (task) at (at)" with (actor: user, at, task)
then
  Tasking.uncancel (at, task)
```

### Tasks.tasks.UncancelTask:silent#2

Authored path: `Tasks.tasks.UncancelTask`.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 37.
- Covered by [Tasks](../design/compositions/tasks/tasks.md), line 104.

```reaction
when Tasking.uncancel (at, task, result.task: uncanceled), asked by Tasks.tasks.UncancelTask:silent
where
  earlier, RequestBoundary.request (path: "/tasks/uncancel", requestId, session, task)
then
  RequestBoundary.respond (requestId, task: uncanceled)
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
- `/auth/invitation` — requires `invitation`, `temporaryPassword`
- `/auth/login` — requires `password`, `username`
- `/auth/logout` — requires `session`
- `/auth/me` — requires `session`
- `/auth/permissions` — requires `session`
- `/auth/request-password-reset` — requires `email`
- `/auth/reset-password` — requires `voucher`, `credential`, `newPassword`
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
- `/grades/restore-excused` — requires `item`, `learner`, `session`
- `/grades/retract` — requires `item`, `learner`, `session`
- `/grades/revise-criterion` — requires `criterion`, `maxPoints`, `name`, `position`, `session`
- `/grades/score-criterion` — requires `criterion`, `feedback`, `item`, `learner`, `points`, `session`
- `/invitations/invite` — requires `email`, `session`
- `/invitations/list` — requires `session`
- `/invitations/retract` — requires `invitation`, `session`
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
- `/live/drafts/abandon` — requires `session`, `brief`
- `/live/drafts/adopt` — requires `session`, `candidate`
- `/live/drafts/clarify` — requires `session`, `clarification`, `answer`
- `/live/drafts/correct` — requires `session`, `candidate`, `request`
- `/live/drafts/describe` — requires `session`, `request`
- `/live/drafts/line` — requires `session`, `brief`
- `/live/drafts/lines` — requires `session`
- `/live/drafts/provenance` — requires `session`, `questionnaire`
- `/live/drafts/refine` — requires `session`, `questionnaire`
- `/live/edits/decline` — requires `session`, `suggestion`
- `/live/edits/draft` — requires `session`, `relay`, `request`
- `/live/edits/offerings` — requires `session`, `relay`
- `/live/edits/take` — requires `session`, `suggestion`
- `/live/p/answer` — requires `response`, `question`, `value`
- `/live/p/arrive` — requires `token`
- `/live/p/begin` — requires `token`, `device`
- `/live/p/begin-signed` — requires `token`, `session`
- `/live/p/locate` — requires `code`
- `/live/p/outcome` — requires `response`
- `/live/p/submit` — requires `response`
- `/live/p/wall` — requires `response`
- `/live/quizzes/add-question` — requires `session`, `questionnaire`, `prompt`; fills `choices` with [] when absent; fills `expected` with "" when absent; fills `explanation` with "" when absent
- `/live/quizzes/create` — requires `session`, `form`; fills `disclosure` with "score" when absent; fills `title` with "Untitled" when absent
- `/live/quizzes/get` — requires `questionnaire`, `session`
- `/live/quizzes/list` — requires `session`
- `/live/quizzes/lower-question` — requires `session`, `question`
- `/live/quizzes/raise-question` — requires `session`, `question`
- `/live/quizzes/remove-question` — requires `session`, `question`
- `/live/quizzes/retire` — requires `session`, `questionnaire`
- `/live/quizzes/retitle` — requires `session`, `questionnaire`, `title`
- `/live/quizzes/revise-question` — requires `session`, `question`, `prompt`; fills `choices` with [] when absent; fills `expected` with "" when absent; fills `explanation` with "" when absent
- `/live/quizzes/set-disclosure` — requires `session`, `questionnaire`, `disclosure`
- `/live/relays/add-round` — requires `session`, `relay`, `title`, `prompt`, `parts`, `cap`, `choices`
- `/live/relays/clear-takes` — requires `session`, `leg`, `source`
- `/live/relays/close` — requires `session`, `run`
- `/live/relays/close-round` — requires `session`, `round`
- `/live/relays/dismiss` — requires `session`, `run`, `participant`
- `/live/relays/get` — requires `session`, `relay`
- `/live/relays/invite` — requires `session`, `run`, `device`
- `/live/relays/launch` — requires `session`, `relay`
- `/live/relays/list` — requires `session`
- `/live/relays/move-round` — requires `session`, `leg`, `position`
- `/live/relays/open-round` — requires `session`, `run`, `leg`
- `/live/relays/plan` — requires `session`, `title`
- `/live/relays/remove-round` — requires `session`, `leg`
- `/live/relays/retire` — requires `session`, `relay`
- `/live/relays/retitle` — requires `session`, `relay`, `title`
- `/live/relays/revise-round` — requires `session`, `leg`, `title`, `prompt`, `parts`, `cap`, `choices`
- `/live/relays/run` — requires `session`, `run`
- `/live/relays/set-takes` — requires `session`, `leg`, `source`, `shape`
- `/live/relays/uses` — requires `session`
- `/live/runs/close` — requires `session`, `run`
- `/live/runs/launch` — requires `session`, `questionnaire`
- `/live/runs/open` — requires `session`
- `/live/runs/results` — requires `session`, `run`
- `/live/walls/describe-pile` — requires `session`, `pile`, `description`
- `/live/walls/merge-pile` — requires `session`, `pile`, `into`
- `/live/walls/move-card` — requires `session`, `card`, `pile`
- `/live/walls/open-pile` — requires `session`, `round`, `name`, `card`
- `/live/walls/pick` — requires `session`, `round`, `pile`
- `/live/walls/read` — requires `session`, `round`
- `/live/walls/rename-pile` — requires `session`, `pile`, `name`
- `/live/walls/sort` — requires `session`, `round`
- `/live/walls/summarize` — requires `session`, `pile`
- `/live/walls/to-tray` — requires `session`, `card`
- `/live/walls/unpick` — requires `session`, `round`, `pile`
- `/lms/me` — requires `session`
- `/lms/staff-dashboard` — requires `session`
- `/locks/isLocked` — requires `target`
- `/locks/lock` — requires `session`, `target`
- `/locks/unlock` — requires `session`, `target`
- `/mail/list` — requires `session`
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
- `/roles/assign` — requires `context`, `role`, `session`, `user`
- `/roles/define` — requires `capabilities`, `name`, `session`
- `/roles/delete` — requires `role`, `session`
- `/roles/forUser` — requires `context`, `user`
- `/roles/get` — requires `role`
- `/roles/revoke` — requires `context`, `session`, `user`
- `/roster/add-person` — requires `session`, `email`; fills `displayName` with "" when absent; fills `kind` with "STUDENT" when absent; fills `section` with "" when absent
- `/roster/class` — requires `session`
- `/roster/configure-class` — requires `code`, `session`, `term`, `timezone`, `title`
- `/roster/drop` — requires `seat`, `session`
- `/roster/dropped` — requires `session`
- `/roster/enroll` — requires `session`, `email`, `user`; fills `kind` with "STUDENT" when absent; fills `section` with null when absent
- `/roster/import` — requires `rows`, `session`
- `/roster/import-preview` — requires `csv`
- `/roster/list` — requires `session`
- `/roster/me` — requires `session`
- `/roster/move-section` — requires `seat`, `section`, `session`
- `/roster/pending` — requires `session`
- `/roster/reinstate` — requires `seat`, `session`
- `/roster/remove` — requires `seat`, `session`
- `/roster/sections/create` — requires `session`, `name`; fills `location` with null when absent; fills `meetingPattern` with null when absent
- `/roster/sections/update` — requires `location`, `meetingPattern`, `name`, `section`, `session`
- `/roster/update-class` — requires `code`, `session`, `term`, `timezone`, `title`
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
- `/tasklists/add-member` — requires `session`, `list`, `candidate`
- `/tasklists/create` — requires `session`; fills `title` with "" when absent
- `/tasklists/get` — requires `list`, `session`
- `/tasklists/leave` — requires `session`, `list`
- `/tasklists/mine` — requires `session`
- `/tasklists/remove-member` — requires `session`, `list`, `target`
- `/tasklists/rename` — requires `session`, `list`, `title`
- `/tasknotifications/dismiss` — requires `notification`, `session`
- `/tasknotifications/inbox` — requires `session`
- `/tasknotifications/markAllRead` — requires `session`
- `/tasknotifications/markRead` — requires `notification`, `session`
- `/tasknotifications/unreadCount` — requires `session`
- `/tasks/assign` — requires `assignee`, `session`, `task`
- `/tasks/cancel` — requires `session`, `task`
- `/tasks/complete` — requires `session`, `task`
- `/tasks/create` — requires `session`, `list`, `title`, `startsAt`, `endsAt`; fills `details` with "" when absent
- `/tasks/delete` — requires `session`, `task`
- `/tasks/describe` — requires `session`, `task`, `title`; fills `details` with "" when absent
- `/tasks/mine` — requires `session`
- `/tasks/release` — requires `session`, `task`
- `/tasks/reopen` — requires `session`, `task`
- `/tasks/retime` — requires `endsAt`, `session`, `startsAt`, `task`
- `/tasks/uncancel` — requires `session`, `task`
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
- `/users/archive` — requires `session`, `user`
- `/users/list` — requires `session`
- `/users/resolve` — requires `ref`
- `/users/restore` — requires `session`, `user`
- `/users/search` — requires `session`, `query`
