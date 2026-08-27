import { test, expect } from '@playwright/test';
import { CheckoutTask } from '../tasks/checkout.task';
import { VisualComparisonTask } from '../tasks/visual-comparison.task';
import { captureCookies, listenForApi } from '../utils/helpers';
import { URLS } from '../config/urls';

test.describe('Member Area V2 - Preview & Checkout Flow', () => {

  test('CWA-5614: Verify Member area theme', { tag: ['@CWA-5614', '@regression', '@smoke'] }, async ({ page }, testInfo) => {
    test.slow();

    testInfo.annotations.push({ type: 'test_id', description: 'CWA-5614' });

    const checkoutTask = new CheckoutTask(page);
    const visualComparisonTask = new VisualComparisonTask(page);

    // 📡 1. Set up API Interceptor for api-cwa/site_settings (captures full readable JSON)
    const siteSettingsMonitor = listenForApi(page, URLS.API_SITE_SETTINGS, {
      log: true,
      attachToReport: true,
      saveToDisk: true,
      testInfo,
      filename: 'site-settings-full-response.json',
    });

    // 2. Dynamic VIN & unique email
    const randomVin = `WA1E2BFY9M21083${Math.floor(10 + Math.random() * 90)}`;
    const randomEmail = `test_${Date.now()}@emails.com`;

    console.log(`[TEST RUN] Test ID: CWA-5614`);
    console.log(`[TEST RUN] Generated VIN: ${randomVin}`);
    console.log(`[TEST RUN] Generated Email: ${randomEmail}`);

    // 3. Navigate immediately using centralized URL builder
    await test.step(`Navigate to preview with VIN: ${randomVin}`, async () => {
      await page.goto(URLS.PREVIEW(randomVin), { waitUntil: 'commit' });
    });

    // 🍪 4. Capture Cookies on initial page load
    await test.step('Capture initial cookies from base/preview URL', async () => {
      await captureCookies(page, { log: true, attachToReport: true, testInfo });
    });

    // 5. Condition-Based Polling: Poll until survey is dismissed & Access Records button is ready
    const accessRecordsBtn = page.getByRole('button', { name: 'Access Records' });
    await expect(async () => {
      const surveyBtn = page.getByRole('button', { name: /Just checking|I'm a buyer|I'm the owner/i }).first();
      if (await surveyBtn.isVisible()) {
        await surveyBtn.click();
      }
      await expect(accessRecordsBtn).toBeVisible();
    }).toPass();

    // 6. Click Access Records
    await accessRecordsBtn.scrollIntoViewIfNeeded();
    await accessRecordsBtn.click();

    // 7. Submit Email & Proceed
    const emailInput = page.getByRole('textbox', { name: /Email Address/i });
    await expect(emailInput).toBeEditable();
    await emailInput.fill(randomEmail);
    await page.getByRole('button', { name: 'Proceed to Checkout' }).click();

    // 8. Execute Checkout Task
    await test.step('Complete checkout payment with Stripe', async () => {
      await checkoutTask.completeCheckout({
        name: 'Shah Tester',
        cardNum: '5454 5454 5454 5454',
        expiry: '02 / 30',
        cvc: '265',
        zip: '749000',
      });
    });

    // 9. Condition-Based Polling for Payment Confirmation
    await test.step('Verify payment confirmation', async () => {
      const successMessage = page.getByText(/Payment successful/i);
      await expect(successMessage).toBeVisible();
    });

    // 10. Redirection to Dashboard & My Reports
    await test.step('Wait for Dashboard and navigate to My Reports', async () => {
      await page.waitForURL(/\/members\/dashboard/i, { waitUntil: 'domcontentloaded' });

      const generatingIndicator = page.getByText(/Generating Vehicle|Building Report/i).first();
      if (await generatingIndicator.isVisible().catch(() => false)) {
        await expect(generatingIndicator).toBeHidden();
      }

      await page.goto(URLS.MY_REPORTS, { waitUntil: 'commit' });
      await expect(page).toHaveURL(/\/members\/my-reports/i);
    });

    // 🎨 11. Visual Theme Comparison Task on My Reports page
    await test.step('Perform visual theme comparison on /members/my-reports', async () => {
      const capturedCalls = siteSettingsMonitor.getCapturedCalls();
      const latestSiteSettings = capturedCalls.length > 0 ? capturedCalls[0].response.body : undefined;
      const themeResult = await visualComparisonTask.verifyMyReportsTheme(latestSiteSettings, testInfo);
      
      // Dynamic validation based on site_settings API
      expect(themeResult.isMatched).toBe(true);
      expect(themeResult.detectedTheme).toBe(themeResult.expectedThemeFromApi);
    });

    // 12. Log summary of captured site_settings API calls
    const captured = siteSettingsMonitor.getCapturedCalls();
    console.log(`\n📊 [SUMMARY] Total 'api-cwa/site_settings' calls captured during test: ${captured.length}`);
  });
});
