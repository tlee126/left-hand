"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getAccountAccess } from "@/lib/auth/session";
import {
  isValidUuid,
  updateAccountApproval,
  type AccountApprovalStatus
} from "@/lib/repositories/account-approval-repository";

const ACCOUNT_APPROVAL_PATH = "/quan-tri/tai-khoan";
const APPROVAL_ACTION_STATUSES: readonly AccountApprovalStatus[] = [
  "approved",
  "rejected",
  "suspended"
];
const MAX_REJECTION_REASON_LENGTH = 500;

function isApprovalActionStatus(
  value: unknown
): value is Exclude<AccountApprovalStatus, "pending"> {
  return (
    typeof value === "string" &&
    APPROVAL_ACTION_STATUSES.includes(value as AccountApprovalStatus)
  );
}

export async function updateAccountApprovalAction(
  id: string,
  formData: FormData
): Promise<void> {
  const access = await getAccountAccess();

  if (access.status === "unauthenticated") {
    redirect(`/dang-nhap?next=${ACCOUNT_APPROVAL_PATH}`);
  }

  if (access.status !== "approved" || access.profile?.role !== "admin") {
    notFound();
  }

  if (access.user?.id === id || access.profile?.id === id) {
    notFound();
  }

  const rawStatus = formData.get("status");
  if (!isValidUuid(id) || !isApprovalActionStatus(rawStatus)) {
    redirect(`${ACCOUNT_APPROVAL_PATH}?error=1`);
  }

  const rawRejectionReason = formData.get("rejection_reason");
  if (
    rawRejectionReason !== null &&
    typeof rawRejectionReason !== "string"
  ) {
    redirect(`${ACCOUNT_APPROVAL_PATH}?error=1`);
  }

  const rejectionReason =
    rawStatus === "rejected"
      ? (rawRejectionReason ?? "")
          .trim()
          .slice(0, MAX_REJECTION_REASON_LENGTH) || null
      : null;

  let updated: Awaited<ReturnType<typeof updateAccountApproval>>;
  try {
    updated = await updateAccountApproval(id, {
      account_status: rawStatus,
      rejection_reason: rejectionReason
    });
  } catch {
    redirect(`${ACCOUNT_APPROVAL_PATH}?error=1`);
  }

  if (!updated) {
    redirect(`${ACCOUNT_APPROVAL_PATH}?error=not_found`);
  }

  revalidatePath(ACCOUNT_APPROVAL_PATH);
  redirect(`${ACCOUNT_APPROVAL_PATH}?success=1`);
}
