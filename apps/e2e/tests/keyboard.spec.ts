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
 * Select an auto-advance component (choice/rating/scale/yesno) and advance.
 * These components have a stale closure bug where the auto-advance timeout
 * captures an old goNext that doesn't see the updated answer.
 * Workaround: click to select, wait for React re-render, press Enter.
 */
async function clickAndAdvance(page: Page, locator: string, opts?: { hasText?: string }) {
  if (opts?.hasText) {
    await page.locator(locator, { hasText: opts.hasText }).click();
  } else {
    await page.locator(locator).first().click();
  }
  // Wait for React to re-render and re-register keyboard handlers
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
}

/**
 * Navigate through the full form to a specific question.
 */
async function navigateToQuestion(page: Page, targetTitle: string) {
  await page.goto("/full-form.html");

  // Welcome -> Begin
  await page.locator(".ff-welcome-btn").click();
  await expect(page.locator(".ff-question-title")).toBeVisible();
  await waitForKeyboardReady(page);

  const maxSteps = 20;
  for (let step = 0; step < maxSteps; step++) {
    const title = await page
      .locator(".ff-question-title, .ff-statement-title")
      .first()
      .textContent();
    if (title?.includes(targetTitle)) return;

    const currentTitle = title ?? "";

    if (currentTitle.includes("Your name")) {
      await fillInput(page, ".ff-input", "Test User");
      await page.keyboard.press("Enter");
    } else if (currentTitle.includes("Your email")) {
      await fillInput(page, ".ff-input", "test@test.com");
      await page.keyboard.press("Enter");
    } else if (currentTitle.includes("Your age")) {
      await page.keyboard.press("Enter");
    } else if (currentTitle.includes("Phone number")) {
      await page.keyboard.press("Enter");
    } else if (currentTitle.includes("Your website")) {
      await page.keyboard.press("Enter");
    } else if (currentTitle.includes("Tell us about yourself")) {
      await page.keyboard.press("Shift+Enter");
    } else if (currentTitle.includes("Your role")) {
      // Choice: click + Enter workaround for stale closure auto-advance
      await clickAndAdvance(page, ".ff-choice-card");
    } else if (currentTitle.includes("Your skills")) {
      await page.locator(".ff-multi-card").first().click();
      await page.locator(".ff-multi-continue").click();
    } else if (currentTitle.includes("Rate our service")) {
      // Rating: click + Enter workaround
      await page.locator(".ff-star").nth(3).click();
      await page.waitForTimeout(200);
      await page.keyboard.press("Enter");
    } else if (currentTitle.includes("How likely to recommend")) {
      // Scale: click + Enter workaround
      await clickAndAdvance(page, ".ff-scale-btn", { hasText: "8" });
    } else if (currentTitle.includes("Would you use again")) {
      // YesNo: click + Enter workaround
      await page.locator(".ff-yesno-card").first().click();
      await page.waitForTimeout(200);
      await page.keyboard.press("Enter");
    } else if (currentTitle.includes("When did you start")) {
      await page.keyboard.press("Enter");
    } else if (currentTitle.includes("Your department")) {
      await page.locator(".ff-dropdown-search").fill("Eng");
      await page.locator(".ff-dropdown-option").first().click();
    } else if (currentTitle.includes("Almost done")) {
      await page.locator(".ff-statement-btn").click();
    } else {
      await page.keyboard.press("Enter");
    }

    // Wait for the title to change
    await expect(
      page.locator(".ff-question-title, .ff-statement-title").first(),
    ).not.toHaveText(currentTitle, { timeout: 10000 });

    await waitForKeyboardReady(page);
  }
}

test.describe("Keyboard Navigation", () => {
  test("Enter advances past welcome", async ({ page }) => {
    await page.goto("/simple-form.html");

    // Verify welcome screen
    await expect(page.locator(".ff-welcome")).toBeVisible();
    await waitForKeyboardReady(page);

    // Press Enter to advance
    await page.keyboard.press("Enter");

    // Verify advanced to first question
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your name?",
    );
  });

  test("letter keys select choice options", async ({ page }) => {
    await navigateToQuestion(page, "Your role");

    await expect(page.locator(".ff-question-title")).toHaveText("Your role?");

    // Press 'a' key to select first option ("Developer")
    // The key selection sets the answer, then we press Enter to advance
    // (auto-advance has a stale closure bug for required fields)
    await page.keyboard.press("a");
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    await page.keyboard.press("Enter");

    // Should advance to skills
    await expect(page.locator(".ff-question-title")).toHaveText("Your skills?");
  });

  test("Y/N keys for yes_no", async ({ page }) => {
    await navigateToQuestion(page, "Would you use again");

    await expect(page.locator(".ff-question-title")).toHaveText(
      "Would you use again?",
    );

    // Press 'y' key to select Yes, then Enter to advance
    await page.keyboard.press("y");
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    await page.keyboard.press("Enter");

    // Should advance to next question (date)
    await expect(page.locator(".ff-question-title")).toHaveText(
      "When did you start?",
    );
  });

  test("number keys for rating", async ({ page }) => {
    await navigateToQuestion(page, "Rate our service");

    await expect(page.locator(".ff-question-title")).toHaveText(
      "Rate our service",
    );

    // Press '4' key to select 4 stars, then Enter to advance
    await page.keyboard.press("4");
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    await page.keyboard.press("Enter");

    // Should advance to next question (scale/nps)
    await expect(page.locator(".ff-question-title")).toHaveText(
      "How likely to recommend?",
    );
  });

  test("number keys for scale", async ({ page }) => {
    await navigateToQuestion(page, "How likely to recommend");

    await expect(page.locator(".ff-question-title")).toHaveText(
      "How likely to recommend?",
    );

    // Press '8' key to select 8, then Enter to advance
    await page.keyboard.press("8");
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    await page.keyboard.press("Enter");

    // Should advance to next question (yes_no)
    await expect(page.locator(".ff-question-title")).toHaveText(
      "Would you use again?",
    );
  });

  test("Backspace goes back", async ({ page }) => {
    await page.goto("/simple-form.html");

    // Advance past welcome
    await page.locator(".ff-welcome-btn").click();
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your name?",
    );
    await waitForKeyboardReady(page);

    // Fill name and advance
    await fillInput(page, ".ff-input", "Test User");
    await page.keyboard.press("Enter");

    // Wait for email question
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your email?",
    );
    await waitForKeyboardReady(page);

    // Blur the input so Backspace isn't captured by it
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
    });

    // Press Backspace to go back
    await page.keyboard.press("Backspace");

    // Verify went back to name question
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your name?",
    );
  });
});
