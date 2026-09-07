"use server";

import { revalidatePath } from "next/cache";
import { getAccountAccess } from "@/lib/auth/session";
import type { StudyPlan } from "@/lib/repositories/study-plan-repository";

export interface StudyPlanActionResult {
  success: boolean;
  message?: string;
  task?: StudyPlan;
}

const GENERIC_ERROR = "Không thể lưu kế hoạch học tập. Vui lòng thử lại sau.";
const VALIDATION_ERROR = "Thông tin kế hoạch chưa hợp lệ.";

function readFormFields(formData: FormData, allowed: ReadonlySet<string>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!allowed.has(key) || typeof value !== "string" || Object.prototype.hasOwnProperty.call(values, key)) {
      const error = new Error("Invalid study plan form.");
      error.name = "StudyPlanInputError";
      throw error;
    }
    values[key] = value;
  }
  return values;
}

async function getApprovedStudentUserId(): Promise<string | null> {
  try {
    const access = await getAccountAccess();
    if (access.status !== "approved" || access.profile?.role !== "student" || !access.user) return null;
    return access.user.id;
  } catch {
    return null;
  }
}

export async function createStudyPlanAction(
  _previousState: StudyPlanActionResult,
  formData: FormData
): Promise<StudyPlanActionResult> {
  const userId = await getApprovedStudentUserId();
  if (!userId) return { success: false, message: "Bạn chưa đủ điều kiện truy cập khu học tập." };

  try {
    const { createStudyPlan, validateCreateStudyPlanInput } = await import("@/lib/repositories/study-plan-repository");
    const fields = readFormFields(formData, new Set(["requestKey", "taskDate", "title", "subjectId", "durationMinutes", "status"]));
    const input = {
      requestKey: fields.requestKey,
      taskDate: fields.taskDate,
      title: fields.title,
      subjectId: fields.subjectId,
      durationMinutes: Number(fields.durationMinutes),
      ...(fields.status === undefined ? {} : { status: fields.status })
    };
    const validated = validateCreateStudyPlanInput(input);
    const task = await createStudyPlan(userId, validated);
    revalidatePath("/ca-nhan");
    return { success: true, message: "Đã thêm việc học vào kế hoạch.", task };
  } catch (error) {
    if (error instanceof Error && error.name === "StudyPlanInputError") return { success: false, message: VALIDATION_ERROR };
    return { success: false, message: GENERIC_ERROR };
  }
}

export async function updateStudyPlanAction(
  _previousState: StudyPlanActionResult,
  formData: FormData
): Promise<StudyPlanActionResult> {
  const userId = await getApprovedStudentUserId();
  if (!userId) return { success: false, message: "Bạn chưa đủ điều kiện truy cập khu học tập." };

  try {
    const { updateStudyPlan, validateUpdateStudyPlanInput } = await import("@/lib/repositories/study-plan-repository");
    const fields = readFormFields(formData, new Set(["id", "taskDate", "title", "subjectId", "durationMinutes", "status"]));
    const { id, ...rawInput } = fields;
    const input = {
      taskDate: rawInput.taskDate,
      title: rawInput.title,
      subjectId: rawInput.subjectId,
      durationMinutes: Number(rawInput.durationMinutes),
      status: rawInput.status
    };
    const validated = validateUpdateStudyPlanInput(input);
    const task = await updateStudyPlan(userId, id, validated);
    revalidatePath("/ca-nhan");
    return { success: true, message: "Đã cập nhật kế hoạch học tập.", task };
  } catch (error) {
    if (error instanceof Error && error.name === "StudyPlanInputError") return { success: false, message: VALIDATION_ERROR };
    return { success: false, message: GENERIC_ERROR };
  }
}

export async function completeStudyPlanAction(
  _previousState: StudyPlanActionResult,
  formData: FormData
): Promise<StudyPlanActionResult> {
  const userId = await getApprovedStudentUserId();
  if (!userId) return { success: false, message: "Bạn chưa đủ điều kiện truy cập khu học tập." };

  try {
    const { markStudyPlanCompleted, validateStudyPlanId } = await import("@/lib/repositories/study-plan-repository");
    const fields = readFormFields(formData, new Set(["id"]));
    const task = await markStudyPlanCompleted(userId, validateStudyPlanId(fields.id));
    revalidatePath("/ca-nhan");
    return { success: true, message: "Đã đánh dấu hoàn thành.", task };
  } catch (error) {
    if (error instanceof Error && error.name === "StudyPlanInputError") return { success: false, message: VALIDATION_ERROR };
    return { success: false, message: GENERIC_ERROR };
  }
}
