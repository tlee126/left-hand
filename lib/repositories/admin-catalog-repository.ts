import { createClient } from "@/lib/supabase/server";
import type {
  AdminCatalogCreateCoursePayload,
  AdminCatalogCreateMaterialPayload,
  AdminCatalogCreateProductPayload,
  AdminCatalogCreateTutorPayload,
  AdminCatalogTutorSubjectAssociation,
  AdminMaterialAtomicMutateArgs,
  AdminCatalogMutateArgs,
  Database
} from "@/lib/supabase/database.types";
import { CATEGORIES, COLOR_THEMES, CATEGORY_THEME_MAP } from "@/lib/domain/subjects";
import {
  COURSE_FORMATS,
  DELIVERY_KINDS,
  ENROLLMENT_STATUSES,
  isCategory,
  isColorTheme,
  isCourseFormat,
  isDeliveryKind,
  isEnrollmentStatus,
  isProductKind,
  isPublicationStatus,
  isTutorFormat,
  PUBLICATION_STATUSES,
  TUTOR_FORMATS,
  isValidVND
} from "@/lib/domain/product-types";
import { isUuid } from "@/lib/domain/identifiers";
import { expectedDeliveryKind } from "@/lib/domain/product-types";

type Tables = Database["public"]["Tables"];
type SubjectRow = Tables["subjects"]["Row"];
type ProductRow = Tables["products"]["Row"];
type MaterialRow = Tables["materials"]["Row"];
type CourseRow = Tables["courses"]["Row"];
type TutorRow = Tables["tutors"]["Row"];
type AdminCatalogClient = Awaited<ReturnType<typeof createClient>>;
type InputObject = object;
type SubjectProjection = Omit<SubjectRow, "search_document">;
type ProductProjection = Omit<ProductRow, "search_document">;

type SubjectMutationPayload = {
  slug?: string;
  name?: string;
  category?: CatalogCategory;
  faculty_group?: string;
  color_theme?: CatalogColorTheme;
};

type ProductMutationPayload = {
  slug?: string;
  title?: string;
  description?: string;
  subject_id?: string;
  category?: CatalogCategory;
  delivery_kind?: DeliveryKind;
  publication_status?: PublicationStatus;
  price_vnd?: number | null;
  old_price_vnd?: number | null;
  is_contact_for_price?: boolean;
  rating?: number;
  is_hot?: boolean;
  color_theme?: CatalogColorTheme;
};

type MaterialMutationPayload = {
  pages?: number;
  tags?: string[];
  includes?: string[];
  suitable_for?: string[];
  allow_download?: boolean;
};

type CourseMutationPayload = {
  format?: CourseFormat;
  sessions?: number;
  duration?: string;
  schedule?: string;
  enrollment_status?: EnrollmentStatus;
  mentor?: string;
  tags?: string[];
  curriculum?: string[];
  suitable_for?: string[];
  preparation?: string[];
};

type TutorMutationPayload = {
  name?: string;
  faculty?: string;
  format?: (typeof TUTOR_FORMATS)[number];
  availability?: string;
  short_bio?: string;
  strengths?: string[];
  tags?: string[];
  suitable_for?: string[];
  support_methods?: string[];
  subject_associations?: AdminCatalogTutorSubjectAssociation[];
};

type ChildMutationPayload =
  | { kind: "material"; value: MaterialMutationPayload }
  | { kind: "course"; value: CourseMutationPayload }
  | { kind: "tutor"; value: TutorMutationPayload };
type AdminCatalogMutationOperation = "create" | "update";

export type CatalogCategory = Database["public"]["Enums"]["category_enum"];
export type CatalogColorTheme = Database["public"]["Enums"]["color_theme_enum"];
export type PublicationStatus = Database["public"]["Enums"]["publication_status_enum"];
export type DeliveryKind = Database["public"]["Enums"]["delivery_kind_enum"];
export type CourseFormat = Database["public"]["Enums"]["course_format_enum"];
export type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status_enum"];

export type AdminSubject = SubjectProjection;
export type AdminMaterial = ProductProjection & { materials: MaterialRow };
export type AdminCourse = ProductProjection & { courses: CourseRow };
export type AdminTutor = ProductProjection & { tutors: TutorRow };

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
  old_price_vnd: number | null;
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
  allow_download?: boolean;
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
  format: (typeof TUTOR_FORMATS)[number];
  availability: string;
  short_bio: string;
  strengths?: string[];
  tags?: string[];
  suitable_for?: string[];
  support_methods?: string[];
  subject_associations?: AdminCatalogTutorSubjectAssociation[];
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
  "allow_download",
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
export const MATERIAL_SELECT_COLUMNS = `${PRODUCT_SELECT_COLUMNS}, materials`;
export const COURSE_SELECT_COLUMNS = `${PRODUCT_SELECT_COLUMNS}, courses`;
export const TUTOR_SELECT_COLUMNS = `${PRODUCT_SELECT_COLUMNS}, tutors`;

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

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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

export function isValidUuid(value: unknown): value is string {
  return isUuid(value);
}

export function isValidCatalogSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG_REGEX.test(value);
}

function inputRecord(input: unknown): InputObject {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new AdminCatalogInputError("Input must be an object.");
  }
  return input;
}

function hasField(record: InputObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function fieldValue(record: InputObject, key: string): unknown {
  return Object.getOwnPropertyDescriptor(record, key)?.value;
}

function assertAllowedKeys(record: InputObject, allowed: readonly string[]): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new AdminCatalogInputError(`Field ${key} is not permitted.`);
    }
  }
}

function requiredString(record: InputObject, key: string, maxLength = 500): string {
  const value = fieldValue(record, key);
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new AdminCatalogInputError(`Field ${key} must be a non-empty bounded string.`);
  }
  return value.trim();
}

