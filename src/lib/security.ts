import { timingSafeEqual, createHash } from "node:crypto";
export class PublicError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function validatePublicUrl(raw: string) {
  const u = new URL(raw);
  // Metadata only. No arbitrary URL is ever fetched by the application.
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    !u.hostname.includes(".") ||
    /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
      u.hostname,
    ) ||
    /[\[\]:]/.test(u.hostname) ||
    /\.(local|internal|localhost)$/i.test(u.hostname)
  )
    throw new PublicError(
      "Use a public HTTPS URL and paste the job description.",
    );
  u.hash = "";
  for (const k of [...u.searchParams.keys()])
    if (/^utm_|^trk$|^trackingId$/i.test(k)) u.searchParams.delete(k);
  return u.toString();
}
export function cleanPosting(raw: string) {
  const findings: string[] = [];
  let text = raw.replace(
    /<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi,
    () => {
      findings.push("hidden block");
      return "";
    },
  );
  text = text
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, () => {
      findings.push("invisible character");
      return "";
    });
  text = text
    .split(/\r?\n/)
    .filter((line) => {
      if (
        /ignore (all |previous |prior )*instructions|system prompt|developer message|send .*api.?key|you are (chatgpt|an? ai)|<\|.*\|>/i.test(
          line,
        )
      ) {
        findings.push("instruction-shaped line");
        return false;
      }
      return true;
    })
    .join("\n");
  return { text, findings };
}
export function authorize(request: Request) {
  const expected = process.env.APP_ACCESS_TOKEN;
  if (!expected && process.env.NODE_ENV === "production")
    throw new PublicError(
      "Configure APP_ACCESS_TOKEN before production use.",
      503,
    );
  if (expected) {
    const actual =
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const a = createHash("sha256").update(actual).digest();
    const b = createHash("sha256").update(expected).digest();
    if (!timingSafeEqual(a, b))
      throw new PublicError("Enter your local access token in Settings.", 401);
  }
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (
      origin &&
      origin !== (process.env.APP_ORIGIN ?? "http://localhost:3000")
    )
      throw new PublicError("Origin not allowed.", 403);
  }
}
const buckets = new Map<string, { time: number; count: number }>();
export function rateLimit(key: string, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || now - b.time > 60000) {
    buckets.set(key, { time: now, count: 1 });
    return;
  }
  if (++b.count > 30)
    throw new PublicError("Too many requests. Wait a minute.", 429);
}
export async function readJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new PublicError("JSON body required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1000000) {
      await reader.cancel();
      throw new PublicError("Input exceeds 1 MB.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new PublicError("Invalid JSON.");
  }
}
