import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
type SubjectRow = Tables["subjects"]["Row"];
type ProductRow = Tables["products"]["Row"];
type MaterialRow = Tables["materials"]["Row"];
type CourseRow = Tables["courses"]["Row"];
type TutorRow = Tables["tutors"]["Row"];
type SubjectInsert = Tables["subjects"]["Insert"];

export type CatalogCategory = Database["public"]["Enums"]["category_enum"];
export type CatalogColorTheme = Database["public"]["Enums"]["color_theme_enum"];
export type PublicationStatus = Database["public"]["Enums"]["publication_status_enum"];
export type DeliveryKind = Database["public"]["Enums"]["delivery_kind_enum"];
export type CourseFormat = Database["public"]["Enums"]["course_format_enum"];
export type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status_enum"];

export type AdminSubject = SubjectRow;
export type AdminMaterial = ProductRow & { materials: MaterialRow };
export type AdminCourse = ProductRow & { courses: CourseRow };
export type AdminTutor = ProductRow & { tutors: TutorRow };

export interface CreateAdminSubjectInput {
  slug: string;
  name: string;
  category: CatalogCategory;
  faculty_group: string;
  color_theme: CatalogColorTheme;
}

export type UpdateAdminSubjectInput = Partial<CreateAdminSubjectInput>;

interface ProductInput {
  slug: string;
  title: string;
  description: string;
  subject_id: string;
  category: CatalogCategory;
  delivery_kind: DeliveryKind;
  publication_status?: PublicationStatus;
  price_vnd: number | null;
  old_price_vnd?: number | null;
  is_contact_for_price: boolean;
  rating?: number;
  is_hot?: boolean;
  color_theme: CatalogColorTheme;
}

export interface CreateAdminMaterialInput extends ProductInput {
  pages: number;
  tags?: string[];
  includes?: string[];
  suitable_for?: string[];
}

export interface CreateAdminCourseInput extends ProductInput {
  format: CourseFormat;
  sessions: number;
  duration: string;
  schedule: string;
  enrollment_status?: EnrollmentStatus;
  mentor: string;
  tags?: string[];
  curriculum?: string[];
  suitable_for?: string[];
  preparation?: string[];
}

export interface CreateAdminTutorInput extends ProductInput {
  name: string;
  faculty: string;
  format: string;
  availability: string;
  short_bio: string;
  strengths?: string[];
  tags?: string[];
  suitable_for?: string[];
  support_methods?: string[];
}

export type UpdateAdminMaterialInput = Partial<CreateAdminMaterialInput>;
export type UpdateAdminCourseInput = Partial<CreateAdminCourseInput>;
export type UpdateAdminTutorInput = Partial<CreateAdminTutorInput>;

export interface ListAdminCatalogOptions {
  search?: string;
  publication_status?: PublicationStatus;
  limit?: number;
  offset?: number;
}

export const DEFAULT_ADMIN_CATALOG_PAGE_LIMIT = 20;
export const MAX_ADMIN_CATALOG_PAGE_LIMIT = 100;
export const MAX_ADMIN_CATALOG_SEARCH_LENGTH = 100;

export const SUBJECT_COLUMNS = [
  "id",
  "slug",
  "name",
  "category",
  "faculty_group",
  "color_theme",
  "created_at",
  "updated_at"
] as const;

export const PRODUCT_COLUMNS = [
  "id",
  "slug",
  "kind",
  "title",
  "description",
  "subject_id",
  "category",
  "delivery_kind",
  "publication_status",
  "price_vnd",
  "old_price_vnd",
  "is_contact_for_price",
  "rating",
  "is_hot",
  "color_theme",
  "created_at",
  "updated_at"
] as const;

export const MATERIAL_COLUMNS = [
  "product_id",
  "pages",
  "tags",
  "includes",
  "suitable_for",
  "created_at",
  "updated_at"
] as const;