function optionalString(record: InputObject, key: string, maxLength = 500): string | undefined {
  if (!hasField(record, key)) return undefined;
  return requiredString(record, key, maxLength);
}

function enumString<T extends string>(record: InputObject, key: string, allowed: readonly T[], required: boolean): T | undefined {
  if (!hasField(record, key)) {
    if (required) throw new AdminCatalogInputError(`Field ${key} is required.`);
    return undefined;
  }
  const value = fieldValue(record, key);
  if (typeof value !== "string" || !allowed.some((candidate) => candidate === value)) {
    throw new AdminCatalogInputError(`Field ${key} has an invalid value.`);
  }
  const matched = allowed.find((candidate) => candidate === value);
  if (matched === undefined) throw new AdminCatalogInputError(`Field ${key} has an invalid value.`);
  return matched;
}

function uuidField(record: InputObject, key: string, required: boolean): string | undefined {
  if (!hasField(record, key)) {
    if (required) throw new AdminCatalogInputError(`Field ${key} is required.`);
    return undefined;
  }
  const value = fieldValue(record, key);
  if (!isValidUuid(value)) {
    throw new AdminCatalogInputError(`Field ${key} must be a valid UUID.`);
  }
  return value;
}

function numberField(record: InputObject, key: string, required: boolean, minimum?: number): number | undefined {
  if (!hasField(record, key)) {
    if (required) throw new AdminCatalogInputError(`Field ${key} is required.`);
    return undefined;
  }
  const value = fieldValue(record, key);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || (minimum !== undefined && value < minimum)) {
    throw new AdminCatalogInputError(`Field ${key} must be a valid bounded number.`);
  }
  return value;
}

function decimalField(record: InputObject, key: string, required: boolean, minimum: number, maximum: number): number | undefined {
  if (!hasField(record, key)) {
    if (required) throw new AdminCatalogInputError(`Field ${key} is required.`);
    return undefined;
  }
  const value = fieldValue(record, key);
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new AdminCatalogInputError(`Field ${key} must be a valid bounded number.`);
  }
  return value;
}

function booleanField(record: InputObject, key: string, required: boolean): boolean | undefined {
  if (!hasField(record, key)) {
    if (required) throw new AdminCatalogInputError(`Field ${key} is required.`);
    return undefined;
  }
  const value = fieldValue(record, key);
  if (typeof value !== "boolean") {
    throw new AdminCatalogInputError(`Field ${key} must be boolean.`);
  }
  return value;
}

function arrayField(record: InputObject, key: string): string[] | undefined {
  if (!hasField(record, key)) return undefined;
  const value = fieldValue(record, key);
  if (!Array.isArray(value)) {
    throw new AdminCatalogInputError(`Field ${key} must be an array of non-empty strings.`);
  }
  return value.map((item) => {
    if (typeof item !== "string" || item.trim().length === 0) throw new AdminCatalogInputError(`Field ${key} must be an array of non-empty strings.`);
    return item.trim();
  });
}

function subjectAssociationsField(record: InputObject, key: string, required: boolean): AdminCatalogTutorSubjectAssociation[] | undefined {
  if (!hasField(record, key)) {
    if (required) throw new AdminCatalogInputError("Tutor subject associations are required.");
    return undefined;
  }
  const value = fieldValue(record, key);
  if (!Array.isArray(value) || value.length === 0) throw new AdminCatalogInputError("Tutor subject associations are invalid.");
  const seen = new Set<string>();
  const associations = value.map((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) throw new AdminCatalogInputError("Tutor subject associations are invalid.");
    const keys = Object.keys(item);
    if (keys.length !== 2 || !keys.includes("subject_id") || !keys.includes("is_primary")) throw new AdminCatalogInputError("Tutor subject associations are invalid.");
    const subjectId = Object.getOwnPropertyDescriptor(item, "subject_id")?.value;
    const isPrimary = Object.getOwnPropertyDescriptor(item, "is_primary")?.value;
    if (!isUuid(subjectId) || typeof isPrimary !== "boolean" || seen.has(subjectId.toLowerCase())) throw new AdminCatalogInputError("Tutor subject associations are invalid.");
    seen.add(subjectId.toLowerCase());
    return { subject_id: subjectId, is_primary: isPrimary };
  });
  if (associations.filter((item) => item.is_primary).length !== 1) throw new AdminCatalogInputError("Exactly one tutor subject must be primary.");
  return associations;
}

function validateCategoryTheme(category: CatalogCategory | undefined, colorTheme: CatalogColorTheme | undefined, required: boolean): void {
  if (required && (category === undefined || colorTheme === undefined)) throw new AdminCatalogInputError("Category and color theme are required together.");
  if (category !== undefined || colorTheme !== undefined) {
    if (category === undefined || colorTheme === undefined || CATEGORY_THEME_MAP[category] !== colorTheme) throw new AdminCatalogInputError("Category and color theme are inconsistent.");
  }
}

function validateDelivery(kind: "material" | "course" | "tutor", product: ProductMutationPayload, format?: CourseFormat): void {
  if (product.delivery_kind === undefined) return;
  if (kind === "course" && format === undefined) throw new AdminCatalogInputError("Course delivery requires its format.");
  if (product.delivery_kind !== expectedDeliveryKind(kind, format)) throw new AdminCatalogInputError("Product delivery is inconsistent with its catalog kind.");
}

