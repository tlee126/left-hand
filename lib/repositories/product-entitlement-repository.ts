import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type ProductEntitlementRow = Database["public"]["Tables"]["product_entitlements"]["Row"];
type ProductEntitlementInsert = Database["public"]["Tables"]["product_entitlements"]["Insert"];

export type ProductEntitlement = ProductEntitlementRow;
export type ProductEntitlementStatus = "active" | "revoked" | "expired";

export interface GrantProductEntitlementInput {
  userId: string;
  productId: string;
  expiresAt?: string | null;
}

export class ProductEntitlementInputError extends Error {
  constructor(message = "Invalid product entitlement input.") {
    super(message);
    this.name = "ProductEntitlementInputError";
  }
}

export class ProductEntitlementRepositoryError extends Error {
  constructor(message = "Product entitlement operation failed.") {
    super(message);
    this.name = "ProductEntitlementRepositoryError";
  }
}

export const PRODUCT_ENTITLEMENT_COLUMNS = [
  "id",
  "user_id",
  "product_id",
  "status",
  "granted_at",
  "expires_at",
  "revoked_at",
  "granted_by",
  "created_at",
  "updated_at"
] as const;

export const PRODUCT_ENTITLEMENT_SELECT = PRODUCT_ENTITLEMENT_COLUMNS.join(", ");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function canonicalUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ProductEntitlementInputError();
  }
  return value.toLowerCase();
}

function validateGrantInput(input: unknown): { userId: string; productId: string; expiresAt: string | null } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ProductEntitlementInputError();
  }

  const record = input as Record<string, unknown>;
  const userId = canonicalUuid(record.userId);
  const productId = canonicalUuid(record.productId);
  let expiresAt: string | null = null;

  if (record.expiresAt !== undefined && record.expiresAt !== null) {
    if (typeof record.expiresAt !== "string" || !Number.isFinite(Date.parse(record.expiresAt))) {
      throw new ProductEntitlementInputError();
    }
    expiresAt = record.expiresAt;
  }

  return { userId, productId, expiresAt };
}

function repositoryFailure(): never {
  throw new ProductEntitlementRepositoryError();
}

function isCurrentlyActive(row: ProductEntitlementRow): boolean {
  if (row.status !== "active" || row.revoked_at !== null) return false;
  return row.expires_at === null || Date.parse(row.expires_at) > Date.now();
}

export async function getActiveProductEntitlement(
  userId: string,
  productId: string
): Promise<ProductEntitlement | null> {
  const canonicalUserId = canonicalUuid(userId);
  const canonicalProductId = canonicalUuid(productId);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("product_entitlements")
      .select(PRODUCT_ENTITLEMENT_SELECT)
      .eq("user_id", canonicalUserId)
      .eq("product_id", canonicalProductId)
      .eq("status", "active")
      .maybeSingle();

    if (error) return repositoryFailure();
    if (!data) return null;
    const row = data as unknown as ProductEntitlementRow;
    return isCurrentlyActive(row) ? row : null;
  } catch (error) {
    if (error instanceof ProductEntitlementInputError) throw error;
    return repositoryFailure();
  }
}

export async function grantProductEntitlement(input: GrantProductEntitlementInput): Promise<ProductEntitlement> {
  const { userId, productId, expiresAt } = validateGrantInput(input);

  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user || !UUID_PATTERN.test(authData.user.id)) return repositoryFailure();

    const payload: ProductEntitlementInsert = {
      user_id: userId,
      product_id: productId,
      status: "active",
      expires_at: expiresAt,
      granted_by: authData.user.id.toLowerCase()
    };

    const { data, error } = await supabase
      .from("product_entitlements")
      .insert(payload)
      .select(PRODUCT_ENTITLEMENT_SELECT)
      .single();

    if (error || !data) return repositoryFailure();
    return data as unknown as ProductEntitlement;
  } catch (error) {
    if (error instanceof ProductEntitlementInputError || error instanceof ProductEntitlementRepositoryError) throw error;
    return repositoryFailure();
  }
}

export async function revokeProductEntitlement(
  userId: string,
  productId: string
): Promise<ProductEntitlement | null> {
  const canonicalUserId = canonicalUuid(userId);
  const canonicalProductId = canonicalUuid(productId);

  try {
    const supabase = await createClient();
    const payload: Database["public"]["Tables"]["product_entitlements"]["Update"] = {
      status: "revoked",
      revoked_at: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from("product_entitlements")
      .update(payload)
      .eq("user_id", canonicalUserId)
      .eq("product_id", canonicalProductId)
      .select(PRODUCT_ENTITLEMENT_SELECT)
      .maybeSingle();

    if (error) return repositoryFailure();
    return (data as unknown as ProductEntitlement | null) ?? null;
  } catch (error) {
    if (error instanceof ProductEntitlementInputError || error instanceof ProductEntitlementRepositoryError) throw error;
    return repositoryFailure();
  }
}
