import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  getMaterialDirectGrantsForUser,
  isActiveMaterialDirectGrant,
  type MaterialDirectGrant
} from "@/lib/repositories/material-direct-access-repository";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type SubjectRow = Database["public"]["Tables"]["subjects"]["Row"];
type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];
type ProductEntitlementRow = Database["public"]["Tables"]["product_entitlements"]["Row"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DISCOVERY_ENTITLEMENTS = 500;

export type StudentMaterialAccessSource = "entitlement" | "direct_grant" | "both";

export interface StudentMaterialDiscoverySubject {
  id: string;
  slug: string;
  name: string;
  category: string;
  colorTheme: string;
  accessSource: StudentMaterialAccessSource;
}

export interface StudentMaterialDiscoveryMaterial {
  productId: string;
  title: string;
  subjectSlug: string;
  subjectName: string;
  allowDownload: boolean;
  expiresAt: string | null;
  workspacePage: number;
}

export interface StudentMaterialDiscoveryData {
  subjects: StudentMaterialDiscoverySubject[];
  directMaterials: StudentMaterialDiscoveryMaterial[];
}

export class StudentMaterialDiscoveryRepositoryError extends Error {
  constructor() {
    super("Student material discovery data is unavailable.");
    this.name = "StudentMaterialDiscoveryRepositoryError";
  }
}

type DiscoveryProduct = Pick<ProductRow, "id" | "subject_id" | "kind" | "title" | "description"> & { canonicalId: string };
type DiscoverySubject = Pick<SubjectRow, "id" | "slug" | "name" | "category" | "color_theme"> & { canonicalId: string };
type DiscoveryEntitlement = Pick<ProductEntitlementRow, "user_id" | "product_id" | "status" | "expires_at" | "revoked_at">;
type DiscoveryMaterial = Pick<MaterialRow, "product_id" | "allow_download">;

function canonicalUuid(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

function isActiveEntitlement(value: DiscoveryEntitlement, userId: string, productId: string): boolean {
  if (value.status !== "active" || value.revoked_at !== null) return false;
  if (canonicalUuid(value.user_id) !== userId || canonicalUuid(value.product_id) !== productId) return false;
  return value.expires_at === null || (Number.isFinite(Date.parse(value.expires_at)) && Date.parse(value.expires_at) > Date.now());
}

function repositoryFailure(): never {
  throw new StudentMaterialDiscoveryRepositoryError();
}

async function readActiveEntitlements(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<DiscoveryEntitlement[]> {
  const { data, error } = await supabase
    .from("product_entitlements")
    .select("user_id, product_id, status, expires_at, revoked_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("product_id", { ascending: true })
    .limit(MAX_DISCOVERY_ENTITLEMENTS + 1);
  if (error || !Array.isArray(data) || data.length > MAX_DISCOVERY_ENTITLEMENTS) throw new Error();
  return data as DiscoveryEntitlement[];
}

export async function getStudentMaterialDiscovery(userId: string): Promise<StudentMaterialDiscoveryData> {
  const canonicalUserId = canonicalUuid(userId);
  if (!canonicalUserId) return repositoryFailure();

  try {
    const supabase = await createClient();
    const [entitlementRows, directGrantRows] = await Promise.all([
      readActiveEntitlements(canonicalUserId, supabase),
      getMaterialDirectGrantsForUser(canonicalUserId)
    ]);

    const directGrantsByMaterialId = new Map<string, MaterialDirectGrant>();
    for (const grant of directGrantRows) {
      const materialId = canonicalUuid(grant.material_id);
      if (!materialId || directGrantsByMaterialId.has(materialId)) throw new Error();
      directGrantsByMaterialId.set(materialId, grant);
    }

    const activeEntitlementsByProductId = new Map<string, DiscoveryEntitlement>();
    for (const entitlement of entitlementRows) {
      const productId = canonicalUuid(entitlement.product_id);
      if (!productId || activeEntitlementsByProductId.has(productId)) throw new Error();
      if (isActiveEntitlement(entitlement, canonicalUserId, productId)) activeEntitlementsByProductId.set(productId, entitlement);
    }

    const directViewMaterialIds = [...directGrantsByMaterialId.entries()]
      .filter(([materialId, grant]) => isActiveMaterialDirectGrant(grant, canonicalUserId, materialId) && grant.can_view)
      .map(([materialId]) => materialId);
    const productIds = [...new Set([...activeEntitlementsByProductId.keys(), ...directViewMaterialIds])];
    if (productIds.length === 0) return { subjects: [], directMaterials: [] };

    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("id, subject_id, kind, title, description")
      .in("id", productIds)
      .in("kind", ["material", "course"])
      .order("id", { ascending: true })
      .limit(productIds.length + 1);
    if (productError || !Array.isArray(productData) || productData.length > productIds.length) throw new Error();

    const products: DiscoveryProduct[] = [];
    for (const value of productData) {
      if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
      const row = value as Record<string, unknown>;
      const id = canonicalUuid(row.id);
      const subjectId = canonicalUuid(row.subject_id);
      if (!id || !subjectId || !productIds.includes(id) || (row.kind !== "material" && row.kind !== "course") || typeof row.title !== "string" || typeof row.description !== "string") throw new Error();
      products.push({ id: row.id as ProductRow["id"], subject_id: row.subject_id as ProductRow["subject_id"], kind: row.kind as ProductRow["kind"], title: row.title as ProductRow["title"], description: row.description as ProductRow["description"], canonicalId: id });
    }

    const authorizedProducts = products.filter((product) => {
      const directGrant = product.kind === "material" ? directGrantsByMaterialId.get(product.canonicalId) : undefined;
      const hasDirectView = directGrant !== undefined && isActiveMaterialDirectGrant(directGrant, canonicalUserId, product.canonicalId) && directGrant.can_view;
      const hasEntitlement = activeEntitlementsByProductId.has(product.canonicalId);
      return product.kind === "material" ? (directGrant ? hasDirectView : hasEntitlement) : hasEntitlement;
    });
    if (authorizedProducts.length === 0) return { subjects: [], directMaterials: [] };

    const subjectIds = [...new Set(authorizedProducts.map((product) => canonicalUuid(product.subject_id)).filter((id): id is string => id !== null))];
    const { data: subjectData, error: subjectError } = await supabase
      .from("subjects")
      .select("id, slug, name, category, color_theme")
      .in("id", subjectIds)
      .order("slug", { ascending: true })
      .limit(subjectIds.length + 1);
    if (subjectError || !Array.isArray(subjectData) || subjectData.length > subjectIds.length) throw new Error();

    const subjectsById = new Map<string, DiscoverySubject>();
    for (const value of subjectData) {
      if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
      const row = value as Record<string, unknown>;
      const id = canonicalUuid(row.id);
      const slug = typeof row.slug === "string" ? row.slug : null;
      if (!id || !subjectIds.includes(id) || !slug || typeof row.name !== "string" || typeof row.category !== "string" || typeof row.color_theme !== "string") throw new Error();
      subjectsById.set(id, { id: row.id as SubjectRow["id"], slug, name: row.name, category: row.category as SubjectRow["category"], color_theme: row.color_theme as SubjectRow["color_theme"], canonicalId: id });
    }

    const materialProducts = authorizedProducts.filter((product) => product.kind === "material");
    const materialIds = materialProducts.map((product) => product.canonicalId);
    const materialById = new Map<string, DiscoveryMaterial>();
    if (materialIds.length > 0) {
      const { data: materialData, error: materialError } = await supabase
        .from("materials")
        .select("product_id, allow_download")
        .in("product_id", materialIds)
        .order("product_id", { ascending: true })
        .limit(materialIds.length + 1);
      if (materialError || !Array.isArray(materialData) || materialData.length > materialIds.length) throw new Error();
      for (const value of materialData) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
        const row = value as Record<string, unknown>;
        const id = canonicalUuid(row.product_id);
        if (!id || !materialIds.includes(id) || typeof row.allow_download !== "boolean") throw new Error();
        materialById.set(id, { product_id: row.product_id as MaterialRow["product_id"], allow_download: row.allow_download });
      }
    }

    const productsBySubject = new Map<string, DiscoveryProduct[]>();
    for (const product of authorizedProducts) {
      const subjectId = canonicalUuid(product.subject_id);
      if (!subjectId || !subjectsById.has(subjectId)) continue;
      const list = productsBySubject.get(subjectId) ?? [];
      list.push(product);
      productsBySubject.set(subjectId, list);
    }
    for (const subjectProducts of productsBySubject.values()) {
      subjectProducts.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
    }

    const subjects = [...productsBySubject.entries()]
      .map(([subjectId, subjectProducts]) => {
        const subject = subjectsById.get(subjectId)!;
        const hasDirect = subjectProducts.some((product) => product.kind === "material" && directGrantsByMaterialId.has(product.canonicalId));
        const hasEntitlement = subjectProducts.some((product) => activeEntitlementsByProductId.has(product.canonicalId));
        const accessSource: StudentMaterialAccessSource = hasDirect && hasEntitlement ? "both" : hasDirect ? "direct_grant" : "entitlement";
        return { id: subject.canonicalId, slug: subject.slug, name: subject.name, category: subject.category, colorTheme: subject.color_theme, accessSource };
      })
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

    const directMaterials = materialProducts.flatMap((product) => {
      const grant = directGrantsByMaterialId.get(product.canonicalId);
      const subjectId = canonicalUuid(product.subject_id);
      const subject = subjectId ? subjectsById.get(subjectId) : undefined;
      const material = materialById.get(product.canonicalId);
      if (!grant || !subject || !material || !isActiveMaterialDirectGrant(grant, canonicalUserId, product.canonicalId) || !grant.can_view) return [];
      const subjectProducts = productsBySubject.get(subject.canonicalId) ?? [];
      const index = subjectProducts.findIndex((candidate) => candidate.canonicalId === product.canonicalId);
      return [{
        productId: product.canonicalId,
        title: product.title,
        subjectSlug: subject.slug,
        subjectName: subject.name,
        allowDownload: grant.can_download,
        expiresAt: grant.expires_at,
        workspacePage: Math.floor(Math.max(index, 0) / 100) + 1
      }];
    });

    return { subjects, directMaterials };
  } catch (error) {
    if (error instanceof StudentMaterialDiscoveryRepositoryError) throw error;
    return repositoryFailure();
  }
}
