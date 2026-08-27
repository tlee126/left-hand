import { createClient } from "@/lib/supabase/server";

export interface StudentProfile {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  faculty: string | null;
  major: string | null;
  studentCode: string | null;
  avatarUrl: string | null;
  gpaGoal: number | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  fullName?: string;
  faculty?: string | null;
  major?: string | null;
  gpaGoal?: number | null;
}

export interface ProfileValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  sanitized?: {
    fullName?: string;
    faculty?: string | null;
    major?: string | null;
    gpaGoal?: number | null;
  };
}

/**
 * Validates editable profile input fields.
 * Rejects invalid GPA values, negative numbers, numbers > 4.0, or oversized text.
 */
export function validateProfileInput(input: unknown): ProfileValidationResult {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== "object") {
    return {
      valid: false,
      errors: { _form: "Dữ liệu cập nhật không hợp lệ." }
    };
  }

  const record = input as Record<string, unknown>;

  // Check for rejected privileged keys
  const forbiddenKeys = [
    "id",
    "role",
    "email",
    "payment_status",
    "entitlement_status",
    "owner_id",
    "is_admin",
    "created_at",
    "updated_at"
  ];

  for (const key of forbiddenKeys) {
    if (key in record) {
      errors[key] = `Trường ${key} không được phép cập nhật bởi người dùng.`;
    }
  }

  let sanitizedFullName: string | undefined;
  if ("fullName" in record || "full_name" in record) {
    const rawName = (record.fullName ?? record.full_name) as unknown;
    if (typeof rawName !== "string" || rawName.trim().length === 0) {
      errors.fullName = "Họ và tên không được để trống.";
    } else if (rawName.trim().length > 100) {
      errors.fullName = "Họ và tên tối đa 100 ký tự.";
    } else {
      sanitizedFullName = rawName.trim();
    }
  }

  let sanitizedFaculty: string | null | undefined;
  if ("faculty" in record) {
    const rawFaculty = record.faculty;
    if (rawFaculty === null || rawFaculty === "") {
      sanitizedFaculty = null;
    } else if (typeof rawFaculty === "string") {
      if (rawFaculty.trim().length > 100) {
        errors.faculty = "Tên khoa tối đa 100 ký tự.";
      } else {
        sanitizedFaculty = rawFaculty.trim();
      }
    } else {
      errors.faculty = "Khoa phải là chuỗi văn bản.";
    }
  }

  let sanitizedMajor: string | null | undefined;
  if ("major" in record) {
    const rawMajor = record.major;
    if (rawMajor === null || rawMajor === "") {
      sanitizedMajor = null;
    } else if (typeof rawMajor === "string") {
      if (rawMajor.trim().length > 100) {
        errors.major = "Tên chuyên ngành tối đa 100 ký tự.";
      } else {
        sanitizedMajor = rawMajor.trim();
      }
    } else {
      errors.major = "Chuyên ngành phải là chuỗi văn bản.";
    }
  }

  let sanitizedGpaGoal: number | null | undefined;
  if ("gpaGoal" in record || "gpa_goal" in record) {
    const rawGpa = (record.gpaGoal ?? record.gpa_goal) as unknown;
    if (rawGpa === null || rawGpa === "") {
      sanitizedGpaGoal = null;
    } else {
      const numGpa = typeof rawGpa === "number" ? rawGpa : Number(rawGpa);
      if (Number.isNaN(numGpa) || !Number.isFinite(numGpa)) {
        errors.gpaGoal = "Mục tiêu GPA phải là một số hợp lệ.";
      } else if (numGpa < 0.0 || numGpa > 4.0) {
        errors.gpaGoal = "Mục tiêu GPA phải nằm trong khoảng từ 0.0 đến 4.0.";
      } else {
        // Round to 2 decimal places
        sanitizedGpaGoal = Math.round(numGpa * 100) / 100;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    sanitized: {
      fullName: sanitizedFullName,
      faculty: sanitizedFaculty,
      major: sanitizedMajor,
      gpaGoal: sanitizedGpaGoal
    }
  };
}

/**
 * Loads the student profile for the specified user ID from Supabase.
 * Server-only helper that never accepts owner_id from client state.
 */
export async function getProfileByUserId(
  userId: string
): Promise<StudentProfile | null> {
  if (!userId || typeof userId !== "string") {
    return null;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      fullName: data.full_name,
      email: data.email,
      phone: data.phone,
      faculty: data.faculty,
      major: data.major,
      studentCode: data.student_code,
      avatarUrl: data.avatar_url,
      gpaGoal: data.gpa_goal ? Number(data.gpa_goal) : null,
      role: data.role || "student",
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch {
    return null;
  }
}

/**
 * Updates the authenticated user's own profile.
 * Server-only helper that derives ownership strictly from the authenticated server user ID.
 */
export async function updateOwnProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<{ success: boolean; profile?: StudentProfile; error?: string }> {
  if (!userId || typeof userId !== "string") {
    return { success: false, error: "Người dùng chưa xác thực." };
  }

  const validation = validateProfileInput(input);
  if (!validation.valid || !validation.sanitized) {
    const firstError = Object.values(validation.errors)[0] || "Dữ liệu không hợp lệ.";
    return { success: false, error: firstError };
  }

  try {
    const supabase = await createClient();

    const updatePayload: {
      full_name?: string;
      faculty?: string | null;
      major?: string | null;
      gpa_goal?: number | null;
      updated_at?: string;
    } = {
      updated_at: new Date().toISOString()
    };

    if (validation.sanitized.fullName !== undefined) {
      updatePayload.full_name = validation.sanitized.fullName;
    }
    if (validation.sanitized.faculty !== undefined) {
      updatePayload.faculty = validation.sanitized.faculty;
    }
    if (validation.sanitized.major !== undefined) {
      updatePayload.major = validation.sanitized.major;
    }
    if (validation.sanitized.gpaGoal !== undefined) {
      updatePayload.gpa_goal = validation.sanitized.gpaGoal;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select()
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message || "Không thể cập nhật hồ sơ." };
    }

    if (!data) {
      // Profile might not exist yet; try creating it
      const insertPayload = {
        id: userId,
        full_name: validation.sanitized.fullName || "Học viên",
        faculty: validation.sanitized.faculty || null,
        major: validation.sanitized.major || null,
        gpa_goal: validation.sanitized.gpaGoal || null,
        role: "student"
      };

      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert(insertPayload)
        .select()
        .single();

      if (insertError || !inserted) {
        return { success: false, error: insertError?.message || "Không thể khởi tạo hồ sơ." };
      }

      return {
        success: true,
        profile: {
          id: inserted.id,
          fullName: inserted.full_name,
          email: inserted.email,
          phone: inserted.phone,
          faculty: inserted.faculty,
          major: inserted.major,
          studentCode: inserted.student_code,
          avatarUrl: inserted.avatar_url,
          gpaGoal: inserted.gpa_goal ? Number(inserted.gpa_goal) : null,
          role: inserted.role || "student",
          createdAt: inserted.created_at,
          updatedAt: inserted.updated_at
        }
      };
    }

    return {
      success: true,
      profile: {
        id: data.id,
        fullName: data.full_name,
        email: data.email,
        phone: data.phone,
        faculty: data.faculty,
        major: data.major,
        studentCode: data.student_code,
        avatarUrl: data.avatar_url,
        gpaGoal: data.gpa_goal ? Number(data.gpa_goal) : null,
        role: data.role || "student",
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi hệ thống khi cập nhật hồ sơ.";
    return { success: false, error: msg };
  }
}
