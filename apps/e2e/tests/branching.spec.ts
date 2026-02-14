import { test, expect, type Page } from "@playwright/test";

async function fillInput(page: Page, selector: string, value: string) {
  await page.locator(selector).fill(value);
  await page.evaluate(
    () =>
      new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      ),
  );
}

async function waitForKeyboardReady(page: Page) {
  await page.locator(".ff-transition-active").waitFor({ state: "visible" });
  await page.evaluate(
    () =>
      new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      ),
  );
}

/**
 * Select a choice option and advance to the next question.
 * The choice component has a 300ms auto-advance timeout, but due to a stale
 * closure bug, the auto-advance fails for required fields. We work around
 * this by clicking to select, waiting generously for React to re-render and
 * re-register keyboard handlers, then pressing Enter.
 */
async function selectChoice(page: Page, optionText: string) {
  // Use exact label match to avoid substring collisions (e.g. "Unsatisfied" vs "Very unsatisfied")
  await page
    .locator(".ff-choice-card")
    .filter({
      has: page.locator(".ff-choice-label", {
        hasText: new RegExp(`^${optionText}$`),
      }),
    })
    .click();
  // Wait long enough for React to re-render AND re-register keyboard handlers
  // (React uses MessageChannel for scheduling, not just microtasks)
  await page.waitForTimeout(200);
  // Use the fresh global keyboard handler to advance
  await page.keyboard.press("Enter");
}

test.describe("Conditional Logic — Branching Form", () => {
  test("positive branch", async ({ page }) => {
    await page.goto("/branching-form.html");

    // Click start
    await page.locator(".ff-welcome-btn").click();

    // Wait for satisfaction question
    await expect(page.locator(".ff-question-title")).toHaveText(
      "How satisfied are you?",
    );
    await waitForKeyboardReady(page);

    // Select "Very satisfied" and advance
    await selectChoice(page, "Very satisfied");

    // Wait for the positive-detail question
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What did you like most?",
    );
    await waitForKeyboardReady(page);

    // Type answer and press Enter
    await fillInput(page, ".ff-input", "The user interface is great");
    await page.keyboard.press("Enter");

    // Verify ending screen
    await expect(page.locator(".ff-ending-title")).toHaveText(
      "Thanks for your feedback!",
    );
  });

  test("negative branch", async ({ page }) => {
    await page.goto("/branching-form.html");

    // Click start
    await page.locator(".ff-welcome-btn").click();
    await expect(page.locator(".ff-question-title")).toHaveText(
      "How satisfied are you?",
    );
    await waitForKeyboardReady(page);

    // Select "Unsatisfied" and advance
    await selectChoice(page, "Unsatisfied");

    // Wait for negative-detail question
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What could we improve?",
    );
    await waitForKeyboardReady(page);

    // Type answer and press Enter
    await fillInput(page, ".ff-input", "Better documentation");
    await page.keyboard.press("Enter");

    // Verify ending screen
    await expect(page.locator(".ff-ending-title")).toHaveText(
      "Thanks for your feedback!",
    );
  });

  test("back navigation through branch", async ({ page }) => {
    await page.goto("/branching-form.html");

    // Click start
    await page.locator(".ff-welcome-btn").click();
    await expect(page.locator(".ff-question-title")).toHaveText(
      "How satisfied are you?",
    );
    await waitForKeyboardReady(page);

    // Select "Very satisfied"
    await selectChoice(page, "Very satisfied");

    // Wait for positive-detail
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What did you like most?",
    );
    await waitForKeyboardReady(page);

    // Press Back button
    await page.locator(".ff-back-btn").click();

    // Wait for back to satisfaction question
    await expect(page.locator(".ff-question-title")).toHaveText(
      "How satisfied are you?",
    );
    await waitForKeyboardReady(page);

    // Now select "Unsatisfied"
    await selectChoice(page, "Unsatisfied");

    // Verify now on negative-detail (different branch)
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What could we improve?",
    );
  });
});