export const COURSE_COLUMNS = [
  "product_id",
  "format",
  "sessions",
  "duration",
  "schedule",
  "enrollment_status",
  "mentor",
  "tags",
  "curriculum",
  "suitable_for",
  "preparation",
  "created_at",
  "updated_at"
] as const;

export const TUTOR_COLUMNS = [
  "product_id",
  "name",
  "faculty",
  "format",
  "availability",
  "short_bio",
  "strengths",
  "tags",
  "suitable_for",
  "support_methods",
  "created_at",
  "updated_at"
] as const;

export const SUBJECT_SELECT_COLUMNS = SUBJECT_COLUMNS.join(", ");
export const PRODUCT_SELECT_COLUMNS = PRODUCT_COLUMNS.join(", ");
export const MATERIAL_SELECT_COLUMNS = `${PRODUCT_SELECT_COLUMNS}, materials (${MATERIAL_COLUMNS.join(", ")})`;
export const COURSE_SELECT_COLUMNS = `${PRODUCT_SELECT_COLUMNS}, courses (${COURSE_COLUMNS.join(", ")})`;
export const TUTOR_SELECT_COLUMNS = `${PRODUCT_SELECT_COLUMNS}, tutors (${TUTOR_COLUMNS.join(", ")})`;

export class AdminCatalogInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminCatalogInputError";
  }
}

export class AdminCatalogRepositoryError extends Error {
  constructor(message = "Failed to perform admin catalog operation.") {
    super(message);
    this.name = "AdminCatalogRepositoryError";
  }
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLICATION_STATUSES = ["draft", "published", "archived"] as const;
const DELIVERY_KINDS = [
  "digital_download",
  "live_session",
  "recorded_video",
  "one_on_one_tutoring"
] as const;
const COURSE_FORMATS = ["online", "offline", "video", "zoom"] as const;
const ENROLLMENT_STATUSES = ["open", "coming-soon", "full"] as const;
const PRODUCT_INPUT_KEYS = [
  "slug",
  "title",
  "description",
  "subject_id",
  "category",
  "delivery_kind",
  "publication_status",
  "price_vnd",
  "old_price_vnd",
  "is_contact_for_price",
  "rating",
  "is_hot",
  "color_theme"
] as const;

type QueryResult = { data: unknown; error: unknown };

interface CatalogQuery extends PromiseLike<QueryResult> {
  select(columns?: string): CatalogQuery;
  insert(payload: Record<string, unknown>): CatalogQuery;
  update(payload: Record<string, unknown>): CatalogQuery;
  delete(): CatalogQuery;
  eq(column: string, value: unknown): CatalogQuery;
  or(filters: string): CatalogQuery;
  order(column: string, options: { ascending: boolean }): CatalogQuery;
  range(from: number, to: number): CatalogQuery;
  maybeSingle(): Promise<QueryResult>;
}

interface AdminCatalogClient {
  from(table: string): CatalogQuery;
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export function isValidCatalogSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG_REGEX.test(value);
}

function inputRecord(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new AdminCatalogInputError("Input must be an object.");
  }
  return input as Record<string, unknown>;
}

function assertAllowedKeys(record: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new AdminCatalogInputError(`Field ${key} is not permitted.`);
    }
  }
}

function requiredString(record: Record<string, unknown>, key: string, maxLength = 500): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new AdminCatalogInputError(`Field ${key} must be a non-empty bounded string.`);
  }
  return value.trim();
}

function optionalString(record: Record<string, unknown>, key: string, maxLength = 500): string | undefined {
  if (!(key in record)) return undefined;
  return requiredString(record, key, maxLength);
}

function enumString<T extends string>(record: Record<string, unknown>, key: string, allowed: readonly T[], required: boolean): T | undefined {
  if (!(key in record)) {
    if (required) throw new AdminCatalogInputError(`Field ${key} is required.`);
    return undefined;
  }
  const value = record[key];
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new AdminCatalogInputError(`Field ${key} has an invalid value.`);
  }
  return value as T;
}

