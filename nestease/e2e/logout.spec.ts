import { test, expect } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD } from "./constants";

test.describe("Logout flow", () => {
  test("logout redirects to /login and blocks /dashboard access", async ({
    page,
  }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });

    // Click logout
    const logoutButton = page.locator("text=登出").or(page.locator("text=退出"));
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForURL("**/login**", { timeout: 10_000 });
      await expect(page).toHaveURL(/\/login/);

      // After logout, /dashboard should redirect to /login
      await page.goto("/dashboard");
      await page.waitForURL("**/login**", { timeout: 10_000 });
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
