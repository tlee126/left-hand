"use client";

import { CatalogErrorState } from "@/components/catalog/catalog-error-state";

export default function CourseDetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CatalogErrorState context="course-detail" reset={reset} />;
}