function validateSubjectInput(input: unknown, update: boolean): SubjectMutationPayload {
  const record = inputRecord(input);
  assertAllowedKeys(record, ["slug", "name", "category", "faculty_group", "color_theme"]);
  if (!update && Object.keys(record).length !== 5) {
    throw new AdminCatalogInputError("All subject fields are required.");
  }
  const payload: SubjectMutationPayload = {};
  if (hasField(record, "slug")) {
    const slug = requiredString(record, "slug", 150);
    if (!isValidCatalogSlug(slug)) throw new AdminCatalogInputError("Field slug has an invalid format.");
    payload.slug = slug;
  }
  if (hasField(record, "name")) payload.name = requiredString(record, "name", 150);
  const category = enumString(record, "category", CATEGORIES, false);
  if (category !== undefined) payload.category = category;
  if (hasField(record, "faculty_group")) payload.faculty_group = requiredString(record, "faculty_group", 150);
  const colorTheme = enumString(record, "color_theme", COLOR_THEMES, false);
  if (colorTheme !== undefined) payload.color_theme = colorTheme;
  validateCategoryTheme(category, colorTheme, !update);
  if (update && (hasField(record, "category") !== hasField(record, "color_theme"))) throw new AdminCatalogInputError("Category and color theme must be updated together.");
  if (update && Object.keys(payload).length === 0) throw new AdminCatalogInputError("At least one subject field is required.");
  return payload;
}

function validateProductInput(input: unknown, update: boolean, allowEmptyUpdate = false): ProductMutationPayload {
  const record = inputRecord(input);
  assertAllowedKeys(record, PRODUCT_INPUT_KEYS);
  if (!update && ["slug", "title", "description", "subject_id", "category", "delivery_kind", "price_vnd", "old_price_vnd", "is_contact_for_price", "color_theme"].some((key) => !hasField(record, key))) {
    throw new AdminCatalogInputError("Required product fields are missing.");
  }
  const payload: ProductMutationPayload = {};
  if (hasField(record, "slug")) {
    const slug = requiredString(record, "slug", 150);
    if (!isValidCatalogSlug(slug)) throw new AdminCatalogInputError("Field slug has an invalid format.");
    payload.slug = slug;
  }
  if (hasField(record, "title")) payload.title = requiredString(record, "title", 250);
  if (hasField(record, "description")) payload.description = requiredString(record, "description", 5000);
  const subjectId = uuidField(record, "subject_id", !update);
  if (subjectId !== undefined) payload.subject_id = subjectId;
  const category = enumString(record, "category", CATEGORIES, false);
  if (category !== undefined) payload.category = category;
  const deliveryKind = enumString(record, "delivery_kind", DELIVERY_KINDS, !update);
  if (deliveryKind !== undefined) payload.delivery_kind = deliveryKind;
  const publicationStatus = enumString(record, "publication_status", PUBLICATION_STATUSES, false);
  if (publicationStatus !== undefined) payload.publication_status = publicationStatus;
  if (hasField(record, "price_vnd")) {
    const price = fieldValue(record, "price_vnd");
    if (price !== null && !isValidVND(price)) {
      throw new AdminCatalogInputError("Field price_vnd must be null or a non-negative integer.");
    }
    payload.price_vnd = price;
  }
  if (hasField(record, "old_price_vnd")) {
    const oldPrice = fieldValue(record, "old_price_vnd");
    if (oldPrice !== null && !isValidVND(oldPrice)) {
      throw new AdminCatalogInputError("Field old_price_vnd must be null or a non-negative integer.");
    }
    payload.old_price_vnd = oldPrice;
  }
  const contactFlag = booleanField(record, "is_contact_for_price", !update);
  if (contactFlag !== undefined) payload.is_contact_for_price = contactFlag;
  const rating = decimalField(record, "rating", false, 1, 5);
  if (rating !== undefined) payload.rating = rating;
  const isHot = booleanField(record, "is_hot", false);
  if (isHot !== undefined) payload.is_hot = isHot;
  const colorTheme = enumString(record, "color_theme", COLOR_THEMES, false);
  if (colorTheme !== undefined) payload.color_theme = colorTheme;
  const price = fieldValue(record, "price_vnd");
  const oldPrice = fieldValue(record, "old_price_vnd");
  const contact = fieldValue(record, "is_contact_for_price");
  const hasAnyPricingField = hasField(record, "price_vnd") || hasField(record, "old_price_vnd") || hasField(record, "is_contact_for_price");
  const hasAllPricingFields = hasField(record, "price_vnd") && hasField(record, "old_price_vnd") && hasField(record, "is_contact_for_price");
  if (update && hasAnyPricingField && !hasAllPricingFields) {
    throw new AdminCatalogInputError("Price, original price, and contact flag must be updated together.");
  }
  if (hasAllPricingFields || (!update && hasField(record, "price_vnd") && hasField(record, "is_contact_for_price"))) {
    if (contact === true && (price !== null || oldPrice !== null)) {
      throw new AdminCatalogInputError("Contact-price products must not have a price.");
    }
    if (contact === false && (price === null || !isValidVND(price))) {
      throw new AdminCatalogInputError("Priced products require a price.");
    }
  }
  if (oldPrice !== null && oldPrice !== undefined && price !== null && price !== undefined &&
      isValidVND(oldPrice) && isValidVND(price) && oldPrice < price) {
    throw new AdminCatalogInputError("old_price_vnd must be greater than or equal to price_vnd.");
  }
  if (update && !allowEmptyUpdate && Object.keys(payload).length === 0) throw new AdminCatalogInputError("At least one product field is required.");
  return payload;
}

