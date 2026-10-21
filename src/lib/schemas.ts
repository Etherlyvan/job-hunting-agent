import { z } from "zod";
const text = z.string().trim().min(1).max(2000);
export const factSchema = z.object({
  id: text,
  category: z.enum([
    "experience",
    "education",
    "project",
    "achievement",
    "certification",
  ]),
  text,
  source: text,
  verified: z.boolean(),
});
export const profileSchema = z.object({
  name: text,
  email: z.string().email(),
  phone: z.string().max(100),
  location: text,
  languages: z.array(text).max(30),
  skills: z.array(text).max(200),
  preferences: z.object({
    roles: z.array(text),
    locations: z.array(text),
    salary: z.string().max(500),
    goals: z.string().max(3000),
    dealBreakers: z.array(text),
  }),
  facts: z.array(factSchema).max(300),
  inferences: z.array(text).max(100),
  missingInformation: z.array(text).max(100),
});
export type Profile = z.infer<typeof profileSchema>;
export const profileImportSchema = profileSchema.extend({
  name: z.string().max(2000),
  email: z.string().max(320),
  location: z.string().max(2000),
});
export const jobSchema = z.object({
  title: text,
  company: text,
  location: text,
  description: z.string().trim().min(30).max(60000),
  url: z.string().url().max(2000).optional(),
  source: z.string().max(100).default("manual"),
  employmentType: z.string().max(100).default(""),
  salary: z.string().max(500).default(""),
  experience: z.string().max(300).default(""),
  expiresAt: z.string().datetime().optional(),
});
export type Job = z.infer<typeof jobSchema>;
const dimension = z.object({
  score: z.number().min(0).max(100),
  evidence: z.string(),
  profileFactIds: z.array(z.string()),
});
const gate = z.object({
  status: z.enum(["PASS", "FAIL", "FLAG"]),
  evidence: z.string(),
});
export const matchSchema = z.object({
  technical: dimension,
  experience: dimension,
  behavioral: dimension,
  career: dimension,
  education: gate,
  location: gate,
  salary: gate,
  language: gate,
  eligibility: gate,
  mandatory: gate,
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  dealBreakers: z.array(z.string()),
});
export const draftSchema = z.object({
  selectedFactIds: z.array(z.string()),
  selectedSkills: z.array(z.string()),
  letter: z.string().min(50).max(6000),
  letterFactIds: z.array(z.string()),
});
export const reviewSchema = z.object({
  approved: z.boolean(),
  unsupportedClaims: z.array(z.string()),
  accuracy: z.string(),
  keywords: z.string(),
  ats: z.string(),
  formatting: z.string(),
  letterQuality: z.string(),
  missingRequirements: z.array(z.string()),
  changes: z.array(z.string()),
});
export const interviewSchema = z.object({
  technical: z.array(z.string()),
  behavioral: z.array(z.string()),
  companyPreparation: z.array(z.string()),
  starFrameworks: z.array(
    z.object({
      question: z.string(),
      factIds: z.array(z.string()),
      framework: z.string(),
    }),
  ),
  nextQuestion: z.string(),
  feedback: z.string(),
});
export const careerSchema = z.object({
  gaps: z.array(
    z.object({
      skill: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      evidence: z.string(),
      steps: z.array(z.string()),
      project: z.string(),
    }),
  ),
});
export const settingsSchema = z.object({
  language: z.enum(["en", "id"]),
  pages: z.union([z.literal(1), z.literal(2)]),
  matchModel: z.string().regex(/^[a-zA-Z0-9._:-]{1,100}$/),
  draftModel: z.string().regex(/^[a-zA-Z0-9._:-]{1,100}$/),
  reviewModel: z.string().regex(/^[a-zA-Z0-9._:-]{1,100}$/),
  source: z.enum(["manual", "freehire"]),
});
export const statusSchema = z.enum([
  "drafted",
  "applied",
  "interview",
  "offer",
  "hired",
  "rejected",
  "no_response",
  "offer_declined",
  "withdrawn",
]);
