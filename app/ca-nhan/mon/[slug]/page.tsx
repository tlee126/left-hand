import { notFound, redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { purchasedSubjects } from "@/data/student-demo";
import { SubjectWorkspaceClient } from "./workspace-client";

/**
 * Validates internal redirect target path to prevent open redirect vulnerabilities.
 */
function getSafeInternalRedirect(pathWithQuery: string): string {
  if (
    pathWithQuery.startsWith("/") &&
    !pathWithQuery.startsWith("//") &&
    !pathWithQuery.includes("\\") &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(pathWithQuery)
  ) {
    return pathWithQuery;
  }
  return "/ca-nhan";
}

export default async function SubjectWorkspacePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const user = await getAuthUser();

  if (!user) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const query = new URLSearchParams();

    Object.entries(resolvedSearchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => query.append(key, v));
      } else if (typeof value === "string") {
        query.append(key, value);
      }
    });

    const queryString = query.toString();
    const originalPath = queryString
      ? `/ca-nhan/mon/${slug}?${queryString}`
      : `/ca-nhan/mon/${slug}`;
    const safeNext = getSafeInternalRedirect(originalPath);

    redirect(`/dang-nhap?next=${encodeURIComponent(safeNext)}`);
  }

  const subject = purchasedSubjects.find((s) => s.slug === slug);

  if (!subject) {
    notFound();
  }

  return <SubjectWorkspaceClient slug={slug} initialSubject={subject} />;
}
