export const DEFAULT_AUTH_REDIRECT = "/ca-nhan";

const MAX_REDIRECT_LENGTH = 2048;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f\r\n\\]/;
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

function decodeRedirectCandidate(value: string): string | null {
  let decoded = value;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }

    if (next === decoded) {
      break;
    }
    decoded = next;
  }

  return decoded;
}

export function isSafeInternalPath(rawPath: string | null | undefined): rawPath is string {
  if (typeof rawPath !== "string") {
    return false;
  }

  const candidate = rawPath.trim();
  if (
    !candidate ||
    candidate.length > MAX_REDIRECT_LENGTH ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    CONTROL_CHARACTER_PATTERN.test(candidate)
  ) {
    return false;
  }

  const decoded = decodeRedirectCandidate(candidate);
  if (
    !decoded ||
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    SCHEME_PATTERN.test(decoded) ||
    decoded.includes("://") ||
    CONTROL_CHARACTER_PATTERN.test(decoded)
  ) {
    return false;
  }

  try {
    const parsed = new URL(candidate, "https://lefthand.invalid");
    return parsed.origin === "https://lefthand.invalid";
  } catch {
    return false;
  }
}

export function getSafeRedirectPath(
  rawPath: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT
): string {
  return isSafeInternalPath(rawPath) ? rawPath.trim() : fallback;
}
