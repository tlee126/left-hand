import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { StudentDashboardClient } from "./dashboard-client";

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

export default async function StudentDashboardPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
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
    const originalPath = queryString ? `/ca-nhan?${queryString}` : "/ca-nhan";
    const safeNext = getSafeInternalRedirect(originalPath);

    redirect(`/dang-nhap?next=${encodeURIComponent(safeNext)}`);
  }

  return <StudentDashboardClient />;
}
