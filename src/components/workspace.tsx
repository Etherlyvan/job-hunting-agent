"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { snapshot } from "../lib/store";
import type { Profile } from "../lib/schemas";
type State = Awaited<ReturnType<typeof snapshot>>;
type Json = Record<string, unknown>;
const navigation = [
  ["", "Overview"],
  ["profile", "Candidate profile"],
  ["jobs", "Job explorer"],
  ["cv", "AI CV studio"],
  ["letters", "Cover letters"],
  ["tracker", "Application tracker"],
  ["interview", "Interview prep"],
  ["career", "Career development"],
  ["settings", "Settings"],
];
const blankProfile: Profile = {
  name: "",
  email: "",
  phone: "",
  location: "",
  languages: [],
  skills: [],
  preferences: {
    roles: [],
    locations: [],
    salary: "",
    goals: "",
    dealBreakers: [],
  },
  facts: [],
  inferences: [],
  missingInformation: [],
};
export function Workspace({
  section,
  jobId,
}: {
  section: string;
  jobId?: string;
}) {
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [token, setToken] = useState("");
  const [profile, setProfile] = useState(JSON.stringify(blankProfile, null, 2)),
    [result, setResult] = useState<unknown>(null),
    [editing, setEditing] = useState<Record<string, string>>({});
  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionStorage.getItem("job-agent-token") ?? ""}`,
    }),
    [],
  );
  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/state", { headers: headers() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data);
      setError("");
      if (data.profile) setProfile(JSON.stringify(data.profile, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load workspace.");
    }
  }, [headers]);
  useEffect(() => {
    void reload();
  }, [reload]);
  async function action(action: string, data: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/actions", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ action, data }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      await reload();
      setNotice("Saved successfully.");
      return value;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  const form =
    (callback: (data: FormData) => void) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      callback(new FormData(e.currentTarget));
    };
  async function download(id: string, format: string) {
    try {
      const r = await fetch(`/api/documents/${id}?format=${format}`, {
        headers: headers(),
      });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error);
      }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `application-${id}.${format === "pdf" ? "pdf" : "txt"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    }
  }
  const title = navigation.find((n) => n[0] === section)?.[1] ?? "Overview";
  const job = state?.jobs.find((j) => j.id === jobId);
  const selectedMatch = job?.matches[0];
  const evaluation = selectedMatch?.result as Json | undefined;
  const aiNote = (
    <p className="muted">
      AI actions send the selected candidate evidence and job text to OpenAI and
      may incur API costs. Review all output before use.
    </p>
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">↗ Job Agent</div>
        <p>YOUR NEXT CHAPTER, WITH INTENT</p>
        <nav aria-label="Main navigation">
          {navigation.map(([key, label]) => (
            <Link
              key={key}
              href={`/${key}`}
              aria-current={section === key ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <footer>
          Personal workspace
          <br />
          Applications are submitted manually.
          <br />
          <br />
          Built on AI Job Search
          <br />
          by Mads Lorentzen.
        </footer>
      </aside>
      <main className="content">
        <div className="topline">
          <span>PERSONAL CAREER WORKSPACE</span>
          <span>Private · Local first</span>
        </div>
        <div className="eyebrow">BUILD YOUR NEXT OPPORTUNITY</div>
        <h1>{job ? job.title : title}</h1>
        <p className="intro">
          {section === ""
            ? "A clear view of your search. Find relevant roles, prepare truthful applications, and keep moving forward."
            : "Your experience is the source of truth. Keep your evidence current and review each next step."}
        </p>
        {error && (
          <div role="alert" className="notice error">
            {error}{" "}
            <button className="linkbutton" onClick={() => void reload()}>
              Retry connection
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="notice success">
            {notice}
          </div>
        )}
        {busy && (
          <div role="status" className="notice">
            Working… AI requests may take a minute. Keep this page open.
          </div>
        )}
        {section === "settings" && (
          <section className="card">
            <h2>Local access</h2>
            <p>
              The API key stays in your server environment. Enter only your
              APP_ACCESS_TOKEN here; it stays in this browser tab’s session
              storage.
            </p>
            <label htmlFor="token">Workspace access token</label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
            <div className="actions">
              <button
                onClick={() => {
                  sessionStorage.setItem("job-agent-token", token);
                  void reload();
                }}
              >
                Connect
              </button>
            </div>
          </section>
        )}
        {!state && section !== "settings" && (
          <div className="card empty">
            Connect PostgreSQL and run migrations to load your workspace.{" "}
            <Link href="/settings">Open settings</Link>
          </div>
        )}
        {state && (
          <>
            {section === "" && (
              <>
                <div className="stats">
                  {[
                    ["Saved opportunities", state.jobs.length],
                    ["Applications", state.applications.length],
                    [
                      "In interviews",
                      state.applications.filter((a) => a.status === "interview")
                        .length,
                    ],
                    [
                      "Offers",
                      state.applications.filter((a) => a.status === "offer")
                        .length,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="stat">
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <div className="grid">
                  <section className="card">
                    <h2>Recent opportunities</h2>
                    {state.jobs.length ? (
                      state.jobs.slice(0, 5).map((j) => (
                        <div className="job" key={j.id}>
                          <h3>
                            <Link href={`/jobs/${j.id}`}>{j.title}</Link>
                          </h3>
                          <small>
                            {j.company} · {j.location}
                          </small>
                          {j.matches[0] && (
                            <p className="badge">
                              {String((j.matches[0].result as Json).overall)} /
                              100 subjective fit
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty">
                        Your search starts here.
                        <p>
                          <Link href="/profile">Complete your profile</Link>,
                          then <Link href="/jobs">import a role</Link>.
                        </p>
                      </div>
                    )}
                  </section>
                  <section className="card">
                    <h2>Application progress</h2>
                    {["drafted", "applied", "interview", "offer", "hired"].map(
                      (s) => (
                        <div key={s}>
                          <p>
                            {s}{" "}
                            <strong>
                              {
                                state.applications.filter((a) => a.status === s)
                                  .length
                              }
                            </strong>
                          </p>
                          <div className="progress">
                            <span
                              style={{
                                width: `${state.applications.length ? (state.applications.filter((a) => a.status === s).length / state.applications.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      ),
                    )}
                    <p className="muted">
                      Drafted documents are not submitted applications.
                    </p>
                    <Link href="/tracker">Manage applications →</Link>
                  </section>
                </div>
              </>
            )}
            {section === "profile" && (
              <>
                <section className="card">
                  <h2>Import your CV</h2>
                  {aiNote}
                  <label htmlFor="cv-upload">
                    Text or Markdown CV · maximum 100 KB
                  </label>
                  <input
                    id="cv-upload"
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    disabled={busy}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 100000) {
                        setError("CV exceeds 100 KB.");
                        return;
                      }
                      const parsed = await action("import-cv", {
                        filename: f.name,
                        text: await f.text(),
                      });
                      if (parsed) {
                        setProfile(JSON.stringify(parsed, null, 2));
                        setNotice(
                          "Imported draft only. Review each fact and set verified to true only for facts you confirm, then save.",
                        );
                      }
                    }}
                  />
                </section>
                <section className="card">
                  <h2>Candidate evidence</h2>
                  <p>
                    Edit your structured profile below. Each employment,
                    education, project, achievement, or certification fact needs
                    a unique ID, source, and confirmation. Keep AI
                    interpretations in <code>inferences</code>. Skills and
                    personal fields are confirmed by saving.
                  </p>
                  <p>
                    <code>
                      {
                        '{"id":"f1","category":"project","text":"Exact truthful project description","source":"My CV","verified":true}'
                      }
                    </code>
                  </p>
                  <label htmlFor="profile-json">Profile JSON</label>
                  <textarea
                    id="profile-json"
                    className="mono"
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                  />
                  <div className="actions">
                    <button
                      disabled={busy}
                      onClick={() => {
                        try {
                          void action("profile", JSON.parse(profile));
                        } catch {
                          setError("Profile must be valid JSON.");
                        }
                      }}
                    >
                      Confirm and save profile
                    </button>
                  </div>
                </section>
              </>
            )}
            {section === "jobs" && !jobId && (
              <>
                <section className="card">
                  <h2>Find opportunities</h2>
                  <p>
                    Freehire supports technology roles in Indonesia, remote, and
                    international markets. Enable it in Settings. LinkedIn and
                    other portals remain available through original CLIs;
                    restricted portals use manual import.
                  </p>
                  <form
                    onSubmit={form(
                      (d) => void action("search", Object.fromEntries(d)),
                    )}
                  >
                    <div className="row">
                      <div>
                        <label htmlFor="query">Role or skill</label>
                        <input
                          id="query"
                          name="query"
                          required
                          minLength={2}
                          placeholder="Software engineer"
                        />
                      </div>
                      <div>
                        <label htmlFor="location">Market</label>
                        <select id="location" name="location">
                          <option>Indonesia</option>
                          <option>Remote</option>
                          <option>International</option>
                        </select>
                      </div>
                    </div>
                    <div className="row">
                      <div>
                        <label htmlFor="experience">Experience filter</label>
                        <input
                          id="experience"
                          name="experience"
                          placeholder="Source seniority value"
                        />
                      </div>
                      <div>
                        <label htmlFor="employmentType">Employment type</label>
                        <input
                          id="employmentType"
                          name="employmentType"
                          placeholder="full-time"
                        />
                      </div>
                      <div>
                        <label htmlFor="salary">Salary text filter</label>
                        <input id="salary" name="salary" placeholder="IDR" />
                      </div>
                    </div>
                    <div className="actions">
                      <button disabled={busy}>Search Freehire</button>
                    </div>
                  </form>
                </section>
                <section className="card">
                  <h2>Import a posting</h2>
                  <p>
                    Paste the description yourself. The optional URL is stored
                    for reference and is never automatically fetched.
                  </p>
                  <form
                    onSubmit={form((d) => {
                      const data = Object.fromEntries(d);
                      if (!data.url) delete data.url;
                      void action("job", data);
                    })}
                  >
                    <div className="row">
                      {["title", "company", "location"].map((k) => (
                        <div key={k}>
                          <label htmlFor={`job-${k}`}>{k}</label>
                          <input id={`job-${k}`} name={k} required />
                        </div>
                      ))}
                    </div>
                    <label htmlFor="job-url">
                      Source URL (optional, HTTPS)
                    </label>
                    <input id="job-url" name="url" type="url" />
                    <label htmlFor="description">Full job description</label>
                    <textarea
                      id="description"
                      name="description"
                      minLength={30}
                      required
                    />
                    <div className="actions">
                      <button disabled={busy}>Save opportunity</button>
                    </div>
                  </form>
                </section>
                <section className="card">
                  <h2>Saved opportunities</h2>
                  {state.jobs.map((j) => (
                    <div className="job" key={j.id}>
                      <h3>
                        <Link href={`/jobs/${j.id}`}>{j.title}</Link>
                      </h3>
                      <small>
                        {j.company} · {j.location} · {j.source}
                      </small>
                    </div>
                  ))}
                  {!state.jobs.length && (
                    <p className="empty">No saved opportunities yet.</p>
                  )}
                </section>
              </>
            )}
            {section === "jobs" &&
              jobId &&
              (job ? (
                <>
                  <section className="card">
                    <span className="badge">
                      {job.company} · {job.location}
                    </span>
                    <p className="preview">{job.description}</p>
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open original posting ↗
                      </a>
                    )}
                    {aiNote}
                    <div className="actions">
                      <button
                        disabled={busy}
                        onClick={() => void action("match", { jobId })}
                      >
                        Evaluate fit with GPT
                      </button>
                    </div>
                  </section>
                  {evaluation && (
                    <section className="card">
                      <h2>
                        {String(evaluation.overall)} / 100 ·{" "}
                        {String(evaluation.recommendation)}
                      </h2>
                      <p>
                        Subjective prioritization score. Review evidence and all
                        eligibility gates before drafting.
                      </p>
                      <MatchView value={evaluation} />
                      <div className="actions">
                        <button
                          disabled={
                            busy || evaluation.recommendation === "Skip"
                          }
                          onClick={() =>
                            void action("draft", {
                              jobId,
                              reviewedMatchId: selectedMatch?.id,
                            })
                          }
                        >
                          I reviewed the fit · Generate CV & letter
                        </button>
                        <Link href="/cv">Open CV studio</Link>
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <p className="empty">Job not found.</p>
              ))}
            {(section === "cv" || section === "letters") && (
              <>
                <div className="notice">
                  Generate a reviewed application from a{" "}
                  <Link href="/jobs">job’s fit analysis</Link>. Exports use a
                  simple single-column template. Download and visually inspect
                  every PDF before submitting.
                </div>
                {aiNote}
                {state.documents
                  .filter(
                    (d) => d.kind === (section === "cv" ? "cv" : "letter"),
                  )
                  .map((d) => (
                    <section className="card" key={d.id}>
                      <h2>
                        {d.application.job.company} · {d.application.job.title}
                      </h2>
                      <small>
                        Version created {new Date(d.createdAt).toLocaleString()}{" "}
                        · Master profile preserved
                      </small>
                      <label htmlFor={`doc-${d.id}`}>
                        Editable document source
                      </label>
                      <textarea
                        id={`doc-${d.id}`}
                        className="document-editor"
                        value={editing[d.id] ?? d.source}
                        onChange={(e) =>
                          setEditing({ ...editing, [d.id]: e.target.value })
                        }
                      />
                      <details>
                        <summary>Reviewer feedback</summary>
                        <pre className="preview">
                          {JSON.stringify(d.review, null, 2)}
                        </pre>
                      </details>
                      <div className="actions">
                        <button
                          disabled={busy}
                          onClick={() =>
                            void action("edit-document", {
                              id: d.id,
                              source: editing[d.id] ?? d.source,
                            })
                          }
                        >
                          Review & save new version
                        </button>
                        <button
                          className="linkbutton"
                          onClick={() => void download(d.id, "pdf")}
                        >
                          Download PDF
                        </button>
                        <button
                          className="linkbutton"
                          onClick={() => void download(d.id, "source")}
                        >
                          Download editable text
                        </button>
                      </div>
                    </section>
                  ))}
                {!state.documents.some(
                  (d) => d.kind === (section === "cv" ? "cv" : "letter"),
                ) && <p className="empty">No generated versions yet.</p>}
              </>
            )}
            {section === "tracker" && (
              <>
                <section className="card">
                  <h2>Application records</h2>
                  <p>
                    Record only what actually happened. Saving a status records
                    your confirmation; it never sends an application.
                  </p>
                  {state.applications.map((a) => (
                    <form
                      key={a.id}
                      className="job"
                      onSubmit={form(
                        (d) =>
                          void action("application", {
                            ...Object.fromEntries(d),
                            id: a.id,
                            confirmed: true,
                          }),
                      )}
                    >
                      <h3>
                        {a.job.company} · {a.job.title}
                      </h3>
                      <div className="row">
                        <div>
                          <label htmlFor={`status-${a.id}`}>Status</label>
                          <select
                            id={`status-${a.id}`}
                            name="status"
                            defaultValue={a.status}
                          >
                            {[
                              "drafted",
                              "applied",
                              "interview",
                              "offer",
                              "hired",
                              "rejected",
                              "no_response",
                              "offer_declined",
                              "withdrawn",
                            ].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`stage-${a.id}`}>
                            Interview stage
                          </label>
                          <input
                            id={`stage-${a.id}`}
                            name="stage"
                            defaultValue={a.stage}
                          />
                        </div>
                      </div>
                      <label htmlFor={`notes-${a.id}`}>Notes and outcome</label>
                      <textarea
                        id={`notes-${a.id}`}
                        name="notes"
                        defaultValue={a.notes}
                      />
                      <button disabled={busy}>Confirm status and save</button>
                    </form>
                  ))}
                  {!state.applications.length && (
                    <p className="empty">
                      Reviewed application drafts will appear here.
                    </p>
                  )}
                </section>
                <section className="card">
                  <h2>Import existing tracker</h2>
                  <p>
                    Imports original CSV columns (company, role, status, notes,
                    date, source). Existing applications are preserved. Multiple
                    attempts at the same role are currently deduplicated.
                  </p>
                  <form
                    onSubmit={form(
                      (d) =>
                        void action("import-tracker", {
                          csv: d.get("csv"),
                          confirmed: true,
                        }),
                    )}
                  >
                    <label htmlFor="tracker-csv">Tracker CSV</label>
                    <textarea id="tracker-csv" name="csv" required />
                    <button disabled={busy}>Confirm import</button>
                  </form>
                </section>
              </>
            )}
            {section === "interview" && (
              <>
                <section className="card">
                  <h2>Prepare for a conversation</h2>
                  {aiNote}
                  <form
                    onSubmit={form(
                      (d) =>
                        void action("interview", { jobId: d.get("jobId") }),
                    )}
                  >
                    <label htmlFor="interview-job">Role</label>
                    <select id="interview-job" name="jobId" required>
                      <option value="">Select an opportunity</option>
                      {state.jobs.map((j) => (
                        <option value={j.id} key={j.id}>
                          {j.company} · {j.title}
                        </option>
                      ))}
                    </select>
                    <div className="actions">
                      <button disabled={busy}>Generate preparation pack</button>
                    </div>
                  </form>
                </section>
                {state.interviews.map((s) => (
                  <section key={s.id} className="card">
                    <h2>
                      {s.job.company} · {s.job.title}
                    </h2>
                    <InterviewView value={(s.data as Json).result as Json} />
                    <form
                      onSubmit={form(
                        (d) =>
                          void action("interview", {
                            jobId: s.jobId,
                            sessionId: s.id,
                            answer: d.get("answer"),
                          }),
                      )}
                    >
                      <label htmlFor={`answer-${s.id}`}>
                        Your mock interview answer
                      </label>
                      <textarea id={`answer-${s.id}`} name="answer" required />
                      <button disabled={busy}>
                        Get feedback & next question
                      </button>
                    </form>
                  </section>
                ))}
              </>
            )}
            {section === "career" && (
              <>
                <section className="card">
                  <h2>Close the gaps that matter</h2>
                  {aiNote}
                  <button
                    disabled={busy}
                    onClick={async () => setResult(await action("career", {}))}
                  >
                    Analyze saved opportunities
                  </button>
                  {result != null && (
                    <pre className="preview">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  )}
                </section>
                <section className="card">
                  <h2>Learning progress</h2>
                  <form
                    onSubmit={form(
                      (d) => void action("learning", Object.fromEntries(d)),
                    )}
                  >
                    <label htmlFor="skill">Skill</label>
                    <input id="skill" name="skill" required />
                    <label htmlFor="learning-status">Progress</label>
                    <select id="learning-status" name="status">
                      <option>planned</option>
                      <option>learning</option>
                      <option>completed</option>
                    </select>
                    <label htmlFor="learning-notes">Evidence / next step</label>
                    <textarea id="learning-notes" name="notes" />
                    <button disabled={busy}>Save progress</button>
                  </form>
                  {state.learning.map((l) => (
                    <div className="job" key={l.id}>
                      <strong>{l.skill}</strong> · {l.status}
                      <p>{l.notes}</p>
                    </div>
                  ))}
                </section>
              </>
            )}
            {section === "settings" && (
              <>
                <section className="card">
                  <h2>AI & document preferences</h2>
                  <p>
                    OpenAI key:{" "}
                    {state.apiConfigured
                      ? "configured on server"
                      : "not configured"}
                    . Change credentials through your local .env, then restart.
                    Model access depends on your OpenAI account.
                  </p>
                  <form
                    onSubmit={form(
                      (d) =>
                        void action("settings", {
                          ...Object.fromEntries(d),
                          pages: Number(d.get("pages")),
                        }),
                    )}
                  >
                    {[
                      ["matchModel", "Matching model"],
                      ["draftModel", "Drafting model"],
                      ["reviewModel", "Reviewer model"],
                    ].map(([k, label]) => (
                      <div key={k}>
                        <label htmlFor={k}>{label}</label>
                        <input
                          id={k}
                          name={k}
                          defaultValue={state.settings[k as "matchModel"]}
                          required
                        />
                      </div>
                    ))}
                    <label htmlFor="language">Document language</label>
                    <select
                      id="language"
                      name="language"
                      defaultValue={state.settings.language}
                    >
                      <option value="en">English</option>
                      <option value="id">Bahasa Indonesia</option>
                    </select>
                    <label htmlFor="pages">CV page limit</label>
                    <select
                      id="pages"
                      name="pages"
                      defaultValue={state.settings.pages}
                    >
                      <option value="1">One page</option>
                      <option value="2">Two pages</option>
                    </select>
                    <label htmlFor="source">Discovery source</label>
                    <select
                      id="source"
                      name="source"
                      defaultValue={state.settings.source}
                    >
                      <option value="manual">Manual import only</option>
                      <option value="freehire">Freehire public API</option>
                    </select>
                    <div className="actions">
                      <button disabled={busy}>Save preferences</button>
                    </div>
                  </form>
                </section>
                <section className="card">
                  <h2>API usage</h2>
                  <p>
                    {state.usage._count} calls ·{" "}
                    {state.usage._sum.inputTokens ?? 0} input tokens ·{" "}
                    {state.usage._sum.outputTokens ?? 0} output tokens
                  </p>
                  <p>
                    Recorded cost estimate:{" "}
                    {state.usage._sum.approximateCost === null
                      ? "unknown; configure OPENAI_PRICES_JSON"
                      : `$${state.usage._sum.approximateCost.toFixed(4)} (calls with configured prices only)`}
                  </p>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
function MatchView({ value }: { value: Json }) {
  return (
    <>
      {[
        "technical",
        "experience",
        "behavioral",
        "career",
        "education",
        "location",
        "salary",
        "language",
        "eligibility",
        "mandatory",
      ].map((key) => {
        const d = value[key] as Json;
        return (
          <div className="job" key={key}>
            <strong>
              {key} · {String(d.score ?? d.status)}
            </strong>
            <p>{String(d.evidence)}</p>
          </div>
        );
      })}
      {[
        "matchedSkills",
        "missingSkills",
        "strengths",
        "concerns",
        "dealBreakers",
      ].map((key) => (
        <div key={key}>
          <h3>{key}</h3>
          <ul>
            {(value[key] as string[]).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
function InterviewView({ value }: { value: Json }) {
  return (
    <>
      {["technical", "behavioral", "companyPreparation"].map((key) => (
        <div key={key}>
          <h3>{key}</h3>
          <ul>
            {(value[key] as string[]).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ))}
      <h3>STAR frameworks</h3>
      {(value.starFrameworks as { question: string; framework: string }[]).map(
        (s, i) => (
          <p key={i}>
            <strong>{s.question}</strong>
            <br />
            {s.framework}
          </p>
        ),
      )}
      <p>{String(value.feedback)}</p>
      <h3>Next question</h3>
      <p>{String(value.nextQuestion)}</p>
    </>
  );
}
