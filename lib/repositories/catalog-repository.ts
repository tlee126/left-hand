import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { PublishedCourse, PublishedMaterial, PublishedTutor, SubjectIdentity } from "@/lib/domain/catalog";
import {
  isCategory,
  isColorTheme,
  isCourseFormat,
  isDeliveryKind,
  isEnrollmentStatus,
  isProductKind,
  isPublicationStatus,
  isTutorFormat,
  isValidVND,
  type CourseFormat,
  type DeliveryKind,
  type ProductKind
} from "@/lib/domain/product-types";
import { CATEGORY_THEME_MAP, isValidSlug, normalizeSlug } from "@/lib/domain/subjects";

type Tables = Database["public"]["Tables"];
export type ProductRow = Tables["products"]["Row"];
type SubjectRow = Tables["subjects"]["Row"];
type MaterialRow = Tables["materials"]["Row"];
type CourseRow = Tables["courses"]["Row"];
type TutorRow = Tables["tutors"]["Row"];
export type CatalogClient = Awaited<ReturnType<typeof createClient>>;

interface MaterialJoinedRow extends ProductRow {
  materials: MaterialRow | null;
  subjects: SubjectRow | null;
}

interface CourseJoinedRow extends ProductRow {
  courses: CourseRow | null;
  subjects: SubjectRow | null;
}

interface TutorSubjectJoined {
  is_primary: boolean;
  subjects: SubjectRow | null;
}

type TutorNestedDetails = TutorRow & { tutor_subjects?: TutorSubjectJoined[] };

interface TutorJoinedRow extends ProductRow {
  tutors: TutorNestedDetails | null;
  subjects: SubjectRow | null;
  tutor_subjects?: TutorSubjectJoined[];
}

export class CatalogDataError extends Error {
  constructor(message = "Catalog data is invalid.") {
    super(message);
    this.name = "CatalogDataError";
  }
}

function invalid(message: string): never {
  throw new CatalogDataError(message);
}

function cleanString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    return invalid(`Invalid catalog field: ${field}`);
  }
  return value;
}

function stringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0 || item.trim() !== item)) {
    return invalid(`Invalid catalog field: ${field}`);
  }
  return value;
}

function validateSubject(row: SubjectRow | null): SubjectIdentity {
  if (!row) return invalid("Published product subject is missing.");
  const id = cleanString(row.id, "subject.id");
  const slug = cleanString(row.slug, "subject.slug");
  const name = cleanString(row.name, "subject.name");
  const facultyGroup = cleanString(row.faculty_group, "subject.faculty_group");
  if (!isValidSlug(slug) || normalizeSlug(slug) !== slug) return invalid("Published product subject slug is invalid.");
  if (!isCategory(row.category) || !isColorTheme(row.color_theme)) return invalid("Published product subject metadata is invalid.");
  if (CATEGORY_THEME_MAP[row.category] !== row.color_theme) return invalid("Published product subject theme does not match its category.");
  return { id, slug, name, category: row.category, facultyGroup, colorTheme: row.color_theme };
}

function validatePricing(row: ProductRow) {
  if (typeof row.is_contact_for_price !== "boolean") return invalid("Published product pricing flag is invalid.");
  if (row.price_vnd !== null && !isValidVND(row.price_vnd)) return invalid("Published product price is invalid.");
  if (row.old_price_vnd !== null && !isValidVND(row.old_price_vnd)) return invalid("Published product original price is invalid.");
  if (row.is_contact_for_price !== (row.price_vnd === null)) return invalid("Published product pricing consistency is invalid.");
  if (row.is_contact_for_price && row.old_price_vnd !== null) return invalid("Contact-price product cannot have an original price.");
  if (row.price_vnd !== null && row.old_price_vnd !== null && row.old_price_vnd < row.price_vnd) {
    return invalid("Published product original price is lower than its price.");
  }
  return {
    amountVND: row.price_vnd,
    originalAmountVND: row.old_price_vnd,
    isContactForPrice: row.is_contact_for_price
  };
}

function validateBase(
  row: ProductRow & { subjects: SubjectRow | null },
  expectedKind: ProductKind,
  expectedDelivery?: DeliveryKind
) {
  const id = cleanString(row.id, "product.id");
  const slug = cleanString(row.slug, "product.slug");
  const title = cleanString(row.title, "product.title");
  const description = cleanString(row.description, "product.description");
  if (!isValidSlug(slug) || normalizeSlug(slug) !== slug) return invalid("Published product slug is invalid.");
  if (!isProductKind(row.kind) || row.kind !== expectedKind) return invalid("Published product kind is invalid.");
  if (row.publication_status !== "published" || !isPublicationStatus(row.publication_status)) return invalid("Published product status is invalid.");
  if (!isCategory(row.category) || !isColorTheme(row.color_theme)) return invalid("Published product category or theme is invalid.");
  if (!isDeliveryKind(row.delivery_kind) || (expectedDelivery && row.delivery_kind !== expectedDelivery)) return invalid("Published product delivery is invalid.");
  if (typeof row.rating !== "number" || !Number.isFinite(row.rating) || row.rating < 1 || row.rating > 5) return invalid("Published product rating is invalid.");
  if (typeof row.is_hot !== "boolean") return invalid("Published product hot flag is invalid.");

  const subject = validateSubject(row.subjects);
  if (row.subject_id !== subject.id || row.category !== subject.category || row.color_theme !== subject.colorTheme) {
    return invalid("Published product subject, category, or theme is inconsistent.");
  }
  if (CATEGORY_THEME_MAP[row.category] !== row.color_theme) return invalid("Published product theme does not match its category.");

  return {
    id, slug, title, description, subject,
    category: row.category,
    deliveryKind: row.delivery_kind,
    publicationStatus: "published" as const,
    pricing: validatePricing(row),
    rating: row.rating,
    isHot: row.is_hot,
    colorTheme: row.color_theme
  };
}

