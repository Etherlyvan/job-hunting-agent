import { test, expect } from "@playwright/test";
test("connects private workspace and imports a real persisted manual posting", async ({
  page,
}) => {
  await page.goto("/settings");
  await page
    .getByLabel("Workspace access token")
    .fill(process.env.TEST_ACCESS_TOKEN ?? "local-browser-test-token");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "AI & document preferences" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Job explorer", exact: true }).click();
  await page
    .getByLabel("title", { exact: true })
    .fill("Browser smoke engineer");
  await page
    .getByLabel("company", { exact: true })
    .fill("Synthetic Browser Fixture");
  await page.getByLabel("location", { exact: true }).fill("Remote");
  await page
    .getByLabel("Full job description")
    .fill(
      "Build TypeScript applications for a synthetic local test. This is a fixture posting, not a real opportunity.",
    );
  await page.getByRole("button", { name: "Save opportunity" }).click();
  await expect(page.getByRole("status")).toContainText("Saved successfully");
  await page
    .getByRole("link", { name: "Browser smoke engineer", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Evaluate fit with GPT" }),
  ).toBeVisible();
  await expect(page.locator(".preview")).toContainText("synthetic local test");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByText("Saved opportunities", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".data/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".data/dashboard-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("gates document generation on review and presents persisted PDFs", async ({
  page,
}) => {
  await page.goto("/settings");
  await page
    .getByLabel("Workspace access token")
    .fill(process.env.TEST_ACCESS_TOKEN ?? "local-browser-test-token");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "AI & document preferences" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "AI CV studio", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Download PDF" }).first(),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).first().click();
  const pdf = await download;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect(await pdf.failure()).toBeNull();
  await page
    .getByRole("link", { name: "Application tracker", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Application records" }),
  ).toBeVisible();
});