function productOnlyRecord(record: InputObject): InputObject {
  return {
    ...(hasField(record, "slug") ? { slug: fieldValue(record, "slug") } : {}),
    ...(hasField(record, "title") ? { title: fieldValue(record, "title") } : {}),
    ...(hasField(record, "description") ? { description: fieldValue(record, "description") } : {}),
    ...(hasField(record, "subject_id") ? { subject_id: fieldValue(record, "subject_id") } : {}),
    ...(hasField(record, "category") ? { category: fieldValue(record, "category") } : {}),
    ...(hasField(record, "delivery_kind") ? { delivery_kind: fieldValue(record, "delivery_kind") } : {}),
    ...(hasField(record, "publication_status") ? { publication_status: fieldValue(record, "publication_status") } : {}),
    ...(hasField(record, "price_vnd") ? { price_vnd: fieldValue(record, "price_vnd") } : {}),
    ...(hasField(record, "old_price_vnd") ? { old_price_vnd: fieldValue(record, "old_price_vnd") } : {}),
    ...(hasField(record, "is_contact_for_price") ? { is_contact_for_price: fieldValue(record, "is_contact_for_price") } : {}),
    ...(hasField(record, "rating") ? { rating: fieldValue(record, "rating") } : {}),
    ...(hasField(record, "is_hot") ? { is_hot: fieldValue(record, "is_hot") } : {}),
    ...(hasField(record, "color_theme") ? { color_theme: fieldValue(record, "color_theme") } : {})
  };
}

function validateMaterialInput(input: unknown, update: boolean): { product: ProductMutationPayload; child: ChildMutationPayload } {
  const record = inputRecord(input);
  assertAllowedKeys(record, [...PRODUCT_INPUT_KEYS, "pages", "tags", "includes", "suitable_for", "allow_download"]);
  const product = validateProductInput(productOnlyRecord(record), update, true);
  validateDelivery("material", product);
  const child: MaterialMutationPayload = {};
  if (!update && !hasField(record, "pages")) throw new AdminCatalogInputError("Field pages is required.");
  const pages = numberField(record, "pages", !update, 1);
  if (pages !== undefined) child.pages = pages;
  for (const key of ["tags", "includes", "suitable_for"] as const) {
    const values = arrayField(record, key);
    if (values !== undefined) child[key] = values;
  }
  const allowDownload = booleanField(record, "allow_download", false);
  if (allowDownload !== undefined) child.allow_download = allowDownload;
  if (update && Object.keys(product).length === 0 && Object.keys(child).length === 0) throw new AdminCatalogInputError("At least one material field is required.");
  return { product, child: { kind: "material", value: child } };
}

function validateCourseInput(input: unknown, update: boolean): { product: ProductMutationPayload; child: ChildMutationPayload } {
  const record = inputRecord(input);
  assertAllowedKeys(record, [...PRODUCT_INPUT_KEYS, "format", "sessions", "duration", "schedule", "enrollment_status", "mentor", "tags", "curriculum", "suitable_for", "preparation"]);
  const product = validateProductInput(productOnlyRecord(record), update, true);
  const child: CourseMutationPayload = {};
  for (const key of ["format", "sessions", "duration", "schedule", "mentor"] as const) {
    if (!update && !hasField(record, key)) throw new AdminCatalogInputError(`Field ${key} is required.`);
  }
  const format = enumString(record, "format", COURSE_FORMATS, !update);
  if (format !== undefined) child.format = format;
  if (product.delivery_kind !== undefined || format !== undefined) {
    if (product.delivery_kind === undefined || format === undefined) throw new AdminCatalogInputError("Course delivery and format must be updated together.");
    validateDelivery("course", product, format);
  }
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
  return { product, child: { kind: "course", value: child } };
}

function validateTutorInput(input: unknown, update: boolean): { product: ProductMutationPayload; child: ChildMutationPayload } {
  const record = inputRecord(input);
  assertAllowedKeys(record, [...PRODUCT_INPUT_KEYS, "name", "faculty", "format", "availability", "short_bio", "strengths", "tags", "suitable_for", "support_methods", "subject_associations"]);
  const product = validateProductInput(productOnlyRecord(record), update, true);
  const child: TutorMutationPayload = {};
  const format = enumString(record, "format", TUTOR_FORMATS, !update);
  if (format !== undefined) child.format = format;
  validateDelivery("tutor", product);
  for (const key of ["name", "faculty", "availability", "short_bio"] as const) {
    if (!update && !hasField(record, key)) throw new AdminCatalogInputError(`Field ${key} is required.`);
    const value = optionalString(record, key, key === "short_bio" ? 5000 : 500);
    if (value !== undefined) child[key] = value;
  }
  for (const key of ["strengths", "tags", "suitable_for", "support_methods"] as const) {
    const values = arrayField(record, key);
    if (values !== undefined) child[key] = values;
  }
  const associations = subjectAssociationsField(record, "subject_associations", false);
  if (associations !== undefined) {
    if (product.subject_id !== undefined && associations.find((item) => item.is_primary)?.subject_id.toLowerCase() !== product.subject_id.toLowerCase()) {
      throw new AdminCatalogInputError("Tutor primary subject must match the product subject.");
    }
    child.subject_associations = associations;
  } else if (!update) {
    if (product.subject_id === undefined) throw new AdminCatalogInputError("Tutor subject is required.");
    child.subject_associations = [{ subject_id: product.subject_id, is_primary: true }];
  }
  if (update && Object.keys(product).length === 0 && Object.keys(child).length === 0) throw new AdminCatalogInputError("At least one tutor field is required.");
  return { product, child: { kind: "tutor", value: child } };
}

