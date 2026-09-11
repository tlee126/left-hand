"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getAccountAccess } from "@/lib/auth/session";
import {
  createAdminCourse,
  createAdminMaterial,
  createAdminSubject,
  createAdminTutor,
  deleteAdminCourse,
  deleteAdminMaterial,
  deleteAdminSubject,
  deleteAdminTutor,
  isValidCatalogSlug,
  isValidUuid,
  updateAdminCourse,
  updateAdminMaterial,
  updateAdminSubject,
  updateAdminTutor,
  type CreateAdminCourseInput,
  type CreateAdminMaterialInput,
  type CreateAdminSubjectInput,
  type CreateAdminTutorInput,
  type UpdateAdminCourseInput,
  type UpdateAdminMaterialInput,
  type UpdateAdminSubjectInput,
  type UpdateAdminTutorInput
} from "@/lib/repositories/admin-catalog-repository";
import {
  CATEGORIES,
  COLOR_THEMES
} from "@/lib/domain/subjects";
import {
  COURSE_FORMATS,
  DELIVERY_KINDS,
  ENROLLMENT_STATUSES,
  PUBLICATION_STATUSES,
  TUTOR_FORMATS,
  isValidVND
} from "@/lib/domain/product-types";

const ADMIN_CATALOG_PATH = "/quan-tri/catalog";
const LOGIN_PATH = "/dang-nhap?next=/quan-tri";
const ERROR_REDIRECT = `${ADMIN_CATALOG_PATH}?error=1`;
const SUCCESS_REDIRECT = `${ADMIN_CATALOG_PATH}?success=1`;

const SUBJECT_FIELDS = [
  "slug",
  "name",
  "category",
  "faculty_group",
  "color_theme"
] as const;
const PRODUCT_FIELDS = [
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
const MATERIAL_FIELDS = ["pages", "tags", "includes", "suitable_for", "allow_download"] as const;
const COURSE_FIELDS = [
  "format",
  "sessions",
  "duration",
  "schedule",
  "enrollment_status",
  "mentor",
  "tags",
  "curriculum",
  "suitable_for",
  "preparation"
] as const;
const TUTOR_FIELDS = [
  "name",
  "faculty",
  "format",
  "availability",
  "short_bio",
  "strengths",
  "tags",
  "suitable_for",
  "support_methods"
] as const;

class InvalidCatalogActionInput extends Error {}

type InputObject = object;

type ProductPayload = {
  slug?: string;
  title?: string;
  description?: string;
  subject_id?: string;
  category?: CreateAdminMaterialInput["category"];
  delivery_kind?: CreateAdminMaterialInput["delivery_kind"];
  publication_status?: CreateAdminMaterialInput["publication_status"];
  price_vnd?: number | null;
  old_price_vnd?: number | null;
  is_contact_for_price?: boolean;
  rating?: number;
  is_hot?: boolean;
  color_theme?: CreateAdminMaterialInput["color_theme"];
};

type MaterialPayload = ProductPayload & {
  pages?: number;
  tags?: string[];
  includes?: string[];
  suitable_for?: string[];
  allow_download?: boolean;
};
type MaterialActionInput = CreateAdminMaterialInput & { allow_download?: boolean };
type MaterialUpdateActionInput = UpdateAdminMaterialInput & { allow_download?: boolean };

type CoursePayload = ProductPayload & {
  format?: CreateAdminCourseInput["format"];
  sessions?: number;
  duration?: string;
  schedule?: string;
  enrollment_status?: CreateAdminCourseInput["enrollment_status"];
  mentor?: string;
  tags?: string[];
  curriculum?: string[];
  suitable_for?: string[];
  preparation?: string[];
};

type TutorPayload = ProductPayload & {
  name?: string;
  faculty?: string;
  format?: CreateAdminTutorInput["format"];
  availability?: string;
  short_bio?: string;
  strengths?: string[];
  tags?: string[];
  suitable_for?: string[];
  support_methods?: string[];
};

function isInputObject(value: unknown): value is InputObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertRecord(value: unknown): InputObject {
  if (!isInputObject(value)) throw new InvalidCatalogActionInput();
  return value;
}

function hasField(record: InputObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function fieldValue(record: InputObject, key: string): unknown {
  return Object.getOwnPropertyDescriptor(record, key)?.value;
}

function assertAllowedKeys(
  record: InputObject,
  fields: readonly string[]
): void {
  if (Object.keys(record).some((key) => !fields.includes(key))) {
    throw new InvalidCatalogActionInput();
  }
}

function requiredString(
  record: InputObject,
  key: string,
  maxLength: number
): string {
  const value = fieldValue(record, key);
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new InvalidCatalogActionInput();
  }
  return value.trim();
}

function optionalString(
  record: InputObject,
  key: string,
  maxLength: number
): string | undefined {
  if (!hasField(record, key)) return undefined;
  return requiredString(record, key, maxLength);
}

function requiredEnum<T extends string>(
  record: InputObject,
  key: string,
  values: readonly T[]
): T {
  const value = fieldValue(record, key);
  if (typeof value !== "string") {
    throw new InvalidCatalogActionInput();
  }
  const matched = values.find((candidate) => candidate === value.trim());
  if (matched === undefined) throw new InvalidCatalogActionInput();
  return matched;
}

function optionalEnum<T extends string>(
  record: InputObject,
  key: string,
  values: readonly T[]
): T | undefined {
  if (!hasField(record, key)) return undefined;
  return requiredEnum(record, key, values);
}

function requiredUuid(record: InputObject, key: string): string {
  const value = fieldValue(record, key);
  if (!isValidUuid(value)) throw new InvalidCatalogActionInput();
  return value;
}

function optionalUuid(record: InputObject, key: string): string | undefined {
  if (!hasField(record, key)) return undefined;
  return requiredUuid(record, key);
}

function requiredNumber(
  record: InputObject,
  key: string,
  minimum: number
): number {
  const value = fieldValue(record, key);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new InvalidCatalogActionInput();
  }
  return value;
}

