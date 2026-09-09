export const BoundedJsonErrorCode = {
  TooLarge: "too_large",
  Malformed: "malformed"
} as const;

export type BoundedJsonErrorCode = (typeof BoundedJsonErrorCode)[keyof typeof BoundedJsonErrorCode];

export class BoundedJsonError extends Error {
  readonly code: BoundedJsonErrorCode;

  constructor(code: BoundedJsonErrorCode) {
    super(code === BoundedJsonErrorCode.TooLarge ? "Request body is too large." : "Request body is invalid.");
    this.name = "BoundedJsonError";
    this.code = code;
  }
}

function contentLengthValue(value: string | null, maxBytes: number): number | null {
  if (value === null) return null;
  if (!/^\d+$/.test(value)) throw new BoundedJsonError(BoundedJsonErrorCode.Malformed);
  const length = Number(value);
  if (!Number.isFinite(length) || length > maxBytes) throw new BoundedJsonError(BoundedJsonErrorCode.TooLarge);
  if (!Number.isSafeInteger(length) || length < 0) throw new BoundedJsonError(BoundedJsonErrorCode.Malformed);
  return length;
}

/** Reads and parses JSON without trusting Content-Length or buffering an unbounded body. */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error("Invalid JSON body limit.");
  contentLengthValue(request.headers.get("content-length"), maxBytes);

  const reader = request.body?.getReader();
  if (!reader) throw new BoundedJsonError(BoundedJsonErrorCode.Malformed);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (!Number.isSafeInteger(total) || total > maxBytes) {
        try { await reader.cancel(); } catch { /* the request is rejected regardless */ }
        throw new BoundedJsonError(BoundedJsonErrorCode.TooLarge);
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof BoundedJsonError) throw error;
    throw new BoundedJsonError(BoundedJsonErrorCode.Malformed);
  } finally {
    reader.releaseLock();
  }

  try {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new BoundedJsonError(BoundedJsonErrorCode.Malformed);
  }
}
