import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import { listPublishedCourses } from "@/lib/repositories/catalog-repository";
import { CoursesCatalogClient } from "./courses-catalog-client";

export const revalidate = 60;

export default async function CoursesCatalogPage() {
  const courses = await listPublishedCourses();

  return (
    <CatalogPageShell>
      <CoursesCatalogClient initialCourses={courses} />
    </CatalogPageShell>
  );
}
