import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { MaterialItem, CourseItem, TutorItem, CourseFormat, TutorFormat } from "@/data/catalog";
import type { Category, ColorTheme } from "@/lib/domain/subjects";
import type { EnrollmentStatus } from "@/lib/domain/product-types";
import { formatVND } from "@/lib/domain/product-types";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];

interface MaterialJoinedRow extends ProductRow {
  materials: Database["public"]["Tables"]["materials"]["Row"] | null;
  subjects: Database["public"]["Tables"]["subjects"]["Row"] | null;
}

interface CourseJoinedRow extends ProductRow {
  courses: Database["public"]["Tables"]["courses"]["Row"] | null;
  subjects: Database["public"]["Tables"]["subjects"]["Row"] | null;
}

interface TutorSubjectJoined {
  is_primary: boolean;
  subjects: Database["public"]["Tables"]["subjects"]["Row"] | null;
}

interface TutorJoinedRow extends ProductRow {
  tutors: Database["public"]["Tables"]["tutors"]["Row"] | null;
  subjects: Database["public"]["Tables"]["subjects"]["Row"] | null;
  tutor_subjects: TutorSubjectJoined[];
}

/**
 * Maps a raw joined database product + material + subject record to the frontend MaterialItem interface.
 */
export function mapRowToMaterialItem(row: MaterialJoinedRow): MaterialItem {
  const mat = row.materials;
  const subj = row.subjects;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subject: subj?.name ?? row.title,
    facultyGroup: subj?.faculty_group ?? "UFM",
    category: row.category as Category,
    type: "TÀI LIỆU",
    description: row.description,
    price: row.is_contact_for_price || row.price_vnd === null
      ? "Liên hệ"
      : formatVND(row.price_vnd),
    oldPrice: row.old_price_vnd ? formatVND(row.old_price_vnd) : undefined,
    pages: mat?.pages ?? 0,
    tags: mat?.tags ?? [],
    rating: Number(row.rating),
    isHot: row.is_hot,
    colorTheme: row.color_theme as ColorTheme,
    includes: mat?.includes ?? undefined,
    suitableFor: mat?.suitable_for ?? undefined
  };
}

/**
 * Maps a raw joined database product + course + subject record to the frontend CourseItem interface.
 */
export function mapRowToCourseItem(row: CourseJoinedRow): CourseItem {
  const crs = row.courses;
  const subj = row.subjects;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subject: subj?.name ?? row.title,
    category: row.category as Category,
    format: (crs?.format ?? "online") as CourseFormat,
    sessions: crs?.sessions ?? 0,
    duration: crs?.duration ?? "",
    schedule: crs?.schedule ?? "",
    description: row.description,
    price: row.is_contact_for_price || row.price_vnd === null
      ? "Liên hệ"
      : formatVND(row.price_vnd),
    oldPrice: row.old_price_vnd ? formatVND(row.old_price_vnd) : undefined,
    status: (crs?.enrollment_status ?? "open") as EnrollmentStatus,
    mentor: crs?.mentor ?? "",
    tags: crs?.tags ?? [],
    rating: Number(row.rating),
    colorTheme: row.color_theme as ColorTheme,
    curriculum: crs?.curriculum ?? undefined,
    suitableFor: crs?.suitable_for ?? undefined,
    preparation: crs?.preparation ?? undefined
  };
}

/**
 * Maps a raw joined database product + tutor + tutor_subjects record to the frontend TutorItem interface.
 */
