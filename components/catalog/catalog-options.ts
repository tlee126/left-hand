import { CATEGORIES, type Category } from "@/lib/domain/subjects";
import type { CourseFormat, EnrollmentStatus } from "@/lib/domain/product-types";

export type CategoryFilter = "Tất cả" | Category;

const CATEGORY_ICONS: Record<Category, string> = {
  "Kế toán": "💼",
  "Kinh tế": "📈",
  "Thống kê": "📊",
  Marketing: "🎯",
  "Quản trị": "🧠",
  "Tài chính": "💵",
  MIS: "💻",
  Luật: "⚖️",
  "Ngoại ngữ": "🗣️"
};

export const categoryFilterOptions: Array<{ label: CategoryFilter; icon: string }> = [
  { label: "Tất cả", icon: "" },
  ...CATEGORIES.map((category) => ({ label: category, icon: CATEGORY_ICONS[category] }))
];

export type CourseFilter = "Tất cả" | "Zoom" | "Video" | "Online" | "Sắp mở" | "Đang nhận đăng ký";

export const courseFilterOptions: Array<{ label: CourseFilter; icon: string }> = [
  { label: "Tất cả", icon: "" },
  { label: "Zoom", icon: "🎥" },
  { label: "Video", icon: "💿" },
  { label: "Online", icon: "🌐" },
  { label: "Sắp mở", icon: "⏳" },
  { label: "Đang nhận đăng ký", icon: "✅" }
];

export const courseFormatLabels: Record<CourseFormat, string> = {
  online: "Online",
  offline: "Offline tại CS",
  video: "Video tự học",
  zoom: "Học qua Zoom"
};

export const enrollmentStatusLabels: Record<EnrollmentStatus, string> = {
  open: "Đang nhận đăng ký",
  "coming-soon": "Sắp mở lớp",
  full: "Hết chỗ"
};

export type TutorFilter = "Tất cả" | Category | "Online" | "1:1";

export const tutorFilterOptions: Array<{ label: TutorFilter; icon: string }> = [
  { label: "Tất cả", icon: "" },
  ...CATEGORIES.filter((category) => category !== "Ngoại ngữ").map((category) => ({
    label: category,
    icon: CATEGORY_ICONS[category]
  })),
  { label: "Online", icon: "🌐" },
  { label: "1:1", icon: "👤" }
];
