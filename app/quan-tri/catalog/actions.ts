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
  TUTOR_FORMATS
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
const MATERIAL_FIELDS = ["pages", "tags", "includes", "suitable_for"] as const;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new InvalidCatalogActionInput();
  return value;
}

function assertAllowedKeys(
  record: Record<string, unknown>,
  fields: readonly string[]
): void {
  if (Object.keys(record).some((key) => !fields.includes(key))) {
    throw new InvalidCatalogActionInput();
  }
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new InvalidCatalogActionInput();
  }
  return value.trim();
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number
): string | undefined {
  if (!(key in record)) return undefined;
  return requiredString(record, key, maxLength);
}

function requiredEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  values: readonly T[]
): T {
  const value = record[key];
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new InvalidCatalogActionInput();
  }
  return value as T;
}

function optionalEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  values: readonly T[]
): T | undefined {
  if (!(key in record)) return undefined;
  return requiredEnum(record, key, values);
}

function requiredUuid(record: Record<string, unknown>, key: string): string {
  if (!isValidUuid(record[key])) throw new InvalidCatalogActionInput();
  return record[key] as string;
}

function optionalUuid(record: Record<string, unknown>, key: string): string | undefined {
  if (!(key in record)) return undefined;
  return requiredUuid(record, key);
}

function requiredNumber(
  record: Record<string, unknown>,
  key: string,
  minimum: number
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new InvalidCatalogActionInput();
  }
  return value;
}

function optionalNumber(
  record: Record<string, unknown>,
  key: string,
  minimum: number
): number | undefined {
  if (!(key in record)) return undefined;
  return requiredNumber(record, key, minimum);
}

function optionalPrice(record: Record<string, unknown>, key: string): number | null | undefined {
  if (!(key in record)) return undefined;
  const value = record[key];
  if (value !== null && (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) {
    throw new InvalidCatalogActionInput();
  }
  return value as number | null;
}

function optionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  if (!(key in record)) return undefined;
  if (typeof record[key] !== "boolean") throw new InvalidCatalogActionInput();
  return record[key] as boolean;
}

function optionalArray(record: Record<string, unknown>, key: string): string[] | undefined {
  if (!(key in record)) return undefined;
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new InvalidCatalogActionInput();
  }
  return value.map((item) => (item as string).trim());
}

function assertProductPricing(record: Record<string, unknown>): void {
  if (!("price_vnd" in record) || !("is_contact_for_price" in record)) return;
  if (record.is_contact_for_price === true && record.price_vnd !== null) {
    throw new InvalidCatalogActionInput();
  }
  if (record.is_contact_for_price === false && record.price_vnd === null) {
    throw new InvalidCatalogActionInput();
  }
}

function validateSlug(record: Record<string, unknown>): string | undefined {
  if (!("slug" in record)) return undefined;
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

  const payload: Record<string, unknown> = {};
  const slug = validateSlug(record);
  if (slug !== undefined) payload.slug = slug;
  if ("name" in record) payload.name = requiredString(record, "name", 150);
  if ("category" in record) payload.category = requiredEnum(record, "category", CATEGORIES);
  if ("faculty_group" in record) payload.faculty_group = requiredString(record, "faculty_group", 150);
  if ("color_theme" in record) payload.color_theme = requiredEnum(record, "color_theme", COLOR_THEMES);
  return payload as CreateAdminSubjectInput | UpdateAdminSubjectInput;
}

function validateProductInput(
  input: unknown,
  update: boolean
): Record<string, unknown> {
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
  const payload: Record<string, unknown> = {};
  const slug = validateSlug(record);
  if (slug !== undefined) payload.slug = slug;
  if ("title" in record) payload.title = requiredString(record, "title", 250);
  if ("description" in record) payload.description = requiredString(record, "description", 5000);
  const subjectId = update ? optionalUuid(record, "subject_id") : requiredUuid(record, "subject_id");
  if (subjectId !== undefined) payload.subject_id = subjectId;
  if ("category" in record) payload.category = requiredEnum(record, "category", CATEGORIES);
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
  if ("rating" in record) {
    const rating = record.rating;
    if (typeof rating !== "number" || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new InvalidCatalogActionInput();
    }
    payload.rating = rating;
  }
  const isHot = optionalBoolean(record, "is_hot");
  if (isHot !== undefined) payload.is_hot = isHot;
  if ("color_theme" in record) payload.color_theme = requiredEnum(record, "color_theme", COLOR_THEMES);
  assertProductPricing(record);
  return payload;
}

