import { test, expect } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD } from "./constants";

// Helper: login as PM and navigate
async function pmLoginAndGo(
  page: import("@playwright/test").Page,
  path: string
) {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15_000 });
  await page.goto(path);
}

test.describe("Contractor Auth — E2E", () => {
  // ── Login page ────────────────────────────────────────────

  test("contractor login page renders correctly", async ({ page }) => {
    await page.goto("/login/contractor");
    await expect(page.locator("text=工人登录")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="tel"]')).toBeVisible();
    await expect(page.locator("text=发送验证码")).toBeVisible();
    await expect(page.locator("text=前往注册")).toBeVisible();
  });

  test("contractor login requires phone before sending OTP", async ({ page }) => {
    await page.goto("/login/contractor");
    await expect(page.locator("text=工人登录")).toBeVisible({ timeout: 10_000 });
    // Send OTP button should be disabled when phone is empty
    const sendBtn = page.locator("button", { hasText: "发送验证码" });
    await expect(sendBtn).toBeDisabled();
  });

  // ── Register page ─────────────────────────────────────────

  test("contractor register page renders with PM code input", async ({ page }) => {
    await page.goto("/register/contractor");
    await expect(page.locator("text=工人注册")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[placeholder="输入 6 位注册码"]')).toBeVisible();
    await expect(page.locator("button", { hasText: "验证" })).toBeVisible();
    await expect(page.locator("text=登录")).toBeVisible();
  });

  test("register page auto-fills PM code from URL param", async ({ page }) => {
    await page.goto("/register/contractor?code=ABC123");
    await expect(page.locator("text=工人注册")).toBeVisible({ timeout: 10_000 });
    const codeInput = page.locator('input[placeholder="输入 6 位注册码"]');
    await expect(codeInput).toHaveValue("ABC123");
  });

  // ── Old URL redirects ─────────────────────────────────────

  test("old /quote URL redirects to contractor login", async ({ page }) => {
    await page.goto("/quote?id=test-wo-123");
    await page.waitForURL("**/login/contractor**", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login\/contractor/);
    // Should preserve redirect param
    await expect(page).toHaveURL(/redirect/);
  });

  test("old /completion-report URL redirects to contractor login", async ({ page }) => {
    await page.goto("/completion-report?id=test-wo-456");
    await page.waitForURL("**/login/contractor**", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login\/contractor/);
    await expect(page).toHaveURL(/redirect/);
  });

  // ── Contractor home (unauthenticated) ─────────────────────

  test("contractor home redirects to login when not authenticated", async ({ page }) => {
    // Clear any existing contractor token
    await page.goto("/login/contractor");
    await page.evaluate(() => localStorage.removeItem("contractor_token"));
    await page.goto("/contractor/home");
    await page.waitForURL("**/login/contractor**", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login\/contractor/);
  });

  // ── PM Settings — PM Code ─────────────────────────────────

  test("PM settings page shows PM Code section", async ({ page }) => {
    await pmLoginAndGo(page, "/dashboard/settings");
    await expect(page.locator("text=设置").first()).toBeVisible({ timeout: 10_000 });
    // PM Code section
    await expect(page.locator("text=工人注册码")).toBeVisible();
    // Copy button
    await expect(page.locator("button", { hasText: "复制注册链接" })).toBeVisible({ timeout: 10_000 });
    // PM Code should be visible (6 char code)
    const codeEl = page.locator("code");
    await expect(codeEl).toBeVisible({ timeout: 10_000 });
    const codeText = await codeEl.textContent();
    expect(codeText?.trim().length).toBe(6);
  });
});
