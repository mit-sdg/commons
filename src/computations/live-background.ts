/**
 * The background the drafter reads: the staff member's own documents, given as
 * Guiding guidance under `drafting`, set down between a passage's contract and
 * its standing material as one fenced block. No document, no block, so a
 * passage over an empty background is byte for byte the passage it was.
 */

/** One document as Guiding answers it: known by its title, read by its body. */
interface Document {
  guidance?: unknown;
  title?: unknown;
  body?: unknown;
}

/** The line that opens the block, and the one that closes it. */
export const BACKGROUND_OPENS = "Background, for reference only:";
export const BACKGROUND_CLOSES = "=== end of background ===";

/** The name a document is fenced under when it was given none. */
const UNTITLED = "untitled";

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asDocuments = (value: unknown): Document[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Document =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry),
      )
    : [];

/**
 * The fenced block, with its leading blank line, for the documents given — the
 * class's first, then a relay's — or the empty string when none stands.
 */
export function backgroundBlock(...sets: unknown[]): string {
  const documents = sets.flatMap(asDocuments);
  if (documents.length === 0) return "";
  const fenced = documents.map((document) => {
    const title = asString(document.title).trim() || UNTITLED;
    return `=== ${title} ===\n${asString(document.body)}`;
  });
  return `\n\n${BACKGROUND_OPENS}\n${fenced.join("\n")}\n${BACKGROUND_CLOSES}`;
}

export function draftContext({ references, kind }: { references: string[]; kind: string }): string {
  return JSON.stringify({ references, kind: kind === "quiz" || kind === "survey" ? kind : "" });
}

export function draftReferences({ context }: { context: string }): string[] {
  try {
    const value: unknown = JSON.parse(context);
    if (
      typeof value !== "object" ||
      value === null ||
      !("references" in value) ||
      !Array.isArray(value.references)
    )
      return [];
    return value.references.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function draftRequest({ request, kind }: { request: string; kind: string }): string {
  return kind === "quiz" || kind === "survey" ? `Create a ${kind}.\n\n${request}` : request;
}
