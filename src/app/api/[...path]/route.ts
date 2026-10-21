import { z } from "zod";
import { db } from "../../../lib/db";
import {
  authorize,
  readJson,
  PublicError,
  rateLimit,
} from "../../../lib/security";
import {
  profileSchema,
  jobSchema,
  settingsSchema,
  statusSchema,
} from "../../../lib/schemas";
import {
  snapshot,
  saveJob,
  saveProfile,
  getProfile,
  getJob,
  settings,
  json,
  personalUser,
} from "../../../lib/store";
import { OpenAIProvider } from "../../../lib/ai/provider";
import {
  CandidateProfileAgent,
  verifiedProfile,
  JobMatchingAgent,
  draftApplication,
  InterviewPreparationAgent,
  CareerDevelopmentAgent,
} from "../../../lib/agents";
import { adapters, searchSchema } from "../../../lib/jobs";
import { verifiedPdf as createPdf } from "../../../lib/documents";
import { parseTracker } from "../../../lib/tracker";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const actionSchema = z.object({
  action: z.enum([
    "profile",
    "import-cv",
    "job",
    "search",
    "match",
    "draft",
    "application",
    "settings",
    "interview",
    "career",
    "learning",
    "edit-document",
    "import-tracker",
  ]),
  data: z.unknown(),
});
async function provider() {
  const s = await settings();
  return new OpenAIProvider(
    async (usage) => {
      await db.aIUsageLog.create({ data: usage });
    },
    { match: s.matchModel, draft: s.draftModel, review: s.reviewModel },
  );
}
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    authorize(request);
    const { path } = await context.params;
    if (request.method === "GET") {
      if (path.join("/") === "state") return Response.json(await snapshot());
      if (path[0] === "documents" && path[1]) {
        const document = await db.generatedDocument.findUnique({
          where: { id: path[1] },
        });
        if (!document) throw new PublicError("Document not found.", 404);
        const format = new URL(request.url).searchParams.get("format");
        if (format === "pdf") {
          const pages =
            (document.review as { pages?: number }).pages === 2 ? 2 : 1;
          const bytes = await createPdf(
            document.source,
            document.kind === "cv" ? pages : 1,
          );
          return new Response(Buffer.from(bytes), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${document.kind}-${document.id}.pdf"`,
            },
          });
        }
        return new Response(document.source, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${document.kind}-${document.id}.txt"`,
          },
        });
      }
      throw new PublicError("Endpoint not found.", 404);
    }
    if (path.join("/") !== "actions")
      throw new PublicError("Endpoint not found.", 404);
    rateLimit("personal-actions");
    const { action, data } = actionSchema.parse(await readJson(request));
    switch (action) {
      case "profile":
        return Response.json(await saveProfile(profileSchema.parse(data)));
      case "import-cv": {
        const input = z
          .object({
            text: z.string().min(50).max(100000),
            filename: z.string().regex(/\.(txt|md)$/i),
          })
          .parse(data);
        return Response.json(
          await new CandidateProfileAgent(await provider()).importCv(
            input.text,
          ),
        );
      }
      case "job":
        return Response.json(await saveJob(data));
      case "search": {
        const input = searchSchema.parse(data);
        const prefs = await settings();
        if (prefs.source !== "freehire")
          throw new PublicError(
            "Enable Freehire in Settings or use manual import.",
          );
        const jobs = await adapters.freehire.search(input);
        const saved = [];
        for (const j of jobs) saved.push(await saveJob(j));
        return Response.json({ count: saved.length });
      }
      case "match": {
        const { jobId } = z.object({ jobId: z.string() }).parse(data);
        const { record, profile } = await getProfile();
        const job = await getJob(jobId);
        const metadata = job.metadata as { expiresAt?: string };
        if (metadata.expiresAt && Date.parse(metadata.expiresAt) < Date.now())
          throw new PublicError("Posting is expired.", 422);
        const result = await new JobMatchingAgent(await provider()).evaluate(
          profile,
          jobSchema.parse({
            ...job,
            url: job.url ?? undefined,
            ...(job.metadata as object),
          }),
        );
        return Response.json(
          await db.jobMatch.create({
            data: { jobId, profileId: record.id, result: json(result) },
          }),
        );
      }
      case "draft": {
        const { jobId, reviewedMatchId } = z
          .object({ jobId: z.string(), reviewedMatchId: z.string() })
          .parse(data);
        const match = await db.jobMatch.findFirst({
          where: { jobId },
          orderBy: { createdAt: "desc" },
        });
        if (!match || match.id !== reviewedMatchId)
          throw new PublicError(
            "Review the latest fit analysis before requesting documents.",
            422,
          );
        const result = match.result as { recommendation: string };
        if (result.recommendation === "Skip")
          throw new PublicError(
            "Fit gates recommend Skip. Resolve mismatches before drafting.",
            422,
          );
        const { record, profile } = await getProfile();
        if (record.updatedAt > match.createdAt)
          throw new PublicError(
            "Profile changed. Evaluate fit again before drafting.",
            422,
          );
        const job = await getJob(jobId);
        const prefs = await settings();
        const draft = await draftApplication(
          await provider(),
          profile,
          jobSchema.parse({
            ...job,
            url: job.url ?? undefined,
            ...(job.metadata as object),
          }),
          prefs.language,
          prefs.pages,
        );
        await createPdf(draft.cv, prefs.pages);
        await createPdf(draft.letter, 1);
        return Response.json(
          await db.$transaction(async (tx) => {
            const application = await tx.application.upsert({
              where: { jobId },
              create: { jobId },
              update: {},
            });
            await tx.generatedDocument.createMany({
              data: [
                {
                  applicationId: application.id,
                  kind: "cv",
                  source: draft.cv,
                  review: json({
                    ...draft.review,
                    pages: prefs.pages,
                    visualReviewRequired: true,
                  }),
                },
                {
                  applicationId: application.id,
                  kind: "letter",
                  source: draft.letter,
                  review: json({
                    ...draft.review,
                    pages: 1,
                    visualReviewRequired: true,
                  }),
                },
              ],
            });
            return { applicationId: application.id, revision: draft.revision };
          }),
        );
      }
      case "application": {
        const input = z
          .object({
            id: z.string(),
            status: statusSchema,
            notes: z.string().max(10000),
            stage: z.string().max(100),
            confirmed: z.literal(true),
          })
          .parse(data);
        const current = await db.application.findUnique({
          where: { id: input.id },
        });
        if (!current) throw new PublicError("Application not found.", 404);
        return Response.json(
          await db.application.update({
            where: { id: input.id },
            data: {
              status: input.status,
              notes: input.notes,
              stage: input.stage,
              appliedAt:
                input.status === "applied" && !current.appliedAt
                  ? new Date()
                  : current.appliedAt,
            },
          }),
        );
      }
      case "settings": {
        const prefs = settingsSchema.parse(data);
        return Response.json(
          await db.user.upsert({
            where: { id: personalUser },
            create: { id: personalUser, settings: json(prefs) },
            update: { settings: json(prefs) },
          }),
        );
      }
      case "interview": {
        const { jobId, sessionId, answer } = z
          .object({
            jobId: z.string(),
            sessionId: z.string().optional(),
            answer: z.string().max(10000).default(""),
          })
          .parse(data);
        const { profile } = await getProfile();
        const job = await getJob(jobId);
        const previous = sessionId
          ? await db.interviewSession.findFirst({
              where: { id: sessionId, jobId },
            })
          : null;
        const history = { previous: previous?.data ?? null, answer };
        const result = await new InterviewPreparationAgent(
          await provider(),
        ).prepare(
          profile,
          jobSchema.parse({
            ...job,
            url: job.url ?? undefined,
            ...(job.metadata as object),
          }),
          history,
        );
        return Response.json(
          await db.interviewSession.create({
            data: {
              jobId,
              data: json({
                result,
                answer,
                previousSessionId: sessionId ?? null,
              }),
            },
          }),
        );
      }
      case "career": {
        const { profile } = await getProfile();
        const jobs = await db.jobPosting.findMany({
          take: 30,
          include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } },
        });
        return Response.json(
          await new CareerDevelopmentAgent(await provider()).analyze(
            profile,
            jobs,
          ),
        );
      }
      case "learning": {
        const input = z
          .object({
            skill: z.string().min(1).max(200),
            status: z.enum(["planned", "learning", "completed"]),
            notes: z.string().max(3000),
          })
          .parse(data);
        return Response.json(
          await db.learningProgress.upsert({
            where: { skill: input.skill },
            create: input,
            update: input,
          }),
        );
      }
      case "edit-document": {
        const input = z
          .object({ id: z.string(), source: z.string().min(50).max(20000) })
          .parse(data);
        const original = await db.generatedDocument.findUnique({
          where: { id: input.id },
          include: { application: { include: { job: true } } },
        });
        if (!original) throw new PublicError("Document not found.", 404);
        const { profile } = await getProfile();
        const review = await (
          await provider()
        ).reviewDocument({
          profile: verifiedProfile(profile),
          job: original.application.job,
          kind: original.kind,
          draft: input.source,
        });
        if (!review.approved || review.unsupportedClaims.length)
          throw new PublicError(
            "Reviewer rejected the edited version. Correct unsupported claims before saving.",
            422,
          );
        const pages =
          original.kind === "cv" &&
          (original.review as { pages?: number }).pages === 2
            ? 2
            : 1;
        await createPdf(input.source, pages);
        return Response.json(
          await db.generatedDocument.create({
            data: {
              applicationId: original.applicationId,
              kind: original.kind,
              source: input.source,
              review: json({ ...review, pages, visualReviewRequired: true }),
            },
          }),
        );
      }
      case "import-tracker": {
        const input = z
          .object({ csv: z.string().max(500000), confirmed: z.literal(true) })
          .parse(data);
        const rows = parseTracker(input.csv);
        let count = 0;
        for (const row of rows) {
          const job = await saveJob({
            title: row.title,
            company: row.company,
            location: "Unspecified",
            description:
              "Imported tracker record. Import original posting before fit analysis or drafting.",
            url: row.source,
            source: "tracker",
          });
          const result = await db.application.upsert({
            where: { jobId: job.id },
            create: {
              jobId: job.id,
              status: row.status,
              notes: row.notes,
              appliedAt: row.status !== "drafted" ? row.date : null,
            },
            update: {},
          });
          if (result) count++;
        }
        return Response.json({ count });
      }
    }
  } catch (error) {
    if (error instanceof PublicError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error:
            "Invalid input or AI response. Check required fields and field limits.",
        },
        { status: 400 },
      );
    console.error(
      "Request failed",
      error instanceof Error ? error.constructor.name : "UnknownError",
    );
    return Response.json(
      {
        error:
          "Service unavailable. Check database connectivity and server API configuration.",
      },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
