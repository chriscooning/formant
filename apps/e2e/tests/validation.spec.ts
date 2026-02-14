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

test.describe("Validation — Error States", () => {
  test("required field shows error when empty", async ({ page }) => {
    await page.goto("/simple-form.html");

    // Advance past welcome
    await page.locator(".ff-welcome-btn").click();
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your name?",
    );
    await waitForKeyboardReady(page);

    // Press Enter without typing
    await page.keyboard.press("Enter");

    // Verify error message appears
    await expect(page.locator(".ff-error-message")).toBeVisible();
  });

  test("invalid email shows error", async ({ page }) => {
    await page.goto("/simple-form.html");

    // Advance past welcome
    await page.locator(".ff-welcome-btn").click();
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your name?",
    );
    await waitForKeyboardReady(page);

    // Fill name, advance
    await fillInput(page, ".ff-input", "John Doe");
    await page.keyboard.press("Enter");

    // Wait for email question
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your email?",
    );
    await waitForKeyboardReady(page);

    // Type invalid email
    await fillInput(page, ".ff-input", "notanemail");
    await page.keyboard.press("Enter");

    // Verify email validation error
    await expect(page.locator(".ff-error-message")).toBeVisible();
  });

  test("fix error clears message", async ({ page }) => {
    await page.goto("/simple-form.html");

    // Advance past welcome
    await page.locator(".ff-welcome-btn").click();
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your name?",
    );
    await waitForKeyboardReady(page);

    // Fill name, advance
    await fillInput(page, ".ff-input", "John Doe");
    await page.keyboard.press("Enter");

    // Wait for email question
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your email?",
    );
    await waitForKeyboardReady(page);

    // Trigger email error
    await fillInput(page, ".ff-input", "notanemail");
    await page.keyboard.press("Enter");
    await expect(page.locator(".ff-error-message")).toBeVisible();

    // Clear input and type valid email
    await page.locator(".ff-input").fill("");
    await fillInput(page, ".ff-input", "john@example.com");

    // Press Enter with valid email to advance
    await page.keyboard.press("Enter");

    // Should advance to feedback question
    await expect(page.locator(".ff-question-title")).toHaveText(
      "Any feedback?",
    );
  });

  test("non-required field can be skipped", async ({ page }) => {
    await page.goto("/simple-form.html");

    // Advance past welcome
    await page.locator(".ff-welcome-btn").click();
    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your name?",
    );
    await waitForKeyboardReady(page);

    // Fill required fields
    await fillInput(page, ".ff-input", "John Doe");
    await page.keyboard.press("Enter");

    await expect(page.locator(".ff-question-title")).toHaveText(
      "What is your email?",
    );
    await waitForKeyboardReady(page);
    await fillInput(page, ".ff-input", "john@example.com");
    await page.keyboard.press("Enter");

    // On feedback (optional)
    await expect(page.locator(".ff-question-title")).toHaveText(
      "Any feedback?",
    );
    await waitForKeyboardReady(page);

    // Textarea uses Shift+Enter to submit
    await page.keyboard.press("Shift+Enter");

    // Verify advances to ending (no error)
    await expect(page.locator(".ff-ending-title")).toHaveText("Thank you!");
  });

  test("number outside range shows error", async ({ page }) => {
    await page.goto("/full-form.html");

    // Navigate to age question
    await page.locator(".ff-welcome-btn").click();
    await expect(page.locator(".ff-question-title")).toHaveText("Your name?");
    await waitForKeyboardReady(page);

    await fillInput(page, ".ff-input", "Test User");
    await page.keyboard.press("Enter");

    await expect(page.locator(".ff-question-title")).toHaveText("Your email?");
    await waitForKeyboardReady(page);

    await fillInput(page, ".ff-input", "test@test.com");
    await page.keyboard.press("Enter");

    // Now on age question
    await expect(page.locator(".ff-question-title")).toHaveText("Your age?");
    await waitForKeyboardReady(page);

    // Type 200 (max is 150)
    await fillInput(page, ".ff-input", "200");
    await page.keyboard.press("Enter");

    // Verify range error
    await expect(page.locator(".ff-error-message")).toBeVisible();
  });
});
