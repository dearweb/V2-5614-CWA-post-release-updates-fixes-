import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { CookieIpInjector, IP_POOL } from '../utils/cookie.helper';
import { SessionIpStickinessTask } from '../tasks/session-ip-stickiness.task';
import { SignupAuthFlowTask } from '../tasks/signup-auth-flow.task';
import { BrowseTheWeb } from '../utils/browse-the-web.helper';
import { URLS } from '../config/urls';

test.describe('CWA IP & Currency Localization Flow', () => {

  test.beforeEach(async ({ page }) => {
    // 🛡️ Auto-intercept and dismiss cookie consent banners, GDPR, and modals
    BrowseTheWeb.using(page);
  });

  // Case 1: Before vs After IP Modification
  test('1. Verify cwa_ip injection (Before vs After)', { tag: ['@cookies', '@ip-inject'] }, async ({ page }, testInfo) => {
    test.slow();
    testInfo.annotations.push({ type: 'test_id', description: 'CWA-IP-INJECT' });

    const ipInjector = new CookieIpInjector(page.context());
    const signupUrl = URLS.SIGNUP;
    const koreaIp = IP_POOL.KOREA; // '79.110.55.34'

    // 1. Initial navigation
    await page.goto(signupUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // 2. Capture initial (BEFORE)
    const beforeCookie = await ipInjector.getCwaIpCookie();
    const beforeIp = beforeCookie?.value || '(none)';
    console.log(`📌 [BEFORE] Initial 'cwa_ip': "${beforeIp}"`);

    // 3. Inject Korea IP
    await ipInjector.setCwaIpCookie(koreaIp);

    // 4. Reload page
    await page.goto(signupUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // 5. Capture updated (AFTER)
    const afterCookie = await ipInjector.getCwaIpCookie();
    const afterIp = afterCookie?.value;
    console.log(`💉 [AFTER] Injected 'cwa_ip': "${afterIp}"`);

    // 6. Report & Assert
    await testInfo.attach('cwa-ip-summary.json', {
      body: JSON.stringify({ beforeIp, afterIp, targetIp: koreaIp, status: 'SUCCESS' }, null, 2),
      contentType: 'application/json',
    });

    expect(afterIp).toBe(koreaIp);
  });

  // Case 2: Session Stickiness across Refreshes & New Tab in Same Browser
  test('2. Verify cwa_ip session lock across refreshes and new tab', { tag: ['@cookies', '@session-stickiness'] }, async ({ page }, testInfo) => {
    test.slow();
    testInfo.annotations.push({ type: 'test_id', description: 'CWA-IP-STICKINESS' });

    const stickinessTask = new SessionIpStickinessTask(page);
    const signupUrl = URLS.SIGNUP;
    const koreaIp = IP_POOL.KOREA;

    // 1. Initial visit & set IP
    await page.goto(signupUrl, { waitUntil: 'domcontentloaded' });
    await stickinessTask.ipInjector.setCwaIpCookie(koreaIp);

    // 2. Item 1: Verify across multiple refreshes
    await stickinessTask.verifyMultipleRefreshes(koreaIp, 2);

    // 3. Item 4: Verify in new tab within same browser
    const tab2 = await stickinessTask.verifyNewTabPersistence(signupUrl, koreaIp);
    await tab2.newTabPage.close().catch(() => {});
  });

  // Case 3: Regional Currency Verification on Plans Page
  test('3. Verify Korea IP applies KRW (₩) currency on plans page', { tag: ['@cookies', '@korea-currency', '@plans'] }, async ({ page }, testInfo) => {
    test.slow();
    testInfo.annotations.push({ type: 'test_id', description: 'CWA-KOREA-CURRENCY' });

    const ipInjector = new CookieIpInjector(page.context());
    const signupTask = new SignupAuthFlowTask(page);
    const koreaIp = IP_POOL.KOREA;

    // 1. Navigate & inject Korea IP
    await page.goto(URLS.SIGNUP, { waitUntil: 'domcontentloaded' });
    await ipInjector.setCwaIpCookie(koreaIp);

    // 2. Perform signup and land on Dashboard
    await signupTask.performSignup();
    await page.waitForURL(/\/members\/dashboard|\/dashboard/i, { timeout: 60000 });

    // 3. Condition-based polling: Verify Korean currency sign (₩ / KRW)
    let detectedCurrencyText = '';
    await expect(async () => {
      const currencyElem = page.locator('body *:visible:not(style):not(script)')
        .filter({ hasText: /₩|KRW/ })
        .first();

      await expect(currencyElem).toBeVisible();
      detectedCurrencyText = (await currencyElem.textContent())?.trim() || '';
      expect(detectedCurrencyText).toMatch(/₩|KRW/);
    }).toPass({ timeout: 25000 });

    console.log(`   ✅ [CURRENCY VERIFIED] Korea Currency Sign displayed: "${detectedCurrencyText}"`);

    // 4. Capture high-resolution screenshot
    const screenshotsDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const screenshotPath = path.join(screenshotsDir, `korea-plans-currency-${Date.now()}.png`);
    const screenshotBuffer = await page.screenshot({ path: screenshotPath, fullPage: true });

    await testInfo.attach('korea-plans-currency.png', {
      body: screenshotBuffer,
      contentType: 'image/png',
    });

    console.log(`   📸 [SCREENSHOT ATTACHED] ${screenshotPath}`);
  });

});
