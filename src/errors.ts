export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN_EMAIL"
  | "NOT_FOUND"
  | "NOT_FOUND_ANCHOR"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "READ_ONLY"
  | "INTERNAL";

export interface StandardError {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function makeError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): StandardError {
  const base: any = { error: { code, message } };
  if (details !== undefined) base.error.details = details;
  return base as StandardError;
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function errorFromException(err: unknown): StandardError {
  const message = extractMessage(err);
  const upper = message.toUpperCase();

  if (upper.startsWith("NOT_FOUND:")) {
    return makeError("NOT_FOUND", message, {});
  }
  if (upper.startsWith("MISSING_ANCHOR:")) {
    return makeError("NOT_FOUND_ANCHOR", message, {});
  }
  if (upper.startsWith("VALIDATION_ERROR")) {
    return makeError("VALIDATION_ERROR", message, {});
  }
  if (upper.startsWith("NOT_A_REPO")) {
    return makeError("NOT_FOUND", message, {});
  }
  if (upper.startsWith("NOT_FOUND_COMMIT")) {
    return makeError("NOT_FOUND", message, {});
  }
  if (upper.startsWith("WORKDIR_DIRTY")) {
    return makeError("CONFLICT", message, {});
  }
  if (upper.startsWith("REVERT_FAILED")) {
    return makeError("CONFLICT", message, {});
  }
  if (upper.startsWith("MISSING_SECTION")) {
    return makeError("VALIDATION_ERROR", message, {});
  }
  if (upper.startsWith("CONFLICT_EXPECTED_COMMIT")) {
    return makeError("CONFLICT", message, {});
  }
  if (upper.startsWith("PAYLOAD_TOO_LARGE")) {
    return makeError("PAYLOAD_TOO_LARGE", message, {});
  }
  if (upper.startsWith("RATE_LIMITED")) {
    return makeError("RATE_LIMITED", message, {});
  }
  // Filesystem/permission issues → treat as READ_ONLY for safety and clarity
  if (upper.includes("EACCES") || upper.includes("EPERM") || upper.includes("FILE_LOCKED")) {
    return makeError("READ_ONLY", message, {});
  }
  if (upper.startsWith("UNAUTHORIZED") || upper.startsWith("FORBIDDEN")) {
    const code: ErrorCode = upper.startsWith("FORBIDDEN")
      ? "FORBIDDEN_EMAIL"
      : "UNAUTHORIZED";
    return makeError(code, message, {});
  }
  // Fallback
  return makeError("INTERNAL", message || "Internal error", {});
}