function validateListOptions(options: ListAdminCatalogOptions | undefined): { search?: string; status?: PublicationStatus; limit: number; offset: number } {
  if (options === undefined) return { limit: DEFAULT_ADMIN_CATALOG_PAGE_LIMIT, offset: 0 };
  const record = inputRecord(options);
  assertAllowedKeys(record, ["search", "publication_status", "limit", "offset"]);
  let search: string | undefined;
  if (hasField(record, "search")) {
    const rawSearch = fieldValue(record, "search");
    if (typeof rawSearch !== "string") throw new AdminCatalogInputError("Search must be a string.");
    const cleaned = rawSearch.trim().slice(0, MAX_ADMIN_CATALOG_SEARCH_LENGTH).replace(/[,()"\\%_*]/g, " ").trim();
    if (cleaned) search = cleaned;
  }
  const status = enumString(record, "publication_status", PUBLICATION_STATUSES, false);
  const rawLimit = fieldValue(record, "limit");
  const limit = rawLimit === undefined ? DEFAULT_ADMIN_CATALOG_PAGE_LIMIT : rawLimit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > MAX_ADMIN_CATALOG_PAGE_LIMIT) {
    throw new AdminCatalogInputError("Limit must be a bounded positive integer.");
  }
  const rawOffset = fieldValue(record, "offset");
  const offset = rawOffset === undefined ? 0 : rawOffset;
  if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0) {
    throw new AdminCatalogInputError("Offset must be a non-negative integer.");
  }
  return { search, status, limit, offset };
}

async function adminClient(): Promise<AdminCatalogClient> {
  try {
    return await createClient();
  } catch {
    throw new AdminCatalogRepositoryError("Failed to connect to the catalog database.");
  }
}

function repositoryFailure(message: string): never {
  throw new AdminCatalogRepositoryError(message);
}

function rows<T>(data: unknown, guard: (value: unknown) => value is T): T[] {
  return Array.isArray(data) ? data.filter(guard) : [];
}

function objectValue(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

function compactPayload<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0 && item.trim() === item);
}

function isAdminPricing(value: unknown): boolean {
  const price = objectValue(value, "price_vnd");
  const oldPrice = objectValue(value, "old_price_vnd");
  const contact = objectValue(value, "is_contact_for_price");
  if (typeof contact !== "boolean") return false;
  if (contact) return price === null && oldPrice === null;
  return isValidVND(price) && (oldPrice === null || (isValidVND(oldPrice) && oldPrice >= price));
}

function isAdminSubject(value: unknown): value is AdminSubject {
  return isValidUuid(objectValue(value, "id"))
    && isValidCatalogSlug(objectValue(value, "slug"))
    && typeof objectValue(value, "name") === "string"
    && typeof objectValue(value, "faculty_group") === "string"
    && isCategory(objectValue(value, "category"))
    && isColorTheme(objectValue(value, "color_theme"))
    && typeof objectValue(value, "created_at") === "string"
    && typeof objectValue(value, "updated_at") === "string";
}

function isAdminProduct(value: unknown): value is ProductProjection {
  const price = objectValue(value, "price_vnd");
  const oldPrice = objectValue(value, "old_price_vnd");
  return isValidUuid(objectValue(value, "id"))
    && isValidCatalogSlug(objectValue(value, "slug"))
    && isProductKind(objectValue(value, "kind"))
    && typeof objectValue(value, "title") === "string"
    && typeof objectValue(value, "description") === "string"
    && isValidUuid(objectValue(value, "subject_id"))
    && isCategory(objectValue(value, "category"))
    && isDeliveryKind(objectValue(value, "delivery_kind"))
    && isPublicationStatus(objectValue(value, "publication_status"))
    && (price === null || isValidVND(price))
    && (oldPrice === null || isValidVND(oldPrice))
    && isAdminPricing(value)
    && typeof objectValue(value, "rating") === "number"
    && Number.isFinite(objectValue(value, "rating"))
    && Number(objectValue(value, "rating")) >= 1
    && Number(objectValue(value, "rating")) <= 5
    && typeof objectValue(value, "is_hot") === "boolean"
    && isColorTheme(objectValue(value, "color_theme"))
    && typeof objectValue(value, "created_at") === "string"
    && typeof objectValue(value, "updated_at") === "string";
}

function isMaterialChild(value: unknown): value is MaterialRow {
  return typeof objectValue(value, "product_id") === "string"
    && isValidUuid(objectValue(value, "product_id"))
    && Number.isInteger(objectValue(value, "pages"))
    && Number(objectValue(value, "pages")) > 0
    && isStringArray(objectValue(value, "tags"))
    && isStringArray(objectValue(value, "includes"))
    && isStringArray(objectValue(value, "suitable_for"))
    && typeof objectValue(value, "allow_download") === "boolean"
    && typeof objectValue(value, "created_at") === "string"
    && typeof objectValue(value, "updated_at") === "string";
}

function isCourseChild(value: unknown): value is CourseRow {
  return isValidUuid(objectValue(value, "product_id"))
    && isCourseFormat(objectValue(value, "format"))
    && Number.isInteger(objectValue(value, "sessions"))
    && Number(objectValue(value, "sessions")) > 0
    && typeof objectValue(value, "duration") === "string"
    && String(objectValue(value, "duration")).trim().length > 0
    && typeof objectValue(value, "schedule") === "string"
    && String(objectValue(value, "schedule")).trim().length > 0
    && isEnrollmentStatus(objectValue(value, "enrollment_status"))
    && typeof objectValue(value, "mentor") === "string"
    && String(objectValue(value, "mentor")).trim().length > 0
    && isStringArray(objectValue(value, "tags"))
    && isStringArray(objectValue(value, "curriculum"))
    && isStringArray(objectValue(value, "suitable_for"))
    && isStringArray(objectValue(value, "preparation"))
    && typeof objectValue(value, "created_at") === "string"
    && typeof objectValue(value, "updated_at") === "string";
}

