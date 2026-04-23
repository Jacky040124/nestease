import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("all sections render", async ({ page }) => {
    await page.goto("/");

    // Navbar
    await expect(page.locator("text=栖安").first()).toBeVisible();
    await expect(page.locator("text=免费试用").first()).toBeVisible();

    // Hero
    await expect(page.locator("text=物业管理，一个平台全搞定")).toBeVisible();

    // Pain points
    await expect(page.locator("text=账目混乱")).toBeVisible();

    // Features
    await expect(page.locator("#features")).toBeAttached();

    // Pricing
    await expect(page.locator("#pricing")).toBeAttached();
    await expect(page.locator("text=$29")).toBeVisible();
    await expect(page.locator("text=$59")).toBeVisible();
    await expect(page.locator("text=$99")).toBeVisible();

    // Footer — uses &copy; entity
    await expect(page.locator("text=隐私政策")).toBeVisible();
  });

  test("navbar CTA links to /register", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator("nav >> text=免费试用");
    await expect(cta).toHaveAttribute("href", "/register");
  });

  test("hero CTAs have correct links", async ({ page }) => {
    await page.goto("/");
    const registerLink = page.locator("a[href='/register']").first();
    await expect(registerLink).toBeVisible();
  });

  test("pricing CTAs link to /register", async ({ page }) => {
    await page.goto("/");
    const pricingSection = page.locator("#pricing");
    const ctaLinks = pricingSection.locator("a[href='/register']");
    await expect(ctaLinks).toHaveCount(3);
  });

  test("page title is correct", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/栖安/);
    await expect(page).toHaveTitle(/AI 物业管理平台/);
  });

  test("favicon is accessible", async ({ page, request }) => {
    const res = await request.get("/icon.svg");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("#0D9488");
  });
});
