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
  type ProductKind,
  type TutorFormat
} from "@/lib/domain/product-types";
import { CATEGORY_THEME_MAP, isValidSlug, normalizeSlug } from "@/lib/domain/subjects";

export type { CatalogFilters, CatalogPage } from "@/lib/domain/catalog";

type Tables = Database["public"]["Tables"];
export type ProductRow = Tables["products"]["Row"];
type ProductProjection = Pick<ProductRow, "id" | "slug" | "kind" | "title" | "description" | "subject_id" | "category" | "delivery_kind" | "publication_status" | "price_vnd" | "old_price_vnd" | "is_contact_for_price" | "rating" | "is_hot" | "color_theme" | "created_at">;
type SubjectProjection = Pick<Tables["subjects"]["Row"], "id" | "slug" | "name" | "category" | "faculty_group" | "color_theme">;
type MaterialProjection = Pick<Tables["materials"]["Row"], "product_id" | "pages" | "tags" | "includes" | "suitable_for">;
type CourseProjection = Pick<Tables["courses"]["Row"], "product_id" | "format" | "sessions" | "duration" | "schedule" | "enrollment_status" | "mentor" | "tags" | "curriculum" | "suitable_for" | "preparation">;
type TutorProjection = Omit<Pick<Tables["tutors"]["Row"], "product_id" | "name" | "faculty" | "format" | "availability" | "short_bio" | "strengths" | "tags" | "suitable_for" | "support_methods">, "format"> & { format: TutorFormat };
type TutorSubjectProjection = { is_primary: boolean; subjects: SubjectProjection | null };

export interface CatalogQueryResult {
  data: unknown;
  error: unknown;
  count?: number | null;
}

export interface CatalogQuery extends PromiseLike<CatalogQueryResult> {
  select(columns: string, options?: { count?: "exact"; head?: boolean }): CatalogQuery;
  eq(column: string, value: string | number | boolean | null): CatalogQuery;
  gte(column: string, value: number): CatalogQuery;
  lte(column: string, value: number): CatalogQuery;
  in(column: string, values: readonly string[]): CatalogQuery;
  ilike(column: string, value: string): CatalogQuery;
  or(value: string): CatalogQuery;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): CatalogQuery;
  range(from: number, to: number): PromiseLike<CatalogQueryResult>;
  maybeSingle(): PromiseLike<CatalogQueryResult>;
}

export interface CatalogClient {
  products(columns: string, options?: { count?: "exact"; head?: boolean }): CatalogQuery;
}

export type CatalogClientFactory = () => Promise<CatalogClient>;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseProductBuilder = ReturnType<ReturnType<SupabaseServerClient["from"]>["select"]>;

function wrapSupabaseQuery(query: SupabaseProductBuilder): CatalogQuery {
  return {
    select(columns, options) { return wrapSupabaseQuery(query.select(columns, options)); },
    eq(column, value) { return wrapSupabaseQuery(query.eq(column, value)); },
    gte(column, value) { return wrapSupabaseQuery(query.gte(column, value)); },
    lte(column, value) { return wrapSupabaseQuery(query.lte(column, value)); },
    in(column, values) { return wrapSupabaseQuery(query.in(column, values)); },
    ilike(column, value) { return wrapSupabaseQuery(query.ilike(column, value)); },
    or(value) { return wrapSupabaseQuery(query.or(value)); },
    order(column, options) { return wrapSupabaseQuery(query.order(column, options)); },
    range(from, to) { return query.range(from, to); },
    maybeSingle() { return query.maybeSingle(); },
    then(onfulfilled, onrejected) { return query.then(onfulfilled, onrejected); }
  };
}

export class CatalogDataError extends Error {
  constructor(message = "Catalog data is invalid.") {
    super(message);
    this.name = "CatalogDataError";
  }
}

export class CatalogRepositoryError extends Error {
  constructor(message = "Unable to load the catalog.") {
    super(message);
    this.name = "CatalogRepositoryError";
  }
}

function invalid(message: string): never {
  throw new CatalogDataError(message);
}

