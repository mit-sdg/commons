# Questioning

## Purpose

Let an author compose a questionnaire — ordered questions, each with a prompt,
offered choices, and, when the author proposes one, an expected answer — and
revise it freely for as long as it stays in the author's hands.

## Principle

Professor Lee composes a five-question quiz about photosynthesis. She adds each
question with its choices and the answer she expects, notices a typo in the
third prompt, and revises that one question without touching the others. She
removes a question that duplicates the fourth and the rest keep their order.
Months later she retires the quiz; it stays readable, but revising a question
of a retired questionnaire is refused.

## Types

```types
external Author
  An application-owned identity used in the author role.
```

## State

```state
a set of Questionnaires with
  an author Author
  a title   String
  a form    String
  a disclosure String
  a createdAt Date

a Retired set of Questionnaires

a set of Questions with
  a questionnaire Questionnaire
  a prompt      String
  a choices     Seq
  an expected    String
  an explanation String
  a position    Number

Rule: a workable form is a calculation over the input alone: a form is workable when it is `quiz` or `survey`.
Rule: a named level is a calculation over the input alone: a disclosure names a level when it is `score`, `answers`, or `explanations` — what a participant will learn afterward is part of composing the questionnaire, and a survey simply never uses it.
Rule: questions belong to their questionnaire and stand in position order.
Rule: empty choices offer none, so the question takes a written answer; non-empty choices offer exactly those.
Rule: an empty expected or explanation carries none, the way an omitted field does.
Rule: a retired questionnaire keeps its questions and accepts no further change.
Rule: Questioning does not decide who may compose, put a questionnaire before an audience, or measure anyone against an expected answer; whether a questionnaire may still be revised while an audience is meeting it is a question the surrounding design answers.
```

## Actions

```actions
compose (author: Author, title: String, form: String, disclosure: String, at: Date) : return (questionnaire: Questionnaire)
  where form is a workable form and disclosure names a level
  then
    add a new questionnaire with author, title, form, disclosure, and createdAt at
    return questionnaire
  where form is not a workable form
  then
    refuse UNKNOWN_FORM "A questionnaire is a quiz or a survey."
  where disclosure does not name a level
  then
    refuse UNKNOWN_DISCLOSURE "That is not a disclosure level."

setDisclosure (questionnaire: Questionnaire, disclosure: String) : return (questionnaire: Questionnaire)
  where questionnaire exists and questionnaire not in retired and disclosure names a level
  then
    set questionnaire's disclosure to disclosure
    return questionnaire
  where questionnaire does not exist
  then
    refuse QUESTIONNAIRE_NOT_FOUND "There is no such questionnaire."
  where questionnaire in retired
  then
    refuse QUESTIONNAIRE_RETIRED "This questionnaire was retired."
  where disclosure does not name a level
  then
    refuse UNKNOWN_DISCLOSURE "That is not a disclosure level."

retitle (questionnaire: Questionnaire, title: String) : return (questionnaire: Questionnaire)
  where questionnaire exists and questionnaire not in retired
  then
    set questionnaire's title to title
    return questionnaire
  where questionnaire does not exist
  then
    refuse QUESTIONNAIRE_NOT_FOUND "There is no such questionnaire."
  where questionnaire in retired
  then
    refuse QUESTIONNAIRE_RETIRED "This questionnaire was retired."

addQuestion (questionnaire: Questionnaire, prompt: String, choices: Seq, expected: String, explanation: String, position: Number) : return (question: Question)
  where questionnaire exists and questionnaire not in retired
  then
    add a new question with questionnaire, prompt, choices, expected, explanation, and position
    return question
  where questionnaire does not exist
  then
    refuse QUESTIONNAIRE_NOT_FOUND "There is no such questionnaire."
  where questionnaire in retired
  then
    refuse QUESTIONNAIRE_RETIRED "This questionnaire was retired."

reviseQuestion (question: Question, prompt: String, choices: Seq, expected: String, explanation: String, position: Number) : return (question: Question)
  where question exists and its questionnaire not in retired
  then
    set question's prompt, choices, expected, explanation, and position from the inputs
    return question
  where question does not exist
  then
    refuse QUESTION_NOT_FOUND "There is no such question."
  where question's questionnaire in retired
  then
    refuse QUESTIONNAIRE_RETIRED "This questionnaire was retired."

swapQuestions (question: Question, other: Question) : return (question: Question, other: Question)
  where question and other exist, share a questionnaire, and it is not in retired
  then
    trade the positions of question and other
    return question, other
  where question does not exist or other does not exist
  then
    refuse QUESTION_NOT_FOUND "There is no such question."
  where question and other do not share a questionnaire
  then
    refuse NOT_SIBLINGS "These questions do not share a questionnaire."
  where question's questionnaire in retired
  then
    refuse QUESTIONNAIRE_RETIRED "This questionnaire was retired."

removeQuestion (question: Question) : return (question: Question, questionnaire: Questionnaire, position: Number)
  where question exists and its questionnaire not in retired
  then
    delete question, remembering its questionnaire and the position it stood at
    return question, questionnaire, position
  where question does not exist
  then
    refuse QUESTION_NOT_FOUND "There is no such question."
  where question's questionnaire in retired
  then
    refuse QUESTIONNAIRE_RETIRED "This questionnaire was retired."

retire (questionnaire: Questionnaire) : return (questionnaire: Questionnaire)
  where questionnaire exists and questionnaire not in retired
  then
    add questionnaire to retired
    return questionnaire
  where questionnaire does not exist
  then
    refuse QUESTIONNAIRE_NOT_FOUND "There is no such questionnaire."
  where questionnaire in retired
  then
    refuse QUESTIONNAIRE_RETIRED "This questionnaire was retired."
```

## Queries

```queries
_getQuestionnaire (questionnaire: String) : optional (author: String, title: String, form: String, disclosure: String, createdAt: Date, retired: Boolean)
  answers the complete Questionnaire
  answers no row when the Questionnaire does not exist

_getQuestionnaires () : many (questionnaire: String, author: String, title: String, form: String, disclosure: String, createdAt: Date, retired: Boolean)
  answers every questionnaire, newest first

_getQuestions (questionnaire: String) : many (question: String, prompt: String, choices: Seq, expected: String, explanation: String, position: Number)
  answers the questionnaire's questions in position order
  answers no rows when none match

_getQuestion (question: String) : optional (questionnaire: String, prompt: String, choices: Seq, expected: String, explanation: String, position: Number)
  answers the complete Question
  answers no row when the Question does not exist

_material (questionnaire: String) : optional (form: String, material: Seq)
  answers the questionnaire's form and its questions back as one value: an
  ordered sequence of `{ prompt, choices, expected, explanation }` entries in
  position order
  answers one row with an empty sequence when the questionnaire has no questions
  answers no row when the Questionnaire does not exist

_proposesAnswers (questionnaire: String) : one (proposes: Boolean)
  answers whether any question of the questionnaire proposes an expected answer
  answers false when the Questionnaire does not exist

_expectedAnswers (questionnaire: String) : optional (expectations: Seq)
  answers the questionnaire's proposed answers as one value: an ordered sequence
  of `{ item, expected, explanation }` entries, one per question whose expected
  is non-empty, in position order
  answers one row with an empty sequence when the questionnaire proposes none
  answers no row when the Questionnaire does not exist
```