function uuidField(record: Record<string, unknown>, key: string, required: boolean): string | undefined {
  if (!(key in record)) {
    if (required) throw new AdminCatalogInputError(`Field ${key} is required.`);
    return undefined;
  }
  if (!isValidUuid(record[key])) {
    throw new AdminCatalogInputError(`Field ${key} must be a valid UUID.`);
  }
  return record[key] as string;
}

function numberField(record: Record<string, unknown>, key: string, required: boolean, minimum?: number): number | undefined {
  if (!(key in record)) {
    if (required) throw new AdminCatalogInputError(`Field ${key} is required.`);
    return undefined;
  }
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || (minimum !== undefined && value < minimum)) {
    throw new AdminCatalogInputError(`Field ${key} must be a valid bounded number.`);
  }
  return value;
}

function decimalField(record: Record<string, unknown>, key: string, required: boolean, minimum: number, maximum: number): number | undefined {
  if (!(key in record)) {
    if (required) throw new AdminCatalogInputError(`Field ${key} is required.`);
    return undefined;
  }
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new AdminCatalogInputError(`Field ${key} must be a valid bounded number.`);
  }
  return value;
}

function booleanField(record: Record<string, unknown>, key: string, required: boolean): boolean | undefined {
  if (!(key in record)) {
    if (required) throw new AdminCatalogInputError(`Field ${key} is required.`);
    return undefined;
  }
  if (typeof record[key] !== "boolean") {
    throw new AdminCatalogInputError(`Field ${key} must be boolean.`);
  }
  return record[key] as boolean;
}

function arrayField(record: Record<string, unknown>, key: string): string[] | undefined {
  if (!(key in record)) return undefined;
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new AdminCatalogInputError(`Field ${key} must be an array of non-empty strings.`);
  }
  return value.map((item) => (item as string).trim());
}

function validateSubjectInput(input: unknown, update: boolean): Record<string, unknown> {
  const record = inputRecord(input);
  assertAllowedKeys(record, ["slug", "name", "category", "faculty_group", "color_theme"]);
  if (!update && Object.keys(record).length !== 5) {
    throw new AdminCatalogInputError("All subject fields are required.");
  }
  const payload: Record<string, unknown> = {};
  if ("slug" in record) {
    const slug = requiredString(record, "slug", 150);
    if (!isValidCatalogSlug(slug)) throw new AdminCatalogInputError("Field slug has an invalid format.");
    payload.slug = slug;
  }
  if ("name" in record) payload.name = requiredString(record, "name", 150);
  if ("category" in record) payload.category = requiredString(record, "category", 100);
  if ("faculty_group" in record) payload.faculty_group = requiredString(record, "faculty_group", 150);
  if ("color_theme" in record) payload.color_theme = requiredString(record, "color_theme", 50);
  if (update && Object.keys(payload).length === 0) throw new AdminCatalogInputError("At least one subject field is required.");
  return payload;
}