function asObject(value: unknown): object | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function valueOf(input: object, key: string): unknown {
  return Object.getOwnPropertyDescriptor(input, key)?.value;
}

function cleanString(input: object, key: string): string {
  const property = key.includes(".") ? key.slice(key.lastIndexOf(".") + 1) : key;
  const value = valueOf(input, property);
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) return invalid(`Invalid catalog field: ${key}`);
  return value;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0 || item.trim() !== item)) return invalid(`Invalid catalog field: ${field}`);
  return value.map((item) => item);
}

function nullableNumber(input: object, key: string): number | null {
  const property = key.includes(".") ? key.slice(key.lastIndexOf(".") + 1) : key;
  const value = valueOf(input, property);
  if (value !== null && typeof value !== "number") return invalid(`Invalid catalog field: ${key}`);
  return value;
}

function integerValue(input: object, key: string): number {
  const property = key.includes(".") ? key.slice(key.lastIndexOf(".") + 1) : key;
  const value = valueOf(input, property);
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return invalid(`Invalid catalog field: ${key}`);
  return value;
}

function readProductProjection(value: unknown): ProductProjection {
  const input = asObject(value);
  if (!input) return invalid("Published product row is invalid.");
  const kind = valueOf(input, "kind");
  const category = valueOf(input, "category");
  const deliveryKind = valueOf(input, "delivery_kind");
  const publicationStatus = valueOf(input, "publication_status");
  const colorTheme = valueOf(input, "color_theme");
  const rating = valueOf(input, "rating");
  const isContactForPrice = valueOf(input, "is_contact_for_price");
  const isHot = valueOf(input, "is_hot");
  if (!isProductKind(kind) || !isCategory(category) || !isDeliveryKind(deliveryKind) || !isPublicationStatus(publicationStatus) || !isColorTheme(colorTheme)) return invalid("Published product enum fields are invalid.");
  if (typeof rating !== "number" || typeof isContactForPrice !== "boolean" || typeof isHot !== "boolean") return invalid("Published product scalar fields are invalid.");
  return {
    id: cleanString(input, "product.id"), slug: cleanString(input, "product.slug"), kind,
    title: cleanString(input, "product.title"), description: cleanString(input, "product.description"), subject_id: cleanString(input, "product.subject_id"),
    category, delivery_kind: deliveryKind, publication_status: publicationStatus,
    price_vnd: nullableNumber(input, "product.price_vnd"), old_price_vnd: nullableNumber(input, "product.old_price_vnd"),
    is_contact_for_price: isContactForPrice, rating, is_hot: isHot, color_theme: colorTheme,
    created_at: cleanString(input, "product.created_at")
  };
}

function readSubjectProjection(value: unknown): SubjectProjection | null {
  const input = asObject(value);
  if (!input) return null;
  const category = valueOf(input, "category");
  const colorTheme = valueOf(input, "color_theme");
  if (!isCategory(category) || !isColorTheme(colorTheme)) return invalid("Published subject metadata is invalid.");
  return { id: cleanString(input, "subject.id"), slug: cleanString(input, "subject.slug"), name: cleanString(input, "subject.name"), category, faculty_group: cleanString(input, "subject.faculty_group"), color_theme: colorTheme };
}

function readMaterialProjection(value: unknown): MaterialProjection | null {
  const input = asObject(value);
  if (!input) return null;
  return { product_id: cleanString(input, "material.product_id"), pages: integerValue(input, "pages"), tags: stringArray(valueOf(input, "tags"), "material.tags"), includes: stringArray(valueOf(input, "includes"), "material.includes"), suitable_for: stringArray(valueOf(input, "suitable_for"), "material.suitable_for") };
}

