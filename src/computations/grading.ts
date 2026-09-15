interface Edition {
  edition: string;
  standard: string;
  number: number;
  name: string;
  description: string;
  deficient: string;
  emergent: string;
  competent: string;
  expert: string;
  referenceUrl: string;
}

interface RawCriterion {
  kind: "COMPETENCY" | "POINTS";
  criterion?: string;
  position: number;
  basis?: string;
  name?: string;
  maxPoints?: number;
}

type ResolvedCriterion =
  | {
      kind: "POINTS";
      criterion: string | undefined;
      position: number;
      name: string | undefined;
      maxPoints: number | undefined;
    }
  | ({ kind: "COMPETENCY"; criterion: string | undefined; position: number; basis: string } & Omit<
      Edition,
      "edition"
    >);

export function competencyEditionIds({ criteria }: { criteria: RawCriterion[] }): string[] {
  if (!Array.isArray(criteria)) return [];
  return criteria.flatMap((criterion) =>
    typeof criterion === "object" &&
    criterion !== null &&
    "kind" in criterion &&
    criterion.kind === "COMPETENCY" &&
    "basis" in criterion &&
    typeof criterion.basis === "string"
      ? [criterion.basis]
      : [],
  );
}

export function resolveGradingCriteria({
  criteria,
  editions,
}: {
  criteria: RawCriterion[];
  editions: Edition[];
}) {
  if (!Array.isArray(criteria) || !Array.isArray(editions)) return [];
  const resolved: ResolvedCriterion[] = [];
  for (const value of criteria) {
    if (typeof value !== "object" || value === null || !("kind" in value)) continue;
    const criterion = value as RawCriterion;
    if (criterion.kind === "POINTS") {
      resolved.push({
        kind: "POINTS",
        criterion: criterion.criterion,
        position: criterion.position,
        name: criterion.name,
        maxPoints: criterion.maxPoints,
      });
      continue;
    }
    if (criterion.kind !== "COMPETENCY") continue;
    const edition = editions.find((candidate) => candidate.edition === criterion.basis);
    if (edition)
      resolved.push({
        kind: "COMPETENCY",
        criterion: criterion.criterion,
        position: criterion.position,
        basis: edition.edition,
        standard: edition.standard,
        number: edition.number,
        name: edition.name,
        description: edition.description,
        deficient: edition.deficient,
        emergent: edition.emergent,
        competent: edition.competent,
        expert: edition.expert,
        referenceUrl: edition.referenceUrl,
      });
  }
  return resolved;
}

export function gradingRevisionMatches({ left, right }: { left: number; right: number }): boolean {
  return left === right;
}
