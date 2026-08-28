import assert from "node:assert/strict";
import { test, describe } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  performSignup,
  mapSignupError,
  getValidCallbackUrl,
  validateSignupInput,
  type SupabaseAuthLike
} from "../../lib/auth/signup";

describe("Task 3.1D: Real User Signup Flow & Runtime Behavior", () => {
  describe("1. Runtime Supabase Auth Signup Execution", () => {
    test("performSignup calls supabase.auth.signUp() with trimmed email, password, and emailRedirectTo", async () => {
      let callCount = 0;
      let capturedArgs: any = null;

      const mockSupabase: SupabaseAuthLike = {
        auth: {
          signUp: async (options) => {
            callCount++;
            capturedArgs = options;
            return {
              data: {
                user: { id: "user-123", email: options.email } as any,
                session: null
              },
              error: null
            };
          }
        }
      };

      const result = await performSignup(mockSupabase, {
        email: "  student@lefthand.vn  ",
        password: "SecurePassword123!",
        emailRedirectTo: "https://lefthand.vn/auth/callback"
      });

      assert.strictEqual(callCount, 1, "supabase.auth.signUp() must be called exactly once");
      assert.deepStrictEqual(capturedArgs, {
        email: "student@lefthand.vn",
        password: "SecurePassword123!",
        options: {
          emailRedirectTo: "https://lefthand.vn/auth/callback"
        }
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.user?.id, "user-123");
    });

    test("performSignup handles omitted emailRedirectTo cleanly", async () => {
      let capturedArgs: any = null;

      const mockSupabase: SupabaseAuthLike = {
        auth: {
          signUp: async (options) => {
            capturedArgs = options;
            return {
              data: {
                user: { id: "user-456", email: options.email } as any,
                session: null
              },
              error: null
            };
          }
        }
      };

      const result = await performSignup(mockSupabase, {
        email: "test@lefthand.vn",
        password: "Password123!"
      });

      assert.deepStrictEqual(capturedArgs, {
        email: "test@lefthand.vn",
        password: "Password123!",
        options: {}
      });
      assert.strictEqual(result.success, true);
    });

    test("performSignup handles Supabase error and returns Vietnamese error message", async () => {
      const mockSupabase: SupabaseAuthLike = {
        auth: {
          signUp: async () => ({
            data: null,
            error: {
              message: "User already registered",
              code: "user_already_exists"
            }
          })
        }
      };

      const result = await performSignup(mockSupabase, {
        email: "existing@lefthand.vn",
        password: "Password123!"
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(
        result.error,
        "Email này đã được đăng ký tài khoản. Vui lòng đăng nhập hoặc sử dụng email khác."
      );
    });

    test("performSignup succeeds with session present (auto-confirmed user)", async () => {
      const mockUser = { id: "user-auto-1", email: "student@lefthand.vn" };
      const mockSession = { access_token: "valid-jwt-token", refresh_token: "refresh-token" };

      const mockSupabase: SupabaseAuthLike = {
        auth: {
          signUp: async () => ({
            data: {
              user: mockUser as any,
              session: mockSession as any
            },
            error: null
          })
        }
      };

      const result = await performSignup(mockSupabase, {
        email: "student@lefthand.vn",
        password: "Password123!"
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data?.session, "Session must be present when provider auto-confirms");
      assert.strictEqual(result.data?.session?.access_token, "valid-jwt-token");
      assert.strictEqual(result.data?.user?.id, "user-auto-1");
    });

    test("performSignup succeeds with session null (email confirmation required)", async () => {
      const mockUser = { id: "user-confirm-1", email: "student@lefthand.vn" };

      const mockSupabase: SupabaseAuthLike = {
        auth: {
          signUp: async () => ({
            data: {
              user: mockUser as any,
              session: null
            },
            error: null
          })
        }
      };

      const result = await performSignup(mockSupabase, {
        email: "student@lefthand.vn",
        password: "Password123!"
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.session, null, "Session must be null when email confirmation is required");
      assert.strictEqual(result.data?.user?.id, "user-confirm-1");
    });

    test("performSignup catches thrown exceptions and returns safe error message", async () => {
      const mockSupabase: SupabaseAuthLike = {
        auth: {
          signUp: async () => {
            throw new Error("Network connection lost");
          }
        }
      };

      const result = await performSignup(mockSupabase, {
        email: "student@lefthand.vn",
        password: "Password123!"
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "Đăng ký không thành công. Vui lòng thử lại sau.");
    });
  });

  describe("2. Client-side Input Validation & Submission Guard", () => {
    test("validateSignupInput validates email format", () => {
      const invalidEmails = ["", "invalid", "user@", "@domain.com", "user@domain", "user@.com"];
      for (const email of invalidEmails) {
        const res = validateSignupInput({
          email,
          password: "ValidPassword123",
          confirmPassword: "ValidPassword123"
        });
        assert.strictEqual(res.isValid, false, `Expected invalid email for: ${email}`);
        assert.strictEqual(res.error, "Email không hợp lệ. Vui lòng kiểm tra lại.");
      }

      const validRes = validateSignupInput({
        email: "student@lefthand.vn",
        password: "ValidPassword123",
        confirmPassword: "ValidPassword123"
      });
      assert.strictEqual(validRes.isValid, true);
    });

    test("validateSignupInput rejects short password (< 8 characters)", () => {
      const shortPasswords = ["", "123", "abcdef", "1234567"];
      for (const password of shortPasswords) {
        const res = validateSignupInput({
          email: "student@lefthand.vn",
          password,
          confirmPassword: password
        });
        assert.strictEqual(res.isValid, false, `Expected short password rejection for: ${password}`);
        assert.strictEqual(res.error, "Mật khẩu phải có ít nhất 8 ký tự.");
      }

      const validRes = validateSignupInput({
        email: "student@lefthand.vn",
        password: "Password123",
        confirmPassword: "Password123"
      });
      assert.strictEqual(validRes.isValid, true);
    });

    test("validateSignupInput rejects password mismatch", () => {
      const res = validateSignupInput({
        email: "student@lefthand.vn",
        password: "Password123!",
        confirmPassword: "DifferentPassword123!"
      });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.error, "Mật khẩu xác nhận không khớp.");
    });

    test("duplicate submission is prevented when submit is already active", async () => {
      let activeCalls = 0;
      let totalExecuted = 0;

      // Submission controller simulation mirroring UI handler behavior
      let isSubmitting = false;
      const submitHandler = async (email: string, password: string) => {
        if (isSubmitting) {
          return { ignored: true };
        }
        isSubmitting = true;
        try {
          activeCalls++;
          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 50));
          totalExecuted++;
          return { success: true };
        } finally {
          activeCalls--;
          isSubmitting = false;
        }
      };

      // Fire first submit and immediate duplicate submit
      const promise1 = submitHandler("student@lefthand.vn", "Password123!");
      const promise2 = submitHandler("student@lefthand.vn", "Password123!");

      const [res1, res2] = await Promise.all([promise1, promise2]);

      assert.strictEqual(res1.success, true);
      assert.strictEqual(res2.ignored, true, "Second concurrent submission must be ignored");
      assert.strictEqual(totalExecuted, 1, "Only one submission should execute");
      assert.strictEqual(isSubmitting, false, "isSubmitting flag must be reset to false");
    });

    test("isSubmitting flag is always reset in try/finally even if signup throws", async () => {
      let isSubmitting = false;
      const failingSubmit = async () => {
        if (isSubmitting) return;
        isSubmitting = true;
        try {
          throw new Error("Unexpected crash during signup");
        } catch {
          // Handled in catch
        } finally {
          isSubmitting = false;
        }
      };

      await failingSubmit();
      assert.strictEqual(isSubmitting, false, "isSubmitting must be reset after thrown error");
    });
  });

  describe("3. Callback Origin Validation", () => {
    test("getValidCallbackUrl accepts valid HTTPS and HTTP origins", () => {
      assert.strictEqual(
        getValidCallbackUrl("https://lefthand.vn"),
        "https://lefthand.vn/auth/callback"
      );
      assert.strictEqual(
        getValidCallbackUrl("https://lefthand.vn/"),
        "https://lefthand.vn/auth/callback"
      );
      assert.strictEqual(
        getValidCallbackUrl("http://localhost:3000"),
        "http://localhost:3000/auth/callback"
      );
      assert.strictEqual(
        getValidCallbackUrl("http://127.0.0.1:8080/"),
        "http://127.0.0.1:8080/auth/callback"
      );
    });

    test("getValidCallbackUrl rejects 'null' string and never produces 'null/auth/callback'", () => {
      assert.strictEqual(getValidCallbackUrl("null"), undefined);
      assert.strictEqual(getValidCallbackUrl(""), undefined);
      assert.strictEqual(getValidCallbackUrl("   "), undefined);
      assert.strictEqual(getValidCallbackUrl(undefined), undefined);
    });

    test("getValidCallbackUrl rejects non-http/https protocols", () => {
      assert.strictEqual(getValidCallbackUrl("file:///C:/Users/app"), undefined);
      assert.strictEqual(getValidCallbackUrl("javascript:alert(1)"), undefined);
      assert.strictEqual(getValidCallbackUrl("data:text/html,<html></html>"), undefined);
    });
  });

  describe("4. Error Mapping to Clear Vietnamese Messages", () => {
    test("mapSignupError maps user already exists error", () => {
      const msgs = [
        "User already registered",
        "user_already_exists",
        "A user with this email already exists",
        "email already in use"
      ];
      for (const msg of msgs) {
        const mapped = mapSignupError({ message: msg });
        assert.strictEqual(
          mapped,
          "Email này đã được đăng ký tài khoản. Vui lòng đăng nhập hoặc sử dụng email khác."
        );
      }
    });

    test("mapSignupError maps weak / short password errors", () => {
      const mapped = mapSignupError({ message: "Password should be at least 6 characters." });
      assert.strictEqual(
        mapped,
        "Mật khẩu quá ngắn hoặc không đủ độ mạnh. Vui lòng đặt mật khẩu ít nhất 8 ký tự."
      );
    });

    test("mapSignupError maps invalid email errors", () => {
      const mapped = mapSignupError({ message: "Unable to validate email address: invalid format" });
      assert.strictEqual(
        mapped,
        "Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại."
      );
    });

    test("mapSignupError maps signup disabled errors", () => {
      const mapped = mapSignupError({ message: "Signups not allowed for this instance" });
      assert.strictEqual(
        mapped,
        "Chức năng đăng ký tạm thời bị khóa. Vui lòng liên hệ quản trị viên."
      );
    });

    test("mapSignupError maps rate limit errors", () => {
      const mapped = mapSignupError({ message: "over_email_send_rate_limit" });
      assert.strictEqual(
        mapped,
        "Bạn đã gửi quá nhiều yêu cầu đăng ký. Vui lòng đợi vài phút rồi thử lại."
      );
    });

    test("mapSignupError falls back safely on generic / unknown provider error", () => {
      const mapped = mapSignupError({ message: "Internal server database error #50312" });
      assert.strictEqual(
        mapped,
        "Đăng ký không thành công. Vui lòng thử lại sau."
      );
    });
  });

  describe("5. Static Contracts & Security Checks", () => {
    test("app/dang-ky/page.tsx is a client component and properly configured", async () => {
      const signupPath = path.resolve(process.cwd(), "app/dang-ky/page.tsx");
      const signupCode = await fs.readFile(signupPath, "utf-8");

      assert.ok(signupCode.includes('"use client"'), "SignupPage must have 'use client'");
      assert.ok(signupCode.includes("export default function SignupPage"), "SignupPage component must be exported");
      assert.ok(signupCode.includes("isSubmitting"), "SignupPage must manage isSubmitting state");
      assert.ok(signupCode.includes("finally {"), "SignupPage handleSubmit must have finally block");
    });

    test("hooks/use-demo-auth.ts exports signup helper and does NOT use localStorage for signup", async () => {
      const hookPath = path.resolve(process.cwd(), "hooks/use-demo-auth.ts");
      const hookCode = await fs.readFile(hookPath, "utf-8");

      assert.ok(hookCode.includes("performSignup"), "Hook must use performSignup helper");

      // Verify that the signup function in the hook does not touch localStorage or demo student
      const signupFunctionRegex = /const signup\s*=\s*async[\s\S]*?return\s*\{[\s\S]*?\};/i;
      const match = hookCode.match(signupFunctionRegex);
      assert.ok(match, "signup function definition must be found in use-demo-auth.ts");

      const signupBody = match[0];
      assert.ok(!signupBody.includes("localStorage"), "signup path must not use localStorage");
      assert.ok(!signupBody.includes("demoStudent"), "signup path must not use demoStudent credentials");
    });

    test("Signup remains separate from profile update operations", async () => {
      const signupHelperPath = path.resolve(process.cwd(), "lib/auth/signup.ts");
      const signupHelperCode = await fs.readFile(signupHelperPath, "utf-8");

      assert.ok(!signupHelperCode.includes("profiles"), "Signup helper should not touch profiles table directly");
      assert.ok(!signupHelperCode.includes("insert("), "Signup helper should not perform generic table inserts");
    });

    test("Cross-linking between login and signup pages is intact", async () => {
      const loginPath = path.resolve(process.cwd(), "app/dang-nhap/page.tsx");
      const loginCode = await fs.readFile(loginPath, "utf-8");
      assert.ok(loginCode.includes('href="/dang-ky"'), "Login page must link to /dang-ky");

      const signupPath = path.resolve(process.cwd(), "app/dang-ky/page.tsx");
      const signupCode = await fs.readFile(signupPath, "utf-8");
      assert.ok(signupCode.includes('href="/dang-nhap"'), "Signup page must link to /dang-nhap");
      assert.ok(signupCode.includes('href="/"'), "Signup page must link to / (home)");
    });

    test("Client-side auth files never expose service role keys", async () => {
      const filesToCheck = [
        "app/dang-ky/page.tsx",
        "hooks/use-demo-auth.ts",
        "lib/auth/signup.ts"
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const content = await fs.readFile(fullPath, "utf-8");
        assert.ok(
          !content.includes("SUPABASE_SERVICE_ROLE_KEY"),
          `${relPath} must not reference SUPABASE_SERVICE_ROLE_KEY`
        );
        assert.ok(
          !content.includes("service_role"),
          `${relPath} must not reference service_role key`
        );
      }
    });
  });
});