function validateProductInput(input: unknown, update: boolean, allowEmptyUpdate = false): Record<string, unknown> {
  const record = inputRecord(input);
  assertAllowedKeys(record, PRODUCT_INPUT_KEYS);
  if (!update && ["slug", "title", "description", "subject_id", "category", "delivery_kind", "price_vnd", "is_contact_for_price", "color_theme"].some((key) => !(key in record))) {
    throw new AdminCatalogInputError("Required product fields are missing.");
  }
  const payload: Record<string, unknown> = {};
  if ("slug" in record) {
    const slug = requiredString(record, "slug", 150);
    if (!isValidCatalogSlug(slug)) throw new AdminCatalogInputError("Field slug has an invalid format.");
    payload.slug = slug;
  }
  if ("title" in record) payload.title = requiredString(record, "title", 250);
  if ("description" in record) payload.description = requiredString(record, "description", 5000);
  const subjectId = uuidField(record, "subject_id", !update);
  if (subjectId !== undefined) payload.subject_id = subjectId;
  if ("category" in record) payload.category = requiredString(record, "category", 100);
  const deliveryKind = enumString(record, "delivery_kind", DELIVERY_KINDS, !update);
  if (deliveryKind !== undefined) payload.delivery_kind = deliveryKind;
  const publicationStatus = enumString(record, "publication_status", PUBLICATION_STATUSES, false);
  if (publicationStatus !== undefined) payload.publication_status = publicationStatus;
  if ("price_vnd" in record) {
    const price = record.price_vnd;
    if (price !== null && (typeof price !== "number" || !Number.isSafeInteger(price) || price < 0)) {
      throw new AdminCatalogInputError("Field price_vnd must be null or a non-negative integer.");
    }
    payload.price_vnd = price;
  }
  if ("old_price_vnd" in record) {
    const oldPrice = record.old_price_vnd;
    if (oldPrice !== null && (typeof oldPrice !== "number" || !Number.isSafeInteger(oldPrice) || oldPrice < 0)) {
      throw new AdminCatalogInputError("Field old_price_vnd must be null or a non-negative integer.");
    }
    payload.old_price_vnd = oldPrice;
  }
  const contact = booleanField(record, "is_contact_for_price", !update);
  if (contact !== undefined) payload.is_contact_for_price = contact;
  const rating = decimalField(record, "rating", false, 1, 5);
  if (rating !== undefined) payload.rating = rating;
  const isHot = booleanField(record, "is_hot", false);
  if (isHot !== undefined) payload.is_hot = isHot;
  if ("color_theme" in record) payload.color_theme = requiredString(record, "color_theme", 50);
  if ("price_vnd" in record && "is_contact_for_price" in record) {
    if (record.is_contact_for_price === true && record.price_vnd !== null) {
      throw new AdminCatalogInputError("Contact-price products must not have a price.");
    }
    if (record.is_contact_for_price === false && record.price_vnd === null) {
      throw new AdminCatalogInputError("Priced products require a price.");
    }
  }
  if (update && !allowEmptyUpdate && Object.keys(payload).length === 0) throw new AdminCatalogInputError("At least one product field is required.");
  return payload;
}

function productOnlyRecord(record: Record<string, unknown>): Record<string, unknown> {
  const product: Record<string, unknown> = {};
  for (const key of PRODUCT_INPUT_KEYS) {
    if (key in record) product[key] = record[key];
  }
  return product;
}

function validateMaterialInput(input: unknown, update: boolean): { product: Record<string, unknown>; child: Record<string, unknown> } {
  const record = inputRecord(input);
  assertAllowedKeys(record, [...PRODUCT_INPUT_KEYS, "pages", "tags", "includes", "suitable_for"]);
  const product = validateProductInput(productOnlyRecord(record), update, true);
  const child: Record<string, unknown> = {};
  if (!update && !("pages" in record)) throw new AdminCatalogInputError("Field pages is required.");
  const pages = numberField(record, "pages", !update, 1);
  if (pages !== undefined) child.pages = pages;
  for (const key of ["tags", "includes", "suitable_for"] as const) {
    const values = arrayField(record, key);
    if (values !== undefined) child[key] = values;
  }
  if (update && Object.keys(product).length === 0 && Object.keys(child).length === 0) throw new AdminCatalogInputError("At least one material field is required.");
  return { product, child };
}

