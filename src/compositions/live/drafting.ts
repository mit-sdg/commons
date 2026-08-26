import {
  compute,
  each,
  former,
  is,
  now,
  reaction,
  when,
  where,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { activeUser } from "../access/session.ts";
import { mayHostLive, mayNotHostLive } from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";

const { Drafting, Insisting, Questioning, Reasoning } = concepts;

/** The one reasoner name this composition asks for; the floor decides what answers it. */
const REASONER = "gemini-flash";

/** How many times an unusable reply is stood upon before the brief stalls. */
const PATIENCE = 3;

/** A described brief goes straight before the reasoner. */
export const DescribedBriefAsksReasoner = reaction(({ brief, request, passage, at }) =>
  when(Drafting.describe({ request }).responds({ brief }))
    .where(now(at), compute(computations.draftingPassage, { request }, passage))
    .then(Reasoning.ask({ reasoner: REASONER, about: brief, passage, at })),
);

/** A correction carries the prior material and asks again. */
export const CorrectedBriefAsksReasoner = reaction(
  ({ brief, candidate, request, form, material, passage, at }) =>
    when(Drafting.correct({ candidate, request }).responds({ brief }))
      .where(
        now(at),
        Drafting._material({ candidate }).is({ form, material }),
        compute(computations.revisionPassage, { request, form, material }, passage),
      )
      .then(Reasoning.ask({ reasoner: REASONER, about: brief, passage, at })),
);

/** An answered clarification resumes drafting from the whole exchange. */
export const ClarifiedBriefAsksReasoner = reaction(
  ({ clarification, brief, question, answer, request, passage, at }) =>
    when(Drafting.clarify({ clarification, answer }).responds({ brief }))
      .where(
        now(at),
        Drafting._clarifications({ brief }).is({ clarification, question }),
        Drafting._brief({ brief }).is({ request }),
        compute(computations.clarifiedPassage, { request, question, answer }, passage),
      )
      .then(Reasoning.ask({ reasoner: REASONER, about: brief, passage, at })),
);

/**
 * A reply meets its reading: a draft is proposed, a question is asked, and
 * anything else is stood upon. The three readings partition every reply, so
 * exactly one of these fires per answered ask.
 */
export const ReplyDraftProposes = reaction(({ asking, reply, brief, kind, form, material }) =>
  when(Reasoning.answer({ asking, reply }).responds())
    .where(
      Reasoning._asking({ asking }).is({ about: brief }),
      compute(computations.parseKind, { reply }, kind),
      is.among(kind, ["draft"]),
      compute(computations.parsedForm, { reply }, form),
      compute(computations.parsedMaterial, { reply }, material),
    )
    .then(Drafting.propose({ brief, form, material })),
);

export const ReplyQuestionAsks = reaction(({ asking, reply, brief, kind, question }) =>
  when(Reasoning.answer({ asking, reply }).responds())
    .where(
      Reasoning._asking({ asking }).is({ about: brief }),
      compute(computations.parseKind, { reply }, kind),
      is.among(kind, ["question"]),
      compute(computations.parsedQuestion, { reply }, question),
    )
    .then(Drafting.ask({ brief, question })),
);

export const ReplyNeitherComplains = reaction(({ asking, reply, brief, kind, reason }) =>
  when(Reasoning.answer({ asking, reply }).responds())
    .where(
      Reasoning._asking({ asking }).is({ about: brief }),
      compute(computations.parseKind, { reply }, kind),
      is.among(kind, ["neither"]),
      compute(computations.parsedReason, { reply }, reason),
    )
    .then(Insisting.complain({ aim: brief, patience: PATIENCE, offering: reply, account: reason })),
);

/** A usable reply settles whatever was being insisted on for the brief. */
export const ProposedDraftSatisfiesInsistence = reaction(({ brief }) =>
  when(Drafting.propose({ brief }).responds())
    .where(Insisting._unsettledFor({ aim: brief }))
    .then(Insisting.satisfy({ aim: brief })),
);

export const AskedQuestionSatisfiesInsistence = reaction(({ brief }) =>
  when(Drafting.ask({ brief }).responds())
    .where(Insisting._unsettledFor({ aim: brief }))
    .then(Insisting.satisfy({ aim: brief })),
);

/** While patience remains, a complaint carries the exchange back to the reasoner. */
export const ComplaintRetriesTheAsk = reaction(
  ({ brief, offering, account, request, passage, at }) =>
    when(Insisting.complain({ aim: brief, offering, account }).responds())
      .where(
        now(at),
        Insisting._standingFor({ aim: brief }),
        Drafting._brief({ brief }).is({ request }),
        compute(computations.repairPassage, { request, offering, account }, passage),
      )
      .then(Reasoning.ask({ reasoner: REASONER, about: brief, passage, at })),
);

/** Once patience is spent, the brief stalls honestly and the insistence closes. */
export const SpentPatienceStallsTheBrief = reaction(({ brief }) =>
  when(Insisting.complain({ aim: brief }).responds())
    .where(Insisting._spentFor({ aim: brief }))
    .then(
      Drafting.stall({
        brief,
        reason: "The reply could not be read, and standing on it did not help.",
      }).responds(),
    )
    .then(Insisting.giveUp({ aim: brief })),
);

/** A reasoner that could not answer leaves nothing waiting silently. */
export const FailedAskStallsTheBrief = reaction(({ asking, brief, account }) =>
  when(Reasoning.fail({ asking }).responds())
    .where(Reasoning._asking({ asking }).is({ about: brief }))
    .then(
      where(Insisting._unsettledFor({ aim: brief }))
        .then(Insisting.giveUp({ aim: brief }))
        .named("give-up"),
      where(
        Reasoning._failureOf({ asking }).is({ account }),
        Drafting._standing({ brief }).is({ stalled: false }),
      )
        .then(Drafting.stall({ brief, reason: account }))
        .named("stall"),
    ),
);

/**
 * Adopting a candidate turns the drafted material into an ordinary editable
 * questionnaire — after this, revision happens by hand in Questioning, and
 * nothing else ever crosses from the drafting line into the live domain.
 */
export const AdoptedCandidateComposesQuestionnaire = reaction(
  ({
    candidate,
    brief,
    author,
    form,
    request,
    title,
    at,
    questionnaire,
    prompt,
    choices,
    expected,
    explanation,
    position,
  }) =>
    when(Drafting.adopt({ candidate }).responds())
      .where(
        now(at),
        Drafting._candidate({ candidate }).is({ brief, form }),
        Drafting._brief({ brief }).is({ author, request }),
        compute(computations.draftTitle, { request }, title),
      )
      .then(
        Questioning.compose({ author, title, form, disclosure: "score", at }).responds({
          questionnaire,
        }),
      )
      .then(
        where(
          Drafting._items({ candidate }).is({ prompt, choices, expected, explanation, position }),
        )
          .then(
            Questioning.addQuestion({
              questionnaire,
              prompt,
              choices,
              expected,
              explanation,
              position,
            }),
          )
          .named("each-item"),
      ),
);

/** A drafting line whole: every step, its material, and its open questions. */
export const theDraftLine = former(
  "the drafting line of (brief)",
  (
    { brief },
    {
      step,
      request,
      basis,
      candidate,
      form,
      adopted,
      clarifying,
      stalled,
      clarification,
      question,
      answer,
      prompt,
      choices,
      expected,
      explanation,
      position,
    },
  ) =>
    each(Drafting._line({ brief }).is({ brief: step, request, basis, candidate, form, adopted }))
      .where(Drafting._standing({ brief: step }).is({ clarifying, stalled }))
      .form({
        step,
        request,
        basis,
        candidate,
        form,
        adopted,
        clarifying,
        stalled,
        items: each(
          Drafting._items({ candidate }).is({ prompt, choices, expected, explanation, position }),
        ).form({ prompt, choices, expected, explanation, position }),
        clarifications: each(
          Drafting._clarifications({ brief: step }).is({ clarification, question, answer }),
        ).form({ clarification, question, answer }),
      }),
);

export const Describe = endpoint(
  "/live/drafts/describe",
  ({ session, request, user, at, brief }) =>
    receive({ session, request }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(Drafting.describe({ author: user, request, at }).responds({ brief }))
        .then(respond({ brief }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "request"] } },
);

export const Line = endpoint(
  "/live/drafts/line",
  ({ session, brief, user, at }) =>
    receive({ session, brief }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(respond({ line: theDraftLine({ brief }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "brief"] } },
);

export const Clarify = endpoint(
  "/live/drafts/clarify",
  ({ session, clarification, answer, user, at, clarified, brief }) =>
    receive({ session, clarification, answer }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(
          Drafting.clarify({ clarification, answer }).responds({
            clarification: clarified,
            brief,
          }),
        )
        .then(respond({ clarification: clarified, brief }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "clarification", "answer"] } },
);

export const Correct = endpoint(
  "/live/drafts/correct",
  ({ session, candidate, request, user, at, brief }) =>
    receive({ session, candidate, request }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(Drafting.correct({ author: user, candidate, request, at }).responds({ brief }))
        .then(respond({ brief }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "candidate", "request"] } },
);

export const Adopt = endpoint(
  "/live/drafts/adopt",
  ({ session, candidate, user, at, adopted }) =>
    receive({ session, candidate }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(Drafting.adopt({ candidate }).responds({ candidate: adopted }))
        .then(respond({ candidate: adopted }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "candidate"] } },
);
