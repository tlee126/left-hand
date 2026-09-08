import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type {
  CatalogFilters,
  CatalogPage,
  CatalogSort,
  PublishedCatalogProduct,
  PublishedCourse,
  PublishedMaterial,
  PublishedTutor,
  SubjectIdentity
} from "@/lib/domain/catalog";
import { normalizeCatalogSearch } from "@/lib/domain/catalog";
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
  type EnrollmentStatus,
  type ProductKind
} from "@/lib/domain/product-types";
import { CATEGORY_THEME_MAP, isValidSlug, normalizeSlug } from "@/lib/domain/subjects";

export type { CatalogFilters, CatalogPage } from "@/lib/domain/catalog";

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

const PRODUCT_COLUMNS = "id, slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, is_contact_for_price, rating, is_hot, color_theme, created_at";
const PRODUCT_ROW_COLUMNS = `${PRODUCT_COLUMNS}, updated_at`;
const SUBJECT_COLUMNS = "id, slug, name, category, faculty_group, color_theme";
const MATERIAL_COLUMNS = "product_id, pages, tags, includes, suitable_for";
const COURSE_COLUMNS = "product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation";
const TUTOR_COLUMNS = "product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods";
const TUTOR_SUBJECT_COLUMNS = "is_primary, subjects(id, slug, name, category, faculty_group, color_theme)";

export const PUBLIC_CATALOG_SELECT = {
  material: `${PRODUCT_COLUMNS}, materials!inner(${MATERIAL_COLUMNS}), subjects!inner(${SUBJECT_COLUMNS})`,
  course: `${PRODUCT_COLUMNS}, courses!inner(${COURSE_COLUMNS}), subjects!inner(${SUBJECT_COLUMNS})`,
  tutor: `${PRODUCT_COLUMNS}, tutors!inner(${TUTOR_COLUMNS}, tutor_subjects(${TUTOR_SUBJECT_COLUMNS})), subjects!inner(${SUBJECT_COLUMNS})`
} as const;

export const DEFAULT_CATALOG_LIMIT = 12;
export const MAX_CATALOG_LIMIT = 48;

interface CatalogQueryBuilder {
  eq(column: string, value: unknown): CatalogQueryBuilder;
  gte(column: string, value: number): CatalogQueryBuilder;
  lte(column: string, value: number): CatalogQueryBuilder;
  in(column: string, values: readonly string[]): CatalogQueryBuilder;
  ilike(column: string, value: string): CatalogQueryBuilder;
  or(value: string): CatalogQueryBuilder;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): CatalogQueryBuilder;
  range(from: number, to: number): Promise<{ data: unknown; error: unknown; count?: number | null }>;
}

function canonicalLookupSlug(slug: string): string | null {
  if (typeof slug !== "string") return null;
  const normalized = normalizeSlug(slug);
  return isValidSlug(normalized) ? normalized : null;
}

function boundedInteger(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new CatalogDataError("Invalid catalog pagination.");
  }
  return Math.min(value, maximum);
}

function normalizeFilters(filters: CatalogFilters = {}): Required<Pick<CatalogFilters, "limit" | "offset" | "sort">> & CatalogFilters {
  const limit = boundedInteger(filters.limit, DEFAULT_CATALOG_LIMIT, MAX_CATALOG_LIMIT) || DEFAULT_CATALOG_LIMIT;
  const page = filters.page === undefined ? undefined : boundedInteger(filters.page, 1, 10000);
  const offset = filters.offset === undefined
    ? (page === undefined ? 0 : (Math.max(1, page) - 1) * limit)
    : boundedInteger(filters.offset, 0, 1_000_000);
  if (filters.search !== undefined && typeof filters.search !== "string") throw new CatalogDataError("Invalid catalog search filter.");
  const search = filters.search === undefined
    ? undefined
    : filters.search.trim().replace(/\s+/g, " ") || undefined;
  if (filters.minPrice !== undefined && (!isValidVND(filters.minPrice) || filters.minPrice < 0)) throw new CatalogDataError("Invalid catalog price filter.");
  if (filters.maxPrice !== undefined && (!isValidVND(filters.maxPrice) || filters.maxPrice < 0)) throw new CatalogDataError("Invalid catalog price filter.");
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined && filters.minPrice > filters.maxPrice) throw new CatalogDataError("Invalid catalog price range.");
  if (filters.category !== undefined && !isCategory(filters.category)) throw new CatalogDataError("Invalid catalog category filter.");
  if (filters.subject !== undefined && !canonicalLookupSlug(filters.subject)) throw new CatalogDataError("Invalid catalog subject filter.");
  if (filters.sort !== undefined && !["newest", "price-asc", "price-desc", "rating-desc", "relevant", "available-slot"].includes(filters.sort)) throw new CatalogDataError("Invalid catalog sort.");
  if (filters.courseFormat !== undefined && !isCourseFormat(filters.courseFormat)) throw new CatalogDataError("Invalid course format filter.");
  if (filters.courseFormats !== undefined && (!Array.isArray(filters.courseFormats) || filters.courseFormats.some((format) => !isCourseFormat(format)))) throw new CatalogDataError("Invalid course format filter.");
  if (filters.enrollmentStatus !== undefined && !isEnrollmentStatus(filters.enrollmentStatus)) throw new CatalogDataError("Invalid enrollment status filter.");
  if (filters.tutorMode !== undefined && filters.tutorMode !== "online" && filters.tutorMode !== "one-to-one") throw new CatalogDataError("Invalid tutor filter.");
  return { ...filters, search, limit, offset, sort: filters.sort ?? "newest" };
}