function readCourseProjection(value: unknown): CourseProjection | null {
  const input = asObject(value);
  if (!input) return null;
  const format = valueOf(input, "format");
  const enrollmentStatus = valueOf(input, "enrollment_status");
  if (!isCourseFormat(format) || !isEnrollmentStatus(enrollmentStatus)) return invalid("Published course metadata is invalid.");
  return { product_id: cleanString(input, "course.product_id"), format, sessions: integerValue(input, "sessions"), duration: cleanString(input, "course.duration"), schedule: cleanString(input, "course.schedule"), enrollment_status: enrollmentStatus, mentor: cleanString(input, "course.mentor"), tags: stringArray(valueOf(input, "tags"), "course.tags"), curriculum: stringArray(valueOf(input, "curriculum"), "course.curriculum"), suitable_for: stringArray(valueOf(input, "suitable_for"), "course.suitable_for"), preparation: stringArray(valueOf(input, "preparation"), "course.preparation") };
}

function readTutorProjection(value: unknown): TutorProjection | null {
  const input = asObject(value);
  if (!input) return null;
  const format = valueOf(input, "format");
  if (!isTutorFormat(format)) return invalid("Published tutor metadata is invalid.");
  return { product_id: cleanString(input, "tutor.product_id"), name: cleanString(input, "tutor.name"), faculty: cleanString(input, "tutor.faculty"), format, availability: cleanString(input, "tutor.availability"), short_bio: cleanString(input, "tutor.short_bio"), strengths: stringArray(valueOf(input, "strengths"), "tutor.strengths"), tags: stringArray(valueOf(input, "tags"), "tutor.tags"), suitable_for: stringArray(valueOf(input, "suitable_for"), "tutor.suitable_for"), support_methods: stringArray(valueOf(input, "support_methods"), "tutor.support_methods") };
}

function readTutorSubjects(value: unknown): TutorSubjectProjection[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const input = asObject(item);
    const primary = input ? valueOf(input, "is_primary") : undefined;
    if (!input || typeof primary !== "boolean") return invalid("Published tutor subjects are invalid.");
    return { is_primary: primary, subjects: readSubjectProjection(valueOf(input, "subjects")) };
  });
}

function validateSubject(row: SubjectProjection | null): SubjectIdentity {
  if (!row) return invalid("Published product subject is missing.");
  if (!isValidSlug(row.slug) || normalizeSlug(row.slug) !== row.slug) return invalid("Published product subject slug is invalid.");
  if (CATEGORY_THEME_MAP[row.category] !== row.color_theme) return invalid("Published product subject theme does not match its category.");
  return { id: row.id, slug: row.slug, name: row.name, category: row.category, facultyGroup: row.faculty_group, colorTheme: row.color_theme };
}

function validatePricing(row: ProductProjection) {
  if (row.price_vnd !== null && !isValidVND(row.price_vnd)) return invalid("Published product price is invalid.");
  if (row.old_price_vnd !== null && !isValidVND(row.old_price_vnd)) return invalid("Published product original price is invalid.");
  if (row.is_contact_for_price !== (row.price_vnd === null)) return invalid("Published product pricing consistency is invalid.");
  if (row.is_contact_for_price && row.old_price_vnd !== null) return invalid("Contact-price product cannot have an original price.");
  if (row.price_vnd !== null && row.old_price_vnd !== null && row.old_price_vnd < row.price_vnd) return invalid("Published product original price is lower than its price.");
  return { amountVND: row.price_vnd, originalAmountVND: row.old_price_vnd, isContactForPrice: row.is_contact_for_price };
}

function validateBase(row: ProductProjection, subjectRow: SubjectProjection | null, expectedKind: ProductKind, expectedDelivery?: DeliveryKind) {
  if (!isValidSlug(row.slug) || normalizeSlug(row.slug) !== row.slug) return invalid("Published product slug is invalid.");
  if (row.kind !== expectedKind || row.publication_status !== "published") return invalid("Published product status or kind is invalid.");
  if (!Number.isFinite(row.rating) || row.rating < 1 || row.rating > 5) return invalid("Published product rating is invalid.");
  if (expectedDelivery && row.delivery_kind !== expectedDelivery) return invalid("Published product delivery is invalid.");
  const subject = validateSubject(subjectRow);
  if (row.subject_id !== subject.id || row.category !== subject.category || row.color_theme !== subject.colorTheme) return invalid("Published product subject metadata is inconsistent.");
  return { id: row.id, slug: row.slug, title: row.title, description: row.description, subject, category: row.category, deliveryKind: row.delivery_kind, publicationStatus: "published" as const, pricing: validatePricing(row), rating: row.rating, isHot: row.is_hot, colorTheme: row.color_theme };
}

