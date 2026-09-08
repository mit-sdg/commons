export const STAFF_CAPABILITIES = [
  "administer",
  "course:manage",
  "grade",
  "student-records",
  "live:host",
] as const;

export function staffCapabilities({ capabilities }: { capabilities: string[] }): boolean {
  return STAFF_CAPABILITIES.some((capability) => capabilities.includes(capability));
}

export function holderCode({ kind, identity }: { kind: string; identity: string }): string {
  return `${kind}:${identity}`;
}

export function completeAddressing({
  user,
  holders,
  admitted,
}: {
  user: string;
  holders: string[];
  admitted: number;
}): boolean {
  return (
    Array.isArray(holders) &&
    holders.length > 0 &&
    holders.length <= 64 &&
    holders.every((holder) => typeof holder === "string" && holder.length <= 256) &&
    new Set(holders).size === holders.length &&
    admitted === holders.length &&
    (!holders.some((holder) => holder.startsWith("account:")) ||
      holders.includes(`account:${user}`))
  );
}

export function holderKind({ holder }: { holder: string }): string {
  return holder.slice(0, holder.indexOf(":"));
}
export function holderSubject({ holder }: { holder: string }): string {
  return holder.slice(holder.indexOf(":") + 1);
}
export function audienceLabel({
  kind,
  identity,
  name,
}: {
  kind: string;
  identity: string;
  name: unknown;
}): string {
  if (kind === "standing")
    return (
      { everyone: "Everyone", staff: "Staff", students: "Students" }[identity] ??
      "Unavailable audience"
    );
  return typeof name === "string" && name.length > 0 ? name : `Unavailable ${kind}`;
}

export function selectedIdentities({
  holders,
  kind,
}: {
  holders: string[];
  kind: string;
}): string[] {
  return [
    ...new Set(
      holders
        .filter((holder) => holder.startsWith(`${kind}:`))
        .map((holder) => holder.slice(kind.length + 1)),
    ),
  ];
}
export function addressingPeople({ user, holders }: { user: string; holders: string[] }): string[] {
  return [...new Set([user, ...selectedIdentities({ holders, kind: "account" })])];
}
export function currentAddressing({
  user,
  holders,
  known,
  activePeople,
  staffPeople,
  trashed,
  groups,
  sections,
  ownSection,
}: {
  user: string;
  holders: string[];
  known: boolean;
  activePeople: string[];
  staffPeople: string[];
  trashed: boolean;
  groups: boolean;
  sections: boolean;
  ownSection: unknown;
}): boolean {
  if (
    !completeAddressing({ user, holders, admitted: holders.length }) ||
    !known ||
    trashed ||
    !groups ||
    !sections
  )
    return false;
  const staff = staffPeople.includes(user);
  return holders.every((holder) => {
    const kind = holderKind({ holder });
    const identity = holderSubject({ holder });
    if (!identity) return false;
    if (kind === "account")
      return activePeople.includes(identity) || staffPeople.includes(identity);
    if (kind === "group") return true;
    if (kind === "section") return staff || ownSection === identity;
    return (
      kind === "standing" &&
      (identity === "everyone" || identity === "staff" || (identity === "students" && staff))
    );
  });
}

export function visibleAnswer({ answer }: { answer: unknown }): boolean {
  return typeof answer === "string";
}

export function selectedSection({ section }: { section: unknown }): string[] {
  return typeof section === "string" ? [section] : [];
}
export function currentAudienceMembership({
  user,
  holders,
  groupMember,
  activeSections,
  section,
  seatStatus,
  activeStudent,
  capabilities,
}: {
  user: string;
  holders: string[];
  groupMember: boolean;
  activeSections: boolean;
  section: unknown;
  seatStatus: unknown;
  activeStudent: boolean;
  capabilities: unknown;
}): boolean {
  const staff = Array.isArray(capabilities) && staffCapabilities({ capabilities });
  const active = seatStatus === "ACTIVE";
  return (
    holders.includes(`account:${user}`) ||
    groupMember ||
    (holders.includes("standing:everyone") && (active || staff)) ||
    (holders.includes("standing:staff") && staff) ||
    (holders.includes("standing:students") && activeStudent) ||
    (active &&
      activeSections &&
      typeof section === "string" &&
      holders.includes(`section:${section}`))
  );
}

export function previewHolders({
  user,
  selected,
  includeSender,
}: {
  user: string;
  selected: string[];
  includeSender: boolean;
}): string[] {
  const people = selected.some((holder) => holder.startsWith("account:"));
  return [
    ...new Set([...selected, ...(includeSender || people ? [`account:${user}`] : [])]),
  ].sort();
}

export function forumMailKey({
  notification,
  recipient,
  post,
}: {
  notification: string;
  recipient: string;
  post: string;
}): string {
  return "forum:" + JSON.stringify({ notification, recipient, post });
}

export function staffQuestion({
  holders,
  nonStaffAuthor,
}: {
  holders: string[];
  nonStaffAuthor: unknown;
}): boolean {
  return holders.includes("standing:staff") && typeof nonStaffAuthor === "string";
}