function optionalNumber(
  record: InputObject,
  key: string,
  minimum: number
): number | undefined {
  if (!hasField(record, key)) return undefined;
  return requiredNumber(record, key, minimum);
}

function optionalPrice(record: InputObject, key: string): number | null | undefined {
  if (!hasField(record, key)) return undefined;
  const value = fieldValue(record, key);
  if (value !== null && !isValidVND(value)) {
    throw new InvalidCatalogActionInput();
  }
  return value === null ? null : value;
}

function optionalBoolean(record: InputObject, key: string): boolean | undefined {
  if (!hasField(record, key)) return undefined;
  const value = fieldValue(record, key);
  if (typeof value !== "boolean") throw new InvalidCatalogActionInput();
  return value;
}

function optionalArray(record: InputObject, key: string): string[] | undefined {
  if (!hasField(record, key)) return undefined;
  const value = fieldValue(record, key);
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new InvalidCatalogActionInput();
  }
  return value.map((item) => {
    if (typeof item !== "string") throw new InvalidCatalogActionInput();
    return item.trim();
  });
}

function assertProductPricing(record: InputObject, update: boolean): void {
  const hasPrice = hasField(record, "price_vnd");
  const hasOldPrice = hasField(record, "old_price_vnd");
  const hasContact = hasField(record, "is_contact_for_price");
  if (!hasPrice && !hasOldPrice && !hasContact) return;
  if (update && !(hasPrice && hasOldPrice && hasContact)) throw new InvalidCatalogActionInput();
  const price = fieldValue(record, "price_vnd");
  const oldPrice = fieldValue(record, "old_price_vnd");
  const contact = fieldValue(record, "is_contact_for_price");
  if (contact === true && (price !== null || (hasOldPrice && oldPrice !== null))) {
    throw new InvalidCatalogActionInput();
  }
  if (contact === false && (price === null || !isValidVND(price))) {
    throw new InvalidCatalogActionInput();
  }
  if (isValidVND(price) && isValidVND(oldPrice) && oldPrice < price) throw new InvalidCatalogActionInput();
}

function validateSlug(record: InputObject): string | undefined {
  if (!hasField(record, "slug")) return undefined;
  const slug = requiredString(record, "slug", 150);
  if (!isValidCatalogSlug(slug)) throw new InvalidCatalogActionInput();
  return slug;
}

