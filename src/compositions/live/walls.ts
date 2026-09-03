import {
  compute,
  each,
  former,
  is,
  no,
  now,
  reaction,
  view,
  when,
  where,
  whether,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { activeUser } from "../access/session.ts";
import {
  cardIsNotOfAClosedRun,
  cardIsOfAClosedRun,
  mayHostLive,
  mayNotHostLive,
  participantIsSeated,
  pileIsNotOfAClosedRun,
  pileIsOfAClosedRun,
  roundIsLive,
  roundIsNotLive,
  roundIsNotOfAClosedRun,
  roundIsOfAClosedRun,
  theRunOf,
} from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";

const {
  Categorizing,
  Insisting,
  PickLinking,
  Publishing,
  Questioning,
  Reasoning,
  Relaying,
  Responding,
  RunSnapshotting,
  Subscribing,
  Suggesting,
} = concepts;

/** The one reasoner name this composition asks for; the floor decides what answers it. */
const REASONER = "gemini-flash";

/** How many times an unusable placing reply is stood upon before the tick gives up. */
const PATIENCE = 2;

/**
 * A round is a published edition with a captured question. A relay run is
 * published with nothing captured, so this is what keeps the wall's reactions
 * off the replies that belong to the relay itself.
 */
const roundIsAWall = view(
  "(round) is a round with a captured question",
  ({ round }, _outputs, _bindings) =>
    where(Publishing._edition({ edition: round }), RunSnapshotting._snapshot({ subject: round })),
).holds();

/** Whether any card of the round is still in the tray. */
const roundHasACardInTheTray = view(
  "(round) has a card still in the tray",
  ({ round }, _outputs, { response, item, card }) =>
    where(
      Responding._submittedAnswers({ subject: round }).is({ response, item }),
      compute(computations.cardId, { response, item }, card),
      no(Categorizing._getCategory({ item: card })),
    ),
).holds();

const roundHasEveryCardInAPile = view(
  "(round) has every card in a pile",
  ({ round }, _outputs, _bindings) => where(no(roundHasACardInTheTray({ round }))),
).holds();

const anAskStandsAbout = view("an ask about (round) is still out", ({ round }, _o, _b) =>
  where(Reasoning._pending({}).is({ about: round })),
).holds();

const noAskStandsAbout = view("nothing is still out about (round)", ({ round }, _o, _b) =>
  where(no(Reasoning._pending({}).is({ about: round }))),
).holds();

const pileExists = view("(pile) is a pile", ({ pile }, _outputs, _bindings) =>
  where(Categorizing._getCategoryDetail({ category: pile })),
).holds();

const pileDoesNotExist = view("(pile) is no pile", ({ pile }, _outputs, _bindings) =>
  where(no(Categorizing._getCategoryDetail({ category: pile }))),
).holds();

/** A card is one of the round's own cards; a card from another wall is none of this one's. */
const cardIsOnTheWallOf = view(
  "(card) is a card of (round)",
  ({ card, round }, _outputs, { values, standing }) =>
    where(
      Responding._valuesForSubject({ subject: round }).is({ values }),
      compute(computations.cardStanding, { card, values }, standing),
      is.among(standing, ["known"]),
    ),
).holds();

const pileHoldsACard = view("(pile) holds a card", ({ pile }, _outputs, _bindings) =>
  where(Categorizing._getItems({ category: pile })),
).holds();

/** Which pile of the round carries forward, when this one does. */
const thePickOn = former("the pick of (pile) on (round)", ({ round, pile }, _bindings) =>
  where(PickLinking._getLinks({ source: round }).is({ target: pile })).form({ picked: pile }),
).optional();

/**
 * A round's wall: its question, its figure, every card the room handed in, and
 * the piles those cards were sorted into. A card carries neither its response
 * nor its participant — only the mark that it is the viewer's own, and the mark
 * that a model participant wrote it.
 */
export const theWall = former(
  "the wall of (round) as (viewer) sees it",
  (
    { round, viewer },
    {
      questionnaire,
      presentation,
      open,
      openedAt,
      closedAt,
      title,
      leg,
      number,
      questions,
      begun,
      handedIn,
      response,
      participant,
      item,
      value,
      card,
      pile,
      run,
      model,
      mine,
      part,
      category,
      name,
      description,
      held,
    },
  ) =>
    where(
      Publishing._edition({ edition: round }).is({
        material: questionnaire,
        open,
        openedAt,
        closedAt,
      }),
      RunSnapshotting._snapshot({ subject: round }).is({ value: presentation }),
      Questioning._getQuestionnaire({ questionnaire }).is({ title }),
      compute(computations.participantQuestions, { value: presentation }, questions),
      whether(Relaying._legFor({ material: questionnaire }).is({ leg, position: number })),
    ).form({
      round,
      number,
      title,
      open,
      openedAt,
      closedAt,
      questions,
      begun: each(Responding._responsesFor({ subject: round }).is({ response: begun })).count(),
      handedIn: each(
        Responding._responsesFor({ subject: round }).is({ response: handedIn, submitted: true }),
      ).count(),
      cards: each(
        Responding._submittedAnswers({ subject: round }).is({ response, participant, item, value }),
      )
        .where(
          compute(computations.cardId, { response, item }, card),
          theRunOf({ round }).is({ run }),
          Subscribing._isSubscribed({ user: participant, target: run }).is({ subscribed: model }),
          compute(computations.isSame, { left: response, right: viewer }, mine),
          compute(computations.partLabel, { value: presentation, item }, part),
          whether(Categorizing._getCategory({ item: card }).is({ category: pile })),
        )
        .form({ card, value, part, pile, model, mine }),
      piles: each(Categorizing._categoriesIn({ scope: round }).is({ category, name, description }))
        .form({
          pile: category,
          name,
          description,
          count: each(Categorizing._getItems({ category }).is({ item: held })).count(),
        })
        .splicing(whether(thePickOn({ round, pile: category }))),
    }),
).optional();

/**
 * A vote's ballots sort themselves: each answer that is one of the round's
 * choices is filed under the pile of that name the moment the response is
 * handed in, so a vote wall is piles like any other and its bars read them.
 */
export const HandedInBallotsJoinTheirPiles = reaction(
  ({ response, round, presentation, item, value, card, kind }) =>
    when(Responding.submit({ response }).responds())
      .where(
        Responding._response({ response }).is({ subject: round }),
        roundIsAWall({ round }),
        RunSnapshotting._snapshot({ subject: round }).is({ value: presentation }),
        Responding._answers({ response }).is({ item, value }),
        compute(computations.answerKind, { value: presentation, answer: value }, kind),
        is.among(kind, ["choice"]),
        compute(computations.cardId, { response, item }, card),
      )
      .then(Categorizing.file({ scope: round, name: value, item: card })),
);

/** The model's placing reply becomes an offering of suggestions about the round. */
export const ReplyPlacesCards = reaction(
  ({ asking, reply, round, categories, values, reading, lines, at }) =>
    when(Reasoning.answer({ asking, reply }).responds())
      .where(
        now(at),
        Reasoning._asking({ asking }).is({ about: round }),
        roundIsAWall({ round }),
        Categorizing._categoriesWithItems({ scope: round }).is({ categories }),
        Responding._valuesForSubject({ subject: round }).is({ values }),
        compute(computations.placingReading, { reply, categories, values }, reading),
        is.among(reading, ["placed"]),
        compute(computations.placingLines, { reply, categories, values }, lines),
      )
      .then(Suggesting.offer({ subject: round, lines, at })),
);

export const ReplyOffersLid = reaction(
  ({ asking, reply, round, categories, values, reading, lines, at }) =>
    when(Reasoning.answer({ asking, reply }).responds())
      .where(
        now(at),
        Reasoning._asking({ asking }).is({ about: round }),
        roundIsAWall({ round }),
        Categorizing._categoriesWithItems({ scope: round }).is({ categories }),
        Responding._valuesForSubject({ subject: round }).is({ values }),
        compute(computations.placingReading, { reply, categories, values }, reading),
        is.among(reading, ["lid"]),
        compute(computations.lidLines, { reply, categories }, lines),
      )
      .then(Suggesting.offer({ subject: round, lines, at })),
);

export const ReplyUnusableComplains = reaction(
  ({ asking, reply, round, categories, values, reading, account }) =>
    when(Reasoning.answer({ asking, reply }).responds())
      .where(
        Reasoning._asking({ asking }).is({ about: round }),
        roundIsAWall({ round }),
        Categorizing._categoriesWithItems({ scope: round }).is({ categories }),
        Responding._valuesForSubject({ subject: round }).is({ values }),
        compute(computations.placingReading, { reply, categories, values }, reading),
        is.among(reading, ["neither"]),
        compute(computations.placingReason, { reply, categories, values }, account),
      )
      .then(Insisting.complain({ aim: round, patience: PATIENCE, offering: reply, account })),
);

/** The switch is the staff member's standing consent, so every line is taken at once. */
export const PlacingOfferingIsTaken = reaction(({ round, offering, suggestion }) =>
  when(Suggesting.offer({ subject: round }).responds({ offering }))
    .where(roundIsAWall({ round }), Suggesting._pendingIn({ offering }).is({ suggestion }))
    .then(Suggesting.take({ suggestion })),
);

export const TakenPlaceAssignsCard = reaction(({ suggestion, kind, target, value, round }) =>
  when(Suggesting.take({ suggestion }).responds({ kind, target, value }))
    .where(
      Suggesting._suggestion({ suggestion }).is({ subject: round }),
      roundIsAWall({ round }),
      is.among(kind, ["place"]),
    )
    .then(Categorizing.assign({ item: target, category: value })),
);

/** Two cards opening the same new pile in one reply land together. */
export const TakenOpenMakesPile = reaction(({ suggestion, kind, target, value, round }) =>
  when(Suggesting.take({ suggestion }).responds({ kind, target, value }))
    .where(
      Suggesting._suggestion({ suggestion }).is({ subject: round }),
      roundIsAWall({ round }),
      is.among(kind, ["open"]),
    )
    .then(Categorizing.file({ scope: round, name: value, item: target })),
);

export const TakenLidDescribesPile = reaction(({ suggestion, kind, target, value, round }) =>
  when(Suggesting.take({ suggestion }).responds({ kind, target, value }))
    .where(
      Suggesting._suggestion({ suggestion }).is({ subject: round }),
      roundIsAWall({ round }),
      is.among(kind, ["lid"]),
    )
    .then(Categorizing.describeCategory({ category: target, description: value })),
);

/** A usable reply settles whatever was being insisted on for the round. */
export const PlacedReplySatisfiesInsistence = reaction(({ round }) =>
  when(Suggesting.offer({ subject: round }).responds())
    .where(roundIsAWall({ round }), Insisting._unsettledFor({ aim: round }))
    .then(Insisting.satisfy({ aim: round })),
);

/** While patience remains, a complaint carries the exchange back to the reasoner. */
export const ComplaintRetriesTheAsk = reaction(
  ({ round, offering, account, value, categories, values, passage, at }) =>
    when(Insisting.complain({ aim: round, offering, account }).responds())
      .where(
        now(at),
        roundIsAWall({ round }),
        Insisting._standingFor({ aim: round }),
        RunSnapshotting._snapshot({ subject: round }).is({ value }),
        Categorizing._categoriesWithItems({ scope: round }).is({ categories }),
        Responding._valuesForSubject({ subject: round }).is({ values }),
        compute(
          computations.placingRepairPassage,
          { value, categories, values, offering, account },
          passage,
        ),
      )
      .then(Reasoning.ask({ reasoner: REASONER, about: round, passage, at })),
);

/** Once patience is spent the insistence closes; the next tick simply asks again. */
export const SpentPatienceGivesUp = reaction(({ round }) =>
  when(Insisting.complain({ aim: round }).responds())
    .where(roundIsAWall({ round }), Insisting._spentFor({ aim: round }))
    .then(Insisting.giveUp({ aim: round })),
);

/** A reasoner that could not be reached leaves nothing waiting silently. */
export const FailedAskGivesUp = reaction(({ asking, round }) =>
  when(Reasoning.fail({ asking }).responds())
    .where(
      Reasoning._asking({ asking }).is({ about: round }),
      roundIsAWall({ round }),
      Insisting._unsettledFor({ aim: round }),
    )
    .then(Insisting.giveUp({ aim: round })),
);

/**
 * A response begun under a participant that holds a seat on the round's run
 * puts the round's face before the reasoner, seeded by that identity so forty
 * invited participants do not all say the same thing.
 */
export const BegunModelResponseAsksMind = reaction(
  ({ participant, round, run, response, value, passage, at }) =>
    when(Responding.begin({ participant, subject: round }).responds({ response }))
      .where(
        now(at),
        theRunOf({ round }).is({ run }),
        participantIsSeated({ participant, run }),
        RunSnapshotting._snapshot({ subject: round }).is({ value }),
        compute(computations.participantPassage, { value, participant }, passage),
      )
      .then(Reasoning.ask({ reasoner: REASONER, about: response, passage, at })),
);

export const Read = endpoint(
  "/live/walls/read",
  ({ session, round, user, at }) =>
    receive({ session, round }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(respond({ wall: theWall({ round, viewer: "" }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "round"] } },
);

/** Naming a pile that already stands on this wall reaches it rather than making another. */
export const OpenPile = endpoint(
  "/live/walls/open-pile",
  ({ session, round, name, card, user, at, category, assigned }) =>
    receive({ session, round, name, card }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsNotOfAClosedRun({ round }),
        cardIsOnTheWallOf({ card, round }),
      )
        .then(
          Categorizing.ensureCategory({ scope: round, name, description: "" }).responds({
            category,
          }),
        )
        .then(Categorizing.assign({ item: card, category }).responds({ item: assigned }))
        .then(respond({ pile: category, card: assigned }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsOfAClosedRun({ round }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsNotOfAClosedRun({ round }),
        no(cardIsOnTheWallOf({ card, round })),
      )
        .then(respond({ error: "CARD_NOT_FOUND" }))
        .named("no-such-card"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "round", "name", "card"] } },
);

export const MoveCard = endpoint(
  "/live/walls/move-card",
  ({ session, card, pile, user, at, round, assigned }) =>
    receive({ session, card, pile }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileExists({ pile }),
        pileIsNotOfAClosedRun({ pile }),
        Categorizing._getCategoryDetail({ category: pile }).is({ scope: round }),
        cardIsOnTheWallOf({ card, round }),
      )
        .then(Categorizing.assign({ item: card, category: pile }).responds({ item: assigned }))
        .then(respond({ card: assigned, pile }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileExists({ pile }),
        pileIsNotOfAClosedRun({ pile }),
        Categorizing._getCategoryDetail({ category: pile }).is({ scope: round }),
        no(cardIsOnTheWallOf({ card, round })),
      )
        .then(respond({ error: "CARD_NOT_FOUND" }))
        .named("no-such-card"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileIsOfAClosedRun({ pile }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), pileDoesNotExist({ pile }))
        .then(respond({ error: "CATEGORY_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "card", "pile"] } },
);

export const ToTray = endpoint(
  "/live/walls/to-tray",
  ({ session, card, user, at, unassigned }) =>
    receive({ session, card }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        cardIsNotOfAClosedRun({ card }),
      )
        .then(Categorizing.unassign({ item: card }).responds({ item: unassigned }))
        .then(respond({ card: unassigned }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        cardIsOfAClosedRun({ card }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "card"] } },
);

export const RenamePile = endpoint(
  "/live/walls/rename-pile",
  ({ session, pile, name, user, at, renamed }) =>
    receive({ session, pile, name }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileIsNotOfAClosedRun({ pile }),
      )
        .then(Categorizing.renameCategory({ category: pile, name }).responds({ category: renamed }))
        .then(respond({ pile: renamed }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileIsOfAClosedRun({ pile }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "pile", "name"] } },
);

/** Folding one pile into another carries every card with it. */
export const MergePile = endpoint(
  "/live/walls/merge-pile",
  ({ session, pile, into, user, at, merged }) =>
    receive({ session, pile, into }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileIsNotOfAClosedRun({ pile }),
      )
        .then(Categorizing.mergeCategory({ category: pile, into }).responds({ into: merged }))
        .then(respond({ pile: merged }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileIsOfAClosedRun({ pile }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "pile", "into"] } },
);

export const DescribePile = endpoint(
  "/live/walls/describe-pile",
  ({ session, pile, description, user, at, described }) =>
    receive({ session, pile, description }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileIsNotOfAClosedRun({ pile }),
      )
        .then(
          Categorizing.describeCategory({ category: pile, description }).responds({
            category: described,
          }),
        )
        .then(respond({ pile: described }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileIsOfAClosedRun({ pile }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "pile", "description"] } },
);

/** The dashboard sends the whole picked set each time a pile is tapped. */
export const Pick = endpoint(
  "/live/walls/pick",
  ({ session, round, piles, user, at, categories, onWall, picked }) =>
    receive({ session, round, piles }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Publishing._edition({ edition: round }),
        roundIsNotOfAClosedRun({ round }),
        Categorizing._categoriesWithItems({ scope: round }).is({ categories }),
        compute(computations.pilesOnWall, { piles, categories }, onWall),
      )
        .then(PickLinking.setLinks({ source: round, targets: onWall }).responds({ source: picked }))
        .then(respond({ round: picked }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsOfAClosedRun({ round }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Publishing._edition({ edition: round })),
        roundIsNotOfAClosedRun({ round }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "round", "piles"] } },
);

/**
 * The dashboard asks on its own poll while its switch says the model sorts, so
 * the endpoint decides for itself whether there is anything to ask about.
 */
export const Sort = endpoint(
  "/live/walls/sort",
  ({ session, round, user, at, value, categories, values, passage, asking }) =>
    receive({ session, round }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsLive({ round }),
        roundHasACardInTheTray({ round }),
        noAskStandsAbout({ round }),
        no(Insisting._unsettledFor({ aim: round })),
        RunSnapshotting._snapshot({ subject: round }).is({ value }),
        Categorizing._categoriesWithItems({ scope: round }).is({ categories }),
        Responding._valuesForSubject({ subject: round }).is({ values }),
        compute(computations.placingPassage, { value, categories, values }, passage),
      )
        .then(
          Reasoning.ask({ reasoner: REASONER, about: round, passage, at }).responds({
            asking,
          }),
        )
        .then(respond({ asked: true, asking }))
        .named("asked"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), roundIsNotLive({ round }))
        .then(respond({ asked: false }))
        .named("closed"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsLive({ round }),
        roundHasEveryCardInAPile({ round }),
      )
        .then(respond({ asked: false }))
        .named("nothing-to-sort"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsLive({ round }),
        roundHasACardInTheTray({ round }),
        anAskStandsAbout({ round }),
      )
        .then(respond({ asked: false }))
        .named("still-out"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsLive({ round }),
        roundHasACardInTheTray({ round }),
        noAskStandsAbout({ round }),
        Insisting._unsettledFor({ aim: round }),
      )
        .then(respond({ asked: false }))
        .named("insisting"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "round"] } },
);

export const Summarize = endpoint(
  "/live/walls/summarize",
  ({ session, pile, user, at, round, categories, values, passage, asking }) =>
    receive({ session, pile }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileIsNotOfAClosedRun({ pile }),
        pileHoldsACard({ pile }),
        Categorizing._getCategoryDetail({ category: pile }).is({ scope: round }),
        Categorizing._categoriesWithItems({ scope: round }).is({ categories }),
        Responding._valuesForSubject({ subject: round }).is({ values }),
        compute(computations.lidPassage, { pile, categories, values }, passage),
      )
        .then(
          Reasoning.ask({ reasoner: REASONER, about: round, passage, at }).responds({
            asking,
          }),
        )
        .then(respond({ asked: true, asking }))
        .named("asked"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileIsNotOfAClosedRun({ pile }),
        pileExists({ pile }),
        no(pileHoldsACard({ pile })),
      )
        .then(respond({ asked: false }))
        .named("empty"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileIsOfAClosedRun({ pile }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(activeUser({ session }).is({ user }), mayHostLive({ user }), pileDoesNotExist({ pile }))
        .then(respond({ error: "CATEGORY_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "pile"] } },
);
