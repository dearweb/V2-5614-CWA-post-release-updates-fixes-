import { test, expect } from '@playwright/test';
import { UpsellAutoSelectTask } from '../tasks/upsell-auto-select.task';
import { captureCookies, listenForApi } from '../utils/helpers';
import { URLS } from '../config/urls';

test.describe('Member Area V2 - Upsell Auto Select Flow', () => {

  test('CWA-5615: Verify Upsell select auto on Preview page', { tag: ['@CWA-5615', '@upsell', '@regression'] }, async ({ page }, testInfo) => {
    test.slow();

    // Attach Test ID to test report
    testInfo.annotations.push({ type: 'test_id', description: 'CWA-5615' });

    const upsellTask = new UpsellAutoSelectTask(page);

    // 📡 1. Capture site_settings API response on preview page
    const siteSettingsMonitor = listenForApi(page, URLS.API_SITE_SETTINGS, {
      log: true,
      attachToReport: true,
      saveToDisk: true,
      testInfo,
      filename: 'site-settings-full-response.json',
    });

    // 2. Dynamic VIN
    const randomVin = `WA1E2BFY9M21083${Math.floor(10 + Math.random() * 90)}`;
    console.log(`[TEST RUN] Test ID: CWA-5615`);
    console.log(`[TEST RUN] Generated VIN: ${randomVin}`);

    // 3. Navigate to Preview page
    await test.step(`Navigate to preview with VIN: ${randomVin}`, async () => {
      await page.goto(URLS.PREVIEW(randomVin), { waitUntil: 'commit' });
    });

    // 🍪 4. Capture Cookies
    await test.step('Capture initial cookies from preview page', async () => {
      await captureCookies(page, { log: true, attachToReport: true, testInfo });
    });

    // 5. Condition-Based Polling: Poll until survey modal is dismissed & Preview content is loaded
    await expect(async () => {
      const surveyBtn = page.getByRole('button', { name: /Just checking|I'm a buyer|I'm the owner/i }).first();
      if (await surveyBtn.isVisible()) {
        await surveyBtn.click();
      }
      const upsellElement = page.locator('#landing_decal, label[for="landing_decal"]').first();
      await expect(upsellElement).toBeVisible();
    }).toPass();

    // 🏷️ 6. Execute Upsell Auto-Select Validation Task (Ends here - No Email / Checkout)
    await test.step('Validate Upsell text match and auto-selected state', async () => {
      const capturedCalls = siteSettingsMonitor.getCapturedCalls();
      const latestSiteSettings = capturedCalls.length > 0 ? capturedCalls[0].response.body : undefined;

      const result = await upsellTask.validateUpsellAutoSelect(latestSiteSettings, testInfo);
      expect(result.isAutoSelected).toBe(true);
      expect(result.statusMessage).toBe('upsell auto select');
    });
  });
});
