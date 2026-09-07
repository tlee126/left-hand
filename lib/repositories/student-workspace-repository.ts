import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type SubjectRow = Database["public"]["Tables"]["subjects"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];
type CourseLessonRow = Database["public"]["Tables"]["course_lessons"]["Row"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function canonicalUuid(value: string): string | null { return UUID_PATTERN.test(value) ? value.toLowerCase() : null; }

export interface StudentWorkspaceMaterial { productId: string; title: string; description: string; pages: number; }
export interface StudentWorkspaceCourse { productId: string; title: string; lessons: Array<{ id: string; title: string; description: string | null; durationMinutes: number | null; orderIndex: number }>; }
export interface StudentWorkspaceData { subject: { slug: string; name: string; category: string; facultyGroup: string; colorTheme: string }; materials: StudentWorkspaceMaterial[]; courses: StudentWorkspaceCourse[]; }
export class StudentWorkspaceRepositoryError extends Error { constructor() { super("Student workspace data is unavailable."); this.name = "StudentWorkspaceRepositoryError"; } }

/** Returns only subject resources covered by the user's current exact-product entitlement. */
export async function getAuthorizedStudentWorkspace(userId: string, slug: string): Promise<StudentWorkspaceData | null> {
  const canonicalUserId = canonicalUuid(userId);
  if (!canonicalUserId) throw new StudentWorkspaceRepositoryError();
  try {
    const supabase = await createClient();
    const { data: subjectData, error: subjectError } = await supabase.from("subjects").select("id, slug, name, category, faculty_group, color_theme").eq("slug", slug).maybeSingle();
    if (subjectError) throw new Error();
    if (!subjectData) return null;
    const subject = subjectData as Pick<SubjectRow, "id" | "slug" | "name" | "category" | "faculty_group" | "color_theme">;
    const canonicalSubjectId = canonicalUuid(subject.id);
    if (!canonicalSubjectId) throw new Error();
    const { data: productData, error: productError } = await supabase.from("products").select("id, subject_id, kind, title, description").eq("subject_id", canonicalSubjectId).in("kind", ["material", "course"]);
    if (productError) throw new Error();
    const products = ((productData ?? []) as Pick<ProductRow, "id" | "subject_id" | "kind" | "title" | "description">[]).filter((product) => canonicalUuid(product.id) !== null && canonicalUuid(product.subject_id) === canonicalSubjectId);
    const entitledProducts: Array<Pick<ProductRow, "id" | "kind" | "title" | "description"> & { canonicalId: string }> = [];
    for (const product of products) {
      const productId = canonicalUuid(product.id);
      if (!productId) continue;
      const { data: entitlement, error: entitlementError } = await supabase
        .from("product_entitlements")
        .select("user_id, product_id, status, expires_at, revoked_at")
        .eq("user_id", canonicalUserId)
        .eq("product_id", productId)
        .maybeSingle();
      if (entitlementError) throw new Error();
      if (
        entitlement
        && entitlement.status === "active"
        && entitlement.revoked_at === null
        && (entitlement.expires_at === null || Date.parse(entitlement.expires_at) > Date.now())
        && canonicalUuid(entitlement.user_id) === canonicalUserId
        && canonicalUuid(entitlement.product_id) === productId
      ) entitledProducts.push({ ...product, canonicalId: productId });
    }
    if (!entitledProducts.length) return null;
    const materialProducts = entitledProducts.filter((product) => product.kind === "material");
    const courseProducts = entitledProducts.filter((product) => product.kind === "course");
    const materialIds = materialProducts.map((product) => product.canonicalId);
    const courseIds = courseProducts.map((product) => product.canonicalId);
    let materialRows: Pick<MaterialRow, "product_id" | "pages">[] = [];
    if (materialIds.length) { const { data, error } = await supabase.from("materials").select("product_id, pages").in("product_id", materialIds); if (error) throw new Error(); materialRows = (data ?? []) as Pick<MaterialRow, "product_id" | "pages">[]; }
    let lessonRows: Pick<CourseLessonRow, "id" | "course_id" | "title" | "description" | "duration_minutes" | "order_index">[] = [];
    if (courseIds.length) { const { data, error } = await supabase.from("course_lessons").select("id, course_id, title, description, duration_minutes, order_index").in("course_id", courseIds).order("order_index", { ascending: true }); if (error) throw new Error(); lessonRows = (data ?? []) as Pick<CourseLessonRow, "id" | "course_id" | "title" | "description" | "duration_minutes" | "order_index">[]; }
    const materialByProductId = new Map(materialRows.map((row) => [canonicalUuid(row.product_id), row]));
    return {
      subject: { slug: subject.slug, name: subject.name, category: subject.category, facultyGroup: subject.faculty_group, colorTheme: subject.color_theme },
      materials: materialProducts.flatMap((product) => { const material = materialByProductId.get(product.canonicalId); return material ? [{ productId: product.canonicalId, title: product.title, description: product.description, pages: material.pages }] : []; }),
      courses: courseProducts.map((product) => ({ productId: product.canonicalId, title: product.title, lessons: lessonRows.filter((lesson) => canonicalUuid(lesson.course_id) === product.canonicalId).map((lesson) => ({ id: lesson.id, title: lesson.title, description: lesson.description, durationMinutes: lesson.duration_minutes, orderIndex: lesson.order_index })) }))
    };
  } catch (error) { if (error instanceof StudentWorkspaceRepositoryError) throw error; throw new StudentWorkspaceRepositoryError(); }
}
