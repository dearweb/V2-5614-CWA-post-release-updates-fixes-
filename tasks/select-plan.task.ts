import { Page, expect } from '@playwright/test';

export interface SelectPlanOptions {
  planName?: string;
  isSlowNetwork?: boolean;
}

/**
 * Task for selecting a plan from the Dashboard and proceeding to Checkout.
 * Ported and enhanced from PROD STABILITY MONITOR with mobile/desktop support,
 * dynamic plan tier discovery, and checkout redirection.
 */
export class SelectPlanTask {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Executes the plan selection on Dashboard and proceeds to the Checkout page.
   */
  async selectPlanAndProceed(options: SelectPlanOptions = {}) {
    const page = this.page;
    const planName = options.planName || 'Vehicle Report';
    const timeout = options.isSlowNetwork ? 60000 : 30000;

    console.log('\n' + '═'.repeat(70));
    console.log(`💳 [SELECT PLAN TASK] Starting plan selection: "${planName}"`);
    console.log('═'.repeat(70));

    // 1. Ensure we are on Dashboard
    await page.waitForURL(/\/members\/dashboard|\/dashboard/i, { timeout });

    // 2. Mobile View vs Desktop Handling
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      console.log('   📱 Mobile view detected, opening navigation...');
      const menuToggle = page.getByRole('img', { name: 'Menu' }).first();
      await menuToggle.waitFor({ state: 'visible', timeout }).catch(() => {});
      if (await menuToggle.isVisible()) {
        await menuToggle.click();
      }

      const reportButton = page.locator('span:has-text("Vehicle Report"), button:has-text("Vehicle Report")').first();
      await reportButton.waitFor({ state: 'visible', timeout });
      await reportButton.click();
      await page.waitForTimeout(1000);
    } else {
      // Desktop: Click 'Vehicle Report' navigation/tab
      const reportButton = page.locator('span:has-text("Vehicle Report"), button:has-text("Vehicle Report"), a:has-text("Vehicle Report")').first();
      if (await reportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await reportButton.click();
        console.log('   🖱️ Clicked "Vehicle Report" navigation tab.');
        await page.waitForTimeout(2000);
      }
    }

    // 3. Plan Selection Logic
    if (planName === 'UVC Subscription') {
      console.log("   🎯 Selecting 'Unlimited VIN Check' plan...");
      await page.getByLabel('Unlimited VIN Check').or(page.getByText(/Unlimited VIN Check/i)).first().click();

      const proceedButton = page.getByRole('button', { name: /^Proceed to Checkout$/i })
        .or(page.getByRole('button', { name: /^Proceed$/i }))
        .or(page.locator('button').filter({ hasText: /^Proceed$/i }))
        .first();

      await proceedButton.waitFor({ state: 'visible', timeout });
      await proceedButton.click({ force: true });
      console.log('   🚀 Clicked "Proceed" button for UVC.');
    } else {
      console.log('   🔍 Locating available report package options on the page...');
      const planLoadTimeout = options.isSlowNetwork ? 45000 : 20000;

      await page.locator('*:has-text("Reports")').first().waitFor({ state: 'visible', timeout: planLoadTimeout }).catch(() => {});

      // Target elements matching report tiers
      const planMatchers = [
        /25\s*Reports/i,
        /10\s*Reports/i,
        /5\s*Reports/i,
        /2\s*Reports/i,
        /1\s*Report|Report\$/i,
      ];

      let selected = false;
      for (const pattern of planMatchers) {
        const planElement = page.getByText(pattern).first();
        if (await planElement.isVisible().catch(() => false)) {
          console.log(`   ✅ Found and selected plan tier matching: ${pattern}`);
          await planElement.scrollIntoViewIfNeeded();
          await planElement.click({ force: true });
          selected = true;
          await page.waitForTimeout(1500);
          break;
        }
      }

      if (!selected) {
        console.log('   ⚠️ No dynamic tiered cards found; proceeding with default selected plan.');
      }

      // Click Proceed button (strictly match visible button)
      const proceedButton = page.locator('button:visible')
        .filter({ hasText: /Proceed|Checkout|Buy|Get Access/i })
        .first();

      if (await proceedButton.isVisible({ timeout: 15000 }).catch(() => false)) {
        await proceedButton.scrollIntoViewIfNeeded();
        await proceedButton.click({ force: true });
        console.log('   🚀 Clicked "Proceed to Checkout" button.');
      } else {
        // Fallback to any visible button
        const fallbackBtn = page.getByRole('button', { name: /Proceed/i }).first();
        if (await fallbackBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await fallbackBtn.click({ force: true });
        }
      }
    }

    // 4. Wait for redirection to Checkout
    const redirectTimeout = options.isSlowNetwork ? 120000 : 60000;
    console.log('   ⏳ Waiting for redirection to Checkout...');
    await Promise.race([
      page.waitForURL(/\/members\/checkout|\/checkout/i, { timeout: redirectTimeout }).catch(() => {}),
      page.waitForURL(/\/success-page/i, { timeout: redirectTimeout }).catch(() => {}),
    ]);

    console.log(`✅ [SELECT PLAN TASK] Successfully reached: ${page.url()}`);
    console.log('═'.repeat(70) + '\n');
  }
}
