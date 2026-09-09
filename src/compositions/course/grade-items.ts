import { reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts.ts";

const { Assigning, Itemizing } = concepts;

export const DraftAcceptingAssignmentGetsGradeItem = reaction(({ assignment, title }) =>
  when(Assigning.createDraft({ title, acceptsSubmissions: true }).responds({ assignment })).then(
    Itemizing.ensureItem({ item: assignment, label: title }),
  ),
);

export const PublishedAcceptingAssignmentGetsGradeItem = reaction(({ assignment, title }) =>
  when(Assigning.publish({}).responds({ assignment, acceptsSubmissions: true }))
    .where(Assigning._getAssignments({}).is({ assignment, title }))
    .then(Itemizing.ensureItem({ item: assignment, label: title })),
);

export const RevisedAcceptingAssignmentEnsuresGradeItem = reaction(({ assignment, title }) =>
  when(
    Assigning.revise({ title }).responds({
      assignment,
      acceptsSubmissions: true,
    }),
  ).then(Itemizing.ensureItem({ item: assignment, label: title })),
);
