import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const CRON_PATH = "/api/internal/cron/material-upload-cleanup";
const HOBBY_SCHEDULE = "0 3 * * *";

type CronConfig = {
  crons?: Array<{ path?: unknown; schedule?: unknown }>;
};

function assertVercelHobbyCronConfig(config: unknown): asserts config is CronConfig {
  assert.ok(config !== null && typeof config === "object", "vercel.json must contain an object");
  const crons = (config as CronConfig).crons;
  assert.ok(Array.isArray(crons), "vercel.json must define crons as an array");
  assert.equal(crons.length, 1, "Vercel Hobby config must define exactly one cron job");
  assert.deepEqual(crons[0], { path: CRON_PATH, schedule: HOBBY_SCHEDULE }, "cron must use the approved path and daily schedule");
}

function configWithSchedule(schedule: string): CronConfig {
  return { crons: [{ path: CRON_PATH, schedule }] };
}

test("Vercel Hobby cleanup cron is parsed, allowlisted, and daily", async () => {
  const source = await readFile(path.resolve(process.cwd(), "vercel.json"), "utf8");
  const config: unknown = JSON.parse(source);
  assertVercelHobbyCronConfig(config);
  assert.equal(config.crons?.[0]?.path, CRON_PATH);
  assert.equal(config.crons?.[0]?.schedule, HOBBY_SCHEDULE);
});

test("cron schedules more frequent than once daily are rejected", () => {
  for (const schedule of ["*/15 * * * *", "* * * * *", "0 * * * *"]) {
    assert.throws(() => assertVercelHobbyCronConfig(configWithSchedule(schedule)), /approved path and daily schedule/);
  }
});

test("cleanup route contract still requires CRON_SECRET authentication", async () => {
  const route = await readFile(path.resolve(process.cwd(), "app/api/internal/cron/material-upload-cleanup/route.ts"), "utf8");
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /authorization/);
  assert.match(route, /Bearer \$\{configured\}/);
  assert.match(route, /return unauthorized\(\)/);
  assert.match(route, /completeExpiredMaterialAssetUploadCleanup/);
  assert.match(route, /releaseExpiredMaterialAssetUploadCleanup/);
  assert.match(route, /removeNewMaterialObject/);
});
