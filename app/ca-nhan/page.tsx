import { redirect } from "next/navigation";
import { getAccountAccess } from "@/lib/auth/session";
import type { StudyPlan, StudyPlanSubject } from "@/lib/repositories/study-plan-repository";
import type { StudentMaterialDiscoveryData } from "@/lib/repositories/student-material-discovery-repository";
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

function getVietnamDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function shiftVietnamDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export default async function StudentDashboardPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
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
    const originalPath = queryString ? `/ca-nhan?${queryString}` : "/ca-nhan";
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

  if (!access.user) {
    redirect("/dang-nhap?next=%2Fca-nhan");
  }

  const todayDate = getVietnamDate();
  const historyStartDate = (() => {
    return shiftVietnamDate(todayDate, -90);
  })();
  const futureEndDate = shiftVietnamDate(todayDate, 30);
  let initialStudyPlans: StudyPlan[] = [];
  let studyPlanSubjects: StudyPlanSubject[] = [];
  let studyPlanLoadError = false;
  let materialDiscovery: StudentMaterialDiscoveryData = { subjects: [], directMaterials: [] };
  let materialDiscoveryLoadError = false;
  try {
    const [{ listStudyPlanSubjects, listStudyPlans }, { getStudentMaterialDiscovery }] = await Promise.all([
      import("@/lib/repositories/study-plan-repository"),
      import("@/lib/repositories/student-material-discovery-repository")
    ]);
    const [plansResult, subjectsResult, discoveryResult] = await Promise.allSettled([
      listStudyPlans(access.user.id, { startDate: historyStartDate, endDate: futureEndDate }),
      listStudyPlanSubjects(),
      getStudentMaterialDiscovery(access.user.id)
    ]);
    if (plansResult.status === "fulfilled") initialStudyPlans = plansResult.value;
    else studyPlanLoadError = true;
    if (subjectsResult.status === "fulfilled") studyPlanSubjects = subjectsResult.value;
    if (discoveryResult.status === "fulfilled") materialDiscovery = discoveryResult.value;
    else materialDiscoveryLoadError = true;
  } catch {
    studyPlanLoadError = true;
    materialDiscoveryLoadError = true;
  }
  return (
    <StudentDashboardClient
      initialProfile={access.profile}
      authUserEmail={access.user?.email ?? null}
      initialStudyPlans={initialStudyPlans}
      studyPlanSubjects={studyPlanSubjects}
      todayDate={todayDate}
      studyPlanLoadError={studyPlanLoadError}
      materialDiscovery={materialDiscovery}
      materialDiscoveryLoadError={materialDiscoveryLoadError}
    />
  );
}
