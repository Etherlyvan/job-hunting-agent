import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { AIProvider } from "./ai/provider";
import {
  profileImportSchema,
  matchSchema,
  draftSchema,
  interviewSchema,
  careerSchema,
  type Profile,
  type Job,
} from "./schemas";
import { PublicError } from "./security";
export async function canonical(name: string) {
  return readFile(`.claude/skills/job-application-assistant/${name}`, "utf8");
}
export function verifiedProfile(p: Profile): Profile {
  return { ...p, facts: p.facts.filter((f) => f.verified), inferences: [] };
}
export function assertEvidence(ids: string[], p: Profile) {
  const valid = new Set(p.facts.filter((f) => f.verified).map((f) => f.id));
  if (ids.some((id) => !valid.has(id)))
    throw new PublicError(
      "AI referenced unsupported candidate facts. Draft blocked.",
      502,
    );
}
export function scoreMatch(raw: unknown) {
  const m = matchSchema.parse(raw);
  const failed =
    m.dealBreakers.length > 0 ||
    [
      m.education,
      m.location,
      m.salary,
      m.language,
      m.eligibility,
      m.mandatory,
    ].some((g) => g.status === "FAIL");
  const overall = Math.round(
    m.technical.score * 0.3 +
      m.experience.score * 0.25 +
      m.behavioral.score * 0.15 +
      m.career.score * 0.3,
  );
  return {
    ...m,
    overall: failed ? 0 : overall,
    recommendation: failed
      ? "Skip"
      : overall >= 60
        ? "Apply"
        : overall >= 45
          ? "Consider"
          : "Skip",
    subjective: true,
  };
}
export class CandidateProfileAgent {
  constructor(private ai: AIProvider) {}
  async importCv(text: string) {
    const draft = await this.ai.generateStructuredOutput(
      profileImportSchema,
      "Extract candidate profile from CV. Leave missing identity/contact fields as empty strings; never guess. Assign unique fact IDs and exact source snippets. All extracted facts MUST be verified=false until candidate confirms. Put interpretations in inferences; list missing information.",
      { cv: text },
      "match",
    );
    return {
      ...draft,
      facts: draft.facts.map((f) => ({ ...f, verified: false })),
    };
  }
}
export class JobMatchingAgent {
  constructor(private ai: AIProvider) {}
  async evaluate(profile: Profile, job: Job) {
    const p = verifiedProfile(profile);
    const result = await this.ai.evaluateJobFit({
      profile: p,
      job,
      rubric: await canonical("04-job-evaluation.md"),
    });
    for (const d of [
      result.technical,
      result.experience,
      result.behavioral,
      result.career,
    ])
      assertEvidence(d.profileFactIds, p);
    return scoreMatch(result);
  }
}
export function renderCv(profile: Profile, draft: z.infer<typeof draftSchema>) {
  assertEvidence(draft.selectedFactIds, profile);
  if (draft.selectedSkills.some((s) => !profile.skills.includes(s)))
    throw new PublicError("Unsupported CV skill blocked.", 502);
  const facts = draft.selectedFactIds.map((id) =>
    profile.facts.find((f) => f.id === id)!,
  );
  return [
    profile.name,
    `${profile.email} | ${profile.phone}`,
    profile.location,
    `Languages: ${profile.languages.join(", ")}`,
    "",
    "Skills",
    draft.selectedSkills.join(", "),
    ...(
      [
        "experience",
        "education",
        "project",
        "achievement",
        "certification",
      ] as const
    ).flatMap((category) => {
      const selected = facts.filter((f) => f.category === category);
      return selected.length
        ? ["", category.toUpperCase(), ...selected.map((f) => f.text)]
        : [];
    }),
  ].join("\n");
}
export class CVOptimizationAgent {
  render = renderCv;
}
export class CoverLetterAgent {
  constructor(private ai: AIProvider) {}
  draft(data: unknown) {
    return this.ai.generateStructuredOutput(
      draftSchema,
      "Select relevant verified fact IDs and existing skills for a CV (verbatim facts rendered separately). Write a concise natural cover letter in the requested language. Cite every candidate claim through letterFactIds. No invented metrics, no unverified company claims, no em dashes. Incorporate reviewer feedback when supplied.",
      data,
      "draft",
    );
  }
}
export class ApplicationReviewerAgent {
  constructor(private ai: AIProvider) {}
  review(data: unknown) {
    return this.ai.reviewDocument(data);
  }
}
export async function draftApplication(
  ai: AIProvider,
  profile: Profile,
  job: Job,
  language: "en" | "id",
  pages: 1 | 2,
) {
  const p = verifiedProfile(profile);
  if (!p.facts.length)
    throw new PublicError(
      "Confirm at least one candidate fact before drafting.",
    );
  const style = await canonical("03-writing-style.md");
  const drafter = new CoverLetterAgent(ai);
  const reviewer = new ApplicationReviewerAgent(ai);
  let feedback: unknown = null;
  for (let revision = 0; revision <= 1; revision++) {
    const draft = await drafter.draft({
      profile: p,
      job,
      language,
      pages,
      style,
      feedback,
    });
    assertEvidence(draft.letterFactIds, p);
    const cv = new CVOptimizationAgent().render(p, draft);
    const review = await reviewer.review({
      profile: p,
      job,
      cv,
      letter: draft.letter,
      letterFactIds: draft.letterFactIds,
    });
    if (review.approved && review.unsupportedClaims.length === 0)
      return { cv, letter: draft.letter, review, revision, pages, language };
    feedback = review;
  }
  throw new PublicError(
    "Reviewer did not approve after one revision. No final documents saved. Review verified facts and job requirements.",
    422,
  );
}
export class InterviewPreparationAgent {
  constructor(private ai: AIProvider) {}
  async prepare(profile: Profile, job: Job, history: unknown) {
    const p = verifiedProfile(profile);
    const result = await this.ai.generateStructuredOutput(
      interviewSchema,
      "Prepare technical/behavioral questions, evidence-based STAR frameworks (never invented stories), company research questions rather than unverified claims. If a mock answer is supplied, critique it and ask the next question.",
      {
        profile: p,
        job,
        history,
        methodology: await canonical("07-interview-prep.md"),
      },
      "draft",
    );
    for (const s of result.starFrameworks) assertEvidence(s.factIds, p);
    return result;
  }
}
export class CareerDevelopmentAgent {
  constructor(private ai: AIProvider) {}
  analyze(profile: Profile, jobs: unknown) {
    return this.ai.generateStructuredOutput(
      careerSchema,
      "Prioritize recurring missing skills, concrete learning steps and portfolio projects. Suggestions are future work, never existing accomplishments.",
      { profile: verifiedProfile(profile), jobs },
      "match",
    );
  }
}