function validateCourseDelivery(format: CourseFormat, delivery: DeliveryKind): "live_session" | "recorded_video" {
  const expected = format === "video" ? "recorded_video" : "live_session";
  if (delivery !== expected) return invalid("Course format and delivery are inconsistent.");
  return expected;
}

function mapMaterialRow(row: unknown): PublishedMaterial {
  const product = readProductProjection(row);
  const input = asObject(row);
  const material = readMaterialProjection(input ? valueOf(input, "materials") : null);
  const base = validateBase(product, readSubjectProjection(input ? valueOf(input, "subjects") : null), "material", "digital_download");
  if (!material || !Number.isInteger(material.pages) || material.pages <= 0 || material.product_id !== product.id) return invalid("Published material metadata is invalid.");
  return { ...base, kind: "material", deliveryKind: "digital_download", material: { pages: material.pages, tags: material.tags, includes: material.includes, suitableFor: material.suitable_for } };
}

function mapCourseRow(row: unknown): PublishedCourse {
  const product = readProductProjection(row);
  const input = asObject(row);
  const course = readCourseProjection(input ? valueOf(input, "courses") : null);
  if (!course || !Number.isInteger(course.sessions) || course.sessions <= 0 || course.product_id !== product.id) return invalid("Published course metadata is invalid.");
  const deliveryKind = validateCourseDelivery(course.format, product.delivery_kind);
  const base = validateBase(product, readSubjectProjection(input ? valueOf(input, "subjects") : null), "course", deliveryKind);
  return { ...base, kind: "course", deliveryKind, course: { format: course.format, sessions: course.sessions, duration: course.duration, schedule: course.schedule, enrollmentStatus: course.enrollment_status, mentor: course.mentor, tags: course.tags, curriculum: course.curriculum, suitableFor: course.suitable_for, preparation: course.preparation } };
}

function mapTutorRow(row: unknown): PublishedTutor {
  const product = readProductProjection(row);
  const input = asObject(row);
  const tutorInput = input ? valueOf(input, "tutors") : null;
  const tutor = readTutorProjection(tutorInput);
  const tutorObject = asObject(tutorInput);
  const subjectRows = readTutorSubjects(tutorObject ? valueOf(tutorObject, "tutor_subjects") : input ? valueOf(input, "tutor_subjects") : null);
  if (!tutor || !tutorObject || subjectRows.length === 0 || subjectRows.filter((item) => item.is_primary).length !== 1 || tutor.product_id !== product.id) return invalid("Published tutor metadata is invalid.");
  const subjects = subjectRows.map((item) => ({ subject: validateSubject(item.subjects), isPrimary: item.is_primary })).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.subject.slug.localeCompare(b.subject.slug)).map((item) => item.subject);
  if (!subjects[0] || subjects[0].id !== product.subject_id) return invalid("Published tutor primary subject is inconsistent.");
  const base = validateBase(product, readSubjectProjection(input ? valueOf(input, "subjects") : null), "tutor", "one_on_one_tutoring");
  return { ...base, kind: "tutor", deliveryKind: "one_on_one_tutoring", tutor: { name: tutor.name, faculty: tutor.faculty, format: tutor.format, availability: tutor.availability, shortBio: tutor.short_bio, strengths: tutor.strengths, tags: tutor.tags, suitableFor: tutor.suitable_for, supportMethods: tutor.support_methods, subjects } };
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

function canonicalLookupSlug(slug: string): string | null {
  const normalized = normalizeSlug(slug);
  return isValidSlug(normalized) ? normalized : null;
}

function boundedInteger(value: unknown, fallback: number, maximum: number, minimum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) throw new CatalogDataError("Invalid catalog pagination.");
  return Math.min(value, maximum);
}