function validateCourseDelivery(format: CourseFormat, delivery: DeliveryKind): "live_session" | "recorded_video" {
  const expected = format === "video" ? "recorded_video" : "live_session";
  if (delivery !== expected) return invalid("Course format and delivery are inconsistent.");
  return expected;
}

function mapMaterialRow(row: MaterialJoinedRow): PublishedMaterial {
  const base = validateBase(row, "material", "digital_download");
  const material = row.materials;
  if (!material || !Number.isInteger(material.pages) || material.pages <= 0) return invalid("Published material metadata is invalid.");
  return {
    ...base,
    kind: "material",
    deliveryKind: "digital_download",
    material: {
      pages: material.pages,
      tags: stringArray(material.tags, "material.tags"),
      includes: stringArray(material.includes, "material.includes"),
      suitableFor: stringArray(material.suitable_for, "material.suitable_for")
    }
  };
}

function mapCourseRow(row: CourseJoinedRow): PublishedCourse {
  const course = row.courses;
  if (!course || !isCourseFormat(course.format) || !Number.isInteger(course.sessions) || course.sessions <= 0 || !isEnrollmentStatus(course.enrollment_status)) {
    return invalid("Published course metadata is invalid.");
  }
  const deliveryKind = validateCourseDelivery(course.format, row.delivery_kind);
  const base = validateBase(row, "course", deliveryKind);
  return {
    ...base,
    kind: "course",
    deliveryKind,
    course: {
      format: course.format,
      sessions: course.sessions,
      duration: cleanString(course.duration, "course.duration"),
      schedule: cleanString(course.schedule, "course.schedule"),
      enrollmentStatus: course.enrollment_status,
      mentor: cleanString(course.mentor, "course.mentor"),
      tags: stringArray(course.tags, "course.tags"),
      curriculum: stringArray(course.curriculum, "course.curriculum"),
      suitableFor: stringArray(course.suitable_for, "course.suitable_for"),
      preparation: stringArray(course.preparation, "course.preparation")
    }
  };
}

function mapTutorRow(row: TutorJoinedRow): PublishedTutor {
  const tutor = row.tutors;
  if (!tutor || !isTutorFormat(tutor.format)) return invalid("Published tutor metadata is invalid.");
  const subjectRows = tutor.tutor_subjects ?? row.tutor_subjects ?? [];
  if (subjectRows.length === 0 || subjectRows.filter((item) => item.is_primary).length !== 1) {
    return invalid("Published tutor must have exactly one primary subject.");
  }
  const subjects = subjectRows
    .map((item) => ({ subject: validateSubject(item.subjects), isPrimary: item.is_primary }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.subject.slug.localeCompare(b.subject.slug))
    .map((item) => item.subject);
  const primary = subjects[0];
  if (!primary || primary.id !== row.subject_id) return invalid("Published tutor primary subject is inconsistent.");
  const base = validateBase(row, "tutor", "one_on_one_tutoring");
  return {
    ...base,
    kind: "tutor",
    deliveryKind: "one_on_one_tutoring",
    tutor: {
      name: cleanString(tutor.name, "tutor.name"),
      faculty: cleanString(tutor.faculty, "tutor.faculty"),
      format: tutor.format,
      availability: cleanString(tutor.availability, "tutor.availability"),
      shortBio: cleanString(tutor.short_bio, "tutor.short_bio"),
      strengths: stringArray(tutor.strengths, "tutor.strengths"),
      tags: stringArray(tutor.tags, "tutor.tags"),
      suitableFor: stringArray(tutor.suitable_for, "tutor.suitable_for"),
      supportMethods: stringArray(tutor.support_methods, "tutor.support_methods"),
      subjects
    }
  };
}

export const mapRowToPublishedMaterial = mapMaterialRow;
export const mapRowToPublishedCourse = mapCourseRow;
export const mapRowToPublishedTutor = mapTutorRow;
export const mapRowToMaterialItem = mapMaterialRow;
export const mapRowToCourseItem = mapCourseRow;
export const mapRowToTutorItem = mapTutorRow;

function canonicalLookupSlug(slug: string): string | null {
  if (typeof slug !== "string") return null;
  const normalized = normalizeSlug(slug);
  return isValidSlug(normalized) ? normalized : null;
}

function mapPublishedRows<T>(data: unknown, mapper: (row: unknown) => T, message: string): T[] {
  try {
    if (!Array.isArray(data)) return [];
    return data
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && (row as Record<string, unknown>).publication_status === "published")
      .map(mapper);
  } catch {
    throw new Error(message);
  }
}

