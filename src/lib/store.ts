import { Prisma } from "@prisma/client";
import { db } from "./db";
import { profileSchema, settingsSchema, type Profile } from "./schemas";
import { normalizeJob } from "./jobs";
import { PublicError } from "./security";
import { pythonCheck } from "./python";
export const json = (data: unknown) =>
  JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
export const personalUser = "personal";
export async function settings() {
  const user = await db.user.upsert({
    where: { id: personalUser },
    create: { id: personalUser },
    update: {},
  });
  return settingsSchema.parse({
    language: "en",
    pages: 2,
    matchModel:
      process.env.OPENAI_MODEL_MATCH ??
      process.env.OPENAI_MODEL ??
      "gpt-4.1-mini",
    draftModel:
      process.env.OPENAI_MODEL_DRAFT ??
      process.env.OPENAI_MODEL ??
      "gpt-4.1-mini",
    reviewModel:
      process.env.OPENAI_MODEL_REVIEW ??
      process.env.OPENAI_MODEL ??
      "gpt-4.1-mini",
    source: "manual",
    ...(user.settings as object),
  });
}
export async function getProfile() {
  const p = await db.candidateProfile.findUnique({
    where: { userId: personalUser },
  });
  if (!p) throw new PublicError("Save your candidate profile first.", 422);
  return { record: p, profile: profileSchema.parse(p.data) };
}
export async function saveProfile(profile: Profile) {
  const ids = profile.facts.map((f) => f.id);
  if (new Set(ids).size !== ids.length)
    throw new PublicError("Fact IDs must be unique.");
  return db.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: personalUser },
      create: { id: personalUser },
      update: {},
    });
    const p = await tx.candidateProfile.upsert({
      where: { userId: personalUser },
      create: { userId: personalUser, data: json(profile) },
      update: { data: json(profile) },
    });
    await tx.workExperience.deleteMany({ where: { profileId: p.id } });
    await tx.education.deleteMany({ where: { profileId: p.id } });
    await tx.project.deleteMany({ where: { profileId: p.id } });
    await tx.skill.deleteMany({ where: { profileId: p.id } });
    const rows = (category: string) =>
      profile.facts
        .filter((f) => f.category === category)
        .map((f) => ({ profileId: p.id, data: json(f) }));
    await tx.workExperience.createMany({ data: rows("experience") });
    await tx.education.createMany({ data: rows("education") });
    await tx.project.createMany({ data: rows("project") });
    await tx.skill.createMany({
      data: [...new Set(profile.skills)].map((name) => ({
        profileId: p.id,
        name,
      })),
    });
    return p;
  });
}
export async function saveJob(raw: unknown) {
  const initial = normalizeJob(raw);
  const originalGuard = (await pythonCheck("guard", {
    text: (raw as { description: string }).description,
  })) as { text: string; verdict: string; counts: Record<string, number> };
  const { job, key, guard } = normalizeJob({
    ...initial.job,
    description: originalGuard.text,
  });
  return db.jobPosting.upsert({
    where: { key },
    create: {
      key,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      url: job.url,
      source: job.source,
      metadata: json({
        ...job,
        guard: [...initial.guard, ...guard],
        postingGuard: originalGuard.verdict,
        guardCounts: originalGuard.counts,
      }),
    },
    update: {},
  });
}
export async function getJob(id: string) {
  const job = await db.jobPosting.findUnique({ where: { id } });
  if (!job) throw new PublicError("Job not found.", 404);
  return job;
}
export async function snapshot() {
  const [
    profile,
    jobs,
    applications,
    documents,
    interviews,
    usage,
    learning,
    prefs,
  ] = await Promise.all([
    db.candidateProfile.findUnique({ where: { userId: personalUser } }),
    db.jobPosting.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    db.application.findMany({
      include: { job: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.generatedDocument.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { application: { include: { job: true } } },
    }),
    db.interviewSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { job: true },
    }),
    db.aIUsageLog.aggregate({
      _sum: { inputTokens: true, outputTokens: true, approximateCost: true },
      _count: true,
    }),
    db.learningProgress.findMany(),
    settings(),
  ]);
  return {
    profile: profile?.data ?? null,
    jobs,
    applications,
    documents,
    interviews,
    usage,
    learning,
    settings: prefs,
    apiConfigured: Boolean(process.env.OPENAI_API_KEY),
  };
}
