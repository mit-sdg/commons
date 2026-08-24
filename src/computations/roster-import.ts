/**
 * One row of a roster import, shaped exactly as a row parsed from CSV reaches
 * `Rostering.importSeats`: a section or display name is carried only when the
 * row holds one.
 */
interface ImportRow {
  email: string;
  kind: string;
  section?: string;
  displayName?: string;
}

// Import preview reads each comma-delimited field with its surrounding space
// removed, so a field typed into the single-person form is read the same way.
const field = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Compose the one import row that adding a single person by hand carries into
 * the roster import, so a hand-typed person and the same person imported as one
 * CSV line reach Rostering through the same action and read back identically.
 *
 * An empty section or display name means the row carries none, exactly as a CSV
 * field left out does: the seat is created with no section, and no name is
 * written, so adding an address again without a name never clears the name its
 * pending seat already holds.
 */
export function singleImportRow({
  email,
  kind,
  section,
  displayName,
}: {
  email: string;
  kind: string;
  section: string;
  displayName: string;
}): ImportRow[] {
  const row: ImportRow = { email: field(email), kind: field(kind) };
  const carriedSection = field(section);
  if (carriedSection !== "") row.section = carriedSection;
  const carriedName = field(displayName);
  if (carriedName !== "") row.displayName = carriedName;
  return [row];
}
