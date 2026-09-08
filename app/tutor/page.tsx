import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import { Suspense } from "react";
import { listTutors, parseCatalogFilters } from "@/lib/repositories/catalog-repository";
import { TutorsCatalogClient } from "./tutors-catalog-client";
import type { CatalogFilters, CatalogPage, PublishedTutor } from "@/lib/domain/catalog";

export const revalidate = 60;

export async function loadTutorsCatalogPage(
  params: Record<string, string | string[] | undefined>,
  loader: (filters: CatalogFilters) => Promise<CatalogPage<PublishedTutor>> = listTutors
) {
  const filters = parseCatalogFilters(params);
  return { filters, page: await loader(filters) };
}

export default async function TutorsCatalogPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}, loader: (filters: CatalogFilters) => Promise<CatalogPage<PublishedTutor>> = listTutors) {
  const { filters, page: tutors } = await loadTutorsCatalogPage((await searchParams) ?? {}, loader);

  return (
    <CatalogPageShell>
      <Suspense fallback={<div className="min-h-[400px]" />}>
        <TutorsCatalogClient initialTutors={tutors.items} pagination={tutors} initialFilters={filters} />
      </Suspense>
    </CatalogPageShell>
  );
}