function isTutorChild(value: unknown): value is TutorRow {
  return isValidUuid(objectValue(value, "product_id"))
    && typeof objectValue(value, "name") === "string"
    && String(objectValue(value, "name")).trim().length > 0
    && typeof objectValue(value, "faculty") === "string"
    && String(objectValue(value, "faculty")).trim().length > 0
    && isTutorFormat(objectValue(value, "format"))
    && typeof objectValue(value, "availability") === "string"
    && String(objectValue(value, "availability")).trim().length > 0
    && typeof objectValue(value, "short_bio") === "string"
    && String(objectValue(value, "short_bio")).trim().length > 0
    && isStringArray(objectValue(value, "strengths"))
    && isStringArray(objectValue(value, "tags"))
    && isStringArray(objectValue(value, "suitable_for"))
    && isStringArray(objectValue(value, "support_methods"))
    && typeof objectValue(value, "created_at") === "string"
    && typeof objectValue(value, "updated_at") === "string";
}

function isAdminMaterial(value: unknown): value is AdminMaterial {
  return isAdminProduct(value) && objectValue(value, "kind") === "material" && isMaterialChild(objectValue(value, "materials")) && objectValue(objectValue(value, "materials"), "product_id") === objectValue(value, "id");
}

function isAdminCourse(value: unknown): value is AdminCourse {
  return isAdminProduct(value) && objectValue(value, "kind") === "course" && isCourseChild(objectValue(value, "courses")) && objectValue(objectValue(value, "courses"), "product_id") === objectValue(value, "id");
}

function isAdminTutor(value: unknown): value is AdminTutor {
  return isAdminProduct(value) && objectValue(value, "kind") === "tutor" && isTutorChild(objectValue(value, "tutors")) && objectValue(objectValue(value, "tutors"), "product_id") === objectValue(value, "id");
}

