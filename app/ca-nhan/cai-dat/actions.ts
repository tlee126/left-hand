"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
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
  const user = await getAuthUser();

  if (!user) {
    return {
      success: false,
      message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn. Vui lòng đăng nhập lại."
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

  const result = await updateOwnProfile(user.id, input);

  if (!result.success) {
    return {
      success: false,
      message: result.error || "Không thể lưu thông tin hồ sơ. Vui lòng thử lại sau."
    };
  }

  revalidatePath("/ca-nhan");
  revalidatePath("/ca-nhan/cai-dat");

  return {
    success: true,
    message: "Cập nhật thông tin học tập thành công!"
  };
}
