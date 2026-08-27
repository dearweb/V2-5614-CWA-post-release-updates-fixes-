import { Page, Locator } from '@playwright/test';

/**
 * BrowseTheWeb Helper
 * Provides automatic popup/consent interception using Playwright's native addLocatorHandler
 * and active smart overlay dismissal for exit-intent dialogs, cookies, and iframes.
 */
export class BrowseTheWeb {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.registerAutoPopupHandlers();
  }

  static using(page: Page): BrowseTheWeb {
    return new BrowseTheWeb(page);
  }

  /**
   * Automatically intercepts and dismisses overlay dialogs/popups whenever
   * any subsequent Playwright action is blocked by an overlay.
   */
  registerAutoPopupHandlers(): void {
    try {
      // Cookie consent & GDPR banner auto-handler (safe to auto-dismiss globally)
      const cookieAcceptBtn = this.page.locator(
        '#cookie-consent-accept, .cookie-accept-btn, .cc-accept, button:has-text("Accept All"), button:has-text("Allow All"), button:has-text("Accept Cookies"), button:has-text("I Agree"), button:has-text("Got it")'
      );
      this.page.addLocatorHandler(cookieAcceptBtn.first(), async (locator) => {
        console.log('🛡️ [Auto-Handler] Dismissing cookie consent banner...');
        await locator.click({ force: true }).catch(() => {});
      });

      // Exit-intent & promotional modal auto-handler
      const modalCloseBtn = this.page.locator(
        '#exitIntentCloseBtn, .exit-intent-close-btn, .modal-close, .close-modal-btn, button[aria-label*="close" i]'
      );
      this.page.addLocatorHandler(modalCloseBtn.first(), async (locator) => {
        console.log('🛡️ [Auto-Handler] Dismissing exit-intent / promo overlay modal...');
        await locator.click({ force: true }).catch(() => {});
      });
    } catch {
      // Fallback gracefully if addLocatorHandler is not supported
    }
  }

  /**
   * Smart Popup & Cookie Banner Dismissal Helper
   * Checks visible-only elements and frames to dismiss cookie consent dialogs,
   * newsletter modals, or GDPR popups without hanging test execution.
   */
  async dismissPopupsAndCookies(customTimeout: number = 2000): Promise<boolean> {
    const dismissSelectors = [
      '#exitIntentCloseBtn',
      '.exit-intent-close-btn',
      'button.exit-intent-secondary-btn',
      'button[aria-label*="close" i]',
      'button:has-text("Accept All")',
      'button:has-text("Allow All")',
      'button:has-text("Accept Cookies")',
      'button:has-text("I Agree")',
      'button:has-text("No Thanks")',
      'button:has-text("Got it")',
      '#cookie-consent-accept',
      '.cookie-accept-btn',
      '.cc-accept',
      '.modal-close',
      '.popup-close',
      '.close-modal-btn',
    ];

    for (const sel of dismissSelectors) {
      try {
        const locator = this.page.locator(sel).locator('visible=true').first();
        const isVisible = await locator.isVisible({ timeout: customTimeout }).catch(() => false);
        if (isVisible) {
          console.log(`🛡️ [Smart Wait] Cookie/Popup banner detected ("${sel}"). Dismissing...`);
          await locator.scrollIntoViewIfNeeded().catch(() => {});
          await locator.click({ force: true }).catch(() => {});
          await locator.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
          console.log('✅ [Smart Wait] Cookie/Popup banner dismissed successfully.');
          return true;
        }
      } catch {
        // Gracefully continue to next selector
      }
    }

    // Check embedded iframe overlays if present
    for (const frame of this.page.frames()) {
      try {
        const frameBtn = frame.locator('button[aria-label*="close" i], button:has-text("Accept"), button:has-text("I Agree")').locator('visible=true').first();
        if (await frameBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('🛡️ [Smart Wait] Dismissing popup inside iframe...');
          await frameBtn.click({ force: true }).catch(() => {});
          return true;
        }
      } catch {
        // Gracefully ignore frame errors
      }
    }

    return false;
  }
}
