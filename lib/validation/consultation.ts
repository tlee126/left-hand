/**
 * Phase 4.1-B: Shared Consultation Validation
 *
 * Pure TypeScript validation contract for consultation lead submissions.
 * Usable by both client-side forms and server-side API route handlers.
 * Aligned with database schema constraints in 0006_consultations.sql.
 */

/**
 * Exact length limits matching PostgreSQL check constraints in 0006_consultations.sql.
 */
export const CONSULTATION_LIMITS = {
  fullName: { min: 2, max: 150 },
  phone: { min: 7, max: 30 },
  faculty: { min: 1, max: 150 },
  major: { max: 150 },
  interest: { min: 1, max: 200 },
  need: { min: 1, max: 2000 },
  note: { max: 5000 },
  sourcePath: { max: 500 },
  selectedProductSlug: { max: 150 },
  selectedSubjectSlug: { max: 150 }
} as const;

/**
 * Set of allowed field names on consultation input payloads.
 * Unknown fields are rejected rather than silently accepted.
 */
export const KNOWN_CONSULTATION_FIELDS = new Set<string>([
  "fullName",
  "phone",
  "faculty",
  "major",
  "interest",
  "need",
  "note",
  "sourcePath",
  "selectedProductSlug",
  "selectedSubjectSlug"
]);

/**
 * Raw consultation input shape from client form or API request body.
 */
export interface ConsultationInput {
  fullName?: unknown;
  phone?: unknown;
  faculty?: unknown;
  major?: unknown;
  interest?: unknown;
  need?: unknown;
  note?: unknown;
  sourcePath?: unknown;
  selectedProductSlug?: unknown;
  selectedSubjectSlug?: unknown;
  [key: string]: unknown;
}

/**
 * Normalized and validated consultation data payload ready for persistence.
 */
export interface ValidatedConsultationData {
  fullName: string;
  phone: string;
  faculty: string;
  major: string | null;
  interest: string;
  need: string;
  note: string | null;
  sourcePath: string | null;
  selectedProductSlug: string | null;
  selectedSubjectSlug: string | null;
}

/**
 * Map of field names to specific Vietnamese error messages.
 */
export type ConsultationFieldErrors = Record<string, string>;

export interface ConsultationValidationSuccess {
  isValid: true;
  success: true;
  data: ValidatedConsultationData;
  errors: Record<string, never>;
  error?: undefined;
}

export interface ConsultationValidationFailure {
  isValid: false;
  success: false;
  data?: undefined;
  errors: ConsultationFieldErrors;
  error: string;
}

export type ConsultationValidationResult =
  | ConsultationValidationSuccess
  | ConsultationValidationFailure;

/**
 * Normalizes and validates a Vietnamese phone number.
 *
 * Accepts:
 * - Domestic 10-digit mobile numbers (03x, 05x, 07x, 08x, 09x)
 * - Domestic 10 or 11-digit landline numbers (02x)
 * - Common formatting characters: spaces, dashes, dots, parentheses
 * - International dialing prefix (+84, 84, 0084, (+84))
 *
 * Returns normalized 10/11-digit domestic string (e.g. "0912345678") or null if invalid.
 */
export function normalizeVietnamesePhone(rawPhone: unknown): string | null {
  if (typeof rawPhone !== "string") {
    return null;
  }

  const trimmed = rawPhone.trim();
  if (!trimmed || trimmed.length > CONSULTATION_LIMITS.phone.max) {
    return null;
  }

  // Remove common separators and grouping delimiters
  let cleaned = trimmed.replace(/[\s.\-()]/g, "");

  // Convert international prefixes (+84, 0084, 84) to domestic leading "0"
  if (cleaned.startsWith("+84")) {
    if (cleaned[3] === "0") return null;
    cleaned = "0" + cleaned.slice(3);
  } else if (cleaned.startsWith("0084")) {
    if (cleaned[4] === "0") return null;
    cleaned = "0" + cleaned.slice(4);
  } else if (cleaned.startsWith("84") && cleaned.length >= 11) {
    if (cleaned[2] === "0") return null;
    cleaned = "0" + cleaned.slice(2);
  }

  // Valid Vietnamese phone number format:
  // - 10-digit mobile: 03x, 05x, 07x, 08x, 09x
  // - 10 or 11-digit landline: 02x
  const vnPhoneRegex = /^(?:0[35789]\d{8}|02\d{8,9})$/;
  if (vnPhoneRegex.test(cleaned)) {
    return cleaned;
  }

  return null;
}

/**
 * Helper to check if a value is a valid Vietnamese phone number.
 */
export function isValidVietnamesePhone(rawPhone: unknown): boolean {
  return normalizeVietnamesePhone(rawPhone) !== null;
}

/**
 * Validates consultation input against schema constraints and business rules.
 *
 * - Pure TypeScript function (no Next.js, Supabase, database, or network dependency)
 * - Validates types, presence, trimmed lengths, and format
 * - Rejects unknown properties
 * - Normalizes empty optional strings to null
 * - Normalizes Vietnamese phone numbers to standard domestic format
 */
