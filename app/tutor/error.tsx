"use client";

import { CatalogErrorState } from "@/components/catalog/catalog-error-state";

export default function TutorsError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <CatalogErrorState context="tutors" reset={reset} />;
}
