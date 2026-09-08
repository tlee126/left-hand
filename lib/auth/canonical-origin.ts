const DEFAULT_CANONICAL_ORIGIN = "https://lefthand.vn";

function parseConfiguredOrigin(value: string | undefined): string | null {
  if (!value || !value.trim()) {
    return null;
  }

  try {
    const parsed = new URL(value.trim());
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function getCanonicalOrigin(requestUrl: string): string {
  const configuredOrigin = parseConfiguredOrigin(
    process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL
  );
  if (configuredOrigin) {
    return configuredOrigin;
  }

  // Local test/dev requests may use their local origin. Production always uses
  // the configured value or the safe application default, never request headers.
  if (process.env.NODE_ENV !== "production") {
    try {
      const requestOrigin = new URL(requestUrl).origin;
      if (isLocalOrigin(requestOrigin)) {
        return requestOrigin;
      }
    } catch {
      // Fall through to the canonical application origin.
    }
  }

  return DEFAULT_CANONICAL_ORIGIN;
}
