/** Values accepted by the small spreadsheet serializer. */
export type CsvValue = string | number | boolean | null | undefined;

/**
 * Spreadsheet programs may evaluate cells beginning with these characters.
 * Prefixing text with an apostrophe keeps user-controlled values as text while
 * preserving what a reader sees in the sheet.
 */
function safeText(value: string): string {
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function serializeField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "string" ? safeText(value) : String(value);
  // RFC-style CSV uses CRLF both between records and inside multiline cells.
  const written = raw.replace(/\r\n|\r|\n/g, "\r\n");
  return /[",\r\n]/.test(written)
    ? `"${written.replaceAll('"', '""')}"`
    : written;
}

/** Serialize rows as UTF-8-ready, CRLF-delimited CSV. */
export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  if (rows.length === 0) return "";
  return `${rows.map((row) => row.map(serializeField).join(",")).join("\r\n")}\r\n`;
}

/** Turn a title into a stable, filesystem-friendly filename stem. */
export function fileSlug(title: string, fallback = "export"): string {
  const slug = title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? fallback : slug;
}

/** Hand a UTF-8 CSV document to the browser as a file. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Some browsers cancel the download if its object URL is revoked in the
  // same task as the click.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
