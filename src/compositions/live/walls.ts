import {
  compute,
  count,
  earlier,
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
  pileIsOfRound,
  roundIsLive,
  roundIsNotOfAClosedRun,
  roundIsOfAClosedRun,
  roundIsOfAnOpenRun,
  thePickCount,
  theRunOf,
} from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";
import { SORTING } from "./relays.ts";
import { RESERVED_PILES, SORTING_USE } from "./rounds.ts";

const {
  Categorizing,
  Commissioning,
  Guiding,
  Insisting,
  Locking,
  Pinning,
  Publishing,
  Questioning,
  Reasoning,
  Relaying,
  Responding,
  RunSnapshotting,
  Subscribing,
  Suggesting,
  Trashing,
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
  ({ round }, _outputs, { questionnaire }) =>
    where(
      Publishing._edition({ edition: round }).is({ material: questionnaire }),
      Relaying._legFor({ material: questionnaire }),
      RunSnapshotting._snapshot({ subject: round }),
    ),
).holds();

/**
 * A card stands on its wall until a staff member removes it: a removed card is
 * a trashed one, and the hand-in behind it is kept.
 */
const cardStands = view("(card) stands on its wall", ({ card }, _outputs, _bindings) =>
  where(Trashing._isTrashed({ item: card }).is({ trashed: false })),
).holds();

/** Whether any card of the round is still in the tray. */
const roundHasACardInTheTray = view(
  "(round) has a card still in the tray",
  ({ round }, _outputs, { response, item, card }) =>
    where(
      Responding._submittedAnswers({ subject: round }).is({ response, item }),
      compute(computations.cardId, { response, item }, card),
      cardStands({ card }),
      no(Categorizing._getCategory({ item: card })),
    ),
).holds();

const noAskStandsAbout = view("nothing is still out about (round)", ({ round }, _o, _b) =>
  where(no(Reasoning._pending({}).is({ about: round }))),
).holds();

/**
 * A placing reply that landed is taken line by line; until its last line is
 * taken the tray still shows the cards it places, and a tick that asked again
 * would place them twice.
 */
const anOfferingIsBeingTakenAbout = view(
  "an offering about (round) still has lines to take",
  ({ round }, _o, { offering }) =>
    where(
      Suggesting._offeringsAbout({ subject: round }).is({ offering }),
      Suggesting._pendingIn({ offering }),
    ),
).holds();

/** Each reply holds its own lock until its consequential placements finish. */
const aReplyIsApplying = view("a reply about (round) is applying", ({ round }, _o, { asking }) =>
  where(
    Locking._getLocked({}).is({ target: asking }),
    Reasoning._asking({ asking }).is({ about: round }),
  ),
).holds();

/** The last ask about the round failed moments ago, so asking again now would only fail again. */
const roundHasAFreshFailure = view(
  "(round) has an ask that failed moments before (at)",
  ({ round, at }, _o, { failedAt, standing }) =>
    where(
      Reasoning._lastFailureAbout({ about: round }).is({ failedAt }),
      compute(computations.failureStanding, { failedAt, at }, standing),
      is.among(standing, ["fresh"]),
    ),
).holds();

const noOfferingIsBeingTakenAbout = view(
  "no offering about (round) has lines left to take",
  ({ round }, _o, _b) => where(no(anOfferingIsBeingTakenAbout({ round }))),
).holds();

/**
 * The notes whoever sorts the round reads: the relay's, guidance on the
 * round's leg written in the editor, and after it the run's, guidance on the
 * round itself written from the dashboard, joined as one text. Both are read
 * on every ask, so a note revised between asks reaches the next one, and the
 * run's note stands on this round alone: the next run of the relay starts
 * with the relay's note and nothing after it.
 */
const theNotesFor = view(
  "the sorter's notes for (round)",
  ({ round }, { notes }, { questionnaire, leg, relay, run }) =>
    where(
      Publishing._edition({ edition: round }).is({ material: questionnaire }),
      Relaying._legFor({ material: questionnaire }).is({ leg }),
      Guiding._guidanceText({ subject: leg, use: SORTING_USE }).is({ text: relay }),
      Guiding._guidanceText({ subject: round, use: SORTING_USE }).is({ text: run }),
      compute(computations.sorterNotes, { relay, run }, notes),
    ),
).optional();

const pileExists = view("(pile) is a pile", ({ pile }, _outputs, _bindings) =>
  where(Categorizing._getCategoryDetail({ category: pile })),
).holds();

const pileDoesNotExist = view("(pile) is no pile", ({ pile }, _outputs, _bindings) =>
  where(no(Categorizing._getCategoryDetail({ category: pile }))),
).holds();

/**
 * A card is one of the round's own cards; a card from another wall, or one
 * removed from this one, is none of this one's.
 */
const cardIsOnTheWallOf = view(
  "(card) is a card of (round)",
  ({ card, round }, _outputs, { values, standing }) =>
    where(
      Responding._valuesForSubject({ subject: round }).is({ values }),
      compute(computations.cardStanding, { card, values }, standing),
      is.among(standing, ["known"]),
      cardStands({ card }),
    ),
).holds();

/**
 * A name the round's captured question offered as a choice, whether or not
 * anyone chose it, which is what lets an unchosen choice be picked.
 */
const nameIsAChoiceOf = view(
  "(name) is a choice of (round)",
  ({ name, round }, _outputs, { presentation, kind }) =>
    where(
      RunSnapshotting._snapshot({ subject: round }).is({ value: presentation }),
      compute(computations.answerKind, { value: presentation, answer: name }, kind),
      is.among(kind, ["choice"]),
    ),
).holds();

