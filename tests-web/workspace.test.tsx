// @vitest-environment jsdom
import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { Workspace } from "../src/components/workspace";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("shows recoverable connection failure without fake dashboard data", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Database unavailable" }),
      }),
  );
  render(<Workspace section="" />);
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    expect.stringContaining("Database unavailable"),
  );
  expect(screen.queryByText("Saved opportunities")).toBeNull();
});
it("stores access token in this tab and reconnects", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Enter token" }),
    });
  vi.stubGlobal("fetch", fetch);
  render(<Workspace section="settings" />);
  fireEvent.change(screen.getByLabelText("Workspace access token"), {
    target: { value: "local-token" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Connect" }));
  await waitFor(() =>
    expect(sessionStorage.getItem("job-agent-token")).toBe("local-token"),
  );
  expect(fetch).toHaveBeenCalledWith(
    "/api/state",
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer local-token" }),
    }),
  );
  sessionStorage.clear();
});