export function validateConsultationInput(input: unknown): ConsultationValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      isValid: false,
      success: false,
      errors: { _root: "Dữ liệu yêu cầu tư vấn không hợp lệ." },
      error: "Dữ liệu yêu cầu tư vấn không hợp lệ."
    };
  }

  const record = input as Record<string, unknown>;
  const errors: ConsultationFieldErrors = {};

  // 1. Reject unknown fields rather than silently ignoring them
  for (const key of Object.keys(record)) {
    if (!KNOWN_CONSULTATION_FIELDS.has(key)) {
      errors[key] = `Trường "${key}" không được hỗ trợ.`;
    }
  }

  // 2. fullName: required, string, 2-150 characters after trim
  const rawFullName = record.fullName;
  let normalizedFullName = "";
  if (rawFullName === undefined || rawFullName === null) {
    errors.fullName = "Vui lòng nhập họ và tên.";
  } else if (typeof rawFullName !== "string") {
    errors.fullName = "Họ và tên phải là chuỗi ký tự.";
  } else {
    normalizedFullName = rawFullName.trim();
    if (normalizedFullName.length === 0) {
      errors.fullName = "Vui lòng nhập họ và tên.";
    } else if (normalizedFullName.length < CONSULTATION_LIMITS.fullName.min) {
      errors.fullName = `Họ và tên phải có ít nhất ${CONSULTATION_LIMITS.fullName.min} ký tự.`;
    } else if (normalizedFullName.length > CONSULTATION_LIMITS.fullName.max) {
      errors.fullName = `Họ và tên không được vượt quá ${CONSULTATION_LIMITS.fullName.max} ký tự.`;
    }
  }

  // 3. phone: required, string, Vietnamese phone number, max raw length 30
  const rawPhone = record.phone;
  let normalizedPhone = "";
  if (rawPhone === undefined || rawPhone === null) {
    errors.phone = "Vui lòng nhập số điện thoại.";
  } else if (typeof rawPhone !== "string") {
    errors.phone = "Số điện thoại phải là chuỗi ký tự.";
  } else {
    const trimmedPhone = rawPhone.trim();
    if (trimmedPhone.length === 0) {
      errors.phone = "Vui lòng nhập số điện thoại.";
    } else if (trimmedPhone.length > CONSULTATION_LIMITS.phone.max) {
      errors.phone = `Số điện thoại không được vượt quá ${CONSULTATION_LIMITS.phone.max} ký tự.`;
    } else {
      const parsedPhone = normalizeVietnamesePhone(trimmedPhone);
      if (!parsedPhone) {
        errors.phone = "Số điện thoại Việt Nam không hợp lệ.";
      } else {
        normalizedPhone = parsedPhone;
      }
    }
  }

  // 4. faculty: required, string, 1-150 characters after trim
  const rawFaculty = record.faculty;
  let normalizedFaculty = "";
  if (rawFaculty === undefined || rawFaculty === null) {
    errors.faculty = "Vui lòng chọn khoa/viện.";
  } else if (typeof rawFaculty !== "string") {
    errors.faculty = "Khoa/Viện phải là chuỗi ký tự.";
  } else {
    normalizedFaculty = rawFaculty.trim();
    if (normalizedFaculty.length === 0) {
      errors.faculty = "Vui lòng chọn khoa/viện.";
    } else if (normalizedFaculty.length > CONSULTATION_LIMITS.faculty.max) {
      errors.faculty = `Khoa/Viện không được vượt quá ${CONSULTATION_LIMITS.faculty.max} ký tự.`;
    }
  }

  // 5. major: optional, string, max 150 characters after trim (empty -> null)
  const rawMajor = record.major;
  let normalizedMajor: string | null = null;
  if (rawMajor !== undefined && rawMajor !== null) {
    if (typeof rawMajor !== "string") {
      errors.major = "Ngành học phải là chuỗi ký tự.";
    } else {
      const trimmed = rawMajor.trim();
      if (trimmed.length > CONSULTATION_LIMITS.major.max) {
        errors.major = `Ngành học không được vượt quá ${CONSULTATION_LIMITS.major.max} ký tự.`;
      } else if (trimmed.length > 0) {
        normalizedMajor = trimmed;
      }
    }
  }

  // 6. interest: required, string, 1-200 characters after trim
  const rawInterest = record.interest;
  let normalizedInterest = "";
  if (rawInterest === undefined || rawInterest === null) {
    errors.interest = "Vui lòng chọn môn học quan tâm.";
  } else if (typeof rawInterest !== "string") {
    errors.interest = "Môn học quan tâm phải là chuỗi ký tự.";
  } else {
    normalizedInterest = rawInterest.trim();
    if (normalizedInterest.length === 0) {
      errors.interest = "Vui lòng chọn môn học quan tâm.";
    } else if (normalizedInterest.length > CONSULTATION_LIMITS.interest.max) {
      errors.interest = `Môn học quan tâm không được vượt quá ${CONSULTATION_LIMITS.interest.max} ký tự.`;
    }
  }

  // 7. need: required, string, 1-2000 characters after trim
  const rawNeed = record.need;
  let normalizedNeed = "";
  if (rawNeed === undefined || rawNeed === null) {
    errors.need = "Vui lòng chọn nhu cầu tư vấn.";
  } else if (typeof rawNeed !== "string") {
    errors.need = "Nhu cầu tư vấn phải là chuỗi ký tự.";
  } else {
    normalizedNeed = rawNeed.trim();
    if (normalizedNeed.length === 0) {
      errors.need = "Vui lòng chọn nhu cầu tư vấn.";
    } else if (normalizedNeed.length > CONSULTATION_LIMITS.need.max) {
      errors.need = `Nhu cầu tư vấn không được vượt quá ${CONSULTATION_LIMITS.need.max} ký tự.`;
    }
  }

  // 8. note: optional, string, max 5000 characters after trim (empty -> null)
  const rawNote = record.note;
  let normalizedNote: string | null = null;
  if (rawNote !== undefined && rawNote !== null) {
    if (typeof rawNote !== "string") {
      errors.note = "Ghi chú phải là chuỗi ký tự.";
    } else {
      const trimmed = rawNote.trim();
      if (trimmed.length > CONSULTATION_LIMITS.note.max) {
        errors.note = `Ghi chú không được vượt quá ${CONSULTATION_LIMITS.note.max} ký tự.`;
      } else if (trimmed.length > 0) {
        normalizedNote = trimmed;
      }
    }
  }

  // 9. sourcePath: optional, string, max 500 characters after trim (empty -> null)
  const rawSourcePath = record.sourcePath;
  let normalizedSourcePath: string | null = null;
  if (rawSourcePath !== undefined && rawSourcePath !== null) {
    if (typeof rawSourcePath !== "string") {
      errors.sourcePath = "Đường dẫn nguồn phải là chuỗi ký tự.";
    } else {
      const trimmed = rawSourcePath.trim();
      if (trimmed.length > CONSULTATION_LIMITS.sourcePath.max) {
        errors.sourcePath = `Đường dẫn nguồn không được vượt quá ${CONSULTATION_LIMITS.sourcePath.max} ký tự.`;
      } else if (trimmed.length > 0) {
        normalizedSourcePath = trimmed;
      }
    }
  }

  // 10. selectedProductSlug: optional, string, max 150 characters after trim (empty -> null)
  const rawProductSlug = record.selectedProductSlug;
  let normalizedProductSlug: string | null = null;
  if (rawProductSlug !== undefined && rawProductSlug !== null) {
    if (typeof rawProductSlug !== "string") {
      errors.selectedProductSlug = "Slug sản phẩm phải là chuỗi ký tự.";
    } else {
      const trimmed = rawProductSlug.trim();
      if (trimmed.length > CONSULTATION_LIMITS.selectedProductSlug.max) {
        errors.selectedProductSlug = `Slug sản phẩm không được vượt quá ${CONSULTATION_LIMITS.selectedProductSlug.max} ký tự.`;
      } else if (trimmed.length > 0) {
        normalizedProductSlug = trimmed;
      }
    }
  }

  // 11. selectedSubjectSlug: optional, string, max 150 characters after trim (empty -> null)
  const rawSubjectSlug = record.selectedSubjectSlug;
  let normalizedSubjectSlug: string | null = null;
  if (rawSubjectSlug !== undefined && rawSubjectSlug !== null) {
    if (typeof rawSubjectSlug !== "string") {
      errors.selectedSubjectSlug = "Slug môn học phải là chuỗi ký tự.";
    } else {
      const trimmed = rawSubjectSlug.trim();
      if (trimmed.length > CONSULTATION_LIMITS.selectedSubjectSlug.max) {
        errors.selectedSubjectSlug = `Slug môn học không được vượt quá ${CONSULTATION_LIMITS.selectedSubjectSlug.max} ký tự.`;
      } else if (trimmed.length > 0) {
        normalizedSubjectSlug = trimmed;
      }
    }
  }

  const errorKeys = Object.keys(errors);
  if (errorKeys.length > 0) {
    const firstKey = errorKeys[0];
    return {
      isValid: false,
      success: false,
      errors,
      error: errors[firstKey]
    };
  }

  return {
    isValid: true,
    success: true,
    errors: {},
    data: {
      fullName: normalizedFullName,
      phone: normalizedPhone,
      faculty: normalizedFaculty,
      major: normalizedMajor,
      interest: normalizedInterest,
      need: normalizedNeed,
      note: normalizedNote,
      sourcePath: normalizedSourcePath,
      selectedProductSlug: normalizedProductSlug,
      selectedSubjectSlug: normalizedSubjectSlug
    }
  };
}

/**
 * Alias for validateConsultationInput.
 */
export const validateConsultation = validateConsultationInput;
