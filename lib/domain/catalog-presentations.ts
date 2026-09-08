import { CATEGORIES, type Category, type ColorTheme } from "./subjects";
import type { PublishedCourse, PublishedMaterial } from "./catalog";
import type { EnrollmentStatus } from "./product-types";

/** The only catalog fields needed by the homepage featured-resource client. */
export interface FeaturedResourceItem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly subject: string;
  readonly category: Category;
  readonly type: "TÀI LIỆU" | "KHÓA HỌC";
  readonly description: string;
  readonly amountVND: number | null;
  readonly originalAmountVND: number | null;
  readonly meta: string;
  readonly bonus?: string;
  readonly rating: number;
  readonly isHot?: boolean;
  readonly colorTheme: ColorTheme;
  readonly tags: readonly string[];
  readonly status?: EnrollmentStatus;
}

type CatalogResource =
  | { readonly item: PublishedMaterial; readonly type: "TÀI LIỆU" }
  | { readonly item: PublishedCourse; readonly type: "KHÓA HỌC" };

function toFeaturedResource({ item, type }: CatalogResource): FeaturedResourceItem {
  if (type === "TÀI LIỆU") {
    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      subject: item.subject.name,
      category: item.category,
      type,
      description: item.description,
      amountVND: item.pricing.amountVND,
      originalAmountVND: item.pricing.originalAmountVND,
      meta: `${item.material.pages} trang`,
      bonus: item.material.tags[0],
      rating: item.rating,
      isHot: item.isHot,
      colorTheme: item.colorTheme,
      tags: [...item.material.tags]
    };
  }

  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    subject: item.subject.name,
    category: item.category,
    type,
    description: item.description,
    amountVND: item.pricing.amountVND,
    originalAmountVND: item.pricing.originalAmountVND,
    meta: `${item.course.sessions} buổi`,
    bonus: item.course.tags[0],
    rating: item.rating,
    isHot: item.isHot,
    colorTheme: item.colorTheme,
    tags: [...item.course.tags],
    status: item.course.enrollmentStatus
  };
}

/** Select and project homepage resources on the server before crossing the client boundary. */
export function buildFeaturedResources(
  materials: readonly PublishedMaterial[],
  courses: readonly PublishedCourse[]
): FeaturedResourceItem[] {
  const bestByCategory = new Map<Category, CatalogResource>();

  for (const category of CATEGORIES) {
    const categoryMaterials = materials.filter((item) => item.category === category);
    const categoryCourses = courses.filter((item) => item.category === category);
    const hotMaterial = categoryMaterials.find((item) => item.isHot);
    const openCourse = categoryCourses.find((item) => item.course.enrollmentStatus === "open");
    const selected = hotMaterial
      ? { item: hotMaterial, type: "TÀI LIỆU" as const }
      : openCourse
        ? { item: openCourse, type: "KHÓA HỌC" as const }
        : categoryMaterials[0]
          ? { item: categoryMaterials[0], type: "TÀI LIỆU" as const }
          : categoryCourses[0]
            ? { item: categoryCourses[0], type: "KHÓA HỌC" as const }
            : null;
    if (selected) bestByCategory.set(category, selected);
  }

  const selectedKeys = new Set<string>();
  const selectedItems: CatalogResource[] = [];
  for (const category of CATEGORIES) {
    const representation = bestByCategory.get(category);
    if (representation) {
      selectedItems.push(representation);
      selectedKeys.add(representation.item.id);
    }
  }

  const remainingHotMaterials: CatalogResource[] = materials
    .filter((item) => item.isHot && !selectedKeys.has(item.id))
    .map((item) => ({ item, type: "TÀI LIỆU" as const }));
  const remainingOpenCourses: CatalogResource[] = courses
    .filter((item) => item.course.enrollmentStatus === "open" && !selectedKeys.has(item.id))
    .map((item) => ({ item, type: "KHÓA HỌC" as const }));
  const remainingOthers: CatalogResource[] = [
    ...materials.filter((item) => !selectedKeys.has(item.id)).map((item) => ({ item, type: "TÀI LIỆU" as const })),
    ...courses.filter((item) => !selectedKeys.has(item.id)).map((item) => ({ item, type: "KHÓA HỌC" as const }))
  ];

  return [...selectedItems, ...remainingHotMaterials, ...remainingOpenCourses, ...remainingOthers]
    .slice(0, 12)
    .map(toFeaturedResource);
}
