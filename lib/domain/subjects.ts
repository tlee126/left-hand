/**
 * Canonical Learning Domain - Subjects & Categories
 * Derived from data/catalog.ts and data/site.ts
 */

export const CATEGORIES = [
  "Kế toán",
  "Kinh tế",
  "Thống kê",
  "Marketing",
  "Quản trị",
  "Tài chính",
  "MIS",
  "Luật",
  "Ngoại ngữ"
] as const;

export type Category = (typeof CATEGORIES)[number];

export const COLOR_THEMES = [
  "accounting",
  "economics",
  "statistics",
  "marketing",
  "management",
  "finance",
  "law",
  "mis",
  "languages"
] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number];

export const CATEGORY_THEME_MAP: Record<Category, ColorTheme> = {
  "Kế toán": "accounting",
  "Kinh tế": "economics",
  "Thống kê": "statistics",
  "Marketing": "marketing",
  "Quản trị": "management",
  "Tài chính": "finance",
  "MIS": "mis",
  "Luật": "law",
  "Ngoại ngữ": "languages"
};

export interface Subject {
  readonly id: string;
  readonly code?: string;
  readonly slug: string;
  readonly name: string;
  readonly category: Category;
  readonly facultyGroup: string;
  readonly colorTheme: ColorTheme;
}

