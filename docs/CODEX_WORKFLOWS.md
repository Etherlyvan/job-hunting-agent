# Codex and the GPT runtime

`AGENTS.md` points to the canonical `.claude/` methodology. Codex does not execute
Claude slash commands natively. Ask Codex to follow the named canonical workflow,
or use the web application (which implements explicit bounded service calls).

| Canonical workflow | Web runtime equivalent |
| --- | --- |
| `/setup` | Candidate profile: JSON editor or text/Markdown CV extraction, then user confirmation |
| `/scrape` | Job explorer: opt-in Freehire, Indonesia/remote/international filters; manual URL + text import |
| `/rank` | Job details: fit evaluation, canonical weights and gates, evidence and missing skills |
| `/apply` | Review match, explicitly request drafts, independent reviewer, at most one revision, PDF checks |
| `/outcome` | Tracker status, date, stage and outcome notes; original CSV import |
| `/interview` | Interview prep packs and persisted text mock interview answer/feedback turns |
| `/upskill` | Career development: gap roadmap and persisted learning progress |
| `/html-report` | Dashboard counts and application progress (original offline report workflow retained) |
| `/expand` | Record sourced facts and separate inferences manually; automatic portfolio research deferred |

Use only evidence the candidate confirms. Never fabricate facts or submit
applications. Any request to send email, sync to an external system, deploy, delete
data or submit an application requires a separate explicit user instruction and
confirmation of the concrete action. There are no such tools in the web runtime.

The original LaTeX templates, salary tools, Danish portals and Notion/Gmail
workflows remain available through their canonical specifications, independently
of the web application. Private web profiles live in PostgreSQL and do not rewrite
tracked template profiles. Deliberate migration back to markdown is manual.
