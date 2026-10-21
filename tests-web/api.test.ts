import { it, expect, vi } from "vitest";
vi.mock("../src/lib/db", () => ({ db: {} }));
import { POST, GET } from "../src/app/api/[...path]/route";
const ctx = { params: Promise.resolve({ path: ["actions"] }) };
it("rejects unauthorized API mutations before accessing database", async () => {
  vi.stubEnv("APP_ACCESS_TOKEN", "expected");
  const r = await POST(
    new Request("http://localhost:3000/api/actions", {
      method: "POST",
      body: "{}",
    }),
    ctx,
  );
  expect(r.status).toBe(401);
  vi.unstubAllEnvs();
});
it("returns sanitized schema validation errors", async () => {
  const r = await POST(
    new Request("http://localhost:3000/api/actions", {
      method: "POST",
      body: JSON.stringify({ action: "profile", data: { email: "private" } }),
    }),
    ctx,
  );
  expect(r.status).toBe(400);
  expect(await r.text()).not.toContain("private");
});
it("returns explicit 404 for unknown API route", async () => {
  const r = await GET(new Request("http://localhost:3000/api/unknown"), {
    params: Promise.resolve({ path: ["unknown"] }),
  });
  expect(r.status).toBe(404);
});