/** Which pile of the round carries forward, when this one does: a pinned pile. */
const thePickOn = former("the pick of (pile) on (round)", ({ round, pile }, _bindings) =>
  where(Pinning._isPinned({ item: pile, scope: round }).is({ pinned: true })).form({
    picked: pile,
  }),
).optional();

/** Only authored definitions influence category meaning; summaries are results. */
const sortingPiles = view(
  "sorting piles of (round)",
  ({ round }, { categories }, { raw, subjects, texts }) =>
    where(
      Categorizing._categoriesWithItems({ scope: round }).is({ categories: raw }),
      compute(computations.sortingPileSubjects, { categories: raw }, subjects),
      Guiding._guidanceTexts({ subjects, use: "pile-definition" }).is({ texts }),
      compute(computations.definedSortingPiles, { categories: raw, texts }, categories),
    ),
).one();

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
      modelBegun,
      modelHandedIn,
      seat,
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
      definition,
      summary,
      held,
      failure,
      failedAt,
      notes,
      pendingAsk,
      sortPending,
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
      whether(Reasoning._lastFailureAbout({ about: round }).is({ account: failure, failedAt })),
      // The run is the round's: read once for the wall, not once a card.
      whether(theRunOf({ round }).is({ run })),
      Guiding._guidanceText({ subject: round, use: SORTING_USE }).is({ text: notes }),
      Locking._isLocked({ target: round }).is({ locked: sortPending }),
    ).form({
      round,
      number,
      title,
      open,
      openedAt,
      closedAt,
      questions,
      failure,
      failedAt,
      notes,
      sortPending,
      asksOut: each(Reasoning._pending({}).is({ asking: pendingAsk, about: round })).count(),
      begun: each(Responding._responsesFor({ subject: round }).is({ response: begun })).count(),
      handedIn: each(
        Responding._responsesFor({ subject: round }).is({ response: handedIn, submitted: true }),
      ).count(),
      begunByModel: each(
        Responding._responsesFor({ subject: round }).is({
          response: modelBegun,
          participant: seat,
        }),
      )
        .where(theRunOf({ round }).is({ run }), participantIsSeated({ participant: seat, run }))
        .count(),
      handedInByModel: each(
        Responding._responsesFor({ subject: round }).is({
          response: modelHandedIn,
          participant: seat,
          submitted: true,
        }),
      )
        .where(theRunOf({ round }).is({ run }), participantIsSeated({ participant: seat, run }))
        .count(),
      cards: each(
        Responding._submittedAnswers({ subject: round }).is({ response, participant, item, value }),
      )
        .where(
          compute(computations.cardId, { response, item }, card),
          cardStands({ card }),
          Subscribing._isSubscribed({ user: participant, target: run }).is({ subscribed: model }),
          compute(computations.isSame, { left: response, right: viewer }, mine),
          compute(computations.partLabel, { value: presentation, item }, part),
          whether(Categorizing._getCategory({ item: card }).is({ category: pile })),
        )
        .form({ card, value, part, pile, model, mine }),
      piles: each(Categorizing._categoriesIn({ scope: round }).is({ category, name, description }))
        .where(
          Guiding._guidanceText({ subject: category, use: "pile-definition" }).is({
            text: definition,
          }),
          Guiding._guidanceText({ subject: category, use: "pile-summary" }).is({ text: summary }),
        )
        .form({
          pile: category,
          name,
          description: summary,
          definition,
          legacyText: description,
          count: each(Categorizing._getItems({ category }).is({ item: held }))
            .where(cardStands({ card: held }))
            .count(),
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
  ({ asking, reply, round, categories, values, removed, reading, lines, at }) =>
    when(Reasoning.answer({ asking, reply }).responds())
      .where(
        now(at),
        Reasoning._asking({ asking }).is({ about: round }),
        roundIsAWall({ round }),
        sortingPiles({ round }).is({ categories }),
        Responding._valuesForSubject({ subject: round }).is({ values }),
        Trashing._trashedItems({}).is({ items: removed }),
        compute(computations.placingReading, { reply, categories, values, removed }, reading),
        is.among(reading, ["placed"]),
        compute(computations.placingLines, { reply, categories, values, removed }, lines),
      )
      .then(Suggesting.offer({ subject: round, lines, at })),
);

export const ReplyOffersLid = reaction(
  ({ asking, reply, round, categories, values, removed, reading, lines, at }) =>
    when(Reasoning.answer({ asking, reply }).responds())
      .where(
        now(at),
        Reasoning._asking({ asking }).is({ about: round }),
        roundIsAWall({ round }),
        sortingPiles({ round }).is({ categories }),
        Responding._valuesForSubject({ subject: round }).is({ values }),
        Trashing._trashedItems({}).is({ items: removed }),
        compute(computations.placingReading, { reply, categories, values, removed }, reading),
        is.among(reading, ["lid"]),
        compute(computations.lidLines, { reply, categories }, lines),
      )
      .then(Suggesting.offer({ subject: round, lines, at })),
);

export const ReplyUnusableComplains = reaction(
  ({ asking, reply, round, categories, values, removed, reading, account }) =>
    when(Reasoning.answer({ asking, reply }).responds())
      .where(
        Reasoning._asking({ asking }).is({ about: round }),
        roundIsAWall({ round }),
        sortingPiles({ round }).is({ categories }),
        Responding._valuesForSubject({ subject: round }).is({ values }),
        Trashing._trashedItems({}).is({ items: removed }),
        compute(computations.placingReading, { reply, categories, values, removed }, reading),
        is.among(reading, ["neither"]),
        compute(computations.placingReason, { reply, categories, values, removed }, account),
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
      cardStands({ card: target }),
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
      cardStands({ card: target }),
    )
    .then(Categorizing.file({ scope: round, name: value, item: target })),
);

export const TakenLidDescribesPile = reaction(({ suggestion, kind, target, value, round }) =>
  when(Suggesting.take({ suggestion }).responds({ kind, target, value }))
    .where(
      Suggesting._suggestion({ suggestion }).is({ subject: round }),
      roundIsAWall({ round }),
      is.among(kind, ["lid"]),
      Categorizing._getCategoryDetail({ category: target }).is({ scope: round }),
    )
    .then(Guiding.set({ subject: target, use: "pile-summary", title: "", body: value })),
);

/**
 * A usable reply settles whatever was being insisted on for the round, whether
 * or not it has a line to offer: a reply that places nothing new is not stood
 * upon.
 */
export const PlacedReplySatisfiesInsistence = reaction(
  ({ asking, reply, round, categories, values, removed, reading }) =>
    when(Reasoning.answer({ asking, reply }).responds())
      .where(
        Reasoning._asking({ asking }).is({ about: round }),
        roundIsAWall({ round }),
        sortingPiles({ round }).is({ categories }),
        Responding._valuesForSubject({ subject: round }).is({ values }),
        Trashing._trashedItems({}).is({ items: removed }),
        compute(computations.placingReading, { reply, categories, values, removed }, reading),
        is.among(reading, ["placed", "nothing", "lid"]),
        Insisting._unsettledFor({ aim: round }),
      )
      .then(Insisting.satisfy({ aim: round })),
);

/** While patience remains, a complaint carries the exchange back to the reasoner. */
export const ComplaintRetriesTheAsk = reaction(
  ({
    round,
    offering,
    account,
    value,
    categories,
    values,
    removed,
    notes,
    passage,
    at,
    previous,
  }) =>
    when(Insisting.complain({ aim: round, offering, account }).responds())
      .where(
        now(at),
        earlier(Reasoning.answer, { asking: previous }, {}),
        roundIsAWall({ round }),
        Insisting._standingFor({ aim: round }),
        RunSnapshotting._snapshot({ subject: round }).is({ value }),
        sortingPiles({ round }).is({ categories }),
        Responding._valuesForSubject({ subject: round }).is({ values }),
        Trashing._trashedItems({}).is({ items: removed }),
        theNotesFor({ round }).is({ notes }),
        compute(
          computations.placingRepairPassage,
          { value, categories, values, removed, notes, offering, account },
          passage,
        ),
      )
      .then(Reasoning.followUp({ previous, passage, at })),
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
 * Before recording a reply, hold both that reply and the round through its
 * consequences. The per-reply locks let overlapping replies finish independently.
 * A repair ask waiting on a provider holds no new lock, so a lost retry still
 * costs one tick. These locks never block manual wall controls.
 */
export const AnsweringHoldsRound = reaction(({ asking, round, at }) =>
  when(Reasoning.answer({ asking }))
    .where(
      now(at),
      Reasoning._asking({ asking }).is({ about: round, pending: true }),
      roundIsAWall({ round }),
      Locking._isLocked({ target: asking }).is({ locked: false }),
    )
    .then(Locking.lock({ target: asking, at }).responds())
    .then(
      where(
        Reasoning._asking({ asking }).is({ about: round }),
        Locking._isLocked({ target: round }).is({ locked: false }),
      ).then(Locking.lock({ target: round, at })),
    ),
);

export const AppliedReplyReleasesHold = reaction(({ asking, round }) =>
  when(Reasoning.answer({ asking }).responds())
    .afterFlowSettles()
    .where(
      Reasoning._asking({ asking }).is({ about: round }),
      roundIsAWall({ round }),
      Locking._isLocked({ target: asking }).is({ locked: true }),
    )
    .then(Locking.unlock({ target: asking })),
);

/** Release the round only after every applying reply and untaken line finishes. */
export const AnsweredAskUnlocksRound = reaction(({ asking, round }) =>
  when(Reasoning.answer({ asking }).responds())
    .afterFlowSettles()
    .where(
      Reasoning._asking({ asking }).is({ about: round }),
      roundIsAWall({ round }),
      no(aReplyIsApplying({ round })),
      noOfferingIsBeingTakenAbout({ round }),
      Locking._isLocked({ target: round }).is({ locked: true }),
    )
    .then(Locking.unlock({ target: round })),
);

export const FailedAskUnlocksRound = reaction(({ asking, round }) =>
  when(Reasoning.fail({ asking }).responds())
    .afterFlowSettles()
    .where(
      Reasoning._asking({ asking }).is({ about: round }),
      roundIsAWall({ round }),
      no(aReplyIsApplying({ round })),
      noOfferingIsBeingTakenAbout({ round }),
      Locking._isLocked({ target: round }).is({ locked: true }),
    )
    .then(Locking.unlock({ target: round })),
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

/**
 * Naming a pile that already stands on this wall reaches it rather than making
 * another. With a card, the card is placed in it, which is what dropping a card
 * on the new-pile cell does; without one, the pile opens empty, which is what
 * a click on the cell does.
 */
export const OpenPile = endpoint(
  "/live/walls/open-pile",
  ({ session, round, name, card, user, at, given, category, opened, assigned }) =>
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
        .named("with-card"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsNotOfAClosedRun({ round }),
        compute(computations.cardGiven, { card }, given),
        is.among(given, ["none"]),
      )
        .then(
          Categorizing.ensureCategory({ scope: round, name, description: "" }).responds({
            category: opened,
          }),
        )
        .then(respond({ pile: opened }))
        .named("empty"),
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
        compute(computations.cardGiven, { card }, given),
        is.among(given, ["given"]),
        no(cardIsOnTheWallOf({ card, round })),
      )
        .then(respond({ error: "CARD_NOT_FOUND" }))
        .named("no-such-card"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "round", "name"], defaults: { card: "" } } },
);

/**
 * A choice nobody chose leaves no ballot and so no pile to pick. Naming the
 * choice opens the empty pile of that name, which is then picked like any
 * other; a name that already stands on this wall reaches it rather than making
 * another, and a name the round never offered is no pile of this wall.
 */
export const OpenChoice = endpoint(
  "/live/walls/open-choice",
  ({ session, round, name, user, category }) =>
    receive({ session, round, name }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsNotOfAClosedRun({ round }),
        nameIsAChoiceOf({ name, round }),
      )
        .then(
          Categorizing.ensureCategory({ scope: round, name, description: "" }).responds({
            category,
          }),
        )
        .then(respond({ pile: category }))
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
        no(nameIsAChoiceOf({ name, round })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("no-such-choice"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "round", "name"] } },
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

/**
 * Removing a card takes it off the wall for every screen on its next poll: the
 * card is trashed, and the hand-in behind it is kept, so the figure still
 * counts the student who handed it in. A card already removed is no card of
 * this wall.
 */
export const RemoveCard = endpoint(
  "/live/walls/remove-card",
  ({ session, round, card, user, at, removed }) =>
    receive({ session, round, card }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsNotOfAClosedRun({ round }),
        cardIsOnTheWallOf({ card, round }),
      )
        .then(Trashing.trash({ item: card, by: user, at }).responds({ item: removed }))
        .then(respond({ card: removed }))
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
  { input: { required: ["session", "round", "card"] } },
);

/** A removed card leaves the pile that held it, so the pile's count is its cards. */
export const RemovedCardLeavesItsPile = reaction(({ item, category, round }) =>
  when(Trashing.trash({ item }).responds())
    .where(
      Categorizing._getCategory({ item }).is({ category }),
      Categorizing._getCategoryDetail({ category }).is({ scope: round }),
      roundIsAWall({ round }),
    )
    .then(Categorizing.unassign({ item })),
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
  ({ session, pile, description, user, at, described, said, cleared }) =>
    receive({ session, pile, description }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileIsNotOfAClosedRun({ pile }),
        compute(computations.briefStanding, { request: description }, said),
        is.among(said, ["given"]),
      )
        .then(
          Guiding.set({
            subject: pile,
            use: "pile-summary",
            title: "",
            body: description,
          }).responds({ guidance: described }),
        )
        .then(respond({ pile }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        pileIsNotOfAClosedRun({ pile }),
        compute(computations.briefStanding, { request: description }, said),
        is.among(said, ["blank"]),
      )
        .then(Guiding.clear({ subject: pile, use: "pile-summary" }).responds({ cleared }))
        .then(respond({ pile }))
        .named("clear"),
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

/**
 * Picking a pile pins it in the round's scope; the dashboard sends one request
 * per pile it picks or unpicks, so two dashboards never overwrite each other's
 * whole set. The first pile picked stands highest, so the picked read back in
 * the order they were taken.
 */
export const Pick = endpoint(
  "/live/walls/pick",
  ({ session, round, pile, user, at, taken, priority }) =>
    receive({ session, round, pile }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsNotOfAClosedRun({ round }),
        pileIsOfRound({ pile, round }),
        Pinning._isPinned({ item: pile, scope: round }).is({ pinned: false }),
        thePickCount({ round }).is({ taken }),
        compute(computations.pickPriority, { count: taken }, priority),
      )
        .then(Pinning.pin({ item: pile, scope: round, priority, at }).responds())
        .then(respond({ pile }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsNotOfAClosedRun({ round }),
        pileIsOfRound({ pile, round }),
        Pinning._isPinned({ item: pile, scope: round }).is({ pinned: true }),
      )
        .then(respond({ pile }))
        .named("already-picked"),
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
        no(pileIsOfRound({ pile, round })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "round", "pile"] } },
);

/**
 * Unpicking a pile unpins it. Pinning's unpin changes nothing for a pile with
 * no pin, so two dashboards unpicking one pile in the same instant both
 * succeed: there is no read before the act for them to race.
 */
export const Unpick = endpoint(
  "/live/walls/unpick",
  ({ session, round, pile, user }) =>
    receive({ session, round, pile }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsNotOfAClosedRun({ round }),
        pileIsOfRound({ pile, round }),
      )
        .then(Pinning.unpin({ item: pile, scope: round }).responds())
        .then(respond({ pile }))
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
        no(pileIsOfRound({ pile, round })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "round", "pile"] } },
);

/** Keep the reservation before dropping the merged pile's pins. */
export const MergedReservedPileKeepsReservation = reaction(({ category, into, at }) =>
  when(Categorizing.mergeCategory({ category, into }).responds())
    .where(
      now(at),
      Pinning._isPinned({ item: category, scope: RESERVED_PILES }).is({ pinned: true }),
      Pinning._isPinned({ item: into, scope: RESERVED_PILES }).is({ pinned: false }),
    )
    .then(Pinning.pin({ item: into, scope: RESERVED_PILES, priority: 0, at }))
    .then(Pinning.clearItem({ item: category })),
);

/** If the destination is already reserved, only the obsolete pins remain. */
export const MergedReservedPileWasAlreadyKept = reaction(({ category, into }) =>
  when(Categorizing.mergeCategory({ category, into }).responds())
    .where(
      Pinning._isPinned({ item: category, scope: RESERVED_PILES }).is({ pinned: true }),
      Pinning._isPinned({ item: into, scope: RESERVED_PILES }).is({ pinned: true }),
    )
    .then(Pinning.clearItem({ item: category })),
);

/** An ordinary merged pile has no reservation to transfer. */
export const MergedPileIsUnpicked = reaction(({ category }) =>
  when(Categorizing.mergeCategory({ category }).responds())
    .where(Pinning._isPinned({ item: category, scope: RESERVED_PILES }).is({ pinned: false }))
    .then(Pinning.clearItem({ item: category })),
);

/** Optional witnesses make absence an ordinary proposal input. */
const authorizedSortingObservation = view(
  "authorized sorting observation",
  ({ user }, { supported }) =>
    where(mayHostLive({ user }), compute(computations.sortingObservationPresent, {}, supported)),
).optional();

const liveSortingObservation = view("live sorting observation", ({ round }, { supported }) =>
  where(roundIsLive({ round }), compute(computations.sortingObservationPresent, {}, supported)),
).optional();

const openRunSortingObservation = view("openRun sorting observation", ({ round }, { supported }) =>
  where(
    roundIsOfAnOpenRun({ round }),
    compute(computations.sortingObservationPresent, {}, supported),
  ),
).optional();

const waitingSortingObservation = view("waiting sorting observation", ({ round }, { supported }) =>
  where(
    roundHasACardInTheTray({ round }),
    compute(computations.sortingObservationPresent, {}, supported),
  ),
).optional();

const unlockedSortingObservation = view(
  "unlocked sorting observation",
  ({ round }, { supported }) =>
    where(
      Locking._isLocked({ target: round }).is({ locked: false }),
      compute(computations.sortingObservationPresent, {}, supported),
    ),
).optional();

const answeredSortingObservation = view(
  "answered sorting observation",
  ({ round }, { supported }) =>
    where(
      noAskStandsAbout({ round }),
      compute(computations.sortingObservationPresent, {}, supported),
    ),
).optional();

const appliedSortingObservation = view("applied sorting observation", ({ round }, { supported }) =>
  where(
    noOfferingIsBeingTakenAbout({ round }),
    compute(computations.sortingObservationPresent, {}, supported),
  ),
).optional();

const readySortingObservation = view("ready sorting observation", ({ round, at }, { supported }) =>
  where(
    no(roundHasAFreshFailure({ round, at })),
    compute(computations.sortingObservationPresent, {}, supported),
  ),
).optional();

/** A automatic request records one proposal before any response branch is chosen. */
export const Sort = endpoint(
  "/live/walls/sort",
  ({
    session,
    round,
    user,
    at,
    authorized,
    live,
    openRun,
    waiting,
    unlocked,
    answered,
    applied,
    ready,
    value,
    categories,
    values,
    removed,
    notes,
    commission,
    status,
    account,
    brief,
    asking,
  }) =>
    receive({ session, round })
      .then(
        where(
          now(at),
          activeUser({ session }).is({ user }),
          whether(authorizedSortingObservation({ user }).is({ supported: authorized })),
          whether(liveSortingObservation({ round }).is({ supported: live })),
          whether(openRunSortingObservation({ round }).is({ supported: openRun })),
          whether(waitingSortingObservation({ round }).is({ supported: waiting })),
          whether(unlockedSortingObservation({ round }).is({ supported: unlocked })),
          whether(answeredSortingObservation({ round }).is({ supported: answered })),
          whether(appliedSortingObservation({ round }).is({ supported: applied })),
          whether(readySortingObservation({ round, at }).is({ supported: ready })),
          whether(RunSnapshotting._snapshot({ subject: round }).is({ value })),
          sortingPiles({ round }).is({ categories }),
          Responding._valuesForSubject({ subject: round }).is({ values }),
          Trashing._trashedItems({}).is({ items: removed }),
          whether(theNotesFor({ round }).is({ notes })),
          compute(
            computations.sortingAdmission,
            {
              mode: "automatic",
              authorized,
              live,
              openRun,
              waiting,
              unlocked,
              answered,
              applied,
              ready,
              value,
            },
            account,
          ),
          compute(
            computations.sortingBrief,
            { account, value, categories, values, removed, notes },
            brief,
          ),
        ).then(
          Commissioning.prepare({ subject: round, brief, account, at }).responds({
            commission,
            status,
            account,
          }),
        ),
      )
      .then(
        where(is.among(status, ["prepared"]))
          .then(Locking.lock({ target: round, at }).responds())
          .then(Commissioning.accept({ commission, at }).responds({ brief }))
          .then(
            Reasoning.ask({ reasoner: REASONER, about: round, passage: brief, at }).responds({
              asking,
            }),
          )
          .then(Commissioning.assign({ commission, execution: asking, at }).responds())
          .then(respond({ asked: true, asking }))
          .named("asked"),
        where(is.among(status, ["declined"]), is.among(account, ["idle"]))
          .then(respond({ asked: false }))
          .named("idle"),
        where(is.among(status, ["declined"]), is.among(account, ["FORBIDDEN"]))
          .then(respond({ error: "FORBIDDEN" }))
          .named("forbidden"),
        where(is.among(status, ["declined"]), is.among(account, ["CLOSED"]))
          .then(respond({ error: "CLOSED" }))
          .named("closed"),
      ),
  { input: { required: ["session", "round"] } },
);

/** A losing admission records its failure; the boundary still reports the lock refusal. */
export const ContendedCommissionFails = reaction(({ commission, at }) =>
  when(Locking.lock({}).refuses({ error: "TARGET_ALREADY_LOCKED" }))
    .where(now(at), earlier(Commissioning.prepare, {}, { commission }))
    .then(
      Commissioning.conclude({
        commission,
        successful: false,
        account: "Another operation holds the round.",
        at,
      }),
    ),
);

/** Either order of a correction and its commission association preserves the undertaking. */
export const RepairAskJoinsCommission = reaction(({ asking, previous, commission, at }) =>
  when(Reasoning.followUp({ previous }).responds({ asking }))
    .where(now(at), Commissioning._forExecution({ execution: previous }).is({ commission }))
    .then(Commissioning.assign({ commission, execution: asking, at })),
);

export const AssignedCommissionIncludesRepairs = reaction(({ commission, previous, asking, at }) =>
  when(Commissioning.assign({ commission, execution: previous }).responds())
    .where(now(at), Reasoning._followups({ previous }).is({ asking }))
    .then(Commissioning.assign({ commission, execution: asking, at })),
);

/** Read the conclusion only after the execution's placement hold has been released. */
const commissionedExecutionResult = view(
  "conclusion of commissioned execution (asking)",
  (
    { asking },
    { successful, account },
    { round, reply, failure, insistence, categories, values, removed, outcome, successors },
  ) =>
    where(
      Reasoning._asking({ asking }).is({ about: round }),
      roundIsAWall({ round }),
      Locking._isLocked({ target: asking }).is({ locked: false }),
      whether(Reasoning._replyOf({ asking }).is({ reply })),
      whether(Reasoning._failureOf({ asking }).is({ account: failure })),
      whether(Insisting._unsettledFor({ aim: round }).is({ insistence })),
      count(Reasoning._followups, { previous: asking }, successors),
      sortingPiles({ round }).is({ categories }),
      Responding._valuesForSubject({ subject: round }).is({ values }),
      Trashing._trashedItems({}).is({ items: removed }),
      compute(
        computations.commissionOutcome,
        { reply, failure, insistence, categories, values, removed, successors },
        outcome,
      ),
      is.among(outcome, ["completed", "failed"]),
      compute(computations.isSame, { left: outcome, right: "completed" }, successful),
      compute(computations.commissionAccount, { outcome, failure }, account),
    ),
);

/** Placement completion is a receipt; it need not wait for association paperwork. */
export const ReleasedReplyReportsCompletion = reaction(({ asking, successful, account, at }) =>
  when(Locking.unlock({ target: asking }).responds())
    .afterFlowSettles()
    .where(now(at), commissionedExecutionResult({ asking }).is({ successful, account }))
    .then(Commissioning.report({ execution: asking, successful, account, at })),
);

export const FailedExecutionReportsCompletion = reaction(({ asking, successful, account, at }) =>
  when(Reasoning.fail({ asking }).responds())
    .afterFlowSettles()
    .where(now(at), commissionedExecutionResult({ asking }).is({ successful, account }))
    .then(Commissioning.report({ execution: asking, successful, account, at })),
);

/** Ordinary domain refusals precede completion at the flow's settlement frontier. */
export const RefusedPlacementReportsFailure = reaction(({ asking, at }) =>
  when(Categorizing.assign({}).refuses({ error: "CATEGORY_NOT_FOUND" }))
    .where(now(at), earlier(Reasoning.answer, {}, { asking }))
    .then(
      Commissioning.report({
        execution: asking,
        successful: false,
        account: "A placement could not be applied.",
        at,
      }),
    ),
);

export const RefusedLidReportsFailure = reaction(({ asking, at }) =>
  when(Categorizing.describeCategory({}).refuses({ error: "CATEGORY_NOT_FOUND" }))
    .where(now(at), earlier(Reasoning.answer, {}, { asking }))
    .then(
      Commissioning.report({
        execution: asking,
        successful: false,
        account: "A pile description could not be applied.",
        at,
      }),
    ),
);

/** A pile removed while the summary was being written is an application refusal. */
export const MissingSummaryPileReportsFailure = reaction(
  ({ suggestion, kind, target, asking, at }) =>
    when(Suggesting.take({ suggestion }).responds({ kind, target }))
      .where(
        is.among(kind, ["lid"]),
        no(Categorizing._getCategoryDetail({ category: target })),
        now(at),
        earlier(Reasoning.answer, {}, { asking }),
      )
      .then(
        Commissioning.report({
          execution: asking,
          successful: false,
          account: "The summarized pile no longer exists.",
          at,
        }),
      ),
);

/**
 * Closing a round with the run's switch on settles its wall: one last ask over
 * whatever is left in the tray, on the path the tick takes and with the same
 * passage, and after it the model never touches the round unless a hand
 * presses Resort, since the tick asks about an open round only. An ask
 * already out at the close is the settling ask — its reply places what it was
 * asked about, and nothing asks again — so the close asks only where the tick
 * would have. With the switch off the close asks nothing.
 */
export const ClosedRoundSettlesWall = reaction(
  ({
    round,
    at,
    run,
    value,
    categories,
    values,
    removed,
    notes,
    passage,
    commission,
    brief,
    asking,
  }) =>
    when(Publishing.close({ edition: round, at }).responds())
      .where(
        roundIsAWall({ round }),
        theRunOf({ round }).is({ run }),
        Pinning._isPinned({ item: run, scope: SORTING }).is({ pinned: true }),
        roundHasACardInTheTray({ round }),
        noAskStandsAbout({ round }),
        Locking._isLocked({ target: round }).is({ locked: false }),
        noOfferingIsBeingTakenAbout({ round }),
        RunSnapshotting._snapshot({ subject: round }).is({ value }),
        sortingPiles({ round }).is({ categories }),
        Responding._valuesForSubject({ subject: round }).is({ values }),
        Trashing._trashedItems({}).is({ items: removed }),
        theNotesFor({ round }).is({ notes }),
        compute(
          computations.placingPassage,
          { value, categories, values, removed, notes },
          passage,
        ),
      )
      .then(
        Commissioning.prepare({ subject: round, brief: passage, account: "", at }).responds({
          commission,
        }),
      )
      .then(Locking.lock({ target: round, at }).responds())
      .then(Commissioning.accept({ commission, at }).responds({ brief }))
      .then(
        Reasoning.ask({ reasoner: REASONER, about: round, passage: brief, at }).responds({
          asking,
        }),
      )
      .then(Commissioning.assign({ commission, execution: asking, at })),
);

/** A manual request records one proposal before any response branch is chosen. */
export const SortNow = endpoint(
  "/live/walls/sort-now",
  ({
    session,
    round,
    user,
    at,
    authorized,
    live,
    openRun,
    waiting,
    unlocked,
    answered,
    applied,
    ready,
    value,
    categories,
    values,
    removed,
    notes,
    commission,
    status,
    account,
    brief,
    asking,
  }) =>
    receive({ session, round })
      .then(
        where(
          now(at),
          activeUser({ session }).is({ user }),
          whether(authorizedSortingObservation({ user }).is({ supported: authorized })),
          whether(liveSortingObservation({ round }).is({ supported: live })),
          whether(openRunSortingObservation({ round }).is({ supported: openRun })),
          whether(waitingSortingObservation({ round }).is({ supported: waiting })),
          whether(unlockedSortingObservation({ round }).is({ supported: unlocked })),
          whether(answeredSortingObservation({ round }).is({ supported: answered })),
          whether(appliedSortingObservation({ round }).is({ supported: applied })),
          whether(readySortingObservation({ round, at }).is({ supported: ready })),
          whether(RunSnapshotting._snapshot({ subject: round }).is({ value })),
          sortingPiles({ round }).is({ categories }),
          Responding._valuesForSubject({ subject: round }).is({ values }),
          Trashing._trashedItems({}).is({ items: removed }),
          whether(theNotesFor({ round }).is({ notes })),
          compute(
            computations.sortingAdmission,
            {
              mode: "manual",
              authorized,
              live,
              openRun,
              waiting,
              unlocked,
              answered,
              applied,
              ready,
              value,
            },
            account,
          ),
          compute(
            computations.sortingBrief,
            { account, value, categories, values, removed, notes },
            brief,
          ),
        ).then(
          Commissioning.prepare({ subject: round, brief, account, at }).responds({
            commission,
            status,
            account,
          }),
        ),
      )
      .then(
        where(is.among(status, ["prepared"]))
          .then(Locking.lock({ target: round, at }).responds())
          .then(Commissioning.accept({ commission, at }).responds({ brief }))
          .then(
            Reasoning.ask({ reasoner: REASONER, about: round, passage: brief, at }).responds({
              asking,
            }),
          )
          .then(Commissioning.assign({ commission, execution: asking, at }).responds())
          .then(respond({ asked: true, asking }))
          .named("asked"),
        where(is.among(status, ["declined"]), is.among(account, ["idle"]))
          .then(respond({ asked: false }))
          .named("idle"),
        where(is.among(status, ["declined"]), is.among(account, ["FORBIDDEN"]))
          .then(respond({ error: "FORBIDDEN" }))
          .named("forbidden"),
        where(is.among(status, ["declined"]), is.among(account, ["CLOSED"]))
          .then(respond({ error: "CLOSED" }))
          .named("closed"),
      ),
  { input: { required: ["session", "round"] } },
);

/**
 * The run's note to the sorter: one entry of guidance on the round itself,
 * set whole each time so two dashboards writing at once leave one. It stands
 * beside the relay's note, which the editor owns, and is read after it on
 * every ask; a run's note is never copied to the leg, so the next run of the
 * relay starts without it.
 */
export const SetNotes = endpoint(
  "/live/walls/set-notes",
  ({ session, round, body, user, at, guidance }) =>
    receive({ session, round, body }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsAWall({ round }),
        roundIsNotOfAClosedRun({ round }),
      )
        .then(
          Guiding.set({ subject: round, use: SORTING_USE, title: "", body }).responds({ guidance }),
        )
        .then(respond({ guidance }))
        .named("set"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsAWall({ round }),
        roundIsOfAClosedRun({ round }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(roundIsAWall({ round })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "round", "body"] } },
);

export const ClearNotes = endpoint(
  "/live/walls/clear-notes",
  ({ session, round, user, cleared }) =>
    receive({ session, round }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsAWall({ round }),
        roundIsNotOfAClosedRun({ round }),
      )
        .then(Guiding.clear({ subject: round, use: SORTING_USE }).responds({ cleared }))
        .then(respond({ cleared }))
        .named("cleared"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsAWall({ round }),
        roundIsOfAClosedRun({ round }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(roundIsAWall({ round })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "round"] } },
);

/** Emptying owns the change and answers even when no membership remains. */
export const EmptyPiles = endpoint(
  "/live/walls/empty-piles",
  ({ session, round, user, emptied }) =>
    receive({ session, round }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsNotOfAClosedRun({ round }),
      )
        .then(Categorizing.empty({ scope: round }).responds({ emptied }))
        .then(respond({ emptied }))
        .named("emptied"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        roundIsOfAClosedRun({ round }),
      )
        .then(respond({ error: "CLOSED" }))
        .named("closed"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "round"] } },
);

