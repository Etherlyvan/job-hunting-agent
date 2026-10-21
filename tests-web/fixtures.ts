import type { Profile } from "../src/lib/schemas";
export const profile: Profile = {
  name: "Test Candidate",
  email: "candidate@example.test",
  phone: "+62 123456789",
  location: "Jakarta",
  languages: ["Indonesian native", "English professional"],
  skills: ["TypeScript"],
  preferences: {
    roles: ["Engineer"],
    locations: ["Remote"],
    salary: "",
    goals: "Build useful tools",
    dealBreakers: [],
  },
  facts: [
    {
      id: "f1",
      category: "project",
      text: "Built a TypeScript portfolio project.",
      source: "Test fixture CV",
      verified: true,
    },
    {
      id: "f2",
      category: "achievement",
      text: "Unconfirmed award",
      source: "Inference",
      verified: false,
    },
  ],
  inferences: [],
  missingInformation: [],
};
const d = {
  score: 80,
  evidence: "Portfolio uses TypeScript",
  profileFactIds: ["f1"],
};
const g = { status: "PASS" as const, evidence: "No mismatch stated" };
export const match = {
  technical: d,
  experience: { ...d, score: 60 },
  behavioral: { ...d, score: 50 },
  career: { ...d, score: 90 },
  education: g,
  location: g,
  salary: g,
  language: g,
  eligibility: g,
  mandatory: g,
  matchedSkills: ["TypeScript"],
  missingSkills: ["SQL"],
  strengths: ["Portfolio"],
  concerns: [],
  dealBreakers: [],
};
export const job = {
  title: "Software Engineer",
  company: "Fixture Co",
  location: "Remote",
  description:
    "Build TypeScript services and collaborate with engineering teams.",
  source: "manual",
  employmentType: "",
  salary: "",
  experience: "",
};
export const draft = {
  selectedFactIds: ["f1"],
  selectedSkills: ["TypeScript"],
  letter:
    "Dear Hiring Manager, I built a TypeScript portfolio project. I would welcome a discussion about your engineering role.",
  letterFactIds: ["f1"],
};
export const review = {
  approved: true,
  unsupportedClaims: [],
  accuracy: "Grounded",
  keywords: "TypeScript",
  ats: "Single column",
  formatting: "Inspect PDF",
  letterQuality: "Concise",
  missingRequirements: ["SQL"],
  changes: [],
};
