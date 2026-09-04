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
  whether,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { activeUser } from "../access/session.ts";
import {
  mayHostLive,
  mayNotHostLive,
  questionnaireHasAnOpenRun,
  questionnaireHasNoOpenRun,
  theQuestionCount,
} from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";

const { Publishing, Questioning, Relaying, Sharing } = concepts;

/**
 * Every questionnaire on the staff shelf, newest first, with its open run when
 * one stands — and what launching needs: how many questions it holds, and
 * whether any proposes an expected answer. A relay round's questionnaire is
 * reached through its relay and never stands here on its own.
 */
export const theQuestionnaires = former(
  "the questionnaires",
  (
    _inputs,
    { questionnaire, title, form, disclosure, createdAt, retired, run, token, questions, proposes },
  ) =>
    each(
      Questioning._getQuestionnaires({}).is({
        questionnaire,
        title,
        form,
        disclosure,
        createdAt,
        retired,
      }),
    )
      .where(
        no(Relaying._legFor({ material: questionnaire })),
        whether(
          Publishing._editionsFor({ material: questionnaire }).is({ edition: run, open: true }),
        ),
        whether(Sharing._sharesFor({ subject: run }).is({ token })),
        theQuestionCount({ questionnaire }).is({ total: questions }),
        Questioning._proposesAnswers({ questionnaire }).is({ proposes }),
      )
      .form({
        questionnaire,
        title,
        form,
        disclosure,
        createdAt,
        retired,
        openRun: run,
        token,
        questions,
        proposes,
      }),
);

/** One questionnaire whole: its questions in position order and its runs, newest first. */
export const theQuestionnaire = former(
  "the questionnaire (questionnaire)",
  (
    { questionnaire },
    {
      title,
      form,
      disclosure,
      createdAt,
      retired,
      question,
      prompt,
      choices,
      expected,
      explanation,
      position,
      run,
      open,
      openedAt,
      closedAt,
      token,
    },
  ) =>
    where(
      Questioning._getQuestionnaire({ questionnaire }).is({
        title,
        form,
        disclosure,
        createdAt,
        retired,
      }),
    ).form({
      questionnaire,
      title,
      form,
      disclosure,
      createdAt,
      retired,
      questions: each(
        Questioning._getQuestions({ questionnaire }).is({
          question,
          prompt,
          choices,
          expected,
          explanation,
          position,
        }),
      ).form({ question, prompt, choices, expected, explanation, position }),
      runs: each(
        Publishing._editionsFor({ material: questionnaire }).is({
          edition: run,
          open,
          openedAt,
          closedAt,
        }),
      )
        .where(whether(Sharing._sharesFor({ subject: run }).is({ token })))
        .form({ run, open, openedAt, closedAt, token }),
    }),
).optional();

