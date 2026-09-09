import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const appUrl = process.env.PHASE4_APP_URL;
async function main() {
try {
  await access("node_modules/@playwright/test", constants.F_OK);
} catch {
  console.error("[BLOCKED] Install Playwright and configure PHASE4_APP_URL before running the browser harness.");
  process.exitCode = 2;
}
if (process.exitCode !== 2 && appUrl) {
  const result = await execFileAsync(process.platform === "win32" ? "npx.cmd" : "npx", [
    "playwright", "test", "tests/e2e/phase4-consultation.mjs"
  ], { env: { ...process.env, PHASE4_APP_URL: appUrl }, maxBuffer: 1024 * 1024 });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
} else if (process.exitCode !== 2) {
  console.error("[BLOCKED] PHASE4_APP_URL is required.");
  process.exitCode = 2;
}
}

main().catch(() => {
  console.error("[FAIL] Phase 4 browser harness failed.");
  process.exitCode = 1;
});
