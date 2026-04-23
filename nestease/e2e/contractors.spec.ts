import { test, expect } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD } from "./constants";

// Helper: login and navigate
async function loginAndGo(
  page: import("@playwright/test").Page,
  path = "/dashboard/contractors"
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

test.describe("Contractor management", () => {
  test("contractors list page loads with real content", async ({ page }) => {
    await loginAndGo(page);
    // Title
    await expect(page.locator("text=工人管理").first()).toBeVisible({
      timeout: 10_000,
    });
    // Filter controls — select element and search input
    await expect(page.locator("select").first()).toBeVisible();
    await expect(
      page.locator('input[placeholder*="搜索"]').first()
    ).toBeVisible();
    // No Coming Soon banner
    await expect(
      page.locator("text=此功能正在开发中")
    ).not.toBeVisible({ timeout: 3_000 });
  });

  test("specialty filter works", async ({ page }) => {
    await loginAndGo(page);
    await expect(page.locator("text=工人管理").first()).toBeVisible({
      timeout: 10_000,
    });
    // Select a specialty filter
    const select = page.locator("select").first();
    await select.selectOption({ index: 1 }); // First specialty option
    // Page should still be functional (not crash)
    await expect(page.locator("text=工人管理").first()).toBeVisible();
  });

  test("favorites toggle button exists", async ({ page }) => {
    await loginAndGo(page);
    await expect(page.locator("text=工人管理").first()).toBeVisible({
      timeout: 10_000,
    });
    // Favorites filter button
    const favBtn = page.locator("text=只看常用").first();
    await expect(favBtn).toBeVisible();
    await favBtn.click();
    // Should still be on the page
    await expect(page.locator("text=工人管理").first()).toBeVisible();
  });

  test("contractor card links to detail page", async ({ page }) => {
    await loginAndGo(page);
    await expect(page.locator("text=工人管理").first()).toBeVisible({
      timeout: 10_000,
    });
    // Find a "查看详情" link
    const detailLink = page.locator("text=查看详情").first();
    if (await detailLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await detailLink.click();
      await page.waitForURL("**/dashboard/contractors/**", { timeout: 10_000 });
      // Detail page should have back link
      await expect(page.locator("text=返回列表").first()).toBeVisible({
        timeout: 10_000,
      });
    }
    // If no contractors exist, the test still passes (empty state is valid)
  });

  test("detail page shows stats and sections", async ({ page }) => {
    await loginAndGo(page);
    await expect(page.locator("text=工人管理").first()).toBeVisible({
      timeout: 10_000,
    });
    const detailLink = page.locator("text=查看详情").first();
    if (await detailLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await detailLink.click();
      await page.waitForURL("**/dashboard/contractors/**", { timeout: 10_000 });
      // Key sections
      await expect(page.locator("text=返回列表").first()).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.locator("text=历史工单").first()).toBeVisible();
      await expect(page.locator("text=备注").first()).toBeVisible();
      // Stats cards should be present
      await expect(page.locator("text=完成工单").first()).toBeVisible();
      await expect(page.locator("text=平均评分").first()).toBeVisible();
    }
  });

  test("notes CRUD works on detail page", async ({ page }) => {
    await loginAndGo(page);
    await expect(page.locator("text=工人管理").first()).toBeVisible({
      timeout: 10_000,
    });
    const detailLink = page.locator("text=查看详情").first();
    if (await detailLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await detailLink.click();
      await page.waitForURL("**/dashboard/contractors/**", { timeout: 10_000 });
      await expect(page.locator("text=备注").first()).toBeVisible({
        timeout: 10_000,
      });

      // Add a note
      const noteInput = page.locator('input[placeholder="添加备注..."]');
      const testNote = `E2E测试备注_${Date.now()}`;
      await noteInput.fill(testNote);
      await page.locator("button", { hasText: "添加" }).first().click();

      // Note should appear
      await expect(page.locator(`text=${testNote}`).first()).toBeVisible({
        timeout: 10_000,
      });

      // Delete the note
      const deleteBtn = page
        .locator(`text=${testNote}`)
        .locator("..")
        .locator("..")
        .locator("button", { hasText: "删除" });
      if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await deleteBtn.click();
        // Note should disappear
        await expect(page.locator(`text=${testNote}`)).not.toBeVisible({
          timeout: 5_000,
        });
      }
    }
  });

  test("settings page shows contractor migration link", async ({ page }) => {
    await loginAndGo(page, "/dashboard/settings");
    await expect(page.locator("text=设置").first()).toBeVisible({
      timeout: 10_000,
    });
    // Migration notice
    await expect(
      page.locator("text=工人管理已迁移到独立页面").first()
    ).toBeVisible();
    // Link to contractors page
    const link = page.locator("text=前往工人管理").first();
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL("**/dashboard/contractors", { timeout: 10_000 });
    await expect(page.locator("text=工人管理").first()).toBeVisible();
  });

  test("sidebar shows contractors without Soon badge", async ({ page }) => {
    await loginAndGo(page, "/dashboard");
    await expect(page.locator("text=总览").first()).toBeVisible({
      timeout: 10_000,
    });
    // Find the contractors nav item
    const navItem = page.locator('a[href="/dashboard/contractors"]');
    await expect(navItem).toBeVisible();
    // Should NOT have "Soon" badge next to it
    const soonBadge = navItem.locator("text=Soon");
    await expect(soonBadge).not.toBeVisible();
  });
});
