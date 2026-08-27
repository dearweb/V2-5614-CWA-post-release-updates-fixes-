import { Page, BrowserContext, expect, TestInfo } from '@playwright/test';
import { CookieIpInjector, IP_POOL } from '../utils/cookie.helper';
import { URLS } from '../config/urls';

export interface RefreshCheckResult {
  reloadIndex: number;
  ipValue: string;
  isMatched: boolean;
}

export interface SessionIpStickinessReport {
  targetUrl: string;
  targetIp: string;
  refreshes: RefreshCheckResult[];
  newTabIp: string;
  isMultiTabMatched: boolean;
  status: string;
}

/**
 * Task to verify CWA IP persistence across multiple page refreshes
 * and new tabs within the SAME browser session.
 */
export class SessionIpStickinessTask {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly ipInjector: CookieIpInjector;

  constructor(page: Page) {
    this.page = page;
    this.context = page.context();
    this.ipInjector = new CookieIpInjector(this.context);
  }

  /**
   * 1. Multiple Page Refreshes:
   * Reloads the page N times in the same tab and verifies cwa_ip stays locked on every refresh.
   */
  async verifyMultipleRefreshes(
    expectedIp: string = IP_POOL.KOREA,
    reloadCount: number = 2
  ): Promise<RefreshCheckResult[]> {
    const page = this.page;
    const results: RefreshCheckResult[] = [];

    console.log('\n' + '═'.repeat(70));
    console.log(`🔄 [SESSION STICKINESS] Testing ${reloadCount} consecutive page reload(s) in same browser`);
    console.log('═'.repeat(70));

    for (let i = 1; i <= reloadCount; i++) {
      console.log(`   ⏳ Performing Reload #${i}...`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(1500);

      const currentIp = (await this.ipInjector.getCwaIpValue()) || '';
      const isMatched = currentIp === expectedIp;

      console.log(`   • [Reload #${i}] Current 'cwa_ip': "${currentIp}" | Expected: "${expectedIp}" ➡️ ${isMatched ? '✅ LOCKED' : '❌ CHANGED'}`);

      expect(
        currentIp,
        `[FAILURE] 'cwa_ip' changed on reload #${i}! Expected "${expectedIp}", got "${currentIp}"`
      ).toBe(expectedIp);

      results.push({
        reloadIndex: i,
        ipValue: currentIp,
        isMatched,
      });
    }

    console.log(`✅ [SESSION STICKINESS] Successfully passed all ${reloadCount} page reload checks!`);
    console.log('═'.repeat(70) + '\n');

    return results;
  }

  /**
   * 4. Opening a New Tab in the Same Browser Window:
   * Opens a second tab in the same browser context and verifies cwa_ip is shared and unchanged.
   */
  async verifyNewTabPersistence(
    targetUrl: string = URLS.SIGNUP,
    expectedIp: string = IP_POOL.KOREA
  ): Promise<{ newTabPage: Page; tabIp: string; isMatched: boolean }> {
    console.log('\n' + '═'.repeat(70));
    console.log(`📑 [SESSION STICKINESS] Opening Tab 2 in the same browser window`);
    console.log('═'.repeat(70));

    // Open new tab in same browser context
    const tab2 = await this.context.newPage();
    await tab2.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await tab2.waitForLoadState('networkidle').catch(() => {});
    await tab2.waitForTimeout(1500);

    const tab2Ip = (await this.ipInjector.getCwaIpValue()) || '';
    const isMatched = tab2Ip === expectedIp;

    console.log(`   • [Tab 2 URL]    ${tab2.url()}`);
    console.log(`   • [Tab 2 cwa_ip] "${tab2Ip}" | Expected: "${expectedIp}" ➡️ ${isMatched ? '✅ SYNCED' : '❌ MISMATCH'}`);

    expect(
      tab2Ip,
      `[FAILURE] Tab 2 'cwa_ip' does not match session IP! Expected "${expectedIp}", got "${tab2Ip}"`
    ).toBe(expectedIp);

    console.log(`✅ [SESSION STICKINESS] Tab 2 successfully inherited locked session IP!`);
    console.log('═'.repeat(70) + '\n');

    return {
      newTabPage: tab2,
      tabIp: tab2Ip,
      isMatched,
    };
  }

  /**
   * Comprehensive Execution: Runs Item 1 (Refreshes) & Item 4 (New Tab) and generates test report artifact.
   */
  async executeStickinessCheck(
    targetIp: string = IP_POOL.KOREA,
    testInfo?: TestInfo
  ): Promise<SessionIpStickinessReport> {
    const signupUrl = URLS.SIGNUP;

    // 1. Initial Set & Inject IP
    await this.ipInjector.setCwaIpCookie(targetIp);

    // 2. Perform Multiple Refreshes in Tab 1 (Item 1)
    const refreshResults = await this.verifyMultipleRefreshes(targetIp, 2);

    // 3. Open Tab 2 in Same Browser & Verify Persistence (Item 4)
    const tab2Result = await this.verifyNewTabPersistence(signupUrl, targetIp);

    // Close secondary tab
    await tab2Result.newTabPage.close().catch(() => {});

    const report: SessionIpStickinessReport = {
      targetUrl: signupUrl,
      targetIp,
      refreshes: refreshResults,
      newTabIp: tab2Result.tabIp,
      isMultiTabMatched: tab2Result.isMatched,
      status: 'VERIFIED_SESSION_STICKY',
    };

    if (testInfo) {
      await testInfo.attach('session-ip-stickiness-report.json', {
        body: JSON.stringify(report, null, 2),
        contentType: 'application/json',
      });
    }

    return report;
  }
}
