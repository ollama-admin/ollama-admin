import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("loads the dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Ollama Admin/);
  });

  test("sidebar navigates to all main pages", async ({ page }) => {
    await page.goto("/");

    await page.click('a[href="/chat"]');
    await expect(page).toHaveURL(/\/chat/);

    await page.click('a[href="/compare"]');
    await expect(page).toHaveURL(/\/compare/);

    await page.click('a[href="/discover"]');
    await expect(page).toHaveURL(/\/discover/);
  });

  test("sidebar navigates to admin pages", async ({ page }) => {
    await page.goto("/");

    await page.click('a[href="/admin/models"]');
    await expect(page).toHaveURL(/\/admin\/models/);

    await page.click('a[href="/admin/servers"]');
    await expect(page).toHaveURL(/\/admin\/servers/);

    await page.click('a[href="/admin/logs"]');
    await expect(page).toHaveURL(/\/admin\/logs/);

    await page.click('a[href="/admin/metrics"]');
    await expect(page).toHaveURL(/\/admin\/metrics/);

    await page.click('a[href="/admin/gpu"]');
    await expect(page).toHaveURL(/\/admin\/gpu/);

    await page.click('a[href="/admin/alerts"]');
    await expect(page).toHaveURL(/\/admin\/alerts/);
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("h1")).toContainText(/Settings|Ajustes/);
  });
});
