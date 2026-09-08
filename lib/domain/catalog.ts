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
