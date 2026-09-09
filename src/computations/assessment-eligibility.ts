/** Current audience and time policy for new submissions; due dates are not close dates. */
export function submissionAllowed({
  detail,
  section,
  at,
}: {
  detail: {
    status: string;
    acceptsSubmissions: boolean;
    audience: string;
    targets: string[];
    availableAt: string;
    closeAt: string | null;
  };
  section: string | null;
  at: Date;
}): boolean {
  const available = Date.parse(detail.availableAt);
  const close = detail.closeAt === null ? Number.POSITIVE_INFINITY : Date.parse(detail.closeAt);
  return (
    detail.status === "PUBLISHED" &&
    detail.acceptsSubmissions &&
    (detail.audience === "EVERYONE" || (section !== null && detail.targets.includes(section))) &&
    Number.isFinite(available) &&
    at.getTime() >= available &&
    at.getTime() <= close
  );
}
