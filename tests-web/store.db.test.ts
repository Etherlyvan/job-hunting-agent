import { it, expect, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { saveProfile, saveJob, getProfile } from "../src/lib/store";
import { profile, job } from "./fixtures";
// Explicit opt-in: use only a disposable migrated database. Never runs by default.
afterAll(async () => {
  await db.$disconnect();
});
it("persists profile child rows transactionally and deduplicates jobs", async () => {
  if (process.env.ALLOW_TEST_DATABASE_WRITES !== "true")
    throw new Error(
      "Set ALLOW_TEST_DATABASE_WRITES=true with a disposable DATABASE_URL",
    );
  await saveProfile(profile);
  await saveProfile(profile);
  expect((await getProfile()).profile.name).toBe(profile.name);
  const a = await saveJob(job);
  const b = await saveJob({ ...job, company: " FIXTURE CO " });
  expect(a.id).toBe(b.id);
  const p = await getProfile();
  expect(await db.skill.count({ where: { profileId: p.record.id } })).toBe(1);
});