function validateCourseInput(input: unknown, update: boolean): { product: Record<string, unknown>; child: Record<string, unknown> } {
  const record = inputRecord(input);
  assertAllowedKeys(record, [...PRODUCT_INPUT_KEYS, "format", "sessions", "duration", "schedule", "enrollment_status", "mentor", "tags", "curriculum", "suitable_for", "preparation"]);
  const product = validateProductInput(productOnlyRecord(record), update, true);
  const child: Record<string, unknown> = {};
  for (const key of ["format", "sessions", "duration", "schedule", "mentor"] as const) {
    if (!update && !(key in record)) throw new AdminCatalogInputError(`Field ${key} is required.`);
  }
  const format = enumString(record, "format", COURSE_FORMATS, !update);
  if (format !== undefined) child.format = format;
  const sessions = numberField(record, "sessions", !update, 1);
  if (sessions !== undefined) child.sessions = sessions;
  for (const key of ["duration", "schedule", "mentor"] as const) {
    const value = optionalString(record, key, 500);
    if (value !== undefined) child[key] = value;
  }
  const enrollmentStatus = enumString(record, "enrollment_status", ENROLLMENT_STATUSES, false);
  if (enrollmentStatus !== undefined) child.enrollment_status = enrollmentStatus;
  for (const key of ["tags", "curriculum", "suitable_for", "preparation"] as const) {
    const values = arrayField(record, key);
    if (values !== undefined) child[key] = values;
  }
  if (update && Object.keys(product).length === 0 && Object.keys(child).length === 0) throw new AdminCatalogInputError("At least one course field is required.");
  return { product, child };
}

function validateTutorInput(input: unknown, update: boolean): { product: Record<string, unknown>; child: Record<string, unknown> } {
  const record = inputRecord(input);
  assertAllowedKeys(record, [...PRODUCT_INPUT_KEYS, "name", "faculty", "format", "availability", "short_bio", "strengths", "tags", "suitable_for", "support_methods"]);
  const product = validateProductInput(productOnlyRecord(record), update, true);
  const child: Record<string, unknown> = {};
  for (const key of ["name", "faculty", "format", "availability", "short_bio"] as const) {
    if (!update && !(key in record)) throw new AdminCatalogInputError(`Field ${key} is required.`);
    const value = optionalString(record, key, key === "short_bio" ? 5000 : 500);
    if (value !== undefined) child[key] = value;
  }
  for (const key of ["strengths", "tags", "suitable_for", "support_methods"] as const) {
    const values = arrayField(record, key);
    if (values !== undefined) child[key] = values;
  }
  if (update && Object.keys(product).length === 0 && Object.keys(child).length === 0) throw new AdminCatalogInputError("At least one tutor field is required.");
  return { product, child };
}

function validateListOptions(options: ListAdminCatalogOptions | undefined): { search?: string; status?: PublicationStatus; limit: number; offset: number } {
  if (options === undefined) return { limit: DEFAULT_ADMIN_CATALOG_PAGE_LIMIT, offset: 0 };
  const record = inputRecord(options);
  assertAllowedKeys(record, ["search", "publication_status", "limit", "offset"]);
  let search: string | undefined;
  if ("search" in record) {
    if (typeof record.search !== "string") throw new AdminCatalogInputError("Search must be a string.");
    const cleaned = record.search.trim().slice(0, MAX_ADMIN_CATALOG_SEARCH_LENGTH).replace(/[,()"\\%_*]/g, " ").trim();
    if (cleaned) search = cleaned;
  }
  const status = enumString(record, "publication_status", PUBLICATION_STATUSES, false);
  const limit = record.limit === undefined ? DEFAULT_ADMIN_CATALOG_PAGE_LIMIT : record.limit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > MAX_ADMIN_CATALOG_PAGE_LIMIT) {
    throw new AdminCatalogInputError("Limit must be a bounded positive integer.");
  }
  const offset = record.offset === undefined ? 0 : record.offset;
  if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0) {
    throw new AdminCatalogInputError("Offset must be a non-negative integer.");
  }
  return { search, status, limit, offset };
}

async function adminClient(): Promise<AdminCatalogClient> {
  try {
    return (await createClient()) as unknown as AdminCatalogClient;
  } catch {
    throw new AdminCatalogRepositoryError("Failed to connect to the catalog database.");
  }
}

function repositoryFailure(message: string): never {
  throw new AdminCatalogRepositoryError(message);
}

function rows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