export async function listPublishedProducts(client?: CatalogClient): Promise<ProductRow[]> {
  const supabase = client ?? await createClient();
  const { data, error } = await supabase.from("products").select("*").eq("publication_status", "published").order("created_at", { ascending: false });
  if (error) throw new Error("Failed to list published products.");
  return (data ?? []).filter((row) => row.publication_status === "published");
}

export async function getPublishedProductBySlug(slug: string, client?: CatalogClient): Promise<ProductRow | null> {
  const canonicalSlug = canonicalLookupSlug(slug);
  if (!canonicalSlug) return null;
  const supabase = client ?? await createClient();
  const { data, error } = await supabase.from("products").select("*").eq("publication_status", "published").eq("slug", canonicalSlug).maybeSingle();
  if (error) throw new Error("Failed to get published product by slug.");
  return data?.publication_status === "published" ? data : null;
}

export async function listPublishedMaterials(client?: CatalogClient): Promise<PublishedMaterial[]> {
  const supabase = client ?? await createClient();
  const { data, error } = await supabase.from("products").select("*, materials!inner(*), subjects(*)").eq("publication_status", "published").eq("kind", "material").order("created_at", { ascending: false });
  if (error) throw new Error("Failed to list published materials.");
  return mapPublishedRows(data, (row) => mapMaterialRow(row as MaterialJoinedRow), "Failed to list published materials.");
}

export async function getPublishedMaterialBySlug(slug: string, client?: CatalogClient): Promise<PublishedMaterial | null> {
  const canonicalSlug = canonicalLookupSlug(slug);
  if (!canonicalSlug) return null;
  const supabase = client ?? await createClient();
  const { data, error } = await supabase.from("products").select("*, materials!inner(*), subjects(*)").eq("publication_status", "published").eq("kind", "material").eq("slug", canonicalSlug).maybeSingle();
  if (error) throw new Error("Failed to get published material by slug.");
  if (!data || data.publication_status !== "published") return null;
  try { return mapMaterialRow(data as unknown as MaterialJoinedRow); } catch { throw new Error("Failed to get published material."); }
}

export async function listPublishedCourses(client?: CatalogClient): Promise<PublishedCourse[]> {
  const supabase = client ?? await createClient();
  const { data, error } = await supabase.from("products").select("*, courses!inner(*), subjects(*)").eq("publication_status", "published").eq("kind", "course").order("created_at", { ascending: false });
  if (error) throw new Error("Failed to list published courses.");
  return mapPublishedRows(data, (row) => mapCourseRow(row as CourseJoinedRow), "Failed to list published courses.");
}

export async function getPublishedCourseBySlug(slug: string, client?: CatalogClient): Promise<PublishedCourse | null> {
  const canonicalSlug = canonicalLookupSlug(slug);
  if (!canonicalSlug) return null;
  const supabase = client ?? await createClient();
  const { data, error } = await supabase.from("products").select("*, courses!inner(*), subjects(*)").eq("publication_status", "published").eq("kind", "course").eq("slug", canonicalSlug).maybeSingle();
  if (error) throw new Error("Failed to get published course by slug.");
  if (!data || data.publication_status !== "published") return null;
  try { return mapCourseRow(data as unknown as CourseJoinedRow); } catch { throw new Error("Failed to get published course."); }
}

export async function listPublishedTutors(client?: CatalogClient): Promise<PublishedTutor[]> {
  const supabase = client ?? await createClient();
  const { data, error } = await supabase.from("products").select("*, tutors!inner(*, tutor_subjects(is_primary, subjects(*))), subjects(*)").eq("publication_status", "published").eq("kind", "tutor").order("created_at", { ascending: false });
  if (error) throw new Error("Failed to list published tutors.");
  return mapPublishedRows(data, (row) => mapTutorRow(row as TutorJoinedRow), "Failed to list published tutors.");
}

export async function getPublishedTutorBySlug(slug: string, client?: CatalogClient): Promise<PublishedTutor | null> {
  const canonicalSlug = canonicalLookupSlug(slug);
  if (!canonicalSlug) return null;
  const supabase = client ?? await createClient();
  const { data, error } = await supabase.from("products").select("*, tutors!inner(*, tutor_subjects(is_primary, subjects(*))), subjects(*)").eq("publication_status", "published").eq("kind", "tutor").eq("slug", canonicalSlug).maybeSingle();
  if (error) throw new Error("Failed to get published tutor by slug.");
  if (!data || data.publication_status !== "published") return null;
  try { return mapTutorRow(data as unknown as TutorJoinedRow); } catch { throw new Error("Failed to get published tutor."); }
}
