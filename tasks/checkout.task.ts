import { Page, expect } from '@playwright/test';

export interface CardPaymentData {
  name?: string;
  cardNum?: string;
  expiry?: string;
  cvc?: string;
  zip?: string;
  countryCode?: string;
}

export class CheckoutTask {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Complete checkout filling all required fields (Name, Stripe, ZIP) and submitting
   */
  async completeCheckout(cardData: CardPaymentData = {}) {
    const page = this.page;
    const name = cardData.name || 'Shah Tester';
    const number = cardData.cardNum || '5454 5454 5454 5454';
    const exp = cardData.expiry || '02 / 30';
    const cvc = cardData.cvc || '265';
    const zip = cardData.zip || '749000';

    // 1. Wait for checkout route
    await page.waitForURL(/\/members\/checkout/i, { waitUntil: 'domcontentloaded' });

    // 2. Select 'Card' tab if present
    const cardTabButton = page.getByRole('button', { name: 'Card' });
    if (await cardTabButton.isVisible().catch(() => false)) {
      await cardTabButton.click();
    }

    // 3. Fill Name (Required Field)
    const nameInput = page.getByPlaceholder('Enter your name')
      .or(page.getByRole('textbox', { name: /name/i }))
      .or(page.locator('input[placeholder*="name" i]'))
      .first();

    await expect(nameInput).toBeVisible({ timeout: 30000 });
    await nameInput.click();
    await nameInput.fill(name);

    // 4. Target Stripe Iframes
    const cardFrame = page.frameLocator('iframe[title*="Secure card number" i], iframe[src*="cardNumber"], iframe[title*="card number" i]').first();
    const expiryFrame = page.frameLocator('iframe[title*="Secure expiration" i], iframe[src*="cardExpiry"], iframe[title*="expiration" i]').first();
    const cvcFrame = page.frameLocator('iframe[title*="Secure CVC" i], iframe[src*="cardCvc"], iframe[title*="CVC" i]').first();

    // Fill Card Number (Strictly match real Stripe input, excluding StripeField--fake)
    const cardField = cardFrame.locator('input[name="cardnumber"], input.InputElement').first();
    await expect(cardField).toBeVisible({ timeout: 30000 });
    await cardField.click();
    await cardField.fill(number);

    // Fill Expiry Date
    const expiryField = expiryFrame.locator('input[name="exp-date"], input.InputElement').first();
    await expect(expiryField).toBeVisible({ timeout: 15000 });
    await expiryField.click();
    await expiryField.fill(exp);

    // Fill CVC
    const cvcField = cvcFrame.locator('input[name="cvc"], input.InputElement').first();
    await expect(cvcField).toBeVisible({ timeout: 15000 });
    await cvcField.click();
    await cvcField.fill(cvc);

    // 5. Fill ZIP / Postal Code (Required Field)
    const zipInput = page.getByPlaceholder('Enter ZIP / Postal Code')
      .or(page.getByRole('textbox', { name: /ZIP/i }))
      .or(page.locator('input[name*="postal" i], input[name*="zip" i]'))
      .first();

    await expect(zipInput).toBeVisible({ timeout: 15000 });
    await zipInput.click();
    await zipInput.fill(zip);

    // 6. Click Pay Button
    const payButton = page.getByRole('button', { name: /Pay \$/i })
      .or(page.locator('button[type="submit"]'))
      .first();

    await expect(payButton).toBeEnabled({ timeout: 30000 });
    await payButton.click();
  }
}
