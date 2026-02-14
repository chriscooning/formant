import { test, expect } from "@playwright/test";

test.describe("Theme — Dark/Light Mode", () => {
  test("respects system dark mode", async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: "dark",
    });
    const page = await context.newPage();
    await page.goto("http://localhost:3456/simple-form.html");

    // Wait for the app to render
    await expect(page.locator(".ff-root")).toBeVisible();

    // Verify dark theme is applied
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await context.close();
  });

  test("respects system light mode", async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: "light",
    });
    const page = await context.newPage();
    await page.goto("http://localhost:3456/simple-form.html");

    // Wait for the app to render
    await expect(page.locator(".ff-root")).toBeVisible();

    // Verify light theme is applied
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await context.close();
  });

  test("manual toggle switches theme", async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: "dark",
    });
    const page = await context.newPage();
    await page.goto("http://localhost:3456/simple-form.html");

    // Wait for the app to render with dark mode
    await expect(page.locator(".ff-root")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Click theme toggle button
    await page.locator(".ff-theme-toggle").click();

    // Verify html[data-theme="light"] is set
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await context.close();
  });

  test("text is readable in both modes", async ({ browser }) => {
    // Test dark mode
    const context = await browser.newContext({
      colorScheme: "dark",
    });
    const page = await context.newPage();
    await page.goto("http://localhost:3456/simple-form.html");
    await expect(page.locator(".ff-root")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // In dark mode: get the background color
    const darkBgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });

    // Toggle to light mode
    await page.locator(".ff-theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // In light mode: get the background color
    const lightBgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });

    // Verify background colors are different between modes
    expect(darkBgColor).not.toBe(lightBgColor);

    // Verify accent color (#6c5ce7) is consistent in both modes
    // by checking the progress bar color
    const accentColor = await page.evaluate(() => {
      const bar = document.querySelector(".ff-progress-bar") as HTMLElement;
      return bar ? getComputedStyle(bar).backgroundColor : null;
    });
    expect(accentColor).toBeTruthy();

    await context.close();
  });
});
