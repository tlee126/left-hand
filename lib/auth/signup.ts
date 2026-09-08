import type { Session, User } from "@supabase/supabase-js";
import { mapAuthError } from "@/lib/auth/error-mapper";

export interface SignupResult {
  success: boolean;
  data?: {
    user: User | null;
    session: Session | null;
  } | null;
  error?: string;
}

export interface SignupParams {
  email: string;
  password?: string;
  emailRedirectTo?: string;
  fullName?: string;
}

export interface SupabaseAuthLike {
  auth: {
    signUp: (options: {
      email: string;
      password: string;
      options?: {
        emailRedirectTo?: string;
        data: {
          full_name: string;
        };
      };
    }) => Promise<{
      data: {
        user: User | null;
        session: Session | null;
      } | null;
      error: { message?: string; code?: string; status?: number | string } | null;
    }>;
  };
}

export interface SignupInputValidation {
  isValid: boolean;
  error?: string;
}

export const MAX_SIGNUP_FULL_NAME_LENGTH = 200;

export function normalizeSignupFullName(fullName: string | undefined): string {
  return (fullName || "").trim();
}

export function validateSignupFullName(fullName?: string): SignupInputValidation {
  const normalized = normalizeSignupFullName(fullName);
  if (!normalized) {
    return {
      isValid: false,
      error: "Họ và tên không được để trống."
    };
  }

  if (Array.from(normalized).length > MAX_SIGNUP_FULL_NAME_LENGTH) {
    return {
      isValid: false,
      error: `Họ và tên không được vượt quá ${MAX_SIGNUP_FULL_NAME_LENGTH} ký tự.`
    };
  }

  return { isValid: true };
}

/**
 * Validates signup form inputs on the client.
 */
export function validateSignupInput(params: {
  email?: string;
  password?: string;
  confirmPassword?: string;
  fullName?: string;
}): SignupInputValidation {
  const email = (params.email || "").trim();
  const password = params.password || "";
  const fullName = normalizeSignupFullName(params.fullName);
  const confirmPassword = params.confirmPassword;

  const fullNameValidation = validateSignupFullName(fullName);
  if (!fullNameValidation.isValid) {
    return fullNameValidation;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.toLowerCase())) {
    return {
      isValid: false,
      error: "Email không hợp lệ. Vui lòng kiểm tra lại."
    };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      error: "Mật khẩu phải có ít nhất 8 ký tự."
    };
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    return {
      isValid: false,
      error: "Mật khẩu xác nhận không khớp."
    };
  }

  return { isValid: true };
}

/**
 * Validates and constructs the email confirmation callback URL.
 * Only accepts valid http: or https: origins, preventing "null/auth/callback" or invalid protocols.
 */
export function getValidCallbackUrl(rawOrigin?: string): string | undefined {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const origin = rawOrigin ??
    configuredOrigin ??
    (process.env.NODE_ENV !== "production" && typeof window !== "undefined" && window.location
      ? window.location.origin
      : process.env.NODE_ENV === "production"
        ? "https://lefthand.vn"
        : undefined);

  if (!origin || typeof origin !== "string" || origin.trim() === "" || origin === "null") {
    return undefined;
  }

  try {
    const parsed = new URL(origin.trim());
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      // parsed.origin handles trailing slash removal and port formatting
      return `${parsed.origin}/auth/callback`;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

/**
 * Maps Supabase signup error codes and messages to user-friendly Vietnamese descriptions.
 * Avoids exposing raw database or server internals to end users.
 */
export function mapSignupError(error: unknown): string {
  return mapAuthError(error, "signup").message;
}

/**
 * Performs Supabase auth signUp with the provided Supabase client and parameters.
 */
export async function performSignup(
  supabaseClient: SupabaseAuthLike,
  params: SignupParams
): Promise<SignupResult> {
  const email = (params.email || "").trim();
  const password = params.password || "";
  const emailRedirectTo = params.emailRedirectTo;
  const fullName = normalizeSignupFullName(params.fullName);

  const inputValidation = validateSignupInput({ email, password, fullName });
  if (!inputValidation.isValid) {
    return {
      success: false,
      error: inputValidation.error || "Thông tin đăng ký không hợp lệ."
    };
  }

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {})
      }
    });

    if (error) {
      return {
        success: false,
        error: mapSignupError(error)
      };
    }

    return {
      success: true,
      data: data ?? null
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: mapSignupError(err)
    };
  }
}
