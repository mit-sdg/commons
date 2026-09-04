# Questioning

## Purpose

Let an author compose a questionnaire — ordered questions, each with a prompt,
offered choices, and, when the author proposes one, an expected answer — and
revise it freely for as long as it stays in the author's hands.

## Principle

Professor Lee composes a five-question quiz about photosynthesis. She adds each
question with its choices and the answer she expects, notices a typo in the
third prompt, and revises that one question without touching the others. One
question offers no choices and takes a written answer; the answer she records
beside it is a reference the questionnaire keeps, not a proposal. For a
warm-up she sets a question's parts — three labeled boxes, one, two, three —
so that each box takes an answer of its own; another asks for up to six of
one kind of thing, a repeated box with a cap. Giving choices to a question
that keeps parts is refused: a question offers choices or takes parts, never
both. She
removes a question that duplicates the fourth and the rest keep their order.
Months later she retires the quiz; it stays readable, but revising a question
of a retired questionnaire is refused.
Before she puts a quiz before her class, she asks for its presentation: one
complete authored value containing the title, form, disclosure, and ordered
questions as they stand together. Presenting does not publish or freeze the
questionnaire; she remains free to revise it afterward.

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
  a parts       Seq
  a cap         Number
  a position    Number

Rule: a workable form is a calculation over the input alone: a form is workable when it is `quiz` or `survey`.
Rule: a named level is a calculation over the input alone: a disclosure names a level when it is `score`, `answers`, or `explanations` — what a participant will learn afterward is part of composing the questionnaire, and a survey simply never uses it.
Rule: text retained by Questioning is trimmed first. A title is valid when it is nonblank and no longer than 200 characters. A prompt is valid when it is nonblank and no longer than 10000 characters. An explanation is valid when it is no longer than 2000 characters.
Rule: questions belong to their questionnaire and stand in position order.
Rule: a questionnaire has room for another question while it contains fewer than 100 questions.
Rule: empty choices offer none, so the question takes a written answer; non-empty choices offer exactly those.
Rule: choices are valid when there are at most 50, each is a nonblank String no longer than 500 characters, and no two are duplicates after trimming and lower-casing them.
Rule: an empty expected or explanation carries none, the way an omitted field does.
Rule: when a question offers choices, a nonempty expected answer is valid only when it equals one of the trimmed choices exactly. When a question offers none, its expected answer is a reference and is valid when it is no longer than 2000 characters.
Rule: only a question that offers choices proposes its expected answer; the expected answer of a written-answer question is a reference the questionnaire keeps.
Rule: parts say how a question is answered in pieces. Empty parts with a cap of zero take one answer, the ordinary case. Nonempty parts with a cap of zero are labeled boxes: one answer per part, in order. Exactly one part with a cap of two or more is a repeated box: up to cap answers of that one kind. Any other pairing is not valid.
Rule: parts are valid when there are at most 12, each is a nonblank String no longer than 40 characters after trimming, and no two are duplicates after trimming and lower-casing them; a cap is valid when it is zero or between 2 and 20.
Rule: a question offers choices or takes parts, never both; a new question takes no parts.
Rule: each piece of a question is an item of its own: a question without parts is answered under its own identity, and a question with parts is answered under `question#n` for the part or repetition n, counting from one.
Rule: a retired questionnaire keeps its questions and accepts no further change.
Rule: presenting serializes one coherent authored version without changing Questioning's state; it neither publishes the questionnaire nor freezes it against later revision. Its form and disclosure are the presentation's own values, and its proposes and expectations are projections of those same ordered questions: proposes is true exactly when at least one choice question carries a nonempty expected answer, and expectations contains `{ item, expected, explanation }` for exactly those questions, never written-answer references. Each presented question carries its parts and cap.
Rule: Questioning does not decide who may compose, put a questionnaire before an audience, or measure anyone against an expected answer; whether a questionnaire may still be revised while an audience is meeting it is a question the surrounding design answers.
```

## Actions

```actions
compose (author: Author, title: String, form: String, disclosure: String, at: Date) : return (questionnaire: Questionnaire)
  where form is a workable form, disclosure names a level, and title is valid
  then
    add a new questionnaire with author, normalized title, form, disclosure, and createdAt at
    return questionnaire
  where form is not a workable form
  then
    refuse UNKNOWN_FORM "A questionnaire is a quiz or a survey."
  where disclosure does not name a level
  then
    refuse UNKNOWN_DISCLOSURE "That is not a disclosure level."
  where title is not valid
  then
    refuse INVALID_TITLE "The title must be 1 to 200 characters long."

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
  where questionnaire exists, questionnaire not in retired, and title is valid
  then
    set questionnaire's title to normalized title
    return questionnaire
  where questionnaire does not exist
  then
    refuse QUESTIONNAIRE_NOT_FOUND "There is no such questionnaire."
  where questionnaire in retired
  then
    refuse QUESTIONNAIRE_RETIRED "This questionnaire was retired."
  where title is not valid
  then
    refuse INVALID_TITLE "The title must be 1 to 200 characters long."

