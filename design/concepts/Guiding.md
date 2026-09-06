# Guiding

## Purpose

Let an author set standing guidance beside a subject, so that whoever acts on the subject reads it first, and the guidance can change while the subject stays as it is.

Prevents: guidance written into the subject itself, where those it is not meant for read it; guidance frozen with its subject, so it cannot change once its reader's work has been seen; guidance meant for one reader of a subject reaching another.

## Principle

Priya runs a workshop in which a room hands in answers and a helper, a person or a model, sorts them into piles. Before the session she _gives_ the round guidance for sorting: group by what went wrong, not by which app it happened in. During the session the piles run along the wrong line, so she _revises_ that guidance and the next sorting reads the new words; the question the room answered has not changed. She also gives the same round guidance for answering, for the stand-in participants who answer beside the room: answer as first-years. The helper who sorts never reads it, because it is guidance under another use. For the whole series she gives drafting guidance from a document she keeps, under the document's name, so whoever drafts a new round reads it beside every request; a second document stands after the first, and each is known by its name when she looks for the one to change. For the sorting guidance a second helper may reach the round in the same instant she does, so she _sets_ it rather than gives it: one entry stands under that use, the later words winning, and two hands writing at once never leave two. Giving guidance with nothing in it is refused. When the series is over she _removes_ a document, and revising it afterward is refused.

## Types

```types
external Subject
  An application-owned identity for what the guidance stands beside.
```

## State

```state
a set of Guidance with
  a subject Subject
  a use     String
  a title   String
  a body    String

a set of Selections with
  a subject Subject
  a use String
  a guidances Seq

Rule: absent selections are empty. Selecting guidance never copies or deletes the original.
Rule: removing guidance, directly or by replacement, removes its identity from every selection.
Rule: text retained by Guiding is trimmed first. A use is valid when it is nonblank; what a use means, and who reads guidance under it, is the surrounding design's to say. A title is valid when it is no longer than 200 characters, and an empty title carries none. A body is valid when it is nonblank and no longer than 40000 characters.
Rule: guidance for one subject under one use stands in the order it was given.
Rule: mutations are serialized within the supported single-process Mongo floor; a set, clear, or removal cannot interleave with another mutation or selection.
Rule: subjects are opaque identities; Guiding neither creates nor validates them, and does not decide who may give guidance or who reads it.
```

## Actions

```actions
select (subject: Subject, use: String, guidances: Seq) : return (subject: Subject)
  where use is nonblank and every guidance exists under that use
  then
    replace the subject's selection with the distinct guidance identities in the given order
    return subject
  where use is blank
  then
    refuse INVALID_USE "Guidance needs a use."
  where any selected guidance does not exist under that use
  then
    refuse GUIDANCE_NOT_FOUND "A selected document no longer exists."

give (subject: Subject, use: String, title: String, body: String) : return (guidance: Guidance)
  where use is valid, title is valid, and body is valid
  then
    add a new guidance with subject, use, trimmed title, and trimmed body, after the last guidance of this subject under this use
    return guidance
  where use is not valid
  then
    refuse INVALID_USE "Guidance needs a use."
  where title is not valid
  then
    refuse INVALID_TITLE "The title must be at most 200 characters long."
  where body is not valid
  then
    refuse INVALID_GUIDANCE "Guidance must be 1 to 40000 characters long."

set (subject: Subject, use: String, title: String, body: String) : return (guidance: Guidance)
  where use is valid, title is valid, and body is valid, and guidance stands beside subject under use
  then
    let guidance be the earliest given of them
    set guidance's title to trimmed title and body to trimmed body
    delete every other guidance of this subject under this use
    remove the deleted identities from every selection
    return guidance
  where use is valid, title is valid, and body is valid, and no guidance stands beside subject under use
  then
    add a new guidance with subject, use, trimmed title, and trimmed body
    return guidance
  where use is not valid
  then
    refuse INVALID_USE "Guidance needs a use."
  where title is not valid
  then
    refuse INVALID_TITLE "The title must be at most 200 characters long."
  where body is not valid
  then
    refuse INVALID_GUIDANCE "Guidance must be 1 to 40000 characters long."

revise (guidance: Guidance, title: String, body: String) : return (guidance: Guidance)
  where guidance exists, title is valid, and body is valid
  then
    set guidance's title to trimmed title and body to trimmed body
    return guidance
  where guidance does not exist
  then
    refuse GUIDANCE_NOT_FOUND "There is no such guidance."
  where title is not valid
  then
    refuse INVALID_TITLE "The title must be at most 200 characters long."
  where body is not valid
  then
    refuse INVALID_GUIDANCE "Guidance must be 1 to 40000 characters long."

remove (guidance: Guidance) : return (guidance: Guidance)
  where guidance exists
  then
    delete the guidance
    remove its identity from every selection
    return guidance
  where guidance does not exist
  then
    refuse GUIDANCE_NOT_FOUND "There is no such guidance."

clear (subject: Subject, use: String) : return (cleared: Boolean)
  where use is valid
  then
    let cleared be whether any guidance stands for the subject under the trimmed use
    delete every guidance of the subject under the trimmed use
    remove the deleted identities from every selection
    return cleared
  where use is not valid
  then
    refuse INVALID_USE "Guidance needs a use."
```

## Queries

```queries
_selection (subject: String, use: String) : one (guidances: Seq)
  answers the selected guidance identities, or an empty sequence

_documentsById (guidances: Seq, use: String) : one (documents: Seq, guidances: Seq)
  answers existing selected documents under the use in selection order, each with guidance, title, and body, and the identities of those documents; missing entries are omitted

_selectedDocuments (subject: String, use: String) : one (documents: Seq)
  answers the documents selected for this subject and use, as documentsById does

_guidanceFor (subject: String, use: String) : many (guidance: String, title: String, body: String)
  answers the guidance standing beside the Subject under the use, in the order given
  answers no rows when none match

_guidance (guidance: String) : optional (subject: String, use: String, title: String, body: String)
  answers the Guidance with what it stands beside, its use, its title, and its body

_guidanceText (subject: String, use: String) : one (text: String)
  answers the bodies of the guidance standing beside the Subject under the use,
  in the order given, joined by a blank line, as one text a reader takes whole
  answers an empty string when none stands

_guidanceTexts (subjects: Seq, use: String) : one (texts: Seq)
  answers several subjects back as one value: for each identity in the given
  sequence, in that order, `{ subject, text }` with the text as `_guidanceText`
  answers it
  answers an empty sequence when the given sequence is empty

_documents (subject: String, use: String) : one (documents: Seq)
  answers the guidance standing beside the Subject under the use as one value:
  `{ guidance, title, body }` per entry, in the order given, so a reader that
  needs each entry under its own title takes them whole
  answers an empty sequence when none stands
```
