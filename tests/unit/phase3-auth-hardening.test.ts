import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, test } from "node:test";
import { handleAuthCallback } from "../../app/auth/callback/route";
import {
  mapAuthError,
  mapProfileError,
  PUBLIC_ERROR_MESSAGES
} from "../../lib/auth/error-mapper";
import {
  getSafeRedirectPath,
  isSafeInternalPath
} from "../../lib/auth/redirect";
import {
  mapSignupError,
  performSignup,
  type SupabaseAuthLike
} from "../../lib/auth/signup";

const execFileAsync = promisify(execFile);
const GENERIC_SIGNUP_ERROR = PUBLIC_ERROR_MESSAGES.SIGNUP_FAILED;

function successAuthClient() {
  return {
    auth: {
      exchangeCodeForSession: async () => ({
        data: { session: { access_token: "test-token" }, user: { id: "user-1" } },
        error: null
      })
    }
  };
}

function withEnvironment(overrides: Record<string, string | undefined>, callback: () => Promise<void>) {
  const original = new Map<string, string | undefined>();
  for (const key of Object.keys(overrides)) {
    original.set(key, process.env[key]);
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }

  return callback().finally(() => {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

describe("Phase 3 auth/profile hardening runtime coverage", () => {
  test("internal redirect helper rejects absolute, protocol-relative, encoded-host, and CRLF targets", () => {
    const maliciousTargets = [
      "https://evil.example",
      "http://evil.example",
      "//evil.example",
      "/%2F%2Fevil.example",
      "/%252F%252Fevil.example",
      "/%68%74%74%70%3A%2F%2Fevil.example",
      "/safe%0d%0aLocation:%20https://evil.example",
      "/safe\\\\evil.example",
      "javascript:alert(1)",
      "not-a-path"
    ];

    for (const target of maliciousTargets) {
      assert.equal(isSafeInternalPath(target), false, `target must be rejected: ${target}`);
      assert.equal(getSafeRedirectPath(target), "/ca-nhan");
    }

    assert.equal(
      getSafeRedirectPath("/quan-tri/tai-khoan?q=Nguy%E1%BB%85n&page=2"),
      "/quan-tri/tai-khoan?q=Nguy%E1%BB%85n&page=2"
    );
  });

  test("callback route uses canonical origin and never trusts forwarded host/proto", async () => {
    await withEnvironment(
      {
        NODE_ENV: "production",
        SITE_URL: undefined,
        NEXT_PUBLIC_SITE_URL: undefined
      },
      async () => {
        const maliciousNextTargets = [
          "https://evil.example",
          "//evil.example",
          "/%2F%2Fevil.example",
          "/%252F%252Fevil.example",
          "/safe%0d%0aLocation:%20https://evil.example"
        ];

        for (const target of maliciousNextTargets) {
          const request = new Request(
            `https://request-host.example/auth/callback?code=valid&next=${encodeURIComponent(target)}`,
            {
              headers: {
                "x-forwarded-host": "evil.example",
                "x-forwarded-proto": "http"
              }
            }
          );
          const response = await handleAuthCallback(request, successAuthClient());
          assert.equal(response.status, 307);
          assert.equal(response.headers.get("location"), "https://lefthand.vn/ca-nhan");
        }

        const internalTarget = "/quan-tri/tai-khoan?q=Nguy%E1%BB%85n&page=2";
        const response = await handleAuthCallback(
          new Request(
            `https://request-host.example/auth/callback?code=valid&next=${encodeURIComponent(internalTarget)}`,
            { headers: { "x-forwarded-host": "evil.example", "x-forwarded-proto": "http" } }
          ),
          successAuthClient()
        );
        const location = new URL(response.headers.get("location") ?? "");
        assert.equal(location.origin, "https://lefthand.vn");
        assert.equal(location.pathname, "/quan-tri/tai-khoan");
        assert.equal(location.search, "?q=Nguy%E1%BB%85n&page=2");
      }
    );
  });

  test("callback route honors an exact configured canonical origin only", async () => {
    await withEnvironment(
      {
        NODE_ENV: "production",
        SITE_URL: "https://staging.lefthand.vn",
        NEXT_PUBLIC_SITE_URL: undefined
      },
      async () => {
        const response = await handleAuthCallback(
          new Request("https://request-host.example/auth/callback?code=valid&next=/ca-nhan", {
            headers: { "x-forwarded-host": "evil.example", "x-forwarded-proto": "http" }
          }),
          successAuthClient()
        );
        assert.equal(response.headers.get("location"), "https://staging.lefthand.vn/ca-nhan");
      }
    );
  });

  test("shared error mapper uses fixed messages and only known safe provider codes", () => {
    assert.deepEqual(mapAuthError({ code: "invalid_credentials", message: "RAW SQL user@example.test" }), {
      code: "AUTH_INVALID_CREDENTIALS",
      message: PUBLIC_ERROR_MESSAGES.AUTH_INVALID_CREDENTIALS
    });
    assert.deepEqual(mapAuthError({ code: "email_not_confirmed", message: "private provider detail" }), {
      code: "AUTH_EMAIL_NOT_CONFIRMED",
      message: PUBLIC_ERROR_MESSAGES.AUTH_EMAIL_NOT_CONFIRMED
    });
    assert.equal(
      mapAuthError({ message: "invalid credentials" }).message,
      PUBLIC_ERROR_MESSAGES.AUTH_UNAVAILABLE
    );
    assert.equal(mapAuthError(new Error("network token=secret"), "login").message, PUBLIC_ERROR_MESSAGES.AUTH_UNAVAILABLE);
    assert.equal(mapSignupError({ code: "user_already_exists", message: "user@example.test" }), GENERIC_SIGNUP_ERROR);
    assert.equal(mapSignupError({ message: "network SQL password=secret" }), GENERIC_SIGNUP_ERROR);
    assert.equal(mapProfileError({ message: "duplicate key SQL uuid=user-1" }).message, PUBLIC_ERROR_MESSAGES.PROFILE_UPDATE_FAILED);
  });

  test("performSignup executes the real auth boundary, trims fields, and keeps duplicate errors generic", async () => {
    const timeline: string[] = [];
    let captured: unknown;
    const client: SupabaseAuthLike = {
      auth: {
        signUp: async (options) => {
          timeline.push("auth.signUp");
          captured = options;
          return {
            data: { user: { id: "auth-user-1", email: options.email } as any, session: null },
            error: null
          };
        }
      }
    };

    const result = await performSignup(client, {
      email: "  student@example.test  ",
      password: "SecurePassword123!",
      fullName: "  Nguyễn Văn A  ",
      emailRedirectTo: "https://lefthand.vn/auth/callback"
    });

    assert.equal(result.success, true);
    assert.deepEqual(captured, {
      email: "student@example.test",
      password: "SecurePassword123!",
      options: {
        data: { full_name: "Nguyễn Văn A" },
        emailRedirectTo: "https://lefthand.vn/auth/callback"
      }
    });
    assert.deepEqual(timeline, ["auth.signUp"]);

    for (const providerError of [
      { code: "user_already_exists", message: "User already registered student@example.test" },
      { code: "email_exists", message: "duplicate email student@example.test" },
      { code: "database_error", message: "INSERT INTO profiles; password=secret" }
    ]) {
      const duplicateResult = await performSignup(
        {
          auth: {
            signUp: async () => ({ data: null, error: providerError })
          }
        },
        { email: "student@example.test", password: "SecurePassword123!", fullName: "Student" }
      );
      assert.equal(duplicateResult.success, false);
      assert.equal(duplicateResult.error, GENERIC_SIGNUP_ERROR);
      assert.doesNotMatch(duplicateResult.error ?? "", /student@example\.test|password=secret|INSERT/);
    }
  });
});

const loginRuntimeHarness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";

const scenario = JSON.parse(process.argv[1]);
process.env.NODE_ENV = "production";
process.env.NEXT_PUBLIC_DEMO_MODE = "false";
globalThis.window = { location: { origin: "https://lefthand.vn" } };

const state = [];
let cursor = 0;
const refs = [];
let refCursor = 0;
const routerCalls = [];
const authCalls = [];
const localStorageValues = new Map();

function useState(initialValue) {
  const index = cursor++;
  if (!(index in state)) state[index] = initialValue;
  return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
}
function useRef(initialValue) {
  const index = refCursor++;
  if (!(index in refs)) refs[index] = { current: initialValue };
  return refs[index];
}
function useEffect(callback) { callback(); }
function useTransition() { return [false, (callback) => callback()]; }

const authClient = {
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async (options) => {
      authCalls.push({ method: "signInWithPassword", options });
      if (scenario.throwError) throw new Error(scenario.rawError || "network failure");
      if (scenario.errorCode || scenario.rawError) {
        return { data: { user: null }, error: { code: scenario.errorCode, message: scenario.rawError } };
      }
      return { data: { user: { id: "login-user-1", email: options.email, user_metadata: { full_name: "Student" } } }, error: null };
    },
    signOut: async () => {
      authCalls.push({ method: "signOut" });
      if (scenario.throwError) throw new Error(scenario.rawError || "network failure");
      return { error: null };
    }
  }
};

const jsx = (type, props) => ({ type, props: props ?? {} });
const component = (props) => ({ type: "component", props });

globalThis.localStorage = {
  getItem: (key) => localStorageValues.get(key) ?? null,
  setItem: (key, value) => localStorageValues.set(key, value),
  removeItem: (key) => localStorageValues.delete(key)
};

globalThis.__phase3UseState = useState;
globalThis.__phase3UseEffect = useEffect;
globalThis.__phase3UseTransition = useTransition;
globalThis.__phase3CreateClient = () => { if (scenario.missingEnv) throw new Error("Missing Supabase token=secret"); return authClient; };
globalThis.__phase3RouterCalls = routerCalls;
globalThis.__phase3Query = scenario.query || "";

const authClientModule = "data:text/javascript," + encodeURIComponent("export const createClient = () => globalThis.__phase3CreateClient();");
const navigationModule = "data:text/javascript," + encodeURIComponent("export const useRouter = () => ({ push: (value) => globalThis.__phase3RouterCalls.push(value) }); export const useSearchParams = () => new URLSearchParams(globalThis.__phase3Query);");
globalThis.__phase3UseRef = useRef;
const reactModule = "data:text/javascript," + encodeURIComponent("export const useState = (...args) => globalThis.__phase3UseState(...args); export const useRef = (...args) => globalThis.__phase3UseRef(...args); export const useEffect = (...args) => globalThis.__phase3UseEffect(...args); export const useTransition = (...args) => globalThis.__phase3UseTransition(...args); export const Suspense = (props) => props.children;");
const signupModule = "data:text/javascript," + encodeURIComponent("export const performSignup = async () => ({ success: false }); export const mapSignupError = () => \"Không thể hoàn tất đăng ký lúc này.\"; export const getValidCallbackUrl = () => undefined; export const validateSignupInput = () => ({ isValid: true }); export const validateSignupFullName = () => ({ isValid: true });");
const errorModule = "data:text/javascript," + encodeURIComponent("export const AUTH_CALLBACK_ERROR_MESSAGE = \"Liên kết xác thực không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.\"; export const mapAuthError = (error) => ({ code: error?.code === \"invalid_credentials\" ? \"AUTH_INVALID_CREDENTIALS\" : \"AUTH_UNAVAILABLE\", message: error?.code === \"invalid_credentials\" ? \"Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.\" : \"Không thể hoàn tất thao tác tài khoản lúc này. Vui lòng thử lại sau.\" });");
const redirectModule = "data:text/javascript," + encodeURIComponent("export const getSafeRedirectPath = (value) => typeof value === \"string\" && value.startsWith(\"/\") && !value.startsWith(\"//\") && !value.includes(\"://\") ? value : \"/ca-nhan\";");
const imageModule = "data:text/javascript," + encodeURIComponent("export default (props) => ({ type: \"img\", props });");
const linkModule = "data:text/javascript," + encodeURIComponent("export default (props) => ({ type: \"a\", props });");
const iconsModule = "data:text/javascript," + encodeURIComponent("const component = (props) => ({ type: \"component\", props }); export const ArrowLeft = component; export const Lock = component; export const Mail = component; export const Sparkles = component;");
const floatingModule = "data:text/javascript," + encodeURIComponent("export const FloatingActions = () => null;");
const jsxRuntimeModule = "data:text/javascript," + encodeURIComponent("export const jsx = (type, props) => ({ type, props: props || {} }); export const jsxs = jsx; export const Fragment = \"fragment\";");

const moduleValues = {
  [reactModule]: { useState, useEffect, useTransition },
  [authClientModule]: { createClient: () => { if (scenario.missingEnv) throw new Error("Missing Supabase token=secret"); return authClient; } },
  [navigationModule]: { useRouter: () => ({ push: (value) => routerCalls.push(value) }), useSearchParams: () => new URLSearchParams(scenario.query || "") },
  [signupModule]: { performSignup: async () => ({ success: false }), mapSignupError: () => "Không thể hoàn tất đăng ký lúc này.", getValidCallbackUrl: () => undefined, validateSignupInput: () => ({ isValid: true }), validateSignupFullName: () => ({ isValid: true }) },
  [errorModule]: { AUTH_CALLBACK_ERROR_MESSAGE: "Liên kết xác thực không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.", mapAuthError: (error) => ({ code: error?.code === "invalid_credentials" ? "AUTH_INVALID_CREDENTIALS" : "AUTH_UNAVAILABLE", message: error?.code === "invalid_credentials" ? "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại." : "Không thể hoàn tất thao tác tài khoản lúc này. Vui lòng thử lại sau." }) },
  [redirectModule]: { getSafeRedirectPath: (value) => typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("://") ? value : "/ca-nhan" },
  [imageModule]: { default: (props) => ({ type: "img", props }) },
  [linkModule]: { default: (props) => ({ type: "a", props }) },
  [iconsModule]: { ArrowLeft: component, Lock: component, Mail: component, Sparkles: component },
  [floatingModule]: { FloatingActions: () => null },
  [jsxRuntimeModule]: { jsx, jsxs: jsx, Fragment: "fragment" }
};

for (const [specifier, exports] of Object.entries(moduleValues)) {
  // Data URLs are used directly by rewritten imports below.
  void specifier;
  void exports;
}

async function compile(filePath, replacements, loader) {
  let source = await readFile(filePath, "utf8");
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const compiled = await transform(source, { loader, format: "esm", jsx: "automatic", sourcefile: path.basename(filePath) });
  return compiled.code.replaceAll("react/jsx-runtime", jsxRuntimeModule);
}

function inspect(value, output) {
  if (value == null || typeof value === "boolean" || typeof value === "number") return;
  if (typeof value === "string") { output.text += " " + value; return; }
  if (Array.isArray(value)) { value.forEach((item) => inspect(item, output)); return; }
  if (typeof value.type === "function") { inspect(value.type(value.props), output); return; }
  if (value.type === "form") output.form = value;
  if (value.props) inspect(value.props.children, output);
}

function render(page) {
  cursor = 0;
  refCursor = 0;
  const output = { text: "", form: null };
  inspect(page(), output);
  output.text = output.text.trim();
  return output;
}

try {
  const hookCode = await compile(path.resolve(process.cwd(), "hooks/use-demo-auth.ts"), [
    ["\"react\"", "\"" + reactModule + "\""],
    ["\"@/lib/supabase/browser\"", "\"" + authClientModule + "\""],
    ["\"@/lib/auth/signup\"", "\"" + signupModule + "\""],
    ["\"@/lib/auth/error-mapper\"", "\"" + errorModule + "\""]
  ], "ts");
  const hookModule = "data:text/javascript," + encodeURIComponent(hookCode);
  const pageCode = await compile(path.resolve(process.cwd(), "app/dang-nhap/page.tsx"), [
    ["\"react\"", "\"" + reactModule + "\""],
    ["\"next/navigation\"", "\"" + navigationModule + "\""],
    ["\"@/hooks/use-demo-auth\"", "\"" + hookModule + "\""],
    ["\"@/lib/auth/error-mapper\"", "\"" + errorModule + "\""],
    ["\"@/lib/auth/redirect\"", "\"" + redirectModule + "\""],
    ["\"next/image\"", "\"" + imageModule + "\""],
    ["\"next/link\"", "\"" + linkModule + "\""],
    ["\"lucide-react\"", "\"" + iconsModule + "\""],
    ["\"@/components/site/floating-actions\"", "\"" + floatingModule + "\""]
  ], "tsx");
  const page = (await import("data:text/javascript," + encodeURIComponent(pageCode))).default;
  const first = render(page);

  if (scenario.operation === "logout") {
    const hook = (await import(hookModule)).useDemoAuth();
    await hook.logout();
  } else {
    for (const input of [
      { name: "email", value: scenario.email || "student@example.test" },
      { name: "password", value: scenario.password || "Password123!" }
    ]) {
      const node = first.form?.props?.children;
      void node;
    }
    // The form is rendered again with controlled values supplied through its input handlers.
    const inputs = [];
    function collect(value) {
      if (value == null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return;
      if (Array.isArray(value)) { value.forEach(collect); return; }
      if (typeof value.type === "function") { collect(value.type(value.props)); return; }
      if (value.type === "input") inputs.push(value);
      if (value.props) collect(value.props.children);
    }
    collect(page());
    for (const input of inputs) {
      if (input.props.name === "email") input.props.onChange({ target: { value: scenario.email || "student@example.test" } });
      if (input.props.type === "password") input.props.onChange({ target: { value: scenario.password || "Password123!" } });
    }
    const filled = render(page);
    await filled.form.props.onSubmit({ preventDefault() {} });
    render(page);
  }

  console.log(JSON.stringify({ routerCalls, authCalls, text: render(page).text }));
} catch (error) {
  console.log(JSON.stringify({ routerCalls, authCalls, text: "", error: String(error?.message ?? error) }));
}
`;

async function runLoginScenario(scenario: Record<string, unknown>) {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--experimental-test-module-mocks", "--import", "tsx/esm", "-e", loginRuntimeHarness, JSON.stringify(scenario)],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
  );
  return JSON.parse(stdout.trim()) as { routerCalls: string[]; authCalls: unknown[]; text: string; error?: string };
}

describe("Phase 3 login page/hook runtime", () => {
  test("login preserves valid deep-link next and rejects external next", async () => {
    for (const queryAndExpected of [
      ["next=%2Fca-nhan%2Fmon%2Fke-toan%3Ftab%3Dprogress", "/ca-nhan/mon/ke-toan?tab=progress"],
      ["next=%2Fquan-tri%2Ftai-khoan", "/quan-tri/tai-khoan"],
      ["next=%2F%2Fevil.example", "/ca-nhan"],
      ["next=https%3A%2F%2Fevil.example", "/ca-nhan"],
      ["next=", "/ca-nhan"]
    ]) {
      const result = await runLoginScenario({ query: queryAndExpected[0] });
      assert.equal(result.error, undefined);
      assert.deepEqual(result.routerCalls, [queryAndExpected[1]]);
      assert.equal(result.authCalls[0] && (result.authCalls[0] as any).method, "signInWithPassword");
    }
  });

  test("login provider, network, malformed, and missing-env errors stay generic", async () => {
    const cases = [
      { errorCode: "invalid_credentials", rawError: "RAW SQL email=student@example.test" },
      { errorCode: "unknown_provider_code", rawError: "private provider stack token=secret" },
      { throwError: true, rawError: "fetch failed SQL password=secret" },
      { missingEnv: true }
    ];
    for (const scenario of cases) {
      const result = await runLoginScenario({ ...scenario, query: "next=%2Fquan-tri%2Ftai-khoan" });
      assert.equal(result.error, undefined);
      assert.deepEqual(result.routerCalls, []);
      assert.doesNotMatch(result.text, /RAW SQL|student@example\.test|private provider|token=secret|password=secret|Missing Supabase/);
      assert.match(result.text, /Email hoặc mật khẩu|Không thể hoàn tất thao tác tài khoản/);
    }
  });

  test("callback error is rendered as a fixed generic login message", async () => {
    const result = await runLoginScenario({ query: "error=auth_callback" });
    assert.equal(result.error, undefined);
    assert.match(result.text, /Liên kết xác thực không hợp lệ hoặc đã hết hạn/);
  });

  test("logout executes the real signOut boundary", async () => {
    const result = await runLoginScenario({ operation: "logout" });
    assert.equal(result.error, undefined);
    assert.deepEqual(result.authCalls, [{ method: "signOut" }]);
  });
});

const profileActionHarness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";

const scenario = JSON.parse(process.argv[1]);
const timeline = [];
globalThis.__phase3Timeline = timeline;
const access = scenario.status === "anonymous"
  ? { status: "unauthenticated", user: null, profile: null }
  : scenario.status === "profile_missing"
    ? { status: "profile_missing", user: { id: "user-1" }, profile: null }
    : { status: scenario.status, user: { id: "user-1" }, profile: { id: "user-1", role: "student", accountStatus: scenario.status, fullName: "Student" } };

const authModule = "data:text/javascript,phase3-profile-auth";
const repositoryModule = "data:text/javascript,phase3-profile-repository";
const errorModule = "data:text/javascript,phase3-profile-errors";
const cacheModule = "data:text/javascript,phase3-profile-cache";

async function compile(filePath, replacements, loader) {
  let source = await readFile(filePath, "utf8");
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const compiled = await transform(source, { loader, format: "esm", sourcefile: path.basename(filePath) });
  return compiled.code;
}

const authUrl = "data:text/javascript," + encodeURIComponent(
  "export const getAccountAccess = async () => { globalThis.__phase3Timeline.push(\"guard\"); return " + JSON.stringify(access) + "; }"
);
const repoUrl = "data:text/javascript," + encodeURIComponent(
  "export function validateProfileInput(input) {" +
  " globalThis.__phase3Timeline.push(\"validation\");" +
  " if (" + JSON.stringify(Boolean(scenario.invalid)) + ") return { valid: false, errors: { fullName: \"Dữ liệu không hợp lệ.\" } };" +
  " return { valid: true, errors: {}, sanitized: input };" +
  " }" +
  " export async function updateOwnProfile(userId, input) {" +
  " globalThis.__phase3Timeline.push(\"repository\");" +
  " if (" + JSON.stringify(Boolean(scenario.repoError)) + ") return { success: false, error: \"RAW SQL password=secret uuid=\" + userId };" +
  " return { success: true, profile: { id: userId, ...input } };" +
  " }"
);
const errorsUrl = "data:text/javascript," + encodeURIComponent(
  "export const mapProfileError = () => ({ code: \"PROFILE_UPDATE_FAILED\", message: \"Không thể cập nhật hồ sơ lúc này. Vui lòng thử lại sau.\" });"
);
const cacheUrl = "data:text/javascript," + encodeURIComponent(
  "export const revalidatePath = (path) => globalThis.__phase3Timeline.push(\"revalidate:\" + path);"
);

try {
  const source = await compile(path.resolve(process.cwd(), "app/ca-nhan/cai-dat/actions.ts"), [
    ["\"@/lib/auth/session\"", "\"" + authUrl + "\""],
    ["\"@/lib/repositories/profile-repository\"", "\"" + repoUrl + "\""],
    ["\"@/lib/auth/error-mapper\"", "\"" + errorsUrl + "\""],
    ["\"next/cache\"", "\"" + cacheUrl + "\""]
  ], "ts");
  const module = await import("data:text/javascript," + encodeURIComponent(source));
  const formData = new FormData();
  formData.set("fullName", "  Student  ");
  formData.set("faculty", "Accounting");
  formData.set("major", "Audit");
  formData.set("gpaGoal", "3.6");
  const result = await module.updateProfileAction({ success: false }, formData);
  console.log(JSON.stringify({ result, timeline }));
} catch (error) {
  console.log(JSON.stringify({ result: null, timeline, error: String(error?.message ?? error) }));
}
`;

async function runProfileActionScenario(scenario: Record<string, unknown>) {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--experimental-test-module-mocks", "--import", "tsx/esm", "-e", profileActionHarness, JSON.stringify(scenario)],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
  );
  return JSON.parse(stdout.trim()) as { result: any; timeline: string[]; error?: string };
}

describe("Phase 3 profile settings runtime", () => {
  test("all non-approved states stop before validation/repository", async () => {
    for (const status of ["anonymous", "profile_missing", "pending", "rejected", "suspended"]) {
      const result = await runProfileActionScenario({ status });
      assert.equal(result.error, undefined);
      assert.equal(result.result.success, false);
      assert.deepEqual(result.timeline, ["guard"]);
    }
  });

  test("approved profile validates before repository and maps raw DB errors", async () => {
    const invalid = await runProfileActionScenario({ status: "approved", invalid: true });
    assert.equal(invalid.error, undefined);
    assert.equal(invalid.result.success, false);
    assert.deepEqual(invalid.timeline, ["guard", "validation"]);

    const failed = await runProfileActionScenario({ status: "approved", repoError: true });
    assert.equal(failed.error, undefined);
    assert.equal(failed.result.success, false);
    assert.equal(failed.result.message, PUBLIC_ERROR_MESSAGES.PROFILE_UPDATE_FAILED);
    assert.doesNotMatch(failed.result.message, /RAW SQL|password=secret|uuid=/);
    assert.deepEqual(failed.timeline, ["guard", "validation", "repository"]);
  });

  test("approved profile sends allowlisted fields and revalidates both settings paths", async () => {
    const result = await runProfileActionScenario({ status: "approved" });
    assert.equal(result.error, undefined);
    assert.equal(result.result.success, true);
    assert.deepEqual(result.timeline, ["guard", "validation", "repository", "revalidate:/ca-nhan", "revalidate:/ca-nhan/cai-dat"]);
  });
});

const profilePageHarness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";

const scenario = JSON.parse(process.argv[1]);
const access = scenario.status === "anonymous"
  ? { status: "unauthenticated", user: null, profile: null }
  : scenario.status === "profile_missing"
    ? { status: "profile_missing", user: { id: "user-1" }, profile: null }
    : { status: scenario.status, user: { id: "user-1", email: "student@example.test" }, profile: { id: "user-1", role: "student", accountStatus: scenario.status, fullName: "Student" } };
const authUrl = "data:text/javascript," + encodeURIComponent(
  "export const getAccountAccess = async () => (" + JSON.stringify(access) + ");"
);
const navigationModule = "data:text/javascript," + encodeURIComponent("export const redirect = (value) => { throw new Error(\"REDIRECT:\" + value); };");
const linkModule = "data:text/javascript," + encodeURIComponent("export default (props) => ({ type: \"a\", props });");
const componentModule = "data:text/javascript," + encodeURIComponent("const empty = () => null; const pass = (props) => props.children; const profile = (props) => ({ type: \"profile-form\", props }); export const Header = empty; export const Footer = empty; export const FloatingActions = empty; export const MotionReveal = pass; export const ProfileForm = profile; export const ArrowLeft = empty; export const User = empty; export const ShieldCheck = empty;");
const jsxRuntimeModule = "data:text/javascript," + encodeURIComponent("export const jsx = (type, props) => ({ type, props: props || {} }); export const jsxs = jsx; export const Fragment = \"fragment\";");

async function compile(filePath) {
  let source = await readFile(filePath, "utf8");
  source = source
    .replaceAll("\"@/lib/auth/session\"", "\"" + authUrl + "\"")
    .replaceAll("\"next/navigation\"", "\"" + navigationModule + "\"")
    .replaceAll("\"next/link\"", "\"" + linkModule + "\"")
    .replaceAll("\"@/components/site/header\"", "\"" + componentModule + "\"")
    .replaceAll("\"@/components/site/footer\"", "\"" + componentModule + "\"")
    .replaceAll("\"@/components/site/floating-actions\"", "\"" + componentModule + "\"")
    .replaceAll("\"@/components/account/profile-form\"", "\"" + componentModule + "\"")
    .replaceAll("\"@/components/site/motion-reveal\"", "\"" + componentModule + "\"")
    .replaceAll("\"lucide-react\"", "\"" + componentModule + "\"");
  const compiled = await transform(source, { loader: "tsx", format: "esm", jsx: "automatic", sourcefile: path.basename(filePath) });
  return compiled.code.replaceAll("react/jsx-runtime", jsxRuntimeModule);
}

function inspect(value, output) {
  if (value == null || typeof value === "boolean" || typeof value === "number") return;
  if (typeof value === "string") { output.text += " " + value; return; }
  if (Array.isArray(value)) { value.forEach((item) => inspect(item, output)); return; }
  if (typeof value.type === "function") { inspect(value.type(value.props), output); return; }
  if (value.type === "profile-form") output.formRendered = true;
  if (value.props) inspect(value.props.children, output);
}

try {
  const source = await compile(path.resolve(process.cwd(), "app/ca-nhan/cai-dat/page.tsx"));
  const page = (await import("data:text/javascript," + encodeURIComponent(source))).default;
  const output = { text: "", formRendered: false };
  inspect(await page(), output);
  console.log(JSON.stringify(output));
} catch (error) {
  console.log(JSON.stringify({ text: "", formRendered: false, error: String(error?.message ?? error) }));
}
`;

async function runProfilePageScenario(scenario: Record<string, unknown>) {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--experimental-test-module-mocks", "--import", "tsx/esm", "-e", profilePageHarness, JSON.stringify(scenario)],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
  );
  return JSON.parse(stdout.trim()) as { text: string; formRendered: boolean; error?: string };
}

describe("Phase 3 profile settings page runtime", () => {
  test("page redirects each anonymous/missing/non-approved status before rendering the form", async () => {
    const expected = {
      anonymous: "REDIRECT:/dang-nhap?next=%2Fca-nhan%2Fcai-dat",
      profile_missing: "REDIRECT:/cho-duyet?status=missing-profile",
      pending: "REDIRECT:/cho-duyet?status=pending",
      rejected: "REDIRECT:/cho-duyet?status=rejected",
      suspended: "REDIRECT:/cho-duyet?status=suspended"
    };
    for (const [status, redirect] of Object.entries(expected)) {
      const result = await runProfilePageScenario({ status });
      assert.equal(result.error, redirect);
      assert.equal(result.formRendered, false);
    }
  });

  test("approved page renders the real profile form after the server guard", async () => {
    const result = await runProfilePageScenario({ status: "approved" });
    assert.equal(result.error, undefined);
    assert.equal(result.formRendered, true);
  });
});

const adminCacheHarness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";

const scenario = JSON.parse(process.argv[1]);
let authCalls = 0;
let profileCalls = 0;
globalThis.__phase3AuthCalls = () => { authCalls += 1; };
globalThis.__phase3ProfileCalls = () => { profileCalls += 1; };
const profile = scenario.status === "profile_missing" ? null : scenario.status === "approved_admin" ? { id: "admin-1", fullName: "Admin", role: "admin", accountStatus: "approved" } : null;
const user = scenario.status === "anonymous" ? null : { id: "admin-1", email: "admin@example.test" };

const reactUrl = "data:text/javascript," + encodeURIComponent("export const cache = (fn) => { let initialized = false; let result; return async (...args) => { if (!initialized) { initialized = true; result = await fn(...args); } return result; }; };");
const serverUrl = "data:text/javascript," + encodeURIComponent("export const createClient = async () => ({ auth: { getUser: async () => { globalThis.__phase3AuthCalls(); return { data: { user: " + JSON.stringify(user) + " }, error: null }; } } });");
const profileUrl = "data:text/javascript," + encodeURIComponent("export const getProfileByUserId = async () => { globalThis.__phase3ProfileCalls(); return " + JSON.stringify(profile) + "; };");
const jsxRuntimeModule = "data:text/javascript," + encodeURIComponent("export const jsx = (type, props) => ({ type, props: props || {} }); export const jsxs = jsx; export const Fragment = \"fragment\";");

async function compile(filePath, replacements, loader) {
  let source = await readFile(filePath, "utf8");
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const compiled = await transform(source, { loader, format: "esm", jsx: "automatic", sourcefile: path.basename(filePath) });
  return compiled.code.replaceAll("react/jsx-runtime", jsxRuntimeModule);
}

const sessionCode = await compile(path.resolve(process.cwd(), "lib/auth/session.ts"), [
  ["\"react\"", "\"" + reactUrl + "\""],
  ["\"@/lib/supabase/server\"", "\"" + serverUrl + "\""],
  ["\"@/lib/repositories/profile-repository\"", "\"" + profileUrl + "\""]
], "ts");
const sessionUrl = "data:text/javascript," + encodeURIComponent(sessionCode);

const linkUrl = "data:text/javascript," + encodeURIComponent("export default (props) => ({ type: \"a\", props });");
const navigationUrl = "data:text/javascript," + encodeURIComponent("export const redirect = (value) => { throw new Error(\"REDIRECT:\" + value); }; export const notFound = () => { throw new Error(\"NOT_FOUND\"); };");
const accountRepoUrl = "data:text/javascript," + encodeURIComponent("export const ACCOUNT_APPROVAL_STATUSES = [\"pending\", \"approved\", \"rejected\", \"suspended\"]; export const isValidUuid = () => true; export const listAccountsForApproval = async () => [];");
const actionUrl = "data:text/javascript," + encodeURIComponent("export const updateAccountApprovalAction = async () => undefined;");

try {
  const layoutCode = await compile(path.resolve(process.cwd(), "app/quan-tri/layout.tsx"), [
    ["\"@/lib/auth/session\"", "\"" + sessionUrl + "\""],
    ["\"next/link\"", "\"" + linkUrl + "\""],
    ["\"next/navigation\"", "\"" + navigationUrl + "\""]
  ], "tsx");
  const pageCode = await compile(path.resolve(process.cwd(), "app/quan-tri/tai-khoan/page.tsx"), [
    ["\"@/lib/auth/session\"", "\"" + sessionUrl + "\""],
    ["\"./actions\"", "\"" + actionUrl + "\""],
    ["\"@/lib/repositories/account-approval-repository\"", "\"" + accountRepoUrl + "\""],
    ["\"next/link\"", "\"" + linkUrl + "\""],
    ["\"next/navigation\"", "\"" + navigationUrl + "\""]
  ], "tsx");
  const layout = (await import("data:text/javascript," + encodeURIComponent(layoutCode))).default;
  const page = (await import("data:text/javascript," + encodeURIComponent(pageCode))).default;
  await layout({ children: "CHILD" });
  if (scenario.status === "approved_admin") await page({ searchParams: Promise.resolve({}) });
  console.log(JSON.stringify({ authCalls, profileCalls }));
} catch (error) {
  console.log(JSON.stringify({ authCalls, profileCalls, error: String(error?.message ?? error) }));
}
`;

async function runAdminCacheScenario(status: string) {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--experimental-test-module-mocks", "--import", "tsx/esm", "-e", adminCacheHarness, JSON.stringify({ status })],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
  );
  return JSON.parse(stdout.trim()) as { authCalls: number; profileCalls: number; error?: string };
}

describe("Phase 3 request-scoped access memoization", () => {
  test("layout plus admin child share one auth/profile access for approved admin", async () => {
    const result = await runAdminCacheScenario("approved_admin");
    assert.equal(result.error, undefined);
    assert.equal(result.authCalls, 1);
    assert.equal(result.profileCalls, 1);
  });

  test("unauthorized and profile-missing requests guard before child/page data", async () => {
    const anonymous = await runAdminCacheScenario("anonymous");
    assert.equal(anonymous.error, "REDIRECT:/dang-nhap?next=/quan-tri");
    assert.equal(anonymous.authCalls, 1);
    assert.equal(anonymous.profileCalls, 0);

    const missing = await runAdminCacheScenario("profile_missing");
    assert.equal(missing.error, "NOT_FOUND");
    assert.equal(missing.authCalls, 1);
    assert.equal(missing.profileCalls, 1);
  });
});
