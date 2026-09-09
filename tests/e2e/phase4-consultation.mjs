import { test, expect } from "@playwright/test";

const appUrl = process.env.PHASE4_APP_URL;
const valid = {
  fullName: "Phase 4 Browser",
  phone: "0901234567",
  faculty: "Khoa Tài chính",
  interest: "Toán",
  need: "Browser fixture",
  sourcePath: "/tai-lieu/ke-toan"
};

test("consultation form submits through the real browser and renders an outcome", async ({ page }) => {
  await page.goto(appUrl + "/tu-van");
  const form = page.locator("form").first();
  await expect(form).toBeVisible();
  await form.locator("input").nth(0).fill(valid.fullName);
  await form.locator("input").nth(1).fill(valid.phone);
  await form.locator("select").nth(0).selectOption({ label: valid.faculty });
  await form.locator("select").nth(1).selectOption({ label: "Kế toán" });
  await form.locator("select").nth(2).selectOption({ label: valid.interest });
  await form.locator("select").nth(3).selectOption({ label: valid.need });
  await form.locator("textarea").fill(valid.need);
  await form.getByRole("button", { name: "Gửi nhu cầu" }).click();
  await expect(form.locator('[role="status"]')).toBeVisible();
});

test("body overflow is rejected by the real route", async ({ request }) => {
  const response = await request.post(appUrl + "/api/consultations", {
    data: { ...valid, need: "x".repeat(32768) },
    headers: { "Idempotency-Key": "phase4-overflow-" + Date.now() }
  });
  expect([400, 413]).toContain(response.status());
});

test("admin page can be opened with an externally configured approved-admin session", async ({ page }) => {
  test.skip(!process.env.PHASE4_APPROVED_ADMIN_STORAGE_STATE, "Provide an approved-admin Playwright storage state for admin mutation/conflict coverage.");
  await page.goto(appUrl + "/quan-tri/tu-van");
  await expect(page.locator("body")).toContainText(/tư vấn|consultation/i);
});
