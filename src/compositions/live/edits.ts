import {
  compute,
  each,
  earlier,
  former,
  is,
  no,
  now,
  reaction,
  when,
  where,
  whether,
} from "@mit-sdg/sync-engine/language";
import { USE_WORDS } from "../../computations/live-carries.ts";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { activeUser } from "../access/session.ts";
import {
  relayIsNotRetired,
  mayHostLive,
  mayNotHostLive,
  questionnaireHasAnOpenRun,
  questionnaireHasNoOpenRun,
} from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";
import { DRAFTING_USE } from "./drafting.ts";
import { SORTING_USE } from "./rounds.ts";

const { Categorizing, Guiding, Questioning, Relaying, Insisting, Reasoning, Suggesting } = concepts;

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
  ({
    session,
    relay,
    request,
    user,
    at,
    said,
    title,
    legs,
    questionnaires,
    materials,
    rounds,
    piles,
    notes,
    description,
    opening,
    closing,
    purposes,
    facilitations,
    selections,
    relayDocuments,
    passage,
    asking,
  }) =>
    receive({ session, relay, request }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        compute(computations.briefStanding, { request }, said),
        is.among(said, ["given"]),
        Relaying._relay({ relay }).is({ title }),
        Relaying._plan({ relay }).is({ legs }),
        compute(computations.legMaterials, { legs }, questionnaires),
        Questioning._materials({ questionnaires }).is({ materials }),
        compute(computations.legIdentities, { legs }, rounds),
        Categorizing._categoriesInScopes({ scopes: rounds }).is({ categories: piles }),
        Guiding._guidanceTexts({ subjects: rounds, use: SORTING_USE }).is({ texts: notes }),
        Guiding._guidanceText({ subject: relay, use: "relay-description" }).is({
          text: description,
        }),
        Guiding._guidanceText({ subject: relay, use: "hosting-opening" }).is({ text: opening }),
        Guiding._guidanceText({ subject: relay, use: "hosting-closing" }).is({ text: closing }),
        Guiding._guidanceTexts({ subjects: rounds, use: "hosting-purpose" }).is({
          texts: purposes,
        }),
        Guiding._guidanceTexts({ subjects: rounds, use: "hosting-facilitation" }).is({
          texts: facilitations,
        }),
        Guiding._guidanceTexts({ subjects: rounds, use: "hosting-selection" }).is({
          texts: selections,
        }),
        Guiding._selectedDocuments({ subject: relay, use: DRAFTING_USE }).is({
          documents: relayDocuments,
        }),
        compute(
          computations.relayDraftPassage,
          {
            request,
            title,
            legs,
            materials,
            piles,
            notes,
            description,
            opening,
            closing,
            purposes,
            facilitations,
            selections,
            classDocuments: "",
            relayDocuments,
          },
          passage,
        ),
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
 * reply about a round's wall never matches here. A reply that names a relay
 * still standing under the placeholder its brief minted has that one line taken
 * where it is offered, so the relay carries the model's name and the panel asks
 * about the rounds alone.
 */
export const ReplyOffersRelayEdits = reaction(
  ({
    asking,
    reply,
    relay,
    passage,
    title,
    reading,
    legs,
    questionnaires,
    materials,
    rounds,
    piles,
    notes,
    description,
    opening,
    closing,
    purposes,
    facilitations,
    selections,
    lines,
    at,
    offering,
    stood,
    named,
    suggestion,
    kind,
    target,
  }) =>
    when(Reasoning.answer({ asking, reply }).responds())
      .where(
        now(at),
        Reasoning._asking({ asking }).is({ about: relay, passage }),
        Relaying._relay({ relay }).is({ title }),
        compute(computations.relayDraftReading, { reply, passage }, reading),
        is.among(reading, ["relay", "named"]),
        Relaying._plan({ relay }).is({ legs }),
        compute(computations.legMaterials, { legs }, questionnaires),
        Questioning._materials({ questionnaires }).is({ materials }),
        compute(computations.legIdentities, { legs }, rounds),
        Categorizing._categoriesInScopes({ scopes: rounds }).is({ categories: piles }),
        Guiding._guidanceTexts({ subjects: rounds, use: SORTING_USE }).is({ texts: notes }),
        Guiding._guidanceText({ subject: relay, use: "relay-description" }).is({
          text: description,
        }),
        Guiding._guidanceText({ subject: relay, use: "hosting-opening" }).is({ text: opening }),
        Guiding._guidanceText({ subject: relay, use: "hosting-closing" }).is({ text: closing }),
        Guiding._guidanceTexts({ subjects: rounds, use: "hosting-purpose" }).is({
          texts: purposes,
        }),
        Guiding._guidanceTexts({ subjects: rounds, use: "hosting-facilitation" }).is({
          texts: facilitations,
        }),
        Guiding._guidanceTexts({ subjects: rounds, use: "hosting-selection" }).is({
          texts: selections,
        }),
        compute(
          computations.relayEditLines,
          {
            reply,
            title,
            legs,
            materials,
            piles,
            notes,
            description,
            opening,
            closing,
            purposes,
            facilitations,
            selections,
          },
          lines,
        ),
      )
      .then(Suggesting.offer({ subject: relay, lines, at }).responds({ offering }))
      .then(
        where(
          Reasoning._asking({ asking }).is({ passage: stood }),
          compute(computations.relayDraftReading, { reply, passage: stood }, named),
          is.among(named, ["named"]),
          Suggesting._pendingIn({ offering }).is({ suggestion, kind, target }),
          is.among(kind, ["title"]),
          no(Relaying._leg({ leg: target })),
        ).then(Suggesting.take({ suggestion })),
      ),
);

export const ReplyUnusableComplains = reaction(
  ({ asking, reply, relay, passage, reading, account }) =>
    when(Reasoning.answer({ asking, reply }).responds())
      .where(
        Reasoning._asking({ asking }).is({ about: relay, passage }),
        Relaying._relay({ relay }),
        compute(computations.relayDraftReading, { reply, passage }, reading),
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
  ({ session, relay, user, at, failure, failedAt }) =>
    receive({ session, relay }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        whether(Reasoning._lastFailureAbout({ about: relay }).is({ account: failure, failedAt })),
      )
        .then(respond({ offerings: theOfferings({ relay }), failure, failedAt }))
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
  ({
    session,
    suggestion,
    user,
    at,
    taken,
    target,
    questionnaire,
    relay,
    kind,
    value,
    title,
    legs,
    questionnaires,
    materials,
    rounds,
    piles,
    notes,
    description,
    opening,
    closing,
    purposes,
    facilitations,
    selections,
    applied,
  }) =>
    receive({ session, suggestion })
      .then(
        where(
          now(at),
          activeUser({ session }).is({ user }),
          mayHostLive({ user }),
          Suggesting._suggestion({ suggestion }).is({ target, kind }),
          is.among(kind, [
            "title",
            "prompt",
            "parts",
            "choices",
            "takes",
            "pile",
            "unpile",
            "notes",
            "move",
            "remove",
          ]),
          Relaying._leg({ leg: target }).is({ material: questionnaire }),
          questionnaireHasNoOpenRun({ questionnaire }),
        )
          .then(Suggesting.take({ suggestion }).responds({ suggestion: taken }))
          .named("round"),
        where(
          now(at),
          activeUser({ session }).is({ user }),
          mayHostLive({ user }),
          Suggesting._suggestion({ suggestion }).is({ target, kind: "guide" }),
          Relaying._leg({ leg: target }),
        )
          .then(Suggesting.take({ suggestion }).responds({ suggestion: taken }))
          .named("guide"),
        where(
          now(at),
          activeUser({ session }).is({ user }),
          mayHostLive({ user }),
          Suggesting._suggestion({ suggestion }).is({ target }),
          no(Relaying._leg({ leg: target })),
        )
          .then(Suggesting.take({ suggestion }).responds({ suggestion: taken }))
          .named("relay"),
      )
      .afterFlowSettles()
      .where(
        Suggesting._suggestion({ suggestion: taken }).is({ subject: relay, kind, target, value }),
        whether(Relaying._relay({ relay }).is({ title })),
        whether(Relaying._plan({ relay }).is({ legs })),
        compute(computations.legMaterials, { legs }, questionnaires),
        Questioning._materials({ questionnaires }).is({ materials }),
        compute(computations.legIdentities, { legs }, rounds),
        Categorizing._categoriesInScopes({ scopes: rounds }).is({ categories: piles }),
        Guiding._guidanceTexts({ subjects: rounds, use: SORTING_USE }).is({ texts: notes }),
        Guiding._guidanceText({ subject: relay, use: "relay-description" }).is({
          text: description,
        }),
        Guiding._guidanceText({ subject: relay, use: "hosting-opening" }).is({ text: opening }),
        Guiding._guidanceText({ subject: relay, use: "hosting-closing" }).is({ text: closing }),
        Guiding._guidanceTexts({ subjects: rounds, use: "hosting-purpose" }).is({
          texts: purposes,
        }),
        Guiding._guidanceTexts({ subjects: rounds, use: "hosting-facilitation" }).is({
          texts: facilitations,
        }),
        Guiding._guidanceTexts({ subjects: rounds, use: "hosting-selection" }).is({
          texts: selections,
        }),
        compute(
          computations.editApplied,
          {
            kind,
            target,
            value,
            title,
            legs,
            materials,
            piles,
            notes,
            description,
            opening,
            closing,
            purposes,
            facilitations,
            selections,
          },
          applied,
        ),
      )
      .then(respond({ suggestion: taken, applied })),
  { input: { required: ["session", "suggestion"] } },
);
export const TakeRefused = endpoint(
  "/live/edits/take",
  ({ session, suggestion, user, target, questionnaire, kind }) =>
    receive({ session, suggestion }).then(
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Suggesting._suggestion({ suggestion }).is({ target, kind }),
        is.among(kind, [
          "title",
          "prompt",
          "parts",
          "choices",
          "takes",
          "pile",
          "unpile",
          "notes",
          "move",
          "remove",
        ]),
        Relaying._leg({ leg: target }).is({ material: questionnaire }),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Suggesting._suggestion({ suggestion })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
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
 * asks the concept that owns what changes. The endpoint waits for these
 * consequences and reads the requested result; taking alone is not success.
 * A refused line remains taken (acceptance is answered once), without a retry.
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
    use,
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
          compute(computations.editRoundTakesUse, { round: drawing }, use),
          is.among(use, USE_WORDS),
          compute(computations.editRoundTakesFrom, { round: drawing }, from),
          Relaying._leg({ leg: added }).is({ relay: drawn }),
          Relaying._legs({ relay: drawn }).is({ leg: source, position: from }),
        )
          .then(Relaying.draw({ leg: added, source, use }))
          .named("drawn"),
      ),
);

/**
 * An added round's piles and notes need the round as their target, so once the
 * leg the taken add line composed exists they are offered about that round and
 * taken where they are offered: the person accepted them with the round.
 */
export const AddedRoundCarriesItsPiles = reaction(
  ({ relay, material, added, suggestion, value, at, lines, standing, follow, line }) =>
    when(Relaying.addLeg({ relay, material }).responds({ leg: added }))
      .where(
        earlier(Suggesting.take, { suggestion }, { kind: "add", value }),
        now(at),
        compute(computations.editRoundLines, { value, leg: added }, lines),
        compute(computations.linesStanding, { lines }, standing),
        is.among(standing, ["some"]),
      )
      .then(Suggesting.offer({ subject: added, lines, at }).responds({ offering: follow }))
      .then(
        where(Suggesting._pendingIn({ offering: follow }).is({ suggestion: line })).then(
          Suggesting.take({ suggestion: line }),
        ),
      ),
);

/**
 * A pile line names a round's standing pile with its sentence: the pile is
 * reached or made on the round, and its sentence written, whether the line was
 * offered about the relay and confirmed, or about a round just added.
 */
export const TakenPileStandsPile = reaction(
  ({ suggestion, target, value, name, description, category }) =>
    when(Suggesting.take({ suggestion }).responds({ kind: "pile", target, value }))
      .where(
        Relaying._leg({ leg: target }),
        compute(computations.editPileName, { value }, name),
        compute(computations.editPileSentence, { value }, description),
      )
      .then(
        Categorizing.ensureCategory({ scope: target, name, description }).responds({ category }),
      )
      .then(Categorizing.describeCategory({ category, description })),
);

/** An unpile line takes a standing pile off the round by its name. */
export const TakenUnpileRemovesPile = reaction(({ suggestion, target, value, category }) =>
  when(Suggesting.take({ suggestion }).responds({ kind: "unpile", target, value }))
    .where(
      Relaying._leg({ leg: target }),
      Categorizing._categoriesIn({ scope: target }).is({ category, name: value }),
    )
    .then(Categorizing.deleteCategory({ category })),
);

/** A notes line replaces the standing note, or clears it when blank. */
export const TakenNotesSetNote = reaction(({ suggestion, target, value, said }) =>
  when(Suggesting.take({ suggestion }).responds({ kind: "notes", target, value }))
    .where(
      Relaying._leg({ leg: target }),
      compute(computations.briefStanding, { request: value }, said),
      is.among(said, ["given"]),
    )
    .then(Guiding.set({ subject: target, use: SORTING_USE, title: "", body: value })),
);

export const TakenNotesRemoveNote = reaction(({ suggestion, target, value, said }) =>
  when(Suggesting.take({ suggestion }).responds({ kind: "notes", target, value }))
    .where(
      Relaying._leg({ leg: target }),
      compute(computations.briefStanding, { request: value }, said),
      is.among(said, ["blank"]),
    )
    .then(Guiding.clear({ subject: target, use: SORTING_USE })),
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

/** Only the empty target names the relay; a deleted round must not rename it. */
export const TakenTitleRetitlesRelay = reaction(({ suggestion, target, value, relay }) =>
  when(Suggesting.take({ suggestion }).responds({ kind: "title", target, value }))
    .where(
      Suggesting._suggestion({ suggestion }).is({ subject: relay }),
      Relaying._relay({ relay }),
      is.among(target, [""]),
    )
    .then(Relaying.retitle({ relay, title: value })),
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
  ({ suggestion, target, value, relay, use, position, source }) =>
    when(Suggesting.take({ suggestion }).responds({ kind: "takes", target, value }))
      .where(
        Suggesting._suggestion({ suggestion }).is({ subject: relay }),
        Relaying._relay({ relay }),
        Relaying._leg({ leg: target }).is({ relay }),
        compute(computations.editUse, { value }, use),
        is.among(use, USE_WORDS),
        compute(computations.editPosition, { value }, position),
        Relaying._legs({ relay }).is({ leg: source, position }),
      )
      .then(Relaying.draw({ leg: target, source, use })),
);

export const TakenTakesUndraws = reaction(({ suggestion, target, value, relay, use, source }) =>
  when(Suggesting.take({ suggestion }).responds({ kind: "takes", target, value }))
    .where(
      Suggesting._suggestion({ suggestion }).is({ subject: relay }),
      Relaying._relay({ relay }),
      Relaying._leg({ leg: target }).is({ relay }),
      compute(computations.editUse, { value }, use),
      is.among(use, [""]),
      Relaying._draws({ leg: target }).is({ source }),
    )
    .then(Relaying.undraw({ leg: target, source })),
);

export const TakenGuideSetsRelay = reaction(
  ({ suggestion, value, relay, field, use, body, said }) =>
    when(Suggesting.take({ suggestion }).responds({ kind: "guide", target: "", value }))
      .where(
        Suggesting._suggestion({ suggestion }).is({ subject: relay }),
        Relaying._relay({ relay }),
        relayIsNotRetired({ relay }),
        compute(computations.editGuideField, { value }, field),
        is.among(field, ["description", "opening", "closing"]),
        compute(computations.guideUse, { field }, use),
        compute(computations.editGuideBody, { value }, body),
        compute(computations.briefStanding, { request: body }, said),
      )
      .then(
        where(is.among(said, ["given"]))
          .then(Guiding.set({ subject: relay, use, title: "", body }))
          .named("set"),
        where(is.among(said, ["blank"]))
          .then(Guiding.clear({ subject: relay, use }))
          .named("clear"),
      ),
);
export const TakenGuideSetsRound = reaction(
  ({ suggestion, target, value, field, use, body, said, relay }) =>
    when(Suggesting.take({ suggestion }).responds({ kind: "guide", target, value }))
      .where(
        Relaying._leg({ leg: target }).is({ relay }),
        relayIsNotRetired({ relay }),
        compute(computations.editGuideField, { value }, field),
        is.among(field, ["purpose", "facilitation", "selection"]),
        compute(computations.guideUse, { field }, use),
        compute(computations.editGuideBody, { value }, body),
        compute(computations.briefStanding, { request: body }, said),
      )
      .then(
        where(is.among(said, ["given"]))
          .then(Guiding.set({ subject: target, use, title: "", body }))
          .named("set"),
        where(is.among(said, ["blank"]))
          .then(Guiding.clear({ subject: target, use }))
          .named("clear"),
      ),
);
