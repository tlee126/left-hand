import type { Session, User } from "@supabase/supabase-js";

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
}

export interface SupabaseAuthLike {
  auth: {
    signUp: (options: {
      email: string;
      password: string;
      options?: {
        emailRedirectTo?: string;
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

/**
 * Validates signup form inputs on the client.
 */
export function validateSignupInput(params: {
  email?: string;
  password?: string;
  confirmPassword?: string;
}): SignupInputValidation {
  const email = (params.email || "").trim();
  const password = params.password || "";
  const confirmPassword = params.confirmPassword;

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
  const origin =
    rawOrigin ?? (typeof window !== "undefined" && window.location ? window.location.origin : undefined);

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
  if (!error) {
    return "Đăng ký không thành công. Vui lòng thử lại sau.";
  }

  const errObj = typeof error === "object" ? (error as Record<string, any>) : {};
  const rawMessage =
    typeof error === "string"
      ? error
      : (errObj.message || errObj.error_description || "").toString();
  const code = (errObj.code || errObj.status || "").toString().toLowerCase();
  const lowerMsg = rawMessage.toLowerCase();

  // Already registered email
  if (
    lowerMsg.includes("user already registered") ||
    lowerMsg.includes("already registered") ||
    lowerMsg.includes("user_already_exists") ||
    lowerMsg.includes("email already in use") ||
    lowerMsg.includes("already exists") ||
    code === "user_already_exists"
  ) {
    return "Email này đã được đăng ký tài khoản. Vui lòng đăng nhập hoặc sử dụng email khác.";
  }

  // Password requirements
  if (
    lowerMsg.includes("password should be at least") ||
    lowerMsg.includes("weak_password") ||
    lowerMsg.includes("password is too short") ||
    code === "weak_password"
  ) {
    return "Mật khẩu quá ngắn hoặc không đủ độ mạnh. Vui lòng đặt mật khẩu ít nhất 8 ký tự.";
  }

  // Email format validation from server
  if (
    lowerMsg.includes("invalid email") ||
    lowerMsg.includes("unable to validate email") ||
    lowerMsg.includes("invalid_email") ||
    code === "invalid_email"
  ) {
    return "Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.";
  }

  // Signups disabled
  if (
    lowerMsg.includes("signups not allowed") ||
    lowerMsg.includes("signup_disabled") ||
    code === "signup_disabled"
  ) {
    return "Chức năng đăng ký tạm thời bị khóa. Vui lòng liên hệ quản trị viên.";
  }

  // Rate limits
  if (
    lowerMsg.includes("rate limit") ||
    lowerMsg.includes("over_email_send_rate_limit") ||
    lowerMsg.includes("too many requests") ||
    code === "over_email_send_rate_limit" ||
    code === "429"
  ) {
    return "Bạn đã gửi quá nhiều yêu cầu đăng ký. Vui lòng đợi vài phút rồi thử lại.";
  }

  return "Đăng ký không thành công. Vui lòng thử lại sau.";
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

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
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