interface NormalizedCatalogFilters extends CatalogFilters {
  readonly limit: number;
  readonly offset: number;
  readonly sort: CatalogSort;
  readonly kind?: ProductKind;
}

function normalizeFilters(filters: CatalogFilters = {}): NormalizedCatalogFilters {
  const limit = boundedInteger(filters.limit, DEFAULT_CATALOG_LIMIT, MAX_CATALOG_LIMIT, 1);
  const page = filters.page === undefined ? undefined : boundedInteger(filters.page, 1, 10000, 1);
  const offset = filters.offset === undefined ? (page === undefined ? 0 : (page - 1) * limit) : boundedInteger(filters.offset, 0, 1_000_000, 0);
  if (filters.search !== undefined && typeof filters.search !== "string") throw new CatalogDataError("Invalid catalog search filter.");
  const search = filters.search === undefined ? undefined : filters.search.trim().replace(/\s+/g, " ") || undefined;
  if (filters.minPrice !== undefined && !isValidVND(filters.minPrice)) throw new CatalogDataError("Invalid catalog price filter.");
  if (filters.maxPrice !== undefined && !isValidVND(filters.maxPrice)) throw new CatalogDataError("Invalid catalog price filter.");
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

function catalogSort(value: string | undefined): CatalogSort | undefined {
  if (!value) return undefined;
  switch (value) {
    case "newest":
    case "price-asc":
    case "price-desc":
    case "rating-desc":
    case "relevant":
    case "available-slot":
      return value;
    default:
      return undefined;
  }
}

export function parseCatalogFilters(params: Record<string, string | string[] | undefined>): CatalogFilters {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const category = first(params.category);
  const subject = first(params.subject);
  const courseFormat = first(params.courseFormat);
  const enrollmentStatus = first(params.enrollmentStatus);
  const tutorMode = first(params.tutorMode);
  const limitValue = Number(first(params.limit));
  const pageValue = Number(first(params.page));
  const minPriceValue = Number(first(params.minPrice));
  const maxPriceValue = Number(first(params.maxPrice));
  const formats = courseFormat?.split(",").filter((format): format is CourseFormat => isCourseFormat(format));
  return {
    search: first(params.search)?.trim().replace(/\s+/g, " ") || undefined,
    category: category && isCategory(category) ? category : undefined,
    subject: subject || undefined,
    minPrice: Number.isSafeInteger(minPriceValue) && minPriceValue >= 0 ? minPriceValue : undefined,
    maxPrice: Number.isSafeInteger(maxPriceValue) && maxPriceValue >= 0 ? maxPriceValue : undefined,
    sort: catalogSort(first(params.sort)),
    limit: Number.isSafeInteger(limitValue) && limitValue > 0 ? limitValue : undefined,
    page: Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : undefined,
    courseFormat: courseFormat && isCourseFormat(courseFormat) ? courseFormat : undefined,
    courseFormats: formats,
    enrollmentStatus: enrollmentStatus && isEnrollmentStatus(enrollmentStatus) ? enrollmentStatus : undefined,
    tutorMode: tutorMode === "online" || tutorMode === "one-to-one" ? tutorMode : undefined
  };
}

function escapeIlike(value: string): string {
  return value.replace(/[\\%_(),]/g, " ").replace(/\s+/g, " ").trim();
}

function applyCatalogFilters(query: CatalogQuery, filters: NormalizedCatalogFilters): CatalogQuery {
  let next = query.eq("kind", filters.kind ?? null).eq("publication_status", "published");
  if (filters.category) next = next.eq("category", filters.category);
  if (filters.subject) next = next.eq("subjects.slug", canonicalLookupSlug(filters.subject));
  if (filters.minPrice !== undefined) next = next.gte("price_vnd", filters.minPrice);
  if (filters.maxPrice !== undefined) next = next.lte("price_vnd", filters.maxPrice);
  if (filters.search) {
    const normalized = escapeIlike(normalizeCatalogSearch(filters.search));
    if (normalized) next = next.ilike("search_document", `%${normalized}%`);
  }
  if (filters.courseFormats?.length) next = next.in("courses.format", filters.courseFormats);
  else if (filters.courseFormat) next = next.eq("courses.format", filters.courseFormat);
  if (filters.enrollmentStatus) next = next.eq("courses.enrollment_status", filters.enrollmentStatus);
  if (filters.tutorMode === "online") next = next.ilike("tutors.format", "%online%");
  if (filters.tutorMode === "one-to-one") next = next.ilike("tutors.format", "%1:1%");
  return next;
}

function orderCatalogQuery(query: CatalogQuery, sort: CatalogSort, kind: ProductKind): CatalogQuery {
  if (sort === "price-asc") return query.order("price_vnd", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).order("id", { ascending: true });
  if (sort === "price-desc") return query.order("price_vnd", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).order("id", { ascending: true });
  if (sort === "rating-desc") return query.order("rating", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: true });
  if (sort === "available-slot" && kind === "tutor") return query.order("rating", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: true });
  return query.order("created_at", { ascending: false }).order("id", { ascending: true });
}