function validateSubjectInput(
  input: unknown,
  update: false
): CreateAdminSubjectInput;
function validateSubjectInput(
  input: unknown,
  update: true
): UpdateAdminSubjectInput;
function validateSubjectInput(input: unknown, update: boolean): CreateAdminSubjectInput | UpdateAdminSubjectInput {
  const record = assertRecord(input);
  assertAllowedKeys(record, SUBJECT_FIELDS);
  if (!update && Object.keys(record).length !== SUBJECT_FIELDS.length) throw new InvalidCatalogActionInput();
  if (update && Object.keys(record).length === 0) throw new InvalidCatalogActionInput();

  const payload: Partial<CreateAdminSubjectInput> = {};
  const slug = validateSlug(record);
  if (slug !== undefined) payload.slug = slug;
  if (hasField(record, "name")) payload.name = requiredString(record, "name", 150);
  if (hasField(record, "category")) payload.category = requiredEnum(record, "category", CATEGORIES);
  if (hasField(record, "faculty_group")) payload.faculty_group = requiredString(record, "faculty_group", 150);
  if (hasField(record, "color_theme")) payload.color_theme = requiredEnum(record, "color_theme", COLOR_THEMES);
  if (update) return payload;
  if (payload.slug === undefined || payload.name === undefined || payload.category === undefined || payload.faculty_group === undefined || payload.color_theme === undefined) throw new InvalidCatalogActionInput();
  return { slug: payload.slug, name: payload.name, category: payload.category, faculty_group: payload.faculty_group, color_theme: payload.color_theme };
}

function validateProductInput(
  input: unknown,
  update: boolean
): ProductPayload {
  const record = assertRecord(input);
  assertAllowedKeys(record, PRODUCT_FIELDS);
  const requiredFields = [
    "slug",
    "title",
    "description",
    "subject_id",
    "category",
    "delivery_kind",
    "price_vnd",
    "is_contact_for_price",
    "color_theme"
  ];
  if (!update && requiredFields.some((key) => !(key in record))) throw new InvalidCatalogActionInput();
  const payload: ProductPayload = {};
  const slug = validateSlug(record);
  if (slug !== undefined) payload.slug = slug;
  if (hasField(record, "title")) payload.title = requiredString(record, "title", 250);
  if (hasField(record, "description")) payload.description = requiredString(record, "description", 5000);
  const subjectId = update ? optionalUuid(record, "subject_id") : requiredUuid(record, "subject_id");
  if (subjectId !== undefined) payload.subject_id = subjectId;
  if (hasField(record, "category")) payload.category = requiredEnum(record, "category", CATEGORIES);
  const deliveryKind = update
    ? optionalEnum(record, "delivery_kind", DELIVERY_KINDS)
    : requiredEnum(record, "delivery_kind", DELIVERY_KINDS);
  if (deliveryKind !== undefined) payload.delivery_kind = deliveryKind;
  const publicationStatus = optionalEnum(record, "publication_status", PUBLICATION_STATUSES);
  if (publicationStatus !== undefined) payload.publication_status = publicationStatus;
  const price = optionalPrice(record, "price_vnd");
  if (price !== undefined) payload.price_vnd = price;
  const oldPrice = optionalPrice(record, "old_price_vnd");
  if (oldPrice !== undefined) payload.old_price_vnd = oldPrice;
  const contact = optionalBoolean(record, "is_contact_for_price");
  if (contact !== undefined) payload.is_contact_for_price = contact;
  if (hasField(record, "rating")) {
    const rating = fieldValue(record, "rating");
    if (typeof rating !== "number" || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new InvalidCatalogActionInput();
    }
    payload.rating = rating;
  }
  const isHot = optionalBoolean(record, "is_hot");
  if (isHot !== undefined) payload.is_hot = isHot;
  if (hasField(record, "color_theme")) payload.color_theme = requiredEnum(record, "color_theme", COLOR_THEMES);
  assertProductPricing(record, update);
  return payload;
}

