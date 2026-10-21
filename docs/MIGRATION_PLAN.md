# GPT runtime migration

## Audit and current architecture

The original MIT project by Mads Lorentzen is a file-based personal workspace:
Claude commands orchestrate profile onboarding, portal search, weighted fit
evaluation, LaTeX drafting, independent review, interview preparation and outcomes.
Python tools implement posting integrity, robots/HTTP guards, job keys, scrape/rank
state, salary lookup, PDF extraction and layout checks. Portable TypeScript/Bun
portal CLIs include LinkedIn, Freehire and Danish portals. There was no root Node
application, database, web UI or API provider. Existing Python unittest and portal
fixture suites and GitHub CI are retained. The working tree was clean at audit.

Canonical workflows remain in `.claude/`; these files and the personal profile
methodology are not duplicated or replaced. `/setup` imports/interviews candidate
facts; `/scrape` discovers/deduplicates; `/rank` applies gates and weighted scores;
`/apply` evaluates, drafts, independently reviews, compiles, verifies and records;
`/interview` uses archived evidence; `/outcome` records stages/results; `/expand`
proposes sourced competencies; `/upskill` weights recurring gaps; `/html-report`
renders offline tracker analytics. Slash commands require a compatible agent host;
they are not native Codex commands.

## Target architecture and reusable components

Add Next.js App Router + TypeScript + Tailwind, PostgreSQL/Prisma and Zod alongside
the existing framework. A server-only OpenAI Responses provider supplies validated
outputs, bounded retries/timeouts and usage records. Eight service responsibilities
cover profile extraction, discovery, matching, CV selection, letter drafting,
independent review, interview coaching and career development. These are bounded
service calls, not autonomous agents with shell/network permissions.

Reuse original rubric files at runtime, existing portal normalization contract and
Freehire CLI helpers, preserve LinkedIn CLI without enabling prohibited scraping,
and retain Python security/PDF tools and LaTeX templates. New PDFs use a simple
single-column text layout; original LaTeX workflow remains available separately.

## Phases and required modifications

1. Audit, baseline tests, provider abstraction, schemas and security boundary.
2. Profile import, evidence-based match, fact-selected CV, letter/reviewer loop.
3. Relational persistence, immutable document versions, tracker CSV import.
4. Dashboard, profile, explorer/details, studios, tracker, interviews and settings.
5. Indonesia/remote filters, manual imports, interview feedback, learning roadmap.
6. Offline tests, typecheck/lint/build, migrations, Docker and operational docs.

## Risks

No API key means live model quality cannot be verified. Docker daemon was not
running; a separate native PostgreSQL 18 test cluster was created to verify
migrations, relational persistence and the complete mocked-AI API workflow.
Prompt-injection filtering is advisory; model calls receive no external tools.
AI interpretation and reviewer approval are not proof of factual accuracy.
Private local-only deployment has no multiuser authentication; do not expose it.
Portal access policies may change; blocked sources use manual import. API prices
are supplied by the operator per model, never guessed. Original personalized
tracked markdown must never be pushed to a public fork.

## Feature parity checklist

- [x] Preserve canonical workflow files, original MIT license, portals and tools.
- [x] Add OpenAI provider, structured validation and bounded service orchestration.
- [x] Add profile, manual job import, fit analysis and draft/review workflow.
- [x] Add database schema/migration and personal dashboard/tracker.
- [x] Add PDF/source exports, interview and career services.
- [ ] Verify live OpenAI output with operator credentials.
- [x] Verify migrations and full workflow against running PostgreSQL (mocked AI).
- [ ] Automated company research, portfolio crawling and LaTeX studio integration.
- [ ] Full parity for Notion/Gmail sync, salary benchmarking and custom templates
  in the web runtime (original workflows remain intact).

See `docs/IMPLEMENTATION.md` for final validation and concrete limitations.
