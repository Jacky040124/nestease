import { test, expect } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD } from "./constants";

// Helper: login and navigate to dashboard
async function loginAndGo(
  page: import("@playwright/test").Page,
  path = "/dashboard"
) {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15_000 });
  if (path !== "/dashboard") {
    await page.goto(path);
  }
}

test.describe("Dashboard navigation", () => {
  test("dashboard overview loads with key elements", async ({ page }) => {
    await loginAndGo(page);
    await expect(page.locator("text=总物业")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=收租率")).toBeVisible();
    await expect(page.locator("text=待处理工单")).toBeVisible();
  });

  test("sidebar has all navigation items", async ({ page }) => {
    await loginAndGo(page);
    const navItems = [
      "总览",
      "工单管理",
      "物业管理",
      "工人管理",
      "账目管理",
      "业主报告",
      "租约管理",
      "招租管理",
      "设置",
    ];
    for (const item of navItems) {
      await expect(page.locator(`text=${item}`).first()).toBeVisible();
    }
  });

  test("sidebar Soon badges visible", async ({ page }) => {
    await loginAndGo(page);
    // Wait for sidebar to fully render
    await expect(page.locator("text=总览").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Soon").first()).toBeVisible();
    const soonBadges = page.locator("text=Soon");
    const count = await soonBadges.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("work-orders page loads", async ({ page }) => {
    await loginAndGo(page, "/dashboard/work-orders");
    await expect(page.locator("text=工单管理").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("contractors page loads with real content", async ({ page }) => {
    await loginAndGo(page, "/dashboard/contractors");
    await expect(
      page.locator("text=工人管理").first()
    ).toBeVisible({ timeout: 10_000 });
    // Should NOT have Coming Soon banner
    await expect(
      page.locator("text=此功能正在开发中")
    ).not.toBeVisible({ timeout: 3_000 });
    // Should have filter controls
    await expect(page.locator("select").first()).toBeVisible();
  });

  const mockupPages = [
    { path: "/dashboard/accounting", title: "账目管理" },
    { path: "/dashboard/reports", title: "业主报告" },
    { path: "/dashboard/leases", title: "租约管理" },
    { path: "/dashboard/leasing", title: "招租管理" },
  ];

  for (const { path, title } of mockupPages) {
    test(`${path} shows Coming Soon banner and content`, async ({ page }) => {
      await loginAndGo(page, path);
      // ComingSoonBanner text: "此功能正在开发中"
      await expect(
        page.locator("text=此功能正在开发中").first()
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(`text=${title}`).first()).toBeVisible();
    });
  }
});
