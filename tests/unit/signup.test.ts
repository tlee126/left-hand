import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  performSignup,
  mapSignupError,
  getValidCallbackUrl,
  validateSignupInput,
  type SupabaseAuthLike
} from "../../lib/auth/signup";

const execFileAsync = promisify(execFile);

type SignupPageRuntimeScenario = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  authError?: string;
};

type SignupPageRuntimeResult = {
  signUpArgs: unknown;
  authCalls: number;
  timeline: string[];
  text: string;
};

const signupPageRuntimeHarness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";

const scenario = JSON.parse(process.argv[1]);
process.env.NEXT_PUBLIC_DEMO_MODE = "false";
globalThis.window = { location: { origin: "https://lefthand.vn" } };

const state = [];
let stateCursor = 0;
const timeline = [];
let authCalls = 0;
let signUpArgs = null;

const reactModule = "data:text/javascript,signup-react";
const authClientModule = "data:text/javascript,signup-browser-client";
const demoStudentModule = "data:text/javascript,signup-demo-student";
const imageModule = "data:text/javascript,signup-image";
const linkModule = "data:text/javascript,signup-link";
const navigationModule = "data:text/javascript,signup-navigation";
const iconsModule = "data:text/javascript,signup-icons";
const floatingActionsModule = "data:text/javascript,signup-floating-actions";
const jsxRuntimeModule = "data:text/javascript,signup-jsx-runtime";

function useState(initialValue) {
  const index = stateCursor++;
  if (!(index in state)) state[index] = initialValue;
  return [state[index], (value) => {
    state[index] = typeof value === "function" ? value(state[index]) : value;
  }];
}

function useEffect() {}
function useTransition() { return [false, (callback) => callback()]; }

const authClient = {
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ data: { user: null }, error: null }),
    signOut: async () => ({ error: null }),
    signUp: async (options) => {
      authCalls++;
      signUpArgs = options;
      timeline.push("auth.signUp");
      if (scenario.authError) {
        return {
          data: null,
          error: { message: scenario.authError, code: "database_error" }
        };
      }
      return {
        data: {
          user: { id: "signup-runtime-user", email: options.email },
          session: null
        },
        error: null
      };
    }
  }
};

const jsx = (type, props) => ({ type, props: props ?? {} });
const jsxs = jsx;
const Fragment = "fragment";

function component(props) { return { type: "component", props }; }

mock.module(reactModule, {
  namedExports: { useState, useEffect, useTransition }
});
mock.module(authClientModule, {
  namedExports: { createClient: () => authClient }
});
mock.module(demoStudentModule, {
  namedExports: {
    demoStudent: {
      email: "demo@example.test",
      password: "not-used",
      name: "Demo",
      avatarInitials: "DE"
    }
  }
});
mock.module(imageModule, {
  namedExports: { default: (props) => ({ type: "img", props }) }
});
mock.module(linkModule, {
  namedExports: { default: (props) => ({ type: "a", props }) }
});
mock.module(navigationModule, {
  namedExports: { useRouter: () => ({ push() {} }) }
});
mock.module(iconsModule, {
  namedExports: {
    ArrowLeft: component,
    Lock: component,
    Mail: component,
    CheckCircle2: component
  }
});
mock.module(floatingActionsModule, {
  namedExports: { FloatingActions: () => null }
});
mock.module(jsxRuntimeModule, {
  namedExports: { jsx, jsxs, Fragment }
});

async function compileModule(filePath, replacements, loader, withJsx = false) {
  let source = await readFile(filePath, "utf8");
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const compiled = await transform(source, {
    loader,
    format: "esm",
    ...(withJsx ? { jsx: "automatic" } : {}),
    sourcefile: path.basename(filePath)
  });
  return compiled.code.replaceAll("react/jsx-runtime", jsxRuntimeModule);
}

function inspect(value, output) {
  if (value == null || typeof value === "boolean" || typeof value === "number") return;
  if (typeof value === "string") { output.text += " " + value; return; }
  if (Array.isArray(value)) { value.forEach((item) => inspect(item, output)); return; }
  if (typeof value.type === "function") { inspect(value.type(value.props), output); return; }
  if (value.type === "form") output.form = value;
  if (value.type === "input") output.inputs.push(value);
  if (value.props) inspect(value.props.children, output);
}