function selectPublicCatalog(client: CatalogClient, kind: ProductKind): CatalogQuery {
  if (kind === "material") return client.products(PUBLIC_CATALOG_SELECT.material, { count: "exact" });
  if (kind === "course") return client.products(PUBLIC_CATALOG_SELECT.course, { count: "exact" });
  return client.products(PUBLIC_CATALOG_SELECT.tutor, { count: "exact" });
}

function isPublishedRow(value: unknown): boolean {
  const input = asObject(value);
  return input !== null && valueOf(input, "publication_status") === "published";
}

function mapPublishedRows<T>(data: unknown, mapper: (row: unknown) => T, message: string): T[] {
  if (!Array.isArray(data)) throw new CatalogRepositoryError(message);
  try {
    return data.filter(isPublishedRow).map(mapper);
  } catch {
    throw new CatalogRepositoryError(message);
  }
}

async function withCatalogBoundary<T>(message: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CatalogRepositoryError) throw error;
    throw new CatalogRepositoryError(message);
  }
}

async function defaultCatalogClientFactory(): Promise<CatalogClient> {
  const supabase = await createClient();
  return { products: (columns, options) => wrapSupabaseQuery(supabase.from("products").select(columns, options)) };
}

async function resolveCatalogClient(client?: CatalogClient, factory: CatalogClientFactory = defaultCatalogClientFactory): Promise<CatalogClient> {
  if (client) return client;
  return factory();
}

async function listCatalog<T>(kind: ProductKind, filters: CatalogFilters, mapper: (row: unknown) => T, message: string, client?: CatalogClient, factory?: CatalogClientFactory): Promise<CatalogPage<T>> {
  return withCatalogBoundary(message, async () => {
    const normalized = normalizeFilters(filters);
    const requestFilters: NormalizedCatalogFilters = { ...normalized, kind };
    let query = applyCatalogFilters(selectPublicCatalog(await resolveCatalogClient(client, factory), kind), requestFilters);
    query = orderCatalogQuery(query, normalized.sort, kind);
    const result = await query.range(normalized.offset, normalized.offset + normalized.limit - 1);
    if (result.error) throw new CatalogRepositoryError(message);
    const items = mapPublishedRows(result.data, mapper, message);
    const total = typeof result.count === "number" && Number.isSafeInteger(result.count) && result.count >= 0 ? result.count : null;
    return { items, total, limit: normalized.limit, offset: normalized.offset, page: Math.floor(normalized.offset / normalized.limit) + 1, hasNext: total === null ? null : normalized.offset + items.length < total, hasPrevious: normalized.offset > 0 };
  });
}

export function listMaterials(filters: CatalogFilters = {}, client?: CatalogClient, factory?: CatalogClientFactory) {
  return listCatalog("material", filters, mapMaterialRow, "Failed to list published materials.", client, factory);
}

