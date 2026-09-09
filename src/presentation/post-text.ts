export function titleFromContent(content: string): string {
  const line =
    content
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  return (
    line
      .replace(/^#{1,6}\s+/, "")
      .replace(/[*_`>#]/g, "")
      .trim() || "(untitled)"
  );
}

export function excerpt(content: string, max = 180): string {
  const text = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~]/g, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function bodyExcerpt(content: string, max = 180): string {
  const lines = content.split("\n");
  const titleLine = lines.findIndex((line) => line.trim().length > 0);
  if (titleLine === -1) return "";
  return excerpt(lines.slice(titleLine + 1).join("\n"), max);
}