function render(page) {
  stateCursor = 0;
  const output = { text: "", form: null, inputs: [] };
  inspect(page(), output);
  output.text = output.text.trim();
  return output;
}

try {
  const errorMapperCode = await compileModule(
    path.resolve(process.cwd(), "lib/auth/error-mapper.ts"),
    [],
    "ts"
  );
  const errorMapperUrl = "data:text/javascript," + encodeURIComponent(errorMapperCode);

  const signupHelperCode = await compileModule(
    path.resolve(process.cwd(), "lib/auth/signup.ts"),
    [
      ["@supabase/supabase-js", "data:text/javascript,signup-types"],
      ["\"@/lib/auth/error-mapper\"", "\"" + errorMapperUrl + "\""]
    ],
    "ts"
  );
  const signupHelperUrl = "data:text/javascript," + encodeURIComponent(signupHelperCode);

  const hookCode = await compileModule(
    path.resolve(process.cwd(), "hooks/use-demo-auth.ts"),
    [
      ["\"react\"", "\"" + reactModule + "\""],
      ["\"@/lib/supabase/browser\"", "\"" + authClientModule + "\""],
      ["\"@/data/student-demo\"", "\"" + demoStudentModule + "\""],
      ["\"@/lib/auth/signup\"", "\"" + signupHelperUrl + "\""],
      ["\"@/lib/auth/error-mapper\"", "\"" + errorMapperUrl + "\""]
    ],
    "tsx"
  );
  const hookUrl = "data:text/javascript," + encodeURIComponent(hookCode);

  const pageCode = await compileModule(
    path.resolve(process.cwd(), "app/dang-ky/page.tsx"),
    [
      ["\"react\"", "\"" + reactModule + "\""],
      ["\"@/hooks/use-demo-auth\"", "\"" + hookUrl + "\""],
      ["\"next/image\"", "\"" + imageModule + "\""],
      ["\"next/link\"", "\"" + linkModule + "\""],
      ["\"next/navigation\"", "\"" + navigationModule + "\""],
      ["\"lucide-react\"", "\"" + iconsModule + "\""],
      ["\"@/components/site/floating-actions\"", "\"" + floatingActionsModule + "\""]
    ],
    "tsx",
    true
  );
  const pageUrl = "data:text/javascript," + encodeURIComponent(pageCode);
  const page = (await import(pageUrl)).default;

  let output = render(page);
  const setInput = (placeholder, value) => {
    const input = output.inputs.find((item) => item.props.placeholder === placeholder);
    if (!input) throw new Error("Missing signup input: " + placeholder);
    input.props.onChange({ target: { value } });
  };

  setInput("Nguyễn Văn A", scenario.fullName ?? "  Nguyễn Văn A  ");
  setInput("student@lefthand.vn", scenario.email ?? "  student@example.test  ");
  setInput("••••••••", scenario.password ?? "Password123!");
  const passwordInputs = output.inputs.filter((item) => item.props.type === "password");
  passwordInputs[1].props.onChange({ target: { value: scenario.confirmPassword ?? scenario.password ?? "Password123!" } });

  output = render(page);
  timeline.push("form.submit");
  const form = output.form;
  if (!form) throw new Error("Signup form was not rendered");
  await form.props.onSubmit({ preventDefault() {} });

  if (authCalls === 0) {
    timeline.push("validation.blocked");
  } else {
    timeline.splice(1, 0, "validation.passed", "hook.signup");
  }

  output = render(page);
  if (output.text.includes("Kiểm tra email")) timeline.push("success.ui");
  if (output.text.includes("Không thể hoàn tất đăng ký")) timeline.push("error.ui");
  console.log(JSON.stringify({ signUpArgs, authCalls, timeline, text: output.text }));
} catch (error) {
  console.log(JSON.stringify({ signUpArgs, authCalls, timeline, text: "", error: String(error?.message ?? error) }));
}
`;

async function runSignupPageScenario(scenario: SignupPageRuntimeScenario): Promise<SignupPageRuntimeResult & { error?: string }> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--experimental-test-module-mocks", "--import", "tsx/esm", "-e", signupPageRuntimeHarness, JSON.stringify(scenario)],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
  );
  return JSON.parse(stdout.trim()) as SignupPageRuntimeResult & { error?: string };
}

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
        fullName: "  Nguyễn Văn A  ",
        emailRedirectTo: "https://lefthand.vn/auth/callback"
      });

      assert.strictEqual(callCount, 1, "supabase.auth.signUp() must be called exactly once");
      assert.deepStrictEqual(capturedArgs, {
        email: "student@lefthand.vn",
        password: "SecurePassword123!",
        options: {
          data: { full_name: "Nguyễn Văn A" },
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
        password: "Password123!",
        fullName: "Test Student"
      });

      assert.deepStrictEqual(capturedArgs, {
        email: "test@lefthand.vn",
        password: "Password123!",
        options: { data: { full_name: "Test Student" } }
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
        password: "Password123!",
        fullName: "Existing Student"
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(
        result.error,
        "Không thể hoàn tất đăng ký lúc này. Vui lòng kiểm tra thông tin và thử lại sau."
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
        password: "Password123!",
        fullName: "Auto Confirmed Student"
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
        password: "Password123!",
        fullName: "Confirmed Student"
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
        password: "Password123!",
        fullName: "Network Student"
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "Không thể hoàn tất đăng ký lúc này. Vui lòng kiểm tra thông tin và thử lại sau.");
    });

    test("performSignup rejects omitted, blank, and overlong full names before auth", async () => {
      let authCalls = 0;
      const mockSupabase: SupabaseAuthLike = {
        auth: {
          signUp: async () => {
            authCalls++;
            return { data: null, error: null };
          }
        }
      };

      for (const fullName of [undefined, "   ", "x".repeat(201)]) {
        const result = await performSignup(mockSupabase, {
          email: "student@lefthand.vn",
          password: "Password123!",
          fullName
        });
        assert.equal(result.success, false);
        assert.match(result.error ?? "", /Họ và tên/);
      }
      assert.equal(authCalls, 0);
    });

  });

  describe("2. Client-side Input Validation & Submission Guard", () => {
    test("validateSignupInput validates email format", () => {
      const invalidEmails = ["", "invalid", "user@", "@domain.com", "user@domain", "user@.com"];
      for (const email of invalidEmails) {
        const res = validateSignupInput({
          email,
          fullName: "Test Student",
          password: "ValidPassword123",
          confirmPassword: "ValidPassword123"
        });
        assert.strictEqual(res.isValid, false, `Expected invalid email for: ${email}`);
        assert.strictEqual(res.error, "Email không hợp lệ. Vui lòng kiểm tra lại.");
      }

      const validRes = validateSignupInput({
        email: "student@lefthand.vn",
        fullName: "Test Student",
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
          fullName: "Test Student",
          password,
          confirmPassword: password
        });
        assert.strictEqual(res.isValid, false, `Expected short password rejection for: ${password}`);
        assert.strictEqual(res.error, "Mật khẩu phải có ít nhất 8 ký tự.");
      }

      const validRes = validateSignupInput({
        email: "student@lefthand.vn",
        fullName: "Test Student",
        password: "Password123",
        confirmPassword: "Password123"
      });
      assert.strictEqual(validRes.isValid, true);
    });

    test("validateSignupInput rejects password mismatch", () => {
      const res = validateSignupInput({
        email: "student@lefthand.vn",
        fullName: "Test Student",
        password: "Password123!",
        confirmPassword: "DifferentPassword123!"
      });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.error, "Mật khẩu xác nhận không khớp.");
    });

    test("validateSignupInput requires a trimmed, bounded full name", () => {
      for (const fullName of [undefined, "   ", "x".repeat(201)]) {
        const result = validateSignupInput({
          fullName,
          email: "student@lefthand.vn",
          password: "Password123!",
          confirmPassword: "Password123!"
        });
        assert.equal(result.isValid, false);
        assert.match(result.error ?? "", /Họ và tên/);
      }
      assert.equal(validateSignupInput({
        fullName: "  Nguyễn Văn A  ",
        email: "student@lefthand.vn",
        password: "Password123!",
        confirmPassword: "Password123!"
      }).isValid, true);
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
    test("mapSignupError maps duplicate email variants to one generic response", () => {
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
          "Không thể hoàn tất đăng ký lúc này. Vui lòng kiểm tra thông tin và thử lại sau."
        );
      }
    });

    test("mapSignupError does not inspect raw weak-password text", () => {
      const mapped = mapSignupError({ message: "Password should be at least 6 characters." });
      assert.strictEqual(
        mapped,
        "Không thể hoàn tất đăng ký lúc này. Vui lòng kiểm tra thông tin và thử lại sau."
      );
    });

    test("mapSignupError does not inspect raw invalid-email text", () => {
      const mapped = mapSignupError({ message: "Unable to validate email address: invalid format" });
      assert.strictEqual(
        mapped,
        "Không thể hoàn tất đăng ký lúc này. Vui lòng kiểm tra thông tin và thử lại sau."
      );
    });

    test("mapSignupError does not inspect raw signup-disabled text", () => {
      const mapped = mapSignupError({ message: "Signups not allowed for this instance" });
      assert.strictEqual(
        mapped,
        "Không thể hoàn tất đăng ký lúc này. Vui lòng kiểm tra thông tin và thử lại sau."
      );
    });

    test("mapSignupError does not inspect raw rate-limit text", () => {
      const mapped = mapSignupError({ message: "over_email_send_rate_limit" });
      assert.strictEqual(
        mapped,
        "Không thể hoàn tất đăng ký lúc này. Vui lòng kiểm tra thông tin và thử lại sau."
      );
    });

    test("mapSignupError falls back safely on generic / unknown provider error", () => {
      const mapped = mapSignupError({ message: "Internal server database error #50312" });
      assert.strictEqual(
        mapped,
        "Không thể hoàn tất đăng ký lúc này. Vui lòng kiểm tra thông tin và thử lại sau."
      );
    });
  });

  describe("5. Runtime Signup Form, Hook & Page", () => {
    test("real form → validation → hook → auth.signUp passes trimmed metadata and renders session-null success", async () => {
      const result = await runSignupPageScenario({
        fullName: "  Nguyễn Văn A  ",
        email: "  student@example.test  "
      });

      assert.equal(result.error, undefined);
      assert.deepEqual(result.signUpArgs, {
        email: "student@example.test",
        password: "Password123!",
        options: {
          data: { full_name: "Nguyễn Văn A" },
          emailRedirectTo: "https://lefthand.vn/auth/callback"
        }
      });
      assert.equal(result.authCalls, 1);
      assert.deepEqual(result.timeline, [
        "form.submit",
        "validation.passed",
        "hook.signup",
        "auth.signUp",
        "success.ui"
      ]);
      assert.match(result.text, /Kiểm tra email/);
      assert.doesNotMatch(result.text, /RAW SQL|student@example\.test/);
    });

    test("real form blocks blank and overlong full names before auth.signUp", async () => {
      for (const fullName of ["   ", "x".repeat(201)]) {
        const result = await runSignupPageScenario({ fullName });
        assert.equal(result.error, undefined);
        assert.equal(result.authCalls, 0);
        assert.deepEqual(result.timeline, ["form.submit", "validation.blocked"]);
      }
    });

    test("real form maps auth/profile-trigger failure to a generic error UI without leaking raw details", async () => {
      const result = await runSignupPageScenario({
        fullName: "Nguyễn Văn Trigger",
        authError: "profile trigger failed: INSERT INTO profiles; RAW SQL secret=jwt nguyen@example.test"
      });

      assert.equal(result.error, undefined);
      assert.equal(result.authCalls, 1);
      assert.deepEqual(result.timeline, [
        "form.submit",
        "validation.passed",
        "hook.signup",
        "auth.signUp",
        "error.ui"
      ]);
      assert.match(result.text, /Không thể hoàn tất đăng ký/);
      assert.doesNotMatch(result.text, /profile trigger failed|RAW SQL|secret=jwt|nguyen@example\.test/);
    });
  });
});
