import type { Category, ColorTheme, Subject } from "./subjects";
import type {
  CourseFormat,
  DeliveryKind,
  EnrollmentStatus,
  ProductKind,
  ProductPricing,
  PublicationStatus,
  TutorFormat
} from "./product-types";

export type { CourseFormat, TutorFormat } from "./product-types";
export { COURSE_FORMATS, TUTOR_FORMATS } from "./product-types";

/** Complete subject identity attached to every published product. */
export type SubjectIdentity = Subject;

export interface PublishedProductBase {
  readonly id: string;
  readonly slug: string;
  readonly kind: ProductKind;
  readonly title: string;
  readonly description: string;
  readonly subject: SubjectIdentity;
  readonly category: Category;
  readonly deliveryKind: DeliveryKind;
  readonly publicationStatus: Extract<PublicationStatus, "published">;
  readonly pricing: ProductPricing;
  readonly rating: number;
  readonly isHot: boolean;
  readonly colorTheme: ColorTheme;
}

export interface MaterialMetadata {
  readonly pages: number;
  readonly tags: readonly string[];
  readonly includes: readonly string[];
  readonly suitableFor: readonly string[];
}

export interface CourseMetadata {
  readonly format: CourseFormat;
  readonly sessions: number;
  readonly duration: string;
  readonly schedule: string;
  readonly enrollmentStatus: EnrollmentStatus;
  readonly mentor: string;
  readonly tags: readonly string[];
  readonly curriculum: readonly string[];
  readonly suitableFor: readonly string[];
  readonly preparation: readonly string[];
}

export interface TutorMetadata {
  readonly name: string;
  readonly faculty: string;
  readonly format: TutorFormat;
  readonly availability: string;
  readonly shortBio: string;
  readonly strengths: readonly string[];
  readonly tags: readonly string[];
  readonly suitableFor: readonly string[];
  readonly supportMethods: readonly string[];
  readonly subjects: readonly SubjectIdentity[];
}

export interface PublishedMaterial extends PublishedProductBase {
  readonly kind: "material";
  readonly deliveryKind: "digital_download";
  readonly material: MaterialMetadata;
}

export interface PublishedCourse extends PublishedProductBase {
  readonly kind: "course";
  readonly deliveryKind: "live_session" | "recorded_video";
  readonly course: CourseMetadata;
}

export interface PublishedTutor extends PublishedProductBase {
  readonly kind: "tutor";
  readonly deliveryKind: "one_on_one_tutoring";
  readonly tutor: TutorMetadata;
}

export type PublishedCatalogProduct =
  | PublishedMaterial
  | PublishedCourse
  | PublishedTutor;

export type CatalogSort =
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating-desc"
  | "relevant"
  | "available-slot";

/** Shared, URL-safe server-side catalog query contract. */
export interface CatalogFilters {
  readonly search?: string;
  readonly category?: Category;
  /** Canonical subject slug, never a presentation label. */
  readonly subject?: string;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly sort?: CatalogSort;
  readonly limit?: number;
  readonly offset?: number;
  readonly page?: number;
  readonly courseFormat?: CourseFormat;
  readonly courseFormats?: readonly CourseFormat[];
  readonly enrollmentStatus?: EnrollmentStatus;
  readonly tutorMode?: "online" | "one-to-one";
}

export interface CatalogPage<T> {
  readonly items: readonly T[];
  readonly total: number | null;
  readonly limit: number;
  readonly offset: number;
  readonly page: number;
  readonly hasNext: boolean | null;
  readonly hasPrevious: boolean;
}

/** One normalization rule shared by every server catalog query and UI search input. */
export function normalizeCatalogSearch(value: string): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi-VN")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
