import { it, expect, vi, afterAll } from "vitest";
vi.mock("../src/lib/ai/provider", async () => {
  const f = await import("./fixtures");
  const schemas = await import("../src/lib/schemas");
  return {
    OpenAIProvider: class {
      async evaluateJobFit() {
        return f.match;
      }
      async generateStructuredOutput(schema: unknown) {
        if (schema === schemas.interviewSchema)
          return {
            technical: ["How did you use TypeScript?"],
            behavioral: ["Describe a project challenge"],
            companyPreparation: ["Ask about engineering priorities"],
            starFrameworks: [
              {
                question: "Describe your project",
                factIds: ["f1"],
                framework:
                  "Use your verified portfolio project; supply your own situation and result.",
              },
            ],
            nextQuestion: "What would you improve?",
            feedback: "Describe the actual result.",
          };
        if (schema === schemas.careerSchema)
          return {
            gaps: [
              {
                skill: "SQL",
                priority: "high",
                evidence: "Fixture role gap",
                steps: ["Build a query"],
                project: "Practice database queries",
              },
            ],
          };
        return f.draft;
      }
      async reviewDocument() {
        return f.review;
      }
    },
  };
});
import { db } from "../src/lib/db";
import { POST, GET } from "../src/app/api/[...path]/route";
import { profile, job } from "./fixtures";
afterAll(async () => {
  await db.$disconnect();
});
async function action(action: string, data: unknown) {
  const r = await POST(
    new Request("http://localhost:3000/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data }),
    }),
    { params: Promise.resolve({ path: ["actions"] }) },
  );
  const body = await r.json();
  expect(r.status, JSON.stringify(body)).toBe(200);
  return body;
}
it("completes profile → import → match → reviewed documents → download → manual tracker update", async () => {
  if (process.env.ALLOW_TEST_DATABASE_WRITES !== "true")
    throw new Error("Disposable test database opt-in required");
  await action("profile", profile);
  const j = await action("job", { ...job, title: "End-to-end Engineer" });
  const m = await action("match", { jobId: j.id });
  expect(m.result.overall).toBe(74);
  const rejected = await POST(
    new Request("http://localhost:3000/api/actions", {
      method: "POST",
      body: JSON.stringify({
        action: "draft",
        data: { jobId: j.id, reviewedMatchId: "stale-id" },
      }),
    }),
    { params: Promise.resolve({ path: ["actions"] }) },
  );
  expect(rejected.status).toBe(422);
  const drafted = await action("draft", { jobId: j.id, reviewedMatchId: m.id });
  const docs = await db.generatedDocument.findMany({
    where: { applicationId: drafted.applicationId },
  });
  expect(docs.length).toBeGreaterThanOrEqual(2);
  const cv = docs.find((d) => d.kind === "cv")!;
  expect(cv.source).toContain(profile.email);
  expect(cv.source).not.toContain("Unconfirmed award");
  const pdf = await GET(
    new Request(`http://localhost:3000/api/documents/${cv.id}?format=pdf`),
    { params: Promise.resolve({ path: ["documents", cv.id] }) },
  );
  expect(pdf.status).toBe(200);
  expect(pdf.headers.get("Content-Type")).toBe("application/pdf");
  expect((await pdf.arrayBuffer()).byteLength).toBeGreaterThan(500);
  await action("application", {
    id: drafted.applicationId,
    status: "applied",
    notes: "Manually submitted by candidate",
    stage: "",
    confirmed: true,
  });
  const tracked = await db.application.findUnique({
    where: { id: drafted.applicationId },
  });
  expect(tracked?.appliedAt).not.toBeNull();
  expect(tracked?.status).toBe("applied");
  await action("edit-document", { id: cv.id, source: cv.source });
  const after = await db.generatedDocument.count({
    where: { applicationId: drafted.applicationId },
  });
  expect(after).toBe(docs.length + 1);
  const state = await GET(new Request("http://localhost:3000/api/state"), {
    params: Promise.resolve({ path: ["state"] }),
  });
  expect(state.status).toBe(200);
  expect((await state.json()).applications.length).toBeGreaterThan(0);
  const prep = await action("interview", { jobId: j.id });
  expect(prep.data.result.starFrameworks[0].factIds).toEqual(["f1"]);
  const turn = await action("interview", {
    jobId: j.id,
    sessionId: prep.id,
    answer: "I built the portfolio project.",
  });
  expect(turn.data.previousSessionId).toBe(prep.id);
  expect(turn.data.answer).toContain("portfolio");
  const roadmap = await action("career", {});
  expect(roadmap.gaps[0].skill).toBe("SQL");
  await action("learning", {
    skill: "SQL",
    status: "learning",
    notes: "Working on fixture queries",
  });
  expect(
    (await db.learningProgress.findUnique({ where: { skill: "SQL" } }))?.status,
  ).toBe("learning");
});
