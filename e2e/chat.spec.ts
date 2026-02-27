import { test, expect } from "@playwright/test";

test.describe("Chat Page", () => {
  test("shows empty state when no conversations", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByText(/No conversations|Sin conversaciones/)).toBeVisible();
  });

  test("has server and model selectors", async ({ page }) => {
    await page.goto("/chat");
    const selects = page.locator("select");
    await expect(selects.first()).toBeVisible();
  });

  test("has new conversation button", async ({ page }) => {
    await page.goto("/chat");
    await expect(
      page.getByRole("button", { name: /New Conversation|Nueva conversación/ })
    ).toBeVisible();
  });

  test("has search input for conversations", async ({ page }) => {
    await page.goto("/chat");
    await expect(
      page.getByPlaceholder(/Search conversations|Buscar conversaciones/)
    ).toBeVisible();
  });
});