const summaryWork = view("the number of cards in (pile)", ({ pile }, { items }, _bindings) =>
  where(count(Categorizing._getItems, { category: pile }, items)),
).one();

/** A summary remembers its brief and settles through the same reply receipts as sorting. */
export const Summarize = endpoint(
  "/live/walls/summarize",
  ({
    session,
    pile,
    user,
    at,
    round,
    categories,
    values,
    removed,
    passage,
    asking,
    items,
    account,
    commission,
    status,
    brief,
  }) =>
    receive({ session, pile })
      .then(
        where(
          now(at),
          activeUser({ session }).is({ user }),
          mayHostLive({ user }),
          pileIsNotOfAClosedRun({ pile }),
          summaryWork({ pile }).is({ items }),
          Categorizing._getCategoryDetail({ category: pile }).is({ scope: round }),
          sortingPiles({ round }).is({ categories }),
          Responding._valuesForSubject({ subject: round }).is({ values }),
          Trashing._trashedItems({}).is({ items: removed }),
          compute(computations.lidPassage, { pile, categories, values, removed }, passage),
          compute(computations.summaryAdmission, { items }, account),
        ).then(
          Commissioning.prepare({ subject: round, brief: passage, account, at }).responds({
            commission,
            subject: round,
            status,
          }),
        ),
      )
      .then(
        where(is.among(status, ["prepared"]))
          .then(Commissioning.accept({ commission, at }).responds({ brief }))
          .then(
            Reasoning.ask({ reasoner: REASONER, about: round, passage: brief, at }).responds({
              asking,
            }),
          )
          .then(Commissioning.assign({ commission, execution: asking, at }).responds())
          .then(respond({ asked: true, asking }))
          .named("asked"),
        where(is.among(status, ["declined"]))
          .then(respond({ asked: false }))
          .named("empty"),
      ),
  { input: { required: ["session", "pile"] } },
);