export function parseCatalogFilters(params: Record<string, string | string[] | undefined>): CatalogFilters {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const category = first(params.category);
  const subject = first(params.subject);
  const sort = first(params.sort) as CatalogSort | undefined;
  const courseFormat = first(params.courseFormat);
  const enrollmentStatus = first(params.enrollmentStatus);
  const tutorMode = first(params.tutorMode);
  const limitValue = Number(first(params.limit));
  const pageValue = Number(first(params.page));
  const minPriceValue = Number(first(params.minPrice));
  const maxPriceValue = Number(first(params.maxPrice));
  return {
    search: first(params.search)?.trim().replace(/\s+/g, " ") || undefined,
    category: category && isCategory(category) ? category : undefined,
    subject: subject || undefined,
    minPrice: Number.isSafeInteger(minPriceValue) && minPriceValue >= 0 ? minPriceValue : undefined,
    maxPrice: Number.isSafeInteger(maxPriceValue) && maxPriceValue >= 0 ? maxPriceValue : undefined,
    sort: ["newest", "price-asc", "price-desc", "rating-desc", "relevant", "available-slot"].includes(sort || "") ? sort : undefined,
    limit: Number.isSafeInteger(limitValue) && limitValue > 0 ? limitValue : undefined,
    page: Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : undefined,
    courseFormat: ["online", "offline", "video", "zoom"].includes(courseFormat || "") ? courseFormat as CatalogFilters["courseFormat"] : undefined,
    courseFormats: courseFormat?.split(",").filter((format): format is NonNullable<CatalogFilters["courseFormat"]> => ["online", "offline", "video", "zoom"].includes(format)) as CatalogFilters["courseFormats"],
    enrollmentStatus: ["open", "coming-soon", "full"].includes(enrollmentStatus || "") ? enrollmentStatus as CatalogFilters["enrollmentStatus"] : undefined,
    tutorMode: ["online", "one-to-one"].includes(tutorMode || "") ? tutorMode as CatalogFilters["tutorMode"] : undefined
  };
}

function escapeIlike(value: string): string {
  return value.replace(/[\\%_(),]/g, " ").replace(/\s+/g, " ").trim();
}

function applyCatalogFilters(query: CatalogQueryBuilder, filters: ReturnType<typeof normalizeFilters>): CatalogQueryBuilder {
  let next = query.eq("publication_status", "published");
  if (filters.category) next = next.eq("category", filters.category);
  if (filters.subject) next = next.eq("subjects.slug", canonicalLookupSlug(filters.subject));
  if (filters.minPrice !== undefined) next = next.gte("price_vnd", filters.minPrice);
  if (filters.maxPrice !== undefined) next = next.lte("price_vnd", filters.maxPrice);
  if (filters.search) {
    const raw = escapeIlike(filters.search);
    const normalized = escapeIlike(normalizeCatalogSearch(filters.search));
    const slug = normalized.replace(/\s+/g, "-");
    next = next.or(`title.ilike.%${raw}%,description.ilike.%${raw}%,slug.ilike.%${slug}%`);
  }
  if (filters.courseFormats?.length) next = next.in("courses.format", filters.courseFormats);
  else if (filters.courseFormat) next = next.eq("courses.format", filters.courseFormat);
  if (filters.enrollmentStatus) next = next.eq("courses.enrollment_status", filters.enrollmentStatus);
  if (filters.tutorMode === "online") next = next.ilike("tutors.format", "%online%");
  if (filters.tutorMode === "one-to-one") next = next.ilike("tutors.format", "%1:1%");
  return next;
}

function orderCatalogQuery(query: CatalogQueryBuilder, sort: CatalogSort, kind: ProductKind): CatalogQueryBuilder {
  if (sort === "price-asc") return query.order("price_vnd", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).order("id", { ascending: true });
  if (sort === "price-desc") return query.order("price_vnd", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).order("id", { ascending: true });
  if (sort === "rating-desc") return query.order("rating", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: true });
  if (sort === "available-slot" && kind === "tutor") return query.order("rating", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: true });
  return query.order("created_at", { ascending: false }).order("id", { ascending: true });
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

