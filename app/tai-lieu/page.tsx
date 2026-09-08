import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import { Suspense } from "react";
import { listMaterials, parseCatalogFilters } from "@/lib/repositories/catalog-repository";
import { MaterialsCatalogClient } from "./materials-catalog-client";
import type { CatalogFilters, CatalogPage, PublishedMaterial } from "@/lib/domain/catalog";

export const revalidate = 60;

export async function loadMaterialsCatalogPage(
  params: Record<string, string | string[] | undefined>,
  loader: (filters: CatalogFilters) => Promise<CatalogPage<PublishedMaterial>> = listMaterials
) {
  const filters = parseCatalogFilters(params);
  return { filters, page: await loader(filters) };
}

export default async function MaterialsCatalogPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}, loader: (filters: CatalogFilters) => Promise<CatalogPage<PublishedMaterial>> = listMaterials) {
  const { filters, page: materials } = await loadMaterialsCatalogPage((await searchParams) ?? {}, loader);

  return (
    <CatalogPageShell>
      <Suspense fallback={<div className="min-h-[400px]" />}>
        <MaterialsCatalogClient initialMaterials={materials.items} pagination={materials} initialFilters={filters} />
      </Suspense>
    </CatalogPageShell>
  );
}
