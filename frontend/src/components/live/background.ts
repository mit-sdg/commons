import { count } from "@/lib/format";

/** A document as the card holds it: the name it stands under, and its text. */
export interface DocumentDraft {
  title: string;
  body: string;
}

/** The most a document's body may run to, said in the field before the server says it. */
export const BODY_MAX = 40000;

/** The characters the drafter reads: every document's text, summed. */
export function documentTotal(documents: { body: string }[]): number {
  return documents.reduce((total, document) => total + document.body.length, 0);
}

/** The name a chosen file fills in: what it is called, without the extension. */
export function titleFromFile(name: string): string {
  return name.trim().replace(/\.(txt|md)$/i, "");
}

/** The file the button reads: the accept it asks for, which a dialog may ignore. */
export function isReadableFile(name: string, type: string): boolean {
  return (
    /\.(txt|md)$/i.test(name.trim()) ||
    type === "text/plain" ||
    type === "text/markdown"
  );
}

/** What a saved document asks to be written; nothing, when it stands as it is. */
export function documentEdit(
  typed: DocumentDraft,
  standing: DocumentDraft,
): DocumentDraft | null {
  const written = { title: typed.title.trim(), body: typed.body.trim() };
  if (written.title === "") return null;
  return written.title === standing.title.trim() &&
    written.body === standing.body.trim()
    ? null
    : written;
}

/** Who asks what the drafter reads: a relay's own card, or a brief of either kind. */
export type DocumentsAsker = "card" | "questionnaire" | "relay";

/** What the drafter reads beside the brief, in one sentence. */
export function classDocumentsLine(
  documents: number,
  asker: DocumentsAsker,
): string {
  if (documents === 0) return "No shared documents added.";
  const named = count(documents, "shared document");
  if (asker === "card") return `${named} available in the library.`;
  return asker === "relay"
    ? `${named} available in the library.`
    : `${named} available in the library.`;
}

/**
 * The question a press of Remove raises stands on the document it was raised
 * on, so opening another document or closing the card leaves nothing asked.
 */
export function removeAsked(
  asked: string | null,
  open: string | null,
): boolean {
  return asked !== null && asked === open;
}

/**
 * The way to add another document, which stands while one is open to be read
 * or corrected and goes only while the form for a new one already stands.
 */
export function addStands(adding: boolean, retired: boolean): boolean {
  return !adding && !retired;
}

/**
 * The Name box a document is wanting: empty, with the name asked for by a hand
 * that left the box or pressed Save. Text given before the name asks nothing.
 */
export function nameWanting(title: string, asked: boolean): boolean {
  return asked && title.trim() === "";
}
