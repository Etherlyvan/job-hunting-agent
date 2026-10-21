import { createHash } from "node:crypto";
import { z } from "zod";
import { cleanPosting, validatePublicUrl, PublicError } from "./security";
import { jobSchema, type Job } from "./schemas";
export function normalizeJob(raw: unknown) {
  const j = jobSchema.parse(raw);
  const guard = cleanPosting(j.description);
  const job = jobSchema.parse({
    ...j,
    description: guard.text,
    url: j.url ? validatePublicUrl(j.url) : undefined,
  });
  return { job, guard: guard.findings, key: jobKey(job) };
}
export function jobKey(job: Job) {
  const fold = (s: string) =>
    s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256")
    .update([fold(job.company), fold(job.title), fold(job.location)].join("\0"))
    .digest("hex");
}
export function deduplicate(jobs: Job[]) {
  return [...new Map(jobs.map((j) => [jobKey(j), j])).values()];
}
export const searchSchema = z.object({
  query: z.string().trim().min(2).max(200),
  location: z.enum(["Indonesia", "Remote", "International"]),
  employmentType: z.string().max(100).default(""),
  experience: z.string().max(100).default(""),
  salary: z.string().max(100).default(""),
});
export interface JobAdapter {
  id: string;
  search(input: z.infer<typeof searchSchema>): Promise<Job[]>;
}
const wire = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().nullish(),
  url: z.string(),
  description: z.string().nullish(),
  enrichment: z
    .object({
      employment_type: z.string().optional(),
      seniority: z.string().optional(),
      salary_min: z.number().optional(),
      salary_currency: z.string().optional(),
      salary_period: z.string().optional(),
    })
    .optional(),
});
export function fromFreehire(raw: unknown): Job {
  const j = wire.parse(raw);
  const e = j.enrichment;
  return normalizeJob({
    title: j.title,
    company: j.company,
    location: j.location || "Unspecified",
    url: j.url,
    description:
      j.description ??
      "Description unavailable. Import full posting before evaluating.",
    source: "freehire",
    employmentType: e?.employment_type ?? "",
    experience: e?.seniority ?? "",
    salary: e?.salary_min
      ? `${e.salary_currency ?? ""} ${e.salary_min}/${e.salary_period ?? "unspecified"}`
      : "",
  }).job;
}
export class FreehireAdapter implements JobAdapter {
  id = "freehire";
  async search(raw: z.infer<typeof searchSchema>) {
    const input = searchSchema.parse(raw);
    const url = new URL("https://freehire.me/api/v1/agent/jobs/search");
    url.searchParams.set("q", input.query);
    url.searchParams.set("limit", "20");
    url.searchParams.set("description_format", "text");
    if (input.location === "Indonesia") url.searchParams.set("countries", "ID");
    if (input.location === "Remote")
      url.searchParams.set("work_mode", "remote");
    if (input.experience) url.searchParams.set("seniority", input.experience);
    const r = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "MadsLorentzen/ai-job-search/0.1 (GPT personal runtime)",
        Accept: "application/json",
      },
    });
    if (!r.ok)
      throw new PublicError(
        "Job source unavailable or rate limited. Use manual import.",
        502,
      );
    const body = await r.text();
    if (body.length > 2000000)
      throw new PublicError("Source response too large.", 502);
    const envelope = z
      .object({ data: z.array(z.unknown()) })
      .parse(JSON.parse(body));
    const jobs: Job[] = [];
    for (const raw of envelope.data) {
      try {
        jobs.push(fromFreehire(raw));
      } catch {
        /* malformed records are skipped, never guessed */
      }
    }
    return deduplicate(jobs).filter(
      (j) =>
        (!input.employmentType ||
          j.employmentType
            .toLowerCase()
            .includes(input.employmentType.toLowerCase())) &&
        (!input.salary ||
          j.salary.toLowerCase().includes(input.salary.toLowerCase())),
    );
  }
}
// Existing LinkedIn CLI is retained as-is. No automated LinkedIn endpoint is
// exposed here because its own source notes prohibit automated access under ToS.
export const adapters: Record<string, JobAdapter> = {
  freehire: new FreehireAdapter(),
};
