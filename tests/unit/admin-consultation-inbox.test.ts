import assert from "node:assert/strict";
import { test, describe } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const pagePath = path.resolve(process.cwd(), "app/quan-tri/tu-van/page.tsx");

async function readPage(): Promise<string> {
  return fs.readFile(pagePath, "utf-8");
}

describe("Task 4.2-C: Admin consultation inbox", () => {
  test("is a server-only page with no browser or service-role access", async () => {
    const code = await readPage();
    assert.ok(!code.includes('"use client"'));
    assert.ok(!code.includes("@/lib/supabase/client"));
    assert.ok(!code.includes("SUPABASE_SERVICE_ROLE_KEY"));
    assert.ok(!code.includes("service_role"));
    assert.ok(!code.includes('from("consultations")'));
    assert.ok(!code.includes(".insert("));
    assert.ok(!code.includes(".update("));
    assert.ok(!code.includes(".delete("));
  });

  test("checks approved admin access before loading consultations", async () => {
    const code = await readPage();
    const accessIndex = code.indexOf("await getAccountAccess()");
    const repositoryIndex = code.indexOf("await listConsultations(options)");

    assert.ok(code.includes('import { getAccountAccess } from "@/lib/auth/session"'));
    assert.ok(code.includes('import { notFound, redirect } from "next/navigation"'));
    assert.ok(code.includes('access.status !== "approved"'));
    assert.ok(code.includes('access.profile?.role !== "admin"'));
    assert.ok(accessIndex >= 0 && repositoryIndex > accessIndex);
    assert.ok(code.includes("notFound()"));
  });

  test("uses the required anonymous redirect and blocks non-admin accounts", async () => {
    const code = await readPage();
    assert.ok(code.includes('const INBOX_PATH = "/quan-tri/tu-van"'));
    assert.ok(code.includes("encodeURIComponent(INBOX_PATH)"));
    assert.ok(code.includes("access.status !== \"approved\""));
    assert.ok(code.includes("access.profile?.role !== \"admin\""));
  });

  test("maps valid query parameters to repository options and safely defaults invalid values", async () => {
    const code = await readPage();
    assert.ok(code.includes('firstParam(params.q)?.trim() ?? ""'));
    assert.ok(code.includes("parseStatus(firstParam(params.status))"));
    assert.ok(code.includes("parsePage(firstParam(params.page))"));
    assert.ok(code.includes("/^\\d+$/.test(value)"));
    assert.ok(code.includes("return 1"));
    assert.ok(code.includes("VALID_CONSULTATION_STATUSES.includes"));
    assert.ok(code.includes("limit: DEFAULT_CONSULTATION_PAGE_LIMIT"));
    assert.ok(code.includes("offset: (page - 1) * DEFAULT_CONSULTATION_PAGE_LIMIT"));
    assert.ok(code.includes("if (search) options.search = search"));
    assert.ok(code.includes("if (status) options.status = status"));
  });

  test("renders a read-only inbox, safe error state, and filter-preserving links", async () => {
    const code = await readPage();
    assert.ok(code.includes('<form method="get"'));
    assert.ok(code.includes('name="q"'));
    assert.ok(code.includes('name="status"'));
    assert.ok(code.includes("created_at"));
    assert.ok(code.includes("full_name"));
    assert.ok(code.includes("phone"));
    assert.ok(code.includes("faculty"));
    assert.ok(code.includes("interest"));
    assert.ok(code.includes("need"));
    assert.ok(code.includes("consultation.status"));
    assert.ok(code.includes("Chưa có yêu cầu tư vấn phù hợp."));
    assert.ok(code.includes("Không thể tải danh sách tư vấn lúc này."));
    assert.ok(code.includes('params.set("q", search)'));
    assert.ok(code.includes('params.set("status", status)'));
    assert.ok(code.includes("buildQuery(page - 1, search, status)"));
    assert.ok(code.includes("buildQuery(page + 1, search, status)"));
    assert.ok(!code.includes("error.message"));
    assert.ok(!code.includes("console."));
  });
});
