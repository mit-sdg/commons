import {
  compute,
  each,
  former,
  is,
  no,
  now,
  reaction,
  when,
  where,
} from "@mit-sdg/sync-engine/language";
import { USE_WORDS } from "../../computations/live-carries.ts";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { activeUser } from "../access/session.ts";
import {
  mayHostLive,
  mayNotHostLive,
  questionnaireHasAnOpenRun,
  questionnaireHasNoOpenRun,
} from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";

const { Questioning, Relaying, Insisting, Reasoning, Suggesting } = concepts;

/** The one reasoner name this composition asks for; the floor decides what answers it. */
const REASONER = "gemini-flash";

/** How many times an unusable reply is stood upon before the brief comes back empty. */
const PATIENCE = 2;

/**
 * The brief goes before the reasoner with the relay as it stands — every round
 * with its title, prompt, parts, choices, and takes — and asks for the whole
 * relay as it should read afterward.
 */
export const Draft = endpoint(
  "/live/edits/draft",
  ({ session, relay, request, user, at, said, legs, questionnaires, materials, passage, asking }) =>
    receive({ session, relay, request }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        compute(computations.briefStanding, { request }, said),
        is.among(said, ["given"]),
        Relaying._plan({ relay }).is({ legs }),
        compute(computations.legMaterials, { legs }, questionnaires),
        Questioning._materials({ questionnaires }).is({ materials }),
        compute(computations.relayDraftPassage, { request, legs, materials }, passage),
      )
        .then(
          Reasoning.ask({ reasoner: REASONER, about: relay, passage, at }).responds({
            asking,
          }),
        )
        .then(respond({ asking }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        compute(computations.briefStanding, { request }, said),
        is.among(said, ["blank"]),
      )
        .then(respond({ error: "INVALID_REQUEST" }))
        .named("blank"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._relay({ relay })),
      )
        .then(respond({ error: "RELAY_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "relay", "request"] } },
);

/**
 * A reply meets its reading against the relay as it stands now, not as it stood
 * when the ask went out. The readings partition every reply, so exactly one of
 * these fires per answered ask; both stand on the relay being a relay, so a
 * reply about a round's wall never matches here.
 */
export const ReplyOffersRelayEdits = reaction(
  ({ asking, reply, relay, reading, legs, questionnaires, materials, lines, at }) =>
    when(Reasoning.answer({ asking, reply }).responds())
      .where(
        now(at),
        Reasoning._asking({ asking }).is({ about: relay }),
        Relaying._relay({ relay }),
        compute(computations.relayDraftReading, { reply }, reading),
        is.among(reading, ["relay"]),
        Relaying._plan({ relay }).is({ legs }),
        compute(computations.legMaterials, { legs }, questionnaires),
        Questioning._materials({ questionnaires }).is({ materials }),
        compute(computations.relayEditLines, { reply, legs, materials }, lines),
      )
      .then(Suggesting.offer({ subject: relay, lines, at })),
);

export const ReplyUnusableComplains = reaction(({ asking, reply, relay, reading, account }) =>
  when(Reasoning.answer({ asking, reply }).responds())
    .where(
      Reasoning._asking({ asking }).is({ about: relay }),
      Relaying._relay({ relay }),
      compute(computations.relayDraftReading, { reply }, reading),
      is.among(reading, ["neither"]),
      compute(computations.relayDraftReason, { reply }, account),
    )
    .then(Insisting.complain({ aim: relay, patience: PATIENCE, offering: reply, account })),
);

/**
 * While patience remains, a complaint carries the exchange back to the
 * reasoner: the passage that was stood upon is the one whose reply came back
 * unusable, so the brief and the relay it was written against travel with it.
 */
export const ComplaintRetriesTheAsk = reaction(({ relay, offering, account, asked, passage, at }) =>
  when(Insisting.complain({ aim: relay, offering, account }).responds())
    .where(
      now(at),
      Relaying._relay({ relay }),
      Insisting._standingFor({ aim: relay }),
      Reasoning._repliesAbout({ about: relay }).is({ reply: offering, passage: asked }),
      compute(computations.relayDraftRepairPassage, { passage: asked, offering, account }, passage),
    )
    .then(Reasoning.ask({ reasoner: REASONER, about: relay, passage, at })),
);

/** A reading that turned into lines settles whatever was being insisted on. */
export const OfferedEditsSatisfyInsistence = reaction(({ relay }) =>
  when(Suggesting.offer({ subject: relay }).responds())
    .where(Relaying._relay({ relay }), Insisting._unsettledFor({ aim: relay }))
    .then(Insisting.satisfy({ aim: relay })),
);

/** Once patience is spent, the insistence closes and the panel reads that nothing came. */
export const SpentPatienceGivesUp = reaction(({ relay }) =>
  when(Insisting.complain({ aim: relay }).responds())
    .where(Relaying._relay({ relay }), Insisting._spentFor({ aim: relay }))
    .then(Insisting.giveUp({ aim: relay })),
);

/** A reasoner that could not be reached leaves nothing waiting silently. */
export const FailedAskGivesUp = reaction(({ asking, relay }) =>
  when(Reasoning.fail({ asking }).responds())
    .where(
      Reasoning._asking({ asking }).is({ about: relay }),
      Relaying._relay({ relay }),
      Insisting._unsettledFor({ aim: relay }),
    )
    .then(Insisting.giveUp({ aim: relay })),
);

/** Every offering about a relay, newest first, with its lines in order and where each stands. */
export const theOfferings = former(
  "the offerings about (relay)",
  ({ relay }, { offering, offeredAt, suggestion, kind, target, value, position, standing }) =>
    each(Suggesting._offeringsAbout({ subject: relay }).is({ offering, offeredAt })).form({
      offering,
      offeredAt,
      lines: each(
        Suggesting._suggestions({ offering }).is({
          suggestion,
          kind,
          target,
          value,
          position,
          standing,
        }),
      ).form({ suggestion, kind, target, value, position, standing }),
    }),
);

export const Offerings = endpoint(
  "/live/edits/offerings",
  ({ session, relay, user, at }) =>
    receive({ session, relay }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(respond({ offerings: theOfferings({ relay }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "relay"] } },
);

/**
 * A line is taken on its own request, so the asks that apply it read only their
 * own line. A line about a round whose run is open is refused before anything
 * changes, as the setup page's own edits are.
 */
export const Take = endpoint(
  "/live/edits/take",
  ({ session, suggestion, user, at, taken, target, questionnaire }) =>
    receive({ session, suggestion }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Suggesting._suggestion({ suggestion }).is({ target }),
        Relaying._leg({ leg: target }).is({ material: questionnaire }),
        questionnaireHasNoOpenRun({ questionnaire }),
      )
        .then(Suggesting.take({ suggestion }).responds({ suggestion: taken }))
        .then(respond({ suggestion: taken }))
        .named("round"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Suggesting._suggestion({ suggestion }).is({ target }),
        no(Relaying._leg({ leg: target })),
      )
        .then(Suggesting.take({ suggestion }).responds({ suggestion: taken }))
        .then(respond({ suggestion: taken }))
        .named("relay"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Suggesting._suggestion({ suggestion }).is({ target }),
        Relaying._leg({ leg: target }).is({ material: questionnaire }),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "suggestion"] } },
);

export const Decline = endpoint(
  "/live/edits/decline",
  ({ session, suggestion, user, at, declined }) =>
    receive({ session, suggestion }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(Suggesting.decline({ suggestion }).responds({ suggestion: declined }))
        .then(respond({ suggestion: declined }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "suggestion"] } },
);

/**
 * Taking a line is what applies it. Each kind has its own reaction, and each
 * asks the concept that owns what changes, so a line the concept refuses stays
 * taken with its refusal in the log and the relay reads as it did.
 */
export const TakenAddAddsRound = reaction(
  ({
    suggestion,
    value,
    relay,
    placed,
    author,
    round,
    asked,
    shaped,
    title,
    prompt,
    parts,
    cap,
    choices,
    at,
    questionnaire,
    question,
    added,
    landing,
    position,
    drawing,
    drawn,
    shape,
    from,
    source,
  }) =>
    when(Suggesting.take({ suggestion }).responds({ kind: "add", value }))
      .where(
        now(at),
        Suggesting._suggestion({ suggestion }).is({ subject: relay }),
        Relaying._relay({ relay }).is({ author }),
        compute(computations.editRoundJson, { value }, round),
        compute(computations.editTitle, { round }, title),
      )
      .then(
        Questioning.compose({
          author,
          title,
          form: "survey",
          disclosure: "score",
          at,
        }).responds({ questionnaire }),
      )
      .then(
        where(
          compute(computations.editRoundJson, { value }, asked),
          compute(computations.editPrompt, { round: asked }, prompt),
          compute(computations.editRoundChoices, { round: asked }, choices),
        ).then(
          Questioning.addQuestion({
            questionnaire,
            prompt,
            choices,
            expected: "",
            explanation: "",
            position: 1,
          }).responds({ question }),
        ),
      )
      .then(
        where(
          compute(computations.editRoundJson, { value }, shaped),
          compute(computations.editRoundParts, { round: shaped }, parts),
          compute(computations.editRoundCap, { round: shaped }, cap),
        ).then(Questioning.setParts({ question, parts, cap }).responds()),
      )
      .then(
        where(
          Questioning._getQuestion({ question }).is({ questionnaire }),
          Suggesting._suggestion({ suggestion }).is({ subject: placed }),
        ).then(
          Relaying.addLeg({ relay: placed, material: questionnaire }).responds({ leg: added }),
        ),
      )
      .then(
        where(
          compute(computations.editRoundJson, { value }, landing),
          compute(computations.editRoundPosition, { round: landing }, position),
          is.gt(position, 0),
        )
          .then(Relaying.moveLeg({ leg: added, position }))
          .named("placed"),
        where(
          compute(computations.editRoundJson, { value }, drawing),
          compute(computations.editRoundTakesShape, { round: drawing }, shape),
          is.among(shape, USE_WORDS),
          compute(computations.editRoundTakesFrom, { round: drawing }, from),
          Relaying._leg({ leg: added }).is({ relay: drawn }),
          Relaying._legs({ relay: drawn }).is({ leg: source, position: from }),
        )
          .then(Relaying.draw({ leg: added, source, shape }))
          .named("drawn"),
      ),
);

export const TakenRemoveRemovesRound = reaction(({ suggestion, target, relay, material }) =>
  when(Suggesting.take({ suggestion }).responds({ kind: "remove", target }))
    .where(
      Suggesting._suggestion({ suggestion }).is({ subject: relay }),
      Relaying._relay({ relay }),
      Relaying._leg({ leg: target }).is({ relay }),
    )
    .then(Relaying.removeLeg({ leg: target }).responds({ material }))
    .then(Questioning.retire({ questionnaire: material })),
);

export const TakenMoveMovesRound = reaction(({ suggestion, target, value, relay, position }) =>
  when(Suggesting.take({ suggestion }).responds({ kind: "move", target, value }))
    .where(
      Suggesting._suggestion({ suggestion }).is({ subject: relay }),
      Relaying._relay({ relay }),
      Relaying._leg({ leg: target }).is({ relay }),
      compute(computations.editPosition, { value }, position),
    )
    .then(Relaying.moveLeg({ leg: target, position })),
);

export const TakenTitleRetitlesRound = reaction(({ suggestion, target, value, relay, material }) =>
  when(Suggesting.take({ suggestion }).responds({ kind: "title", target, value }))
    .where(
      Suggesting._suggestion({ suggestion }).is({ subject: relay }),
      Relaying._relay({ relay }),
      Relaying._leg({ leg: target }).is({ relay, material }),
    )
    .then(Questioning.retitle({ questionnaire: material, title: value })),
);

export const TakenPromptRevisesRound = reaction(
  ({
    suggestion,
    target,
    value,
    relay,
    material,
    question,
    choices,
    expected,
    explanation,
    position,
  }) =>
    when(Suggesting.take({ suggestion }).responds({ kind: "prompt", target, value }))
      .where(
        Suggesting._suggestion({ suggestion }).is({ subject: relay }),
        Relaying._relay({ relay }),
        Relaying._leg({ leg: target }).is({ relay, material }),
        Questioning._getQuestions({ questionnaire: material }).is({
          question,
          choices,
          expected,
          explanation,
          position,
        }),
      )
      .then(
        Questioning.reviseQuestion({
          question,
          prompt: value,
          choices,
          expected,
          explanation,
          position,
        }),
      ),
);

export const TakenChoicesReviseRound = reaction(
  ({
    suggestion,
    target,
    value,
    relay,
    material,
    question,
    prompt,
    expected,
    explanation,
    position,
    choices,
  }) =>
    when(Suggesting.take({ suggestion }).responds({ kind: "choices", target, value }))
      .where(
        Suggesting._suggestion({ suggestion }).is({ subject: relay }),
        Relaying._relay({ relay }),
        Relaying._leg({ leg: target }).is({ relay, material }),
        Questioning._getQuestions({ questionnaire: material }).is({
          question,
          prompt,
          expected,
          explanation,
          position,
        }),
        compute(computations.editChoices, { value }, choices),
      )
      .then(
        Questioning.reviseQuestion({
          question,
          prompt,
          choices,
          expected,
          explanation,
          position,
        }),
      ),
);

export const TakenPartsSetParts = reaction(
  ({ suggestion, target, value, relay, material, question, parts, cap }) =>
    when(Suggesting.take({ suggestion }).responds({ kind: "parts", target, value }))
      .where(
        Suggesting._suggestion({ suggestion }).is({ subject: relay }),
        Relaying._relay({ relay }),
        Relaying._leg({ leg: target }).is({ relay, material }),
        Questioning._getQuestions({ questionnaire: material }).is({ question }),
        compute(computations.editParts, { value }, parts),
        compute(computations.editCap, { value }, cap),
      )
      .then(Questioning.setParts({ question, parts, cap })),
);

/**
 * A takes line names the source round by its number, which is the position of
 * the leg it stands at; a line that says the round takes nothing clears the
 * draw that stands.
 */
export const TakenTakesDraws = reaction(
  ({ suggestion, target, value, relay, shape, position, source }) =>
    when(Suggesting.take({ suggestion }).responds({ kind: "takes", target, value }))
      .where(
        Suggesting._suggestion({ suggestion }).is({ subject: relay }),
        Relaying._relay({ relay }),
        Relaying._leg({ leg: target }).is({ relay }),
        compute(computations.editShape, { value }, shape),
        is.among(shape, USE_WORDS),
        compute(computations.editPosition, { value }, position),
        Relaying._legs({ relay }).is({ leg: source, position }),
      )
      .then(Relaying.draw({ leg: target, source, shape })),
);

export const TakenTakesUndraws = reaction(({ suggestion, target, value, relay, shape, source }) =>
  when(Suggesting.take({ suggestion }).responds({ kind: "takes", target, value }))
    .where(
      Suggesting._suggestion({ suggestion }).is({ subject: relay }),
      Relaying._relay({ relay }),
      Relaying._leg({ leg: target }).is({ relay }),
      compute(computations.editShape, { value }, shape),
      is.among(shape, [""]),
      Relaying._draws({ leg: target }).is({ source }),
    )
    .then(Relaying.undraw({ leg: target, source })),
);
