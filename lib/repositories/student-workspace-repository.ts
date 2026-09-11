import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { MaterialDirectGrant } from "@/lib/repositories/material-direct-access-repository";

type SubjectRow = Database["public"]["Tables"]["subjects"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];
type CourseLessonRow = Database["public"]["Tables"]["course_lessons"]["Row"];
type ProductEntitlementRow = Database["public"]["Tables"]["product_entitlements"]["Row"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function canonicalUuid(value: string): string | null { return UUID_PATTERN.test(value) ? value.toLowerCase() : null; }

export const STUDENT_WORKSPACE_PAGE_SIZE = 100;
export const STUDENT_WORKSPACE_ID_CHUNK_SIZE = 100;
export const STUDENT_WORKSPACE_MAX_AUTHORIZED_PRODUCTS = 500;
export const STUDENT_WORKSPACE_MAX_LESSONS = 2_000;
export const STUDENT_WORKSPACE_MAX_PAGES = STUDENT_WORKSPACE_MAX_AUTHORIZED_PRODUCTS / STUDENT_WORKSPACE_PAGE_SIZE;

export interface StudentWorkspaceMaterial { productId: string; title: string; description: string; pages: number; allowDownload: boolean; mimeType: string | null; }
export interface StudentWorkspaceCourse { productId: string; title: string; lessons: Array<{ id: string; title: string; description: string | null; durationMinutes: number | null; orderIndex: number }>; }
export interface StudentWorkspaceData {
  subject: { slug: string; name: string; category: string; facultyGroup: string; colorTheme: string };
  materials: StudentWorkspaceMaterial[];
  courses: StudentWorkspaceCourse[];
  page: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  hasHardOverflow: boolean;
}
export class StudentWorkspaceRepositoryError extends Error { constructor() { super("Student workspace data is unavailable."); this.name = "StudentWorkspaceRepositoryError"; } }

type StudentWorkspaceProduct = Pick<ProductRow, "id" | "subject_id" | "kind" | "title" | "description">;
type StudentWorkspaceEntitlement = Pick<ProductEntitlementRow, "user_id" | "product_id" | "status" | "expires_at" | "revoked_at">;
type StudentWorkspaceMaterialRow = Pick<MaterialRow, "product_id" | "pages" | "allow_download">;
type StudentWorkspaceLessonRow = Pick<CourseLessonRow, "id" | "course_id" | "title" | "description" | "duration_minutes" | "order_index">;

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function readProductPage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subjectId: string,
  offset: number
): Promise<{ rows: StudentWorkspaceProduct[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from("products")
    .select("id, subject_id, kind, title, description")
    .eq("subject_id", subjectId)
    .in("kind", ["material", "course"])
    .order("id", { ascending: true })
    .range(offset, offset + STUDENT_WORKSPACE_PAGE_SIZE - 1);
  if (error || !Array.isArray(data) || data.length > STUDENT_WORKSPACE_PAGE_SIZE) throw new Error();
  return {
    rows: (data as StudentWorkspaceProduct[]).filter((product) => canonicalUuid(product.id) !== null && canonicalUuid(product.subject_id) === subjectId),
    hasMore: data.length === STUDENT_WORKSPACE_PAGE_SIZE
  };
}

async function readEntitlements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  productIds: readonly string[]
): Promise<StudentWorkspaceEntitlement[]> {
  const result: StudentWorkspaceEntitlement[] = [];
  for (const productIdChunk of chunks(productIds, STUDENT_WORKSPACE_ID_CHUNK_SIZE)) {
    if (productIdChunk.length === 0) continue;
    const { data, error } = await supabase
      .from("product_entitlements")
      .select("user_id, product_id, status, expires_at, revoked_at")
      .eq("user_id", userId)
      .in("product_id", productIdChunk)
      .order("product_id", { ascending: true })
      .limit(productIdChunk.length + 1);
    if (error || !Array.isArray(data) || data.length > productIdChunk.length) throw new Error();
    result.push(...(data as StudentWorkspaceEntitlement[]));
  }
  return result;
}

