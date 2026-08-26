/**
 * Unit Tests for Server-side Catalog Repository (Task 2.5)
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  listPublishedProducts,
  getPublishedProductBySlug,
  type ProductRow
} from "../../lib/repositories/catalog-repository";

describe("Catalog Repository Contract & Query Intent", () => {
  test("repository file exports required functions and types", () => {
    assert.strictEqual(typeof listPublishedProducts, "function");
    assert.strictEqual(typeof getPublishedProductBySlug, "function");
  });

  test("repository inspects missing environment variables and throws clear error on missing config", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      await assert.rejects(
        async () => {
          await listPublishedProducts();
        },
        {
          name: "Error",
          message: /Missing Supabase environment variables/i
        }
      );

      await assert.rejects(
        async () => {
          await getPublishedProductBySlug("sample-slug");
        },
        {
          name: "Error",
          message: /Missing Supabase environment variables/i
        }
      );
    } finally {
      if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
  });

  test("repository code structure conforms to query requirements", async () => {
    const repoFilePath = path.resolve(
      process.cwd(),
      "lib/repositories/catalog-repository.ts"
    );
    const code = await fs.readFile(repoFilePath, "utf-8");

    // Must query from products table
    assert.ok(code.includes('.from("products")'), "Must query the products table");

    // Must select all fields
    assert.ok(code.includes('.select("*")'), 'Must query with .select("*")');

    // Must filter publication_status = 'published'
    assert.ok(
      code.includes('.eq("publication_status", "published")'),
      "Must filter publication_status = published"
    );

    // listPublishedProducts must order by created_at descending
    assert.ok(
      code.includes('.order("created_at", { ascending: false })'),
      "Must order list query by created_at descending"
    );

    // getPublishedProductBySlug must filter by slug and use maybeSingle()
    assert.ok(
      code.includes('.eq("slug", slug)'),
      "Must filter slug for single product query"
    );
    assert.ok(
      code.includes(".maybeSingle()"),
      "Must use .maybeSingle() to return one record or null"
    );

    // Surfaces errors with clear prefix
    assert.ok(
      code.includes("Failed to list published products:"),
      "Must include descriptive error for list failures"
    );
    assert.ok(
      code.includes("Failed to get published product by slug"),
      "Must include descriptive error for slug lookup failures"
    );
  });
});