async function listProducts<T>(
  kind: ProductRow["kind"],
  selectColumns: string,
  options: ListAdminCatalogOptions | undefined,
  message: string
): Promise<T[]> {
  const validated = validateListOptions(options);
  try {
    const client = await adminClient();
    let query = client.from("products").select(selectColumns).eq("kind", kind);
    if (validated.status !== undefined) query = query.eq("publication_status", validated.status);
    if (validated.search !== undefined) query = query.or(`slug.ilike.%${validated.search}%,title.ilike.%${validated.search}%`);
    const result = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(validated.offset, validated.offset + validated.limit - 1);
    if (result.error) repositoryFailure(message);
    return rows<T>(result.data);
  } catch (error) {
    if (error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError(message);
  }
}

async function getProduct<T>(id: string, kind: ProductRow["kind"], selectColumns: string, message: string): Promise<T | null> {
  if (!isValidUuid(id)) throw new AdminCatalogInputError("Catalog ID must be a valid UUID.");
  try {
    const client = await adminClient();
    const result = await client.from("products").select(selectColumns).eq("id", id).eq("kind", kind).maybeSingle();
    if (result.error) repositoryFailure(message);
    return (result.data as T | null) ?? null;
  } catch (error) {
    if (error instanceof AdminCatalogInputError || error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError(message);
  }
}

async function insertProduct<T>(kind: ProductRow["kind"], product: Record<string, unknown>, childTable: string, child: Record<string, unknown>, childColumns: string, selectColumns: string, message: string): Promise<T> {
  try {
    const client = await adminClient();
    const productResult = await client.from("products").insert({ ...product, kind }).select(PRODUCT_SELECT_COLUMNS).maybeSingle();
    if (productResult.error || !productResult.data) repositoryFailure(message);
    const productRow = productResult.data as ProductRow;
    const childResult = await client.from(childTable).insert({ ...child, product_id: productRow.id }).select(childColumns).maybeSingle();
    if (childResult.error || !childResult.data) repositoryFailure(message);
    return { ...productRow, [childTable]: childResult.data } as T;
  } catch (error) {
    if (error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError(message);
  }
}

async function updateProduct<T>(id: string, kind: ProductRow["kind"], product: Record<string, unknown>, childTable: string, child: Record<string, unknown>, childColumns: string, selectColumns: string, message: string): Promise<T | null> {
  if (!isValidUuid(id)) throw new AdminCatalogInputError("Catalog ID must be a valid UUID.");
  try {
    const client = await adminClient();
    let productRow: ProductRow | null = null;
    let childRow: unknown = null;
    if (Object.keys(product).length > 0) {
      const result = await client.from("products").update(product).eq("id", id).eq("kind", kind).select(PRODUCT_SELECT_COLUMNS).maybeSingle();
      if (result.error) repositoryFailure(message);
      if (!result.data) return null;
      productRow = result.data as ProductRow;
    }
    if (Object.keys(child).length > 0) {
      const result = await client.from(childTable).update(child).eq("product_id", id).select(childColumns).maybeSingle();
      if (result.error) repositoryFailure(message);
      if (!result.data) return null;
      childRow = result.data;
    }
    if (productRow && childRow) return { ...productRow, [childTable]: childRow } as T;
    return await getProduct<T>(id, kind, selectColumns, message);
  } catch (error) {
    if (error instanceof AdminCatalogInputError || error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError(message);
  }
}

async function deleteProduct(id: string, kind: ProductRow["kind"], message: string): Promise<boolean> {
  if (!isValidUuid(id)) throw new AdminCatalogInputError("Catalog ID must be a valid UUID.");
  try {
    const client = await adminClient();
    const result = await client.from("products").delete().eq("id", id).eq("kind", kind).select("id").maybeSingle();
    if (result.error) repositoryFailure(message);
    return Boolean(result.data);
  } catch (error) {
    if (error instanceof AdminCatalogInputError || error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError(message);
  }
}

export async function listAdminSubjects(options?: ListAdminCatalogOptions): Promise<AdminSubject[]> {
  const validated = validateListOptions(options);
  try {
    const client = await adminClient();
    let query = client.from("subjects").select(SUBJECT_SELECT_COLUMNS);
    if (validated.search !== undefined) query = query.or(`slug.ilike.%${validated.search}%,name.ilike.%${validated.search}%`);
    const result = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(validated.offset, validated.offset + validated.limit - 1);
    if (result.error) repositoryFailure("Failed to list admin subjects.");
    return rows<AdminSubject>(result.data);
  } catch (error) {
    if (error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError("Failed to list admin subjects.");
  }
}

export async function getAdminSubjectById(id: string): Promise<AdminSubject | null> {
  if (!isValidUuid(id)) throw new AdminCatalogInputError("Subject ID must be a valid UUID.");
  try {
    const client = await adminClient();
    const result = await client.from("subjects").select(SUBJECT_SELECT_COLUMNS).eq("id", id).maybeSingle();
    if (result.error) repositoryFailure("Failed to retrieve admin subject.");
    return (result.data as AdminSubject | null) ?? null;
  } catch (error) {
    if (error instanceof AdminCatalogInputError || error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError("Failed to retrieve admin subject.");
  }
}

export async function createAdminSubject(input: CreateAdminSubjectInput): Promise<AdminSubject> {
  const payload = validateSubjectInput(input, false) as SubjectInsert as Record<string, unknown>;
  try {
    const client = await adminClient();
    const result = await client.from("subjects").insert(payload).select(SUBJECT_SELECT_COLUMNS).maybeSingle();
    if (result.error || !result.data) repositoryFailure("Failed to create admin subject.");
    return result.data as AdminSubject;
  } catch (error) {
    if (error instanceof AdminCatalogInputError || error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError("Failed to create admin subject.");
  }
}

export async function updateAdminSubject(id: string, input: UpdateAdminSubjectInput): Promise<AdminSubject | null> {
  if (!isValidUuid(id)) throw new AdminCatalogInputError("Subject ID must be a valid UUID.");
  const payload = validateSubjectInput(input, true);
  try {
    const client = await adminClient();
    const result = await client.from("subjects").update(payload).eq("id", id).select(SUBJECT_SELECT_COLUMNS).maybeSingle();
    if (result.error) repositoryFailure("Failed to update admin subject.");
    return (result.data as AdminSubject | null) ?? null;
  } catch (error) {
    if (error instanceof AdminCatalogInputError || error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError("Failed to update admin subject.");
  }
}

export async function deleteAdminSubject(id: string): Promise<boolean> {
  if (!isValidUuid(id)) throw new AdminCatalogInputError("Subject ID must be a valid UUID.");
  try {
    const client = await adminClient();
    const result = await client.from("subjects").delete().eq("id", id).select("id").maybeSingle();
    if (result.error) repositoryFailure("Failed to delete admin subject.");
    return Boolean(result.data);
  } catch (error) {
    if (error instanceof AdminCatalogInputError || error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError("Failed to delete admin subject.");
  }
}

export async function listAdminMaterials(options?: ListAdminCatalogOptions): Promise<AdminMaterial[]> {
  return listProducts<AdminMaterial>("material", MATERIAL_SELECT_COLUMNS, options, "Failed to list admin materials.");
}

export async function getAdminMaterialById(id: string): Promise<AdminMaterial | null> {
  return getProduct<AdminMaterial>(id, "material", MATERIAL_SELECT_COLUMNS, "Failed to retrieve admin material.");
}

export async function createAdminMaterial(input: CreateAdminMaterialInput): Promise<AdminMaterial> {
  const validated = validateMaterialInput(input, false);
  return insertProduct<AdminMaterial>("material", validated.product, "materials", validated.child, MATERIAL_COLUMNS.join(", "), MATERIAL_SELECT_COLUMNS, "Failed to create admin material.");
}

export async function updateAdminMaterial(id: string, input: UpdateAdminMaterialInput): Promise<AdminMaterial | null> {
  const validated = validateMaterialInput(input, true);
  return updateProduct<AdminMaterial>(id, "material", validated.product, "materials", validated.child, MATERIAL_COLUMNS.join(", "), MATERIAL_SELECT_COLUMNS, "Failed to update admin material.");
}

export async function deleteAdminMaterial(id: string): Promise<boolean> {
  return deleteProduct(id, "material", "Failed to delete admin material.");
}

export async function listAdminCourses(options?: ListAdminCatalogOptions): Promise<AdminCourse[]> {
  return listProducts<AdminCourse>("course", COURSE_SELECT_COLUMNS, options, "Failed to list admin courses.");
}

export async function getAdminCourseById(id: string): Promise<AdminCourse | null> {
  return getProduct<AdminCourse>(id, "course", COURSE_SELECT_COLUMNS, "Failed to retrieve admin course.");
}

export async function createAdminCourse(input: CreateAdminCourseInput): Promise<AdminCourse> {
  const validated = validateCourseInput(input, false);
  return insertProduct<AdminCourse>("course", validated.product, "courses", validated.child, COURSE_COLUMNS.join(", "), COURSE_SELECT_COLUMNS, "Failed to create admin course.");
}

export async function updateAdminCourse(id: string, input: UpdateAdminCourseInput): Promise<AdminCourse | null> {
  const validated = validateCourseInput(input, true);
  return updateProduct<AdminCourse>(id, "course", validated.product, "courses", validated.child, COURSE_COLUMNS.join(", "), COURSE_SELECT_COLUMNS, "Failed to update admin course.");
}

export async function deleteAdminCourse(id: string): Promise<boolean> {
  return deleteProduct(id, "course", "Failed to delete admin course.");
}

export async function listAdminTutors(options?: ListAdminCatalogOptions): Promise<AdminTutor[]> {
  return listProducts<AdminTutor>("tutor", TUTOR_SELECT_COLUMNS, options, "Failed to list admin tutors.");
}

export async function getAdminTutorById(id: string): Promise<AdminTutor | null> {
  return getProduct<AdminTutor>(id, "tutor", TUTOR_SELECT_COLUMNS, "Failed to retrieve admin tutor.");
}

export async function createAdminTutor(input: CreateAdminTutorInput): Promise<AdminTutor> {
  const validated = validateTutorInput(input, false);
  return insertProduct<AdminTutor>("tutor", validated.product, "tutors", validated.child, TUTOR_COLUMNS.join(", "), TUTOR_SELECT_COLUMNS, "Failed to create admin tutor.");
}

export async function updateAdminTutor(id: string, input: UpdateAdminTutorInput): Promise<AdminTutor | null> {
  const validated = validateTutorInput(input, true);
  return updateProduct<AdminTutor>(id, "tutor", validated.product, "tutors", validated.child, TUTOR_COLUMNS.join(", "), TUTOR_SELECT_COLUMNS, "Failed to update admin tutor.");
}

export async function deleteAdminTutor(id: string): Promise<boolean> {
  return deleteProduct(id, "tutor", "Failed to delete admin tutor.");
}

// Short aliases keep the repository convenient for future server actions while
// retaining the explicit admin-prefixed API used by the foundation tests.
export const listSubjects = listAdminSubjects;
export const getSubjectById = getAdminSubjectById;
export const createSubject = createAdminSubject;
export const updateSubject = updateAdminSubject;
export const deleteSubject = deleteAdminSubject;
export const listMaterials = listAdminMaterials;
export const getMaterialById = getAdminMaterialById;
export const createMaterial = createAdminMaterial;
export const updateMaterial = updateAdminMaterial;
export const deleteMaterial = deleteAdminMaterial;
export const listCourses = listAdminCourses;
export const getCourseById = getAdminCourseById;
export const createCourse = createAdminCourse;
export const updateCourse = updateAdminCourse;
export const deleteCourse = deleteAdminCourse;
export const listTutors = listAdminTutors;
export const getTutorById = getAdminTutorById;
export const createTutor = createAdminTutor;
export const updateTutor = updateAdminTutor;
export const deleteTutor = deleteAdminTutor;
