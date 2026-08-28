import { createClient } from "@/lib/supabase/server";

export type AccountStatus = "pending" | "approved" | "rejected" | "suspended";

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
  accountStatus: AccountStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectionReason: string | null;
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

const ALLOWED_INPUT_KEYS = new Set(["fullName", "faculty", "major", "gpaGoal"]);

/**
 * Validates editable profile input fields.
 * Rejects any unknown fields, privileged fields, invalid GPA values, negative numbers, numbers > 4.0, or oversized text.
 */
export function validateProfileInput(input: unknown): ProfileValidationResult {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      valid: false,
      errors: { _form: "Dữ liệu cập nhật không hợp lệ." }
    };
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record);

  // Strictly reject any unknown keys
  for (const key of keys) {
    if (!ALLOWED_INPUT_KEYS.has(key)) {
      errors[key] = `Trường "${key}" không được phép cập nhật hoặc không tồn tại.`;
    }
  }

  let sanitizedFullName: string | undefined;
  if ("fullName" in record) {
    const rawName = record.fullName;
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
  if ("gpaGoal" in record) {
    const rawGpa = record.gpaGoal;
    if (rawGpa === null || rawGpa === "") {
      sanitizedGpaGoal = null;
    } else {
      const numGpa = typeof rawGpa === "number" ? rawGpa : Number(rawGpa);
      if (Number.isNaN(numGpa) || !Number.isFinite(numGpa)) {
        errors.gpaGoal = "Mục tiêu GPA phải là một số hợp lệ.";
      } else if (numGpa < 0.0 || numGpa > 4.0) {
        errors.gpaGoal = "Mục tiêu GPA phải nằm trong khoảng từ 0.0 đến 4.0.";
      } else {
        // Round to 2 decimal places (preserves 0 correctly)
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

export interface ProfileRow {
  id?: string;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  faculty?: string | null;
  major?: string | null;
  student_code?: string | null;
  avatar_url?: string | null;
  gpa_goal?: number | string | null;
  role?: string | null;
  account_status?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ProfileQueryResult<T = ProfileRow> {
  data: T | null;
  error: { message?: string } | Error | null | unknown;
}

export interface ProfileQueryFilter {
  eq(column: string, value: unknown): ProfileQueryExecution;
  maybeSingle?(): Promise<ProfileQueryResult>;
  single?(): Promise<ProfileQueryResult>;
}

export interface ProfileQueryExecution {
  select?(columns?: string): ProfileQueryExecution;
  maybeSingle(): Promise<ProfileQueryResult>;
  single?(): Promise<ProfileQueryResult>;
}

export interface ProfileInsertFilter {
  select(columns?: string): {
    single(): Promise<ProfileQueryResult>;
    maybeSingle?(): Promise<ProfileQueryResult>;
  };
}

export interface ProfileUpdateFilter {
  eq(column: string, value: unknown): {
    select(columns?: string): {
      maybeSingle(): Promise<ProfileQueryResult>;
      single?(): Promise<ProfileQueryResult>;
    };
    maybeSingle?(): Promise<ProfileQueryResult>;
  };
}

export interface ProfileRepositoryClient {
  from(table: string): {
    select(columns?: string): ProfileQueryFilter;
    update?(payload: unknown): ProfileUpdateFilter;
    insert?(payload: unknown): ProfileInsertFilter;
  };
}

/**
 * Loads the student profile for the specified user ID from Supabase.
 * Server-only helper that never accepts owner_id from client state.
 */
export async function getProfileByUserId(
  userId: string,
  client?: ProfileRepositoryClient
): Promise<StudentProfile | null> {
  if (!userId || typeof userId !== "string") {
    return null;
  }

  try {
    const supabase = client ?? (await createClient());
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = data as ProfileRow;

    return {
      id: String(row.id ?? ""),
      fullName: String(row.full_name ?? ""),
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      faculty: (row.faculty as string | null) ?? null,
      major: (row.major as string | null) ?? null,
      studentCode: (row.student_code as string | null) ?? null,
      avatarUrl: (row.avatar_url as string | null) ?? null,
      gpaGoal:
        row.gpa_goal === null || row.gpa_goal === undefined
          ? null
          : Number(row.gpa_goal),
      role: (row.role as string) || "student",
      accountStatus: (row.account_status as AccountStatus) || "pending",
      approvedAt: (row.approved_at as string | null) ?? null,
      approvedBy: (row.approved_by as string | null) ?? null,
      rejectionReason: (row.rejection_reason as string | null) ?? null,
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? "")
    };
  } catch {
    return null;
  }
}

/**
 * Updates the authenticated user's own profile.
 * Server-only helper that derives ownership strictly from the authenticated server user ID.
 * Only sends the 4 allowed editable columns (never sends role, id, or privileged keys).
 */
export async function updateOwnProfile(
  userId: string,
  input: UpdateProfileInput,
  client?: ProfileRepositoryClient
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
    const supabase = client ?? (await createClient());

    // Only include granted editable columns
    const updatePayload: {
      full_name?: string;
      faculty?: string | null;
      major?: string | null;
      gpa_goal?: number | null;
    } = {};

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

    const tableQuery = supabase.from("profiles");
    if (!tableQuery.update) {
      return { success: false, error: "Thao tác cập nhật không khả dụng." };
    }

    const { data, error } = await tableQuery
      .update(updatePayload)
      .eq("id", userId)
      .select()
      .maybeSingle();

    if (error) {
      const errorMsg =
        typeof error === "object" &&
        error &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Không thể cập nhật hồ sơ.";
      return { success: false, error: errorMsg };
    }

    if (!data) {
      // Profile might not exist yet; try creating it with granted insert columns only
      const insertPayload = {
        id: userId,
        full_name: validation.sanitized.fullName || "Học viên",
        faculty: validation.sanitized.faculty || null,
        major: validation.sanitized.major || null,
        gpa_goal:
          validation.sanitized.gpaGoal !== undefined
            ? validation.sanitized.gpaGoal
            : null
      };

      if (!tableQuery.insert) {
        return { success: false, error: "Thao tác khởi tạo không khả dụng." };
      }

      const { data: inserted, error: insertError } = await tableQuery
        .insert(insertPayload)
        .select()
        .single();

      if (insertError || !inserted) {
        const insertErrorMsg =
          typeof insertError === "object" &&
          insertError &&
          "message" in insertError &&
          typeof insertError.message === "string"
            ? insertError.message
            : "Không thể khởi tạo hồ sơ.";
        return { success: false, error: insertErrorMsg };
      }

      const insertedRow = inserted as ProfileRow;
      return {
        success: true,
        profile: {
          id: String(insertedRow.id ?? ""),
          fullName: String(insertedRow.full_name ?? ""),
          email: (insertedRow.email as string | null) ?? null,
          phone: (insertedRow.phone as string | null) ?? null,
          faculty: (insertedRow.faculty as string | null) ?? null,
          major: (insertedRow.major as string | null) ?? null,
          studentCode: (insertedRow.student_code as string | null) ?? null,
          avatarUrl: (insertedRow.avatar_url as string | null) ?? null,
          gpaGoal:
            insertedRow.gpa_goal === null ||
            insertedRow.gpa_goal === undefined
              ? null
              : Number(insertedRow.gpa_goal),
          role: (insertedRow.role as string) || "student",
          accountStatus:
            (insertedRow.account_status as AccountStatus) || "pending",
          approvedAt: (insertedRow.approved_at as string | null) ?? null,
          approvedBy: (insertedRow.approved_by as string | null) ?? null,
          rejectionReason:
            (insertedRow.rejection_reason as string | null) ?? null,
          createdAt: String(insertedRow.created_at ?? ""),
          updatedAt: String(insertedRow.updated_at ?? "")
        }
      };
    }

    const dataRow = data as ProfileRow;
    return {
      success: true,
      profile: {
        id: String(dataRow.id ?? ""),
        fullName: String(dataRow.full_name ?? ""),
        email: (dataRow.email as string | null) ?? null,
        phone: (dataRow.phone as string | null) ?? null,
        faculty: (dataRow.faculty as string | null) ?? null,
        major: (dataRow.major as string | null) ?? null,
        studentCode: (dataRow.student_code as string | null) ?? null,
        avatarUrl: (dataRow.avatar_url as string | null) ?? null,
        gpaGoal:
          dataRow.gpa_goal === null || dataRow.gpa_goal === undefined
            ? null
            : Number(dataRow.gpa_goal),
        role: (dataRow.role as string) || "student",
        accountStatus: (dataRow.account_status as AccountStatus) || "pending",
        approvedAt: (dataRow.approved_at as string | null) ?? null,
        approvedBy: (dataRow.approved_by as string | null) ?? null,
        rejectionReason: (dataRow.rejection_reason as string | null) ?? null,
        createdAt: String(dataRow.created_at ?? ""),
        updatedAt: String(dataRow.updated_at ?? "")
      }
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi hệ thống khi cập nhật hồ sơ.";
    return { success: false, error: msg };
  }
}
