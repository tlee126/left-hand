export type PublicErrorCode =
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_EMAIL_NOT_CONFIRMED"
  | "AUTH_CALLBACK_FAILED"
  | "AUTH_UNAVAILABLE"
  | "SIGNUP_FAILED"
  | "PROFILE_UPDATE_FAILED";

export interface PublicError {
  code: PublicErrorCode;
  message: string;
}

export const PUBLIC_ERROR_MESSAGES: Readonly<Record<PublicErrorCode, string>> = {
  AUTH_INVALID_CREDENTIALS: "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.",
  AUTH_EMAIL_NOT_CONFIRMED: "Email của bạn chưa được xác thực. Vui lòng kiểm tra hộp thư để hoàn tất xác thực.",
  AUTH_CALLBACK_FAILED: "Liên kết xác thực không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
  AUTH_UNAVAILABLE: "Không thể hoàn tất thao tác tài khoản lúc này. Vui lòng thử lại sau.",
  SIGNUP_FAILED: "Không thể hoàn tất đăng ký lúc này. Vui lòng kiểm tra thông tin và thử lại sau.",
  PROFILE_UPDATE_FAILED: "Không thể cập nhật hồ sơ lúc này. Vui lòng thử lại sau."
};

type ErrorContext = "login" | "signup" | "callback";

function getSafeProviderCode(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "";
  }

  const code = (error as Record<string, unknown>).code;
  return typeof code === "string" ? code.trim().toLowerCase() : "";
}

function publicError(code: PublicErrorCode): PublicError {
  return { code, message: PUBLIC_ERROR_MESSAGES[code] };
}

export function mapAuthError(error: unknown, context: ErrorContext = "login"): PublicError {
  const providerCode = getSafeProviderCode(error);

  if (context === "signup") {
    // Signup errors intentionally share one response to prevent account enumeration.
    return publicError("SIGNUP_FAILED");
  }

  if (context === "callback") {
    return publicError("AUTH_CALLBACK_FAILED");
  }

  if (providerCode === "email_not_confirmed" || providerCode === "email_not_confirmed_error") {
    return publicError("AUTH_EMAIL_NOT_CONFIRMED");
  }

  if (providerCode === "invalid_credentials" || providerCode === "invalid_login_credentials") {
    return publicError("AUTH_INVALID_CREDENTIALS");
  }

  return publicError("AUTH_UNAVAILABLE");
}

export function mapProfileError(_error: unknown): PublicError {
  return publicError("PROFILE_UPDATE_FAILED");
}

export const AUTH_CALLBACK_ERROR_MESSAGE = PUBLIC_ERROR_MESSAGES.AUTH_CALLBACK_FAILED;
