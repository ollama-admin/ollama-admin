import { test, expect } from "@playwright/test";

test.describe("Compare Mode (integrated in Chat)", () => {
  test("shows compare toggle button in chat page", async ({ page }) => {
    await page.goto("/chat");
    const compareBtn = page.getByRole("button", { name: /Compare|Comparar|Comparer/ });
    await expect(compareBtn).toBeVisible();
  });

  test("activates compare mode with model selectors", async ({ page }) => {
    await page.goto("/chat");
    const compareBtn = page.getByRole("button", { name: /Compare|Comparar|Comparer/ });
    await compareBtn.click();

    // Should show add model button when compare mode is active
    const addModelBtn = page.getByText(/Add model|Añadir modelo|Afegir model|Ajouter/);
    await expect(addModelBtn).toBeVisible();
  });

  test("can toggle compare mode off", async ({ page }) => {
    await page.goto("/chat");
    const compareBtn = page.getByRole("button", { name: /Compare|Comparar|Comparer/ });
    await compareBtn.click();

    await expect(page.getByText(/Add model|Añadir modelo/)).toBeVisible();

    // Toggle off
    await compareBtn.click();
    await expect(page.getByText(/Add model|Añadir modelo/)).not.toBeVisible();
  });
});