function validateMaterialInput(
  input: unknown,
  update: false
): CreateAdminMaterialInput;
function validateMaterialInput(
  input: unknown,
  update: true
): UpdateAdminMaterialInput;
function validateMaterialInput(input: unknown, update: boolean): CreateAdminMaterialInput | UpdateAdminMaterialInput {
  const record = assertRecord(input);
  assertAllowedKeys(record, [...PRODUCT_FIELDS, ...MATERIAL_FIELDS]);
  const productRecord = Object.fromEntries(
    PRODUCT_FIELDS.filter((key) => key in record).map((key) => [key, record[key]])
  );
  const product = validateProductInput(productRecord, update);
  if (!update && !("pages" in record)) throw new InvalidCatalogActionInput();
  const payload: Record<string, unknown> = { ...product };
  const pages = optionalNumber(record, "pages", 1);
  if (pages !== undefined) payload.pages = pages;
  for (const key of ["tags", "includes", "suitable_for"] as const) {
    const values = optionalArray(record, key);
    if (values !== undefined) payload[key] = values;
  }
  if (update && Object.keys(payload).length === 0) throw new InvalidCatalogActionInput();
  return payload as CreateAdminMaterialInput | UpdateAdminMaterialInput;
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
  const productRecord = Object.fromEntries(
    PRODUCT_FIELDS.filter((key) => key in record).map((key) => [key, record[key]])
  );
  const product = validateProductInput(productRecord, update);
  const payload: Record<string, unknown> = { ...product };
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
    if (values !== undefined) payload[key] = values;
  }
  if (update && Object.keys(payload).length === 0) throw new InvalidCatalogActionInput();
  return payload as CreateAdminCourseInput | UpdateAdminCourseInput;
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
  const productRecord = Object.fromEntries(
    PRODUCT_FIELDS.filter((key) => key in record).map((key) => [key, record[key]])
  );
  const product = validateProductInput(productRecord, update);
  const payload: Record<string, unknown> = { ...product };
  const format = optionalString(record, "format", 500);
  if (format !== undefined) {
    if (!TUTOR_FORMATS.includes(format as (typeof TUTOR_FORMATS)[number])) throw new InvalidCatalogActionInput();
    payload.format = format;
  }
  for (const key of ["name", "faculty", "availability", "short_bio"] as const) {
    if (!update && !(key in record)) throw new InvalidCatalogActionInput();
    const value = optionalString(record, key, key === "short_bio" ? 5000 : 500);
    if (value !== undefined) payload[key] = value;
  }
  for (const key of ["strengths", "tags", "suitable_for", "support_methods"] as const) {
    const values = optionalArray(record, key);
    if (values !== undefined) payload[key] = values;
  }
  if (update && Object.keys(payload).length === 0) throw new InvalidCatalogActionInput();
  return payload as CreateAdminTutorInput | UpdateAdminTutorInput;
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

export async function createSubjectAction(input: CreateAdminSubjectInput): Promise<void> {
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

export async function updateSubjectAction(id: string, input: UpdateAdminSubjectInput): Promise<void> {
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

export async function createMaterialAction(input: CreateAdminMaterialInput): Promise<void> {
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

export async function updateMaterialAction(id: string, input: UpdateAdminMaterialInput): Promise<void> {
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

export async function createCourseAction(input: CreateAdminCourseInput): Promise<void> {
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

export async function updateCourseAction(id: string, input: UpdateAdminCourseInput): Promise<void> {
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

export async function createTutorAction(input: CreateAdminTutorInput): Promise<void> {
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

export async function updateTutorAction(id: string, input: UpdateAdminTutorInput): Promise<void> {
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
