export type MaterialUploadAttemptIdentity = Readonly<{
  productId: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
}>;

export type MaterialUploadAttempt = Readonly<{
  idempotencyKey: string;
  identity: MaterialUploadAttemptIdentity;
}>;

function sameIdentity(left: MaterialUploadAttemptIdentity, right: MaterialUploadAttemptIdentity): boolean {
  return left.productId === right.productId
    && left.originalName === right.originalName
    && left.mimeType === right.mimeType
    && left.byteSize === right.byteSize;
}

export function getOrCreateMaterialUploadAttempt(
  current: MaterialUploadAttempt | null,
  identity: MaterialUploadAttemptIdentity,
  createKey: () => string = () => crypto.randomUUID()
): MaterialUploadAttempt {
  if (current && sameIdentity(current.identity, identity)) return current;
  return { idempotencyKey: createKey(), identity };
}
