import type { Category, ColorTheme } from "./subjects";
import type { EnrollmentStatus } from "./product-types";

export type CourseFormat = "online" | "offline" | "video" | "zoom";

export const TUTOR_FORMATS = [
  "1:1 & Nhóm nhỏ (Online/Offline)",
  "1:1 (Online/Offline quận 7)",
  "1:1 & Nhóm nhỏ (Online)",
  "1:1 (Online qua Google Meet)",
  "1:1 & Nhóm nhỏ (Offline/Online)",
  "1:1 (Online)",
  "1:1 & Nhóm nhỏ (Online/Offline Q7)"
] as const;

export type TutorFormat = (typeof TUTOR_FORMATS)[number];

export interface MaterialItem {
  id: string;
  slug: string;
  title: string;
  subject: string;
  subjectSlug?: string;
  facultyGroup: string;
  category: Category;
  type: "TÀI LIỆU";
  description: string;
  price: string;
  oldPrice?: string;
  pages: number;
  tags: string[];
  rating: number;
  isHot: boolean;
  colorTheme: ColorTheme;
  includes?: string[];
  suitableFor?: string[];
}

export interface CourseItem {
  id: string;
  slug: string;
  title: string;
  subject: string;
  subjectSlug?: string;
  category: Category;
  format: CourseFormat;
  sessions: number;
  duration: string;
  schedule: string;
  description: string;
  price: string;
  oldPrice?: string;
  status: EnrollmentStatus;
  mentor: string;
  tags: string[];
  rating: number;
  colorTheme: ColorTheme;
  curriculum?: string[];
  suitableFor?: string[];
  preparation?: string[];
}

export interface TutorItem {
  id: string;
  slug: string;
  name: string;
  subjects: string[];
  subjectSlug?: string;
  subjectSlugs?: string[];
  faculty: string;
  strengths: string[];
  format: TutorFormat;
  price: string;
  availability: string;
  rating: number;
  shortBio: string;
  tags: string[];
  colorTheme: ColorTheme;
  suitableFor?: string[];
  supportMethods?: string[];
}