async function readMaterialRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productIds: readonly string[]
): Promise<StudentWorkspaceMaterialRow[]> {
  const result: StudentWorkspaceMaterialRow[] = [];
  for (const productIdChunk of chunks(productIds, STUDENT_WORKSPACE_ID_CHUNK_SIZE)) {
    if (productIdChunk.length === 0) continue;
    const { data, error } = await supabase
      .from("materials")
      .select("product_id, pages, allow_download")
      .in("product_id", productIdChunk)
      .order("product_id", { ascending: true })
      .limit(productIdChunk.length + 1);
    if (error || !Array.isArray(data) || data.length > productIdChunk.length) throw new Error();
    result.push(...(data as StudentWorkspaceMaterialRow[]));
  }
  return result;
}

async function readLessonRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseIds: readonly string[]
): Promise<{ rows: StudentWorkspaceLessonRow[]; hasMore: boolean }> {
  const result: StudentWorkspaceLessonRow[] = [];
  for (const courseIdChunk of chunks(courseIds, STUDENT_WORKSPACE_ID_CHUNK_SIZE)) {
    if (courseIdChunk.length === 0) continue;
    for (let offset = 0; ; offset += STUDENT_WORKSPACE_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("course_lessons")
        .select("id, course_id, title, description, duration_minutes, order_index")
        .in("course_id", courseIdChunk)
        .order("course_id", { ascending: true })
        .order("order_index", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + STUDENT_WORKSPACE_PAGE_SIZE - 1);
      if (error || !Array.isArray(data) || data.length > STUDENT_WORKSPACE_PAGE_SIZE) throw new Error();
      for (const row of data as StudentWorkspaceLessonRow[]) {
        if (result.length >= STUDENT_WORKSPACE_MAX_LESSONS) return { rows: result, hasMore: true };
        result.push(row);
      }
      if (data.length < STUDENT_WORKSPACE_PAGE_SIZE) break;
    }
  }
  return { rows: result, hasMore: false };
}

