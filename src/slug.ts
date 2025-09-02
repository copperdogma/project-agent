export function deriveSlugFromTitle(title: string): string {
  // Keep special characters except whitespace; normalize spaces to dashes and lowercase
  return title.trim().replace(/\s+/g, "-").toLowerCase();
}
