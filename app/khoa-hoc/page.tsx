import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import { Suspense } from "react";
import { listCourses, parseCatalogFilters } from "@/lib/repositories/catalog-repository";
import { CoursesCatalogClient } from "./courses-catalog-client";
import type { CatalogFilters, CatalogPage, PublishedCourse } from "@/lib/domain/catalog";

export const revalidate = 60;

export async function loadCoursesCatalogPage(
  params: Record<string, string | string[] | undefined>,
  loader: (filters: CatalogFilters) => Promise<CatalogPage<PublishedCourse>> = listCourses
) {
  const filters = parseCatalogFilters(params);
  return { filters, page: await loader(filters) };
}

export default async function CoursesCatalogPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { filters, page: courses } = await loadCoursesCatalogPage((await searchParams) ?? {});

  return (
    <CatalogPageShell>
      <Suspense fallback={<div className="min-h-[400px]" />}>
        <CoursesCatalogClient initialCourses={courses.items} pagination={courses} initialFilters={filters} />
      </Suspense>
    </CatalogPageShell>
  );
}
