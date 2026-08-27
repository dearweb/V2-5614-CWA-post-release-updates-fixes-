import { Page, Locator, expect, TestInfo } from '@playwright/test';

export interface UpsellValidationResult {
  isAutoSelected: boolean;
  apiCheckboxText: string;
  uiCheckboxText: string;
  isTextMatched: boolean;
  statusMessage: string;
}

export class UpsellAutoSelectTask {
  readonly page: Page;
  readonly upsellCheckbox: Locator;
  readonly upsellContainer: Locator;
  readonly upsellLabel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.upsellCheckbox = page.locator('#landing_decal, input[type="checkbox"]#landing_decal, input[aria-label="10"]');
    this.upsellContainer = page.locator('div[role="checkbox"]:has(#landing_decal), div:has(> #landing_decal)').first();
    this.upsellLabel = page.locator('label[for="landing_decal"], label:has-text("Get a window sticker")').first();
  }

  /**
   * Validates that:
   * 1. The checkbox text on Preview page matches the 'sticker_preview_page_checkbox_text' from site_settings API.
   * 2. The checkbox is auto-selected by default (checked).
   * 3. Returns 'upsell auto select' if verified, otherwise fails the test.
   */
  async validateUpsellAutoSelect(
    siteSettingsData?: any,
    testInfo?: TestInfo
  ): Promise<UpsellValidationResult> {
    const page = this.page;

    // 1. Get expected text from site_settings API (or fallback)
    const expectedApiText =
      siteSettingsData?.data?.sticker_preview_page_checkbox_text ||
      siteSettingsData?.sticker_preview_page_checkbox_text ||
      'Get a window sticker for your vehicle';

    // 2. Wait for the upsell checkbox or label to appear on the preview page
    const targetElement = this.upsellLabel.or(this.upsellCheckbox).first();
    await expect(targetElement).toBeVisible({ timeout: 20000 });

    // 3. Extract and match UI label text with API site_settings
    const uiLabelText = (await this.upsellLabel.textContent())?.trim() || '';
    const isTextMatched = uiLabelText.toLowerCase().includes(expectedApiText.toLowerCase());

    console.log('\n' + '═'.repeat(70));
    console.log('🏷️ [UPSELL AUTO-SELECT TASK]');
    console.log('═'.repeat(70));
    console.log(`   • API Site Setting Text: "${expectedApiText}"`);
    console.log(`   • UI Actual Label Text:  "${uiLabelText}"`);
    console.log(`   • Text Matched:          ${isTextMatched ? '✅ MATCHED' : '❌ MISMATCH'}`);

    // Assert text match
    expect(
      isTextMatched,
      `Preview upsell label text "${uiLabelText}" does not match site_settings API text "${expectedApiText}"`
    ).toBeTruthy();

    // 4. Verify that the checkbox is AUTO-SELECTED (checked)
    let isChecked = false;
    if (await this.upsellCheckbox.isVisible().catch(() => false)) {
      isChecked = await this.upsellCheckbox.isChecked();
    } else if (await this.upsellContainer.isVisible().catch(() => false)) {
      const ariaChecked = await this.upsellContainer.getAttribute('aria-checked');
      isChecked = ariaChecked === 'true';
    }

    console.log(`   • Checkbox Auto-Selected: ${isChecked ? '✅ YES (Checked by default)' : '❌ NO (Unchecked)'}`);

    // Fail the case if not auto-selected
    if (!isChecked) {
      console.log(`   ❌ RESULT: Upsell checkbox is NOT auto-selected! Failing case.`);
      console.log('═'.repeat(70) + '\n');
      throw new Error(
        `[UPSELL VALIDATION FAILED] The upsell checkbox (#landing_decal) is NOT auto-selected by default on preview page.`
      );
    }

    console.log(`   ✅ RESULT: "upsell auto select" verified successfully!`);
    console.log('═'.repeat(70) + '\n');

    const result: UpsellValidationResult = {
      isAutoSelected: true,
      apiCheckboxText: expectedApiText,
      uiCheckboxText: uiLabelText,
      isTextMatched: true,
      statusMessage: 'upsell auto select',
    };

    // Attach to HTML report
    if (testInfo) {
      await testInfo.attach('upsell-auto-select-result.json', {
        body: JSON.stringify(result, null, 2),
        contentType: 'application/json',
      });
    }

    return result;
  }
}
