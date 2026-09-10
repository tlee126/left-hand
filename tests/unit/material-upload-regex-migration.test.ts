import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationPath = "supabase/migrations/0038_fix_material_upload_filename_regex.sql";
const previousMigrationPath = "supabase/migrations/0036_material_upload_retry_state.sql";

test("0038 fixes only the three material upload filename regex expressions", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const previousSql = await readFile(previousMigrationPath, "utf8");

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.reserve_material_asset_upload\(/i);
  assert.match(sql, /OR p_original_name ~ E'\\\\\.\\\\\.'/);
  assert.match(sql, /OR p_safe_filename ~ E'\\\\\.\\\\\.'/);
  assert.match(sql, /OR p_safe_filename !~ E'\\\\\.'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.reserve_material_asset_upload\(uuid, text, text, text, bigint, uuid\) FROM PUBLIC, anon;/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.reserve_material_asset_upload\(uuid, text, text, text, bigint, uuid\) TO authenticated;/i);

  const functionBody = (source: string) => source.slice(source.indexOf("CREATE OR REPLACE FUNCTION public.reserve_material_asset_upload("), source.indexOf("$function$;", source.indexOf("CREATE OR REPLACE FUNCTION public.reserve_material_asset_upload(")) + "$function$;".length);
  const normalize = (source: string) => source
    .replaceAll("OR p_original_name ~ '\\\\.\\\\.'", "OR p_original_name ~ E'\\\\.\\\\.'")
    .replaceAll("OR p_safe_filename ~ '\\\\.\\\\.'", "OR p_safe_filename ~ E'\\\\.\\\\.'")
    .replaceAll("OR p_safe_filename !~ '\\\\.'", "OR p_safe_filename !~ E'\\\\.'");
  assert.equal(normalize(functionBody(previousSql)), functionBody(sql));
});

test("material upload filename regex accepts valid documents and rejects unsafe names", () => {
  const originalNameHasParentTraversal = (value: string) => /\.\./.test(value);
  const safeFilenameIsValid = (value: string) => /^[a-z0-9][a-z0-9._-]{0,199}$/.test(value) && !/\.\./.test(value) && /\./.test(value);

  for (const filename of [
    "document.pdf",
    "tieu-luan-mon-tri-tue-nhan-tao-trong-kinh-doanh-ung-dung-ai-trong-phan-tich-du.pdf"
  ]) {
    assert.equal(originalNameHasParentTraversal(filename), false);
    assert.equal(safeFilenameIsValid(filename), true);
  }
  assert.equal(safeFilenameIsValid("document..pdf"), false);
  assert.equal(safeFilenameIsValid("documentpdf"), false);
});

test("filename casing and spaces remain handled by the existing normalize layer", async () => {
  const source = await readFile("lib/storage/material-storage.ts", "utf8");
  assert.match(source, /value\.normalize\("NFKD"\)[\s\S]*\.toLowerCase\(\)/);
  assert.match(source, /replace\(\/\[\^a-z0-9_-\]\+\/g, "-"\)/);
});
