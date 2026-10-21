import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  agentRules: false,
  turbopack: { root: process.cwd() },
  outputFileTracingIncludes: {
    "/*": [
      "tools/agent_bridge.py",
      "tools/posting_guard.py",
      "tools/verify_pdf.py",
      "tools/page_decode.py",
      ".claude/skills/job-application-assistant/03-writing-style.md",
      ".claude/skills/job-application-assistant/04-job-evaluation.md",
      ".claude/skills/job-application-assistant/07-interview-prep.md",
    ],
  },
  outputFileTracingExcludes: {
    "/*": [
      ".env",
      ".env.*",
      ".data/**",
      "documents/**",
      "cv/**",
      "cover_letters/**",
      "CLAUDE.md",
      ".claude/skills/job-application-assistant/01-*.md",
      ".claude/skills/job-application-assistant/02-*.md",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};
export default config;
