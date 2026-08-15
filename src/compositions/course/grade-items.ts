import { reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../vocabulary.ts";

const { Assigning, Itemizing } = concepts;

export const PublishedAcceptingAssignmentGetsGradeItem = reaction(({ assignment, title }) =>
  when(Assigning.publish({}).responds({ assignment, acceptsSubmissions: true }))
    .where(Assigning._getAssignments({}).is({ assignment, title }))
    .then(Itemizing.ensureItem({ item: assignment, label: title, maxPoints: 100 })),
);

export const RevisedAcceptingAssignmentEnsuresGradeItem = reaction(({ assignment, title }) =>
  when(
    Assigning.revise({ title }).responds({
      assignment,
      status: "PUBLISHED",
      acceptsSubmissions: true,
    }),
  ).then(Itemizing.ensureItem({ item: assignment, label: title, maxPoints: 100 })),
);
