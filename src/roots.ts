export function getProjectRoots(): string[] {
  const raw = process.env.PROJECT_ROOTS || "Projects";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