export function mapRowToTutorItem(row: TutorJoinedRow): TutorItem {
  const tut = row.tutors;
  const primarySubject = row.subjects?.name;

  // Collect subjects from tutor_subjects join, sorting primary subject first
  const subjectList: string[] = [];
  if (row.tutor_subjects && row.tutor_subjects.length > 0) {
    const sorted = [...row.tutor_subjects].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    for (const ts of sorted) {
      if (ts.subjects?.name && !subjectList.includes(ts.subjects.name)) {
        subjectList.push(ts.subjects.name);
      }
    }
  }

  // Fallback to primary product subject if no tutor_subjects rows were attached
  if (subjectList.length === 0 && primarySubject) {
    subjectList.push(primarySubject);
  }

  // Format tutor price (e.g., "120.000đ / giờ" or "Liên hệ")
  let priceStr: string;
  if (row.is_contact_for_price || row.price_vnd === null) {
    priceStr = "Liên hệ";
  } else {
    priceStr = `${formatVND(row.price_vnd)} / giờ`;
  }

  return {
    id: row.id,
    slug: row.slug,
    name: tut?.name ?? row.title,
    subjects: subjectList,
    faculty: tut?.faculty ?? (row.subjects?.faculty_group ?? "UFM"),
    strengths: tut?.strengths ?? [],
    format: (tut?.format ?? "1:1 & Online") as TutorFormat,
    price: priceStr,
    availability: tut?.availability ?? "",
    rating: Number(row.rating),
    shortBio: tut?.short_bio ?? row.description,
    tags: tut?.tags ?? [],
    colorTheme: row.color_theme as ColorTheme,
    suitableFor: tut?.suitable_for ?? undefined,
    supportMethods: tut?.support_methods ?? undefined
  };
}

/**
 * Lists all public published products from the products table,
 * ordered by created_at descending.
 */
export async function listPublishedProducts(): Promise<ProductRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("publication_status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list published products: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Retrieves a single published product by its slug.
 * Returns the product record or null if not found.
 */
export async function getPublishedProductBySlug(
  slug: string
): Promise<ProductRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("publication_status", "published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to get published product by slug "${slug}": ${error.message}`
    );
  }

  return data;
}

/**
 * Lists all published materials joined with their material details and subject metadata.
 */
export async function listPublishedMaterials(): Promise<MaterialItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, materials!inner(*), subjects(*)")
    .eq("publication_status", "published")
    .eq("kind", "material")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list published materials: ${error.message}`);
  }

  return ((data as unknown as MaterialJoinedRow[]) ?? []).map(mapRowToMaterialItem);
}

/**
 * Retrieves a single published material by its slug.
 * Returns the mapped MaterialItem or null if not found.
 */
export async function getPublishedMaterialBySlug(
  slug: string
): Promise<MaterialItem | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, materials!inner(*), subjects(*)")
    .eq("publication_status", "published")
    .eq("kind", "material")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to get published material by slug "${slug}": ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  return mapRowToMaterialItem(data as unknown as MaterialJoinedRow);
}

/**
 * Lists all published courses joined with their course details and subject metadata.
 */
export async function listPublishedCourses(): Promise<CourseItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, courses!inner(*), subjects(*)")
    .eq("publication_status", "published")
    .eq("kind", "course")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list published courses: ${error.message}`);
  }

  return ((data as unknown as CourseJoinedRow[]) ?? []).map(mapRowToCourseItem);
}

/**
 * Retrieves a single published course by its slug.
 * Returns the mapped CourseItem or null if not found.
 */
export async function getPublishedCourseBySlug(
  slug: string
): Promise<CourseItem | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, courses!inner(*), subjects(*)")
    .eq("publication_status", "published")
    .eq("kind", "course")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to get published course by slug "${slug}": ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  return mapRowToCourseItem(data as unknown as CourseJoinedRow);
}

/**
 * Lists all published tutors joined with their tutor details, tutor_subjects, and subject metadata.
 */
export async function listPublishedTutors(): Promise<TutorItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, tutors!inner(*), subjects(*), tutor_subjects(is_primary, subjects(*))")
    .eq("publication_status", "published")
    .eq("kind", "tutor")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list published tutors: ${error.message}`);
  }

  return ((data as unknown as TutorJoinedRow[]) ?? []).map(mapRowToTutorItem);
}

/**
 * Retrieves a single published tutor by its slug.
 * Returns the mapped TutorItem or null if not found.
 */
export async function getPublishedTutorBySlug(
  slug: string
): Promise<TutorItem | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, tutors!inner(*), subjects(*), tutor_subjects(is_primary, subjects(*))")
    .eq("publication_status", "published")
    .eq("kind", "tutor")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to get published tutor by slug "${slug}": ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  return mapRowToTutorItem(data as unknown as TutorJoinedRow);
}
