export function deriveSlugFromTitle(title: string): string {
  const trimmed = title.trim();
  // Remove whitespace around runs of + or - to preserve contiguous markers (e.g., "+++ ---" => "+++---")
  const tight = trimmed.replace(/\s*([+-]+)\s*/g, "$1");
  // Replace remaining whitespace with dashes
  const withDashes = tight.replace(/\s+/g, "-");
  // Keep alphanumeric, plus, and minus; drop other punctuation
  const filtered = withDashes.replace(/[^a-zA-Z0-9+\-]/g, "");
  return filtered.toLowerCase();
}
