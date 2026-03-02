import { test, expect } from "@playwright/test";

test.describe("Alerts Page", () => {
  test("shows empty state when no alerts", async ({ page }) => {
    await page.goto("/admin/alerts");
    await expect(
      page.getByText(/No alerts configured|Sin alertas configuradas/)
    ).toBeVisible();
  });

  test("has create alert form", async ({ page }) => {
    await page.goto("/admin/alerts");
    await expect(page.locator('select[aria-label]')).toBeVisible();
    await expect(page.getByPlaceholder(/Threshold|Umbral/)).toBeVisible();
  });
});