export const CANONICAL_SUBJECTS: readonly Subject[] = [
  // Kế toán - Kiểm toán
  {
    id: "sub-kttc1",
    slug: "ke-toan-tai-chinh-1",
    name: "Kế toán tài chính 1",
    category: "Kế toán",
    facultyGroup: "Kế toán - Kiểm toán",
    colorTheme: "accounting"
  },
  {
    id: "sub-nlkt",
    slug: "nguyen-ly-ke-toan",
    name: "Nguyên lý kế toán",
    category: "Kế toán",
    facultyGroup: "Kế toán - Kiểm toán",
    colorTheme: "accounting"
  },
  {
    id: "sub-ktqt",
    slug: "ke-toan-quan-tri",
    name: "Kế toán quản trị",
    category: "Kế toán",
    facultyGroup: "Kế toán - Kiểm toán",
    colorTheme: "accounting"
  },
  {
    id: "sub-kttc2",
    slug: "ke-toan-tai-chinh-2",
    name: "Kế toán tài chính 2",
    category: "Kế toán",
    facultyGroup: "Kế toán - Kiểm toán",
    colorTheme: "accounting"
  },
  {
    id: "sub-ktcb",
    slug: "kiem-toan-can-ban",
    name: "Kiểm toán căn bản",
    category: "Kế toán",
    facultyGroup: "Kế toán - Kiểm toán",
    colorTheme: "accounting"
  },

  // Kinh tế - Định lượng
  {
    id: "sub-ktvm",
    slug: "kinh-te-vi-mo",
    name: "Kinh tế vi mô",
    category: "Kinh tế",
    facultyGroup: "Kinh tế - Định lượng",
    colorTheme: "economics"
  },
  {
    id: "sub-ktvm-macro",
    slug: "kinh-te-vi-mo-macro",
    name: "Kinh tế vĩ mô",
    category: "Kinh tế",
    facultyGroup: "Kinh tế - Định lượng",
    colorTheme: "economics"
  },
  {
    id: "sub-xstk",
    slug: "xac-suat-thong-ke",
    name: "Xác suất thống kê",
    category: "Thống kê",
    facultyGroup: "Kinh tế - Định lượng",
    colorTheme: "statistics"
  },
  {
    id: "sub-tcc",
    slug: "toan-cao-cap",
    name: "Toán cao cấp",
    category: "Thống kê",
    facultyGroup: "Kinh tế - Định lượng",
    colorTheme: "statistics"
  },
  {
    id: "sub-tkt",
    slug: "toan-kinh-te",
    name: "Toán kinh tế",
    category: "Thống kê",
    facultyGroup: "Kinh tế - Định lượng",
    colorTheme: "statistics"
  },
  {
    id: "sub-ktl",
    slug: "kinh-te-luong",
    name: "Kinh tế lượng",
    category: "Thống kê",
    facultyGroup: "Kinh tế - Định lượng",
    colorTheme: "statistics"
  },

  // Marketing - Quản trị
  {
    id: "sub-mkcb",
    slug: "marketing-can-ban",
    name: "Marketing căn bản",
    category: "Marketing",
    facultyGroup: "Marketing - Quản trị",
    colorTheme: "marketing"
  },
  {
    id: "sub-mkdv",
    slug: "marketing-dich-vu",
    name: "Marketing dịch vụ",
    category: "Marketing",
    facultyGroup: "Marketing - Quản trị",
    colorTheme: "marketing"
  },
  {
    id: "sub-hvntd",
    slug: "hanh-vi-nguoi-tieu-dung",
    name: "Hành vi người tiêu dùng",
    category: "Marketing",
    facultyGroup: "Marketing - Quản trị",
    colorTheme: "marketing"
  },
  {
    id: "sub-qth",
    slug: "quan-tri-hoc",
    name: "Quản trị học",
    category: "Quản trị",
    facultyGroup: "Marketing - Quản trị",
    colorTheme: "management"
  },
  {
    id: "sub-qtcl",
    slug: "quan-tri-chien-luoc",
    name: "Quản trị chiến lược",
    category: "Quản trị",
    facultyGroup: "Marketing - Quản trị",
    colorTheme: "management"
  },
  {
    id: "sub-qtnnl",
    slug: "quan-tri-nguon-nhan-luc",
    name: "Quản trị nguồn nhân lực",
    category: "Quản trị",
    facultyGroup: "Marketing - Quản trị",
    colorTheme: "management"
  },

  // Tài chính - Ngân hàng
  {
    id: "sub-tcdn",
    slug: "tai-chinh-doanh-nghiep",
    name: "Tài chính doanh nghiệp",
    category: "Tài chính",
    facultyGroup: "Tài chính - Ngân hàng",
    colorTheme: "finance"
  },
  {
    id: "sub-tctt",
    slug: "tai-chinh-tien-te",
    name: "Tài chính tiền tệ",
    category: "Tài chính",
    facultyGroup: "Tài chính - Ngân hàng",
    colorTheme: "finance"
  },
  {
    id: "sub-nhtm",
    slug: "ngan-hang-thuong-mai",
    name: "Ngân hàng thương mại",
    category: "Tài chính",
    facultyGroup: "Tài chính - Ngân hàng",
    colorTheme: "finance"
  },
  {
    id: "sub-thue",
    slug: "thue",
    name: "Thuế",
    category: "Tài chính",
    facultyGroup: "Tài chính - Ngân hàng",
    colorTheme: "finance"
  },
  {
    id: "sub-tttc",
    slug: "thi-truong-tai-chinh",
    name: "Thị trường tài chính",
    category: "Tài chính",
    facultyGroup: "Tài chính - Ngân hàng",
    colorTheme: "finance"
  },

  // MIS / Công nghệ / Dữ liệu
  {
    id: "sub-csdl",
    slug: "co-so-du-lieu",
    name: "Cơ sở dữ liệu",
    category: "MIS",
    facultyGroup: "MIS / Công nghệ / Dữ liệu",
    colorTheme: "mis"
  },
  {
    id: "sub-htttql",
    slug: "he-thong-thong-tin-quan-ly",
    name: "Hệ thống thông tin quản lý",
    category: "MIS",
    facultyGroup: "MIS / Công nghệ / Dữ liệu",
    colorTheme: "mis"
  },
  {
    id: "sub-pttkht",
    slug: "phan-tich-thiet-ke-he-thong",
    name: "Phân tích thiết kế hệ thống",
    category: "MIS",
    facultyGroup: "MIS / Công nghệ / Dữ liệu",
    colorTheme: "mis"
  },
  {
    id: "sub-tmdt",
    slug: "thuong-mai-dien-tu",
    name: "Thương mại điện tử",
    category: "MIS",
    facultyGroup: "MIS / Công nghệ / Dữ liệu",
    colorTheme: "mis"
  },

  // Luật / Ngoại ngữ
  {
    id: "sub-lkt",
    slug: "luat-kinh-te",
    name: "Luật kinh tế",
    category: "Luật",
    facultyGroup: "Luật / Ngoại ngữ / Khác",
    colorTheme: "law"
  },
  {
    id: "sub-tatm",
    slug: "tieng-anh-thuong-mai",
    name: "Tiếng Anh thương mại",
    category: "Ngoại ngữ",
    facultyGroup: "Luật / Ngoại ngữ / Khác",
    colorTheme: "languages"
  }
] as const;

export function findSubjectBySlug(slug: string): Subject | undefined {
  const normalized = normalizeSlug(slug);
  return CANONICAL_SUBJECTS.find((s) => s.slug === normalized);
}

export function findSubjectByName(name: string): Subject | undefined {
  const trimmed = name.trim().toLowerCase();
  return CANONICAL_SUBJECTS.find((s) => s.name.toLowerCase() === trimmed);
}

/**
 * Normalizes an arbitrary text string or raw slug into a safe lowercase kebab-case slug.
 */
export function normalizeSlug(input: string): string {
  if (!input) return "";

  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // remove invalid characters
    .replace(/[\s_]+/g, "-") // replace spaces and underscores with hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

/**
 * Validates whether a given string is a valid kebab-case slug.
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== "string") return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