addQuestion (questionnaire: Questionnaire, prompt: String, choices: Seq, expected: String, explanation: String, position: Number) : return (question: Question)
  where questionnaire exists, questionnaire not in retired, questionnaire has room for another question, prompt is valid, choices are valid and distinct, the expected answer or reference is valid, and explanation is valid
  then
    add a new question with questionnaire, normalized prompt, normalized choices, normalized expected, normalized explanation, and position
    return question
  where questionnaire does not exist
  then
    refuse QUESTIONNAIRE_NOT_FOUND "There is no such questionnaire."
  where questionnaire in retired
  then
    refuse QUESTIONNAIRE_RETIRED "This questionnaire was retired."
  where questionnaire has no room for another question
  then
    refuse QUESTION_LIMIT_REACHED "A questionnaire may contain at most 100 questions."
  where prompt is not valid
  then
    refuse INVALID_PROMPT "The prompt must be 1 to 10000 characters long."
  where choices exceed 50 or any choice is not a nonblank String no longer than 500 characters
  then
    refuse INVALID_CHOICES "A question may offer at most 50 choices, each 1 to 500 characters long."
  where choices contain duplicates after trimming and lower-casing
  then
    refuse DUPLICATE_CHOICES "Choices must be distinct, ignoring case and surrounding space."
  where choices are offered and a nonempty expected answer does not equal one of them exactly
  then
    refuse INVALID_EXPECTED "The expected answer must exactly match an offered choice."
  where no choices are offered and the reference exceeds 2000 characters
  then
    refuse INVALID_REFERENCE "A written-answer reference may be at most 2000 characters long."
  where explanation exceeds 2000 characters
  then
    refuse INVALID_EXPLANATION "An explanation may be at most 2000 characters long."

reviseQuestion (question: Question, prompt: String, choices: Seq, expected: String, explanation: String, position: Number) : return (question: Question)
  where question exists, its questionnaire not in retired, prompt is valid, choices are valid and distinct, choices are empty or the question takes no parts, the expected answer or reference is valid, and explanation is valid
  then
    set question's prompt, choices, expected, and explanation from their normalized inputs, and position from the input
    return question
  where question does not exist
  then
    refuse QUESTION_NOT_FOUND "There is no such question."
  where question's questionnaire in retired
  then
    refuse QUESTIONNAIRE_RETIRED "This questionnaire was retired."
  where prompt is not valid
  then
    refuse INVALID_PROMPT "The prompt must be 1 to 10000 characters long."
  where choices exceed 50 or any choice is not a nonblank String no longer than 500 characters
  then
    refuse INVALID_CHOICES "A question may offer at most 50 choices, each 1 to 500 characters long."
  where choices contain duplicates after trimming and lower-casing
  then
    refuse DUPLICATE_CHOICES "Choices must be distinct, ignoring case and surrounding space."
  where choices are offered and the question takes parts
  then
    refuse INVALID_PARTS "A question offers choices or takes parts, not both."
  where choices are offered and a nonempty expected answer does not equal one of them exactly
  then
    refuse INVALID_EXPECTED "The expected answer must exactly match an offered choice."
  where no choices are offered and the reference exceeds 2000 characters
  then
    refuse INVALID_REFERENCE "A written-answer reference may be at most 2000 characters long."
  where explanation exceeds 2000 characters
  then
    refuse INVALID_EXPLANATION "An explanation may be at most 2000 characters long."

