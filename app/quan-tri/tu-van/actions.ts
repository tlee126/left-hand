"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getAccountAccess } from "@/lib/auth/session";
import {
  isValidUuid,
  isValidConsultationStatusTransition,
  updateConsultationStatus,
  VALID_CONSULTATION_STATUSES,
  type ConsultationStatus
} from "@/lib/repositories/consultation-repository";

const INBOX_PATH = "/quan-tri/tu-van";

export async function updateConsultationStatusAction(
  id: string,
  formData: FormData
): Promise<void> {
  const access = await getAccountAccess();

  if (access.status === "unauthenticated") {
    redirect(`/dang-nhap?next=${INBOX_PATH}/${id}`);
  }

  if (access.status !== "approved" || access.profile?.role !== "admin") {
    notFound();
  }

  const rawStatus = formData.get("status");
  const rawCurrentStatus = formData.get("currentStatus");
  const rawVersion = formData.get("version");
  const isValidStatus =
    typeof rawStatus === "string" &&
    VALID_CONSULTATION_STATUSES.includes(rawStatus as ConsultationStatus);
  const isValidCurrentStatus =
    typeof rawCurrentStatus === "string" &&
    VALID_CONSULTATION_STATUSES.includes(rawCurrentStatus as ConsultationStatus);
  const version =
    typeof rawVersion === "string" && /^\d+$/.test(rawVersion)
      ? Number(rawVersion)
      : Number.NaN;

  if (
    !isValidUuid(id) ||
    !isValidStatus ||
    !isValidCurrentStatus ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    !isValidConsultationStatusTransition(rawCurrentStatus, rawStatus)
  ) {
    redirect(`${INBOX_PATH}/${id}?error=1`);
  }

  let updateFailed = false;
  let updateConflict = false;
  try {
    const updated = await updateConsultationStatus(
      id,
      rawStatus as ConsultationStatus,
      version,
      rawCurrentStatus as ConsultationStatus
    );
    if (!updated) {
      updateConflict = true;
    }
  } catch {
    updateFailed = true;
  }

  if (updateConflict) {
    redirect(`${INBOX_PATH}/${id}?conflict=1`);
  }

  if (updateFailed) {
    redirect(`${INBOX_PATH}/${id}?error=1`);
  }

  revalidatePath(`${INBOX_PATH}/${id}`);
  revalidatePath(INBOX_PATH);
  redirect(`${INBOX_PATH}/${id}?success=1`);
}