async function listCatalog<T>(kind: ProductKind, filters: CatalogFilters, mapper: (row: unknown) => T, message: string, client?: CatalogClient): Promise<CatalogPage<T>> {
  const normalized = normalizeFilters(filters);
  const supabase = client ?? await createClient();
  let query = applyCatalogFilters(
    supabase.from("products").select(PUBLIC_CATALOG_SELECT[kind], { count: "exact" }) as unknown as CatalogQueryBuilder,
    normalized
  );
  query = orderCatalogQuery(query, normalized.sort, kind);
  const { data, error, count } = await query.range(normalized.offset, normalized.offset + normalized.limit - 1);
  if (error) throw new Error(message);
  const items = mapPublishedRows(data, mapper, message);
  const total = typeof count === "number" ? count : normalized.offset + items.length;
  return {
    items,
    total,
    limit: normalized.limit,
    offset: normalized.offset,
    page: Math.floor(normalized.offset / normalized.limit) + 1,
    hasNext: normalized.offset + items.length < total,
    hasPrevious: normalized.offset > 0
  };
}

export function listMaterials(filters: CatalogFilters = {}, client?: CatalogClient) {
  return listCatalog("material", filters, (row) => mapMaterialRow(row as MaterialJoinedRow), "Failed to list published materials.", client);
}

export function listCourses(filters: CatalogFilters = {}, client?: CatalogClient) {
  return listCatalog("course", filters, (row) => mapCourseRow(row as CourseJoinedRow), "Failed to list published courses.", client);
}

export function listTutors(filters: CatalogFilters = {}, client?: CatalogClient) {
  return listCatalog("tutor", filters, (row) => mapTutorRow(row as TutorJoinedRow), "Failed to list published tutors.", client);
}

export async function getProductBySlug(kind: ProductKind, slug: string, client?: CatalogClient): Promise<PublishedCatalogProduct | null> {
  const canonicalSlug = canonicalLookupSlug(slug);
  if (!canonicalSlug) return null;
  const supabase = client ?? await createClient();
  const { data, error } = await supabase.from("products").select(PUBLIC_CATALOG_SELECT[kind]).eq("publication_status", "published").eq("kind", kind).eq("slug", canonicalSlug).maybeSingle();
  if (error) throw new Error("Failed to get published catalog product.");
  if (!data || data.publication_status !== "published" || data.kind !== kind) return null;
  try {
    if (kind === "material") return mapMaterialRow(data as unknown as MaterialJoinedRow);
    if (kind === "course") return mapCourseRow(data as unknown as CourseJoinedRow);
    return mapTutorRow(data as unknown as TutorJoinedRow);
  } catch {
    throw new Error("Failed to get published catalog product.");
  }
}

/** @deprecated Use getProductBySlug with an explicit product kind. */
export async function getPublishedProductBySlug(slug: string, client?: CatalogClient): Promise<PublishedCatalogProduct | null> {
  const canonicalSlug = canonicalLookupSlug(slug);
  if (!canonicalSlug) return null;
  const matches = await Promise.all([
    getProductBySlug("material", canonicalSlug, client),
    getProductBySlug("course", canonicalSlug, client),
    getProductBySlug("tutor", canonicalSlug, client)
  ]);
  const found = matches.filter((item): item is PublishedCatalogProduct => item !== null);
  if (found.length > 1) throw new Error("Failed to get published catalog product.");
  return found[0] ?? null;
}

export async function listPublishedProducts(client?: CatalogClient): Promise<ProductRow[]> {
  const supabase = client ?? await createClient();
  const { data, error } = await supabase.from("products").select(PRODUCT_ROW_COLUMNS).eq("publication_status", "published").order("created_at", { ascending: false }).order("id", { ascending: true }).range(0, MAX_CATALOG_LIMIT - 1);
  if (error) throw new Error("Failed to list published products.");
  return (data ?? []).filter((row) => row.publication_status === "published");
}

export async function listPublishedMaterials(client?: CatalogClient): Promise<PublishedMaterial[]> {
  return (await listMaterials({}, client)).items as PublishedMaterial[];
}

export async function getPublishedMaterialBySlug(slug: string, client?: CatalogClient): Promise<PublishedMaterial | null> {
  const result = await getProductBySlug("material", slug, client);
  return result?.kind === "material" ? result : null;
}

export async function listPublishedCourses(client?: CatalogClient): Promise<PublishedCourse[]> {
  return (await listCourses({}, client)).items as PublishedCourse[];
}

export async function getPublishedCourseBySlug(slug: string, client?: CatalogClient): Promise<PublishedCourse | null> {
  const result = await getProductBySlug("course", slug, client);
  return result?.kind === "course" ? result : null;
}

export async function listPublishedTutors(client?: CatalogClient): Promise<PublishedTutor[]> {
  return (await listTutors({}, client)).items as PublishedTutor[];
}

export async function getPublishedTutorBySlug(slug: string, client?: CatalogClient): Promise<PublishedTutor | null> {
  const result = await getProductBySlug("tutor", slug, client);
  return result?.kind === "tutor" ? result : null;
}
