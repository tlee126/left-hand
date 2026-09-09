import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("application, local storage, and deployment documentation share the material upload ceiling", async () => {
  const storage = await readFile("lib/storage/material-upload-constants.ts", "utf8");
  const config = await readFile("supabase/config.toml", "utf8");
  const docs = await readFile("docs/database.md", "utf8");
  assert.match(storage, /MAX_VIDEO_BYTES\s*=\s*500\s*\*\s*1024\s*\*\s*1024/);
  assert.match(storage, /MAX_PDF_BYTES\s*=\s*20\s*\*\s*1024\s*\*\s*1024/);
  assert.match(config, /file_size_limit\s*=\s*"500MiB"/);
  assert.match(docs, /PDF \(maximum 20 MiB\)[\s\S]*video \(maximum 500 MiB\)/);
  assert.match(docs, /Hosted Supabase storage configuration is external deployment state/);
});