setParts (question: Question, parts: Seq, cap: Number) : return (question: Question)
  where question exists, its questionnaire not in retired, parts and cap are valid together, and parts are empty or the question offers no choices
  then
    set question's parts to the normalized parts and its cap to cap
    return question
  where question does not exist
  then
    refuse QUESTION_NOT_FOUND "There is no such question."
  where question's questionnaire in retired
  then
    refuse QUESTIONNAIRE_RETIRED "This questionnaire was retired."
  where parts are nonempty and the question offers choices, or parts and cap are not valid together
  then
    refuse INVALID_PARTS "Parts are up to 12 short labels, or one label repeated up to a cap of 2 to 20, and never beside choices."

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

present (questionnaire: Questionnaire) : return (presentation: Value, form: String, disclosure: String, proposes: Boolean, expectations: Seq)
  where questionnaire exists and questionnaire not in retired
  then
    serialize the questionnaire's title, form, disclosure, and ordered questions as one presentation value; each question is `{ item, prompt, choices, expected, explanation, parts, cap, position }`
    project form, disclosure, proposes, and expectations from that same presentation
    return presentation, form, disclosure, proposes, expectations
  where questionnaire does not exist
  then
    refuse QUESTIONNAIRE_NOT_FOUND "There is no such questionnaire."
  where questionnaire in retired
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

_getQuestions (questionnaire: String) : many (question: String, prompt: String, choices: Seq, expected: String, explanation: String, parts: Seq, cap: Number, position: Number)
  answers the questionnaire's questions in position order
  answers no rows when none match

_getQuestion (question: String) : optional (questionnaire: String, prompt: String, choices: Seq, expected: String, explanation: String, parts: Seq, cap: Number, position: Number)
  answers the complete Question
  answers no row when the Question does not exist

_material (questionnaire: String) : optional (form: String, material: Seq)
  answers the questionnaire's form and its questions back as one value: an
  ordered sequence of `{ prompt, choices, expected, explanation, parts, cap }`
  entries in position order
  answers one row with an empty sequence when the questionnaire has no questions
  answers no row when the Questionnaire does not exist

_proposesAnswers (questionnaire: String) : one (proposes: Boolean)
  answers whether any question of the questionnaire proposes an expected answer
  — a written-answer question's reference proposes nothing
  answers false when the Questionnaire does not exist

_expectedAnswers (questionnaire: String) : optional (expectations: Seq)
  answers the questionnaire's proposed answers as one value: an ordered sequence
  of `{ item, expected, explanation }` entries, one per question that proposes —
  choices offered and expected non-empty — in position order
  answers one row with an empty sequence when the questionnaire proposes none
  answers no row when the Questionnaire does not exist

_materials (questionnaires: Seq) : one (materials: Seq)
  answers several questionnaires back as one value: for each identity in the
  given sequence, in that order, `{ questionnaire, title, questions }` with the
  questions as `_material` answers them, or no entry for an identity that
  names no questionnaire
  answers an empty sequence when the given sequence is empty

_references (questionnaire: String) : many (question: String, prompt: String, expected: String, explanation: String, position: Number)
  answers the written-answer questions that keep a reference — no choices
  offered, expected non-empty — in position order
  answers no rows when none match
```
