import { test, expect, type Page } from "@playwright/test";

/**
 * Fill an input and wait for React to commit the state update.
 * After fill(), React may not have re-rendered yet, causing stale state.
 * Double-rAF ensures the React render cycle has completed.
 */
async function fillInput(page: Page, selector: string, value: string) {
  await page.locator(selector).fill(value);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}

/**
 * Wait for the keyboard handler to be registered.
 * The handler is only active during the "active" transition phase,
 * which is set 50ms after the question enters. A brief wait after
 * the question title is visible ensures the handler is ready.
 */
async function waitForKeyboardReady(page: Page) {
  // Wait for transition-active class (handler only runs in "active" phase)
  await page.locator(".ff-transition-active").waitFor({ state: "visible" });
  // Extra frame to ensure React effect has registered the handler
  await page.evaluate(
    () =>
      new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      ),
  );
}

test.describe("Happy Path — Simple Form", () => {
  test("complete a simple form", async ({ page }) => {
    await page.goto("/simple-form.html");

    // Verify welcome screen is visible with title
    await expect(page.locator(".ff-welcome-title")).toHaveText(
      "Welcome to our survey",
    );
    await expect(page.locator(".ff-welcome-btn")).toHaveText("Let's go");

    // Click start button
    await page.locator(".ff-welcome-btn").click();

    // Wait for name question to appear and be interactive
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your name?",
    );
    await waitForKeyboardReady(page);

    // Type name and press Enter
    await fillInput(page, ".ff-input", "John Doe");
    await page.keyboard.press("Enter");

    // Wait for email question
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your email?",
    );
    await waitForKeyboardReady(page);

    // Type email and press Enter
    await fillInput(page, ".ff-input", "john@example.com");
    await page.keyboard.press("Enter");

    // Wait for feedback question
    await expect(page.locator(".ff-question-title")).toHaveText(
      "Any feedback?",
    );

    // Type feedback and click OK button (textarea uses button, not Enter)
    await fillInput(page, ".ff-textarea", "Great product!");
    await page.locator(".ff-textarea-ok").click();

    // Verify ending screen appears
    await expect(page.locator(".ff-ending-title")).toHaveText("Thank you!");
  });

  test("skip optional fields", async ({ page }) => {
    await page.goto("/simple-form.html");

    // Click start
    await page.locator(".ff-welcome-btn").click();

    // Fill name (required), press Enter
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your name?",
    );
    await waitForKeyboardReady(page);
    await fillInput(page, ".ff-input", "Jane Doe");
    await page.keyboard.press("Enter");

    // Fill email (required), press Enter
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your email?",
    );
    await waitForKeyboardReady(page);
    await fillInput(page, ".ff-input", "jane@example.com");
    await page.keyboard.press("Enter");

    // Verify feedback question appears
    await expect(page.locator(".ff-question-title")).toHaveText(
      "Any feedback?",
    );
    await waitForKeyboardReady(page);

    // Textarea uses Shift+Enter to submit (plain Enter inserts newline)
    await page.keyboard.press("Shift+Enter");

    // Verify ending screen appears (optional field was skippable)
    await expect(page.locator(".ff-ending-title")).toHaveText("Thank you!");
  });
});