export function listCourses(filters: CatalogFilters = {}, client?: CatalogClient, factory?: CatalogClientFactory) {
  return listCatalog("course", filters, mapCourseRow, "Failed to list published courses.", client, factory);
}

export function listTutors(filters: CatalogFilters = {}, client?: CatalogClient, factory?: CatalogClientFactory) {
  return listCatalog("tutor", filters, mapTutorRow, "Failed to list published tutors.", client, factory);
}

export async function getProductBySlug(kind: ProductKind, slug: string, client?: CatalogClient, factory?: CatalogClientFactory): Promise<PublishedCatalogProduct | null> {
  if (!isProductKind(kind)) throw new CatalogDataError("Invalid catalog kind.");
  const canonicalSlug = canonicalLookupSlug(slug);
  if (!canonicalSlug) return null;
  return withCatalogBoundary("Failed to get published catalog product.", async () => {
    const selected = kind === "material" ? PUBLIC_CATALOG_SELECT.material : kind === "course" ? PUBLIC_CATALOG_SELECT.course : PUBLIC_CATALOG_SELECT.tutor;
    const result = await (await resolveCatalogClient(client, factory)).products(selected).eq("kind", kind).eq("publication_status", "published").eq("slug", canonicalSlug).maybeSingle();
    if (result.error) throw new CatalogRepositoryError("Failed to get published catalog product.");
    if (!result.data || !isPublishedRow(result.data)) return null;
    if (kind === "material") return mapMaterialRow(result.data);
    if (kind === "course") return mapCourseRow(result.data);
    return mapTutorRow(result.data);
  });
}

/** @deprecated Use getProductBySlug with an explicit product kind. */
export async function getPublishedProductBySlug(slug: string, client?: CatalogClient): Promise<PublishedCatalogProduct | null> {
  const canonicalSlug = canonicalLookupSlug(slug);
  if (!canonicalSlug) return null;
  const matches = await Promise.all([getProductBySlug("material", canonicalSlug, client), getProductBySlug("course", canonicalSlug, client), getProductBySlug("tutor", canonicalSlug, client)]);
  const found = matches.filter((item): item is PublishedCatalogProduct => item !== null);
  if (found.length > 1) throw new CatalogRepositoryError("Failed to get published catalog product.");
  return found[0] ?? null;
}

export async function listPublishedProducts(client?: CatalogClient): Promise<ProductProjection[]> {
  return withCatalogBoundary("Failed to list published products.", async () => {
    const result = await (await resolveCatalogClient(client)).products(PRODUCT_ROW_COLUMNS).eq("publication_status", "published").order("created_at", { ascending: false }).order("id", { ascending: true }).range(0, MAX_CATALOG_LIMIT - 1);
    if (result.error || !Array.isArray(result.data)) throw new CatalogRepositoryError("Failed to list published products.");
    return result.data.filter(isPublishedRow).map(readProductProjection);
  });
}

export async function listPublishedMaterials(client?: CatalogClient): Promise<PublishedMaterial[]> {
  return (await listMaterials({}, client)).items.slice();
}

export async function getPublishedMaterialBySlug(slug: string, client?: CatalogClient): Promise<PublishedMaterial | null> {
  const result = await getProductBySlug("material", slug, client);
  return result?.kind === "material" ? result : null;
}

export async function listPublishedCourses(client?: CatalogClient): Promise<PublishedCourse[]> {
  return (await listCourses({}, client)).items.slice();
}

export async function getPublishedCourseBySlug(slug: string, client?: CatalogClient): Promise<PublishedCourse | null> {
  const result = await getProductBySlug("course", slug, client);
  return result?.kind === "course" ? result : null;
}

export async function listPublishedTutors(client?: CatalogClient): Promise<PublishedTutor[]> {
  return (await listTutors({}, client)).items.slice();
}

export async function getPublishedTutorBySlug(slug: string, client?: CatalogClient): Promise<PublishedTutor | null> {
  const result = await getProductBySlug("tutor", slug, client);
  return result?.kind === "tutor" ? result : null;
}
