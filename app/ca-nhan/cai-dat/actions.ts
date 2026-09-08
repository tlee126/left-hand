"use server";

import { revalidatePath } from "next/cache";
import { getAccountAccess } from "@/lib/auth/session";
import { mapProfileError } from "@/lib/auth/error-mapper";
import { updateOwnProfile, validateProfileInput } from "@/lib/repositories/profile-repository";

export interface ProfileActionResult {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export async function updateProfileAction(
  _prevState: ProfileActionResult,
  formData: FormData
): Promise<ProfileActionResult> {
  const access = await getAccountAccess();

  if (access.status === "unauthenticated") {
    return {
      success: false,
      message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn. Vui lòng đăng nhập lại."
    };
  }

  if (access.status === "profile_missing") {
    return { success: false, message: "Không tìm thấy hồ sơ tài khoản. Vui lòng liên hệ quản trị viên." };
  }

  if (access.status !== "approved" || !access.user) {
    return {
      success: false,
      message:
        access.status === "pending"
          ? "Tài khoản đang chờ quản trị viên duyệt."
          : access.status === "rejected"
            ? "Tài khoản chưa được duyệt. Vui lòng liên hệ quản trị viên."
            : "Tài khoản đang bị tạm khóa. Vui lòng liên hệ quản trị viên."
    };
  }

  const rawFullName = formData.get("fullName");
  const rawFaculty = formData.get("faculty");
  const rawMajor = formData.get("major");
  const rawGpaGoal = formData.get("gpaGoal");

  const input = {
    fullName: typeof rawFullName === "string" ? rawFullName : undefined,
    faculty: typeof rawFaculty === "string" ? rawFaculty : undefined,
    major: typeof rawMajor === "string" ? rawMajor : undefined,
    gpaGoal: typeof rawGpaGoal === "string" && rawGpaGoal.trim() !== "" ? Number(rawGpaGoal) : null
  };

  const validation = validateProfileInput(input);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      message: Object.values(validation.errors)[0] || "Dữ liệu nhập vào chưa chính xác."
    };
  }

  const result = await updateOwnProfile(access.user.id, input);

  if (!result.success) {
    return {
      success: false,
      message: mapProfileError(result.error).message
    };
  }

  revalidatePath("/ca-nhan");
  revalidatePath("/ca-nhan/cai-dat");

  return {
    success: true,
    message: "Cập nhật thông tin học tập thành công!"
  };
}