async function listProducts<T>(
  kind: ProductRow["kind"],
  selectColumns: string,
  options: ListAdminCatalogOptions | undefined,
  guard: (value: unknown) => value is T,
  message: string
): Promise<T[]> {
  const validated = validateListOptions(options);
  try {
    const client = await adminClient();
    let query = client.from("admin_catalog_read_surface").select(selectColumns).eq("kind", kind);
    if (validated.status !== undefined) query = query.eq("publication_status", validated.status);
    if (validated.search !== undefined) query = query.or(`slug.ilike.%${validated.search}%,title.ilike.%${validated.search}%`);
    const result = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(validated.offset, validated.offset + validated.limit - 1);
    if (result.error) repositoryFailure(message);
    return rows(result.data, guard);
  } catch (error) {
    if (error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError(message);
  }
}

async function getProduct<T>(id: string, kind: ProductRow["kind"], selectColumns: string, guard: (value: unknown) => value is T, message: string): Promise<T | null> {
  if (!isValidUuid(id)) throw new AdminCatalogInputError("Catalog ID must be a valid UUID.");
  try {
    const client = await adminClient();
    return await getProductWithClient<T>(client, id, kind, selectColumns, guard, message);
  } catch (error) {
    if (error instanceof AdminCatalogInputError || error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError(message);
  }
}

async function getProductWithClient<T>(client: AdminCatalogClient, id: string, kind: ProductRow["kind"], selectColumns: string, guard: (value: unknown) => value is T, message: string): Promise<T | null> {
  const result = await client.from("admin_catalog_read_surface").select(selectColumns).eq("id", id).eq("kind", kind).maybeSingle();
  if (result.error) repositoryFailure(message);
  return result.data === null || result.data === undefined ? null : guard(result.data) ? result.data : repositoryFailure(message);
}

function mutationProductId(value: unknown, message: string): string {
  const product = objectValue(value, "product");
  const id = objectValue(product, "id");
  if (typeof id !== "string" || !isValidUuid(id)) repositoryFailure(message);
  return id;
}

async function callAtomicRpc(client: AdminCatalogClient, operation: AdminCatalogMutationOperation, id: string | undefined, product: ProductMutationPayload, child: ChildMutationPayload): Promise<QueryResult> {
  if (operation === "create") {
    if (product.slug === undefined || product.title === undefined || product.description === undefined || product.subject_id === undefined || product.category === undefined || product.delivery_kind === undefined || product.price_vnd === undefined || product.old_price_vnd === undefined || product.is_contact_for_price === undefined || product.color_theme === undefined) {
      throw new AdminCatalogInputError("Required product fields are missing.");
    }
    const createProduct: AdminCatalogCreateProductPayload = compactPayload({
      slug: product.slug,
      title: product.title,
      description: product.description,
      subject_id: product.subject_id,
      category: product.category,
      delivery_kind: product.delivery_kind,
      publication_status: product.publication_status,
      price_vnd: product.price_vnd,
      old_price_vnd: product.old_price_vnd,
      is_contact_for_price: product.is_contact_for_price,
      rating: product.rating,
      is_hot: product.is_hot,
      color_theme: product.color_theme
    });
    if (child.kind === "material") {
      if (child.value.pages === undefined) throw new AdminCatalogInputError("Field pages is required.");
      const createChild: AdminCatalogCreateMaterialPayload = compactPayload({ pages: child.value.pages, tags: child.value.tags, includes: child.value.includes, suitable_for: child.value.suitable_for, allow_download: child.value.allow_download });
      if (hasField(createChild, "allow_download")) {
        const args: AdminMaterialAtomicMutateArgs = { p_operation: "create", p_product: createProduct, p_material: createChild };
        return client.rpc("admin_material_mutate_atomic", args);
      }
      const args: AdminCatalogMutateArgs = { p_operation: "create", p_kind: "material", p_product: createProduct, p_child: createChild };
      return client.rpc("admin_catalog_mutate_v2", args);
    }
    if (child.kind === "course") {
      if (child.value.format === undefined || child.value.sessions === undefined || child.value.duration === undefined || child.value.schedule === undefined || child.value.mentor === undefined) throw new AdminCatalogInputError("Required course fields are missing.");
      const createChild: AdminCatalogCreateCoursePayload = compactPayload({ format: child.value.format, sessions: child.value.sessions, duration: child.value.duration, schedule: child.value.schedule, enrollment_status: child.value.enrollment_status, mentor: child.value.mentor, tags: child.value.tags, curriculum: child.value.curriculum, suitable_for: child.value.suitable_for, preparation: child.value.preparation });
      const args: AdminCatalogMutateArgs = { p_operation: "create", p_kind: "course", p_product: createProduct, p_child: createChild };
      return client.rpc("admin_catalog_mutate_v2", args);
    }
    if (child.value.name === undefined || child.value.faculty === undefined || child.value.format === undefined || child.value.availability === undefined || child.value.short_bio === undefined) throw new AdminCatalogInputError("Required tutor fields are missing.");
    const createChild: AdminCatalogCreateTutorPayload = compactPayload({ name: child.value.name, faculty: child.value.faculty, format: child.value.format, availability: child.value.availability, short_bio: child.value.short_bio, strengths: child.value.strengths, tags: child.value.tags, suitable_for: child.value.suitable_for, support_methods: child.value.support_methods, subject_associations: child.value.subject_associations ?? [{ subject_id: createProduct.subject_id, is_primary: true }] });
    const args: AdminCatalogMutateArgs = { p_operation: "create", p_kind: "tutor", p_product: createProduct, p_child: createChild };
    return client.rpc("admin_catalog_mutate_v2", args);
  }
  if (child.kind === "material") {
    if (id === undefined) throw new AdminCatalogInputError("Catalog ID must be a valid UUID.");
    if (hasField(child.value, "allow_download")) {
      const args: AdminMaterialAtomicMutateArgs = { p_operation: "update", p_product: product, p_material: child.value, p_product_id: id };
      return client.rpc("admin_material_mutate_atomic", args);
    }
    const { allow_download: _allowDownload, ...legacyChild } = child.value;
    const args: AdminCatalogMutateArgs = { p_operation: "update", p_kind: "material", p_product: product, p_child: legacyChild, p_product_id: id };
    return client.rpc("admin_catalog_mutate_v2", args);
  }
  if (child.kind === "course") {
    if (id === undefined) throw new AdminCatalogInputError("Catalog ID must be a valid UUID.");
    const args: AdminCatalogMutateArgs = { p_operation: "update", p_kind: "course", p_product: product, p_child: child.value, p_product_id: id };
    return client.rpc("admin_catalog_mutate_v2", args);
  }
  if (id === undefined) throw new AdminCatalogInputError("Catalog ID must be a valid UUID.");
  const args: AdminCatalogMutateArgs = { p_operation: "update", p_kind: "tutor", p_product: product, p_child: child.value, p_product_id: id };
  return client.rpc("admin_catalog_mutate_v2", args);
}

async function mutateProduct<T>(operation: AdminCatalogMutationOperation, id: string | undefined, kind: ProductRow["kind"], product: ProductMutationPayload, child: ChildMutationPayload, selectColumns: string, guard: (value: unknown) => value is T, message: string): Promise<T> {
  if (operation === "update" && (id === undefined || !isValidUuid(id))) {
    throw new AdminCatalogInputError("Catalog ID must be a valid UUID.");
  }
  try {
    const client = await adminClient();
    if (child.kind !== kind) throw new AdminCatalogRepositoryError(message);
    const result = await callAtomicRpc(client, operation, id, product, child);
    if (result.error) repositoryFailure(message);
    const productId = mutationProductId(result.data, message);
    const row = await getProductWithClient<T>(client, productId, kind, selectColumns, guard, message);
    if (row === null) repositoryFailure(message);
    return row;
  } catch (error) {
    if (error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError(message);
  }
}

async function deleteProduct(id: string, kind: ProductRow["kind"], message: string): Promise<boolean> {
  if (!isValidUuid(id)) throw new AdminCatalogInputError("Catalog ID must be a valid UUID.");
  try {
    const client = await adminClient();
    const args: AdminCatalogMutateArgs = {
      p_operation: "delete",
      p_kind: kind,
      p_product: {},
      p_child: {},
      p_product_id: id
    };
    const result = await client.rpc("admin_catalog_mutate_v2", args);
    if (result.error) repositoryFailure(message);
    if (result.data === null) return false;
    if (objectValue(result.data, "deleted") !== true || objectValue(result.data, "id") !== id) repositoryFailure(message);
    return true;
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
    return rows(result.data, isAdminSubject);
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
    return result.data === null || result.data === undefined ? null : isAdminSubject(result.data) ? result.data : repositoryFailure("Failed to retrieve admin subject.");
  } catch (error) {
    if (error instanceof AdminCatalogInputError || error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError("Failed to retrieve admin subject.");
  }
}

export async function createAdminSubject(input: CreateAdminSubjectInput): Promise<AdminSubject> {
  const validated = validateSubjectInput(input, false);
  if (validated.slug === undefined || validated.name === undefined || validated.category === undefined || validated.faculty_group === undefined || validated.color_theme === undefined) {
    throw new AdminCatalogInputError("All subject fields are required.");
  }
  const payload: SubjectMutationPayload = {
    slug: validated.slug,
    name: validated.name,
    category: validated.category,
    faculty_group: validated.faculty_group,
    color_theme: validated.color_theme
  };
  try {
    const client = await adminClient();
    const result: QueryResult = await client.rpc("admin_subject_mutate_atomic", { p_operation: "create", p_subject: payload });
    const subject = objectValue(result.data, "subject");
    if (result.error || !isAdminSubject(subject)) repositoryFailure("Failed to create admin subject.");
    return subject;
  } catch (error) {
    if (error instanceof AdminCatalogInputError || error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError("Failed to create admin subject.");
  }
}

export async function updateAdminSubject(id: string, input: UpdateAdminSubjectInput): Promise<AdminSubject | null> {
  if (!isValidUuid(id)) throw new AdminCatalogInputError("Subject ID must be a valid UUID.");
  const payload: Tables["subjects"]["Update"] = validateSubjectInput(input, true);
  try {
    const client = await adminClient();
    const result: QueryResult = await client.rpc("admin_subject_mutate_atomic", { p_operation: "update", p_subject: payload, p_subject_id: id });
    if (result.error) repositoryFailure("Failed to update admin subject.");
    const subject = objectValue(result.data, "subject");
    return subject === null || subject === undefined ? null : isAdminSubject(subject) ? subject : repositoryFailure("Failed to update admin subject.");
  } catch (error) {
    if (error instanceof AdminCatalogInputError || error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError("Failed to update admin subject.");
  }
}

export async function deleteAdminSubject(id: string): Promise<boolean> {
  if (!isValidUuid(id)) throw new AdminCatalogInputError("Subject ID must be a valid UUID.");
  try {
    const client = await adminClient();
    const result: QueryResult = await client.rpc("admin_subject_mutate_atomic", { p_operation: "delete", p_subject: {}, p_subject_id: id });
    if (result.error) repositoryFailure("Failed to delete admin subject.");
    return objectValue(result.data, "deleted") === true && objectValue(result.data, "id") === id;
  } catch (error) {
    if (error instanceof AdminCatalogInputError || error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError("Failed to delete admin subject.");
  }
}

export async function listAdminMaterials(options?: ListAdminCatalogOptions): Promise<AdminMaterial[]> {
  return listProducts("material", MATERIAL_SELECT_COLUMNS, options, isAdminMaterial, "Failed to list admin materials.");
}

export async function getAdminMaterialById(id: string): Promise<AdminMaterial | null> {
  return getProduct(id, "material", MATERIAL_SELECT_COLUMNS, isAdminMaterial, "Failed to retrieve admin material.");
}

export async function createAdminMaterial(input: CreateAdminMaterialInput): Promise<AdminMaterial> {
  const validated = validateMaterialInput(input, false);
  return mutateProduct("create", undefined, "material", validated.product, validated.child, MATERIAL_SELECT_COLUMNS, isAdminMaterial, "Failed to create admin material.");
}

export async function updateAdminMaterial(id: string, input: UpdateAdminMaterialInput): Promise<AdminMaterial | null> {
  const validated = validateMaterialInput(input, true);
  return mutateProduct("update", id, "material", validated.product, validated.child, MATERIAL_SELECT_COLUMNS, isAdminMaterial, "Failed to update admin material.");
}

export async function updateAdminMaterialDownloadPermission(id: string, allowDownload: boolean): Promise<void> {
  if (!isValidUuid(id) || typeof allowDownload !== "boolean") {
    throw new AdminCatalogInputError("Material download policy input is invalid.");
  }
  try {
    const client = await adminClient();
    const result = await client.rpc("admin_material_download_permission_update", {
      p_material_id: id,
      p_allow_download: allowDownload
    });
    if (result.error || result.data !== true) repositoryFailure("Failed to update material download permission.");
  } catch (error) {
    if (error instanceof AdminCatalogInputError || error instanceof AdminCatalogRepositoryError) throw error;
    throw new AdminCatalogRepositoryError("Failed to update material download permission.");
  }
}

export async function deleteAdminMaterial(id: string): Promise<boolean> {
  return deleteProduct(id, "material", "Failed to delete admin material.");
}

export async function listAdminCourses(options?: ListAdminCatalogOptions): Promise<AdminCourse[]> {
  return listProducts("course", COURSE_SELECT_COLUMNS, options, isAdminCourse, "Failed to list admin courses.");
}

export async function getAdminCourseById(id: string): Promise<AdminCourse | null> {
  return getProduct(id, "course", COURSE_SELECT_COLUMNS, isAdminCourse, "Failed to retrieve admin course.");
}

export async function createAdminCourse(input: CreateAdminCourseInput): Promise<AdminCourse> {
  const validated = validateCourseInput(input, false);
  return mutateProduct("create", undefined, "course", validated.product, validated.child, COURSE_SELECT_COLUMNS, isAdminCourse, "Failed to create admin course.");
}

export async function updateAdminCourse(id: string, input: UpdateAdminCourseInput): Promise<AdminCourse | null> {
  const validated = validateCourseInput(input, true);
  return mutateProduct("update", id, "course", validated.product, validated.child, COURSE_SELECT_COLUMNS, isAdminCourse, "Failed to update admin course.");
}

export async function deleteAdminCourse(id: string): Promise<boolean> {
  return deleteProduct(id, "course", "Failed to delete admin course.");
}

export async function listAdminTutors(options?: ListAdminCatalogOptions): Promise<AdminTutor[]> {
  return listProducts("tutor", TUTOR_SELECT_COLUMNS, options, isAdminTutor, "Failed to list admin tutors.");
}

export async function getAdminTutorById(id: string): Promise<AdminTutor | null> {
  return getProduct(id, "tutor", TUTOR_SELECT_COLUMNS, isAdminTutor, "Failed to retrieve admin tutor.");
}

export async function createAdminTutor(input: CreateAdminTutorInput): Promise<AdminTutor> {
  const validated = validateTutorInput(input, false);
  return mutateProduct("create", undefined, "tutor", validated.product, validated.child, TUTOR_SELECT_COLUMNS, isAdminTutor, "Failed to create admin tutor.");
}

export async function updateAdminTutor(id: string, input: UpdateAdminTutorInput): Promise<AdminTutor | null> {
  const validated = validateTutorInput(input, true);
  return mutateProduct("update", id, "tutor", validated.product, validated.child, TUTOR_SELECT_COLUMNS, isAdminTutor, "Failed to update admin tutor.");
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