export const List = endpoint("/live/quizzes/list", ({ session, user, at }) =>
  receive({ session }).then(
    where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
      .then(respond({ questionnaires: theQuestionnaires({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const Get = endpoint("/live/quizzes/get", ({ session, questionnaire, user, at }) =>
  receive({ session, questionnaire }).then(
    where(
      now(at),
      activeUser({ session }).is({ user }),
      mayHostLive({ user }),
      no(Relaying._legFor({ material: questionnaire })),
    )
      .then(respond({ questionnaire: theQuestionnaire({ questionnaire }) }))
      .named("success"),
    where(
      activeUser({ session }).is({ user }),
      mayHostLive({ user }),
      Relaying._legFor({ material: questionnaire }),
    )
      .then(respond({ error: "QUESTIONNAIRE_NOT_FOUND" }))
      .named("round"),
    where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const Create = endpoint(
  "/live/quizzes/create",
  ({ session, title, form, disclosure, user, at, questionnaire }) =>
    receive({ session, title, form, disclosure }).then(
      where(now(at), activeUser({ session }).is({ user }), mayHostLive({ user }))
        .then(
          Questioning.compose({ author: user, title, form, disclosure, at }).responds({
            questionnaire,
          }),
        )
        .then(respond({ questionnaire }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  {
    input: { required: ["session", "form"], defaults: { title: "Untitled", disclosure: "score" } },
  },
);

export const Retitle = endpoint(
  "/live/quizzes/retitle",
  ({ session, questionnaire, title, user, at, retitled }) =>
    receive({ session, questionnaire, title }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasNoOpenRun({ questionnaire }),
      )
        .then(Questioning.retitle({ questionnaire, title }).responds({ questionnaire: retitled }))
        .then(respond({ questionnaire: retitled }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._legFor({ material: questionnaire }),
      )
        .then(respond({ error: "QUESTIONNAIRE_NOT_FOUND" }))
        .named("round"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "questionnaire", "title"] } },
);

export const SetDisclosure = endpoint(
  "/live/quizzes/set-disclosure",
  ({ session, questionnaire, disclosure, user, at, changed }) =>
    receive({ session, questionnaire, disclosure }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasNoOpenRun({ questionnaire }),
      )
        .then(
          Questioning.setDisclosure({ questionnaire, disclosure }).responds({
            questionnaire: changed,
          }),
        )
        .then(respond({ questionnaire: changed }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._legFor({ material: questionnaire }),
      )
        .then(respond({ error: "QUESTIONNAIRE_NOT_FOUND" }))
        .named("round"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "questionnaire", "disclosure"] } },
);

export const AddQuestion = endpoint(
  "/live/quizzes/add-question",
  ({
    session,
    questionnaire,
    prompt,
    choices,
    expected,
    explanation,
    standing,
    position,
    user,
    at,
    question,
  }) =>
    receive({ session, questionnaire, prompt, choices, expected, explanation }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasNoOpenRun({ questionnaire }),
        theQuestionCount({ questionnaire }).is({ total: standing }),
        compute(computations.positionAfter, { position: standing }, position),
      )
        .then(
          Questioning.addQuestion({
            questionnaire,
            prompt,
            choices,
            expected,
            explanation,
            position,
          }).responds({ question }),
        )
        .then(respond({ question }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._legFor({ material: questionnaire }),
      )
        .then(respond({ error: "QUESTIONNAIRE_NOT_FOUND" }))
        .named("round"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  {
    input: {
      required: ["session", "questionnaire", "prompt"],
      defaults: { choices: [], expected: "", explanation: "" },
    },
  },
);

export const ReviseQuestion = endpoint(
  "/live/quizzes/revise-question",
  ({
    session,
    question,
    prompt,
    choices,
    expected,
    explanation,
    position,
    user,
    at,
    questionnaire,
    revised,
  }) =>
    receive({ session, question, prompt, choices, expected, explanation }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire, position }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasNoOpenRun({ questionnaire }),
      )
        .then(
          Questioning.reviseQuestion({
            question,
            prompt,
            choices,
            expected,
            explanation,
            position,
          }).responds({ question: revised }),
        )
        .then(respond({ question: revised }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire }),
        Relaying._legFor({ material: questionnaire }),
      )
        .then(respond({ error: "QUESTIONNAIRE_NOT_FOUND" }))
        .named("round"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Questioning._getQuestion({ question })),
      )
        .then(respond({ error: "QUESTION_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  {
    input: {
      required: ["session", "question", "prompt"],
      defaults: { choices: [], expected: "", explanation: "" },
    },
  },
);

/** Removing a question closes the ranks behind it, so positions stay contiguous. */
export const RemovedQuestionClosesRanks = reaction(
  ({
    question,
    questionnaire,
    position,
    later,
    laterPrompt,
    laterChoices,
    laterExpected,
    laterExplanation,
    laterAt,
    closed,
  }) =>
    when(Questioning.removeQuestion({ question }).responds({ questionnaire, position })).then(
      where(
        Questioning._getQuestions({ questionnaire }).is({
          question: later,
          prompt: laterPrompt,
          choices: laterChoices,
          expected: laterExpected,
          explanation: laterExplanation,
          position: laterAt,
        }),
        is.gt(laterAt, position),
        compute(computations.positionBefore, { position: laterAt }, closed),
      )
        .then(
          Questioning.reviseQuestion({
            question: later,
            prompt: laterPrompt,
            choices: laterChoices,
            expected: laterExpected,
            explanation: laterExplanation,
            position: closed,
          }),
        )
        .named("close-ranks"),
    ),
);

export const RemoveQuestion = endpoint(
  "/live/quizzes/remove-question",
  ({ session, question, user, at, questionnaire, removed }) =>
    receive({ session, question }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasNoOpenRun({ questionnaire }),
      )
        .then(Questioning.removeQuestion({ question }).responds({ question: removed }))
        .then(respond({ question: removed }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire }),
        Relaying._legFor({ material: questionnaire }),
      )
        .then(respond({ error: "QUESTIONNAIRE_NOT_FOUND" }))
        .named("round"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Questioning._getQuestion({ question })),
      )
        .then(respond({ error: "QUESTION_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "question"] } },
);

/** Swap a question with the one before it; the sheet stays contiguous. */
export const RaiseQuestion = endpoint(
  "/live/quizzes/raise-question",
  ({ session, question, user, at, questionnaire, position, target, neighbor }) =>
    receive({ session, question }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire, position }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasNoOpenRun({ questionnaire }),
        is.gt(position, 1),
        compute(computations.positionBefore, { position }, target),
        Questioning._getQuestions({ questionnaire }).is({ question: neighbor, position: target }),
      )
        .then(Questioning.swapQuestions({ question, other: neighbor }).responds())
        .then(respond({ question }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire, position: 1 }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasNoOpenRun({ questionnaire }),
      )
        .then(respond({ error: "AT_EDGE" }))
        .named("at-edge"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire }),
        Relaying._legFor({ material: questionnaire }),
      )
        .then(respond({ error: "QUESTIONNAIRE_NOT_FOUND" }))
        .named("round"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Questioning._getQuestion({ question })),
      )
        .then(respond({ error: "QUESTION_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "question"] } },
);

/** Swap a question with the one after it; the sheet stays contiguous. */
export const LowerQuestion = endpoint(
  "/live/quizzes/lower-question",
  ({ session, question, user, at, questionnaire, position, standing, target, neighbor }) =>
    receive({ session, question }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire, position }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasNoOpenRun({ questionnaire }),
        theQuestionCount({ questionnaire }).is({ total: standing }),
        is.lt(position, standing),
        compute(computations.positionAfter, { position }, target),
        Questioning._getQuestions({ questionnaire }).is({ question: neighbor, position: target }),
      )
        .then(Questioning.swapQuestions({ question, other: neighbor }).responds())
        .then(respond({ question }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire, position }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasNoOpenRun({ questionnaire }),
        theQuestionCount({ questionnaire }).is({ total: standing }),
        is.ge(position, standing),
      )
        .then(respond({ error: "AT_EDGE" }))
        .named("at-edge"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Questioning._getQuestion({ question }).is({ questionnaire }),
        Relaying._legFor({ material: questionnaire }),
      )
        .then(respond({ error: "QUESTIONNAIRE_NOT_FOUND" }))
        .named("round"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Questioning._getQuestion({ question })),
      )
        .then(respond({ error: "QUESTION_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "question"] } },
);

export const Retire = endpoint(
  "/live/quizzes/retire",
  ({ session, questionnaire, user, at, retired }) =>
    receive({ session, questionnaire }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasNoOpenRun({ questionnaire }),
      )
        .then(Questioning.retire({ questionnaire }).responds({ questionnaire: retired }))
        .then(respond({ questionnaire: retired }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        no(Relaying._legFor({ material: questionnaire })),
        questionnaireHasAnOpenRun({ questionnaire }),
      )
        .then(respond({ error: "RUN_OPEN" }))
        .named("run-open"),
      where(
        activeUser({ session }).is({ user }),
        mayHostLive({ user }),
        Relaying._legFor({ material: questionnaire }),
      )
        .then(respond({ error: "QUESTIONNAIRE_NOT_FOUND" }))
        .named("round"),
      where(activeUser({ session }).is({ user }), mayNotHostLive({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "questionnaire"] } },
);