export const SummarizeRefused = endpoint("/live/walls/summarize", ({ session, pile, user }) =>
  receive({ session, pile }).then(
    where(activeUser({ session }).is({ user }), mayHostLive({ user }), pileIsOfAClosedRun({ pile }))
      .then(respond({ error: "CLOSED" }))
      .named("closed"),
    where(activeUser({ session }).is({ user }), mayHostLive({ user }), pileDoesNotExist({ pile }))
      .then(respond({ error: "CATEGORY_NOT_FOUND" }))
      .named("missing"),
    where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

/** The starting set exists only for a wall with a captured round presentation. */
const cleanupStanding = view(
  "the starting piles of (round)",
  ({ round }, { standing }, { questionnaire, leg }) =>
    where(
      roundIsAWall({ round }),
      Publishing._edition({ edition: round }).is({ material: questionnaire }),
      Relaying._legFor({ material: questionnaire }).is({ leg }),
      Categorizing._categoriesWithItems({ scope: leg }).is({ categories: standing }),
    ),
).optional();

/** Record one cleanup selection and disposition, then recheck emptiness on deletion. */
export const ClearEmptyPiles = endpoint(
  "/live/walls/clear-empty-piles",
  ({
    session,
    round,
    user,
    at,
    authorized,
    openRun,
    unlocked,
    applied,
    categories,
    picked,
    reserved,
    standing,
    candidates,
    deleted,
    account,
    brief,
    commission,
    status,
  }) =>
    receive({ session, round })
      .then(
        where(
          now(at),
          activeUser({ session }).is({ user }),
          whether(authorizedSortingObservation({ user }).is({ supported: authorized })),
          whether(openRunSortingObservation({ round }).is({ supported: openRun })),
          whether(unlockedSortingObservation({ round }).is({ supported: unlocked })),
          whether(appliedSortingObservation({ round }).is({ supported: applied })),
          whether(cleanupStanding({ round }).is({ standing })),
          sortingPiles({ round }).is({ categories }),
          Pinning._pinnedItems({ scope: round }).is({ items: picked }),
          Pinning._pinnedItems({ scope: RESERVED_PILES }).is({ items: reserved }),
          compute(
            computations.clearablePiles,
            { categories, standing, picked, reserved },
            candidates,
          ),
          compute(
            computations.cleanupAdmission,
            { authorized, openRun, unlocked, applied, standing },
            account,
          ),
          compute(computations.cleanupBrief, { account, candidates }, brief),
        ).then(
          Commissioning.prepare({ subject: round, brief, account, at }).responds({
            commission,
            status,
            account,
          }),
        ),
      )
      .then(
        where(is.among(status, ["prepared"]))
          .then(Commissioning.accept({ commission, at }).responds({ brief }))
          .named("accepted"),
        where(is.among(status, ["declined"]), is.among(account, ["FORBIDDEN"]))
          .then(respond({ error: "FORBIDDEN" }))
          .named("forbidden"),
        where(is.among(status, ["declined"]), is.among(account, ["NOT_FOUND"]))
          .then(respond({ error: "NOT_FOUND" }))
          .named("missing"),
        where(is.among(status, ["declined"]), is.among(account, ["CONFLICT"]))
          .then(respond({ error: "CONFLICT" }))
          .named("busy-or-closed"),
      )
      .then(
        where(
          is.among(status, ["prepared"]),
          compute(computations.cleanupCategories, { brief }, candidates),
        ).then(
          Categorizing.deleteEmptyCategories({ categories: candidates }).responds({ deleted }),
        ),
      )
      .then(
        Commissioning.conclude({
          commission,
          successful: true,
          account: "Empty-only cleanup finished.",
          at,
        }).responds(),
      )
      .then(respond({ cleared: deleted })),
  { input: { required: ["session", "round"] } },
);