function productRecord(record: InputObject): InputObject {
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

function validateMaterialInput(
  input: unknown,
  update: false
): MaterialActionInput;
function validateMaterialInput(
  input: unknown,
  update: true
): MaterialUpdateActionInput;
function validateMaterialInput(input: unknown, update: boolean): MaterialActionInput | MaterialUpdateActionInput {
  const record = assertRecord(input);
  assertAllowedKeys(record, [...PRODUCT_FIELDS, ...MATERIAL_FIELDS]);
  const product = validateProductInput(productRecord(record), update);
  if (!update && !("pages" in record)) throw new InvalidCatalogActionInput();
  const payload: MaterialPayload = { ...product };
  const pages = optionalNumber(record, "pages", 1);
  if (pages !== undefined) payload.pages = pages;
  for (const key of ["tags", "includes", "suitable_for"] as const) {
    const values = optionalArray(record, key);
    if (key === "tags" && values !== undefined) payload.tags = values;
    if (key === "includes" && values !== undefined) payload.includes = values;
    if (key === "suitable_for" && values !== undefined) payload.suitable_for = values;
  }
  const allowDownload = optionalBoolean(record, "allow_download");
  if (allowDownload !== undefined) payload.allow_download = allowDownload;
  if (update && Object.keys(payload).length === 0) throw new InvalidCatalogActionInput();
  if (update) return payload;
  if (payload.slug === undefined || payload.title === undefined || payload.description === undefined || payload.subject_id === undefined || payload.category === undefined || payload.delivery_kind === undefined || payload.price_vnd === undefined || payload.old_price_vnd === undefined || payload.is_contact_for_price === undefined || payload.color_theme === undefined || payload.pages === undefined) throw new InvalidCatalogActionInput();
  return { ...payload, slug: payload.slug, title: payload.title, description: payload.description, subject_id: payload.subject_id, category: payload.category, delivery_kind: payload.delivery_kind, price_vnd: payload.price_vnd, old_price_vnd: payload.old_price_vnd, is_contact_for_price: payload.is_contact_for_price, color_theme: payload.color_theme, pages: payload.pages };
}

function validateCourseInput(
  input: unknown,
  update: false
): CreateAdminCourseInput;
function validateCourseInput(
  input: unknown,
  update: true
): UpdateAdminCourseInput;
function validateCourseInput(input: unknown, update: boolean): CreateAdminCourseInput | UpdateAdminCourseInput {
  const record = assertRecord(input);
  assertAllowedKeys(record, [...PRODUCT_FIELDS, ...COURSE_FIELDS]);
  const product = validateProductInput(productRecord(record), update);
  const payload: CoursePayload = { ...product };
  for (const key of ["format", "sessions", "duration", "schedule", "mentor"] as const) {
    if (!update && !(key in record)) throw new InvalidCatalogActionInput();
  }
  const format = optionalEnum(record, "format", COURSE_FORMATS);
  if (format !== undefined) payload.format = format;
  const sessions = optionalNumber(record, "sessions", 1);
  if (sessions !== undefined) payload.sessions = sessions;
  for (const key of ["duration", "schedule", "mentor"] as const) {
    const value = optionalString(record, key, 500);
    if (value !== undefined) payload[key] = value;
  }
  const enrollmentStatus = optionalEnum(record, "enrollment_status", ENROLLMENT_STATUSES);
  if (enrollmentStatus !== undefined) payload.enrollment_status = enrollmentStatus;
  for (const key of ["tags", "curriculum", "suitable_for", "preparation"] as const) {
    const values = optionalArray(record, key);
    if (key === "tags" && values !== undefined) payload.tags = values;
    if (key === "curriculum" && values !== undefined) payload.curriculum = values;
    if (key === "suitable_for" && values !== undefined) payload.suitable_for = values;
    if (key === "preparation" && values !== undefined) payload.preparation = values;
  }
  if (update && Object.keys(payload).length === 0) throw new InvalidCatalogActionInput();
  if (update) return payload;
  if (payload.slug === undefined || payload.title === undefined || payload.description === undefined || payload.subject_id === undefined || payload.category === undefined || payload.delivery_kind === undefined || payload.price_vnd === undefined || payload.old_price_vnd === undefined || payload.is_contact_for_price === undefined || payload.color_theme === undefined || payload.format === undefined || payload.sessions === undefined || payload.duration === undefined || payload.schedule === undefined || payload.mentor === undefined) throw new InvalidCatalogActionInput();
  return { ...payload, slug: payload.slug, title: payload.title, description: payload.description, subject_id: payload.subject_id, category: payload.category, delivery_kind: payload.delivery_kind, price_vnd: payload.price_vnd, old_price_vnd: payload.old_price_vnd, is_contact_for_price: payload.is_contact_for_price, color_theme: payload.color_theme, format: payload.format, sessions: payload.sessions, duration: payload.duration, schedule: payload.schedule, mentor: payload.mentor };
}

function validateTutorInput(
  input: unknown,
  update: false
): CreateAdminTutorInput;
function validateTutorInput(
  input: unknown,
  update: true
): UpdateAdminTutorInput;
function validateTutorInput(input: unknown, update: boolean): CreateAdminTutorInput | UpdateAdminTutorInput {
  const record = assertRecord(input);
  assertAllowedKeys(record, [...PRODUCT_FIELDS, ...TUTOR_FIELDS]);
  const product = validateProductInput(productRecord(record), update);
  const payload: TutorPayload = { ...product };
  const format = optionalEnum(record, "format", TUTOR_FORMATS);
  if (format !== undefined) payload.format = format;
  for (const key of ["name", "faculty", "availability", "short_bio"] as const) {
    if (!update && !(key in record)) throw new InvalidCatalogActionInput();
    const value = optionalString(record, key, key === "short_bio" ? 5000 : 500);
    if (value !== undefined) payload[key] = value;
  }
  for (const key of ["strengths", "tags", "suitable_for", "support_methods"] as const) {
    const values = optionalArray(record, key);
    if (key === "strengths" && values !== undefined) payload.strengths = values;
    if (key === "tags" && values !== undefined) payload.tags = values;
    if (key === "suitable_for" && values !== undefined) payload.suitable_for = values;
    if (key === "support_methods" && values !== undefined) payload.support_methods = values;
  }
  if (update && Object.keys(payload).length === 0) throw new InvalidCatalogActionInput();
  if (update) return payload;
  if (payload.slug === undefined || payload.title === undefined || payload.description === undefined || payload.subject_id === undefined || payload.category === undefined || payload.delivery_kind === undefined || payload.price_vnd === undefined || payload.old_price_vnd === undefined || payload.is_contact_for_price === undefined || payload.color_theme === undefined || payload.format === undefined || payload.name === undefined || payload.faculty === undefined || payload.availability === undefined || payload.short_bio === undefined) throw new InvalidCatalogActionInput();
  return { ...payload, slug: payload.slug, title: payload.title, description: payload.description, subject_id: payload.subject_id, category: payload.category, delivery_kind: payload.delivery_kind, price_vnd: payload.price_vnd, old_price_vnd: payload.old_price_vnd, is_contact_for_price: payload.is_contact_for_price, color_theme: payload.color_theme, format: payload.format, name: payload.name, faculty: payload.faculty, availability: payload.availability, short_bio: payload.short_bio };
}

function validateId(id: unknown): string {
  if (!isValidUuid(id)) throw new InvalidCatalogActionInput();
  return id;
}

async function requireAdminAccess(): Promise<void> {
  const access = await getAccountAccess();
  if (access.status === "unauthenticated") redirect(LOGIN_PATH);
  if (access.status !== "approved" || access.profile?.role !== "admin") notFound();
}

function redirectError(): never {
  redirect(ERROR_REDIRECT);
}

function redirectSuccess(): never {
  redirect(SUCCESS_REDIRECT);
}

function validateBeforeRepository<T>(validator: () => T): T {
  try {
    return validator();
  } catch {
    redirectError();
  }
}

function revalidateSubjectRoutes(): void {
  revalidatePath(ADMIN_CATALOG_PATH);
  revalidatePath("/tai-lieu");
  revalidatePath("/khoa-hoc");
  revalidatePath("/tutor");
}

function revalidateProductRoutes(
  publicPath: "/tai-lieu" | "/khoa-hoc" | "/tutor",
  slug: string
): void {
  revalidatePath(ADMIN_CATALOG_PATH);
  revalidatePath(publicPath);
  revalidatePath(`${publicPath}/${slug}`);
}

export async function createSubjectAction(input: unknown): Promise<void> {
  await requireAdminAccess();
  const payload = validateBeforeRepository(() => validateSubjectInput(input, false));
  let created: Awaited<ReturnType<typeof createAdminSubject>>;
  try {
    created = await createAdminSubject(payload);
  } catch {
    redirectError();
  }
  if (!created) redirectError();
  revalidateSubjectRoutes();
  redirectSuccess();
}

export async function updateSubjectAction(id: string, input: unknown): Promise<void> {
  await requireAdminAccess();
  const normalizedId = validateBeforeRepository(() => validateId(id));
  const payload = validateBeforeRepository(() => validateSubjectInput(input, true));
  let updated: Awaited<ReturnType<typeof updateAdminSubject>>;
  try {
    updated = await updateAdminSubject(normalizedId, payload);
  } catch {
    redirectError();
  }
  if (!updated) redirectError();
  revalidateSubjectRoutes();
  redirectSuccess();
}

export async function deleteSubjectAction(id: string): Promise<void> {
  await requireAdminAccess();
  const normalizedId = validateBeforeRepository(() => validateId(id));
  let deleted: boolean;
  try {
    deleted = await deleteAdminSubject(normalizedId);
  } catch {
    redirectError();
  }
  if (!deleted) redirectError();
  revalidateSubjectRoutes();
  redirectSuccess();
}

export async function createMaterialAction(input: unknown): Promise<void> {
  await requireAdminAccess();
  const payload = validateBeforeRepository(() => validateMaterialInput(input, false));
  let created: Awaited<ReturnType<typeof createAdminMaterial>>;
  try {
    created = await createAdminMaterial(payload);
  } catch {
    redirectError();
  }
  if (!created) redirectError();
  revalidateProductRoutes("/tai-lieu", created.slug);
  redirectSuccess();
}

export async function updateMaterialAction(id: string, input: unknown): Promise<void> {
  await requireAdminAccess();
  const normalizedId = validateBeforeRepository(() => validateId(id));
  const payload = validateBeforeRepository(() => validateMaterialInput(input, true));
  let updated: Awaited<ReturnType<typeof updateAdminMaterial>>;
  try {
    updated = await updateAdminMaterial(normalizedId, payload);
  } catch {
    redirectError();
  }
  if (!updated) redirectError();
  revalidateProductRoutes("/tai-lieu", updated.slug);
  redirectSuccess();
}

export async function deleteMaterialAction(id: string): Promise<void> {
  await requireAdminAccess();
  const normalizedId = validateBeforeRepository(() => validateId(id));
  let deleted: boolean;
  try {
    deleted = await deleteAdminMaterial(normalizedId);
  } catch {
    redirectError();
  }
  if (!deleted) redirectError();
  revalidatePath(ADMIN_CATALOG_PATH);
  revalidatePath("/tai-lieu");
  redirectSuccess();
}

export async function createCourseAction(input: unknown): Promise<void> {
  await requireAdminAccess();
  const payload = validateBeforeRepository(() => validateCourseInput(input, false));
  let created: Awaited<ReturnType<typeof createAdminCourse>>;
  try {
    created = await createAdminCourse(payload);
  } catch {
    redirectError();
  }
  if (!created) redirectError();
  revalidateProductRoutes("/khoa-hoc", created.slug);
  redirectSuccess();
}

export async function updateCourseAction(id: string, input: unknown): Promise<void> {
  await requireAdminAccess();
  const normalizedId = validateBeforeRepository(() => validateId(id));
  const payload = validateBeforeRepository(() => validateCourseInput(input, true));
  let updated: Awaited<ReturnType<typeof updateAdminCourse>>;
  try {
    updated = await updateAdminCourse(normalizedId, payload);
  } catch {
    redirectError();
  }
  if (!updated) redirectError();
  revalidateProductRoutes("/khoa-hoc", updated.slug);
  redirectSuccess();
}

export async function deleteCourseAction(id: string): Promise<void> {
  await requireAdminAccess();
  const normalizedId = validateBeforeRepository(() => validateId(id));
  let deleted: boolean;
  try {
    deleted = await deleteAdminCourse(normalizedId);
  } catch {
    redirectError();
  }
  if (!deleted) redirectError();
  revalidatePath(ADMIN_CATALOG_PATH);
  revalidatePath("/khoa-hoc");
  redirectSuccess();
}

export async function createTutorAction(input: unknown): Promise<void> {
  await requireAdminAccess();
  const payload = validateBeforeRepository(() => validateTutorInput(input, false));
  let created: Awaited<ReturnType<typeof createAdminTutor>>;
  try {
    created = await createAdminTutor(payload);
  } catch {
    redirectError();
  }
  if (!created) redirectError();
  revalidateProductRoutes("/tutor", created.slug);
  redirectSuccess();
}

export async function updateTutorAction(id: string, input: unknown): Promise<void> {
  await requireAdminAccess();
  const normalizedId = validateBeforeRepository(() => validateId(id));
  const payload = validateBeforeRepository(() => validateTutorInput(input, true));
  let updated: Awaited<ReturnType<typeof updateAdminTutor>>;
  try {
    updated = await updateAdminTutor(normalizedId, payload);
  } catch {
    redirectError();
  }
  if (!updated) redirectError();
  revalidateProductRoutes("/tutor", updated.slug);
  redirectSuccess();
}

export async function deleteTutorAction(id: string): Promise<void> {
  await requireAdminAccess();
  const normalizedId = validateBeforeRepository(() => validateId(id));
  let deleted: boolean;
  try {
    deleted = await deleteAdminTutor(normalizedId);
  } catch {
    redirectError();
  }
  if (!deleted) redirectError();
  revalidatePath(ADMIN_CATALOG_PATH);
  revalidatePath("/tutor");
  redirectSuccess();
}
