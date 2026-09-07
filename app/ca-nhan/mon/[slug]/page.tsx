import { notFound, redirect } from "next/navigation";
import { getAccountAccess } from "@/lib/auth/session";
import { getAuthorizedStudentWorkspace } from "@/lib/repositories/student-workspace-repository";
import { SubjectWorkspaceClient } from "./workspace-client";

type LearningProgress = {
  user_id: string;
  product_id: string;
  item_type: "material" | "lesson";
  item_id: string;
  status: "not_started" | "in_progress" | "completed";
  watched_percent: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

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
  const access = await getAccountAccess();

  if (access.status === "unauthenticated") {
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

  if (access.status === "pending") {
    redirect("/cho-duyet");
  }

  if (access.status === "rejected") {
    redirect("/cho-duyet?status=rejected");
  }

  if (access.status === "suspended") {
    redirect("/cho-duyet?status=suspended");
  }

  if (access.status === "profile_missing") {
    redirect("/cho-duyet?status=missing-profile");
  }

  if (access.profile?.role === "admin") {
    redirect("/quan-tri");
  }

  let workspace;
  try {
    workspace = await getAuthorizedStudentWorkspace(access.user!.id, slug);
  } catch {
    notFound();
  }

  if (!workspace) {
    notFound();
  }

  const productIds = [...workspace.materials.map((material) => material.productId), ...workspace.courses.map((course) => course.productId)];
  let progress: LearningProgress[] = [];
  try {
    const { getLearningProgressForWorkspace } = await import("@/lib/repositories/learning-progress-repository");
    const progressByProduct = await Promise.all(
      [...new Set(productIds)].map((productId) => getLearningProgressForWorkspace(access.user!.id, productId))
    );
    progress = progressByProduct.flat();
  } catch {
    // Progress is additive to the already-authorized workspace. The client exposes a retryable save state.
    progress = [];
  }

  return progress.length > 0
    ? <SubjectWorkspaceClient workspace={{ ...workspace, progress }} />
    : <SubjectWorkspaceClient workspace={workspace} />;
}
