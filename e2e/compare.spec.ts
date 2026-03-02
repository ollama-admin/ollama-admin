import { test, expect } from "@playwright/test";

test.describe("Compare Page", () => {
  test("shows empty state", async ({ page }) => {
    await page.goto("/compare");
    await expect(
      page.getByText(/Compare models side by side|Compara modelos lado a lado/)
    ).toBeVisible();
  });

  test("has model selectors for both sides", async ({ page }) => {
    await page.goto("/compare");
    const selects = page.locator("select");
    await expect(selects).toHaveCount(4); // 2 servers + 2 models
  });

  test("has prompt textarea", async ({ page }) => {
    await page.goto("/compare");
    await expect(
      page.getByPlaceholder(/Enter a prompt|Escribe un prompt/)
    ).toBeVisible();
  });

  test("compare button is disabled without prompt", async ({ page }) => {
    await page.goto("/compare");
    const btn = page.getByRole("button", { name: /Compare|Comparar/ });
    await expect(btn).toBeDisabled();
  });
});
