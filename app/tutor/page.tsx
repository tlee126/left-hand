import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import { listPublishedTutors } from "@/lib/repositories/catalog-repository";
import { TutorsCatalogClient } from "./tutors-catalog-client";

export const revalidate = 60;

export default async function TutorsCatalogPage() {
  const tutors = await listPublishedTutors();

  return (
    <CatalogPageShell>
      <TutorsCatalogClient initialTutors={tutors} />
    </CatalogPageShell>
  );
}
