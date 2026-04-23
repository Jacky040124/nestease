import { test, expect } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD } from "./constants";

test.describe("Authentication flow", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");

    // No broken images
    const images = page.locator("img");
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const naturalWidth = await img.evaluate(
        (el: HTMLImageElement) => el.naturalWidth
      );
      expect(naturalWidth, `Image ${i} should not be broken`).toBeGreaterThan(0);
    }

    // Correct copy — desktop shows All-in-One positioning
    await expect(
      page.locator("text=物业管理，一个平台全搞定")
    ).toBeVisible();

    // No old copy
    await expect(
      page.locator("text=让物业维修管理")
    ).not.toBeVisible();

    // Form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator("text=忘记密码")).toBeVisible();
    await expect(page.locator("text=注册新账号")).toBeVisible();
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // Should show error message and not stay in loading state
    await expect(page.locator(".text-error")).toBeVisible({
      timeout: 10_000,
    });
    const button = page.locator('button[type="submit"]');
    await expect(button).not.toHaveText("登录中...", { timeout: 10_000 });
  });

  test("login with correct credentials redirects to dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to /dashboard
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("unauthenticated access to /dashboard redirects to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login**", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("authenticated access to /login redirects to /dashboard", async ({
    page,
  }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });

    // Now visit /login — should redirect back
    await page.goto("/login");
    await page.waitForURL("**/dashboard**", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
