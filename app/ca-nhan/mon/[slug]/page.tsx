import { notFound, redirect } from "next/navigation";
import { getAccountAccess } from "@/lib/auth/session";
import { getAuthorizedStudentWorkspace } from "@/lib/repositories/student-workspace-repository";
import { SubjectWorkspaceClient, UnavailableMaterial } from "./workspace-client";

const MATERIAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  version: number;
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

function getWorkspacePage(value: string | string[] | undefined): number | null {
  if (value === undefined) return 1;
  if (Array.isArray(value) || !/^\d+$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : null;
}

export default async function SubjectWorkspacePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const access = await getAccountAccess();

  if (access.status === "unauthenticated") {
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

  const page = getWorkspacePage(resolvedSearchParams.page);
  if (page === null) notFound();
  const requestedMaterialValue = resolvedSearchParams.material;
  const requestedMaterialId = typeof requestedMaterialValue === "string" && MATERIAL_UUID_PATTERN.test(requestedMaterialValue)
    ? requestedMaterialValue.toLowerCase()
    : null;

  let workspace;
  try {
    workspace = await getAuthorizedStudentWorkspace(access.user!.id, slug, page);
  } catch {
    notFound();
  }

  if (!workspace && requestedMaterialId) {
    return <StudentMaterialUnavailable />;
  }

  if (!workspace) {
    notFound();
  }

  const productIds = [...workspace.materials.map((material) => material.productId), ...workspace.courses.map((course) => course.productId)];
  let progress: LearningProgress[] = [];
  let progressUnavailable = false;
  try {
    const { getLearningProgressForProducts } = await import("@/lib/repositories/learning-progress-repository");
    progress = await getLearningProgressForProducts(access.user!.id, [...new Set(productIds)]);
  } catch {
    progressUnavailable = true;
  }

  const workspaceWithRequest = requestedMaterialId
    ? { ...workspace, initialMaterialId: requestedMaterialId, requestedMaterialUnavailable: !workspace.materials.some((material) => material.productId === requestedMaterialId) }
    : workspace;
  return progress.length > 0
    ? <SubjectWorkspaceClient workspace={{ ...workspaceWithRequest, progress }} />
    : <SubjectWorkspaceClient workspace={progressUnavailable ? { ...workspaceWithRequest, progressUnavailable } : workspaceWithRequest} />;
}

function StudentMaterialUnavailable() {
  return <UnavailableMaterial />;
}
