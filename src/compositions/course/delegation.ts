import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { compute, each, former, is, no, view, where, whether } from "@mit-sdg/sync-engine/language";
import { computations, concepts } from "../../concepts.ts";
import { COMMONS } from "../access/capabilities.ts";
import { activeUser } from "../access/session.ts";
import { mayGrade, mayNotGrade } from "../access/policy.ts";

const { Archiving, Assigning, Authenticating, Delegating, Profiling, Roling } = concepts;
const GRADE = "grade";

export const theGraders = former(
  "the available graders ()",
  (_inputs, { grader, displayName, username }) =>
    each(Roling._getCapabilityHolders({ context: COMMONS, capability: GRADE }).is({ user: grader }))
      .where(
        Archiving._isTrashed({ item: grader }).is({ trashed: false }),
        Authenticating._getById({ user: grader }).is({ username }),
        whether(Profiling._getProfileFields({ user: grader }).is({ displayName })),
      )
      .form({ grader, displayName, username }),
);

export const availableGrader = view(
  "(grader) is an available grader",
  ({ grader }, _outputs, _bindings) =>
    where(
      Authenticating._getById({ user: grader }),
      Archiving._isTrashed({ item: grader }).is({ trashed: false }),
      mayGrade({ user: grader }),
    ),
).holds();

export const theDelegationsOn = former(
  "the grading delegations on (item)",
  ({ item }, { learner, grader, graderName, graderUsername }) =>
    each(Delegating._getDelegations({ item }).is({ subject: learner, delegate: grader }))
      .where(
        whether(Profiling._getProfileFields({ user: grader }).is({ displayName: graderName })),
        whether(Authenticating._getById({ user: grader }).is({ username: graderUsername })),
      )
      .form({ learner, grader, graderName, graderUsername }),
);

export const everyGraderIsAvailable = view(
  "every grader in (graders) is available",
  ({ graders }, _outputs, { capable, complete }) =>
    where(
      Authenticating._knownUsers({ users: graders }).is({ known: true }),
      Archiving._anyTrashed({ items: graders }).is({ trashed: false }),
      Roling._capableUsers({ users: graders, context: COMMONS, capabilities: [GRADE] }).is({
        capable,
      }),
      compute(computations.allChosenAdmitted, { chosen: graders, admitted: capable }, complete),
      is.among(complete, [true]),
    ),
).holds();

export const everyLearnerIsAssigned = view(
  "every learner in (learners) is assigned (item)",
  ({ item, learners }, _outputs, { assigned, complete }) =>
    where(
      Assigning._assignedAmong({ assignment: item, assignees: learners }).is({ assigned }),
      compute(computations.allChosenAdmitted, { chosen: learners, admitted: assigned }, complete),
      is.among(complete, [true]),
    ),
).holds();

export const DelegationGraders = endpoint("/delegation/graders", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayGrade({ user }))
      .then(respond({ graders: theGraders({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const DelegationForItem = endpoint(
  "/delegation/for-item",
  ({ session, item, user, valid }) =>
    receive({ session, item }).then(
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item }, valid),
        is.among(valid, [true]),
        Assigning._getAssignments({}).is({ assignment: item }),
      )
        .then(respond({ delegations: theDelegationsOn({ item }) }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item }, valid),
        is.among(valid, [true]),
        no(Assigning._getAssignments({}).is({ assignment: item })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item }, valid),
        is.among(valid, [false]),
      )
        .then(respond({ error: "INVALID_REQUEST" }))
        .named("invalid-input"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "item"] } },
);

