import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import { listPublishedMaterials } from "@/lib/repositories/catalog-repository";
import { MaterialsCatalogClient } from "./materials-catalog-client";

export const revalidate = 60;

export default async function MaterialsCatalogPage() {
  const materials = await listPublishedMaterials();

  return (
    <CatalogPageShell>
      <MaterialsCatalogClient initialMaterials={materials} />
    </CatalogPageShell>
  );
}
