"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getAccountAccess } from "@/lib/auth/session";
import {
  isValidUuid,
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
  const isValidStatus =
    typeof rawStatus === "string" &&
    VALID_CONSULTATION_STATUSES.includes(rawStatus as ConsultationStatus);

  if (!isValidUuid(id) || !isValidStatus) {
    redirect(`${INBOX_PATH}/${id}?error=1`);
  }

  let updateFailed = false;
  try {
    const updated = await updateConsultationStatus(
      id,
      rawStatus as ConsultationStatus
    );
    if (!updated) {
      updateFailed = true;
    }
  } catch {
    updateFailed = true;
  }

  if (updateFailed) {
    redirect(`${INBOX_PATH}/${id}?error=1`);
  }

  revalidatePath(`${INBOX_PATH}/${id}`);
  revalidatePath(INBOX_PATH);
  redirect(`${INBOX_PATH}/${id}?success=1`);
}