export const DelegationSet = endpoint(
  "/delegation/set",
  ({ session, item, learner, grader, user, delegation, valid }) =>
    receive({ session, item, learner, grader }).then(
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item, learner, grader }, valid),
        is.among(valid, [true]),
        Assigning._getAssignments({}).is({ assignment: item }),
        Assigning._isAssigned({ assignment: item, assignee: learner }).is({ assigned: true }),
        availableGrader({ grader }),
      )
        .then(
          Delegating.delegate({ item, subject: learner, delegate: grader }).responds({
            delegation,
          }),
        )
        .then(respond({ delegation }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item, learner, grader }, valid),
        is.among(valid, [true]),
        no(Assigning._getAssignments({}).is({ assignment: item })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("assignment-missing"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item, learner, grader }, valid),
        is.among(valid, [true]),
        Assigning._getAssignments({}).is({ assignment: item }),
        Assigning._isAssigned({ assignment: item, assignee: learner }).is({ assigned: false }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("learner-missing"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item, learner, grader }, valid),
        is.among(valid, [true]),
        Assigning._getAssignments({}).is({ assignment: item }),
        Assigning._isAssigned({ assignment: item, assignee: learner }).is({ assigned: true }),
        no(availableGrader({ grader })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("grader-unavailable"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item, learner, grader }, valid),
        is.among(valid, [false]),
      )
        .then(respond({ error: "INVALID_REQUEST" }))
        .named("invalid-input"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "item", "learner", "grader"] } },
);

export const DelegationClear = endpoint(
  "/delegation/clear",
  ({ session, item, learner, user, delegation, valid }) =>
    receive({ session, item, learner }).then(
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item, learner }, valid),
        is.among(valid, [true]),
        Assigning._getAssignments({}).is({ assignment: item }),
        Assigning._isAssigned({ assignment: item, assignee: learner }).is({ assigned: true }),
      )
        .then(Delegating.withdraw({ item, subject: learner }).responds({ delegation }))
        .then(respond({ delegation }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item, learner }, valid),
        is.among(valid, [true]),
        no(Assigning._getAssignments({}).is({ assignment: item })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("assignment-missing"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item, learner }, valid),
        is.among(valid, [true]),
        Assigning._getAssignments({}).is({ assignment: item }),
        Assigning._isAssigned({ assignment: item, assignee: learner }).is({ assigned: false }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("learner-missing"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item, learner }, valid),
        is.among(valid, [false]),
      )
        .then(respond({ error: "INVALID_REQUEST" }))
        .named("invalid-input"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "item", "learner"] } },
);

export const DelegationSpread = endpoint(
  "/delegation/spread",
  ({ session, item, learners, graders, replace, user, assigned, valid }) =>
    receive({ session, item, learners, graders, replace }).then(
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(
          computations.validDelegationSpreadInput,
          { item, learners, graders, replace },
          valid,
        ),
        is.among(valid, [true]),
        everyGraderIsAvailable({ graders }),
        everyLearnerIsAssigned({ item, learners }),
      )
        .then(
          Delegating.spread({
            item,
            subjects: learners,
            delegates: graders,
            replace,
          }).responds({ assigned }),
        )
        .then(respond({ assigned }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(
          computations.validDelegationSpreadInput,
          { item, learners, graders, replace },
          valid,
        ),
        is.among(valid, [true]),
        no(everyGraderIsAvailable({ graders })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("grader-unavailable"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(
          computations.validDelegationSpreadInput,
          { item, learners, graders, replace },
          valid,
        ),
        is.among(valid, [true]),
        everyGraderIsAvailable({ graders }),
        no(everyLearnerIsAssigned({ item, learners })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("learner-unavailable"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(
          computations.validDelegationSpreadInput,
          { item, learners, graders, replace },
          valid,
        ),
        is.among(valid, [false]),
      )
        .then(respond({ error: "INVALID_REQUEST" }))
        .named("invalid-input"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "item", "learners", "graders", "replace"] } },
);

export const DelegationClearItem = endpoint(
  "/delegation/clear-item",
  ({ session, item, user, cleared, valid }) =>
    receive({ session, item }).then(
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item }, valid),
        is.among(valid, [true]),
        Assigning._getAssignments({}).is({ assignment: item }),
      )
        .then(Delegating.clearItem({ item }).responds({ cleared }))
        .then(respond({ cleared }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item }, valid),
        is.among(valid, [true]),
        no(Assigning._getAssignments({}).is({ assignment: item })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        compute(computations.validDelegationIdentityInput, { item }, valid),
        is.among(valid, [false]),
      )
        .then(respond({ error: "INVALID_REQUEST" }))
        .named("invalid-input"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "item"] } },
);