/** Returns one deterministic, entitlement-scoped workspace page; hard caps are reported, never hidden. */
export async function getAuthorizedStudentWorkspace(userId: string, slug: string, page = 1): Promise<StudentWorkspaceData | null> {
  const canonicalUserId = canonicalUuid(userId);
  if (!canonicalUserId || !Number.isSafeInteger(page) || page < 1 || page > STUDENT_WORKSPACE_MAX_PAGES) throw new StudentWorkspaceRepositoryError();
  try {
    const supabase = await createClient();
    const { getMaterialDirectGrantsForUserAndMaterials, isActiveMaterialDirectGrant } = await import("@/lib/repositories/material-direct-access-repository");
    const { data: subjectData, error: subjectError } = await supabase.from("subjects").select("id, slug, name, category, faculty_group, color_theme").eq("slug", slug).maybeSingle();
    if (subjectError) throw new Error();
    if (!subjectData) return null;
    const subject = subjectData as Pick<SubjectRow, "id" | "slug" | "name" | "category" | "faculty_group" | "color_theme">;
    const canonicalSubjectId = canonicalUuid(subject.id);
    if (!canonicalSubjectId) throw new Error();
    const entitledProducts: Array<Pick<ProductRow, "id" | "kind" | "title" | "description"> & { canonicalId: string }> = [];
    const pageStart = (page - 1) * STUDENT_WORKSPACE_PAGE_SIZE;
    const pageEnd = pageStart + STUDENT_WORKSPACE_PAGE_SIZE;
    let authorizedProductCount = 0;
    let hasNextPage = false;
    let hasHardOverflow = false;
    const directGrantsByMaterialId = new Map<string, MaterialDirectGrant>();
    productPages: for (let offset = 0; ; offset += STUDENT_WORKSPACE_PAGE_SIZE) {
      const productPage = await readProductPage(supabase, canonicalSubjectId, offset);
      const productIds = productPage.rows.map((product) => canonicalUuid(product.id)).filter((productId): productId is string => productId !== null);
      const entitlementData = await readEntitlements(supabase, canonicalUserId, productIds);
      const directGrantData = await getMaterialDirectGrantsForUserAndMaterials(canonicalUserId, productIds);
      const entitlementsByProductId = new Map<string, StudentWorkspaceEntitlement>();
      for (const entitlement of entitlementData) {
        const productId = canonicalUuid(entitlement.product_id);
        if (productId && entitlementsByProductId.has(productId)) throw new Error();
        if (productId) entitlementsByProductId.set(productId, entitlement);
      }
      for (const directGrant of directGrantData) {
        const materialId = canonicalUuid(directGrant.material_id);
        if (materialId && directGrantsByMaterialId.has(materialId)) throw new Error();
        if (materialId) directGrantsByMaterialId.set(materialId, directGrant);
      }
      for (const product of productPage.rows) {
        const productId = canonicalUuid(product.id);
        if (!productId) continue;
        const entitlement = entitlementsByProductId.get(productId);
        const directGrant = product.kind === "material" ? directGrantsByMaterialId.get(productId) : undefined;
        const hasActiveDirectView = directGrant !== undefined
          && isActiveMaterialDirectGrant(directGrant, canonicalUserId, productId)
          && directGrant.can_view;
        const hasDirectGrant = directGrant !== undefined;
        const hasActiveEntitlement = entitlement !== undefined
          && entitlement.status === "active"
          && entitlement.revoked_at === null
          && (entitlement.expires_at === null || Date.parse(entitlement.expires_at) > Date.now())
          && canonicalUuid(entitlement.user_id) === canonicalUserId
          && canonicalUuid(entitlement.product_id) === productId;
        if (product.kind === "material" ? (hasDirectGrant ? !hasActiveDirectView : !hasActiveEntitlement) : !hasActiveEntitlement) continue;
        if (authorizedProductCount >= STUDENT_WORKSPACE_MAX_AUTHORIZED_PRODUCTS) {
          hasHardOverflow = true;
          break productPages;
        }
        if (authorizedProductCount >= pageEnd) {
          hasNextPage = true;
          break productPages;
        }
        if (authorizedProductCount >= pageStart) entitledProducts.push({ ...product, canonicalId: productId });
        authorizedProductCount += 1;
      }
      if (!productPage.hasMore) break;
    }
    if (!entitledProducts.length) return null;
    const materialProducts = entitledProducts.filter((product) => product.kind === "material");
    const courseProducts = entitledProducts.filter((product) => product.kind === "course");
    const materialIds = materialProducts.map((product) => product.canonicalId);
    const courseIds = courseProducts.map((product) => product.canonicalId);
    const materialRows = await readMaterialRows(supabase, materialIds);
    const lessonResult = await readLessonRows(supabase, courseIds);
    hasHardOverflow ||= lessonResult.hasMore;
    const lessonRows = lessonResult.rows;
    const materialByProductId = new Map(materialRows.map((row) => [canonicalUuid(row.product_id), row]));
    return {
      subject: { slug: subject.slug, name: subject.name, category: subject.category, facultyGroup: subject.faculty_group, colorTheme: subject.color_theme },
      materials: materialProducts.flatMap((product) => { const material = materialByProductId.get(product.canonicalId); const directGrant = directGrantsByMaterialId.get(product.canonicalId); return material ? [{ productId: product.canonicalId, title: product.title, description: product.description, pages: material.pages, allowDownload: directGrant ? directGrant.can_download : material.allow_download, mimeType: null }] : []; }),
      courses: courseProducts.map((product) => ({ productId: product.canonicalId, title: product.title, lessons: lessonRows.filter((lesson) => canonicalUuid(lesson.course_id) === product.canonicalId).map((lesson) => ({ id: lesson.id, title: lesson.title, description: lesson.description, durationMinutes: lesson.duration_minutes, orderIndex: lesson.order_index })) })),
      page,
      hasPreviousPage: page > 1,
      hasNextPage,
      hasHardOverflow
    };
  } catch (error) { if (error instanceof StudentWorkspaceRepositoryError) throw error; throw new StudentWorkspaceRepositoryError(); }
}
